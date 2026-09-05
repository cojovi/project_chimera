# Security — Operation Kill Switch

Audited 2026-09-05 (branch `killswitch`, live project `znnpklgdfgnnwrnvufgr`).
Re-run the black-box regression suite after every deploy:

```bash
./scripts/security-probe.sh
```

## Trust model

- **Nothing** in `public` is reachable with the shipped anon key. Every table
  has RLS enabled *and forced*, and `anon` / `authenticated` hold no grants at
  all. This was verified live, not just asserted in a migration.
- All reads and writes go through edge functions running as `service_role`,
  which authenticate the caller themselves (`user-api` validates the Supabase
  Auth JWT; `check-switch-multi` checks a Vault cron secret in constant time).
- Payload bytes are AES-256-GCM encrypted in the edge function before they
  touch the private `payload` bucket. The key lives in Vault and is readable
  only through the `service_role`-only `get_secret` RPC.
- The anon key in the frontend bundle is public by design and grants nothing.

## Findings from the 2026-09-05 audit

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **Critical** | Public GitHub repo carried a **live Mailgun API key** in `.env` at commit `9ae26db`. Also a `service_role` key for Supabase project `suxdvdtswejtyciwnkdt` (that project is deleted, so the key is inert). | Key must be **revoked in Mailgun**; `purge-env-from-history.sh` rewrites it out of history |
| 2 | **Critical** | `redeem_invite_code()` was `EXECUTE`-able by `PUBLIC`. The v2.1 migration revoked it from `anon, authenticated` but not from `PUBLIC`, and roles inherit the `PUBLIC` grant. Anyone with the shipped anon key could confirm valid invite codes and **drain every use** of them over the REST RPC endpoint, unauthenticated and unthrottled. Verified exploitable: 5 uses of `FIRSTLIGHT` were consumed during testing (since restored). | Fixed — `20260905_security_hardening.sql` |
| 3 | **Critical** | `test_email` was an **open mail relay**. Any approved account could set an arbitrary recipient plus 10 CC addresses and fire unlimited mail from the DKIM-signed `cojovi.com` sender. Measured 15/15 accepted in 10 s. One abusive signup ends the Resend account and blacklists the domain. | Fixed — 3/hour, 10/day per operator |
| 4 | High | The v1 operator password was written in plaintext in `CLAUDE.md`, in a public repo. | Scrubbed; **rotate the password** |
| 5 | High | No rate limiting anywhere. 8/8 accounts created in 6 s from one IP; the 250-pending ceiling is reachable in ~3 minutes, which both DoSes real signups and floods `auth.users`. | Fixed — Postgres token bucket (`rl_hit`), per-IP + per-user + global |
| 6 | High | Signup echoed the auth error verbatim, turning it into an **account-existence oracle** ("A user with this email address has already been registered"). | Fixed — generic response |
| 7 | High | Both edge functions returned `String(e)` on any exception, leaking Postgres error text, table names and upstream API bodies. | Fixed — logged with a reference id, generic response |
| 8 | High | No CSP and no security headers in production. Clickjacking and script-injection had no backstop. | Fixed — `vercel.json` |
| 9 | Medium | `Access-Control-Allow-Origin: *` on both functions. | Fixed — origin allowlist |
| 10 | Medium | `cc_emails` was `.map()`-ed without a type check; a string or `null` produced a 500 with a raw `TypeError`. | Fixed — `Array.isArray` |
| 11 | Medium | Upload accepted any `file_name`: traversal sequences (`..\..\win.ini`), path separators, control characters and 600-char names, all of which end up as mail attachment filenames. | Fixed — `safeFileName()` |
| 12 | Medium | `data_b64` was decoded into memory *before* the size check, and `atob` threw on bad input. | Fixed — encoded-length check first, charset validated |
| 13 | Medium | Cron secret compared with `!==` (byte-by-byte early exit). | Fixed — constant-time compare |
| 14 | Medium | A consumed invite-code use was never refunded if signup then failed, so codes could be drained by replaying a known-registered address. | Fixed — `refund_invite_code()` |
| 15 | Medium | One operator's 20 × 10 MB payload could OOM the cron isolate and stall every other switch. | Fixed — 25 MB total attachment cap |
| 16 | Medium | `SECURITY DEFINER` functions ran with `search_path = public`. | Fixed — pinned to `''` |
| 17 | Low | `file_id` went to PostgREST unvalidated. | Fixed — UUID check |
| 18 | Low | An admin could deny or delete another admin. | Fixed — admins are mutually protected |
| 19 | Low | Minimum passphrase was 8 characters. | Raised to 12 |
| 20 | Low | Dead v1 `PasswordGate.tsx` still in the tree. | Emptied |

Checked and found **clean**: no XSS sinks (`dangerouslySetInnerHTML`, `innerHTML`,
`eval`) anywhere in `src/`; no IDOR — every file query is scoped by `user_id`;
no mass assignment — `update_config` whitelists fields, so `is_admin` / `status`
cannot be set by a user; `npm audit` reports 0 vulnerabilities; the pending /
denied account gate holds on every action; `dist/` is not committed.

## Still on you

1. **Revoke the leaked Mailgun key** in the Mailgun dashboard. Purging git
   history does not un-leak a key that sat in a public repo — assume it is
   compromised.
2. **Rotate the v1 operator password** (`main` branch):
   `select public.set_password('<new>');` as the service role.
3. **Turn on Turnstile before you market this.** Rate limiting raises the cost
   of bulk signup; a captcha is what actually stops it. Add
   `TURNSTILE_SECRET` to Supabase Vault and `VITE_TURNSTILE_SITE_KEY` to the
   Vercel environment — both the frontend widget and the server-side check are
   already wired and stay dormant until those exist.
4. **Enable leaked-password protection** in Supabase Auth (Auth → Providers →
   Email), which checks new passwords against HaveIBeenPwned.
5. Consider moving `FROM_EMAIL` to an `@operationkillswitch.com` sender once
   that domain is DKIM+SPF verified in Resend.

## Reporting

Found something? Email the address on the site rather than opening a public
issue.
