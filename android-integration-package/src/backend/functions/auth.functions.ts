import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["admin", "hr", "finance", "manager", "employee", "staff", "user"]);

type AuditRow = {
  actor_id: string;
  actor_email: string | null;
  target_id: string;
  target_email: string | null;
  target_name: string | null;
  role: string;
  action: "assign" | "remove";
  batch_id: string | null;
  ok: boolean;
  error: string | null;
};

async function insertRoleAudit(rows: AuditRow[]) {
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("role_audit").insert(rows);
}

async function fetchTargetInfo(supabase: any, ids: string[]) {
  if (ids.length === 0) return new Map<string, { email: string | null; full_name: string | null }>();
  const { data } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
  const m = new Map<string, { email: string | null; full_name: string | null }>();
  for (const r of (data ?? []) as any[]) m.set(r.id, { email: r.email ?? null, full_name: r.full_name ?? null });
  return m;
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return { profile, roles: (roles ?? []).map((r) => r.role) };
  });

export type MyProfileDetails = {
  id: string;
  emp_code: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  national_id: string | null;
  department: string | null;
  position: string | null;
  manager: string | null;
  salary_mode: string | null;
  salary_amount: number | null;
  contract_type: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_remaining_days: number | null;
};

export const getMyProfileDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfileDetails | null> => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("profiles")
      .select("id, emp_code, full_name, phone, email, national_id, department_id, position_id, manager_id, salary_mode, salary_gross, salary_net, contract_type, contract_start_date, contract_end_date, contract_cancelled")
      .eq("id", userId)
      .maybeSingle();
    if (!p) return null;
    const [{ data: dept }, { data: pos }, { data: mgr }] = await Promise.all([
      p.department_id
        ? supabase.from("departments").select("name_en").eq("id", p.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
      p.position_id
        ? supabase.from("positions").select("name_en").eq("id", p.position_id).maybeSingle()
        : Promise.resolve({ data: null }),
      p.manager_id
        ? supabase.from("profiles").select("full_name").eq("id", p.manager_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const salaryAmount = p.salary_mode === "net"
      ? (p.salary_net ?? null)
      : (p.salary_gross ?? p.salary_net ?? null);
    let remaining: number | null = null;
    if (p.contract_end_date && !p.contract_cancelled) {
      const end = new Date(p.contract_end_date).getTime();
      const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
      remaining = Math.round((end - today) / 86_400_000);
    }
    return {
      id: p.id,
      emp_code: p.emp_code ?? null,
      full_name: p.full_name ?? null,
      phone: p.phone ?? null,
      email: p.email ?? null,
      national_id: p.national_id ?? null,
      department: (dept as { name_en?: string } | null)?.name_en ?? null,
      position: (pos as { name_en?: string } | null)?.name_en ?? null,
      manager: (mgr as { full_name?: string } | null)?.full_name ?? null,
      salary_mode: p.salary_mode ?? null,
      salary_amount: salaryAmount != null ? Number(salaryAmount) : null,
      contract_type: p.contract_type ?? null,
      contract_start_date: p.contract_start_date ?? null,
      contract_end_date: p.contract_end_date ?? null,
      contract_remaining_days: remaining,
    };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can manage roles");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetIsAdmin } = await context.supabase.rpc("has_role", {
      _user_id: data.user_id,
      _role: "admin",
    });
    if (targetIsAdmin) throw new Error("Cannot modify roles of an admin account");
    const { error } = await (supabaseAdmin as any).from("user_roles").upsert(
      { user_id: data.user_id, role: data.role },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
    const info = await fetchTargetInfo(context.supabase, [data.user_id]);
    const t = info.get(data.user_id);
    const { data: me } = await context.supabase.from("profiles").select("email").eq("id", context.userId).maybeSingle();
    await insertRoleAudit([{
      actor_id: context.userId,
      actor_email: (me as any)?.email ?? null,
      target_id: data.user_id,
      target_email: t?.email ?? null,
      target_name: t?.full_name ?? null,
      role: data.role,
      action: "assign",
      batch_id: null,
      ok: true,
      error: null,
    }]);
    return { ok: true };
  });

export const removeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can manage roles");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetIsAdmin } = await context.supabase.rpc("has_role", {
      _user_id: data.user_id,
      _role: "admin",
    });
    if (targetIsAdmin) throw new Error("Cannot modify roles of an admin account");
    const { error } = await (supabaseAdmin as any).from("user_roles")
      .delete().eq("user_id", data.user_id).eq("role", data.role);
    if (error) throw new Error(error.message);
    const info = await fetchTargetInfo(context.supabase, [data.user_id]);
    const t = info.get(data.user_id);
    const { data: me } = await context.supabase.from("profiles").select("email").eq("id", context.userId).maybeSingle();
    await insertRoleAudit([{
      actor_id: context.userId,
      actor_email: (me as any)?.email ?? null,
      target_id: data.user_id,
      target_email: t?.email ?? null,
      target_name: t?.full_name ?? null,
      role: data.role,
      action: "remove",
      batch_id: null,
      ok: true,
      error: null,
    }]);
    return { ok: true };
  });

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email").order("full_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pe) throw new Error(pe.message);
    if (re) throw new Error(re.message);
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

const BulkSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(500),
  role: RoleSchema,
  action: z.enum(["assign", "remove"]),
});

export type BulkRoleResult = {
  batch_id: string;
  action: "assign" | "remove";
  role: string;
  succeeded: string[];
  skipped: Array<{ user_id: string; reason: string }>;
};

export const bulkChangeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => BulkSchema.parse(i))
  .handler(async ({ data, context }): Promise<BulkRoleResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can manage roles");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // detect admin targets and skip them
    const { data: adminRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .in("user_id", data.user_ids);
    const adminSet = new Set((adminRows ?? []).map((r: any) => r.user_id as string));
    const info = await fetchTargetInfo(context.supabase, data.user_ids);
    const { data: me } = await context.supabase.from("profiles").select("email").eq("id", context.userId).maybeSingle();
    const actorEmail = (me as any)?.email ?? null;
    const batchId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as string;

    const succeeded: string[] = [];
    const skipped: Array<{ user_id: string; reason: string }> = [];
    const auditRows: AuditRow[] = [];

    const targets = data.user_ids.filter((id) => {
      if (adminSet.has(id)) { skipped.push({ user_id: id, reason: "admin account" }); return false; }
      return true;
    });

    if (data.action === "assign") {
      if (targets.length > 0) {
        const rows = targets.map((id) => ({ user_id: id, role: data.role }));
        const { error } = await supabaseAdmin.from("user_roles").upsert(rows as never, { onConflict: "user_id,role" });
        if (error) throw new Error(error.message);
      }
      for (const id of targets) succeeded.push(id);
    } else {
      if (targets.length > 0) {
        const { error } = await (supabaseAdmin as any)
          .from("user_roles")
          .delete()
          .eq("role", data.role)
          .in("user_id", targets);
        if (error) throw new Error(error.message);
      }
      for (const id of targets) succeeded.push(id);
    }

    for (const id of succeeded) {
      const t = info.get(id);
      auditRows.push({
        actor_id: context.userId,
        actor_email: actorEmail,
        target_id: id,
        target_email: t?.email ?? null,
        target_name: t?.full_name ?? null,
        role: data.role,
        action: data.action,
        batch_id: batchId,
        ok: true,
        error: null,
      });
    }
    for (const s of skipped) {
      const t = info.get(s.user_id);
      auditRows.push({
        actor_id: context.userId,
        actor_email: actorEmail,
        target_id: s.user_id,
        target_email: t?.email ?? null,
        target_name: t?.full_name ?? null,
        role: data.role,
        action: data.action,
        batch_id: batchId,
        ok: false,
        error: s.reason,
      });
    }
    await insertRoleAudit(auditRows);
    return { batch_id: batchId, action: data.action, role: data.role, succeeded, skipped };
  });

export type RoleAuditEntry = {
  id: string;
  created_at: string;
  actor_email: string | null;
  target_id: string;
  target_email: string | null;
  target_name: string | null;
  role: string;
  action: "assign" | "remove";
  batch_id: string | null;
  ok: boolean;
  error: string | null;
};

export const listRoleAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ limit: z.number().int().min(1).max(200).optional() }).optional().parse(i))
  .handler(async ({ data, context }): Promise<RoleAuditEntry[]> => {
    const limit = data?.limit ?? 50;
    const { data: rows, error } = await (context.supabase as any)
      .from("role_audit")
      .select("id, created_at, actor_email, target_id, target_email, target_name, role, action, batch_id, ok, error")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      // Table might not exist yet — return empty list rather than crash the UI
      if (/relation .*role_audit.* does not exist/i.test(error.message)) return [];
      throw new Error(error.message);
    }
    return ((rows ?? []) as unknown) as RoleAuditEntry[];
  });