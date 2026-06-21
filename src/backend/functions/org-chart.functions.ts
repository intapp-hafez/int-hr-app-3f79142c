import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess, requireAdminRole } from "@/integrations/supabase/admin-auth-middleware";

export type OrgPerson = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  positionId: string | null;
  positionName: string | null;
  managerId: string | null;
  status: string | null;
};

export type OrgDept = {
  id: string;
  name: string;
  head: OrgPerson | null;
  positions: { id: string; name: string; people: OrgPerson[] }[];
  unassigned: OrgPerson[];
  total: number;
};

export type OrgChart = {
  ceo: OrgPerson | null;
  departments: OrgDept[];
  unassigned: OrgPerson[];
  totals: { employees: number; departments: number; positions: number };
};

export const getOrgChart = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<OrgChart> => {
    const sb = context.supabase;
    const [{ data: depts }, { data: positions }, { data: profiles }] = await Promise.all([
      sb.from("departments").select("id, name_en, name_ar, sort_order").order("sort_order").order("name_en"),
      sb.from("positions").select("id, name_en, name_ar, sort_order").order("sort_order").order("name_en"),
      sb
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url, department_id, position_id, manager_id, status")
        .order("full_name", { ascending: true })
        .limit(2000),
    ]);

    const posMap = new Map<string, string>(
      (positions ?? []).map((p: any) => [p.id, p.name_en ?? p.name_ar ?? ""]),
    );
    const deptList = (depts ?? []).map((d: any) => ({
      id: d.id as string,
      name: (d.name_en ?? d.name_ar ?? "Department") as string,
    }));

    const allPeople: OrgPerson[] = (profiles ?? [])
      .filter((p: any) => p.status !== "Inactive")
      .map((p: any) => ({
        id: p.id,
        name: p.full_name ?? p.email ?? "—",
        email: p.email ?? null,
        phone: p.phone ?? null,
        avatarUrl: p.avatar_url ?? null,
        positionId: p.position_id ?? null,
        positionName: p.position_id ? posMap.get(p.position_id) ?? null : null,
        managerId: p.manager_id ?? null,
        status: p.status ?? "Active",
      }));

    // Group by dept
    const byDept = new Map<string | null, OrgPerson[]>();
    for (const pr of profiles ?? []) {
      if ((pr as any).status === "Inactive") continue;
      const dId = (pr as any).department_id ?? null;
      const person = allPeople.find((x) => x.id === (pr as any).id)!;
      const arr = byDept.get(dId) ?? [];
      arr.push(person);
      byDept.set(dId, arr);
    }

    // Heuristic: CEO = profile with no manager_id and most reports
    const reportCounts = new Map<string, number>();
    for (const p of allPeople) {
      if (p.managerId) reportCounts.set(p.managerId, (reportCounts.get(p.managerId) ?? 0) + 1);
    }
    let ceo: OrgPerson | null = null;
    let ceoScore = -1;
    for (const p of allPeople) {
      if (p.managerId) continue;
      const s = reportCounts.get(p.id) ?? 0;
      if (s > ceoScore) { ceo = p; ceoScore = s; }
    }

    const departments: OrgDept[] = deptList.map((d) => {
      const people = byDept.get(d.id) ?? [];
      // Department head: person in dept with most direct reports within dept (or none)
      let head: OrgPerson | null = null;
      let bestScore = -1;
      for (const p of people) {
        const score = people.filter((x) => x.managerId === p.id).length;
        if (score > bestScore) { bestScore = score; head = p; }
      }
      // Group remaining by position
      const rest = people.filter((p) => p.id !== head?.id);
      const byPos = new Map<string, OrgPerson[]>();
      const unassigned: OrgPerson[] = [];
      for (const p of rest) {
        if (p.positionId) {
          const arr = byPos.get(p.positionId) ?? [];
          arr.push(p);
          byPos.set(p.positionId, arr);
        } else unassigned.push(p);
      }
      const posArr = Array.from(byPos.entries())
        .map(([pid, ppl]) => ({
          id: pid,
          name: posMap.get(pid) ?? "Position",
          people: ppl,
        }))
        .filter((pg) => pg.people.length > 0)
        .sort((a, b) => {
          const ai = (positions ?? []).findIndex((x: any) => x.id === a.id);
          const bi = (positions ?? []).findIndex((x: any) => x.id === b.id);
          return ai - bi;
        });
      return {
        id: d.id,
        name: d.name,
        head,
        positions: posArr,
        unassigned,
        total: people.length,
      };
    }).filter((d) => d.total > 0);

    const usedPositionIds = new Set(
      departments.flatMap((d) => d.positions.map((p) => p.id)),
    );

    return {
      ceo,
      departments,
      unassigned: byDept.get(null) ?? [],
      totals: {
        employees: allPeople.length,
        departments: departments.length,
        positions: usedPositionIds.size,
      },
    };
  });

// ---------------- Admin mutations (edit mode) ----------------

export const renameDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { id: string; name: string }) => d)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const { error } = await context.supabase
      .from("departments")
      .update({ name_en: name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renamePosition = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { id: string; name: string }) => d)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const { error } = await context.supabase
      .from("positions")
      .update({ name_en: name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const { data: last } = await context.supabase
      .from("departments").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const next = ((last?.sort_order ?? 0) as number) + 10;
    const { data: row, error } = await context.supabase
      .from("departments")
      .insert({ name_en: name, sort_order: next, active: true })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const createPosition = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const { data: last } = await context.supabase
      .from("positions").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const next = ((last?.sort_order ?? 0) as number) + 10;
    const { data: row, error } = await context.supabase
      .from("positions")
      .insert({ name_en: name, sort_order: next, active: true })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("profiles").select("id", { count: "exact", head: true }).eq("department_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Department has employees; reassign them first.");
    const { error } = await context.supabase.from("departments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePosition = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("profiles").select("id", { count: "exact", head: true }).eq("position_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Position has employees; reassign them first.");
    const { error } = await context.supabase.from("positions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderDepartments = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { orderedIds: string[] }) => d)
  .handler(async ({ data, context }) => {
    const updates = data.orderedIds.map((id, i) =>
      context.supabase.from("departments").update({ sort_order: (i + 1) * 10 }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) throw new Error(err.error.message);
    return { ok: true };
  });

export const reorderPositions = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { orderedIds: string[] }) => d)
  .handler(async ({ data, context }) => {
    const updates = data.orderedIds.map((id, i) =>
      context.supabase.from("positions").update({ sort_order: (i + 1) * 10 }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) throw new Error(err.error.message);
    return { ok: true };
  });

export const reassignEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdminRole])
  .inputValidator((d: { employeeId: string; departmentId?: string | null; positionId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const patch: { department_id?: string | null; position_id?: string | null } = {};
    if (data.departmentId !== undefined) patch.department_id = data.departmentId;
    if (data.positionId !== undefined) patch.position_id = data.positionId;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", data.employeeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });