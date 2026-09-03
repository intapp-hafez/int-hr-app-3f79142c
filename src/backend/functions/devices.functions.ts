import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEVICE_ERRORS, logDeviceAction, requestIp } from "@/backend/server/device-registry.server";

const RegisterSchema = z.object({
  device_id: z.string().min(4).max(64),
  label: z.string().min(1).max(120),
  user_agent: z.string().max(500).optional().nullable(),
  fingerprint: z.string().max(128).optional().nullable(),
  device_key: z.string().max(128).optional().nullable(),
  device_type: z.string().max(32).optional().nullable(),
  os: z.string().max(64).optional().nullable(),
  browser: z.string().max(64).optional().nullable(),
});

export const registerMyDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof RegisterSchema>) => RegisterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Admin client: lookup must see rows owned by other users so we can return
    // a clean ownership error instead of a unique-constraint crash.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingDevice } = await supabaseAdmin
      .from("employee_devices")
      .select("id,user_id,status")
      .eq("id", data.device_id)
      .maybeSingle();

    if (existingDevice && existingDevice.user_id !== userId) {
      await logDeviceAction(supabaseAdmin, {
        device_id: data.device_id,
        user_id: userId,
        action: "denied",
        reason: "Registration attempt for a device owned by another employee",
      });
      throw new Error(DEVICE_ERRORS.ALREADY_REGISTERED);
    }

    const { data: userDevices } = await supabaseAdmin
      .from("employee_devices")
      .select("id")
      .eq("user_id", userId);

    if (userDevices && userDevices.length > 0 && !userDevices.some((d) => d.id === data.device_id)) {
      throw new Error("You already have a registered device. Please remove it before registering a new one.");
    }

    const now = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("employee_devices")
      .upsert(
        {
          id: data.device_id,
          user_id: userId,
          label: data.label,
          user_agent: data.user_agent ?? null,
          fingerprint: data.fingerprint ?? null,
          device_key: data.device_key ?? null,
          device_type: data.device_type ?? null,
          os: data.os ?? null,
          browser: data.browser ?? null,
          ip_address: requestIp(),
          // Preserve approval status on re-registration; new rows start pending.
          status: existingDevice?.status ?? "pending",
          last_seen_at: now,
        } as any,
        { onConflict: "id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (!existingDevice) {
      await logDeviceAction(supabaseAdmin, {
        device_id: data.device_id,
        user_id: userId,
        action: "register",
        to_status: "pending",
        actor_id: userId,
        reason: data.label,
      });
    }
    return row;
  });

export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employee_devices")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const removeMyDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id: string }) => z.object({ device_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employee_devices")
      .delete()
      .eq("id", data.device_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Admin / HR ────────────────────────────────────────────
async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: isHr } = await supabase.rpc("has_role", { _user_id: userId, _role: "hr" });
  if (!isAdmin && !isHr) throw new Error("Forbidden: admin or HR required");
}

export const listEmployeeDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("employee_devices")
      .select("*")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export type AdminDeviceRow = {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string | null;
  label: string;
  status: string;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  fingerprint: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_primary: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  approved_at: string | null;
  last_checkin: string | null;
  last_checkout: string | null;
  created_at: string;
};

export const listAllDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; search?: string }) =>
    z.object({ status: z.string().optional(), search: z.string().max(120).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminDeviceRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("employee_devices")
      .select("*, profiles:user_id(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const term = (data.search ?? "").trim().toLowerCase();
    return ((rows ?? []) as any[])
      .map((r) => ({
        id: r.id as string,
        user_id: r.user_id as string,
        employee_name: (r.profiles?.full_name ?? r.profiles?.email ?? r.user_id) as string,
        employee_email: (r.profiles?.email ?? null) as string | null,
        label: (r.label ?? "Device") as string,
        status: r.status as string,
        device_type: (r.device_type ?? null) as string | null,
        os: (r.os ?? null) as string | null,
        browser: (r.browser ?? null) as string | null,
        fingerprint: (r.fingerprint ?? null) as string | null,
        ip_address: (r.ip_address ?? null) as string | null,
        user_agent: (r.user_agent ?? null) as string | null,
        is_primary: !!r.is_primary,
        first_seen_at: (r.first_seen_at ?? null) as string | null,
        last_seen_at: (r.last_seen_at ?? null) as string | null,
        approved_at: (r.approved_at ?? null) as string | null,
        last_checkin: (r.last_checkin ?? null) as string | null,
        last_checkout: (r.last_checkout ?? null) as string | null,
        created_at: r.created_at as string,
      }))
      .filter((r) =>
        !term
          ? true
          : [r.employee_name, r.employee_email, r.id, r.label, r.os, r.browser, r.ip_address]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(term)),
      );
  });

