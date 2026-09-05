#!/usr/bin/env bash
# Black-box security regression probe for Operation Kill Switch.
# Safe to run against production: it only READS, and every write it attempts
# is one that MUST be refused. Run it after any deploy.
#
#   ./scripts/security-probe.sh
#
# Exit code 0 = all checks passed.
set -uo pipefail
cd "$(dirname "$0")/.."

URL="${VITE_SUPABASE_URL:-$(grep -m1 VITE_SUPABASE_URL .env 2>/dev/null | cut -d= -f2)}"
ANON="${VITE_SUPABASE_ANON_KEY:-$(grep -m1 VITE_SUPABASE_ANON_KEY .env 2>/dev/null | cut -d= -f2)}"
[ -z "$URL" ] && { echo "no VITE_SUPABASE_URL"; exit 2; }

PASS=0; FAIL=0
ok(){ printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
no(){ printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }

hdr(){ printf '\n\033[1m%s\033[0m\n' "$1"; }

anon_get(){ curl -s --max-time 15 "$URL/rest/v1/$1?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"; }
anon_rpc(){ curl -s --max-time 15 -X POST "$URL/rest/v1/rpc/$1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d "$2"; }
fn(){ curl -s --max-time 25 -X POST "$URL/functions/v1/$1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d "$2"; }

hdr "1. Tables are unreachable with the public anon key"
for t in profiles switches user_payload_files invite_codes mock_timers switch_state payload_files rate_limits; do
  if anon_get "$t" | grep -q 'permission denied'; then ok "$t denied to anon"; else no "$t READABLE by anon"; fi
done

hdr "2. SECURITY DEFINER functions are not EXECUTE-able by anon"
for f in get_secret verify_password set_password redeem_invite_code refund_invite_code rl_hit rl_sweep; do
  r=$(anon_rpc "$f" '{}')
  if echo "$r" | grep -qE 'permission denied|Could not find the function'; then ok "$f denied to anon"; else no "$f CALLABLE by anon -> $r"; fi
done

hdr "3. Invite codes cannot be probed or drained without auth"
r=$(anon_rpc redeem_invite_code '{"p_code":"FIRSTLIGHT"}')
if echo "$r" | grep -q 'permission denied'; then ok "redeem_invite_code is not an anon oracle"; else no "INVITE CODE ORACLE OPEN -> $r"; fi

hdr "4. Edge function auth boundaries"
r=$(fn user-api '{"action":"config"}');        echo "$r" | grep -q 'SESSION INVALID' && ok "user-api rejects the anon key" || no "user-api accepted anon -> $r"
r=$(fn user-api '{"action":"admin_overview"}'); echo "$r" | grep -q 'SESSION INVALID' && ok "admin actions need a real session" || no "admin reachable -> $r"
r=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$URL/functions/v1/check-switch-multi" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{}')
[ "$r" = "401" ] && ok "cron endpoint requires the cron secret" || no "cron endpoint returned $r"

hdr "5. CORS is origin-locked (not '*')"
h=$(curl -s -D- -o /dev/null --max-time 15 -X OPTIONS "$URL/functions/v1/wall" -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST')
if echo "$h" | grep -qi 'access-control-allow-origin: \*'; then no "wall still allows any origin"; else ok "wall refuses an untrusted origin"; fi
h=$(curl -s -D- -o /dev/null --max-time 15 -X OPTIONS "$URL/functions/v1/user-api" -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST')
if echo "$h" | grep -qi 'access-control-allow-origin: \*'; then no "user-api still allows any origin"; else ok "user-api refuses an untrusted origin"; fi

hdr "6. Signup does not leak whether an address is registered"
r=$(fn wall '{"action":"signup","email":"cojovi@icloud.com","password":"aaaaaaaaaaaaaaaa","callsign":"PROBE'"$RANDOM"'"}')
if echo "$r" | grep -qi 'already been registered'; then no "account-existence oracle -> $r"; else ok "duplicate-email response is generic"; fi

hdr "7. Signup is rate limited"
# Deliberately short password: the rate limiter runs before field validation,
# so each call still consumes budget but can never create an account.
allowed=0; throttled=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  r=$(fn wall "{\"action\":\"signup\",\"email\":\"probe-$RANDOM-$i@example.invalid\",\"password\":\"x\",\"callsign\":\"PRB$RANDOM$i\"}")
  echo "$r" | grep -q 'too many sign-up' && throttled=$((throttled+1)) || allowed=$((allowed+1))
done
[ "$throttled" -ge 1 ] && ok "signup throttled ($allowed allowed, $throttled blocked; no accounts created)" \
                        || no "NO SIGNUP THROTTLE (10/10 got through)"

hdr "8. Internal errors are not echoed to clients"
r=$(fn wall '{"action":"signup","email":"x","password":"y"}')
if echo "$r" | grep -qE 'TypeError|at Deno|pg_|relation "'; then no "stack/internals leaked -> $r"; else ok "errors are generic"; fi

hdr "9. Production security headers"
H=$(curl -sI --max-time 20 https://www.operationkillswitch.com/)
for want in 'content-security-policy' 'x-frame-options' 'x-content-type-options' 'referrer-policy' 'permissions-policy' 'strict-transport-security'; do
  echo "$H" | grep -qi "^$want" && ok "$want present" || no "$want MISSING"
done

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
