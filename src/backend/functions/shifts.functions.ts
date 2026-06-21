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