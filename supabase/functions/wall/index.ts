// MULTI-USER BRANCH. Deployed as edge function `wall` (verify_jwt: false).
// Public endpoint: landing wall feed + account signup.
// Signup with a valid invite code is auto-approved; without one the account
// is created in `pending` and cannot arm until an admin clears it.
//
// HARDENED 2026-09-05:
//   - CORS restricted to an origin allowlist (was `*`).
//   - Per-IP + global rate limits on signup and on the feed.
//   - Optional Cloudflare Turnstile verification (enforced once the
//     TURNSTILE_SECRET vault entry exists; ignored until then).
//   - Duplicate-email signups no longer confirm that an address is registered.
//   - Invite-code uses are refunded when the signup that consumed one fails,
//     so a code cannot be drained by replaying signups with a known address.
//   - Internal exceptions are logged, not returned.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_ORIGINS = new Set([
  "https://www.operationkillswitch.com",
  "https://operationkillswitch.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Credentials"] = "true";
  }
  return h;
}

function clientIp(req: Request): string {
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

/** Fixed-window token bucket in Postgres. Fails CLOSED on error. */
async function rateLimit(bucket: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("rl_hit", {
    p_bucket: bucket,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    console.error("rl_hit failed:", error.message);
    return false;
  }
  return data === true;
}

async function secretOrNull(name: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_secret", { secret_name: name });
  if (error || !data) return null;
  return data as string;
}

/** Cloudflare Turnstile. No secret configured => not enforced yet. */
async function turnstileOk(token: string, ip: string): Promise<boolean> {
  const secret = await secretOrNull("TURNSTILE_SECRET");
  if (!secret) return true;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip !== "unknown") form.append("remoteip", ip);
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const out = await resp.json();
    return out?.success === true;
  } catch (e) {
    console.error("turnstile verify failed:", e);
    return false;
  }
}

function internalError(where: string, e: unknown) {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${where}] ref=${ref}`, e);
  return { error: "internal error — the incident was logged", ref };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALLSIGN_RE = /^[A-Za-z0-9_-]{2,24}$/;
const INVITE_RE = /^[A-Za-z0-9_-]{4,64}$/;
const MAX_BODY_BYTES = 16 * 1024;

Deno.serve(async (req) => {
  const CORS = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const ip = clientIp(req);

  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "request too large" }, 413);
    let body: Record<string, unknown> = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ error: "malformed request" }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json({ error: "malformed request" }, 400);
    }
    const action = typeof body.action === "string" ? body.action : "";

    // ─────────────────────────────────────────────────────────────── feed
    if (action === "feed") {
      // Generous, but stops a single host from hammering the public feed.
      if (!(await rateLimit(`feed:${ip}`, 60, 120))) {
        return json({ error: "slow down" }, 429);
      }

      // roll any expired mock timers forward so they tick forever
      const { data: mocks } = await supabase.from("mock_timers").select("*");
      for (const m of mocks ?? []) {
        if (new Date(m.next_trigger_at).getTime() <= Date.now()) {
          const next = new Date(Date.now() + m.interval_minutes * 60_000).toISOString();
          await supabase.from("mock_timers").update({ next_trigger_at: next }).eq("id", m.id);
          m.next_trigger_at = next;
        }
      }

      const { data: real } = await supabase
        .from("switches")
        .select("status, interval_minutes, next_trigger_at, user_id")
        .in("status", ["armed", "triggered"]);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, callsign, show_on_wall, status");
      const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));

      const timers = [
        ...(real ?? [])
          .filter((s) => {
            const p = profMap.get(s.user_id);
            return !!p && p.status === "approved" && p.show_on_wall;
          })
          .map((s) => ({
            callsign: profMap.get(s.user_id)!.callsign.toUpperCase(),
            status: s.status,
            interval_minutes: s.interval_minutes,
            next_trigger_at: s.next_trigger_at,
            mock: false,
          })),
        ...(mocks ?? []).map((m) => ({
          callsign: m.callsign,
          status: "armed",
          interval_minutes: m.interval_minutes,
          next_trigger_at: m.next_trigger_at,
          mock: true,
        })),
      ];

      return json({ timers, server_time: new Date().toISOString() });
    }

    // ───────────────────────────────────────────────────────────── signup
    if (action === "signup") {
      // Layered limits: one host, then the endpoint as a whole. Both must pass
      // before any account is created or any invite code is touched.
      if (!(await rateLimit(`signup:ip:${ip}:h`, 3600, 5))) {
        return json({ error: "too many sign-up attempts — try again later" }, 429);
      }
      if (!(await rateLimit(`signup:ip:${ip}:d`, 86400, 15))) {
        return json({ error: "too many sign-up attempts — try again later" }, 429);
      }
      if (!(await rateLimit("signup:global:h", 3600, 120))) {
        return json({ error: "sign-ups are temporarily throttled — try again later" }, 429);
      }

      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const callsign = String(body.callsign ?? "").trim();
      const inviteCode = String(body.invite_code ?? "").trim();
      const note = String(body.note ?? "").trim().slice(0, 500);
      const captcha = String(body.turnstile_token ?? "");

      if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: "invalid email" }, 400);
      if (password.length < 12 || password.length > 512) {
        return json({ error: "passphrase must be 12–512 characters" }, 400);
      }
      if (!CALLSIGN_RE.test(callsign)) {
        return json({ error: "callsign: 2-24 chars, letters/numbers/dash/underscore" }, 400);
      }
      if (inviteCode && !INVITE_RE.test(inviteCode)) {
        return json({ error: "sign-up code not recognized, expired, or fully used" }, 403);
      }

      if (!(await turnstileOk(captcha, ip))) {
        return json({ error: "human verification failed — reload and try again" }, 403);
      }

      // Callsigns are published on the public wall, so reporting a collision
      // discloses nothing an attacker cannot already read off the landing page.
      const { data: taken } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("callsign", callsign)
        .limit(1);
      if (taken && taken.length) return json({ error: "callsign already in service" }, 409);

      // A valid invite code redeems atomically and grants immediate clearance.
      // An invalid/expired/exhausted code is rejected outright rather than
      // silently downgrading to pending — otherwise a typo looks like a bug.
      let status: "approved" | "pending" = "pending";
      let redeemedCode: string | null = null;
      if (inviteCode) {
        // Separate, tighter budget: guessing codes must be expensive.
        if (!(await rateLimit(`invite:ip:${ip}`, 3600, 10))) {
          return json({ error: "too many sign-up code attempts — try again later" }, 429);
        }
        const { data: ok, error: rErr } = await supabase.rpc("redeem_invite_code", {
          p_code: inviteCode,
        });
        if (rErr) return json(internalError("wall.redeem", rErr), 500);
        if (!ok) return json({ error: "sign-up code not recognized, expired, or fully used" }, 403);
        status = "approved";
        redeemedCode = inviteCode.toUpperCase();
      }

      // Hand a consumed invite use back whenever the rest of signup fails.
      const refund = async () => {
        if (!redeemedCode) return;
        await supabase.rpc("refund_invite_code", { p_code: inviteCode }).catch(() => {});
      };

      // Crude flood ceiling on top of the rate limits: a bot can't fill
      // auth.users with pending accounts faster than the operator clears them.
      if (status === "pending") {
        const { count } = await supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("status", "pending");
        if ((count ?? 0) >= 250) {
          return json(
            { error: "the review queue is full — try again later or use a sign-up code" },
            429,
          );
        }
      }

      const { data: created, error: cErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr || !created?.user) {
        await refund();
        // Do NOT echo the auth error: "already registered" turns this endpoint
        // into an account-existence oracle.
        console.warn("signup createUser rejected:", cErr?.message);
        return json({ error: "could not create an account with those details" }, 400);
      }

      const uid = created.user.id;
      const { error: pErr } = await supabase.from("profiles").insert({
        user_id: uid,
        callsign,
        status,
        signup_email: email,
        signup_note: note || null,
        invite_code: redeemedCode,
        reviewed_at: status === "approved" ? new Date().toISOString() : null,
        // pending accounts stay off the public wall until cleared
        show_on_wall: status === "approved",
      });
      if (pErr) {
        await supabase.auth.admin.deleteUser(uid);
        await refund();
        console.warn("signup profile insert failed:", pErr.message);
        return json({ error: "could not create an account with those details" }, 400);
      }
      await supabase.from("switches").insert({
        user_id: uid,
        recipient_email: email,
        operator_email: email,
      });

      return json({ ok: true, status });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json(internalError("wall", e), 500);
  }
});
