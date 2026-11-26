import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

export type AutoCheckoutSettingsData = {
  auto_checkout_at_midnight: boolean;
  timezone: string;
  last_run_date: string | null;
  last_run_at: string | null;
  last_run_count: number;
};

export const getAutoCheckoutSettings = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async (): Promise<AutoCheckoutSettingsData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data } = await (supabaseAdmin as any)
        .from("attendance_automation_settings")
        .select("auto_checkout_at_midnight, timezone, last_run_date, last_run_at, last_run_count")
        .eq("id", 1)
        .maybeSingle();

      if (data) {
        return {
          auto_checkout_at_midnight: !!data.auto_checkout_at_midnight,
          timezone: data.timezone || "Africa/Cairo",
          last_run_date: data.last_run_date ?? null,
          last_run_at: data.last_run_at ?? null,
          last_run_count: Number(data.last_run_count ?? 0),
        };
      }
    } catch {
      // Table may not exist yet before migration
    }
    return {
      auto_checkout_at_midnight: false,
      timezone: "Africa/Cairo",
      last_run_date: null,
      last_run_at: null,
      last_run_count: 0,
    };
  });

export const updateAutoCheckoutSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        auto_checkout_at_midnight: z.boolean(),
        timezone: z.string().min(1).max(64).default("Africa/Cairo"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("attendance_automation_settings")
      .upsert({
        id: 1,
        auto_checkout_at_midnight: data.auto_checkout_at_midnight,
        timezone: data.timezone,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });

    if (error) {
      throw new Error(`Please run the auto-checkout SQL migration first: ${error.message}`);
    }

    await supabaseAdmin.from("security_audit_events").insert({
      kind: "auto_checkout_setting_changed",
      severity: "info",
      path: "/admin/attendance",
      detail: {
        actor_id: context.userId,
        auto_checkout_at_midnight: data.auto_checkout_at_midnight,
        timezone: data.timezone,
      },
    } as never);

    return { ok: true, auto_checkout_at_midnight: data.auto_checkout_at_midnight, timezone: data.timezone };
  });
