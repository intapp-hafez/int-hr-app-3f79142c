import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

export type PermissionStatus = "pending" | "approved" | "rejected" | "cancelled";

export type PermissionRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_name_ar?: string | null;
  employee_code?: string | null;
  employee_email?: string | null;
  employee_avatar?: string | null;
  department?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  reason: string;
  status: PermissionStatus;
  decision_by?: string | null;
  decision_by_name?: string | null;
  decision_at?: string | null;
  decision_note?: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyPermissionQuota = {
  yearMonth: string;
  maxHours: number;
  maxRequests: number;
  maxHoursPerRequest: number;
  usedHours: number;
  pendingHours: number;
  remainingHours: number;
  usedCount: number;
  remainingCount: number;
  canRequest: boolean;
};

const MAX_MONTHLY_HOURS = 4.0;
const MAX_MONTHLY_REQUESTS = 2;
const MAX_HOURS_PER_REQUEST = 2.0;

function getMonthDateRange(yearMonth?: string) {
  const ym = yearMonth && /^\d{4}-\d{2}$/.test(yearMonth) ? yearMonth : new Date().toISOString().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { yearMonth: ym, start, end };
}

// ── List all permissions (Admin / HR view) ──────────
export const listPermissionsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "rejected", "cancelled"]).optional().default("all"),
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        search: z.string().optional().default(""),
        employee_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let query = (context.supabase as any)
      .from("employee_permissions")
      .select(`
        *,
        profile:employee_id (
          id, full_name, full_name_ar, emp_code, email, avatar_url,
          department:departments!profiles_department_id_fkey(name_en)
        ),
        decider:decision_by (
          id, full_name
        )
      `)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.employee_id) {
      query = query.eq("employee_id", data.employee_id);
    }

    if (data.month) {
      const { start, end } = getMonthDateRange(data.month);
      query = query.gte("date", start).lte("date", end);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error("[listPermissionsAdmin] Query error:", error);
      if (error.code === "42P01" || error.message?.includes("does not exist")) return [];
      throw new Error(error.message);
    }

    let results: PermissionRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      employee_id: r.employee_id,
      employee_name: r.profile?.full_name ?? r.profile?.email ?? "Unknown",
      employee_name_ar: r.profile?.full_name_ar ?? null,
      employee_code: r.profile?.emp_code ?? null,
      employee_email: r.profile?.email ?? null,
      employee_avatar: r.profile?.avatar_url ?? null,
      department: r.profile?.department?.name_en ?? null,
      date: r.date,
      start_time: r.start_time?.slice(0, 5) ?? r.start_time,
      end_time: r.end_time?.slice(0, 5) ?? r.end_time,
      duration_hours: Number(r.duration_hours),
      reason: r.reason,
      status: r.status as PermissionStatus,
      decision_by: r.decision_by,
      decision_by_name: r.decider?.full_name ?? null,
      decision_at: r.decision_at,
      decision_note: r.decision_note,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    if (data.search?.trim()) {
      const q = data.search.trim().toLowerCase();
      results = results.filter(
        (r) =>
          r.employee_name.toLowerCase().includes(q) ||
          (r.employee_code && r.employee_code.toLowerCase().includes(q)) ||
          r.reason.toLowerCase().includes(q) ||
          (r.department && r.department.toLowerCase().includes(q)),
      );
    }

    return results;
  });

// ── List permissions & calculate monthly quota for a specific employee ──
export const listEmployeePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        employee_id: z.string().uuid().optional(),
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const targetId = data.employee_id || context.userId;
    const { yearMonth, start, end } = getMonthDateRange(data.month);

    const { data: rows, error } = await (context.supabase as any)
      .from("employee_permissions")
      .select(`
        *,
        profile:employee_id (
          id, full_name, full_name_ar, emp_code, email, avatar_url,
          department:departments!profiles_department_id_fkey(name_en)
        ),
        decider:decision_by (
          id, full_name
        )
      `)
      .eq("employee_id", targetId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[listEmployeePermissions] Query error:", error);
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          permissions: [],
          quota: {
            yearMonth,
            maxHours: MAX_MONTHLY_HOURS,
            maxRequests: MAX_MONTHLY_REQUESTS,
            maxHoursPerRequest: MAX_HOURS_PER_REQUEST,
            usedHours: 0,
            pendingHours: 0,
            remainingHours: MAX_MONTHLY_HOURS,
            usedCount: 0,
            remainingCount: MAX_MONTHLY_REQUESTS,
            canRequest: true,
          },
        };
      }
      throw new Error(error.message);
    }

    const permissions: PermissionRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      employee_id: r.employee_id,
      employee_name: r.profile?.full_name ?? r.profile?.email ?? "Unknown",
      employee_name_ar: r.profile?.full_name_ar ?? null,
      employee_code: r.profile?.emp_code ?? null,
      employee_email: r.profile?.email ?? null,
      employee_avatar: r.profile?.avatar_url ?? null,
      department: r.profile?.department?.name_en ?? null,
      date: r.date,
      start_time: r.start_time?.slice(0, 5) ?? r.start_time,
      end_time: r.end_time?.slice(0, 5) ?? r.end_time,
      duration_hours: Number(r.duration_hours),
      reason: r.reason,
      status: r.status as PermissionStatus,
      decision_by: r.decision_by,
      decision_by_name: r.decider?.full_name ?? null,
      decision_at: r.decision_at,
      decision_note: r.decision_note,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    // Calculate quota usage for the requested month
    const monthRequests = permissions.filter(
      (p) => p.date >= start && p.date <= end && (p.status === "approved" || p.status === "pending"),
    );

    let usedHours = 0;
    let pendingHours = 0;
    monthRequests.forEach((p) => {
      if (p.status === "approved") usedHours += p.duration_hours;
      else if (p.status === "pending") pendingHours += p.duration_hours;
    });

    const usedCount = monthRequests.length;
    const totalCommittedHours = usedHours + pendingHours;
    const remainingHours = Math.max(0, MAX_MONTHLY_HOURS - totalCommittedHours);
    const remainingCount = Math.max(0, MAX_MONTHLY_REQUESTS - usedCount);
    const canRequest = remainingCount > 0 && remainingHours > 0;

    const quota: MonthlyPermissionQuota = {
      yearMonth,
      maxHours: MAX_MONTHLY_HOURS,
      maxRequests: MAX_MONTHLY_REQUESTS,
      maxHoursPerRequest: MAX_HOURS_PER_REQUEST,
      usedHours,
      pendingHours,
      remainingHours,
      usedCount,
      remainingCount,
      canRequest,
    };

    return { permissions, quota };
  });

