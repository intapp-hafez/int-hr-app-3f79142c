import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AdvanceRequestSchema,
  AdvanceDecideSchema,
  AdvancePaymentSchema,
} from "../schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdvanceStatus =
  | "draft"
  | "pending_manager"
  | "pending_hr"
  | "pending_finance"
  | "approved_for_payment"
  | "paid"
  | "rejected"
  | "cancelled"
  | "returned";

export type EmployeeAdvance = {
  id: string;
  request_number: string;
  employee_id: string;
  requested_amount: number;
  approved_amount: number | null;
  previous_balance: number;
  total_outstanding: number | null;
  paid_amount: number;
  remaining_balance: number | null;
  installment_count: number | null;
  installment_amount: number | null;
  deduction_start_date: string | null;
  deduction_end_date: string | null;
  repayment_status: string;
  reason: string | null;
  expected_date: string | null;
  attachment_url: string | null;
  currency: string;
  status: AdvanceStatus;
  created_at: string;
  updated_at: string;
  payment_date: string | null;
  manager_decided_by: string | null;
  hr_decided_by: string | null;
  finance_decided_by: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  // joined
  employee?: { full_name: string | null; emp_code: string | null; department?: { name_en: string } | null; position?: { name_en: string } | null };
};

export type AdvanceApproval = {
  id: string;
  advance_id: string;
  approver_id: string | null;
  approval_level: "manager" | "hr" | "finance" | "system";
  action: "submitted" | "approved" | "rejected" | "returned" | "cancelled" | "paid";
  comments: string | null;
  created_at: string;
  approver?: { full_name: string | null } | null;
};

export type AdvanceInstallment = {
  id: string;
  advance_id: string;
  payroll_period: string;
  installment_amount: number;
  paid_amount: number;
  remaining_amount: number | null;
  status: "pending" | "paid" | "skipped";
  created_at: string;
};

export type AdvanceSummary = {
  previous_balance: number;
  requested_amount: number;
  total_after: number;
  active_count: number;
  last_advance_date: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function appendAuditLog(
  advanceId: string,
  approverId: string | null,
  level: "manager" | "hr" | "finance" | "system",
  action: "submitted" | "approved" | "rejected" | "returned" | "cancelled" | "paid",
  comments?: string | null,
) {
  await (supabaseAdmin as any)
    .from("employee_advance_approvals")
    .insert({
      advance_id: advanceId,
      approver_id: approverId,
      approval_level: level,
      action,
      comments: comments ?? null,
    });
}

async function getActiveOutstandingBalance(employeeId: string): Promise<number> {
  const { data } = await (supabaseAdmin as any)
    .from("employee_advances")
    .select("approved_amount, paid_amount")
    .eq("employee_id", employeeId)
    .in("status", ["approved_for_payment", "paid"])
    .eq("repayment_status", "active");

  let balance = 0;
  for (const row of (data ?? []) as any[]) {
    balance += (row.approved_amount ?? 0) - (row.paid_amount ?? 0);
  }
  return balance;
}

// ─── EMPLOYEE: Create Request ────────────────────────────────────────────────


async function notifyAdvance(userIds: string[], title: string, body: string, severity: "info" | "success" | "warning" | "danger", url: string) {
  const { notifyUsers } = await import("@/backend/server/notify.server");
  await notifyUsers({ userIds, title, body, url, severity, category: "advance" });
}

export const createAdvanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AdvanceRequestSchema.parse(i))
  .handler(async ({ data, context }) => {
    // 1. Request Period Check (15th - 20th)
    const today = new Date();
    const currentDay = today.getDate();
    if (currentDay < 15 || currentDay > 20) {
      throw new Error("Advance requests are only accepted between the 15th and 20th of the month.");
    }

    // Fetch employee profile to check probation and limits
    const { data: profile } = await (context.supabase as any)
      .from("profiles")
      .select("contract_start_date, annual_advance_limit")
      .eq("id", context.userId)
      .single();

    // 2. Probation Restriction
    if (profile?.contract_start_date) {
      const contractStart = new Date(profile.contract_start_date);
      const diffMonths = (today.getFullYear() - contractStart.getFullYear()) * 12 + (today.getMonth() - contractStart.getMonth());
      if (diffMonths < 3) {
        throw new Error("You are not eligible for an advance payment during your probation period (first 3 months).");
      }
    }

    // 3. Outstanding Balance Check
    const activeBalance = await getActiveOutstandingBalance(context.userId);
    if (activeBalance > 0) {
      throw new Error("You have an active or unpaid advance request. You must settle it before requesting a new one.");
    }

    // Check for pending requests
    const { data: pendingReqs } = await (context.supabase as any)
      .from("employee_advances")
      .select("id")
      .eq("employee_id", context.userId)
      .in("status", ["pending_manager", "pending_hr", "pending_finance", "approved_for_payment"]);
    if (pendingReqs && pendingReqs.length > 0) {
      throw new Error("You already have an active advance request in progress.");
    }

    // 4. Annual Advance Limit
    const limit = profile?.annual_advance_limit ?? 10000;
    const currentYear = today.getFullYear();
    const { data: thisYearAdvances } = await (context.supabase as any)
      .from("employee_advances")
      .select("approved_amount, requested_amount")
      .eq("employee_id", context.userId)
      .gte("created_at", `${currentYear}-01-01T00:00:00.000Z`)
      .lte("created_at", `${currentYear}-12-31T23:59:59.999Z`)
      .not("status", "in", '("rejected","cancelled","returned")');

    let usedThisYear = 0;
    for (const adv of (thisYearAdvances ?? [])) {
      usedThisYear += adv.approved_amount ?? adv.requested_amount ?? 0;
    }
    
    if (usedThisYear + data.requested_amount > limit) {
      throw new Error(`Your request exceeds your remaining annual advance limit (${limit - usedThisYear} EGP).`);
    }

    const { data: row, error } = await (context.supabase as any)
      .from("employee_advances")
      .insert({
        employee_id: context.userId,
        requested_amount: data.requested_amount,
        reason: data.reason ?? null,
        expected_date: data.expected_date ?? null,
        attachment_url: data.attachment_url ?? null,
        currency: data.currency ?? "EGP",
        status: "pending_manager",
      })
      .select("id, request_number")
      .single();
    if (error) throw new Error(error.message);

    await appendAuditLog(row.id, context.userId, "system", "submitted");
    {
      const { getManagerId, getEmployeeName } = await import("@/backend/server/notify.server");
      const [mgr, name] = await Promise.all([getManagerId(context.userId), getEmployeeName(context.userId)]);
      if (mgr) await notifyAdvance([mgr], "New advance request", `${name} requested an advance of ${data.requested_amount} ${data.currency ?? "EGP"}.`, "info", "/manager");
      await notifyAdvance([context.userId], "Advance request submitted", `Your request for ${data.requested_amount} ${data.currency ?? "EGP"} was sent to your manager.`, "info", "/employee/requests");
    }
    return { id: row.id, request_number: row.request_number };
  });

