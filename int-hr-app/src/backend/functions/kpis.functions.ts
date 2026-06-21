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