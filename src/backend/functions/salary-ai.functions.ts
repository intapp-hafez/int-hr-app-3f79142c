import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import {
  computeFromEmployee,
  pickActive,
  pickActiveBrackets,
  type PayrollSettings,
  type TaxBracket,
} from "@/lib/payroll-engine";

export type SalaryDeductionLine = {
  label: string;
  amount: number;
  /** share of gross, 0–100 */
  impact_pct: number;
};

export type SalaryAiSummary = {
  employee_id: string;
  employee_name: string;
  emp_code: string | null;
  department: string | null;
  currency: string;
  gross: number;
  net: number;
  allowances_total: number;
  allowances: { name: string; amount: number; taxable: boolean }[];
  insurance_wage: number;
  employee_insurance: number;
  employer_insurance: number;
  emergency_fund: number;
  tax: number;
  medical_insurance: number;
  other_deductions: number;
  deductions: SalaryDeductionLine[];
  total_deductions: number;
  take_home_pct: number;
  ai_summary: string;
  ai_error: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

async function narrate(prompt: string): Promise<{ text: string; error: string | null }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { text: "", error: "AI is not configured for this project." };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content:
              "You are an Egyptian payroll analyst. Write a short, plain-language salary summary for an HR admin. " +
              "Use 4–6 bullet points: what the employee earns gross and net, what allowances add, and how each deduction " +
              "(social insurance, income tax, emergency fund, medical insurance, other) reduces take-home pay, with the " +
              "percentage impact. Amounts are monthly EGP. No markdown headings, no preamble.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 402) return { text: "", error: "AI credits are exhausted for this workspace." };
      if (res.status === 429) return { text: "", error: "AI is rate limited right now — try again shortly." };
      return { text: "", error: `AI request failed (${res.status}): ${body.slice(0, 300)}` };
    }
    const json: any = await res.json();
    const text =
      json.output_text ??
      (Array.isArray(json.output)
        ? json.output
            .flatMap((o: any) => (Array.isArray(o?.content) ? o.content : []))
            .map((c: any) => c?.text ?? "")
            .join("")
        : "");
    return { text: String(text ?? "").trim(), error: null };
  } catch (e: any) {
    return { text: "", error: e?.message ?? "AI request failed" };
  }
}