// ─── EMPLOYEE: List My Advances ──────────────────────────────────────────────

export const listMyAdvances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("employee_advances")
      .select("*")
      .eq("employee_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeAdvance[];
  });

// ─── EMPLOYEE: Cancel Request ────────────────────────────────────────────────

export const cancelMyAdvance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), comments: z.string().max(1000).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await (context.supabase as any)
      .from("employee_advances")
      .select("id, status, employee_id")
      .eq("id", data.id)
      .single();
    if (fetchErr || !row) throw new Error("Advance not found");
    if (row.employee_id !== context.userId) throw new Error("Forbidden");
    if (!["draft", "pending_manager"].includes(row.status))
      throw new Error("Only draft or pending-manager requests can be cancelled");

    const { error } = await (context.supabase as any)
      .from("employee_advances")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await appendAuditLog(data.id, context.userId, "system", "cancelled", data.comments);
    return { ok: true };
  });

// ─── MANAGER: List Team Advances ─────────────────────────────────────────────

export const listTeamAdvances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // get direct reports
    const { data: reports } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("manager_id", context.userId);
    const ids = (reports ?? []).map((r: any) => r.id);
    if (ids.length === 0) return [];

    const { data, error } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select(`
        *,
        employee:employee_id (
          full_name, emp_code,
          department:department_id(name_en),
          position:position_id(name_en)
        )
      `)
      .in("employee_id", ids)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeAdvance[];
  });

// ─── MANAGER: Decide (approve / reject / return) ─────────────────────────────

export const managerDecideAdvance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AdvanceDecideSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select("id, status, employee_id")
      .eq("id", data.id)
      .single();
    if (fetchErr || !row) throw new Error("Advance not found");
    if (row.employee_id === context.userId) throw new Error("Cannot approve your own advance");
    if (row.status !== "pending_manager") throw new Error("Advance is not pending manager approval");

    const nextStatus = data.action === "approved" ? "pending_hr"
      : data.action === "returned" ? "returned"
      : "rejected";

    const { error } = await (supabaseAdmin as any)
      .from("employee_advances")
      .update({
        status: nextStatus,
        manager_decided_by: context.userId,
        ...(data.action !== "approved" ? { rejected_by: context.userId, rejection_reason: data.comments } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await appendAuditLog(data.id, context.userId, "manager", data.action as any, data.comments);
    await notifyAdvance([row.employee_id],
      data.action === "approved" ? "Advance approved by your manager" : data.action === "returned" ? "Advance returned for changes" : "Advance rejected",
      data.action === "approved" ? "Your advance request moved to HR review." : (data.comments || "Your manager did not approve this request."),
      data.action === "approved" ? "success" : data.action === "returned" ? "warning" : "danger", "/employee/requests");
    if (data.action === "approved") {
      const { listRoleUserIds } = await import("@/backend/server/notify.server");
      await notifyAdvance(await listRoleUserIds(["hr"]), "Advance awaiting HR review", "A manager approved an advance request.", "info", "/admin/advances");
    }
    return { ok: true };
  });

// ─── HR: List Advances ───────────────────────────────────────────────────────

export const listAdvancesForHR = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(200).default(50),
  }).optional().default({}).parse(i))
  .handler(async ({ data }) => {
    let query = (supabaseAdmin as any)
      .from("employee_advances")
      .select(`
        *,
        employee:employee_id (
          full_name, emp_code,
          department:department_id(name_en),
          position:position_id(name_en)
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const from = (data.page - 1) * data.limit;
    query = query.range(from, from + data.limit - 1);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { advances: (rows ?? []) as EmployeeAdvance[], count: count ?? 0 };
  });

// ─── HR: Get Employee Advance Summary ────────────────────────────────────────

export const getEmployeeAdvanceSummary = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ employee_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<AdvanceSummary> => {
    const { data: rows } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select("approved_amount, paid_amount, requested_amount, status, created_at")
      .eq("employee_id", data.employee_id)
      .in("status", ["approved_for_payment", "paid"])
      .order("created_at", { ascending: false });

    let previous_balance = 0;
    let active_count = 0;
    let last_advance_date: string | null = null;
    for (const r of (rows ?? []) as any[]) {
      if (r.repayment_status === "active") {
        previous_balance += (r.approved_amount ?? 0) - (r.paid_amount ?? 0);
        active_count++;
      }
      if (!last_advance_date) last_advance_date = r.created_at;
    }

    return { previous_balance, requested_amount: 0, total_after: previous_balance, active_count, last_advance_date };
  });

// ─── HR: Decide ───────────────────────────────────────────────────────────────

export const hrDecideAdvance = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => AdvanceDecideSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select("id, status, employee_id")
      .eq("id", data.id)
      .single();
    if (fetchErr || !row) throw new Error("Advance not found");
    if (row.status !== "pending_hr") throw new Error("Advance is not pending HR approval");

    const nextStatus = data.action === "approved" ? "pending_finance"
      : data.action === "returned" ? "returned"
      : "rejected";

    const { error } = await (supabaseAdmin as any)
      .from("employee_advances")
      .update({
        status: nextStatus,
        hr_decided_by: context.userId,
        ...(data.action !== "approved" ? { rejected_by: context.userId, rejection_reason: data.comments } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await appendAuditLog(data.id, context.userId, "hr", data.action as any, data.comments);
    await notifyAdvance([row.employee_id],
      data.action === "approved" ? "Advance approved by HR" : data.action === "returned" ? "Advance returned by HR" : "Advance rejected by HR",
      data.action === "approved" ? "Your advance request moved to Finance for payment." : (data.comments || "HR did not approve this request."),
      data.action === "approved" ? "success" : data.action === "returned" ? "warning" : "danger", "/employee/requests");
    if (data.action === "approved") {
      const { listRoleUserIds } = await import("@/backend/server/notify.server");
      await notifyAdvance(await listRoleUserIds(["finance"]), "Advance awaiting payment approval", "HR approved an advance request.", "info", "/admin/advances");
    }
    return { ok: true };
  });

// ─── FINANCE: List Advances ───────────────────────────────────────────────────

export const listAdvancesForFinance = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({
    status: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(200).default(50),
  }).optional().default({}).parse(i))
  .handler(async ({ data }) => {
    let query = (supabaseAdmin as any)
      .from("employee_advances")
      .select(`
        *,
        employee:employee_id (
          full_name, emp_code,
          department:department_id(name_en),
          position:position_id(name_en)
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const from = (data.page - 1) * data.limit;
    query = query.range(from, from + data.limit - 1);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { advances: (rows ?? []) as EmployeeAdvance[], count: count ?? 0 };
  });

// ─── FINANCE: Get Outstanding Balance (for the balance summary panel) ─────────

export const getEmployeeOutstandingBalance = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({ employee_id: z.string().uuid(), requested_amount: z.number().positive() }).parse(i)
  )
  .handler(async ({ data }): Promise<AdvanceSummary & { requested_amount: number }> => {
    const previous_balance = await getActiveOutstandingBalance(data.employee_id);

    const { data: rows } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select("id, created_at")
      .eq("employee_id", data.employee_id)
      .in("status", ["approved_for_payment", "paid"])
      .order("created_at", { ascending: false })
      .limit(1);

    return {
      previous_balance,
      requested_amount: data.requested_amount,
      total_after: previous_balance + data.requested_amount,
      active_count: 0,
      last_advance_date: (rows ?? [])[0]?.created_at ?? null,
    };
  });

// ─── FINANCE: Approve Payment ─────────────────────────────────────────────────

export const financeApprovePayment = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => AdvancePaymentSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select("id, status, employee_id, requested_amount")
      .eq("id", data.id)
      .single();
    if (fetchErr || !row) throw new Error("Advance not found");
    if (row.status !== "pending_finance") throw new Error("Advance is not pending finance processing");

    const previousBalance = await getActiveOutstandingBalance(row.employee_id);
    const installmentAmount = parseFloat((data.approved_amount / data.installment_count).toFixed(2));

    // Calculate deduction end date (add installment_count months)
    const startDate = new Date(data.deduction_start_date);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + data.installment_count - 1);
    const deductionEndDate = endDate.toISOString().slice(0, 10);

    const { error } = await (supabaseAdmin as any)
      .from("employee_advances")
      .update({
        status: "approved_for_payment",
        approved_amount: data.approved_amount,
        previous_balance: previousBalance,
        installment_count: data.installment_count,
        installment_amount: installmentAmount,
        deduction_start_date: data.deduction_start_date,
        deduction_end_date: deductionEndDate,
        repayment_status: "active",
        finance_decided_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Create installment rows
    const installments = [];
    for (let i = 0; i < data.installment_count; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      installments.push({
        advance_id: data.id,
        payroll_period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        installment_amount: installmentAmount,
      });
    }
    const insResult = await (supabaseAdmin as any).from("employee_advance_installments").insert(installments);
    if (insResult.error) throw new Error("Failed to insert installments: " + insResult.error.message);

    await appendAuditLog(data.id, context.userId, "finance", "approved", data.comments);
    await notifyAdvance([row.employee_id], "Advance approved for payment", `Your advance will be repaid over ${data.installment_count} installment(s).`, "success", "/employee/requests");
    return { ok: true };
  });

// ─── FINANCE: Mark as Paid ────────────────────────────────────────────────────

export const financeMarkPaid = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), comments: z.string().max(1000).optional() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select("id, status, approved_amount, employee_id")
      .eq("id", data.id)
      .single();
    if (fetchErr || !row) throw new Error("Advance not found");
    if (row.status !== "approved_for_payment") throw new Error("Advance is not approved for payment");

    const { error } = await (supabaseAdmin as any)
      .from("employee_advances")
      .update({
        status: "paid",
        payment_date: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await appendAuditLog(data.id, context.userId, "finance", "paid", data.comments);
    await notifyAdvance([row.employee_id], "Advance paid", `Your advance of ${row.approved_amount ?? ""} has been paid.`, "success", "/employee/requests");
    return { ok: true };
  });

// ─── FINANCE: Reject ──────────────────────────────────────────────────────────

export const financeRejectAdvance = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), comments: z.string().max(2000).optional() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: fetchErr } = await (supabaseAdmin as any)
      .from("employee_advances")
      .select("id, status, employee_id")
      .eq("id", data.id)
      .single();
    if (fetchErr || !row) throw new Error("Advance not found");
    if (row.status !== "pending_finance") throw new Error("Advance is not pending finance");

    const { error } = await (supabaseAdmin as any)
      .from("employee_advances")
      .update({
        status: "rejected",
        rejected_by: context.userId,
        rejection_reason: data.comments ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await appendAuditLog(data.id, context.userId, "finance", "rejected", data.comments);
    await notifyAdvance([row.employee_id], "Advance rejected by Finance", data.comments || "Finance did not approve this request.", "danger", "/employee/requests");
    return { ok: true };
  });

// ─── ADMIN/ALL: Full List ─────────────────────────────────────────────────────

export const listAllAdvances = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    employee_id: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(200).default(50),
  }).optional().default({}).parse(i))
  .handler(async ({ data }) => {
    let query = (supabaseAdmin as any)
      .from("employee_advances")
      .select(`
        *,
        employee:employee_id (
          full_name, emp_code,
          department:department_id(name_en),
          position:position_id(name_en)
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }
    if (data.employee_id) {
      query = query.eq("employee_id", data.employee_id);
    }
    if (data.search) {
      query = query.ilike("request_number", `%${data.search}%`);
    }

    const from = (data.page - 1) * data.limit;
    query = query.range(from, from + data.limit - 1);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { advances: (rows ?? []) as EmployeeAdvance[], count: count ?? 0 };
  });

// ─── ADMIN: Audit Log for a single advance ────────────────────────────────────

export const getAdvanceAuditLog = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ advance_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("employee_advance_approvals")
      .select("*, approver:approver_id(full_name)")
      .eq("advance_id", data.advance_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdvanceApproval[];
  });

// ─── ADMIN: List Installments for an advance ─────────────────────────────────

export const listAdvanceInstallments = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ advance_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("employee_advance_installments")
      .select("*")
      .eq("advance_id", data.advance_id)
      .order("payroll_period", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdvanceInstallment[];
  });

// ─── ELIGIBILITY & LIMITS ──────────────────────────────────────────────

export const getAdvanceEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { employee_id?: string } | void) => d)
  .handler(async ({ data, context }) => {
    const employeeId = (data as any)?.employee_id || context.userId;

    const { data: profile } = await (context.supabase as any)
      .from("profiles")
      .select("contract_start_date, annual_advance_limit")
      .eq("id", employeeId)
      .single();

    const limit = profile?.annual_advance_limit ?? 10000;

    const currentYear = new Date().getFullYear();
    const { data: thisYearAdvances } = await (context.supabase as any)
      .from("employee_advances")
      .select("approved_amount, requested_amount")
      .eq("employee_id", employeeId)
      .gte("created_at", `${currentYear}-01-01T00:00:00.000Z`)
      .lte("created_at", `${currentYear}-12-31T23:59:59.999Z`)
      .not("status", "in", '("rejected","cancelled","returned")');

    let usedThisYear = 0;
    for (const adv of (thisYearAdvances ?? [])) {
      usedThisYear += adv.approved_amount ?? adv.requested_amount ?? 0;
    }

    const today = new Date();
    let isProbation = false;
    if (profile?.contract_start_date) {
      const contractStart = new Date(profile.contract_start_date);
      const diffMonths = (today.getFullYear() - contractStart.getFullYear()) * 12 + (today.getMonth() - contractStart.getMonth());
      if (diffMonths < 3) isProbation = true;
    }

    // Request window (15th–20th)
    const currentDay = today.getDate();
    const isInWindow = currentDay >= 15 && currentDay <= 20;
    let windowStart: Date;
    let windowEnd: Date;
    if (currentDay < 15) {
      windowStart = new Date(today.getFullYear(), today.getMonth(), 15);
      windowEnd = new Date(today.getFullYear(), today.getMonth(), 20);
    } else if (currentDay > 20) {
      windowStart = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      windowEnd = new Date(today.getFullYear(), today.getMonth() + 1, 20);
    } else {
      windowStart = new Date(today.getFullYear(), today.getMonth(), 15);
      windowEnd = new Date(today.getFullYear(), today.getMonth(), 20);
    }

    // Outstanding balance + pending checks
    const outstandingBalance = await getActiveOutstandingBalance(employeeId);
    const { data: pendingReqs } = await (context.supabase as any)
      .from("employee_advances")
      .select("id")
      .eq("employee_id", employeeId)
      .in("status", ["pending_manager", "pending_hr", "pending_finance", "approved_for_payment"]);
    const hasPendingRequest = !!(pendingReqs && pendingReqs.length > 0);
    const hasActiveAdvance = outstandingBalance > 0;

    return {
      isProbation,
      annualLimit: limit,
      remainingAnnualLimit: Math.max(0, limit - usedThisYear),
      usedThisYear,
      isInWindow,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      nextWindowStart: (isInWindow ? new Date(today.getFullYear(), today.getMonth() + 1, 15) : windowStart).toISOString(),
      hasPendingRequest,
      hasActiveAdvance,
      outstandingBalance,
    };
  });

export const updateAnnualAdvanceLimit = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((d: { employee_id: string; limit: number }) => d)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ annual_advance_limit: data.limit })
      .eq("id", data.employee_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
