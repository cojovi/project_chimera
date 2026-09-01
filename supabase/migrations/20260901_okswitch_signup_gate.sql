-- Operation Kill Switch — signup gating + admin panel (branch: killswitch).
-- ADDITIVE. Does not touch the v1 single-user tables, so `main` keeps running.
--
-- Adds: profiles.status / is_admin / signup metadata, an invite_codes table
-- with an atomic redeem function, and rebrands the default email subject.

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column if not exists status text not null default 'pending',
  add column if not exists is_admin boolean not null default false,
  add column if not exists signup_email text,
  add column if not exists signup_note text,
  add column if not exists invite_code text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists denial_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('pending','approved','denied'));
  end if;
end $$;

create index if not exists profiles_status_idx on public.profiles(status);

-- Grandfather everyone who already had an account before this migration.
update public.profiles set status = 'approved', reviewed_at = now()
 where status = 'pending';

-- Backfill signup_email from auth so the admin queue has something to show.
update public.profiles p
   set signup_email = u.email
  from auth.users u
 where u.id = p.user_id and p.signup_email is null;

-- ----------------------------------------------------------- invite_codes
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null default '',
  max_uses int,                          -- null = unlimited
  used_count int not null default 0,
  expires_at timestamptz,                -- null = never expires
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(btrim(code)) between 4 and 64),
  check (max_uses is null or max_uses > 0)
);

create unique index if not exists invite_codes_code_lower_idx
  on public.invite_codes (lower(btrim(code)));

-- Atomic redeem: locks the row, re-checks every condition, bumps the counter.
-- Returns true only if the code was valid AND successfully consumed.
create or replace function public.redeem_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
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

-- ------------------------------------------------------------------ email
alter table public.switches
  alter column email_subject set default 'OPERATION KILL SWITCH :: FAILSAFE ACTIVATED';

update public.switches
   set email_subject = 'OPERATION KILL SWITCH :: FAILSAFE ACTIVATED'
 where email_subject = 'PROTOCOL CHIMERA :: FAILSAFE ACTIVATED';

-- ---------------------------------------------------------------- lockdown
alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;
revoke all on function public.redeem_invite_code(text) from anon, authenticated;

-- --------------------------------------------------------------- seed data
-- Promote the operator account to admin. The live account is cojovi@icloud.com
-- (callsign CHEEKSPREADER); the gmail address is listed too in case it is ever
-- used to sign in.
update public.profiles p
   set is_admin = true, status = 'approved'
  from auth.users u
 where u.id = p.user_id
   and lower(u.email) in ('cojovi@icloud.com', 'cojovi.mma@gmail.com');

-- One starter invite code so the front door works immediately.
insert into public.invite_codes (code, label, max_uses, active)
values ('FIRSTLIGHT', 'initial launch code', 25, true)
on conflict do nothing;

-- APPLIED to project znnpklgdfgnnwrnvufgr on 2026-09-01 via the Supabase
-- Management API. Verified: profiles gained all 8 columns, the single existing
-- account was grandfathered to approved + admin, invite_codes seeded with
-- FIRSTLIGHT (25 uses), redeem_invite_code() returns false for unknown codes,
-- and switches.email_subject was rebranded.
