// Shared hardening helpers for the Operation Kill Switch edge functions.
// Copied inline into each function at deploy time (Supabase edge functions are
// deployed per-directory), so keep this file dependency-free.

/** Origins allowed to call the API from a browser. */
export const ALLOWED_ORIGINS = new Set([
  "https://www.operationkillswitch.com",
  "https://operationkillswitch.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    // Caches must not serve one origin's CORS answer to another.
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
  // Only echo an origin we actually trust. Anything else gets no ACAO header
  // at all, which the browser treats as a hard block.
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Credentials"] = "true";
  }
  return h;
}

/** Timing-safe string comparison — no early exit on first differing byte. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Compare lengths without branching out early; still leaks length only.
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** Best-effort client IP from the edge proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return (
    first ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID_RE.test(s);

/**
 * Make an untrusted filename safe to hand to a mail client / filesystem.
 * Strips directory separators, traversal, control characters and null bytes,
 * then caps the length. Never returns an empty string.
 */
export function safeFileName(raw: string): string {
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

const MIME_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,62}$/i;
export function safeMime(raw: string): string {
  const m = String(raw ?? "").trim().split(";")[0].trim();
  return MIME_RE.test(m) ? m.toLowerCase() : "application/octet-stream";
}

/**
 * Never hand an internal exception to the client — messages carry table names,
 * Postgres error codes and upstream API bodies. Log it, return a reference.
 */
export function internalError(
  where: string,
  e: unknown,
): { error: string; ref: string } {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${where}] ref=${ref}`, e);
  return { error: "internal error — the incident was logged", ref };
}
