// MULTI-USER BRANCH. Deployed as edge function `user-api` (verify_jwt: false;
// auth is enforced in-function by validating the Supabase Auth JWT).
// Per-user switch API — every action scopes to the caller's user_id.
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

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALLSIGN_RE = /^[A-Za-z0-9_-]{2,24}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function secret(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_secret", { secret_name: name });
  if (error || !data) throw new Error(`missing secret ${name}`);
  return data as string;
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function importKey(usages: KeyUsage[]): Promise<CryptoKey> {
  const keyB64 = await secret("ENCRYPTION_KEY");
  return crypto.subtle.importKey("raw", b64ToBytes(keyB64), "AES-GCM", false, usages);
}

function nextTrigger(intervalMinutes: number): string {
  return new Date(Date.now() + intervalMinutes * 60_000).toISOString();
}

async function getSwitch(userId: string) {
  const { data } = await supabase.from("switches").select("*").eq("user_id", userId).single();
  if (data) return data;
  const { data: created, error } = await supabase
    .from("switches")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error || !created) throw new Error("switch unreadable");
  return created;
}

async function listFiles(userId: string) {
  const { data, error } = await supabase
    .from("user_payload_files")
    .select("id, file_name, mime_type, size_bytes, created_at")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fullConfig(userId: string) {
  const s = await getSwitch(userId);
  const { data: prof } = await supabase.from("profiles").select("callsign, show_on_wall").eq("user_id", userId).single();
  return {
    status: s.status,
    interval_minutes: s.interval_minutes,
    next_trigger_at: s.next_trigger_at,
    last_checkin_at: s.last_checkin_at,
    recipient_email: s.recipient_email,
    cc_emails: s.cc_emails,
    operator_email: s.operator_email,
    email_subject: s.email_subject,
    email_message: s.email_message,
    triggered_at: s.triggered_at,
    callsign: prof?.callsign ?? "",
    show_on_wall: prof?.show_on_wall ?? true,
    files: await listFiles(userId),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "NOT AUTHENTICATED" }, 401);
    const { data: userData, error: uErr } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (uErr || !user) return json({ error: "SESSION INVALID — LOG IN AGAIN" }, 401);
    const uid = user.id;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    switch (action) {
      case "config":
        return json(await fullConfig(uid));

      case "checkin": {
        const s = await getSwitch(uid);
        await supabase
          .from("switches")
          .update({
            next_trigger_at: nextTrigger(s.interval_minutes),
            last_checkin_at: new Date().toISOString(),
            reminder_sent_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", uid);
        return json(await fullConfig(uid));
      }

      case "arm": {
        const s = await getSwitch(uid);
        if (!s.recipient_email) return json({ error: "set a recipient before arming" }, 400);
        await supabase
          .from("switches")
          .update({
            status: "armed",
            next_trigger_at: nextTrigger(s.interval_minutes),
            last_checkin_at: new Date().toISOString(),
            triggered_at: null,
            reminder_sent_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", uid);
        return json(await fullConfig(uid));
      }

      case "disarm":
        await supabase
          .from("switches")
          .update({ status: "disarmed", reminder_sent_at: null, updated_at: new Date().toISOString() })
          .eq("user_id", uid);
        return json(await fullConfig(uid));

      case "update_config": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.interval_minutes !== undefined) {
          const m = Number(body.interval_minutes);
          if (!Number.isFinite(m) || m < 5 || m > 527040) return json({ error: "interval must be 5 min – 1 year" }, 400);
          patch.interval_minutes = Math.round(m);
        }
        if (body.recipient_email !== undefined) {
          if (!EMAIL_RE.test(String(body.recipient_email))) return json({ error: "invalid recipient email" }, 400);
          patch.recipient_email = String(body.recipient_email).trim();
        }
        if (body.operator_email !== undefined) {
          if (!EMAIL_RE.test(String(body.operator_email))) return json({ error: "invalid operator email" }, 400);
          patch.operator_email = String(body.operator_email).trim();
        }
        if (body.cc_emails !== undefined) {
          const ccs = (body.cc_emails as unknown[]).map((e) => String(e).trim()).filter((e) => e.length > 0);
          if (ccs.length > 10) return json({ error: "max 10 CC addresses" }, 400);
          for (const e of ccs) if (!EMAIL_RE.test(e)) return json({ error: `invalid CC email: ${e}` }, 400);
          patch.cc_emails = ccs;
        }
        if (body.email_subject !== undefined) patch.email_subject = String(body.email_subject).slice(0, 200);
        if (body.email_message !== undefined) patch.email_message = String(body.email_message).slice(0, 5000);
        if (patch.interval_minutes !== undefined) {
          const s = await getSwitch(uid);
          if (s.status === "armed") {
            patch.next_trigger_at = nextTrigger(patch.interval_minutes as number);
            patch.reminder_sent_at = null;
          }
        }
        const { error } = await supabase.from("switches").update(patch).eq("user_id", uid);
        if (error) throw new Error(error.message);

        // profile updates
        if (body.callsign !== undefined || body.show_on_wall !== undefined) {
          const pPatch: Record<string, unknown> = {};
          if (body.callsign !== undefined) {
            const cs = String(body.callsign).trim();
            if (!CALLSIGN_RE.test(cs)) return json({ error: "callsign: 2-24 chars, letters/numbers/dash/underscore" }, 400);
            const { data: taken } = await supabase
              .from("profiles")
              .select("user_id")
              .ilike("callsign", cs)
              .neq("user_id", uid)
              .limit(1);
            if (taken && taken.length) return json({ error: "callsign already in service" }, 409);
            pPatch.callsign = cs;
          }
          if (body.show_on_wall !== undefined) pPatch.show_on_wall = !!body.show_on_wall;
          const { error: pErr } = await supabase.from("profiles").update(pPatch).eq("user_id", uid);
          if (pErr) throw new Error(pErr.message);
        }
        return json(await fullConfig(uid));
      }

      case "upload": {
        const name = String(body.file_name ?? "").trim();
        const mime = String(body.mime_type ?? "application/octet-stream");
        const dataB64 = String(body.data_b64 ?? "");
        if (!name || !dataB64) return json({ error: "file_name and data_b64 required" }, 400);
        const bytes = b64ToBytes(dataB64);
        if (bytes.length > MAX_UPLOAD_BYTES) return json({ error: "file exceeds 10 MB limit" }, 400);
        const existing = await listFiles(uid);
        if (existing.length >= 20) return json({ error: "max 20 files" }, 400);

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await importKey(["encrypt"]);
        const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes.slice().buffer));
        const path = `multi/${uid}/${crypto.randomUUID()}.bin`;
        const { error: upErr } = await supabase.storage
          .from("payload")
          .upload(path, cipher.slice().buffer, { contentType: "application/octet-stream" });
        if (upErr) throw new Error(`storage upload: ${upErr.message}`);
        const { error: insErr } = await supabase.from("user_payload_files").insert({
          user_id: uid,
          file_name: name,
          mime_type: mime,
          size_bytes: bytes.length,
          storage_path: path,
          iv: bytesToB64(iv),
        });
        if (insErr) {
          await supabase.storage.from("payload").remove([path]);
          throw new Error(`registry insert: ${insErr.message}`);
        }
        return json(await fullConfig(uid));
      }

      case "delete_file": {
        const id = String(body.file_id ?? "");
        const { data: f } = await supabase
          .from("user_payload_files")
          .select("*")
          .eq("id", id)
          .eq("user_id", uid)
          .single();
        if (!f) return json({ error: "file not found" }, 404);
        await supabase.storage.from("payload").remove([f.storage_path]);
        await supabase.from("user_payload_files").delete().eq("id", id);
        return json(await fullConfig(uid));
      }

      case "download_file": {
        const id = String(body.file_id ?? "");
        const { data: f } = await supabase
          .from("user_payload_files")
          .select("*")
          .eq("id", id)
          .eq("user_id", uid)
          .single();
        if (!f) return json({ error: "file not found" }, 404);
        const { data: blob, error: dlErr } = await supabase.storage.from("payload").download(f.storage_path);
        if (dlErr || !blob) throw new Error(`download: ${dlErr?.message}`);
        const key = await importKey(["decrypt"]);
        const plain = new Uint8Array(
          await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(f.iv) }, key, await blob.arrayBuffer()),
        );
        return json({ file_name: f.file_name, mime_type: f.mime_type, data_b64: bytesToB64(plain) });
      }

      case "test_email": {
        const s = await getSwitch(uid);
        if (!s.recipient_email) return json({ error: "set a recipient first" }, 400);
        const resendKey = await secret("RESEND_API_KEY");
        const from = await secret("FROM_EMAIL");
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [s.recipient_email],
            cc: s.cc_emails ?? [],
            subject: "PROTOCOL CHIMERA :: DELIVERY TEST",
            text:
              "This is a delivery test from Project Chimera. The switch has NOT fired. If you can read this, the release channel is working.",
          }),
        });
        const text = await resp.text();
        if (!resp.ok) return json({ error: `resend ${resp.status}: ${text}` }, 502);
        return json({ ok: true });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("user-api error:", e);
    return json({ error: String(e) }, 500);
  }
});
