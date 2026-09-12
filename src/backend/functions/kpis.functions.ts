import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { KpiSchema } from "../schemas";

export const listKpis = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kpis").select("*").order("name", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertKpi = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => KpiSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...payload } = data;
    const clean = { ...payload, unit: payload.unit || null };
    if (id) {
      const { error } = await context.supabase.from("kpis").update(clean).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("kpis").insert(clean).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteKpi = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kpis").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertKpis = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      kpis: z.array(
        z.object({
          name: z.string().trim().min(1).max(120),
          metric: z.string().trim().min(1).max(200),
          target_value: z.number().min(0).max(1e12).default(0),
          unit: z.string().trim().max(40).optional().nullable(),
          period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
          weight: z.number().min(0).max(100).default(1),
          is_active: z.boolean().default(true),
        })
      ).min(1).max(500),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let inserted = 0;
    let updated = 0;
    for (const item of data.kpis) {
      const payload = {
        name: item.name,
        metric: item.metric,
        target_value: item.target_value ?? 0,
        unit: item.unit || null,
        period: item.period ?? "monthly",
        weight: item.weight ?? 1,
        is_active: item.is_active ?? true,
      };
      const { data: existing } = await supabase
        .from("kpis")
        .select("id")
        .eq("name", item.name)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase.from("kpis").update(payload).eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("kpis").insert(payload);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated, total: inserted + updated };
  });