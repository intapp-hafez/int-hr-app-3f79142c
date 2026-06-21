import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { previewSalary } from "@/backend/functions/payroll-settings.functions";

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

/**
 * Live Egyptian payroll preview used in the employee Add/Edit form.
 * Debounced 300ms; calls previewSalary server fn (admin-only).
 */
export function SalaryPreview({
  amount,
  mode,
  insuranceApplicable = true,
  taxApplicable = true,
  martyrsFundApplicable = true,
}: {
  amount: number;
  mode: "NET" | "GROSS";
  insuranceApplicable?: boolean;
  taxApplicable?: boolean;
  martyrsFundApplicable?: boolean;
}) {
  const preview = useServerFn(previewSalary);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!amount || amount <= 0) {
      setResult(null);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const r = await preview({
          data: {
            amount,
            mode,
            insurance_applicable: insuranceApplicable,
            tax_applicable: taxApplicable,
            martyrs_fund_applicable: martyrsFundApplicable,
          },
        });
        setResult(r);
      } catch (e: any) {
        setResult({ ok: false, error: e?.message ?? "Preview failed" });
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [amount, mode, insuranceApplicable, taxApplicable, martyrsFundApplicable]);

  if (!amount || amount <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Enter a salary amount to preview Net ↔ Gross.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between font-semibold">
        <span>Egyptian Payroll Preview</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {result?.ok === false ? (
        <div className="text-destructive">{result.error}</div>
      ) : result?.ok ? (
        <div className="space-y-1 font-mono tabular-nums">
          <Line label="Gross Salary" value={fmt(result.breakdown.gross)} bold />
          <Line label="Insurance Wage" value={fmt(result.breakdown.insurance_wage)} muted />
          <Line label="− Employee Insurance" value={fmt(result.breakdown.employee_insurance)} />
          <Line label="− Salary Tax" value={fmt(result.breakdown.tax)} />
          <Line label="− Martyrs Fund" value={fmt(result.breakdown.martyrs_fund)} />
          <div className="my-1 border-t border-border" />
          <Line label="Net Salary" value={fmt(result.breakdown.net)} bold />
          <Line label="Employer Insurance" value={fmt(result.breakdown.employer_insurance)} muted />
          <Line label="Employer Cost" value={fmt(result.breakdown.employer_cost)} muted />
          <Line label="Taxable (annual)" value={fmt(result.breakdown.taxable_annual)} muted />
          <div className="my-2 border-t border-border" />
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="font-sans font-semibold uppercase tracking-wide">
              Effective settings ({result.settings.effective_date})
            </div>
            <Line label="Employee insurance rate" value={pct(result.settings.employee_insurance_rate)} muted />
            <Line label="Employer insurance rate" value={pct(result.settings.employer_insurance_rate)} muted />
            <Line
              label="Martyrs fund rate"
              value={result.settings.martyrs_fund_enabled ? pct(result.settings.martyrs_fund_rate) : "disabled"}
              muted
            />
            <Line label="Insurance floor / ceiling" value={`${fmt(result.settings.insurance_floor)} / ${fmt(result.settings.insurance_ceiling)}`} muted />
            <Line label="Annual personal exemption" value={fmt(result.settings.annual_personal_exemption)} muted />
            <div className="pt-1 font-sans font-semibold uppercase tracking-wide">
              Tax brackets ({result.brackets[0]?.effective_date ?? "—"})
            </div>
            {result.brackets.map((b: any, i: number) => (
              <Line
                key={i}
                label={`${fmt(b.from_amount)} – ${b.to_amount == null ? "∞" : fmt(b.to_amount)}`}
                value={pct(b.tax_rate)}
                muted
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground">Calculating…</div>
      )}
    </div>
  );
}

function Line({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}