export const employeeSalaryAiSummary = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ employeeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<SalaryAiSummary> => {
    const supabase: any = context.supabase;
    const today = new Date().toISOString().slice(0, 10);

    const [profRes, allowRes, settingsRes, bracketsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, emp_code, salary_type, salary_amount, salary_gross, salary_net, insurance_applicable, tax_applicable, martyrs_fund_applicable, insurance_salary, emergency_fund, external_income, external_tax_paid, medical_insurance, other_deductions, departments:department_id(name_en, name_ar)",
        )
        .eq("id", data.employeeId)
        .maybeSingle(),
      supabase
        .from("employee_allowances")
        .select("allowances(name, amount, taxable, is_active, currency)")
        .eq("employee_id", data.employeeId),
      supabase.from("payroll_settings").select("*"),
      supabase.from("tax_brackets").select("*"),
    ]);

    const p = profRes.data;
    if (!p) throw new Error("Employee not found");

    const allowances = ((allowRes.data ?? []) as any[])
      .map((r) => r.allowances)
      .filter((a: any) => a && a.is_active !== false)
      .map((a: any) => ({ name: a.name as string, amount: Number(a.amount ?? 0), taxable: !!a.taxable }));
    const allowancesTotal = round2(allowances.reduce((s, a) => s + a.amount, 0));
    const currency = ((allowRes.data ?? [])[0] as any)?.allowances?.currency ?? "EGP";

    const settings = pickActive<PayrollSettings>(
      ((settingsRes.data ?? []) as any[]).map((r) => ({
        employee_insurance_rate: Number(r.employee_insurance_rate),
        employer_insurance_rate: Number(r.employer_insurance_rate),
        martyrs_fund_rate: Number(r.martyrs_fund_rate),
        martyrs_fund_enabled: !!r.martyrs_fund_enabled,
        insurance_ceiling: Number(r.insurance_ceiling),
        insurance_floor: Number(r.insurance_floor),
        annual_personal_exemption: Number(r.annual_personal_exemption),
        effective_date: String(r.effective_date),
      })),
      today,
    );
    const brackets = pickActiveBrackets(
      ((bracketsRes.data ?? []) as any[]).map((r) => ({
        from_amount: Number(r.from_amount),
        to_amount: r.to_amount == null ? null : Number(r.to_amount),
        tax_rate: Number(r.tax_rate),
        effective_date: String(r.effective_date),
      })) as TaxBracket[],
      today,
    );
    if (!settings) throw new Error("Payroll settings are not configured yet.");

    const baseAmount = Number(p.salary_amount ?? p.salary_gross ?? p.salary_net ?? 0);
    const salaryType = (p.salary_type === "NET" ? "NET" : "GROSS") as "NET" | "GROSS";

    const b = computeFromEmployee(salaryType, baseAmount + allowancesTotal, settings, brackets, {
      insurance_applicable: p.insurance_applicable !== false,
      tax_applicable: p.tax_applicable !== false,
      martyrs_fund_applicable: p.martyrs_fund_applicable !== false,
      employee_insurance_salary: p.insurance_salary ? Number(p.insurance_salary) : undefined,
      external_income: Number(p.external_income ?? 0),
      external_tax_paid: Number(p.external_tax_paid ?? 0),
      medical_insurance: Number(p.medical_insurance ?? 0),
      other_deductions: Number(p.other_deductions ?? 0),
      emergency_fund: Number(p.emergency_fund ?? 0),
    });

    const gross = round2(b.gross);
    const pct = (v: number) => (gross > 0 ? round2((v / gross) * 100) : 0);
    const deductions: SalaryDeductionLine[] = [
      { label: "Social insurance (employee share)", amount: round2(b.employee_insurance), impact_pct: pct(b.employee_insurance) },
      { label: "Income tax", amount: round2(b.tax), impact_pct: pct(b.tax) },
      { label: "Emergency fund", amount: round2(b.emergency_fund), impact_pct: pct(b.emergency_fund) },
      { label: "Medical insurance", amount: round2(b.medical_insurance), impact_pct: pct(b.medical_insurance) },
      { label: "Other deductions", amount: round2(b.other_deductions), impact_pct: pct(b.other_deductions) },
    ].filter((d) => d.amount > 0);

    const totalDeductions = round2(deductions.reduce((s, d) => s + d.amount, 0));
    const name = p.full_name ?? "Employee";
    const dept = p.departments?.name_en ?? p.departments?.name_ar ?? null;

    const prompt = [
      `Employee: ${name}${dept ? ` (${dept})` : ""}`,
      `Salary basis: ${salaryType} ${baseAmount} ${currency}/month`,
      `Allowances: ${allowances.length ? allowances.map((a) => `${a.name} ${a.amount}${a.taxable ? " (taxable)" : ""}`).join(", ") : "none"} — total ${allowancesTotal}`,
      `Gross: ${gross}`,
      `Net (take-home): ${round2(b.net)}`,
      `Insurance wage: ${round2(b.insurance_wage)}`,
      `Deductions: ${deductions.map((d) => `${d.label} ${d.amount} (${d.impact_pct}% of gross)`).join("; ") || "none"}`,
      `Employer insurance cost: ${round2(b.employer_insurance)}`,
    ].join("\n");

    const ai = await narrate(prompt);

    return {
      employee_id: p.id,
      employee_name: name,
      emp_code: p.emp_code ?? null,
      department: dept,
      currency,
      gross,
      net: round2(b.net),
      allowances_total: allowancesTotal,
      allowances,
      insurance_wage: round2(b.insurance_wage),
      employee_insurance: round2(b.employee_insurance),
      employer_insurance: round2(b.employer_insurance),
      emergency_fund: round2(b.emergency_fund),
      tax: round2(b.tax),
      medical_insurance: round2(b.medical_insurance),
      other_deductions: round2(b.other_deductions),
      deductions,
      total_deductions: totalDeductions,
      take_home_pct: gross > 0 ? round2((b.net / gross) * 100) : 0,
      ai_summary: ai.text,
      ai_error: ai.error,
    };
  });

export const listSalaryEmployees = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("profiles")
      .select("id, full_name, emp_code, departments:department_id(name_en)")
      .neq("status", "Inactive")
      .order("full_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((p) => ({
      id: p.id as string,
      name: (p.full_name ?? "—") as string,
      emp_code: (p.emp_code ?? null) as string | null,
      department: (p.departments?.name_en ?? null) as string | null,
    }));
  });
