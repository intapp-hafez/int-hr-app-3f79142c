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

export type PayrollConfigBundle = {
  settings: PayrollSettings[]; // history, newest first
  brackets: TaxBracket[];
};

export const getPayrollConfig = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<PayrollConfigBundle> => {
    const { supabase } = context;
    const [sRes, bRes] = await Promise.all([
      supabase.from("payroll_settings").select("*").order("effective_date", { ascending: false }),
      supabase.from("tax_brackets").select("*").order("effective_date", { ascending: false }).order("from_amount", { ascending: true }),
    ]);
    if (sRes.error) throw new Error(sRes.error.message);
    if (bRes.error) throw new Error(bRes.error.message);
    const settings = (sRes.data ?? []).map((r: any): PayrollSettings => ({
      employee_insurance_rate: Number(r.employee_insurance_rate),
      employer_insurance_rate: Number(r.employer_insurance_rate),
      martyrs_fund_rate: Number(r.martyrs_fund_rate),
      martyrs_fund_enabled: !!r.martyrs_fund_enabled,
      insurance_ceiling: Number(r.insurance_ceiling),
      insurance_floor: Number(r.insurance_floor),
      annual_personal_exemption: Number(r.annual_personal_exemption),
      effective_date: String(r.effective_date),
      pay_period: (r.pay_period ?? "Monthly") as any,
      payout_methods: (r.payout_methods ?? ["Bank Transfer"]) as any,
    }));
    const brackets = (bRes.data ?? []).map((r: any): TaxBracket => ({
      from_amount: Number(r.from_amount),
      to_amount: r.to_amount == null ? null : Number(r.to_amount),
      tax_rate: Number(r.tax_rate),
      effective_date: String(r.effective_date),
    }));
    return { settings, brackets };
  });

const SettingsInput = z.object({
  employee_insurance_rate: z.number().min(0).max(1),
  employer_insurance_rate: z.number().min(0).max(1),
  martyrs_fund_rate: z.number().min(0).max(1),
  martyrs_fund_enabled: z.boolean(),
  insurance_ceiling: z.number().min(0),
  insurance_floor: z.number().min(0),
  annual_personal_exemption: z.number().min(0),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  pay_period: z.enum(["Weekly", "Biweekly", "Monthly"]).default("Monthly"),
  payout_methods: z.array(z.string().min(1).max(60)).min(1).default(["Bank Transfer"]),
});

export const savePayrollSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("payroll_settings")
      .upsert(data, { onConflict: "effective_date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BracketsInput = z.object({
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  brackets: z
    .array(
      z.object({
        from_amount: z.number().min(0),
        to_amount: z.number().nullable(),
        tax_rate: z.number().min(0).max(1),
      }),
    )
    .min(1),
});

export const saveTaxBrackets = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => BracketsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const del = await supabase.from("tax_brackets").delete().eq("effective_date", data.effective_date);
    if (del.error) throw new Error(del.error.message);
    const rows = data.brackets.map((b) => ({ ...b, effective_date: data.effective_date }));
    const ins = await supabase.from("tax_brackets").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true };
  });

const PreviewInput = z.object({
  amount: z.number().min(0),
  mode: z.enum(["NET", "GROSS"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  insurance_applicable: z.boolean().optional(),
  tax_applicable: z.boolean().optional(),
  martyrs_fund_applicable: z.boolean().optional(),
});

export type PreviewSalaryResult =
  | {
      ok: true;
      breakdown: PayrollBreakdown;
      settings: PayrollSettings;
      brackets: TaxBracket[];
    }
  | { ok: false; error: string };

export const previewSalary = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => PreviewInput.parse(input))
  .handler(async ({ data, context }): Promise<PreviewSalaryResult> => {
    const { supabase } = context;
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const [sRes, bRes] = await Promise.all([
      supabase.from("payroll_settings").select("*"),
      supabase.from("tax_brackets").select("*"),
    ]);
    if (sRes.error) throw new Error(sRes.error.message);
    if (bRes.error) throw new Error(bRes.error.message);
    const settings = pickActive(
      (sRes.data ?? []).map((r: any) => ({
        employee_insurance_rate: Number(r.employee_insurance_rate),
        employer_insurance_rate: Number(r.employer_insurance_rate),
        martyrs_fund_rate: Number(r.martyrs_fund_rate),
        martyrs_fund_enabled: !!r.martyrs_fund_enabled,
        insurance_ceiling: Number(r.insurance_ceiling),
        insurance_floor: Number(r.insurance_floor),
        annual_personal_exemption: Number(r.annual_personal_exemption),
        effective_date: String(r.effective_date),
      })),
      date,
    );
    if (!settings) return { ok: false, error: "No payroll settings configured" };
    const brackets = pickActiveBrackets(
      (bRes.data ?? []).map((r: any) => ({
        from_amount: Number(r.from_amount),
        to_amount: r.to_amount == null ? null : Number(r.to_amount),
        tax_rate: Number(r.tax_rate),
        effective_date: String(r.effective_date),
      })),
      date,
    );
    const breakdown = computeFromEmployee(data.mode, data.amount, settings, brackets, {
      insurance_applicable: data.insurance_applicable,
      tax_applicable: data.tax_applicable,
      martyrs_fund_applicable: data.martyrs_fund_applicable,
    });
    return { ok: true, breakdown, settings, brackets };
  });