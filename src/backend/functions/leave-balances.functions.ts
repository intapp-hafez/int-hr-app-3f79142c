import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaveBalanceRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining: number;
};

const ListBalancesSchema = z.object({
  leave_type_id: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type ListBalancesResult = {
  rows: LeaveBalanceRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function ensureLeaveBalancesSeeded(supabase: any, year?: number) {
  try {
    const currentYear = year ?? new Date().getFullYear();
    const [{ data: activeEmployees, error: e1 }, { data: activeTypes, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("id").eq("status", "Active"),
      supabase.from("leave_types").select("id, name, annual_days").eq("active", true),
    ]);
    if (e1 || e2 || !activeEmployees?.length || !activeTypes?.length) return;

    // Fetch existing balances for this year
    const { data: existing, error: e3 } = await supabase
      .from("leave_balances")
      .select("employee_id, leave_type_id")
      .eq("year", currentYear);
    if (e3) return;

    const existingSet = new Set(
      (existing ?? []).map((e: any) => `${e.employee_id}::${e.leave_type_id}`)
    );

    const toInsert: any[] = [];
    for (const emp of activeEmployees) {
      for (const lt of activeTypes) {
        const key = `${emp.id}::${lt.id}`;
        if (!existingSet.has(key)) {
          toInsert.push({
            employee_id: emp.id,
            leave_type_id: lt.id,
            year: currentYear,
            total_days: Number(lt.annual_days) || 0,
            used_days: 0,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        await (supabase.from("leave_balances") as any).insert(chunk);
      }
    }
  } catch (err) {
    console.error("Failed to auto-seed leave balances:", err);
  }
}

export const listLeaveBalancesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListBalancesSchema.parse(i))
  .handler(async ({ data, context }): Promise<ListBalancesResult> => {
    await ensureLeaveBalancesSeeded(context.supabase);
    const page = data.page;
    const pageSize = data.pageSize;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let employeeIdFilter: string[] | null = null;
    if (data.search) {
      const term = data.search;
      const { data: matches, error: pErr } = await context.supabase
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(1000);
      if (pErr) throw new Error(pErr.message);
      employeeIdFilter = (matches ?? []).map((m: any) => m.id);
      if (employeeIdFilter.length === 0) {
        return { rows: [], total: 0, page, pageSize };
      }
    }

    let query = context.supabase
      .from("leave_balances")
      .select("id, employee_id, leave_type_id, year, total_days, used_days, profiles:employee_id(full_name), leave_types:leave_type_id(name)", { count: "exact" })
      .order("year", { ascending: false })
      .range(from, to);

    if (data.leave_type_id) {
      query = query.eq("leave_type_id", data.leave_type_id);
    }
    if (employeeIdFilter) {
      query = query.in("employee_id", employeeIdFilter);
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []).map((r: any) => ({
        id: r.id,
        employee_id: r.employee_id,
        employee_name: r.profiles?.full_name ?? "—",
        leave_type_id: r.leave_type_id,
        leave_type_name: r.leave_types?.name ?? "—",
        year: r.year,
        total_days: r.total_days,
        used_days: r.used_days,
        remaining: Math.max(0, (r.total_days ?? 0) - (r.used_days ?? 0)),
      })),
      total: count ?? 0,
      page,
      pageSize,
    };
  });

export const listMyLeaveBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeaveBalanceRow[]> => {
    const { data, error } = await context.supabase
      .from("leave_balances")
      .select("id, employee_id, leave_type_id, year, total_days, used_days, leave_types:leave_type_id(name)")
      .eq("employee_id", context.userId)
      .order("year", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      employee_id: r.employee_id,
      employee_name: "",
      leave_type_id: r.leave_type_id,
      leave_type_name: r.leave_types?.name ?? "—",
      year: r.year,
      total_days: r.total_days,
      used_days: r.used_days,
      remaining: Math.max(0, (r.total_days ?? 0) - (r.used_days ?? 0)),
    }));
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  total_days: z.number().int().min(0).max(365),
});

export const updateLeaveBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leave_balances")
      .update({ total_days: data.total_days })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  total_days: z.number().int().min(0).max(365).optional(),
  used_days: z.number().int().min(0).max(365).optional(),
}).refine((v) => v.total_days != null || v.used_days != null, { message: "Provide total_days or used_days" });

export const bulkUpdateLeaveBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => BulkUpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const patch: { total_days?: number; used_days?: number } = {};
    if (data.total_days != null) patch.total_days = data.total_days;
    if (data.used_days != null) patch.used_days = data.used_days;
    const { error } = await context.supabase
      .from("leave_balances")
      .update(patch)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });

const ExportSchema = z.object({
  leave_type_id: z.string().optional(),
  search: z.string().trim().max(120).optional(),
});

