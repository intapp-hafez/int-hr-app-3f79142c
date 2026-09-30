import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { NotificationPrefsSchema } from "../schemas";

export const getMyPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? {
      user_id: userId,
      push_enabled: true, email_enabled: true, inapp_enabled: true,
      quiet_start: null, quiet_end: null, timezone: "UTC",
    };
  });

export const saveMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => NotificationPrefsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: userId, ...data,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notif_deliveries")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", "inapp")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const listAllDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("notif_deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
export const markMyNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("notif_deliveries").select("id, payload")
      .eq("user_id", context.userId).eq("channel", "inapp").limit(200);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { data: rows } = await q;
    const now = new Date().toISOString();
    let n = 0;
    for (const r of rows ?? []) {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      if (p.read_at) continue;
      await supabaseAdmin.from("notif_deliveries").update({ payload: { ...p, read_at: now } as any }).eq("id", r.id);
      n++;
    }
    return { updated: n };
  });
