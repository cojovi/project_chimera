// MULTI-USER BRANCH. Deployed as edge function `user-api` (verify_jwt: false;
// auth is enforced in-function by validating the Supabase Auth JWT).
// Per-user switch API — every action scopes to the caller's user_id.
//
// HARDENED 2026-09-05:
//   - CORS restricted to an origin allowlist (was `*`).
//   - Per-user and per-action rate limits; `test_email` was an unauthenticated-
//     adjacent open mail relay (any approved account could blast 11 recipients
//     per call, unthrottled, from the DKIM-signed domain).
//   - Upload input validated: base64 size checked BEFORE decode, filenames
//     stripped of traversal/control characters, MIME types allowlisted.
//   - Array-typed inputs type-checked (cc_emails used to 500 on a string).
//   - File ids validated as UUIDs before they reach PostgREST.
//   - Admin actions cannot strip the last admin or act on another admin.
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

function internalError(where: string, e: unknown) {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${where}] ref=${ref}`, e);
  return { error: "internal error — the incident was logged", ref };
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// base64 inflates by 4/3; allow a little slack for padding and whitespace.
const MAX_B64_CHARS = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 1024;
const MAX_BODY_BYTES = 15 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALLSIGN_RE = /^[A-Za-z0-9_-]{2,24}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,62}$/i;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const isUuid = (s: string) => UUID_RE.test(s);

function safeFileName(raw: string): string {
  let name = String(raw ?? "")
    // deno-lint-ignore no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\\/]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\s]+/, "")
    .replace(/[\s.]+$/, "")
    .trim();
  if (name.length > 120) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 && name.length - dot <= 12 ? name.slice(dot) : "";
    name = name.slice(0, 120 - ext.length) + ext;
  }
  return name || "payload.bin";
}

function safeMime(raw: string): string {
  const m = String(raw ?? "").trim().split(";")[0].trim();
  return MIME_RE.test(m) ? m.toLowerCase() : "application/octet-stream";
}

function isEmail(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return s.length <= 254 && EMAIL_RE.test(s);
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

async function getProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("callsign, show_on_wall, status, is_admin, signup_email, denial_reason")
    .eq("user_id", userId)
    .single();
  return data;
}

// Actions a pending / denied operator may still call. Everything else is
// refused until an admin clears the account.
const UNGATED_ACTIONS = new Set(["config", "update_config", "logout"]);

// Per-action budgets: [bucket suffix, window seconds, max hits].
// `test_email` and `upload` are the expensive/abusable ones.
const ACTION_LIMITS: Record<string, [number, number][]> = {
  test_email: [[3600, 3], [86400, 10]],
  upload: [[3600, 40], [86400, 150]],
  download_file: [[3600, 60], [86400, 300]],
  update_config: [[3600, 120], [86400, 600]],
  checkin: [[3600, 120], [86400, 600]],
  arm: [[3600, 60], [86400, 200]],
  disarm: [[3600, 60], [86400, 200]],
  delete_file: [[3600, 60], [86400, 200]],
};
// Everything else, including admin actions, shares one generous ceiling.
const DEFAULT_LIMIT: [number, number][] = [[60, 90], [3600, 1200]];

async function fullConfig(userId: string) {
  const s = await getSwitch(userId);
  const prof = await getProfile(userId);
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
    account_status: prof?.status ?? "pending",
    is_admin: prof?.is_admin ?? false,
    denial_reason: prof?.denial_reason ?? null,
    files: await listFiles(userId),
  };
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  const adminJson = json;

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const ip = clientIp(req);

  try {
    // Throttle unauthenticated hammering before doing any JWT work.
    if (!(await rateLimit(`api:ip:${ip}`, 60, 200))) {
      return json({ error: "slow down" }, 429);
    }

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token || token.length > 4096) return json({ error: "NOT AUTHENTICATED" }, 401);
    const { data: userData, error: uErr } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (uErr || !user) return json({ error: "SESSION INVALID — LOG IN AGAIN" }, 401);
    const uid = user.id;

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

    // Per-user, per-action budget.
    for (const [win, max] of ACTION_LIMITS[action] ?? DEFAULT_LIMIT) {
      if (!(await rateLimit(`api:${uid}:${action}:${win}`, win, max))) {
        return json({ error: "rate limit exceeded — wait a while and try again" }, 429);
      }
    }

    const profile = await getProfile(uid);
    const accountStatus = profile?.status ?? "pending";
    const isAdmin = !!profile?.is_admin;
    const isAdminAction = action.startsWith("admin_");

    if (isAdminAction && !isAdmin) {
      return json({ error: "NOT AUTHORIZED" }, 403);
    }
    if (!isAdminAction && accountStatus !== "approved" && !UNGATED_ACTIONS.has(action)) {
      return json(
        {
          error:
            accountStatus === "denied"
              ? "THIS ACCOUNT WAS NOT CLEARED FOR SERVICE"
              : "ACCOUNT AWAITING CLEARANCE — THE SWITCH IS LOCKED UNTIL AN OPERATOR APPROVES IT",
          account_status: accountStatus,
        },
        403,
      );
    }

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
          if (!Number.isFinite(m) || m < 5 || m > 527040) {
            return json({ error: "interval must be 5 min – 1 year" }, 400);
          }
          patch.interval_minutes = Math.round(m);
        }
        if (body.recipient_email !== undefined) {
          if (!isEmail(body.recipient_email)) return json({ error: "invalid recipient email" }, 400);
          patch.recipient_email = String(body.recipient_email).trim();
        }
        if (body.operator_email !== undefined) {
          if (!isEmail(body.operator_email)) return json({ error: "invalid operator email" }, 400);
          patch.operator_email = String(body.operator_email).trim();
        }
        if (body.cc_emails !== undefined) {
          if (!Array.isArray(body.cc_emails)) return json({ error: "cc_emails must be a list" }, 400);
          if (body.cc_emails.length > 10) return json({ error: "max 10 CC addresses" }, 400);
          const ccs = body.cc_emails.map((e) => String(e).trim()).filter((e) => e.length > 0);
          for (const e of ccs) if (!isEmail(e)) return json({ error: "invalid CC email" }, 400);
          patch.cc_emails = ccs;
        }
        if (body.email_subject !== undefined) {
          // Strip CR/LF defensively — the transport is JSON today, but this
          // string must never be able to grow a header if that ever changes.
          patch.email_subject = String(body.email_subject).replace(/[\r\n]+/g, " ").slice(0, 200);
        }
        if (body.email_message !== undefined) {
          patch.email_message = String(body.email_message).slice(0, 5000);
        }
        if (patch.interval_minutes !== undefined) {
          const s = await getSwitch(uid);
          if (s.status === "armed") {
            patch.next_trigger_at = nextTrigger(patch.interval_minutes as number);
            patch.reminder_sent_at = null;
          }
        }
        const { error } = await supabase.from("switches").update(patch).eq("user_id", uid);
        if (error) throw new Error(error.message);

        // profile updates — only these two fields are ever writable by a user.
        if (body.callsign !== undefined || body.show_on_wall !== undefined) {
          const pPatch: Record<string, unknown> = {};
          if (body.callsign !== undefined) {
            const cs = String(body.callsign).trim();
            if (!CALLSIGN_RE.test(cs)) {
              return json({ error: "callsign: 2-24 chars, letters/numbers/dash/underscore" }, 400);
            }
            const { data: taken } = await supabase
              .from("profiles")
              .select("user_id")
              .ilike("callsign", cs)
              .neq("user_id", uid)
              .limit(1);
            if (taken && taken.length) return json({ error: "callsign already in service" }, 409);
            pPatch.callsign = cs;
          }
          if (body.show_on_wall !== undefined) {
            pPatch.show_on_wall = accountStatus === "approved" ? !!body.show_on_wall : false;
          }
          const { error: pErr } = await supabase.from("profiles").update(pPatch).eq("user_id", uid);
          if (pErr) throw new Error(pErr.message);
        }
        return json(await fullConfig(uid));
      }

      case "upload": {
        const name = safeFileName(String(body.file_name ?? ""));
        const mime = safeMime(String(body.mime_type ?? ""));
        const dataB64 = String(body.data_b64 ?? "").trim();
        if (!dataB64) return json({ error: "file_name and data_b64 required" }, 400);
        // Reject on the encoded length so a huge payload never gets decoded
        // into memory just to be measured.
        if (dataB64.length > MAX_B64_CHARS) return json({ error: "file exceeds 10 MB limit" }, 400);
        if (!B64_RE.test(dataB64)) return json({ error: "data_b64 is not valid base64" }, 400);
        let bytes: Uint8Array;
        try {
          bytes = b64ToBytes(dataB64);
        } catch {
          return json({ error: "data_b64 is not valid base64" }, 400);
        }
        if (bytes.length === 0) return json({ error: "file is empty" }, 400);
        if (bytes.length > MAX_UPLOAD_BYTES) return json({ error: "file exceeds 10 MB limit" }, 400);
        const existing = await listFiles(uid);
        if (existing.length >= 20) return json({ error: "max 20 files" }, 400);

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await importKey(["encrypt"]);
        const cipher = new Uint8Array(
          await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes.slice().buffer),
        );
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
        if (!isUuid(id)) return json({ error: "file not found" }, 404);
        const { data: f } = await supabase
          .from("user_payload_files")
          .select("*")
          .eq("id", id)
          .eq("user_id", uid)
          .single();
        if (!f) return json({ error: "file not found" }, 404);
        await supabase.storage.from("payload").remove([f.storage_path]);
        await supabase.from("user_payload_files").delete().eq("id", id).eq("user_id", uid);
        return json(await fullConfig(uid));
      }

      case "download_file": {
        const id = String(body.file_id ?? "");
        if (!isUuid(id)) return json({ error: "file not found" }, 404);
        const { data: f } = await supabase
          .from("user_payload_files")
          .select("*")
          .eq("id", id)
          .eq("user_id", uid)
          .single();
        if (!f) return json({ error: "file not found" }, 404);
        const { data: blob, error: dlErr } = await supabase.storage
          .from("payload")
          .download(f.storage_path);
        if (dlErr || !blob) throw new Error(`download: ${dlErr?.message}`);
        const key = await importKey(["decrypt"]);
        const plain = new Uint8Array(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: b64ToBytes(f.iv) },
            key,
            await blob.arrayBuffer(),
          ),
        );
        return json({ file_name: f.file_name, mime_type: f.mime_type, data_b64: bytesToB64(plain) });
      }

      case "test_email": {
        // Rate-limited hard above: this endpoint sends mail from a DKIM-signed
        // domain to attacker-chosen recipients, so it is the single most
        // abusable action in the API.
        const s = await getSwitch(uid);
        if (!s.recipient_email) return json({ error: "set a recipient first" }, 400);
        const resendKey = await secret("RESEND_API_KEY");
        const from = await secret("FROM_EMAIL");
        const ccs = Array.isArray(s.cc_emails) ? s.cc_emails.slice(0, 10) : [];
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [s.recipient_email],
            cc: ccs,
            subject: "OPERATION KILL SWITCH :: DELIVERY TEST",
            text:
              "This is a delivery test from Operation Kill Switch. The switch has NOT fired. " +
              "If you can read this, the release channel is working.\n\n" +
              "You are receiving this because an operator listed this address as a recipient. " +
              "If that was not you, ignore this message and no further mail will be sent.",
          }),
        });
        if (!resp.ok) {
          console.error("resend test_email failed:", resp.status, await resp.text());
          return json({ error: "the mail provider rejected the message" }, 502);
        }
        return json({ ok: true });
      }

      // ------------------------------------------------------- admin panel
      case "admin_overview": {
        const { data: pending } = await supabase
          .from("profiles")
          .select("user_id, callsign, signup_email, signup_note, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        const { data: recent } = await supabase
          .from("profiles")
          .select("user_id, callsign, signup_email, status, invite_code, reviewed_at, denial_reason, created_at")
          .neq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(50);

        const { data: codes } = await supabase
          .from("invite_codes")
          .select("id, code, label, max_uses, used_count, expires_at, active, created_at")
          .order("created_at", { ascending: false });

        return adminJson({
          pending: pending ?? [],
          recent: recent ?? [],
          codes: codes ?? [],
          server_time: new Date().toISOString(),
        });
      }

      case "admin_review": {
        const targetId = String(body.user_id ?? "");
        const decision = String(body.decision ?? "");
        if (!isUuid(targetId)) return json({ error: "user_id required" }, 400);
        if (decision !== "approved" && decision !== "denied") {
          return json({ error: "decision must be approved or denied" }, 400);
        }
        if (targetId === uid) return json({ error: "cannot review your own account" }, 400);
        // One admin must never be able to lock another one out.
        const target = await getProfile(targetId);
        if (!target) return json({ error: "account not found" }, 404);
        if (target.is_admin) return json({ error: "cannot review another admin" }, 403);

        const patch: Record<string, unknown> = {
          status: decision,
          reviewed_at: new Date().toISOString(),
          reviewed_by: uid,
          denial_reason:
            decision === "denied" ? String(body.reason ?? "").slice(0, 300) || null : null,
        };
        // A denied operator comes off the wall and their switch is stood down.
        if (decision === "denied") patch.show_on_wall = false;

        const { error } = await supabase.from("profiles").update(patch).eq("user_id", targetId);
        if (error) throw new Error(error.message);

        if (decision === "denied") {
          await supabase
            .from("switches")
            .update({ status: "disarmed", updated_at: new Date().toISOString() })
            .eq("user_id", targetId);
        }
        return adminJson({ ok: true });
      }

      case "admin_delete_account": {
        const targetId = String(body.user_id ?? "");
        if (!isUuid(targetId)) return json({ error: "user_id required" }, 400);
        if (targetId === uid) return json({ error: "cannot delete your own account" }, 400);
        const target = await getProfile(targetId);
        if (target?.is_admin) return json({ error: "cannot delete another admin" }, 403);

        // Purge encrypted payloads before the cascade drops the registry rows.
        const { data: files } = await supabase
          .from("user_payload_files")
          .select("storage_path")
          .eq("user_id", targetId);
        const paths = (files ?? []).map((f) => f.storage_path);
        if (paths.length) await supabase.storage.from("payload").remove(paths);

        const { error } = await supabase.auth.admin.deleteUser(targetId);
        if (error) {
          console.warn("admin_delete_account failed:", error.message);
          return json({ error: "could not delete that account" }, 400);
        }
        return adminJson({ ok: true });
      }

      case "admin_create_code": {
        const code = String(body.code ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9_-]{8,64}$/.test(code)) {
          return json(
            { error: "code: 8-64 chars, letters/numbers/dash/underscore" },
            400,
          );
        }
        const label = String(body.label ?? "").trim().slice(0, 120);
        let maxUses: number | null = null;
        if (body.max_uses !== undefined && body.max_uses !== null && body.max_uses !== "") {
          const n = Number(body.max_uses);
          if (!Number.isFinite(n) || n < 1 || n > 100000) {
            return json({ error: "max_uses must be 1-100000" }, 400);
          }
          maxUses = Math.round(n);
        }
        let expiresAt: string | null = null;
        if (
          body.expires_in_days !== undefined &&
          body.expires_in_days !== null &&
          body.expires_in_days !== ""
        ) {
          const d = Number(body.expires_in_days);
          if (!Number.isFinite(d) || d < 1 || d > 3650) {
            return json({ error: "expires_in_days must be 1-3650" }, 400);
          }
          expiresAt = new Date(Date.now() + d * 86_400_000).toISOString();
        }

        const { error } = await supabase.from("invite_codes").insert({
          code,
          label,
          max_uses: maxUses,
          expires_at: expiresAt,
          created_by: uid,
        });
        if (error) {
          if (error.code === "23505") return json({ error: "that code already exists" }, 409);
          throw new Error(error.message);
        }
        return adminJson({ ok: true });
      }

      case "admin_set_code_active": {
        const id = String(body.code_id ?? "");
        if (!isUuid(id)) return json({ error: "code_id required" }, 400);
        const { error } = await supabase
          .from("invite_codes")
          .update({ active: !!body.active })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return adminJson({ ok: true });
      }

      case "admin_delete_code": {
        const id = String(body.code_id ?? "");
        if (!isUuid(id)) return json({ error: "code_id required" }, 400);
        const { error } = await supabase.from("invite_codes").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return adminJson({ ok: true });
      }

      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json(internalError("user-api", e), 500);
  }
});
