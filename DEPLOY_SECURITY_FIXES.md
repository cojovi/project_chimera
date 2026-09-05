# Security fixes - status

Updated 2026-09-05. **Everything I can reach is done and verified in production.**
Two items are left, both requiring credentials I don't have.

Regression suite: `./scripts/security-probe.sh` - currently **25/30 passing**.
The 5 failures are all frontend security headers, which go live the moment you
push (step 1 below).

---

## Done

### DB migration - applied and verified
`20260905_security_hardening.sql` ran against production. Replayed the critical
exploit from outside with nothing but the public anon key:

```
redeem_invite_code  -> permission denied    (before: returned `true` to anyone)
refund_invite_code  -> permission denied
rl_hit / rl_sweep   -> permission denied
get_secret          -> permission denied
all 8 tables        -> permission denied
```

`redeem_acl` went from `NULL` (silently inheriting the PUBLIC grant - the bug)
to `{postgres=X/postgres,service_role=X/postgres}`.

### All three edge functions - deployed and verified

| Function | Verified live |
|---|---|
| `wall` | untrusted origin gets no CORS header; real origin echoed exactly; duplicate-email signup now returns a generic error instead of confirming the address exists; signup throttled |
| `user-api` | origin-locked; auth boundary holds; **`test_email` mail relay closed** (3/hour, 10/day per operator) |
| `check-switch-multi` | constant-time cron secret, attachment cap, no internal detail in responses |

All three kept `verify_jwt: false` - each does its own auth, and turning it on
would break the public wall feed and the cron job. `switch-api` and
`check-switch` (v1, serving `main`) were not touched.

### Cleanup
Every throwaway account the pen-test created is gone (`auth_users=1`, only
`CHEEKSPREADER` remains) and the 5 `FIRSTLIGHT` uses burned proving the exploit
were restored (`used_count=0`). The rate limiter is live with active buckets.

### Code committed
`76b13c1` + follow-ups. 16 files, +1171/-178.

---

## Left for you - two commands

### 1. Push (turns on the CSP and security headers)

```bash
git push origin killswitch
```

I can't do this one: the sandboxed VM that mounts your folder has no access to
your macOS keychain, SSH keys, or `gh` credentials. Safe to push now - the
vulnerabilities `SECURITY.md` describes are all closed in production, so
publishing the writeup no longer hands anyone a live recipe.

After it deploys, re-run `./scripts/security-probe.sh` - it should go 30/30.

### 2. Purge the leaked `.env` from git history

```bash
./purge-env-from-history.sh
git remote add origin https://github.com/cojovi/project_chimera.git
git push --force --all origin
```

`git filter-repo` has to delete refs, and this session can't delete files in
that folder - the permission prompt never came through. Full backup already at
`BACKUP-before-history-rewrite.bundle`
(`git clone BACKUP-before-history-rewrite.bundle restored/`).

---

## 🔴 And one thing only you should do

**Revoke the Mailgun API key.** Mailgun dashboard -> API Keys -> delete.

I don't touch credential or security settings inside your accounts. It's in
commit `9ae26db`'s `.env` on a repo that has been public, and it still
authenticates - I tested it. Purging history does **not** un-leak it; assume
anyone who cloned already has it. You said you never used Mailgun here, so
deleting it breaks nothing.

The `service_role` key next to it belongs to Supabase project
`suxdvdtswejtyciwnkdt`, which is deleted - already inert.

While you're at it: rotate the v1 `main`-branch password. It sat in plaintext
in `CLAUDE.md` on the public repo.

```sql
select public.set_password('<new passphrase>');
```

---

## Before you market it

**Turn on Turnstile.** Rate limiting makes bulk signup expensive; a captcha is
what actually stops it. Both sides are wired and dormant until these exist:

- `TURNSTILE_SECRET` -> Supabase Vault
- `VITE_TURNSTILE_SITE_KEY` -> Vercel environment

Two more clicks worth having: Supabase -> Auth -> Providers -> Email -> enable
leaked password protection (checks new passwords against HaveIBeenPwned).
