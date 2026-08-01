// MULTI-USER BRANCH. Deployed as edge function `wall` (verify_jwt: false).
// Public endpoint: landing wall feed + account signup (auto-confirmed).
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALLSIGN_RE = /^[A-Za-z0-9_-]{2,24}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === "feed") {
      // roll any expired mock timers forward so they tick forever
      const { data: mocks } = await supabase.from("mock_timers").select("*");
      for (const m of mocks ?? []) {
        if (new Date(m.next_trigger_at).getTime() <= Date.now()) {
          await supabase
            .from("mock_timers")
            .update({ next_trigger_at: new Date(Date.now() + m.interval_minutes * 60_000).toISOString() })
            .eq("id", m.id);
          m.next_trigger_at = new Date(Date.now() + m.interval_minutes * 60_000).toISOString();
        }
      }

      const { data: real } = await supabase
        .from("switches")
        .select("status, interval_minutes, next_trigger_at, user_id")
        .in("status", ["armed", "triggered"]);
      const { data: profs } = await supabase.from("profiles").select("user_id, callsign, show_on_wall");
      const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));

      const timers = [
        ...(real ?? [])
          .filter((s) => profMap.get(s.user_id)?.show_on_wall)
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

    if (action === "signup") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const callsign = String(body.callsign ?? "").trim();
      if (!EMAIL_RE.test(email)) return json({ error: "invalid email" }, 400);
      if (password.length < 8) return json({ error: "passphrase must be at least 8 characters" }, 400);
      if (!CALLSIGN_RE.test(callsign)) {
        return json({ error: "callsign: 2-24 chars, letters/numbers/dash/underscore" }, 400);
      }

      const { data: taken } = await supabase.from("profiles").select("user_id").ilike("callsign", callsign).limit(1);
      if (taken && taken.length) return json({ error: "callsign already in service" }, 409);

      const { data: created, error: cErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr || !created?.user) {
        return json({ error: cErr?.message ?? "could not create account" }, 400);
      }

      const uid = created.user.id;
      const { error: pErr } = await supabase.from("profiles").insert({ user_id: uid, callsign });
      if (pErr) {
        await supabase.auth.admin.deleteUser(uid);
        return json({ error: `profile: ${pErr.message}` }, 400);
      }
      await supabase.from("switches").insert({
        user_id: uid,
        recipient_email: email,
        operator_email: email,
      });

      return json({ ok: true });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("wall error:", e);
    return json({ error: String(e) }, 500);
  }
});
