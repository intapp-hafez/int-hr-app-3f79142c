import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { ShiftSchema } from "../schemas";

export const listShifts = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shifts").select("*").order("name", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertShift = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => ShiftSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...payload } = data;
    if (id) {
      const { error } = await context.supabase.from("shifts").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("shifts").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertShifts = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      shifts: z.array(
        z.object({
          name: z.string().trim().min(1).max(120),
          start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:mm"),
          end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:mm"),
          grace_minutes: z.number().int().min(0).max(240).default(0),
          is_overnight: z.boolean().default(false),
          is_active: z.boolean().default(true),
        })
      ).min(1).max(500),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let inserted = 0;
    let updated = 0;
    for (const item of data.shifts) {
      const payload = {
        name: item.name,
        start_time: item.start_time,
        end_time: item.end_time,
        grace_minutes: item.grace_minutes ?? 0,
        is_overnight: item.is_overnight ?? false,
        is_active: item.is_active ?? true,
      };
      const { data: existing } = await supabase
        .from("shifts")
        .select("id")
        .eq("name", item.name)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase.from("shifts").update(payload).eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("shifts").insert(payload);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated, total: inserted + updated };
  });