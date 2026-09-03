import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import {
  computeFromEmployee,
  pickActive,
  pickActiveBrackets,
  type PayrollBreakdown,
  type PayrollSettings,
  type TaxBracket,
} from "@/lib/payroll-engine";

export type PayrollRow = {
  employee_id: string;
  employee_name: string;
  emp_code: string | null;
  department: string | null;
  salary: number;
  allowance: number;
  daily_rate: number;
  working_days: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  leave_days: number;
  penalty: number;
  bonus: number;
  advance_deduction: number;
  net_pay: number;
  kpi: number;
  target_met: boolean;
  target_value: number | null;
  gross_salary: number;
  employee_insurance: number;
  employer_insurance: number;
  martyrs_fund: number;
  tax: number;
  insurance_wage: number;
  taxable_annual: number;
  employer_cost: number;
  settings_effective_date: string | null;
  advance_installment_ids?: string[];
  basic_salary: number;
  insurance_salary: number;
  emergency_fund: number;
  medical_insurance: number;
  other_deductions: number;
  external_income: number;
  external_tax_paid: number;
};

export type PayrollPeriodResponse = {
  year: number;
  month: number;
  working_days: number;
  late_penalty_ratio: number;
  rows: PayrollRow[];
  locked: boolean;
  locked_at: string | null;
  run_id: string | null;
  settings_effective_date: string | null;
  brackets_effective_date: string | null;
};

const PeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  workingDays: z.number().int().min(1).max(31).optional(),
  latePenaltyRatio: z.number().min(0).max(2).optional(),
});

function periodRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
  };
}

function defaultWorkingDays(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow !== 5 && dow !== 6) count++; // Fri/Sat weekend (Egypt-style)
  }
  return count;
}

