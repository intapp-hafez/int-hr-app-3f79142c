import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminRole } from "@/integrations/supabase/admin-auth-middleware";

const IP_REGEX =
  /^(?:(?:\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F:]+)(?:\/\d{1,3})?$/;

const AddSchema = z.object({
  ip: z.string().trim().min(3).max(64).regex(IP_REGEX, "Invalid IP / CIDR"),
  reason: z.string().trim().min(1).max(255).default("manual"),
  blocked_until: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(500).optional(),
});

const IdSchema = z.object({ id: z.string().uuid() });

export const listBlocklist = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("security_blocklist")
      .select("id,ip,reason,blocked_at,blocked_until,hit_count,manual,notes")
      .order("blocked_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { entries: data ?? [] };
  });

export const addBlocklistEntry = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((i) => AddSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/backend/server/admin-client.server"
    );
    const { error } = await (supabaseAdmin as any)
      .from("security_blocklist")
      .upsert(
        {
          ip: data.ip,
          reason: data.reason,
          blocked_until: data.blocked_until ?? null,
          notes: data.notes ?? null,
          manual: true,
          created_by: context.userId,
        },
        { onConflict: "ip" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeBlocklistEntry = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((i) => IdSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/backend/server/admin-client.server"
    );
    const { error } = await (supabaseAdmin as any)
      .from("security_blocklist")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireAdminRole])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("security_audit_events")
      .select("id,ip,path,kind,severity,detail,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });