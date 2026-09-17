import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { z } from "zod";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  dept: string;
  branch: string;
  status: "Active" | "Inactive";
  avatarUrl: string | null;
};

export type GetMyTeamResult = { rows: TeamMember[]; total: number };

export async function resolveTeamMemberScope(supabase: any, userId: string) {
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (userRoles ?? []).map((r: any) => String(r.role).toLowerCase());
  const isAdmin = roles.includes("admin") || roles.includes("hr");

  if (isAdmin) {
    return { isAdmin: true, filterConditions: null as string[] | null };
  }

  const [{ data: myProfile }, { data: managedDepts }] = await Promise.all([
    supabase.from("profiles").select("id, department_id").eq("id", userId).maybeSingle(),
    supabase.from("departments").select("id").eq("responsible_person_id", userId),
  ]);

  const managedDeptIds = (managedDepts ?? []).map((d: any) => d.id as string).filter(Boolean);
  const conditions: string[] = [`manager_id.eq.${userId}`];

  if (managedDeptIds.length > 0) {
    conditions.push(`department_id.in.(${managedDeptIds.join(",")})`);
  }
  if (myProfile?.department_id) {
    conditions.push(`department_id.eq.${myProfile.department_id}`);
  }

  return {
    isAdmin: false,
    filterConditions: conditions,
    myProfile,
    managedDeptIds,
  };
}

export async function getTeamMemberIds(supabase: any, userId: string): Promise<{ isAdmin: boolean; ids: string[] }> {
  const scope = await resolveTeamMemberScope(supabase, userId);
  if (scope.isAdmin) {
    return { isAdmin: true, ids: [] };
  }
  let q = supabase
    .from("profiles")
    .select("id")
    .neq("id", userId);
  if (scope.filterConditions && scope.filterConditions.length > 0) {
    q = q.or(scope.filterConditions.join(","));
  }
  const { data } = await q;
  const ids = (data ?? []).map((r: any) => r.id as string).filter(Boolean);
  return { isAdmin: false, ids };
}

export const getMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        q: z.string().max(120).optional().default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<GetMyTeamResult> => {
    const { supabase, userId } = context;
    const scope = await resolveTeamMemberScope(supabase, userId);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, status, avatar_url, department_id, position_id, city",
        { count: "exact" },
      )
      .neq("id", userId)
      .order("full_name", { ascending: true });

    if (!scope.isAdmin && scope.filterConditions && scope.filterConditions.length > 0) {
      q = q.or(scope.filterConditions.join(","));
    }

    const term = data.q.trim();
    if (term) {
      const esc = term.replace(/[%,]/g, " ");
      q = q.or(`full_name.ilike.%${esc}%,email.ilike.%${esc}%`);
    }

    q = q.range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    const reports = rows ?? [];
    if (reports.length === 0) return { rows: [], total: count ?? 0 };

    const deptIds = Array.from(
      new Set(reports.map((r: any) => r.department_id).filter(Boolean)),
    ) as string[];
    const posIds = Array.from(
      new Set(reports.map((r: any) => r.position_id).filter(Boolean)),
    ) as string[];

    const [{ data: depts }, { data: positions }] = await Promise.all([
      deptIds.length
        ? supabase.from("departments").select("id, name_en").in("id", deptIds)
        : Promise.resolve({ data: [] as any[] }),
      posIds.length
        ? supabase.from("positions").select("id, name_en").in("id", posIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const deptMap = new Map<string, string>(
      (depts ?? []).map((d: any) => [d.id, d.name_en ?? ""]),
    );
    const posMap = new Map<string, string>(
      (positions ?? []).map((p: any) => [p.id, p.name_en ?? ""]),
    );

    const mapped = reports.map((r: any): TeamMember => ({
      id: r.id,
      name: r.full_name ?? r.email ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      role: posMap.get(r.position_id) ?? "",
      dept: deptMap.get(r.department_id) ?? "",
      branch: r.city ?? "",
      status: r.status === "Inactive" ? "Inactive" : "Active",
      avatarUrl: r.avatar_url ?? null,
    }));
    return { rows: mapped, total: count ?? mapped.length };
  });

export type AssignmentCheck =
  | { ok: true; employeeId: string; managerId: string; managerIsMe: true }
  | { ok: false; reason: "not-found" | "no-manager" | "different-manager"; managerId?: string; myId: string; email: string };

export const checkEmployeeAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(160) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<AssignmentCheck> => {
    const { supabase, userId } = context;
    const email = data.email.trim().toLowerCase();
    const { data: row, error } = await supabase
      .from("profiles")
      .select("id, manager_id, department_id")
      .ilike("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, reason: "not-found", myId: userId, email };
    const managerId = (row as any).manager_id as string | null;
    if (managerId === userId) {
      return { ok: true, employeeId: (row as any).id, managerId: userId, managerIsMe: true };
    }
    const [{ data: myProfile }, { data: managedDepts }] = await Promise.all([
      supabase.from("profiles").select("department_id").eq("id", userId).maybeSingle(),
      supabase.from("departments").select("id").eq("responsible_person_id", userId),
    ]);
    const managedDeptIds = (managedDepts ?? []).map((d: any) => d.id);
    if (
      (row as any).department_id &&
      (managedDeptIds.includes((row as any).department_id) || (myProfile?.department_id && myProfile.department_id === (row as any).department_id))
    ) {
      return { ok: true, employeeId: (row as any).id, managerId: userId, managerIsMe: true };
    }
    if (!managerId) return { ok: false, reason: "no-manager", myId: userId, email };
    return { ok: false, reason: "different-manager", managerId, myId: userId, email };
  });

export type TeamPresence = { presentIds: string[]; from: string; to: string };

export const getTeamPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<TeamPresence> => {
    const { supabase, userId } = context;
    const scope = await resolveTeamMemberScope(supabase, userId);
    let q = supabase.from("profiles").select("id").neq("id", userId);
    if (!scope.isAdmin && scope.filterConditions && scope.filterConditions.length > 0) {
      q = q.or(scope.filterConditions.join(","));
    }
    const { data: team, error: te } = await q;
    if (te) throw new Error(te.message);
    const ids = (team ?? []).map((r: any) => r.id as string);
    if (ids.length === 0) return { presentIds: [], from: data.from, to: data.to };
    const { data: att, error } = await supabase
      .from("attendance")
      .select("employee_id, status, date")
      .in("employee_id", ids)
      .gte("date", data.from)
      .lte("date", data.to)
      .in("status", ["present", "late"]);
    if (error) throw new Error(error.message);
    const present = new Set<string>();
    for (const a of att ?? []) present.add((a as any).employee_id);
    return { presentIds: Array.from(present), from: data.from, to: data.to };
  });

