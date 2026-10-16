import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { AllowanceSchema } from "../schemas";

export const listAllowances = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("allowances").select("*").order("name", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAllowance = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => AllowanceSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...payload } = data;
    if (id) {
      const { error } = await context.supabase.from("allowances").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("allowances").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteAllowance = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("allowances").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertAllowances = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      allowances: z.array(
        z.object({
          name: z.string().trim().min(1).max(120),
          kind: z.enum(["fixed", "percent", "per_day", "per_km"]),
          amount: z.number().min(0).max(1000000).default(0),
          currency: z.string().trim().min(1).max(8).default("EGP"),
          taxable: z.boolean().default(false),
          is_active: z.boolean().default(true),
        })
      ).min(1).max(500),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let inserted = 0;
    let updated = 0;
    for (const item of data.allowances) {
      const payload = {
        name: item.name,
        kind: item.kind,
        amount: item.amount ?? 0,
        currency: item.currency || "EGP",
        taxable: item.taxable ?? false,
        is_active: item.is_active ?? true,
      };
      const { data: existing } = await supabase
        .from("allowances")
        .select("id")
        .eq("name", item.name)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase.from("allowances").update(payload).eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("allowances").insert(payload);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated, total: inserted + updated };
  });