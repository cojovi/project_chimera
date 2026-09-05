// MULTI-USER BRANCH. Deployed as edge function `check-switch-multi`
// (verify_jwt: false; auth via x-cron-secret from Vault).
// Cron job `chimera-check-multi` calls this every minute. For every armed
// switch: sends the 10%-remaining reminder once per cycle, and fires the
// payload when the deadline passes. One user's failure can't block the others.
//
// HARDENED 2026-09-05:
//   - Cron secret compared in constant time (was `!==`, byte-by-byte early exit).
//   - Total attachment bytes capped so one operator's 200 MB of payload cannot
//     OOM the isolate and stall every other switch on the same run.
//   - Internal exceptions logged, not echoed in the response body.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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

async function decrypt(cipher: ArrayBuffer, ivB64: string, keyB64: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", b64ToBytes(keyB64), "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(ivB64) }, key, cipher));
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d > 1 ? "s" : ""}`);
  if (h) parts.push(`${h} hour${h > 1 ? "s" : ""}`);
  parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(", ");
}

async function sendResend(payload: Record<string, unknown>): Promise<void> {
  const resendKey = await secret("RESEND_API_KEY");
  const from = await secret("FROM_EMAIL");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, ...payload }),
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`resend ${resp.status}: ${body}`);
}

/** Timing-safe comparison — no early exit on the first differing byte. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

// Resend caps a message around 40 MB; stay well under it and under the
// isolate's memory budget so one fat payload cannot stall the whole run.
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

Deno.serve(async (req) => {
  try {
    const cronSecret = await secret("CRON_SECRET");
    if (!timingSafeEqual(req.headers.get("x-cron-secret") ?? "", cronSecret)) {
      return new Response("unauthorized", { status: 401 });
    }

    const { data: armed } = await supabase.from("switches").select("*").eq("status", "armed");
    const now = Date.now();
    let fired = 0;
    let reminders = 0;
    const errors: string[] = [];

    for (const s of armed ?? []) {
      try {
        const deadline = new Date(s.next_trigger_at).getTime();

        if (deadline <= now) {
          // FIRE
          const keyB64 = await secret("ENCRYPTION_KEY");
          const { data: files } = await supabase
            .from("user_payload_files")
            .select("*")
            .eq("user_id", s.user_id)
            .order("created_at");
          const attachments: { filename: string; content: string }[] = [];
          let totalBytes = 0;
          const skipped: string[] = [];
          for (const f of files ?? []) {
            if (totalBytes + Number(f.size_bytes ?? 0) > MAX_TOTAL_ATTACHMENT_BYTES) {
              skipped.push(f.file_name);
              continue;
            }
            const { data: blob, error: dlErr } = await supabase.storage.from("payload").download(f.storage_path);
            if (dlErr || !blob) throw new Error(`download failed for ${f.file_name}`);
            const plain = await decrypt(await blob.arrayBuffer(), f.iv, keyB64);
            totalBytes += plain.length;
            attachments.push({ filename: f.file_name, content: bytesToB64(plain) });
          }
          await sendResend({
            to: [s.recipient_email],
            cc: s.cc_emails ?? [],
            subject: s.email_subject,
            text:
              `${s.email_message}\n\n— Released automatically by Operation Kill Switch at ${new Date().toISOString()} (${attachments.length} attachment(s)).` +
              (skipped.length
                ? `\n\nNOT ATTACHED (would have exceeded the message size limit): ${skipped.join(", ")}`
                : ""),
            attachments,
          });
          await supabase
            .from("switches")
            .update({ status: "triggered", triggered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("user_id", s.user_id);
          fired++;
          continue;
        }

        // REMINDER at 10% remaining, once per cycle
        if (!s.reminder_sent_at && s.operator_email) {
          const remainingMs = deadline - now;
          const totalMs = s.interval_minutes * 60_000;
          if (remainingMs > 0 && remainingMs <= totalMs * 0.1) {
            await sendResend({
              to: [s.operator_email],
              subject: `OPERATION KILL SWITCH :: CHECK-IN REQUIRED — T-MINUS ${formatRemaining(remainingMs)}`,
              text:
                `Operator — your dead man's switch is in its final 10% window.\n\n` +
                `Time remaining: ${formatRemaining(remainingMs)}\n` +
                `Deadline (T-zero): ${s.next_trigger_at}\n\n` +
                `If you do not check in before T-zero, the payload will be released to ${s.recipient_email}` +
                `${(s.cc_emails ?? []).length ? " (+" + s.cc_emails.length + " CC)" : ""}.\n\n` +
                `This reminder is sent once per cycle. Checking in resets it.`,
            });
            await supabase
              .from("switches")
              .update({ reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq("user_id", s.user_id);
            reminders++;
          }
        }
      } catch (e) {
        // Keep the per-switch detail in the logs only; the response body is
        // returned to whoever holds the cron secret, so keep it terse.
        errors.push(s.user_id);
        console.error(`switch ${s.user_id} error:`, e);
      }
    }

    return Response.json({ checked: armed?.length ?? 0, fired, reminders, errors });
  } catch (e) {
    const ref = crypto.randomUUID().slice(0, 8);
    console.error(`[check-switch-multi] ref=${ref}`, e);
    return Response.json({ error: "internal error", ref }, { status: 500 });
  }
});