async function computeRows(
  supabase: any,
  year: number,
  month: number,
  workingDays: number,
  latePenaltyRatio: number,
): Promise<{
  rows: PayrollRow[];
  settings: PayrollSettings | null;
  brackets: TaxBracket[];
}> {
  const { startISO, endISO } = periodRange(year, month);
  // Use the last day of the period for "active settings on payroll date".
  const periodEndDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  const [profRes, deptRes, attRes, leaveRes, settingsRes, bracketsRes, installmentsRes, tripsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, emp_code, salary_gross, salary_net, salary_type, salary_amount, insurance_applicable, tax_applicable, martyrs_fund_applicable, allowance, target_value, department_id, status, insurance_salary, emergency_fund, external_income, external_tax_paid, medical_insurance, other_deductions",
      )
      .neq("status", "Inactive")
      .limit(5000),
    supabase
      .from("departments")
      .select("id, name_en, name_ar")
      .limit(5000),
    supabase
      .from("attendance")
      .select("employee_id, date, status")
      .gte("date", startISO)
      .lt("date", endISO)
      .limit(20000),
    supabase
      .from("leaves")
      .select("employee_id, days, status, start_date")
      .eq("status", "approved")
      .gte("start_date", startISO)
      .lt("start_date", endISO)
      .limit(5000),
    supabase.from("payroll_settings").select("*"),
    supabase.from("tax_brackets").select("*"),
    (supabase as any)
      .from("employee_advance_installments")
      .select("id, installment_amount, employee_advances!inner(employee_id)")
      .eq("status", "pending")
      .eq("payroll_period", `${year}-${String(month).padStart(2, "0")}`),
    supabase
      .from("trips")
      .select("id, assignee, calculated_allowance, allowance_status")
      .eq("status", "done")
      .eq("allowance_status", "approved")
      .gte("trip_date", startISO)
      .lt("trip_date", endISO)
  ]);
  if (profRes.error) throw new Error(profRes.error.message);
  if (deptRes.error) throw new Error(deptRes.error.message);
  if (attRes.error) throw new Error(attRes.error.message);
  if (leaveRes.error) throw new Error(leaveRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (bracketsRes.error) throw new Error(bracketsRes.error.message);
  if (installmentsRes.error) throw new Error(installmentsRes.error.message);

  if (installmentsRes.error) throw new Error(installmentsRes.error.message);
  // tripsRes might fail if migration is not run, so we ignore error gracefully for now
  const tripsData = tripsRes?.data ?? [];

  const tripAllowanceMap = new Map<string, number>();
  for (const t of tripsData) {
    if (t.assignee && t.calculated_allowance) {
      const v = tripAllowanceMap.get(t.assignee) ?? 0;
      tripAllowanceMap.set(t.assignee, v + Number(t.calculated_allowance));
    }
  }

  const installmentMap = new Map<string, { deduction: number; ids: string[] }>();
  for (const r of installmentsRes.data ?? []) {
    const empId = (r.employee_advances as any)?.employee_id;
    if (!empId) continue;
    const v = installmentMap.get(empId) ?? { deduction: 0, ids: [] };
    v.deduction += Number(r.installment_amount);
    v.ids.push(r.id);
    installmentMap.set(empId, v);
  }

  const settings = pickActive<PayrollSettings>(
    (settingsRes.data ?? []).map((r: any) => ({
      employee_insurance_rate: Number(r.employee_insurance_rate),
      employer_insurance_rate: Number(r.employer_insurance_rate),
      martyrs_fund_rate: Number(r.martyrs_fund_rate),
      martyrs_fund_enabled: !!r.martyrs_fund_enabled,
      insurance_ceiling: Number(r.insurance_ceiling),
      insurance_floor: Number(r.insurance_floor),
      annual_personal_exemption: Number(r.annual_personal_exemption),
      effective_date: String(r.effective_date),
    })),
    periodEndDate,
  );
  const brackets = pickActiveBrackets(
    (bracketsRes.data ?? []).map((r: any) => ({
      from_amount: Number(r.from_amount),
      to_amount: r.to_amount == null ? null : Number(r.to_amount),
      tax_rate: Number(r.tax_rate),
      effective_date: String(r.effective_date),
    })),
    periodEndDate,
  );

  const deptMap = new Map<string, string | null>(
    (deptRes.data ?? []).map((d: any) => [String(d.id), (d.name_en ?? d.name_ar ?? null) as string | null]),
  );

  const attMap = new Map<string, { p: number; l: number; a: number }>();
  for (const r of attRes.data ?? []) {
    const v = attMap.get(r.employee_id) ?? { p: 0, l: 0, a: 0 };
    if (r.status === "present") v.p++;
    else if (r.status === "late") v.l++;
    else if (r.status === "absent") v.a++;
    attMap.set(r.employee_id, v);
  }
  const leaveMap = new Map<string, number>();
  for (const r of leaveRes.data ?? []) {
    leaveMap.set(r.employee_id, (leaveMap.get(r.employee_id) ?? 0) + Number(r.days || 0));
  }

  const rows = (profRes.data ?? []).map((p: any): PayrollRow => {
    const salaryAmount = Number(
      p.salary_amount ?? p.salary_gross ?? p.salary_net ?? 0,
    );
    const salaryType: "NET" | "GROSS" =
      p.salary_type === "NET" || p.salary_type === "GROSS"
        ? p.salary_type
        : p.salary_net != null && p.salary_gross == null
          ? "NET"
          : "GROSS";

    const empty: PayrollBreakdown = {
      gross: salaryAmount,
      net: salaryAmount,
      insurance_wage: 0,
      employee_insurance: 0,
      employer_insurance: 0,
      martyrs_fund: 0,
      emergency_fund: 0,
      tax: 0,
      taxable_annual: 0,
      employer_cost: salaryAmount,
      medical_insurance: 0,
      other_deductions: 0,
      external_income: 0,
      external_tax_paid: 0,
    };
    const breakdown =
      settings && brackets.length > 0
        ? computeFromEmployee(salaryType, salaryAmount, settings, brackets, {
            insurance_applicable: p.insurance_applicable !== false,
            tax_applicable: p.tax_applicable !== false,
            martyrs_fund_applicable: p.martyrs_fund_applicable !== false,
            employee_insurance_salary: p.insurance_salary ? Number(p.insurance_salary) : undefined,
            external_income: p.external_income ? Number(p.external_income) : undefined,
            external_tax_paid: p.external_tax_paid ? Number(p.external_tax_paid) : undefined,
            medical_insurance: p.medical_insurance ? Number(p.medical_insurance) : undefined,
            other_deductions: p.other_deductions ? Number(p.other_deductions) : undefined,
          })
        : empty;

    const salary = breakdown.gross;
    const baseAllowance = Number(p.allowance ?? 0);
    const tripAllowance = tripAllowanceMap.get(p.id) ?? 0;
    const allowance = baseAllowance + tripAllowance;
    const att = attMap.get(p.id) ?? { p: 0, l: 0, a: 0 };
    const leave = leaveMap.get(p.id) ?? 0;
    const dailyRate = workingDays > 0 ? salary / workingDays : 0;
    const penalty = +(att.l * latePenaltyRatio * dailyRate + att.a * dailyRate).toFixed(2);
    const effectivePresent = att.p + att.l;
    const target = p.target_value != null ? Number(p.target_value) : workingDays;
    const targetMet = effectivePresent >= target;
    const bonus = targetMet ? +(salary * 0.1).toFixed(2) : 0;
    const kpi = workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : 0;
    
    const advanceData = installmentMap.get(p.id) ?? { deduction: 0, ids: [] };
    const advanceDeduction = advanceData.deduction;

    // Net pay = engine net (after statutory deductions) + allowance + bonus − penalty - advance_deduction
    const net = +(breakdown.net + allowance + bonus - penalty - advanceDeduction).toFixed(2);
    return {
      employee_id: p.id,
      employee_name: p.full_name ?? "—",
      emp_code: p.emp_code ?? null,
      department: p.department_id ? (deptMap.get(p.department_id) ?? null) : null,
      salary,
      allowance,
      daily_rate: +dailyRate.toFixed(2),
      working_days: workingDays,
      present_days: att.p,
      late_days: att.l,
      absent_days: att.a,
      leave_days: leave || 0,
      penalty,
      bonus,
      advance_deduction: advanceDeduction,
      net_pay: net,
      kpi,
      target_met: targetMet,
      target_value: p.target_value != null ? Number(p.target_value) : null,
      basic_salary: salary,
      insurance_salary: Number(p.insurance_salary ?? 0),
      emergency_fund: Number(p.emergency_fund ?? 0),
      gross_salary: breakdown.gross,
      employee_insurance: breakdown.employee_insurance,
      employer_insurance: breakdown.employer_insurance,
      martyrs_fund: breakdown.martyrs_fund,
      tax: breakdown.tax,
      insurance_wage: breakdown.insurance_wage,
      taxable_annual: breakdown.taxable_annual,
      employer_cost: breakdown.employer_cost,
      medical_insurance: breakdown.medical_insurance,
      other_deductions: breakdown.other_deductions,
      external_income: breakdown.external_income,
      external_tax_paid: breakdown.external_tax_paid,
      settings_effective_date: settings?.effective_date ?? null,
      advance_installment_ids: advanceData.ids,
    };
  });

  return { rows, settings, brackets };
}

export const getPayrollPeriod = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => PeriodSchema.parse(input))
  .handler(async ({ data, context }): Promise<PayrollPeriodResponse> => {
    const { supabase } = context;

    const runRes = await supabase
      .from("payroll_runs")
      .select("id, working_days, late_penalty_ratio, locked_at, status")
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();
    if (runRes.error) throw new Error(runRes.error.message);

    const existing = runRes.data;
    if (existing && existing.status === "locked") {
      const itemsRes = await supabase
        .from("payroll_run_items")
        .select("*")
        .eq("run_id", existing.id)
        .order("employee_name", { ascending: true })
        .limit(10000);
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      const rows: PayrollRow[] = (itemsRes.data ?? []).map((i: any) => ({
        employee_id: i.employee_id,
        employee_name: i.employee_name,
        emp_code: i.snapshot?.emp_code ?? null,
        department: i.department,
        salary: Number(i.salary),
        allowance: Number(i.allowance),
        daily_rate: Number(i.daily_rate),
        working_days: Number(existing.working_days),
        present_days: i.present_days,
        late_days: i.late_days,
        absent_days: i.absent_days,
        leave_days: i.leave_days,
        penalty: Number(i.penalty),
        bonus: Number(i.bonus),
        net_pay: Number(i.net_pay),
        kpi: i.kpi,
        target_met: i.target_met,
        target_value: i.snapshot?.target_value ?? null,
        gross_salary: Number(i.snapshot?.payroll_engine?.gross ?? i.salary ?? 0),
        employee_insurance: Number(i.snapshot?.payroll_engine?.employee_insurance ?? 0),
        employer_insurance: Number(i.snapshot?.payroll_engine?.employer_insurance ?? 0),
        martyrs_fund: Number(i.snapshot?.payroll_engine?.martyrs_fund ?? 0),
        tax: Number(i.snapshot?.payroll_engine?.tax ?? 0),
        insurance_wage: Number(i.snapshot?.payroll_engine?.insurance_wage ?? 0),
        taxable_annual: Number(i.snapshot?.payroll_engine?.taxable_annual ?? 0),
        employer_cost: Number(i.snapshot?.payroll_engine?.employer_cost ?? i.salary ?? 0),
        settings_effective_date: i.snapshot?.settings_effective_date ?? null,
        advance_deduction: Number(i.snapshot?.advance_deduction ?? 0),
        advance_installment_ids: i.snapshot?.advance_installment_ids ?? [],
        basic_salary: Number(i.basic_salary ?? i.salary ?? 0),
        insurance_salary: Number(i.insurance_salary ?? 0),
        emergency_fund: Number(i.emergency_fund ?? 0),
        medical_insurance: Number(i.snapshot?.payroll_engine?.medical_insurance ?? 0),
        other_deductions: Number(i.snapshot?.payroll_engine?.other_deductions ?? 0),
        external_income: Number(i.snapshot?.payroll_engine?.external_income ?? 0),
        external_tax_paid: Number(i.snapshot?.payroll_engine?.external_tax_paid ?? 0),
      }));
      return {
        year: data.year,
        month: data.month,
        working_days: Number(existing.working_days),
        late_penalty_ratio: Number(existing.late_penalty_ratio),
        rows,
        locked: true,
        locked_at: existing.locked_at,
        run_id: existing.id,
        settings_effective_date: rows[0]?.settings_effective_date ?? null,
        brackets_effective_date: (itemsRes.data?.[0] as any)?.snapshot?.brackets_effective_date ?? null,
      };
    }

    const wd = data.workingDays ?? defaultWorkingDays(data.year, data.month);
    const ratio = data.latePenaltyRatio ?? 0.25;
    const { rows, settings, brackets } = await computeRows(
      supabase,
      data.year,
      data.month,
      wd,
      ratio,
    );
    return {
      year: data.year,
      month: data.month,
      working_days: wd,
      late_penalty_ratio: ratio,
      rows,
      locked: false,
      locked_at: null,
      run_id: null,
      settings_effective_date: settings?.effective_date ?? null,
      brackets_effective_date: brackets[0]?.effective_date ?? null,
    };
  });

