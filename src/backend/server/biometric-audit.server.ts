import { getRequest } from "@tanstack/react-start/server";

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
};

function requestMeta() {
  try {
    const req = getRequest();
    const h = req.headers;
    return {
      user_agent: h.get("user-agent"),
      ip_address:
        h.get("cf-connecting-ip") ??
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        null,
    };
  } catch {
    return { user_agent: null, ip_address: null };
  }
}

/**
 * Best-effort audit write. Never throws: an audit failure must not break a
 * biometric enrollment, verification or check-in.
 */
export async function logBiometricEvent(entry: BiometricAuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = requestMeta();
    const { error } = await ((supabaseAdmin as any).from("biometric_audit_log") as any).insert({
      user_id: entry.userId ?? null,
      email: entry.email ?? null,
      method: entry.method,
      event: entry.event,
      success: entry.success,
      reason: entry.reason ?? null,
      distance: entry.distance ?? null,
      device_label: entry.deviceLabel ?? null,
      device_id: entry.deviceId ?? null,
      user_agent: meta.user_agent,
      ip_address: meta.ip_address,
    });
    if (error) console.error("[biometric-audit] insert failed:", error.message);
  } catch (e) {
    console.error("[biometric-audit] logging failed:", (e as Error).message);
  }
}
