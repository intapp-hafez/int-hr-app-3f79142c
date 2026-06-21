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