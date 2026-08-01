// Deployed to Supabase as edge function `switch-api` (verify_jwt: false —
// custom auth: every mutating action requires the operator password, verified
// against the bcrypt hash in switch_state via the verify_password RPC).
// The frontend talks exclusively to this function.
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

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file

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

async function verifyPassword(pw: unknown): Promise<boolean> {
  if (typeof pw !== "string" || pw.length === 0 || pw.length > 256) return false;
  const { data, error } = await supabase.rpc("verify_password", { pw });
  if (error) throw new Error(`verify failed: ${error.message}`);
  return data === true;
}

async function getState() {
  const { data, error } = await supabase.from("switch_state").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("switch state unreadable");
  return data;
}

async function listFiles() {
  const { data, error } = await supabase
    .from("payload_files")
    .select("id, file_name, mime_type, size_bytes, created_at")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fullConfig() {
  const s = await getState();
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
    reminder_sent_at: s.reminder_sent_at,
    files: await listFiles(),
  };
}

function nextTrigger(intervalMinutes: number): string {
  return new Date(Date.now() + intervalMinutes * 60_000).toISOString();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // Public: countdown state only
    if (action === "status") {
      const s = await getState();
      return json({
        status: s.status,
        next_trigger_at: s.next_trigger_at,
        interval_minutes: s.interval_minutes,
        server_time: new Date().toISOString(),
      });
    }

    // Everything else requires the password
    const ok = await verifyPassword(body?.password);
    if (!ok) {
      // small delay to blunt brute force
      await new Promise((r) => setTimeout(r, 750));
      return json({ error: "ACCESS DENIED" }, 401);
    }

    switch (action) {
      case "unlock":
        return json(await fullConfig());

      case "checkin": {
        const s = await getState();
        await supabase
          .from("switch_state")
          .update({
            next_trigger_at: nextTrigger(s.interval_minutes),
            last_checkin_at: new Date().toISOString(),
            reminder_sent_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1);
        return json(await fullConfig());
      }

      case "arm": {
        const s = await getState();
        await supabase
          .from("switch_state")
          .update({
            status: "armed",
            next_trigger_at: nextTrigger(s.interval_minutes),
            last_checkin_at: new Date().toISOString(),
            triggered_at: null,
            reminder_sent_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1);
        return json(await fullConfig());
      }

      case "disarm":
        await supabase
          .from("switch_state")
          .update({ status: "disarmed", reminder_sent_at: null, updated_at: new Date().toISOString() })
          .eq("id", 1);
        return json(await fullConfig());

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
        // interval change while armed reschedules from now and resets the reminder
        if (patch.interval_minutes !== undefined) {
          const s = await getState();
          if (s.status === "armed") {
            patch.next_trigger_at = nextTrigger(patch.interval_minutes as number);
            patch.reminder_sent_at = null;
          }
        }
        const { error } = await supabase.from("switch_state").update(patch).eq("id", 1);
        if (error) throw new Error(error.message);
        return json(await fullConfig());
      }

      case "upload": {
        const name = String(body.file_name ?? "").trim();
        const mime = String(body.mime_type ?? "application/octet-stream");
        const dataB64 = String(body.data_b64 ?? "");
        if (!name || !dataB64) return json({ error: "file_name and data_b64 required" }, 400);
        const bytes = b64ToBytes(dataB64);
        if (bytes.length > MAX_UPLOAD_BYTES) return json({ error: "file exceeds 10 MB limit" }, 400);
        const existing = await listFiles();
        if (existing.length >= 20) return json({ error: "max 20 files" }, 400);

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await importKey(["encrypt"]);
        const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes.slice().buffer));
        const path = `${crypto.randomUUID()}.bin`;
        const { error: upErr } = await supabase.storage
          .from("payload")
          .upload(path, cipher.slice().buffer, { contentType: "application/octet-stream" });
        if (upErr) throw new Error(`storage upload: ${upErr.message}`);
        const { error: insErr } = await supabase.from("payload_files").insert({
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
        return json(await fullConfig());
      }

      case "delete_file": {
        const id = String(body.file_id ?? "");
        const { data: f } = await supabase.from("payload_files").select("*").eq("id", id).single();
        if (!f) return json({ error: "file not found" }, 404);
        await supabase.storage.from("payload").remove([f.storage_path]);
        await supabase.from("payload_files").delete().eq("id", id);
        return json(await fullConfig());
      }

      case "download_file": {
        const id = String(body.file_id ?? "");
        const { data: f } = await supabase.from("payload_files").select("*").eq("id", id).single();
        if (!f) return json({ error: "file not found" }, 404);
        const { data: blob, error: dlErr } = await supabase.storage.from("payload").download(f.storage_path);
        if (dlErr || !blob) throw new Error(`download: ${dlErr?.message}`);
        const key = await importKey(["decrypt"]);
        const plain = new Uint8Array(
          await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(f.iv) }, key, await blob.arrayBuffer()),
        );
        return json({ file_name: f.file_name, mime_type: f.mime_type, data_b64: bytesToB64(plain) });
      }

      case "change_password": {
        const np = String(body.new_password ?? "");
        if (np.length < 8) return json({ error: "new password must be at least 8 characters" }, 400);
        const { error } = await supabase.rpc("set_password", { new_pw: np });
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }

      case "test_email": {
        const s = await getState();
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
    console.error("switch-api error:", e);
    return json({ error: String(e) }, 500);
  }
});
