export type BiometricMethod = "face" | "fingerprint";
export type BiometricEvent = "enroll" | "unenroll" | "verify" | "login" | "check_in" | "check_out";

export type BiometricAuditEntry = {
  userId?: string | null;
  email?: string | null;
  method: BiometricMethod;
  event: BiometricEvent;
  success: boolean;
  reason?: string | null;
  distance?: number | null;
  deviceLabel?: string | null;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
};

function requestMeta() {
  try {
    const getReq = (globalThis as any).getRequest;
    if (typeof getReq === "function") {
      const req = getReq();
      if (req?.headers) {
        const h = req.headers;
        return {
          user_agent: h.get("user-agent") || (typeof navigator !== "undefined" ? navigator.userAgent : null),
          ip_address:
            h.get("cf-connecting-ip") ??
            h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            null,
        };
      }
    }
  } catch {
    // fallback to browser window / navigator if available
  }
  return {
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    ip_address: null,
  };
}

/**
 * Best-effort audit write. Never throws: an audit failure must not break a
 * biometric enrollment, verification or check-in.
 */
export async function logBiometricEvent(entry: BiometricAuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = requestMeta();

    let resolvedEmail = entry.email ?? null;
    if (!resolvedEmail && entry.userId) {
      try {
        const { data: prof } = await (supabaseAdmin as any)
          .from("profiles")
          .select("email")
          .eq("id", entry.userId)
          .maybeSingle();
        if (prof?.email) resolvedEmail = prof.email;
      } catch {
        // ignore profile lookup failure
      }
    }

    const { error } = await (supabaseAdmin as any).from("biometric_audit_log").insert({
      user_id: entry.userId ?? null,
      email: resolvedEmail,
      method: entry.method,
      event: entry.event,
      success: entry.success,
      reason: entry.reason ?? null,
      distance: entry.distance != null ? Number(entry.distance.toFixed(4)) : null,
      device_label: entry.deviceLabel ?? null,
      device_id: entry.deviceId ?? null,
      user_agent: entry.userAgent ?? meta.user_agent,
      ip_address: entry.ipAddress ?? meta.ip_address,
    });
    if (error) console.error("[biometric-audit] insert failed:", error.message);
  } catch (e) {
    console.error("[biometric-audit] logging failed:", (e as Error).message);
  }
}

