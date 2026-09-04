// Server-only helpers for the device registration & approval layer.
// The backend — never the frontend — is the authority on whether a device may check in.
import { getRequest } from "@tanstack/react-start/server";

export type DeviceStatus = "pending" | "approved" | "rejected" | "blocked" | "revoked";

export function requestIp(): string | null {
  try {
    const h = getRequest()?.headers;
    if (!h) return null;
    return (
      (h.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      null
    );
  } catch {
    return null;
  }
}

export async function logDeviceAction(
  supabase: any,
  entry: {
    device_id: string;
    user_id?: string | null;
    action: "register" | "approve" | "reject" | "block" | "unblock" | "revoke" | "replace" | "denied";
    from_status?: string | null;
    to_status?: string | null;
    actor_id?: string | null;
    reason?: string | null;
  },
) {
  try {
    await supabase.from("device_approval_logs").insert({
      ...entry,
      ip_address: requestIp(),
    });
  } catch {
    // logging must never break the main flow
  }
}

export const DEVICE_ERRORS = {
  NOT_REGISTERED:
    "DEVICE_NOT_REGISTERED · This device is not registered for your account. Register it, then ask your administrator to approve it.",
  ALREADY_REGISTERED:
    "DEVICE_ALREADY_REGISTERED · This device is already registered to another employee.",
  PENDING:
    "DEVICE_PENDING · This device has not been approved for your account. Please contact your administrator.",
  REJECTED: "DEVICE_REJECTED · This device was rejected by your administrator.",
  BLOCKED: "DEVICE_BLOCKED · This device is blocked. Please contact your administrator.",
  REVOKED: "DEVICE_REVOKED · This device was revoked. Please register a new device.",
  MISSING: "DEVICE_ID_REQUIRED · No device identifier was sent with this request.",
} as const;

/**
 * Final server-side gate for attendance actions.
 * Verifies: device exists → belongs to this employee → status is APPROVED.
 * Uses the service-role client so devices owned by other users are visible
 * (otherwise RLS hides them and we'd report the wrong error).
 */
export async function assertDeviceAllowed(userId: string, deviceId: string | undefined | null) {
  if (!deviceId) throw new Error(DEVICE_ERRORS.MISSING);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: device } = await supabaseAdmin
    .from("employee_devices")
    .select("id, user_id, status")
    .eq("id", deviceId)
    .maybeSingle();

  if (!device) throw new Error(DEVICE_ERRORS.NOT_REGISTERED);
  if (device.user_id !== userId) {
    await logDeviceAction(supabaseAdmin, {
      device_id: deviceId,
      user_id: userId,
      action: "denied",
      from_status: device.status,
      to_status: device.status,
      reason: "Device belongs to another employee",
    });
    throw new Error(DEVICE_ERRORS.ALREADY_REGISTERED);
  }
  const status = device.status as DeviceStatus;
  if (status !== "approved") {
    await logDeviceAction(supabaseAdmin, {
      device_id: deviceId,
      user_id: userId,
      action: "denied",
      from_status: status,
      to_status: status,
      reason: `Attendance attempt with ${status} device`,
    });
    throw new Error(
      status === "blocked" ? DEVICE_ERRORS.BLOCKED :
      status === "rejected" ? DEVICE_ERRORS.REJECTED :
      status === "revoked" ? DEVICE_ERRORS.REVOKED :
      DEVICE_ERRORS.PENDING,
    );
  }
  return device;
}

/**
 * Non-throwing variant used by attendance check-in / check-out, which return a
 * structured `blocked` payload instead of raising.
 */
export async function checkDeviceAccess(
  userId: string,
  deviceId: string | undefined | null,
  kind: "in" | "out",
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const verb = kind === "in" ? "Check-in" : "Check-out";
  try {
    await assertDeviceAllowed(userId, deviceId);
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message ?? DEVICE_ERRORS.PENDING);
    return { ok: false, reason: `${verb} blocked · ${msg.split("· ").slice(1).join("· ") || msg}` };
  }
}

export async function touchDeviceCheck(deviceId: string, kind: "in" | "out") {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("employee_devices")
      .update({
        last_seen_at: new Date().toISOString(),
        ...(kind === "in"
          ? { last_checkin: new Date().toISOString() }
          : { last_checkout: new Date().toISOString() }),
        ip_address: requestIp(),
      } as any)
      .eq("id", deviceId);
  } catch {
    /* non-fatal */
  }
}