export const exportLeaveBalancesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ExportSchema.parse(i))
  .handler(async ({ data, context }): Promise<LeaveBalanceRow[]> => {
    let employeeIdFilter: string[] | null = null;
    if (data.search) {
      const term = data.search;
      const { data: matches, error: pErr } = await context.supabase
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(5000);
      if (pErr) throw new Error(pErr.message);
      employeeIdFilter = (matches ?? []).map((m: any) => m.id);
      if (employeeIdFilter.length === 0) return [];
    }
    let query = context.supabase
      .from("leave_balances")
      .select("id, employee_id, leave_type_id, year, total_days, used_days, profiles:employee_id(full_name), leave_types:leave_type_id(name)")
      .order("year", { ascending: false })
      .limit(5000);
    if (data.leave_type_id) query = query.eq("leave_type_id", data.leave_type_id);
    if (employeeIdFilter) query = query.in("employee_id", employeeIdFilter);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      employee_id: r.employee_id,
      employee_name: r.profiles?.full_name ?? "—",
      leave_type_id: r.leave_type_id,
      leave_type_name: r.leave_types?.name ?? "—",
      year: r.year,
      total_days: r.total_days,
      used_days: r.used_days,
      remaining: Math.max(0, (r.total_days ?? 0) - (r.used_days ?? 0)),
    }));
  });

function normalizeLeaveKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/leaves?$/i, "");
}

export const getEmployeeLeaveBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      employee_id: z.string().uuid(),
      year: z.number().int().optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }): Promise<LeaveBalanceRow[]> => {
    const year = data.year ?? new Date().getFullYear();

    const { data: rows, error } = await context.supabase
      .from("leave_balances")
      .select("id, employee_id, leave_type_id, year, total_days, used_days, leave_types:leave_type_id(id, name, active, annual_days)")
      .eq("employee_id", data.employee_id)
      .eq("year", year)
      .order("year", { ascending: false });

    if (error) throw new Error(error.message);

    const { data: allTypes } = await context.supabase
      .from("leave_types")
      .select("id, name, annual_days, active")
      .eq("active", true);

    const map = new Map<string, LeaveBalanceRow & { active?: boolean }>();
    const staleIdsToDelete: string[] = [];

    for (const r of (rows ?? []) as any[]) {
      const typeName = r.leave_types?.name ?? "—";
      const key = normalizeLeaveKey(typeName);
      const isActive = r.leave_types?.active !== false;

      // If this record points to a deactivated leave type with zero usage, mark as stale
      if (!isActive && (r.used_days ?? 0) === 0) {
        staleIdsToDelete.push(r.id);
        continue;
      }

      const candidate: LeaveBalanceRow & { active?: boolean } = {
        id: r.id,
        employee_id: r.employee_id,
        employee_name: "",
        leave_type_id: r.leave_type_id,
        leave_type_name: typeName,
        year: r.year,
        total_days: r.total_days ?? 0,
        used_days: r.used_days ?? 0,
        remaining: Math.max(0, (r.total_days ?? 0) - (r.used_days ?? 0)),
        active: isActive,
      };

      if (!map.has(key)) {
        map.set(key, candidate);
      } else {
        const existing = map.get(key)!;
        if (candidate.active && !existing.active) {
          candidate.used_days = Math.max(candidate.used_days, existing.used_days);
          candidate.remaining = Math.max(0, candidate.total_days - candidate.used_days);
          map.set(key, candidate);
          if (!existing.id.startsWith("virtual-") && existing.used_days === 0) {
            staleIdsToDelete.push(existing.id);
          }
        } else if (!candidate.active && existing.active) {
          if (existing.used_days === 0 && candidate.used_days > 0) {
            existing.used_days = candidate.used_days;
            existing.remaining = Math.max(0, existing.total_days - existing.used_days);
          }
          if (!candidate.id.startsWith("virtual-") && candidate.used_days === 0) {
            staleIdsToDelete.push(candidate.id);
          }
        } else {
          if (candidate.used_days > existing.used_days) {
            map.set(key, candidate);
          }
        }
      }
    }

    // Include any active leave types not yet present
    for (const lt of (allTypes ?? [])) {
      const key = normalizeLeaveKey(lt.name);
      if (!map.has(key)) {
        const defaultDays = Number((lt as any).annual_days) || 0;
        map.set(key, {
          id: `virtual-${lt.id}`,
          employee_id: data.employee_id,
          employee_name: "",
          leave_type_id: lt.id,
          leave_type_name: lt.name,
          year,
          total_days: defaultDays,
          used_days: 0,
          remaining: defaultDays,
          active: true,
        });
      }
    }

    // Clean up stale zero-usage inactive rows in background
    if (staleIdsToDelete.length > 0) {
      context.supabase.from("leave_balances").delete().in("id", staleIdsToDelete).then(() => {});
    }

    const list = Array.from(map.values()).map(({ active: _, ...rest }) => rest);
    return list.sort((a, b) => a.leave_type_name.localeCompare(b.leave_type_name));
  });

export const upsertEmployeeLeaveBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().optional(),
      employee_id: z.string().uuid(),
      leave_type_id: z.string().uuid(),
      year: z.number().int().default(() => new Date().getFullYear()),
      total_days: z.number().int().min(0).max(365),
      used_days: z.number().int().min(0).max(365).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const payload: any = {
      employee_id: data.employee_id,
      leave_type_id: data.leave_type_id,
      year: data.year,
      total_days: data.total_days,
    };
    if (data.used_days != null) {
      payload.used_days = data.used_days;
    }
    if (data.id && !data.id.startsWith("virtual-")) {
      payload.id = data.id;
    }

    const { error } = await context.supabase
      .from("leave_balances")
      .upsert(payload, { onConflict: "employee_id,leave_type_id,year" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });