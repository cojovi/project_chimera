-- Project Chimera v2 — multi-user expansion (branch: multiple).
-- ADDITIVE: the v1 single-user tables (switch_state, payload_files) are left
-- untouched so the `main` branch single-password app keeps working unchanged.
-- Already applied to project znnpklgdfgnnwrnvufgr.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  callsign text not null unique check (char_length(callsign) between 2 and 24),
  show_on_wall boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.switches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'disarmed' check (status in ('armed','disarmed','triggered')),
  interval_minutes int not null default 1440,
  next_trigger_at timestamptz not null default now() + interval '24 hours',
  last_checkin_at timestamptz,
  recipient_email text not null default '',
  cc_emails text[] not null default '{}',
  operator_email text not null default '',
  email_subject text not null default 'PROTOCOL CHIMERA :: FAILSAFE ACTIVATED',
  email_message text not null default 'The dead man''s switch operated by the sender was not reset before its deadline. The attached files were released automatically per standing instructions.',
  triggered_at timestamptz,
  reminder_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.user_payload_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null unique,
  iv text not null,
  created_at timestamptz not null default now()
);
create index user_payload_files_user_idx on public.user_payload_files(user_id);

-- Mock timers for the public wall (fake; the wall feed rolls them forward
-- whenever they expire so they tick forever)
create table public.mock_timers (
  id serial primary key,
  callsign text not null,
  interval_minutes int not null,
  next_trigger_at timestamptz not null
);
insert into public.mock_timers (callsign, interval_minutes, next_trigger_at) values
  ('NIGHTHAWK', 259200, now() + interval '147 days'),
  ('VESPER',    259200, now() + interval '63 days'),
  ('IRONVEIL',  129600, now() + interval '81 days'),
  ('LONGHORN',  259200, now() + interval '172 days');

-- Service-role only; all access flows through the edge functions
alter table public.profiles enable row level security;
alter table public.switches enable row level security;
alter table public.user_payload_files enable row level security;
alter table public.mock_timers enable row level security;
revoke all on public.profiles from anon, authenticated;
revoke all on public.switches from anon, authenticated;
revoke all on public.user_payload_files from anon, authenticated;
revoke all on public.mock_timers from anon, authenticated;

-- Multi-user heartbeat (runs alongside the v1 'chimera-check-switch' job)
select cron.schedule(
  'chimera-check-multi',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://znnpklgdfgnnwrnvufgr.supabase.co/functions/v1/check-switch-multi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