const ACTION_TO_STATUS: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  block: "blocked",
  unblock: "approved",
  revoke: "revoked",
};

export const decideDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id: string; action: string; reason?: string }) =>
    z.object({
      device_id: z.string(),
      action: z.enum(["approve", "reject", "block", "unblock", "revoke"]),
      reason: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: current } = await context.supabase
      .from("employee_devices")
      .select("id, user_id, status")
      .eq("id", data.device_id)
      .maybeSingle();
    if (!current) throw new Error("Device not found");

    const to = ACTION_TO_STATUS[data.action]!;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: to };
    if (to === "approved") {
      patch['approved_at'] = now;
      patch['approved_by'] = context.userId;
      patch['blocked_at'] = null;
      patch['blocked_by'] = null;
    }
    if (data.action === "block") {
      patch['blocked_at'] = now;
      patch['blocked_by'] = context.userId;
    }
    const { error } = await context.supabase
      .from("employee_devices")
      .update(patch as any)
      .eq("id", data.device_id);
    if (error) throw new Error(error.message);

    await logDeviceAction(context.supabase, {
      device_id: data.device_id,
      user_id: current.user_id,
      action: data.action as any,
      from_status: current.status,
      to_status: to,
      actor_id: context.userId,
      reason: data.reason ?? null,
    });
    return { ok: true, status: to };
  });

// Kept for backwards compatibility with the employee-detail panel.
export const setEmployeeDeviceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id: string; status: "pending" | "approved" | "rejected" | "blocked" | "revoked" }) =>
    z.object({
      device_id: z.string(),
      status: z.enum(["pending", "approved", "rejected", "blocked", "revoked"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: current } = await context.supabase
      .from("employee_devices")
      .select("id, user_id, status")
      .eq("id", data.device_id)
      .maybeSingle();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "approved") {
      patch['approved_at'] = new Date().toISOString();
      patch['approved_by'] = context.userId;
    }
    const { error } = await context.supabase
      .from("employee_devices")
      .update(patch as any)
      .eq("id", data.device_id);
    if (error) throw new Error(error.message);
    await logDeviceAction(context.supabase, {
      device_id: data.device_id,
      user_id: current?.user_id ?? null,
      action:
        data.status === "approved" ? "approve" :
        data.status === "rejected" ? "reject" :
        data.status === "blocked" ? "block" :
        data.status === "revoked" ? "revoke" : "register",
      from_status: current?.status ?? null,
      to_status: data.status,
      actor_id: context.userId,
    });
    return { ok: true };
  });

export const deleteEmployeeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id: string }) => z.object({ device_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: current } = await context.supabase
      .from("employee_devices")
      .select("user_id, status")
      .eq("id", data.device_id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("employee_devices")
      .delete()
      .eq("id", data.device_id);
    if (error) throw new Error(error.message);
    await logDeviceAction(context.supabase, {
      device_id: data.device_id,
      user_id: current?.user_id ?? null,
      action: "replace",
      from_status: current?.status ?? null,
      to_status: "removed",
      actor_id: context.userId,
      reason: "Device deleted by administrator",
    });
    return { ok: true };
  });

export const listDeviceLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id?: string }) => z.object({ device_id: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = (context.supabase.from("device_approval_logs" as any) as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.device_id) q = q.eq("device_id", data.device_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      device_id: string;
      user_id: string | null;
      action: string;
      from_status: string | null;
      to_status: string | null;
      actor_id: string | null;
      reason: string | null;
      ip_address: string | null;
      created_at: string;
    }>;
  });
