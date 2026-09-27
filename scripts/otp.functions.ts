import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Encrypted session cookie holds the hashed OTP + expiry so we don't need
// a new DB table for the challenge. The session password is required.
function sessionConfig() {
  const password =
    process.env.OTP_SESSION_SECRET ||
    process.env.SMTP_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "otp-fallback-secret-change-me-please-32b";
  return {
    password,
    name: "hr-otp",
    maxAge: 60 * 10, // 10 minutes
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

type OtpSessionData = {
  userId?: string;
  mobile?: string;
  hash?: string;
  expiresAt?: number;
  attempts?: number;
  lastSentAt?: number;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const OTP_COOLDOWN_MS = 45_000;
const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

const RequestSchema = z.object({
  mobile: z.string().min(5).max(20).optional(),
});

const VerifySchema = z.object({
  code: z.string().regex(/^\d{4,8}$/),
});

export const requestMyOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RequestSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const session = await useSession<OtpSessionData>(sessionConfig());
    const now = Date.now();
    const last = session.data.lastSentAt ?? 0;
    if (now - last < OTP_COOLDOWN_MS) {
      const remaining = Math.ceil((OTP_COOLDOWN_MS - (now - last)) / 1000);
      return { ok: false, error: `Please wait ${remaining}s before requesting another code`, cooldown: remaining };
    }

    // Resolve mobile: prefer input, else fall back to the caller's profile.phone
    let mobile = (data.mobile ?? "").trim();
    if (!mobile) {
      const { data: prof } = await context.supabase
        .from("profiles").select("phone").eq("id", context.userId).maybeSingle();
      mobile = (prof?.phone ?? "").trim();
    }
    if (!mobile) return { ok: false, error: "No mobile number on file" };

    const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
    const hash = await sha256Hex(`${context.userId}:${code}`);
    const expiresAt = now + OTP_TTL_MS;

    const { loadSmsConfig } = await import("@/backend/server/sms-config.server");
    const { sendSmsEpush, validateSmsAuth, normalizeRecipients } = await import("@/backend/server/sms-client.server");
    const { logSmsAudit, checkOtpRateLimit } = await import("@/backend/server/sms-audit.server");
    const cfg = await loadSmsConfig();
    const message = `Your verification code is ${code}`;

    // Server-side per-mobile rate limit (defense in depth beyond the session cooldown).
    const rec = normalizeRecipients(mobile);
    if (rec.invalid.length) {
      return { ok: false, error: `Invalid mobile number. Use 201XXXXXXXXX or 01XXXXXXXXX.` };
    }
    const rl = await checkOtpRateLimit(rec.mobile, { cooldownSec: 60, maxPerHour: 5 });
    if (!rl.allowed) {
      await logSmsAudit({ sent_by: context.userId, mobile: rec.mobile, message: "(rate-limited)", kind: "otp", ok: false, error: rl.reason });
      return { ok: false, error: rl.reason, cooldown: rl.retryAfter };
    }

    let ok = false;
    let error: string | null = null;
    let smsId: string | null = null;
    let providerCode: string | null = null;
    if (!cfg || !cfg.enabled) {
      error = "SMS is disabled or not configured";
    } else {
      const authErr = validateSmsAuth({ username: cfg.username, password: cfg.password, apiKey: cfg.api_key, sender: cfg.sender });
      if (authErr) {
        error = authErr;
      } else {
        const res = await sendSmsEpush(
          { environment: cfg.environment, username: cfg.username, password: cfg.password, apiKey: cfg.api_key, sender: cfg.sender },
          { mobile, message, language: cfg.language },
        );
        ok = res.ok;
        error = res.error ?? null;
        smsId = res.smsId ?? null;
        providerCode = res.code ?? null;
      }
    }
    await logSmsAudit({
      sent_by: context.userId, mobile, message, kind: "otp",
      ok, provider_code: providerCode, sms_id: smsId, error,
    });

    if (!ok) {
      return { ok: false, error: error ?? "Failed to send OTP" };
    }

    await session.update({
      userId: context.userId,
      mobile,
      hash,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
    });

    return {
      ok: true,
      mobileMasked: mobile.replace(/^(\+?\d{2,4})(.*)(\d{2})$/, (_m, a, b, c) => `${a}${"*".repeat(Math.max(0, b.length))}${c}`),
      expiresAt,
      cooldown: Math.ceil(OTP_COOLDOWN_MS / 1000),
    };
  });

export const verifyMyOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => VerifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const session = await useSession<OtpSessionData>(sessionConfig());
    const s = session.data;
    if (!s?.hash || !s.expiresAt || s.userId !== context.userId) {
      return { ok: false, error: "No active OTP challenge. Request a new code." };
    }
    if (Date.now() > s.expiresAt) {
      await session.clear();
      return { ok: false, error: "Code expired. Request a new one." };
    }
    const attempts = (s.attempts ?? 0) + 1;
    if (attempts > OTP_MAX_ATTEMPTS) {
      await session.clear();
      return { ok: false, error: "Too many attempts. Request a new code." };
    }
    const provided = await sha256Hex(`${context.userId}:${data.code}`);
    // Timing-safe-ish compare
    let diff = provided.length ^ s.hash.length;
    for (let i = 0; i < Math.min(provided.length, s.hash.length); i++) {
      diff |= provided.charCodeAt(i) ^ s.hash.charCodeAt(i);
    }
    if (diff !== 0) {
      await session.update({ ...s, attempts });
      return { ok: false, error: "Invalid code", attemptsRemaining: OTP_MAX_ATTEMPTS - attempts };
    }
    await session.clear();
    return { ok: true };
  });