// ── Submit Permission Request (with policy enforcement) ──
export const requestPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        employee_id: z.string().uuid().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        start_time: z.string().min(4).max(8),
        end_time: z.string().min(4).max(8),
        duration_hours: z.number().min(0.25).max(2.0, "Each request can be at most 2 hours"),
        reason: z.string().trim().min(3, "Reason required (min 3 chars)").max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const targetEmpId = data.employee_id || context.userId;

    // Verify authority if requesting on behalf of someone else
    if (targetEmpId !== context.userId) {
      const { data: roles } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const isAdminOrHr = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "hr");
      if (!isAdminOrHr) throw new Error("Only Admin or HR can submit permissions for other employees.");
    }

    // Policy Check: duration max 2 hours
    if (data.duration_hours > MAX_HOURS_PER_REQUEST) {
      throw new Error(`Policy violation: A permission request cannot exceed ${MAX_HOURS_PER_REQUEST} hours.`);
    }

    // Month boundary for the requested date
    const reqYearMonth = data.date.slice(0, 7);
    const { start, end } = getMonthDateRange(reqYearMonth);

    // Query active requests in this calendar month
    const { data: existing, error: queryErr } = await (context.supabase as any)
      .from("employee_permissions")
      .select("id, duration_hours, status")
      .eq("employee_id", targetEmpId)
      .gte("date", start)
      .lte("date", end)
      .in("status", ["pending", "approved"]);

    if (queryErr) throw new Error(queryErr.message);

    const activeList = existing ?? [];

    // Check count limit (max 2 per month)
    if (activeList.length >= MAX_MONTHLY_REQUESTS) {
      throw new Error(
        `Policy violation: Maximum monthly permission requests reached (${MAX_MONTHLY_REQUESTS} requests per month).`,
      );
    }

    // Check hour quota limit (max 4 hours per month)
    const currentMonthHours = activeList.reduce((sum: number, r: any) => sum + Number(r.duration_hours || 0), 0);
    const newTotalHours = currentMonthHours + data.duration_hours;
    if (newTotalHours > MAX_MONTHLY_HOURS) {
      const remaining = Math.max(0, MAX_MONTHLY_HOURS - currentMonthHours);
      throw new Error(
        `Policy violation: Total hours would exceed monthly limit of ${MAX_MONTHLY_HOURS} hours. You have ${remaining.toFixed(1)} hours remaining for this month.`,
      );
    }

    // Insert permission
    const { data: inserted, error: insertErr } = await (context.supabase as any)
      .from("employee_permissions")
      .insert({
        employee_id: targetEmpId,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        duration_hours: data.duration_hours,
        reason: data.reason,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);
    return { ok: true, permission: inserted };
  });

// ── Decide Permission (Approve / Reject) (Admin/HR only) ──
export const decidePermission = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        decision_note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error, data: updated } = await (context.supabase as any)
      .from("employee_permissions")
      .update({
        status: data.status,
        decision_by: context.userId,
        decision_at: new Date().toISOString(),
        decision_note: data.decision_note?.trim() || null,
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, permission: updated };
  });

// ── Cancel Permission ───────────────────────────────
export const cancelPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: existing, error: findErr } = await (context.supabase as any)
      .from("employee_permissions")
      .select("employee_id, status")
      .eq("id", data.id)
      .single();

    if (findErr || !existing) throw new Error("Permission request not found");

    if (existing.status !== "pending") {
      throw new Error("Only pending permission requests can be cancelled.");
    }

    if (existing.employee_id !== context.userId) {
      const { data: roles } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const isAdminOrHr = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "hr");
      if (!isAdminOrHr) throw new Error("Forbidden: You cannot cancel another employee's permission.");
    }

    const { error: updErr } = await (context.supabase as any)
      .from("employee_permissions")
      .update({ status: "cancelled" })
      .eq("id", data.id);

    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
