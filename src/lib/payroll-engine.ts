/**
 * Egyptian payroll calculation engine.
 * Pure / isomorphic — no DB, no env. Pass settings + brackets in.
 * All amounts are MONTHLY EGP unless noted. Tax brackets are ANNUAL.
 */

export type PayrollSettings = {
  employee_insurance_rate: number; // 0.11
  employer_insurance_rate: number; // 0.1875
  martyrs_fund_rate: number;       // 0.0005
  martyrs_fund_enabled: boolean;
  insurance_ceiling: number;       // monthly EGP
  insurance_floor: number;         // monthly EGP
  annual_personal_exemption: number; // EGP / year
  effective_date: string;          // YYYY-MM-DD
  pay_period?: "Weekly" | "Biweekly" | "Monthly";
  payout_methods?: string[];
};

export type TaxBracket = {
  from_amount: number;     // annual
  to_amount: number | null; // null = ∞
  tax_rate: number;        // 0.10
  effective_date: string;
};

export type Applicability = {
  insurance_applicable?: boolean;
  tax_applicable?: boolean;
  martyrs_fund_applicable?: boolean;
  employee_insurance_salary?: number;
  external_income?: number;       // monthly EGP from other employers
  external_tax_paid?: number;     // monthly EGP tax already paid by other employers
  medical_insurance?: number;     // monthly deduction
  other_deductions?: number;      // monthly other deductions
};

