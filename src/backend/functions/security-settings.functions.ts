import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminRole } from "@/integrations/supabase/admin-auth-middleware";

const SecuritySettingsSchema = z.object({
  enforce_2fa: z.boolean(),
  session_timeout_minutes: z.number().int().min(5).max(10080),
  ip_allowlist: z.array(z.string().trim().max(64)).max(100),
  rate_limit_per_min: z.number().int().min(10).max(10000),
  csp_enabled: z.boolean(),
  hsts_enabled: z.boolean(),
  x_frame_deny: z.boolean(),
  referrer_policy: z.string().trim().min(1).max(64),
  permissions_policy: z.string().trim().min(0).max(512),
  block_sql_keywords: z.boolean(),
  sanitize_html_inputs: z.boolean(),
  cdn_subresource_integrity: z.boolean(),
  attendance_rate_limit_enabled: z.boolean().default(true),
  attendance_rate_limit_attempts: z.number().int().min(1).max(100).default(5),
  attendance_rate_limit_window_seconds: z.number().int().min(10).max(3600).default(60),
});

export type SecuritySettingsInput = z.infer<typeof SecuritySettingsSchema>;

export const getSecuritySettings = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("security_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateSecuritySettings = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((i) => SecuritySettingsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      ...data,
      ip_allowlist: data.ip_allowlist.filter((s) => s.length > 0),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await context.supabase
      .from("security_settings")
      .update(payload as never)
      .eq("id", 1);
    if (error) {
      // Attendance rate-limit columns may not be migrated yet — retry without them.
      const {
        attendance_rate_limit_enabled: _a,
        attendance_rate_limit_attempts: _b,
        attendance_rate_limit_window_seconds: _c,
        ...legacy
      } = payload;
      const { error: retryError } = await context.supabase
        .from("security_settings")
        .update(legacy as never)
        .eq("id", 1);
      if (retryError) throw new Error(error.message);
    }
    return { ok: true };
  });

/**
 * Admin action: clear a specific employee's logged check-in / check-out attempts
 * after investigating abuse, effectively resetting their rate-limit counters.
 */
export const resetEmployeeAttendanceRateLimit = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((i) => z.object({ employee_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error, count } = await context.supabase
      .from("attendance_check_attempts")
      .delete({ count: "exact" })
      .eq("user_id", data.employee_id);
    if (error) throw new Error(error.message);

    // Best-effort audit trail; never blocks the reset.
    try {
      await context.supabase.from("security_audit_events").insert({
        event_type: "attendance_rate_limit_reset",
        actor_id: context.userId,
        details: { employee_id: data.employee_id, cleared_attempts: count ?? 0 },
      } as never);
    } catch {
      /* audit table/columns may vary — ignore */
    }

    return { ok: true, cleared: count ?? 0 };
  });