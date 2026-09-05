# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branches — READ THIS FIRST

This repo has three intentionally divergent versions of the app. **Do not
"unify" them.**

- **`main`** — v1, single operator. One hardcoded-in-DB bcrypt password hash gates
  everything. The password itself is NOT recorded here — this repo is public.
  Rotate it with `select public.set_password('<new>')` as the service role. No accounts, no login. Cody wants this
  branch preserved exactly as-is.
- **`killswitch`** (this branch) — v2.1, the live product at
  **www.operationkillswitch.com**. Everything `multiple` has, plus the
  Operation Kill Switch rebrand and gated signup (see below). This is the
  branch that ships.
- **`multiple`** — v2, multi-tenant. Real Supabase Auth accounts
  (email + passphrase), one switch per user, public landing wall showing every
  armed switch by callsign plus 4 mock protocols. Login = identity; a CHECK IN
  button in the console resets the clock (no separate arm code).

All branches point at the **same Supabase project** (`znnpklgdfgnnwrnvufgr`).
The v2 schema is purely additive, so v1 tables/functions/cron still work
untouched and `main` keeps running.

## Naming — brand vs. plumbing

The product was renamed from Project Chimera to **Operation Kill Switch** when
`operationkillswitch.com` was acquired. The rebrand covers *user-visible
strings only*. These identifiers still say "chimera" on purpose and must NOT
be renamed — `main` shares this Supabase project and renaming them breaks v1
silently:

- pg_cron jobs `chimera-check-multi` and `chimera-check-switch`
- the migration filenames `20260727_chimera_v1.sql` /
  `20260801_chimera_multiuser.sql`
- the `FROM_EMAIL` vault secret's current value (`chimera@cojovi.com`) — swap
  this to a `@operationkillswitch.com` sender in Vault only after that domain
  is verified in Resend with DKIM + SPF green. It is a Vault value, not code.

## Signup gating (v2.1)

Signup is no longer open. `wall`'s `signup` action takes an optional
`invite_code`:

- **Valid code** → `redeem_invite_code()` consumes a use atomically and the
  profile lands as `status = 'approved'`. Straight into the console.
- **Invalid / expired / exhausted code** → hard 403. A typo is never silently
  downgraded to pending; that reads as a bug.
- **No code** → profile lands `status = 'pending'`, `show_on_wall = false`.
  The account exists and can log in, but `user-api` refuses every action
  outside `UNGATED_ACTIONS` (config / update_config) until an admin clears it.
  The frontend shows `PendingScreen` instead of the console.

Passphrases are **never** held in a pending-approval table — the auth user is
created immediately and the gate is a status column. Don't "improve" this into
credential custody.

Admin surface is `#/command` (hash route, so no static-host rewrite rule
needed), visible only when `profiles.is_admin` is true. All admin actions are
prefixed `admin_` in `user-api` and re-check `is_admin` server-side; the
frontend flag is decoration only.

Invite codes live in `public.invite_codes` (code / label / max_uses /
used_count / expires_at / active). Issue one per marketing channel so
conversion is attributable — `profiles.invite_code` records which code a user
came in on.

## Security

Audited 2026-09-05 — see `SECURITY.md` for the findings table and the
outstanding manual steps. Re-run `./scripts/security-probe.sh` after any deploy;
it is safe against production (reads only, plus writes that must be refused).

Two rules that are easy to break by accident:

- **Revoke functions from `PUBLIC`, not just `anon, authenticated`.** Roles
  inherit the `PUBLIC` grant, so `revoke ... from anon, authenticated` leaves a
  `SECURITY DEFINER` function wide open. That exact mistake in
  `20260901_okswitch_signup_gate.sql` made `redeem_invite_code()` callable by
  anyone holding the shipped anon key.
- **`test_email` sends mail from a DKIM-signed domain to a user-chosen
  recipient.** It is rate limited to 3/hour and 10/day per operator. Do not
  loosen that without putting something else in front of it.

## What this is

Operation Kill Switch is a dead man's switch. A server-side timer (Supabase pg_cron,
every minute) checks each deadline; if the operator hasn't checked in before
T-zero, an edge function decrypts their payload files and emails them to the
designated recipient(s) via Resend. At 10% time remaining the operator gets a
one-per-cycle reminder email. The frontend is a static tech-noir React app
(Vite + Tailwind + Framer Motion).

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm run build` — `tsc && vite build`
- `npm run lint` — ESLint
- `npm run preview` — serve production build

## Architecture (v2 / this branch)

- `src/lib/supabase.ts` — Supabase client (auth + session persistence).
- `src/lib/api.ts` — the only backend client. Public calls hit `wall`
  (feed/signup); authenticated calls hit `user-api` with the session JWT.
- `src/App.tsx` — orchestrator. Views: boot → landing (TimerWall + AuthPanel)
  → console. Server clock offset comes from the feed's `server_time`.
- `src/components/TimerWall.tsx` — public grid of ticking countdown cards
  (real armed switches by callsign + mocks).
- `src/components/AuthPanel.tsx` — login / signup toggle (signup takes email,
  callsign, passphrase).
- `src/components/Console.tsx` — per-user panels: timing, payload vault,
  delivery directive, identity (callsign + wall visibility), security.
- `supabase/functions/*/index.ts` — **repo copies** of the deployed edge
  functions (deployed via Supabase MCP/CLI, not bundled by Vite):
  - v2: `wall` (public feed + gated signup), `user-api` (JWT-scoped per-user
    API + `admin_*` actions),
    `check-switch-multi` (cron, loops all armed switches)
  - v1 (still deployed for `main`): `switch-api`, `check-switch`
- `supabase/migrations/` — `20260727_chimera_v1.sql` (single-user),
  `20260801_chimera_multiuser.sql` (profiles / switches / user_payload_files /
  mock_timers + the `chimera-check-multi` cron job), and
  `20260901_okswitch_signup_gate.sql` (profiles.status / is_admin,
  invite_codes, redeem_invite_code()).

## Gotchas

- **Signup auto-confirms email** via `auth.admin.createUser({email_confirm:
  true})` in the `wall` function — no confirmation email round-trip. Signup is
  gated by invite code or manual approval (see above), but there is still **no
  bot protection** on the endpoint beyond a 250-pending ceiling. Put Cloudflare
  Turnstile in front of it before any real traffic.
- Edge functions deploy with `verify_jwt: false`. `user-api` does its own auth
  by calling `supabase.auth.getUser(token)`; `check-switch-multi` uses the
  `x-cron-secret` from Vault. Don't "fix" this by flipping `verify_jwt` on.
- Secrets (Resend key, AES key, cron secret) live in Supabase Vault, read via
  the service-role-only `get_secret` RPC. Frontend env is just
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- **Mock timers** live in the `mock_timers` table. The `wall` feed rolls any
  expired mock forward by its interval, so they tick forever without a cron.
  Delete the rows when there are enough real users.
- Payload files are AES-256-GCM encrypted in the edge function before hitting
  the private `payload` bucket. v2 files are namespaced `multi/<user_id>/…`;
  v1 files sit at the bucket root, so the two never collide.
- Switches ship **disarmed** and fire at most once; re-arming after a trigger
  is explicit. Arming requires a recipient email to be set — and now an
  `approved` account.
- The public wall filters on `status === 'approved' && show_on_wall`, so a
  pending or denied operator can never surface there.
- Resend sends from `chimera@cojovi.com` (domain verified, DKIM+SPF green), so
  delivery to arbitrary recipients works.
