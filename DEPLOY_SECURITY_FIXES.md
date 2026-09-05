# Deploying the 2026-09-05 security fixes

Four steps. The first two are the ones that close live vulnerabilities.

---

## 1. Revoke the leaked Mailgun key  ⏱ 1 min  🔴 do this first

`github.com/cojovi/project_chimera` is **public**, and commit `9ae26db` contains
a `.env` with a Mailgun API key that still authenticates. Anyone who cloned the
repo has it.

→ Mailgun dashboard → API Keys → delete it. You said you never used Mailgun for
this, so nothing breaks.

Then purge it from history (optional, but it stops the next person finding it):

```bash
./purge-env-from-history.sh          # backup already taken; script verifies before it finishes
git remote add origin https://github.com/cojovi/project_chimera.git
git push --force --all origin
```

The `service_role` key sitting next to it belongs to Supabase project
`suxdvdtswejtyciwnkdt`, which is deleted — that one is already inert.

---

## 2. Apply the database migration  ⏱ 1 min  🔴 closes the invite-code hole

The SQL is on your clipboard, and the Supabase SQL editor is already open in the
`MacBookPro_cojovi_acct` Chrome window. Click into the editor, `⌘A`, `⌘V`, `⌘↵`.

If the clipboard has moved on, the same script is at
`supabase/migrations/20260905_security_hardening.sql`.

It should print five rows ending in `firstlight_used=0` and `auth_users=1`.
`redeem_acl` must **not** be `NULL` — `NULL` is what "inherits the PUBLIC grant"
looks like, and that is the bug being fixed.

The migration also deletes the 10 throwaway accounts my testing created
(`ZZAUDIT*`, `ZZFLOOD*`) and restores the 5 `FIRSTLIGHT` uses I burned proving
the exploit.

---

## 3. Redeploy the three edge functions  ⏱ 3 min

Dashboard → Edge Functions → each one → paste the new `index.ts` → Deploy.

| Function | File | Keep `verify_jwt` |
|---|---|---|
| `wall` | `supabase/functions/wall/index.ts` | **off** |
| `user-api` | `supabase/functions/user-api/index.ts` | **off** |
| `check-switch-multi` | `supabase/functions/check-switch-multi/index.ts` | **off** |

`verify_jwt` stays off on all three — each does its own auth, and flipping it on
breaks the public wall feed and the cron job. Deploy the migration **before**
the functions: they call `rl_hit`, and the rate limiter fails **closed**, so
functions deployed against the old schema will refuse every request.

Do not touch `switch-api` or `check-switch` — those are v1, still serving `main`.

---

## 4. Push the frontend  ⏱ 1 min

```bash
git add -A && git commit -m "Harden: authz, rate limiting, CSP, input validation" && git push
```

Vercel picks up `vercel.json` and starts sending the CSP and the rest of the
security headers.

---

## Then verify

```bash
./scripts/security-probe.sh
```

Every check should pass. It is safe against production — it only reads, plus
writes that are supposed to be refused.

## Before you market it

Turn on Turnstile. Rate limiting makes bulk signup expensive; a captcha is what
actually stops it. Both sides are already wired and dormant:

- `TURNSTILE_SECRET` → Supabase Vault
- `VITE_TURNSTILE_SITE_KEY` → Vercel environment variables

Also worth two clicks: Supabase → Auth → Providers → Email → enable leaked
password protection (checks new passwords against HaveIBeenPwned).
