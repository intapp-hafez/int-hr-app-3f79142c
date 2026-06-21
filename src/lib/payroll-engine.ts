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
};

export type PayrollBreakdown = {
  gross: number;
  net: number;
  insurance_wage: number;
  employee_insurance: number;
  employer_insurance: number;
  martyrs_fund: number;
  tax: number;
  taxable_annual: number;
  employer_cost: number; // gross + employer_insurance
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

export function calcInsuranceWage(gross: number, s: PayrollSettings): number {
  const clamped = Math.max(s.insurance_floor, Math.min(gross, s.insurance_ceiling));
  return round2(clamped);
}

export function calcEmployeeInsurance(gross: number, s: PayrollSettings, opts: Applicability = {}): number {
  if (opts.insurance_applicable === false) return 0;
  return round2(calcInsuranceWage(gross, s) * s.employee_insurance_rate);
}

export function calcEmployerInsurance(gross: number, s: PayrollSettings, opts: Applicability = {}): number {
  if (opts.insurance_applicable === false) return 0;
  return round2(calcInsuranceWage(gross, s) * s.employer_insurance_rate);
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

/** Monthly tax = annual tax / 12. */
export function calcMonthlyTax(
  gross: number,
  s: PayrollSettings,
  brackets: readonly TaxBracket[],
  opts: Applicability = {},
): { tax: number; taxable_annual: number } {
  if (opts.tax_applicable === false) return { tax: 0, taxable_annual: 0 };
  const empIns = calcEmployeeInsurance(gross, s, opts);
  const annualGross = gross * 12;
  const annualEmpIns = empIns * 12;
  const taxable = Math.max(0, annualGross - annualEmpIns - s.annual_personal_exemption);
  const annualTax = calcAnnualTax(taxable, brackets);
  return { tax: round2(annualTax / 12), taxable_annual: round2(taxable) };
}

export function grossToNet(
  gross: number,
  settings: PayrollSettings,
  brackets: readonly TaxBracket[],
  opts: Applicability = {},
): PayrollBreakdown {
  const g = round2(gross);
  const insurance_wage = calcInsuranceWage(g, settings);
  const employee_insurance = calcEmployeeInsurance(g, settings, opts);
  const employer_insurance = calcEmployerInsurance(g, settings, opts);
  const martyrs_fund = calcMartyrsFund(g, settings, opts);
  const { tax, taxable_annual } = calcMonthlyTax(g, settings, brackets, opts);
  const net = round2(g - employee_insurance - tax - martyrs_fund);
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