export type ReassignResult = {
  ok: true;
  employeeId: string;
  previousManagerId: string | null;
  newManagerId: string | null;
};

export const reassignEmployeeManager = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        employeeId: z.string().uuid(),
        newManagerId: z.string().uuid().nullable(),
        reason: z.string().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ReassignResult> => {
    const { supabase, userId } = context;
    const { data: current, error: ce } = await supabase
      .from("profiles")
      .select("id, manager_id, full_name, email")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (ce) throw new Error(ce.message);
    if (!current) throw new Error("Employee not found");
    const previousManagerId = ((current as any).manager_id as string | null) ?? null;
    if (previousManagerId === data.newManagerId) {
      return { ok: true, employeeId: data.employeeId, previousManagerId, newManagerId: data.newManagerId };
    }
    if (data.newManagerId && data.newManagerId === data.employeeId) {
      throw new Error("An employee cannot be their own manager");
    }
    const { error: ue } = await supabase
      .from("profiles")
      .update({ manager_id: data.newManagerId })
      .eq("id", data.employeeId);
    if (ue) throw new Error(ue.message);
    // Durable change history (read by admins/HR)
    const { error: he } = await supabase.from("manager_assignment_history").insert({
      employee_id: data.employeeId,
      previous_manager_id: previousManagerId,
      new_manager_id: data.newManagerId,
      changed_by: userId,
      reason: data.reason ?? null,
    });
    if (he) {
      // surface a clear error so admins know history wasn't recorded
      throw new Error(`Reassigned but history not recorded: ${he.message}`);
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("security_audit_events").insert({
        kind: "manager_reassigned",
        severity: "info",
        detail: {
          employee_id: data.employeeId,
          employee_email: (current as any).email ?? null,
          employee_name: (current as any).full_name ?? null,
          previous_manager_id: previousManagerId,
          new_manager_id: data.newManagerId,
          changed_by: userId,
          reason: data.reason ?? null,
        },
      });
    } catch {
      // audit log is best-effort; do not block the update
    }
    return { ok: true, employeeId: data.employeeId, previousManagerId, newManagerId: data.newManagerId };
  });

export type AdminProfileRow = {
  id: string;
  fullName: string;
  email: string;
  managerId: string | null;
};

export const listProfilesForAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({ q: z.string().max(120).optional().default("") }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<AdminProfileRow[]> => {
    const { supabase } = context;
    let q = supabase
      .from("profiles")
      .select("id, full_name, email, manager_id")
      .order("full_name", { ascending: true })
      .limit(500);
    const term = data.q.trim();
    if (term) {
      const esc = term.replace(/[%,]/g, " ");
      q = q.or(`full_name.ilike.%${esc}%,email.ilike.%${esc}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      fullName: r.full_name ?? "",
      email: r.email ?? "",
      managerId: r.manager_id ?? null,
    }));
  });

export type ManagerHistoryRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  previousManagerId: string | null;
  previousManagerName: string | null;
  newManagerId: string | null;
  newManagerName: string | null;
  changedById: string | null;
  changedByName: string | null;
  reason: string | null;
  createdAt: string;
};

export const listManagerAssignmentHistory = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      employeeId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<ManagerHistoryRow[]> => {
    const { supabase } = context;
    let q = supabase
      .from("manager_assignment_history")
      .select("id, employee_id, previous_manager_id, new_manager_id, changed_by, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.employeeId) q = q.eq("employee_id", data.employeeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    if (list.length === 0) return [];
    const ids = new Set<string>();
    for (const r of list) {
      if (r.employee_id) ids.add(r.employee_id);
      if (r.previous_manager_id) ids.add(r.previous_manager_id);
      if (r.new_manager_id) ids.add(r.new_manager_id);
      if (r.changed_by) ids.add(r.changed_by);
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", Array.from(ids));
    const nameMap = new Map<string, string>();
    for (const p of (profs ?? []) as any[]) nameMap.set(p.id, p.full_name || p.email || p.id);
    return list.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: nameMap.get(r.employee_id) ?? r.employee_id,
      previousManagerId: r.previous_manager_id,
      previousManagerName: r.previous_manager_id ? nameMap.get(r.previous_manager_id) ?? null : null,
      newManagerId: r.new_manager_id,
      newManagerName: r.new_manager_id ? nameMap.get(r.new_manager_id) ?? null : null,
      changedById: r.changed_by,
      changedByName: r.changed_by ? nameMap.get(r.changed_by) ?? null : null,
      reason: r.reason,
      createdAt: r.created_at,
    }));
  });