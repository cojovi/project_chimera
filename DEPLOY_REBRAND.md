# Operation Kill Switch — rebrand + signup gate rollout

> **STATUS: steps 1 and 2 are DONE.** The migration was applied and both edge
> functions were redeployed (`wall` v2, `user-api` v2) on 2026-09-01, and the
> end-to-end signup gate was smoke-tested against the live endpoints. Only the
> frontend build (step 3) and the email sender swap (step 4) are outstanding.
> Steps 1 and 2 are kept below as a record of what ran.

Branch: `killswitch`. Supabase project: `znnpklgdfgnnwrnvufgr`.
Nothing here touches the v1 tables, so `main` keeps running throughout.

## 1. Apply the migration — ✅ DONE

Supabase dashboard → **SQL Editor** → paste the whole of
`supabase/migrations/20260901_okswitch_signup_gate.sql` → Run.

It is idempotent (`if not exists` / `on conflict do nothing`), so a second run
is harmless.

What it does:

- adds `status`, `is_admin`, `signup_email`, `signup_note`, `invite_code`,
  `reviewed_at`, `reviewed_by`, `denial_reason` to `profiles`
- **grandfathers every existing account to `approved`**
- creates `invite_codes` + the atomic `redeem_invite_code()` function
- rebrands the default `switches.email_subject`
- flags `cojovi.mma@gmail.com` as admin
- seeds one starter code: **`FIRSTLIGHT`** (25 uses)

> The live operator account turned out to be **cojovi@icloud.com** (callsign
> CHEEKSPREADER), not the gmail address — it has been set to `is_admin = true`.
> To promote any other account later:
> ```sql
> update public.profiles p set is_admin = true, status = 'approved'
>   from auth.users u
>  where u.id = p.user_id and lower(u.email) = 'YOUR@EMAIL.COM';
> ```

## 2. Redeploy the two edge functions — ✅ DONE

```bash
supabase functions deploy wall      --project-ref znnpklgdfgnnwrnvufgr --no-verify-jwt
supabase functions deploy user-api  --project-ref znnpklgdfgnnwrnvufgr --no-verify-jwt
```

`--no-verify-jwt` is required. `user-api` authenticates itself by calling
`supabase.auth.getUser(token)`; flipping JWT verification on breaks it.

`check-switch-multi` only changed in a comment and an email string — redeploy
it too if you want the rebranded copy in the reminder emails:

```bash
supabase functions deploy check-switch-multi --project-ref znnpklgdfgnnwrnvufgr --no-verify-jwt
```

## 3. Build and ship the frontend — ⬜ YOUR TURN

```bash
npm run build      # tsc && vite build
```

Point `www.operationkillswitch.com` at `dist/`. No new env vars — the frontend
still needs only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 4. Email sender — ⬜ WHEN READY, NOT BEFORE

Emails still send from `chimera@cojovi.com`. That works today; it just looks
off next to the new domain.

1. Resend → add `operationkillswitch.com`, set the DKIM + SPF records, wait
   for green.
2. Supabase → Vault → change the `FROM_EMAIL` secret to
   `switch@operationkillswitch.com`.

No code change. Do **not** change it before the domain verifies or every
failsafe email starts bouncing.

## 5. Smoke test — server side ✅, UI ⬜

Already verified against the live endpoints and then cleaned up (both test
accounts deleted, FIRSTLIGHT's use count reset to 0):

- [x] Wall feed returns real + mock timers.
- [x] Signup with `firstlight` (lowercase) → `status: approved`, code consumed,
      `invite_code` recorded as FIRSTLIGHT. Matching is case-insensitive.
- [x] Signup with a garbage code → 403, account NOT created.
- [x] Signup with no code → `status: pending`, `show_on_wall` false.
- [x] Pending account: `arm` and `upload` both 403; `config` still 200.
- [x] Non-admin calling `admin_overview` → 403 NOT AUTHORIZED.
- [x] Approved account can arm normally.

Still to check once the frontend is deployed:

- [ ] "REQUEST LOGGED" screen renders after a no-code signup.
- [ ] AWAITING CLEARANCE screen renders on login as a pending operator.
- [ ] Log in as admin → `COMMAND` link in the header with a pending count.
- [ ] Clear a pending account from `#/command` → it can arm and hits the wall.
- [ ] `main` branch app still loads and accepts its password.

## Known gap

There is **no bot protection** on the signup endpoint beyond a 250-pending
ceiling. Before you push real marketing traffic at this, put Cloudflare
Turnstile in front of the signup form. A public URL that calls
`auth.admin.createUser` will get found.
