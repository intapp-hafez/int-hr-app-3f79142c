import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { LatePenaltySchema } from "../schemas";

export const listLatePenalties = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("late_penalties").select("*").order("from_minutes", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertLatePenalty = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => LatePenaltySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...payload } = data;
    if (id) {
      const { error } = await context.supabase.from("late_penalties").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("late_penalties").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteLatePenalty = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("late_penalties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertLatePenalties = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      rules: z.array(
        z.object({
          name: z.string().trim().min(1).max(120),
          from_minutes: z.number().int().min(0).max(600),
          to_minutes: z.number().int().min(0).max(600),
          penalty_type: z.enum(["deduction_minutes", "deduction_amount", "warning"]),
          penalty_value: z.number().min(0).max(1000000).default(0),
          is_active: z.boolean().default(true),
        }).refine((d) => d.to_minutes >= d.from_minutes, { path: ["to_minutes"], message: "Must be ≥ from" })
      ).min(1).max(500),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let inserted = 0;
    let updated = 0;
    for (const item of data.rules) {
      const payload = {
        name: item.name,
        from_minutes: item.from_minutes,
        to_minutes: item.to_minutes,
        penalty_type: item.penalty_type,
        penalty_value: item.penalty_value ?? 0,
        is_active: item.is_active ?? true,
      };
      const { data: existing } = await supabase
        .from("late_penalties")
        .select("id")
        .eq("name", item.name)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase.from("late_penalties").update(payload).eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("late_penalties").insert(payload);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated, total: inserted + updated };
  });