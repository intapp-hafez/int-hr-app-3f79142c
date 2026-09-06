import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Save, FileUp, FileDown, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useI18n } from '@/lib/i18n';
import { getAdvancedPayrollSettings, saveAdvancedPayrollSettings, saveBulkAdvancedPayrollSettings } from '@/backend/functions/payroll.functions';
import { formatName3Words } from '@/lib/utils';

export type AdvRow = {
  id: string;
  full_name: string;
  emp_code: string | null;
  department_id: string | null;
  external_income: number;
  external_tax_paid: number;
  medical_insurance: number;
  other_deductions: number;
  insurance_salary: number;
  emergency_fund: number;
  insurance_number: string;
  bank_account_name: string;
  bank_account_number: string;
};

export function AdvancedSettingsTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const getFn = useServerFn(getAdvancedPayrollSettings);
  const saveFn = useServerFn(saveAdvancedPayrollSettings);
  const saveBulkFn = useServerFn(saveBulkAdvancedPayrollSettings);

  const { data: rawRows, isLoading } = useQuery({
    queryKey: ["advanced-payroll-settings"],
    queryFn: () => getFn({ data: {} }),
  });

  const [edits, setEdits] = useState<Record<string, Partial<AdvRow>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const rows: AdvRow[] = (rawRows ?? []).map((r: any) => ({
    id: r.id,
    full_name: r.full_name ?? "—",
    emp_code: r.emp_code ?? null,
    department_id: r.department_id,
    external_income: Number(r.external_income ?? 0),
    external_tax_paid: Number(r.external_tax_paid ?? 0),
    medical_insurance: Number(r.medical_insurance ?? 0),
    other_deductions: Number(r.other_deductions ?? 0),
    insurance_salary: Number(r.insurance_salary ?? 0),
    emergency_fund: Number(r.emergency_fund ?? 0),
    insurance_number: r.insurance_number ?? "",
    bank_account_name: r.bank_account_name ?? "",
    bank_account_number: r.bank_account_number ?? "",
  }));

  const filtered = rows.filter((r) =>
    !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || (r.emp_code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  function getVal(id: string, field: keyof AdvRow, base: number | string): number | string {
    const e = edits[id];
    if (e && field in e) return e[field] as any;
    return base;
  }

  function setEdit(id: string, field: keyof AdvRow, value: number | string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveRow(row: AdvRow) {
    const merged = { ...row, ...(edits[row.id] ?? {}) };
    setSaving((s) => ({ ...s, [row.id]: true }));
    try {
      await saveFn({
        data: {
          employee_id: row.id,
          external_income: merged.external_income,
          external_tax_paid: merged.external_tax_paid,
          medical_insurance: merged.medical_insurance,
          other_deductions: merged.other_deductions,
          insurance_salary: merged.insurance_salary,
          emergency_fund: merged.emergency_fund,
          insurance_number: merged.insurance_number,
          bank_account_name: merged.bank_account_name,
          bank_account_number: merged.bank_account_number,
        },
      });
      toast.success(`Saved for ${row.full_name}`);
      qc.invalidateQueries({ queryKey: ["advanced-payroll-settings"] });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving((s) => ({ ...s, [row.id]: false }));
    }
  }

  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const hasEdits = Object.keys(edits).length > 0;

  async function saveAll() {
    if (!hasEdits) return;
    setIsSavingBulk(true);
    try {
      const payload = Object.entries(edits).map(([id, e]) => {
        const row = rows.find((r) => r.id === id)!;
        return {
          employee_id: id,
          external_income: e.external_income ?? row.external_income,
          external_tax_paid: e.external_tax_paid ?? row.external_tax_paid,
          medical_insurance: e.medical_insurance ?? row.medical_insurance,
          other_deductions: e.other_deductions ?? row.other_deductions,
          insurance_salary: e.insurance_salary ?? row.insurance_salary,
          emergency_fund: e.emergency_fund ?? row.emergency_fund,
          insurance_number: e.insurance_number ?? row.insurance_number,
          bank_account_name: e.bank_account_name ?? row.bank_account_name,
          bank_account_number: e.bank_account_number ?? row.bank_account_number,
        };
      });
      await saveBulkFn({ data: payload });
      toast.success("Saved all changes");
      qc.invalidateQueries({ queryKey: ["advanced-payroll-settings"] });
      setEdits({});
    } catch (e: any) {
      toast.error(e.message || "Failed to save bulk changes");
    } finally {
      setIsSavingBulk(false);
    }
  }

  function exportExcel() {
    const data = rows.map((r) => ({
      "Name": r.full_name,
      "Code": r.emp_code || "",
      "Ins. Number": r.insurance_number,
      "Bank Acc. Name": r.bank_account_name,
      "Bank Acc. Number": r.bank_account_number,
      "External Income": r.external_income,
      "External Tax Paid": r.external_tax_paid,
      "Medical Insurance": r.medical_insurance,
      "Ins. Ceiling": r.insurance_salary,
      "Emerg. Fund": r.emergency_fund,
      "Other Deductions": r.other_deductions,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Advanced Settings");
    XLSX.writeFile(wb, "Payroll_Advanced_Settings.xlsx");
  }

  function importExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
        
        const newEdits = { ...edits };
        data.forEach((d: any) => {
          const emp = rows.find((r) => r.emp_code === d["Code"] || r.full_name === d["Name"]);
          if (emp) {
            newEdits[emp.id] = {
              ...newEdits[emp.id],
              insurance_number: d["Ins. Number"] !== undefined ? String(d["Ins. Number"]) : emp.insurance_number,
              bank_account_name: d["Bank Acc. Name"] !== undefined ? String(d["Bank Acc. Name"]) : emp.bank_account_name,
              bank_account_number: d["Bank Acc. Number"] !== undefined ? String(d["Bank Acc. Number"]) : emp.bank_account_number,
              external_income: Number(d["External Income"] ?? emp.external_income),
              external_tax_paid: Number(d["External Tax Paid"] ?? emp.external_tax_paid),
              medical_insurance: Number(d["Medical Insurance"] ?? emp.medical_insurance),
              insurance_salary: Number(d["Ins. Ceiling"] ?? emp.insurance_salary),
              emergency_fund: Number(d["Emerg. Fund"] ?? emp.emergency_fund),
              other_deductions: Number(d["Other Deductions"] ?? emp.other_deductions),
            };
          }
        });
        setEdits(newEdits);
        toast.success("Excel imported! Please review changes and click Save All.");
      } catch (err) {
        toast.error("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; // Reset
  }

  const fmtN = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">{t("advancedPayrollSettings")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("advancedPayrollDesc")}</p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t("externalIncome"), desc: t("externalIncomeDesc"), color: "bg-info/10 text-info border-info/20" },
          { label: t("externalTaxPaid"), desc: t("externalTaxPaidDesc"), color: "bg-success/10 text-success border-success/20" },
          { label: t("medicalInsurance"), desc: t("medicalInsuranceDesc"), color: "bg-warning/10 text-warning-foreground border-warning/20" },
          { label: t("insuranceSalary"), desc: t("insuranceSalaryDesc"), color: "bg-primary/10 text-primary border-primary/20" },
          { label: t("emergencyFund"), desc: t("emergencyFundDesc"), color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
          { label: t("otherDeductions"), desc: t("otherDeductionsDesc"), color: "bg-destructive/10 text-destructive border-destructive/20" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border p-3 ${c.color}`}>
            <p className="text-xs font-semibold">{c.label}</p>
            <p className="mt-1 text-[11px] opacity-80">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Table tools */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchEmployees")}
              className="w-full rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 ps-9 pe-4 text-sm text-foreground shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? t("employee") : t("employees")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasEdits && (
            <button
              onClick={saveAll}
              disabled={isSavingBulk}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSavingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All
            </button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted/40">
            <FileUp className="h-4 w-4 text-muted-foreground" />
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={importExcel} className="hidden" />
          </label>
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted/40"
          >
            <FileDown className="h-4 w-4 text-muted-foreground" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start min-w-[200px]">{t("name")}</th>
              <th className="px-4 py-3 text-start"><span className="text-muted-foreground">{t("insuranceNumber")}</span></th>
              <th className="px-4 py-3 text-start"><span className="text-muted-foreground">{t("bankAccountName")}</span></th>
              <th className="px-4 py-3 text-start"><span className="text-muted-foreground">{t("bankAccountNumber")}</span></th>
              <th className="px-4 py-3 text-center"><span className="text-info">{t("externalIncome")}</span></th>
              <th className="px-4 py-3 text-center"><span className="text-success">{t("externalTaxPaid")}</span></th>
              <th className="px-4 py-3 text-center"><span className="text-warning-foreground">{t("medicalInsurance")}</span></th>
              <th className="px-4 py-3 text-center"><span className="text-primary">{t("insuranceSalary")}</span></th>
              <th className="px-4 py-3 text-center"><span className="text-purple-600 dark:text-purple-400">{t("emergencyFund")}</span></th>
              <th className="px-4 py-3 text-center"><span className="text-destructive">{t("otherDeductions")}</span></th>
              <th className="px-4 py-3 text-center">{t("save")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No employees found.</td></tr>
            )}
            {paginated.map((row) => {
              const isDirty = !!edits[row.id] && Object.keys(edits[row.id]).length > 0;
              const rowEdits = edits[row.id] || {};
              return (
                <tr key={row.id} className={`transition-colors hover:bg-muted/20 ${isDirty ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium whitespace-pre-line leading-snug">{formatName3Words(row.full_name)}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">{row.emp_code ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="—"
                      value={getVal(row.id, "insurance_number", row.insurance_number)}
                      onChange={(e) => setEdit(row.id, "insurance_number", e.target.value)}
                      className={`w-36 rounded-md border bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-foreground shadow-xs transition hover:border-slate-400 dark:hover:border-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                        rowEdits.insurance_number !== undefined
                          ? "border-brand ring-1 ring-brand/30 bg-brand/5"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="—"
                      value={getVal(row.id, "bank_account_name", row.bank_account_name)}
                      onChange={(e) => setEdit(row.id, "bank_account_name", e.target.value)}
                      className={`w-44 rounded-md border bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-foreground shadow-xs transition hover:border-slate-400 dark:hover:border-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                        rowEdits.bank_account_name !== undefined
                          ? "border-brand ring-1 ring-brand/30 bg-brand/5"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="—"
                      value={getVal(row.id, "bank_account_number", row.bank_account_number)}
                      onChange={(e) => setEdit(row.id, "bank_account_number", e.target.value)}
                      className={`w-44 rounded-md border bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-foreground shadow-xs transition hover:border-slate-400 dark:hover:border-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                        rowEdits.bank_account_number !== undefined
                          ? "border-brand ring-1 ring-brand/30 bg-brand/5"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    />
                  </td>
                  {(["external_income", "external_tax_paid", "medical_insurance", "insurance_salary", "emergency_fund", "other_deductions"] as const).map((field) => (
                    <td key={field} className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={getVal(row.id, field, row[field])}
                        onChange={(e) => setEdit(row.id, field, Number(e.target.value))}
                        className={`w-28 rounded-md border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-center text-sm font-mono tabular-nums text-foreground shadow-xs transition hover:border-slate-400 dark:hover:border-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                          rowEdits[field] !== undefined
                            ? "border-brand ring-1 ring-brand/30 bg-brand/5"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => saveRow(row)}
                      disabled={!isDirty || saving[row.id]}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow disabled:opacity-40"
                    >
                      {saving[row.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="border-t border-border bg-muted/40 font-semibold text-sm">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-muted-foreground uppercase tracking-wider text-xs">Totals</td>
                {(["external_income", "external_tax_paid", "medical_insurance", "insurance_salary", "emergency_fund", "other_deductions"] as const).map((field) => (
                  <td key={field} className="px-4 py-3 text-center font-mono tabular-nums">
                    {fmtN(filtered.reduce((s, r) => s + (getVal(r.id, field, r[field]) as number), 0))}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <div className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span>–<span className="font-medium text-foreground">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span> of <span className="font-medium text-foreground">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-muted-foreground">Page <span className="font-medium text-foreground">{currentPage}</span> / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("advancedPayrollNote")}</p>
    </div>
  );
}