export type PayrollBreakdown = {
  gross: number;
  net: number;
  insurance_wage: number;
  employee_insurance: number;
  employer_insurance: number;
  martyrs_fund: number;
  emergency_fund: number;
  tax: number;
  taxable_annual: number;
  employer_cost: number; // gross + employer_insurance
  medical_insurance: number;
  other_deductions: number;
  external_income: number;
  external_tax_paid: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function pickActive<T extends { effective_date: string }>(
  rows: readonly T[],
  date: string,
): T | null {
  const eligible = rows.filter((r) => r.effective_date <= date);
  if (eligible.length === 0) return null;
  return eligible.reduce((a, b) => (a.effective_date > b.effective_date ? a : b));
}

export function pickActiveBrackets(
  brackets: readonly TaxBracket[],
  date: string,
): TaxBracket[] {
  const dates = Array.from(new Set(brackets.map((b) => b.effective_date)))
    .filter((d) => d <= date)
    .sort();
  if (dates.length === 0) return [];
  const active = dates[dates.length - 1];
  return brackets
    .filter((b) => b.effective_date === active)
    .sort((a, b) => a.from_amount - b.from_amount);
}

export function calcInsuranceWage(gross: number, s: PayrollSettings, opts: Applicability = {}): number {
  let base = gross;
  if (opts.employee_insurance_salary && opts.employee_insurance_salary > 0) {
    base = opts.employee_insurance_salary;
  }
  const clamped = Math.max(s.insurance_floor, Math.min(base, s.insurance_ceiling));
  return round2(clamped);
}

export function calcEmployeeInsurance(gross: number, s: PayrollSettings, opts: Applicability = {}): number {
  if (opts.insurance_applicable === false) return 0;
  return round2(calcInsuranceWage(gross, s, opts) * s.employee_insurance_rate);
}

export function calcEmployerInsurance(gross: number, s: PayrollSettings, opts: Applicability = {}): number {
  if (opts.insurance_applicable === false) return 0;
  return round2(calcInsuranceWage(gross, s, opts) * s.employer_insurance_rate);
}

export function calcMartyrsFund(gross: number, s: PayrollSettings, opts: Applicability = {}): number {
  if (!s.martyrs_fund_enabled) return 0;
  if (opts.martyrs_fund_applicable === false) return 0;
  return round2(gross * s.martyrs_fund_rate);
}

/** Progressive tax on annual taxable income. */
export function calcAnnualTax(taxableAnnual: number, brackets: readonly TaxBracket[]): number {
  if (taxableAnnual <= 0 || brackets.length === 0) return 0;
  let tax = 0;
  for (const b of brackets) {
    if (taxableAnnual <= b.from_amount) break;
    const top = b.to_amount == null ? taxableAnnual : Math.min(taxableAnnual, b.to_amount);
    const slice = Math.max(0, top - b.from_amount);
    tax += slice * b.tax_rate;
    if (b.to_amount == null || taxableAnnual <= b.to_amount) break;
  }
  return round2(tax);
}

/** Monthly tax = annual tax / 12, including external income & external tax paid. */
export function calcMonthlyTax(
  gross: number,
  s: PayrollSettings,
  brackets: readonly TaxBracket[],
  opts: Applicability = {},
): { tax: number; taxable_annual: number } {
  if (opts.tax_applicable === false) return { tax: 0, taxable_annual: 0 };
  const empIns = calcEmployeeInsurance(gross, s, opts);
  const externalMonthly = opts.external_income ?? 0;
  const annualGross = (gross + externalMonthly) * 12;
  const annualEmpIns = empIns * 12;
  const taxable = Math.max(0, annualGross - annualEmpIns - s.annual_personal_exemption);
  const annualTax = calcAnnualTax(taxable, brackets);
  const externalTaxPaidMonthly = opts.external_tax_paid ?? 0;
  const tax = Math.max(0, round2(annualTax / 12) - externalTaxPaidMonthly);
  return { tax: round2(tax), taxable_annual: round2(taxable) };
}

export function grossToNet(
  gross: number,
  settings: PayrollSettings,
  brackets: readonly TaxBracket[],
  opts: Applicability = {},
): PayrollBreakdown {
  const g = round2(gross);
  const insurance_wage = calcInsuranceWage(g, settings, opts);
  const employee_insurance = calcEmployeeInsurance(g, settings, opts);
  const employer_insurance = calcEmployerInsurance(g, settings, opts);
  const martyrs_fund = calcMartyrsFund(g, settings, opts);
  const { tax, taxable_annual } = calcMonthlyTax(g, settings, brackets, opts);
  const medical_insurance = round2(opts.medical_insurance ?? 0);
  const other_deductions = round2(opts.other_deductions ?? 0);
  const external_income = round2(opts.external_income ?? 0);
  const external_tax_paid = round2(opts.external_tax_paid ?? 0);
  const net = round2(g - employee_insurance - tax - martyrs_fund - medical_insurance - other_deductions);
  return {
    gross: g,
    net,
    insurance_wage,
    employee_insurance,
    employer_insurance,
    martyrs_fund,
    tax,
    taxable_annual,
    employer_cost: round2(g + employer_insurance),
    medical_insurance,
    other_deductions,
    external_income,
    external_tax_paid,
  };
}

/** Binary-search net → gross (tax is progressive, so no closed form). */
export function netToGross(
  net: number,
  settings: PayrollSettings,
  brackets: readonly TaxBracket[],
  opts: Applicability = {},
): PayrollBreakdown {
  if (net <= 0) return grossToNet(0, settings, brackets, opts);
  let low = net;
  let high = net * 2;
  // expand upper bound until calc net >= target
  for (let i = 0; i < 20; i++) {
    if (grossToNet(high, settings, brackets, opts).net >= net) break;
    high *= 2;
  }
  let mid = (low + high) / 2;
  let result = grossToNet(mid, settings, brackets, opts);
  for (let i = 0; i < 60; i++) {
    if (Math.abs(result.net - net) < 0.01) break;
    if (result.net > net) high = mid;
    else low = mid;
    mid = (low + high) / 2;
    result = grossToNet(mid, settings, brackets, opts);
  }
  return result;
}

export function computeFromEmployee(
  salary_type: "NET" | "GROSS",
  salary_amount: number,
  settings: PayrollSettings,
  brackets: readonly TaxBracket[],
  opts: Applicability = {},
): PayrollBreakdown {
  return salary_type === "NET"
    ? netToGross(salary_amount, settings, brackets, opts)
    : grossToNet(salary_amount, settings, brackets, opts);
}