# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Project Chimera is a single-operator dead man's switch. A server-side timer
(Supabase pg_cron, every minute) checks a deadline; if the operator hasn't
checked in with the password before T-zero, an edge function decrypts the
payload files and emails them to the designated recipient(s) via Resend. The
frontend is a static tech-noir React app (Vite + Tailwind + Framer Motion)
that shows the countdown and, after password entry, a management console.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm run build` — `tsc && vite build`
- `npm run lint` — ESLint
- `npm run preview` — serve production build
- `bash cleanup.sh` — one-shot removal of pre-rebuild legacy files (run once; safe to delete after)

## Architecture

**All state lives in Supabase project `znnpklgdfgnnwrnvufgr` (`project-chimera`).**
The frontend is stateless; closing the tab changes nothing.

- `src/lib/api.ts` — the only backend client. POSTs `{action, password?, ...}`
  to edge function `switch-api`. Public action: `status`. Everything else
  requires the operator password.
- `src/App.tsx` — orchestrator. Views: `boot` → `locked` (countdown +
  PasswordGate) → `unlocked` (Console). Correct password = `checkin` action
  (resets clock) + opens console. Server clock offset from `status.server_time`.
- `src/components/Console.tsx` — management panels: timing (interval presets +
  custom), payload vault (upload/download/delete), delivery directive
  (recipient/CC/subject/message/test email), security (rotate password).
- `supabase/functions/*/index.ts` — **repo copies** of the deployed edge
  functions (deployed via Supabase MCP/CLI, not bundled by Vite):
  - `switch-api` — password-gated API. Bcrypt verify via `verify_password` RPC.
    Files AES-256-GCM encrypted in the function before upload to the private
    `payload` bucket; key in Supabase Vault.
  - `check-switch` — called every minute by pg_cron job `chimera-check-switch`
    with `x-cron-secret` header (from Vault). Fires the Resend email with
    decrypted attachments, sets status `triggered`. Accepts `{"force":true}`
    for testing.
- `supabase/migrations/20260727_chimera_v1.sql` — consolidated schema (already
  applied): `switch_state` single-row table, `payload_files` registry, RLS
  locked to service role, `get_secret`/`verify_password`/`set_password`
  security-definer RPCs, storage bucket, cron schedule.

## Gotchas

- **Resend without a verified domain** sends from `onboarding@resend.dev` and
  only delivers to the Resend account owner's email. For arbitrary recipients,
  verify a domain in Resend and update the `FROM_EMAIL` Vault secret.
- Edge functions are deployed with `verify_jwt: false`; auth is the operator
  password (bcrypt in DB) / cron secret (Vault). Do not "fix" this by enabling
  JWT verification — the app has no Supabase Auth users.
- Secrets (Resend key, AES key, cron secret) live in Supabase Vault, read via the
  service-role-only `get_secret` RPC. Nothing secret belongs in `.env` —
  frontend env is just `VITE_SUPABASE_URL`.
- The switch ships **disarmed** and fires at most once; re-arming after a
  trigger is explicit (`arm` action clears `triggered_at`).
- Legacy pre-rebuild files (old Express backend, Gmail scripts, zustand store,
  old supabase functions) are removed by `cleanup.sh`. If it hasn't been run
  yet, `tsconfig.app.json` deliberately whitelists only the new files and
  eslint ignores the legacy paths — keep it that way until cleanup runs.
