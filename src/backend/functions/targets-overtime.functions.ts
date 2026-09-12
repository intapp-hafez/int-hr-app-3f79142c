import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { TargetsOvertimeSchema } from "../schemas";

export const listTargetsOvertime = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("targets_overtime").select("*").order("name", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertTargetsOvertime = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => TargetsOvertimeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...payload } = data;
    if (id) {
      const { error } = await context.supabase.from("targets_overtime").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("targets_overtime").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteTargetsOvertime = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("targets_overtime").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertTargetsOvertime = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      policies: z.array(
        z.object({
          name: z.string().trim().min(1).max(120),
          daily_target_hours: z.number().min(0).max(24).default(8),
          weekly_target_hours: z.number().min(0).max(168).default(40),
          overtime_rate: z.number().min(0).max(10).default(1.5),
          overtime_cap_hours: z.number().min(0).max(168).default(4),
          is_active: z.boolean().default(true),
        })
      ).min(1).max(500),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let inserted = 0;
    let updated = 0;
    for (const item of data.policies) {
      const payload = {
        name: item.name,
        daily_target_hours: item.daily_target_hours ?? 8,
        weekly_target_hours: item.weekly_target_hours ?? 40,
        overtime_rate: item.overtime_rate ?? 1.5,
        overtime_cap_hours: item.overtime_cap_hours ?? 4,
        is_active: item.is_active ?? true,
      };
      const { data: existing } = await supabase
        .from("targets_overtime")
        .select("id")
        .eq("name", item.name)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase.from("targets_overtime").update(payload).eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("targets_overtime").insert(payload);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated, total: inserted + updated };
  });