import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminRole } from "@/integrations/supabase/admin-auth-middleware";
import { NetworkSchema } from "../schemas";

export const listNetworks = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("networks").select("*").order("name", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertNetwork = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((i) => NetworkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...payload } = data;
    const clean = {
      ...payload,
      ssid: payload.ssid || null,
      bssid: payload.bssid ? String(payload.bssid).toUpperCase() : null,
      branch: payload.branch || null,
      notes: payload.notes || null,
    };
    if (id) {
      const { error } = await context.supabase.from("networks").update(clean).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase.from("networks").insert(clean).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteNetwork = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("networks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
