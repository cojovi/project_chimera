-- Project Chimera v1 — consolidated schema (already applied to project znnpklgdfgnnwrnvufgr).
-- Kept in-repo as the source of truth for rebuilding the backend from scratch.

-- Extensions
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Single-row switch state
create table public.switch_state (
  id int primary key default 1 check (id = 1),
  status text not null default 'disarmed' check (status in ('armed','disarmed','triggered')),
  interval_minutes int not null default 1440,
  next_trigger_at timestamptz not null default now() + interval '24 hours',
  last_checkin_at timestamptz,
  password_hash text not null,
  recipient_email text not null default 'cojovi@icloud.com',
  cc_emails text[] not null default '{}',
  operator_email text not null default 'cojovi.mma@gmail.com',
  reminder_sent_at timestamptz,
  email_subject text not null default 'PROTOCOL CHIMERA :: FAILSAFE ACTIVATED',
  email_message text not null default 'The dead man''s switch operated by the sender was not reset before its deadline. The attached files were released automatically per standing instructions.',
  triggered_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Payload file registry (bytes live AES-256-GCM encrypted in Storage bucket 'payload')
create table public.payload_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null unique,
  iv text not null,
  created_at timestamptz not null default now()
);

-- Lock everything down: service role only (edge functions)
alter table public.switch_state enable row level security;
alter table public.payload_files enable row level security;
revoke all on public.switch_state from anon, authenticated;
revoke all on public.payload_files from anon, authenticated;

-- Seed initial state (password set via crypt at creation time)
insert into public.switch_state (id, password_hash)
values (1, extensions.crypt('CHANGE-ME', extensions.gen_salt('bf')));

-- Secret accessor for edge functions (service role only).
-- Secrets stored in Supabase Vault: ENCRYPTION_KEY, CRON_SECRET,
-- RESEND_API_KEY, FROM_EMAIL
create or replace function public.get_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke execute on function public.get_secret(text) from public, anon, authenticated;

-- Password RPCs
create or replace function public.verify_password(pw text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select password_hash = extensions.crypt(pw, password_hash)
  from public.switch_state where id = 1;
$$;
revoke execute on function public.verify_password(text) from public, anon, authenticated;

create or replace function public.set_password(new_pw text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.switch_state
  set password_hash = extensions.crypt(new_pw, extensions.gen_salt('bf')),
      updated_at = now()
  where id = 1;
$$;
revoke execute on function public.set_password(text) from public, anon, authenticated;

-- Private storage bucket for encrypted payload
insert into storage.buckets (id, name, public)
values ('payload', 'payload', false)
on conflict (id) do nothing;

-- Heartbeat: check the switch every minute
select cron.schedule(
  'chimera-check-switch',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://znnpklgdfgnnwrnvufgr.supabase.co/functions/v1/check-switch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
