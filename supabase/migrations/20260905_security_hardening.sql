-- Operation Kill Switch — security hardening (branch: killswitch).
-- ADDITIVE + corrective. Does not alter v1 tables, so `main` keeps running.
--
-- Fixes found by the 2026-09-05 audit:
--   CRIT-1  redeem_invite_code() was EXECUTE-able by PUBLIC (hence anon).
--           The v2.1 migration revoked it from `anon, authenticated` but not
--           from `public`, and roles inherit the PUBLIC grant — so anyone
--           holding the shipped anon key could probe and DRAIN invite codes
--           over the REST RPC endpoint without ever authenticating.
--   HIGH-1  No rate limiting anywhere. Adds a service-role-only token bucket.
--   MED-1   SECURITY DEFINER search_path pinned to '' (was `public`).

-- ══════════════════════════════════════════════ CRIT-1: function lockdown
-- Revoke from PUBLIC (the inherited grant), not just the named roles.
revoke all on function public.redeem_invite_code(text) from public, anon, authenticated;
revoke all on function public.get_secret(text)          from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'verify_password') then
    execute 'revoke all on function public.verify_password(text) from public, anon, authenticated';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'set_password') then
    execute 'revoke all on function public.set_password(text) from public, anon, authenticated';
  end if;
end $$;

-- Anything created in public from here on is service-role only by default.
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Belt and braces: no EXECUTE on the whole schema, no schema-level USAGE creep.
revoke all on all functions in schema public from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;

-- ═══════════════════════════════════ CRIT-1b: pin search_path, re-create fn
create or replace function public.redeem_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
begin
  if p_code is null or btrim(p_code) = '' then
    return false;
  end if;

  update public.invite_codes
     set used_count = used_count + 1
   where id = (
     select id
       from public.invite_codes
      where lower(btrim(code)) = lower(btrim(p_code))
        and active
        and (expires_at is null or expires_at > now())
        and (max_uses is null or used_count < max_uses)
      limit 1
      for update
   )
  returning id into v_id;

  return v_id is not null;
end;
$fn$;
revoke all on function public.redeem_invite_code(text) from public, anon, authenticated;

-- Give back a use when the signup that consumed it could not be completed
-- (duplicate email, profile insert failure). Without this, an attacker can
-- burn every use of a code by replaying signups with an address they know
-- is already registered.
create or replace function public.refund_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
begin
  if p_code is null or btrim(p_code) = '' then
    return false;
  end if;

  update public.invite_codes
     set used_count = greatest(used_count - 1, 0)
   where id = (
     select id from public.invite_codes
      where lower(btrim(code)) = lower(btrim(p_code))
      limit 1
      for update
   )
  returning id into v_id;

  return v_id is not null;
end;
$fn$;
revoke all on function public.refund_invite_code(text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════ HIGH-1: rate limit buckets
create table if not exists public.rate_limits (
  bucket       text primary key,
  hits         int not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;
revoke all on public.rate_limits from public, anon, authenticated;

create index if not exists rate_limits_window_idx on public.rate_limits(window_start);

-- Atomic fixed-window counter. Returns TRUE when the call is allowed.
-- One statement, so concurrent edge-function isolates cannot race past it.
create or replace function public.rl_hit(
  p_bucket text,
  p_window_seconds int,
  p_max int
) returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_hits int;
begin
  insert into public.rate_limits (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case
                 when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                 then 1
                 else public.rate_limits.hits + 1
               end,
        window_start = case
                 when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                 then now()
                 else public.rate_limits.window_start
               end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$fn$;
revoke all on function public.rl_hit(text,int,int) from public, anon, authenticated;

-- Housekeeping so the table cannot grow without bound.
create or replace function public.rl_sweep()
returns void
language sql
security definer
set search_path = ''
as $fn$
  delete from public.rate_limits where window_start < now() - interval '2 days';
$fn$;
revoke all on function public.rl_sweep() from public, anon, authenticated;

select cron.schedule('okswitch-rl-sweep', '17 4 * * *', $$select public.rl_sweep();$$)
where not exists (select 1 from cron.job where jobname = 'okswitch-rl-sweep');

-- ══════════════════════════════════════════════ defence in depth: force RLS
-- Without FORCE, a table owner (or anything running as owner) bypasses RLS.
alter table public.profiles           force row level security;
alter table public.switches           force row level security;
alter table public.user_payload_files force row level security;
alter table public.mock_timers        force row level security;
alter table public.invite_codes       force row level security;
alter table public.switch_state       force row level security;
alter table public.payload_files      force row level security;
