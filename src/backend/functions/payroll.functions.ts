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

  const [profRes, deptRes, attRes, leaveRes, settingsRes, bracketsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, emp_code, salary_gross, salary_net, salary_type, salary_amount, insurance_applicable, tax_applicable, martyrs_fund_applicable, allowance, target_value, department_id, status",
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
  ]);
  if (profRes.error) throw new Error(profRes.error.message);
  if (deptRes.error) throw new Error(deptRes.error.message);
  if (attRes.error) throw new Error(attRes.error.message);
  if (leaveRes.error) throw new Error(leaveRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (bracketsRes.error) throw new Error(bracketsRes.error.message);

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
      tax: 0,
      taxable_annual: 0,
      employer_cost: salaryAmount,
    };
    const breakdown =
      settings && brackets.length > 0
        ? computeFromEmployee(salaryType, salaryAmount, settings, brackets, {
            insurance_applicable: p.insurance_applicable !== false,
            tax_applicable: p.tax_applicable !== false,
            martyrs_fund_applicable: p.martyrs_fund_applicable !== false,
          })
        : empty;

    const salary = breakdown.gross;
    const allowance = Number(p.allowance ?? 0);
    const att = attMap.get(p.id) ?? { p: 0, l: 0, a: 0 };
    const leave = leaveMap.get(p.id) ?? 0;
    const dailyRate = workingDays > 0 ? salary / workingDays : 0;
    const penalty = +(att.l * latePenaltyRatio * dailyRate + att.a * dailyRate).toFixed(2);
    const effectivePresent = att.p + att.l;
    const target = p.target_value != null ? Number(p.target_value) : workingDays;
    const targetMet = effectivePresent >= target;
    const bonus = targetMet ? +(salary * 0.1).toFixed(2) : 0;
    const kpi = workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : 0;
    // Net pay = engine net (after statutory deductions) + allowance + bonus − penalty
    const net = +(breakdown.net + allowance + bonus - penalty).toFixed(2);
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
      net_pay: net,
      kpi,
      target_met: targetMet,
      target_value: p.target_value != null ? Number(p.target_value) : null,
      gross_salary: breakdown.gross,
      employee_insurance: breakdown.employee_insurance,
      employer_insurance: breakdown.employer_insurance,
      martyrs_fund: breakdown.martyrs_fund,
      tax: breakdown.tax,
      insurance_wage: breakdown.insurance_wage,
      taxable_annual: breakdown.taxable_annual,
      employer_cost: breakdown.employer_cost,
      settings_effective_date: settings?.effective_date ?? null,
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
        snapshot: {
          emp_code: r.emp_code,
          target_value: r.target_value,
          settings_effective_date: r.settings_effective_date,
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
      const ins = await supabase.from("payroll_run_items").insert(items);
      if (ins.error) throw new Error(ins.error.message);
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
    const del = await supabase
      .from("payroll_runs")
      .delete()
      .eq("year", data.year)
      .eq("month", data.month);
    if (del.error) throw new Error(del.error.message);
    return { ok: true };
  });