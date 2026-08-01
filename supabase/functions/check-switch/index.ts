// Deployed to Supabase as edge function `check-switch` (verify_jwt: false).
// Invoked every minute by pg_cron (job: chimera-check-switch) with the
// x-cron-secret header read from Supabase Vault.
// - If the switch is armed and inside the final 10% of its interval and no
//   reminder has been sent this cycle, emails the operator a check-in warning.
// - If the switch is armed and past its deadline, downloads + decrypts the
//   payload and emails it to the recipient(s) via Resend, marking `triggered`.
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

Deno.serve(async (req) => {
  try {
    const cronSecret = await secret("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret") ?? "";
    if (provided !== cronSecret) return new Response("unauthorized", { status: 401 });

    let force = false;
    try {
      const body = await req.json();
      force = !!body?.force;
    } catch { /* no body */ }

    const { data: state, error } = await supabase.from("switch_state").select("*").eq("id", 1).single();
    if (error || !state) throw new Error("switch state unreadable");

    const now = Date.now();
    const due = state.status === "armed" && new Date(state.next_trigger_at).getTime() <= now;

    // Not due yet: maybe send the 10%-remaining check-in reminder to the operator
    if (!due && !force) {
      if (state.status === "armed" && !state.reminder_sent_at && state.operator_email) {
        const remainingMs = new Date(state.next_trigger_at).getTime() - now;
        const totalMs = state.interval_minutes * 60_000;
        if (remainingMs > 0 && remainingMs <= totalMs * 0.1) {
          await sendResend({
            to: [state.operator_email],
            subject: `PROTOCOL CHIMERA :: CHECK-IN REQUIRED — T-MINUS ${formatRemaining(remainingMs)}`,
            text:
              `Operator — your dead man's switch is in its final 10% window.\n\n` +
              `Time remaining: ${formatRemaining(remainingMs)}\n` +
              `Deadline (T-zero): ${state.next_trigger_at}\n\n` +
              `If you do not check in before T-zero, the payload will be released to ${state.recipient_email}` +
              `${(state.cc_emails ?? []).length ? " (+" + state.cc_emails.length + " CC)" : ""}.\n\n` +
              `This reminder is sent once per cycle. Checking in resets it.`,
          });
          await supabase
            .from("switch_state")
            .update({ reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", 1);
          return Response.json({ fired: false, reminder_sent: true, status: state.status });
        }
      }
      return Response.json({ fired: false, status: state.status, next_trigger_at: state.next_trigger_at });
    }

    const keyB64 = await secret("ENCRYPTION_KEY");
    const { data: files } = await supabase.from("payload_files").select("*").order("created_at");

    const attachments: { filename: string; content: string }[] = [];
    for (const f of files ?? []) {
      const { data: blob, error: dlErr } = await supabase.storage.from("payload").download(f.storage_path);
      if (dlErr || !blob) throw new Error(`download failed for ${f.file_name}: ${dlErr?.message}`);
      const plain = await decrypt(await blob.arrayBuffer(), f.iv, keyB64);
      attachments.push({ filename: f.file_name, content: bytesToB64(plain) });
    }

    await sendResend({
      to: [state.recipient_email],
      cc: state.cc_emails ?? [],
      subject: state.email_subject,
      text:
        `${state.email_message}\n\n— Released automatically by Project Chimera at ${new Date().toISOString()} (${attachments.length} attachment(s)).`,
      attachments,
    });

    await supabase
      .from("switch_state")
      .update({ status: "triggered", triggered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", 1);

    return Response.json({ fired: true, attachments: attachments.length });
  } catch (e) {
    console.error("check-switch error:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
