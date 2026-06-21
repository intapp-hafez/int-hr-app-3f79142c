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

export const listLeaveBalancesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListBalancesSchema.parse(i))
  .handler(async ({ data, context }): Promise<ListBalancesResult> => {
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
        .or(`full_name.ilike.%${term}%,id.ilike.${term}%`)
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