# PROTOCOL CHIMERA

A single-operator dead man's switch. Files are stored AES-256-GCM encrypted in a
private Supabase Storage bucket. A server-side timer (pg_cron, every minute)
checks the deadline — if the operator fails to check in before T-zero, the
payload is decrypted server-side and emailed to the designated recipient (+CCs)
via Resend. The switch fires whether or not any browser is open.

## How it works

1. Visit the site → giant countdown. Enter the authorization code to check in
   (resets the clock) and open the management console.
2. Console: arm/disarm, set the check-in interval (24h → 1 year), upload/remove
   payload files, set recipient + CC addresses, edit the release email, send a
   test transmission, rotate the code.
3. Miss a check-in while armed → `check-switch` edge function fires the email
   and marks the switch `triggered`.

## Stack

- Frontend: Vite + React + TypeScript + Tailwind + Framer Motion (static, deploys to Vercel)
- Backend: Supabase project `znnpklgdfgnnwrnvufgr` (`project-chimera`)
  - Postgres `switch_state` / `payload_files` (RLS: service-role only)
  - Edge functions `switch-api` (password-gated API) and `check-switch` (cron trigger)
  - pg_cron job `chimera-check-switch` every minute
  - Secrets in Supabase Vault (Resend key, AES key, cron secret)
- Email: Resend

## Develop

```
npm install
npm run dev
```

First time after the rebuild? Run `bash cleanup.sh` once to purge legacy files.

## Deploy

Push to a git repo and import into Vercel (framework auto-detected), or
`npx vercel --prod`. No env vars strictly required — the Supabase URL is baked
in with `VITE_SUPABASE_URL` as an override.

## Important notes

- Resend without a verified domain sends from `onboarding@resend.dev` and only
  delivers to the email address on the Resend account. Verify a domain in the
  Resend dashboard (then update the `FROM_EMAIL` Vault secret) to send to
  arbitrary recipients.
- The switch ships **disarmed**. Arm it from the console.
- Payload limits: 10 MB/file, 20 files.