export const lockPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => PeriodSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ run_id: string; locked_at: string }> => {
    const { supabase, userId } = context;

    const existingRun = await supabase
      .from("payroll_runs")
      .select("id, status")
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();
    if (existingRun.error) throw new Error(existingRun.error.message);
    if (existingRun.data?.status === "locked") {
      throw new Error("Payroll for this month is already locked");
    }

    const wd = data.workingDays ?? defaultWorkingDays(data.year, data.month);
    const ratio = data.latePenaltyRatio ?? 0.25;
    const { rows, settings, brackets } = await computeRows(
      supabase,
      data.year,
      data.month,
      wd,
      ratio,
    );

    const totals = rows.reduce(
      (acc, r) => ({
        base: acc.base + r.salary,
        allowance: acc.allowance + r.allowance,
        bonus: acc.bonus + r.bonus,
        penalty: acc.penalty + r.penalty,
        net: acc.net + r.net_pay,
        kpi: acc.kpi + r.kpi,
        employee_insurance: acc.employee_insurance + r.employee_insurance,
        employer_insurance: acc.employer_insurance + r.employer_insurance,
        martyrs_fund: acc.martyrs_fund + r.martyrs_fund,
        tax: acc.tax + r.tax,
      }),
      {
        base: 0,
        allowance: 0,
        bonus: 0,
        penalty: 0,
        net: 0,
        kpi: 0,
        employee_insurance: 0,
        employer_insurance: 0,
        martyrs_fund: 0,
        tax: 0,
      },
    );

    const runUpsert = await supabase
      .from("payroll_runs")
      .upsert(
        {
          year: data.year,
          month: data.month,
          status: "locked",
          working_days: wd,
          late_penalty_ratio: ratio,
          employee_count: rows.length,
          totals,
          locked_by: userId,
          locked_at: new Date().toISOString(),
        },
        { onConflict: "year,month" },
      )
      .select("id, locked_at")
      .single();
    if (runUpsert.error) throw new Error(runUpsert.error.message);

    const runId = runUpsert.data.id as string;
    // Clear prior items (if any) and insert fresh snapshot
    const del = await supabase.from("payroll_run_items").delete().eq("run_id", runId);
    if (del.error) throw new Error(del.error.message);

    if (rows.length > 0) {
      const items = rows.map((r) => ({
        run_id: runId,
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        department: r.department,
        salary: r.salary,
        allowance: r.allowance,
        daily_rate: r.daily_rate,
        present_days: r.present_days,
        late_days: r.late_days,
        absent_days: r.absent_days,
        leave_days: r.leave_days,
        penalty: r.penalty,
        bonus: r.bonus,
        net_pay: r.net_pay,
        kpi: r.kpi,
        target_met: r.target_met,
        gross_salary: r.gross_salary,
        net_salary: r.net_pay,
        basic_salary: r.basic_salary,
        insurance_salary: r.insurance_salary,
        emergency_fund: r.emergency_fund,
        snapshot: {
          emp_code: r.emp_code,
          target_value: r.target_value,
          settings_effective_date: r.settings_effective_date,
          advance_deduction: r.advance_deduction,
          advance_installment_ids: r.advance_installment_ids,
          brackets_effective_date: brackets[0]?.effective_date ?? null,
          payroll_engine: {
            gross: r.gross_salary,
            net_statutory: r.gross_salary - r.employee_insurance - r.tax - r.martyrs_fund,
            insurance_wage: r.insurance_wage,
            employee_insurance: r.employee_insurance,
            employer_insurance: r.employer_insurance,
            martyrs_fund: r.martyrs_fund,
            tax: r.tax,
            taxable_annual: r.taxable_annual,
            employer_cost: r.employer_cost,
          },
          settings_snapshot: settings,
          brackets_snapshot: brackets,
        },
      }));
      const ins = await supabase.from("payroll_run_items").insert(items as any);
      if (ins.error) throw new Error(ins.error.message);

      const installmentIds = rows.flatMap((r) => r.advance_installment_ids ?? []);
      if (installmentIds.length > 0) {
        await (supabase as any)
          .from("employee_advance_installments")
          .update({ status: "paid" })
          .in("id", installmentIds);
      }
    }

    return { run_id: runId, locked_at: runUpsert.data.locked_at };
  });

