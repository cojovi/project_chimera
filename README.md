# PROTOCOL CHIMERA

A dead man's switch. Upload files, set a check-in interval, arm the switch. Miss
a check-in and your encrypted payload is decrypted server-side and emailed to
whoever you designated. The timer runs on a server, not in your browser — it
fires whether or not anything is open.

## Branches

| | `main` | `multiple` (this branch) |
|---|---|---|
| Users | one operator | unlimited accounts |
| Auth | single password | email + passphrase (Supabase Auth) |
| Landing | countdown + password box | public wall of all armed timers + login |
| Check-in | typing the password | CHECK IN button in your console |

Both branches share one Supabase project; the multi-user schema is additive so
`main` continues to work unchanged.

## How it works (multi-user)

1. Landing page shows a live wall of every armed switch by callsign, plus four
   mock protocols so it never looks empty.
2. Enlist with email + callsign + passphrase, or log in.
3. Console: check in, arm/disarm, set interval (24h → 1 year), upload payload
   files, set recipient + CCs, edit the release email, pick your callsign and
   whether you appear on the wall, rotate your passphrase.
4. At **10% time remaining** you get one reminder email per cycle. Miss T-zero
   and the payload goes out; the switch marks itself expended.

## Stack

- Frontend: Vite + React + TypeScript + Tailwind + Framer Motion (static → Vercel)
- Backend: Supabase project `znnpklgdfgnnwrnvufgr`
  - Auth for accounts; `profiles` / `switches` / `user_payload_files` tables
    (RLS: service-role only — all access via edge functions)
  - Edge functions: `wall` (public feed + signup), `user-api` (per-user,
    JWT-scoped), `check-switch-multi` (cron)
  - pg_cron job `chimera-check-multi` every minute
  - Secrets in Supabase Vault (Resend key, AES key, cron secret)
- Email: Resend, sending from `chimera@cojovi.com`

## Develop

```
npm install
npm run dev
```

## Deploy

Push and import into Vercel (framework auto-detected), or `npx vercel --prod`.

## Notes

- **Signup is currently open** to anyone who reaches the URL. Add an invite
  code or allowlist before putting this on a public domain.
- Payload limits: 10 MB per file, 20 files per user.
- Mock timers live in the `mock_timers` table — delete those rows once you have
  enough real operators on the wall.
