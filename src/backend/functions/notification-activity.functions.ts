import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

export type NotificationActivityRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string;
  channel: string;
  status: string;
  subject: string | null;
  recipient: string | null;
  error: string | null;
  category: string | null;
  read_at: string | null;
};

export const listNotificationActivity = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({ days: z.number().int().min(1).max(90).default(14) }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<NotificationActivityRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("notif_deliveries")
      .select("id, created_at, user_id, channel, status, subject, recipient, error, payload")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
      for (const p of (profs ?? []) as any[]) names.set(p.id, p.full_name ?? "—");
    }
    return (rows ?? []).map((r: any) => {
      const p = (r.payload ?? {}) as Record<string, any>;
      return {
        id: r.id,
        created_at: r.created_at,
        user_id: r.user_id,
        user_name: r.user_id ? names.get(r.user_id) ?? "—" : "—",
        channel: r.channel,
        status: r.status,
        subject: r.subject ?? p.title ?? null,
        recipient: r.recipient,
        error: r.error,
        category: p.category ?? p.kind ?? null,
        read_at: p.read_at ?? null,
      };
    });
  });