export const unlockPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    
    // Fetch run to get items and revert installments
    const runRes = await supabase.from("payroll_runs").select("id").eq("year", data.year).eq("month", data.month).maybeSingle();
    if (runRes.data) {
      const itemsRes = await supabase.from("payroll_run_items").select("snapshot").eq("run_id", runRes.data.id);
      const installmentIds = (itemsRes.data ?? []).flatMap((i: any) => i.snapshot?.advance_installment_ids ?? []);
      if (installmentIds.length > 0) {
        await (supabase as any).from("employee_advance_installments").update({ status: "pending" }).in("id", installmentIds);
      }
    }

    const del = await supabase
      .from("payroll_runs")
      .delete()
      .eq("year", data.year)
      .eq("month", data.month);
    if (del.error) throw new Error(del.error.message);
    return { ok: true };
  });

export const saveAdvancedPayrollSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z.object({
      employee_id: z.string().uuid(),
      external_income: z.number().min(0),
      external_tax_paid: z.number().min(0),
      medical_insurance: z.number().min(0),
      other_deductions: z.number().min(0),
      insurance_salary: z.number().min(0),
      emergency_fund: z.number().min(0),
      insurance_number: z.string().optional().nullable(),
      bank_account_name: z.string().optional().nullable(),
      bank_account_number: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        external_income: data.external_income,
        external_tax_paid: data.external_tax_paid,
        medical_insurance: data.medical_insurance,
        other_deductions: data.other_deductions,
        insurance_salary: data.insurance_salary,
        emergency_fund: data.emergency_fund,
        insurance_number: data.insurance_number,
        bank_account_name: data.bank_account_name,
        bank_account_number: data.bank_account_number,
      })
      .eq("id", data.employee_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveBulkAdvancedPayrollSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z.array(
      z.object({
        employee_id: z.string().uuid(),
        external_income: z.number().min(0),
        external_tax_paid: z.number().min(0),
        medical_insurance: z.number().min(0),
        other_deductions: z.number().min(0),
        insurance_salary: z.number().min(0),
        emergency_fund: z.number().min(0),
        insurance_number: z.string().optional().nullable(),
        bank_account_name: z.string().optional().nullable(),
        bank_account_number: z.string().optional().nullable(),
      })
    ).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // We update sequentially or we can use an RPC if available.
    // For a relatively small number of employees (under 500), sequential updates are okay but Promise.all is better.
    // Let's batch them in Promise.all chunked.
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((emp) =>
          (supabase as any)
            .from("profiles")
            .update({
              external_income: emp.external_income,
              external_tax_paid: emp.external_tax_paid,
              medical_insurance: emp.medical_insurance,
              other_deductions: emp.other_deductions,
              insurance_salary: emp.insurance_salary,
              emergency_fund: emp.emergency_fund,
              insurance_number: emp.insurance_number,
              bank_account_name: emp.bank_account_name,
              bank_account_number: emp.bank_account_number,
            })
            .eq("id", emp.employee_id)
        )
      );
    }
    return { ok: true };
  });

export const getAdvancedPayrollSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => z.object({}).parse(input))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, emp_code, department_id, external_income, external_tax_paid, medical_insurance, other_deductions, insurance_salary, emergency_fund, insurance_number, bank_account_name, bank_account_number")
      .neq("status", "Inactive")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });