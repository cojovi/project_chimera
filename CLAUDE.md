# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branches — READ THIS FIRST

This repo has two intentionally divergent versions of the app. **Do not
"unify" them.**

- **`main`** — v1, single operator. One hardcoded-in-DB password (`bluemoon25`
  unless rotated) gates everything. No accounts, no login. Cody wants this
  branch preserved exactly as-is.
- **`multiple`** (this branch) — v2, multi-tenant. Real Supabase Auth accounts
  (email + passphrase), one switch per user, public landing wall showing every
  armed switch by callsign plus 4 mock protocols. Login = identity; a CHECK IN
  button in the console resets the clock (no separate arm code).

Both branches point at the **same Supabase project** (`znnpklgdfgnnwrnvufgr`).
The v2 schema is purely additive, so v1 tables/functions/cron still work
untouched and `main` keeps running.

## What this is

Project Chimera is a dead man's switch. A server-side timer (Supabase pg_cron,
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
  - v2: `wall` (public feed + signup), `user-api` (JWT-scoped per-user API),
    `check-switch-multi` (cron, loops all armed switches)
  - v1 (still deployed for `main`): `switch-api`, `check-switch`
- `supabase/migrations/` — `20260727_chimera_v1.sql` (single-user) and
  `20260801_chimera_multiuser.sql` (profiles / switches / user_payload_files /
  mock_timers + the `chimera-check-multi` cron job).

## Gotchas

- **Signup auto-confirms email** via `auth.admin.createUser({email_confirm:
  true})` in the `wall` function — no confirmation email round-trip. Signup is
  open to anyone who can reach the URL; add an invite gate before going public.
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
  is explicit. Arming requires a recipient email to be set.
- Resend sends from `chimera@cojovi.com` (domain verified, DKIM+SPF green), so
  delivery to arbitrary recipients works.
