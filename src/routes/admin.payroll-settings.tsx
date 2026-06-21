import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import {
  getPayrollConfig,
  savePayrollSettings,
  saveTaxBrackets,
  previewSalary,
} from "@/backend/functions/payroll-settings.functions";
import { SubTabs } from "@/components/SubTabs";

export const Route = createFileRoute("/admin/payroll-settings")({
  component: AdminPayrollSettings,
});

type BracketRow = { from_amount: number; to_amount: number | null; tax_rate: number };

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AdminPayrollSettings() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getPayrollConfig);
  const saveCfg = useServerFn(savePayrollSettings);
  const saveBr = useServerFn(saveTaxBrackets);
  const preview = useServerFn(previewSalary);

  const { data, isLoading } = useQuery({ queryKey: ["payroll-config"], queryFn: () => getCfg() });

  const today = new Date().toISOString().slice(0, 10);
  const latest = data?.settings[0];

  const PAYOUT_OPTIONS = ["Bank Transfer", "Cash", "Mobile Wallet", "Cheque"] as const;

  const [form, setForm] = useState({
    employee_insurance_rate: 11,
    employer_insurance_rate: 18.75,
    martyrs_fund_rate: 0.05,
    martyrs_fund_enabled: true,
    insurance_ceiling: 12600,
    insurance_floor: 2000,
    annual_personal_exemption: 20000,
    effective_date: today,
    pay_period: "Monthly" as "Weekly" | "Biweekly" | "Monthly",
    payout_methods: ["Bank Transfer"] as string[],
  });

  useEffect(() => {
    if (!latest) return;
    setForm({
      employee_insurance_rate: latest.employee_insurance_rate * 100,
      employer_insurance_rate: latest.employer_insurance_rate * 100,
      martyrs_fund_rate: latest.martyrs_fund_rate * 100,
      martyrs_fund_enabled: latest.martyrs_fund_enabled,
      insurance_ceiling: latest.insurance_ceiling,
      insurance_floor: latest.insurance_floor,
      annual_personal_exemption: latest.annual_personal_exemption,
      effective_date: latest.effective_date,
      pay_period: (latest.pay_period ?? "Monthly") as any,
      payout_methods: (latest.payout_methods?.length ? latest.payout_methods : ["Bank Transfer"]) as string[],
    });
  }, [latest?.effective_date]);

  const activeBrackets = useMemo<BracketRow[]>(() => {
    if (!data?.brackets.length) return [];
    const dates = Array.from(new Set(data.brackets.map((b) => b.effective_date))).sort();
    const last = dates[dates.length - 1];
    return data.brackets
      .filter((b) => b.effective_date === last)
      .map((b) => ({ from_amount: b.from_amount, to_amount: b.to_amount, tax_rate: b.tax_rate * 100 }))
      .sort((a, b) => a.from_amount - b.from_amount);
  }, [data]);

  const [brackets, setBrackets] = useState<BracketRow[]>([]);
  const [bracketsDate, setBracketsDate] = useState<string>(today);
  useEffect(() => {
    if (activeBrackets.length) {
      setBrackets(activeBrackets);
      const last = data?.brackets[0]?.effective_date;
      if (last) setBracketsDate(last);
    }
  }, [activeBrackets.length]);

  const settingsMut = useMutation({
    mutationFn: () =>
      saveCfg({
        data: {
          employee_insurance_rate: form.employee_insurance_rate / 100,
          employer_insurance_rate: form.employer_insurance_rate / 100,
          martyrs_fund_rate: form.martyrs_fund_rate / 100,
          martyrs_fund_enabled: form.martyrs_fund_enabled,
          insurance_ceiling: form.insurance_ceiling,
          insurance_floor: form.insurance_floor,
          annual_personal_exemption: form.annual_personal_exemption,
          effective_date: form.effective_date,
          pay_period: form.pay_period,
          payout_methods: form.payout_methods.length ? form.payout_methods : ["Bank Transfer"],
        },
      }),
    onSuccess: () => {
      toast.success("Payroll settings saved");
      qc.invalidateQueries({ queryKey: ["payroll-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const bracketsMut = useMutation({
    mutationFn: () =>
      saveBr({
        data: {
          effective_date: bracketsDate,
          brackets: brackets.map((b) => ({
            from_amount: Number(b.from_amount) || 0,
            to_amount: b.to_amount == null ? null : Number(b.to_amount),
            tax_rate: Number(b.tax_rate) / 100,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Tax brackets saved");
      qc.invalidateQueries({ queryKey: ["payroll-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const [pvAmount, setPvAmount] = useState(10000);
  const [pvMode, setPvMode] = useState<"NET" | "GROSS">("NET");
  const [pvResult, setPvResult] = useState<any>(null);
  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const r = await preview({ data: { amount: pvAmount, mode: pvMode } });
        setPvResult(r.ok ? r.breakdown : { error: r.error });
      } catch (e: any) {
        setPvResult({ error: e?.message ?? "Preview failed" });
      }
    }, 300);
    return () => clearTimeout(id);
  }, [pvAmount, pvMode, data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="space-y-6">
      <SubTabs items={[
        { to: "/admin/payroll", label: "Payroll" },
        { to: "/admin/payroll-settings", label: "Payroll Settings" },
      ]} />
      <div>
        <h1 className="font-display text-2xl font-bold">Payroll Settings</h1>
        <p className="text-sm text-muted-foreground">Egyptian payroll — all values effective-dated; historical runs reproduce.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Social Insurance & Martyrs Fund</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Employee Insurance %</label>
              <input type="number" step="0.01" className={inputCls}
                value={form.employee_insurance_rate}
                onChange={(e) => setForm({ ...form, employee_insurance_rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Employer Insurance %</label>
              <input type="number" step="0.01" className={inputCls}
                value={form.employer_insurance_rate}
                onChange={(e) => setForm({ ...form, employer_insurance_rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Insurance Ceiling (EGP)</label>
              <input type="number" className={inputCls}
                value={form.insurance_ceiling}
                onChange={(e) => setForm({ ...form, insurance_ceiling: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Insurance Floor (EGP)</label>
              <input type="number" className={inputCls}
                value={form.insurance_floor}
                onChange={(e) => setForm({ ...form, insurance_floor: Number(e.target.value) })} />
            </div>
            <div className="col-span-2 flex items-center gap-2 pt-2">
              <input id="mf" type="checkbox" checked={form.martyrs_fund_enabled}
                onChange={(e) => setForm({ ...form, martyrs_fund_enabled: e.target.checked })} />
              <label htmlFor="mf" className="text-sm">Enable Martyrs' Families Fund</label>
            </div>
            <div>
              <label className={labelCls}>Martyrs Fund %</label>
              <input type="number" step="0.001" className={inputCls}
                value={form.martyrs_fund_rate}
                disabled={!form.martyrs_fund_enabled}
                onChange={(e) => setForm({ ...form, martyrs_fund_rate: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Annual Personal Exemption (EGP)</label>
              <input type="number" className={inputCls}
                value={form.annual_personal_exemption}
                onChange={(e) => setForm({ ...form, annual_personal_exemption: Number(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Effective Date</label>
              <input type="date" className={inputCls}
                value={form.effective_date}
                onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Pay Period</label>
              <select
                className={inputCls}
                value={form.pay_period}
                onChange={(e) => setForm({ ...form, pay_period: e.target.value as any })}
              >
                <option value="Weekly">Weekly</option>
                <option value="Biweekly">Biweekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Payout Methods</label>
              <div className="flex flex-wrap gap-2 pt-2">
                {PAYOUT_OPTIONS.map((opt) => {
                  const active = form.payout_methods.includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() =>
                        setForm({
                          ...form,
                          payout_methods: active
                            ? form.payout_methods.filter((m) => m !== opt)
                            : [...form.payout_methods, opt],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            onClick={() => settingsMut.mutate()}
            disabled={settingsMut.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {settingsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Salary Preview</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mode</label>
              <select className={inputCls} value={pvMode} onChange={(e) => setPvMode(e.target.value as "NET" | "GROSS")}>
                <option value="NET">Net → Gross</option>
                <option value="GROSS">Gross → Net</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount (EGP)</label>
              <input type="number" className={inputCls}
                value={pvAmount}
                onChange={(e) => setPvAmount(Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-4 space-y-1.5 rounded-xl bg-muted/40 p-4 text-sm">
            {pvResult?.error ? (
              <div className="text-destructive">{pvResult.error}</div>
            ) : pvResult ? (
              <>
                <Row label="Gross Salary" value={fmt(pvResult.gross)} bold />
                <Row label="− Employee Insurance" value={fmt(pvResult.employee_insurance)} />
                <Row label="− Salary Tax" value={fmt(pvResult.tax)} />
                <Row label="− Martyrs Fund" value={fmt(pvResult.martyrs_fund)} />
                <div className="my-2 border-t border-border" />
                <Row label="Net Salary" value={fmt(pvResult.net)} bold />
                <Row label="Employer Insurance (company)" value={fmt(pvResult.employer_insurance)} muted />
                <Row label="Total Employer Cost" value={fmt(pvResult.employer_cost)} muted />
              </>
            ) : (
              <div className="text-muted-foreground">Calculating…</div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Tax Brackets (Annual)</h2>
          <div className="flex items-center gap-2">
            <label className={labelCls}>Effective Date</label>
            <input type="date" className={inputCls + " w-40"} value={bracketsDate}
              onChange={(e) => setBracketsDate(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-start">From (EGP)</th>
                <th className="px-2 py-2 text-start">To (EGP, empty = ∞)</th>
                <th className="px-2 py-2 text-start">Rate %</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {brackets.map((b, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-2 py-1.5">
                    <input type="number" className={inputCls}
                      value={b.from_amount}
                      onChange={(e) => {
                        const next = [...brackets];
                        next[i] = { ...next[i], from_amount: Number(e.target.value) };
                        setBrackets(next);
                      }} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" className={inputCls}
                      value={b.to_amount ?? ""}
                      onChange={(e) => {
                        const next = [...brackets];
                        next[i] = { ...next[i], to_amount: e.target.value === "" ? null : Number(e.target.value) };
                        setBrackets(next);
                      }} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="0.01" className={inputCls}
                      value={b.tax_rate}
                      onChange={(e) => {
                        const next = [...brackets];
                        next[i] = { ...next[i], tax_rate: Number(e.target.value) };
                        setBrackets(next);
                      }} />
                  </td>
                  <td className="px-2 py-1.5 text-end">
                    <button onClick={() => setBrackets(brackets.filter((_, j) => j !== i))}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setBrackets([...brackets, { from_amount: 0, to_amount: null, tax_rate: 0 }])}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent">
            <Plus className="h-4 w-4" /> Add bracket
          </button>
          <button
            onClick={() => bracketsMut.mutate()}
            disabled={bracketsMut.isPending || brackets.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {bracketsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Brackets
          </button>
        </div>
      </section>

      {data && data.settings.length > 1 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Settings History</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-start">Effective</th>
                <th className="px-2 py-2 text-start">Emp %</th>
                <th className="px-2 py-2 text-start">Empr %</th>
                <th className="px-2 py-2 text-start">Ceiling</th>
                <th className="px-2 py-2 text-start">Martyrs %</th>
                <th className="px-2 py-2 text-start">Exemption</th>
              </tr>
            </thead>
            <tbody>
              {data.settings.map((s) => (
                <tr key={s.effective_date} className="border-b border-border/50">
                  <td className="px-2 py-2">{s.effective_date}</td>
                  <td className="px-2 py-2">{(s.employee_insurance_rate * 100).toFixed(2)}</td>
                  <td className="px-2 py-2">{(s.employer_insurance_rate * 100).toFixed(2)}</td>
                  <td className="px-2 py-2">{fmt(s.insurance_ceiling)}</td>
                  <td className="px-2 py-2">{s.martyrs_fund_enabled ? (s.martyrs_fund_rate * 100).toFixed(3) : "—"}</td>
                  <td className="px-2 py-2">{fmt(s.annual_personal_exemption)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}