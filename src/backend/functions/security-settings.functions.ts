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