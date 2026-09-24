import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminHr(supabase: any, userId: string) {
  const [{ data: a }, { data: h }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "hr" }),
  ]);
  if (!a && !h) throw new Error("Forbidden");
}

const MISSING = "Device table not set up yet — run 040-biometric-terminals.sql in Supabase.";
const friendly = (m: string) => (/biometric_terminals|schema cache|does not exist/i.test(m) ? MISSING : m);

export const listBiometricTerminals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdminHr(sb, context.userId);
    const [{ data: terms, error }, { data: locs }] = await Promise.all([
      sb.from("biometric_terminals").select("*").order("created_at", { ascending: false }),
      sb.from("geofence_locations").select("id, name, active").order("name"),
    ]);
    if (error) return { terminals: [], locations: locs ?? [], error: friendly(error.message) };
    const codes = (terms ?? []).map((t: any) => t.device_code);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const stats = new Map<string, { total: number; failed: number; last: string | null }>();
    if (codes.length) {
      const { data: logs } = await sb
        .from("biometric_audit_log")
        .select("device_id, success, created_at")
        .in("device_id", codes)
        .gte("created_at", since)
        .limit(5000);
      for (const l of logs ?? []) {
        const s = stats.get(l.device_id) ?? { total: 0, failed: 0, last: null };
        s.total++;
        if (!l.success) s.failed++;
        if (!s.last || l.created_at > s.last) s.last = l.created_at;
        stats.set(l.device_id, s);
      }
    }
    return {
      terminals: (terms ?? []).map((t: any) => {
        const s = stats.get(t.device_code);
        return {
          id: t.id as string,
          name: t.name as string,
          deviceCode: t.device_code as string,
          kind: t.kind as string,
          locationId: (t.location_id ?? null) as string | null,
          status: t.status as string,
          notes: (t.notes ?? null) as string | null,
          lastSeen: (s?.last ?? t.last_seen_at ?? null) as string | null,
          events30d: s?.total ?? 0,
          failed30d: s?.failed ?? 0,
        };
      }),
      locations: (locs ?? []) as { id: string; name: string; active: boolean }[],
      error: null as string | null,
    };
  });

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name is required").max(100),
  deviceCode: z.string().trim().min(3, "Device code is required").max(64).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  kind: z.enum(["face", "fingerprint", "both"]),
  locationId: z.string().uuid("Choose a location"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const saveBiometricTerminal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdminHr(sb, context.userId);
    const row = {
      name: data.name,
      device_code: data.deviceCode,
      kind: data.kind,
      location_id: data.locationId,
      notes: data.notes || null,
    };
    const q = data.id
      ? sb.from("biometric_terminals").update(row).eq("id", data.id)
      : sb.from("biometric_terminals").insert({ ...row, created_by: context.userId });
    const { error } = await q;
    if (error) {
      if (error.code === "23505") throw new Error("A device with this code is already registered");
      throw new Error(friendly(error.message));
    }
    return { ok: true };
  });

export const setBiometricTerminalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["active", "disabled"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdminHr(sb, context.userId);
    const { error } = await sb
      .from("biometric_terminals")
      .update({ status: data.status, disabled_at: data.status === "disabled" ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });

export const getBiometricTerminalActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deviceCode: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdminHr(sb, context.userId);
    const { data: logs, error } = await sb
      .from("biometric_audit_log")
      .select("id, created_at, event, method, success, reason, email, user_id")
      .eq("device_id", data.deviceCode)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = [...new Set((logs ?? []).map((l: any) => l.user_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: p } = await sb.from("profiles").select("id, full_name").in("id", ids);
      for (const r of p ?? []) names.set(r.id, r.full_name);
    }
    return (logs ?? []).map((l: any) => ({
      id: l.id as string,
      at: l.created_at as string,
      event: l.event as string,
      method: l.method as string,
      success: !!l.success,
      reason: (l.reason ?? null) as string | null,
      employee: names.get(l.user_id) ?? l.email ?? "—",
    }));
  });
