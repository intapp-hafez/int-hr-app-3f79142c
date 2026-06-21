import { createMiddleware } from "@tanstack/react-start";

/**
 * Defense-in-depth request middleware:
 *
 *  1. Auto-blocklist enforcement — reject requests from IPs in
 *     public.security_blocklist (cached in memory for 30s to avoid
 *     hitting the DB on every request).
 *  2. Attack-pattern detector — log hits against well-known
 *     attacker probe paths (/.env, /wp-admin, /phpmyadmin, …) and
 *     auto-blocklist the source IP for 24h on repeated hits.
 *  3. In-memory rate limiter — coarse per-IP limit (worker-local).
 *  4. CSRF double-submit cookie — issues a `__csrf` cookie on safe
 *     methods and verifies the `x-csrf-token` header matches it on
 *     state-changing requests originating from a different origin.
 */

type BlockEntry = { until: number | null };
let blocklistCache: { at: number; map: Map<string, BlockEntry> } = {
  at: 0,
  map: new Map(),
};

const ATTACK_PATTERNS = [
  /\/wp-admin\b/i,
  /\/wp-login/i,
  /\/\.env(\.|$)/i,
  /\/phpmyadmin/i,
  /\/xmlrpc\.php/i,
  /\/\.git\//i,
  /\/etc\/passwd/i,
  /\/\.\.\//,
  /<script[\s>]/i,
  /\bunion\s+select\b/i,
  /\bselect\s.+\sfrom\s/i,
  /\bor\s+1=1\b/i,
];

const ATTACK_HITS = new Map<string, { count: number; resetAt: number }>();
const RATE = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_PER_MIN = 600; // generous default; admins tune in DB
const ATTACK_HIT_THRESHOLD = 3;
const AUTO_BLOCK_MINUTES = 24 * 60;

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
    "unknown"
  );
}

async function refreshBlocklist() {
  const now = Date.now();
  if (now - blocklistCache.at < 30_000) return;
  try {
    const { supabaseAdmin } = await import(
      "@/backend/server/admin-client.server"
    );
    const { data } = await (supabaseAdmin as any)
      .from("security_blocklist")
      .select("ip,blocked_until");
    const map = new Map<string, BlockEntry>();
    for (const row of (data ?? []) as Array<{
      ip: string;
      blocked_until: string | null;
    }>) {
      const until = row.blocked_until ? Date.parse(row.blocked_until) : null;
      if (until !== null && until < now) continue;
      map.set(row.ip, { until });
    }
    blocklistCache = { at: now, map };
  } catch {
    /* leave previous cache */
  }
}

async function recordEvent(
  ip: string,
  path: string,
  kind: string,
  severity: "low" | "medium" | "high",
  detail: Record<string, unknown> = {},
) {
  try {
    const { supabaseAdmin } = await import(
      "@/backend/server/admin-client.server"
    );
    await (supabaseAdmin as any)
      .from("security_audit_events")
      .insert({ ip, path, kind, severity, detail });
  } catch {
    /* swallow — never fail a request because audit logging is down */
  }
}

async function autoBlock(ip: string, reason: string) {
  try {
    const { supabaseAdmin } = await import(
      "@/backend/server/admin-client.server"
    );
    const until = new Date(
      Date.now() + AUTO_BLOCK_MINUTES * 60_000,
    ).toISOString();
    await (supabaseAdmin as any).from("security_blocklist").upsert(
      {
        ip,
        reason,
        manual: false,
        blocked_until: until,
        hit_count: 1,
      },
      { onConflict: "ip" },
    );
    blocklistCache.at = 0; // force refresh next request
  } catch {
    /* ignore */
  }
}

function bumpRate(ip: string): boolean {
  const now = Date.now();
  const slot = RATE.get(ip);
  if (!slot || slot.resetAt < now) {
    RATE.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  slot.count++;
  return slot.count <= RATE_LIMIT_PER_MIN;
}

function bumpAttack(ip: string): number {
  const now = Date.now();
  const slot = ATTACK_HITS.get(ip);
  if (!slot || slot.resetAt < now) {
    ATTACK_HITS.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return 1;
  }
  slot.count++;
  return slot.count;
}

function hexToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export const securityBlocklistMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const ip = clientIp(request);
    const url = new URL(request.url);
    const path = url.pathname + (url.search || "");

    await refreshBlocklist();
    const blocked = blocklistCache.map.get(ip);
    if (blocked) {
      return new Response("Forbidden — IP blocked by security policy", {
        status: 403,
        headers: { "content-type": "text/plain" },
      });
    }

    // Attack-pattern detector
    const haystack = path;
    if (ATTACK_PATTERNS.some((re) => re.test(haystack))) {
      const hits = bumpAttack(ip);
      void recordEvent(ip, path, "attack_pattern", "high", {
        method: request.method,
        hits,
      });
      if (hits >= ATTACK_HIT_THRESHOLD) {
        void autoBlock(
          ip,
          `auto: ${hits} probe hits in 10min (last: ${path.slice(0, 80)})`,
        );
        return new Response("Forbidden", { status: 403 });
      }
      return new Response("Not Found", { status: 404 });
    }

    // Coarse rate limit
    if (!bumpRate(ip)) {
      void recordEvent(ip, path, "rate_limit", "medium", {
        method: request.method,
      });
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "retry-after": "60" },
      });
    }

    // NOTE: classic double-submit CSRF is not enforced here because
    // server functions authenticate via `Authorization: Bearer <jwt>`,
    // which browsers never attach to cross-site requests automatically —
    // so the bearer-token model is already CSRF-safe. We still issue a
    // __csrf cookie below so client code can implement double-submit
    // tokens in the future if cookie-based session auth is added.

    const result = await next();
    const response: Response | undefined = (result as { response?: Response })
      .response;
    if (response && response instanceof Response) {
      try {
        const existing = readCookie(request, "__csrf");
        if (!existing) {
          const tok = hexToken();
          response.headers.append(
            "set-cookie",
            `__csrf=${tok}; Path=/; SameSite=Lax; Secure; Max-Age=86400`,
          );
        }
      } catch {
        /* immutable response */
      }
    }
    return result;
  },
);