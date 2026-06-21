import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CategoryEnum = z.enum(["pending_leave", "late", "absent", "checkin", "checkout"]);
const ChannelEnum = z.enum(["inapp", "email", "push"]);

export const getMyCategoryPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("notification_category_prefs")
      .select("category, channel, enabled")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as { category: string; channel: string; enabled: boolean }[];
  });

const UpsertInput = z.object({
  category: CategoryEnum,
  channel: ChannelEnum,
  enabled: z.boolean(),
});

export const setMyCategoryPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("notification_category_prefs")
      .upsert(
        { user_id: context.userId, category: data.category, channel: data.channel, enabled: data.enabled, updated_at: new Date().toISOString() },
        { onConflict: "user_id,category,channel" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkInput = z.object({
  prefs: z.array(UpsertInput).max(50),
});

export const setMyCategoryPrefsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => BulkInput.parse(i))
  .handler(async ({ data, context }) => {
    if (data.prefs.length === 0) return { ok: true };
    const rows = data.prefs.map((p) => ({
      user_id: context.userId,
      category: p.category,
      channel: p.channel,
      enabled: p.enabled,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await (context.supabase as any)
      .from("notification_category_prefs")
      .upsert(rows, { onConflict: "user_id,category,channel" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });