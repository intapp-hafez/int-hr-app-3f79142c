import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { listKpis, upsertKpi, deleteKpi, bulkUpsertKpis } from "@/backend/functions/kpis.functions";
import { KpiSchema } from "@/backend/schemas";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/kpis")({ component: Page });

type Form = {
  id?: string;
  name: string;
  metric: string;
  target_value: number;
  unit: string;
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  weight: number;
  is_active: boolean;
};

type ParsedKpiRow = {
  name: string;
  metric: string;
  target_value: number;
  unit: string;
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  weight: number;
  is_active: boolean;
  isValid: boolean;
  error?: string;
};

const blank: Form = { name: "", metric: "", target_value: 0, unit: "", period: "monthly", weight: 1, is_active: true };

const VALID_PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKpis);
  const upsertFn = useServerFn(upsertKpi);
  const delFn = useServerFn(deleteKpi);
  const bulkUpsertFn = useServerFn(bulkUpsertKpis);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);

  // Excel Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [parsedKpis, setParsedKpis] = useState<ParsedKpiRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "kpis"], queryFn: () => listFn() });

  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: { ...f, unit: f.unit || null } }),
    onSuccess: () => {
      toast.success(form.id ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", "kpis"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "kpis"] });
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function submit() {
    const r = KpiSchema.safeParse({ ...form, unit: form.unit || null });
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => {
        const k = i.path[0] as string;
        if (k && !e[k]) e[k] = i.message;
      });
      setErrs(e);
      return;
    }
    setErrs({});
    m.mutate(form);
  }

  // 1. Download Excel Template
  async function handleDownloadTemplate() {
    try {
      await downloadTemplate(
        "kpi_template.xlsx",
        ["name", "metric", "target_value", "unit", "period", "weight", "is_active"],
        [
          {
            name: "Tasks Completed",
            metric: "tasks_completed",
            target_value: 40,
            unit: "tasks",
            period: "monthly",
            weight: 25,
            is_active: true,
          },
          {
            name: "Attendance Punctuality",
            metric: "punctuality_rate",
            target_value: 95,
            unit: "%",
            period: "monthly",
            weight: 20,
            is_active: true,
          },
          {
            name: "Customer Satisfaction",
            metric: "csat_score",
            target_value: 4.5,
            unit: "rating",
            period: "quarterly",
            weight: 30,
            is_active: true,
          },
          {
            name: "Sales Target",
            metric: "sales_amount",
            target_value: 150000,
            unit: "EGP",
            period: "monthly",
            weight: 25,
            is_active: true,
          },
        ]
      );
      toast.success("KPI template downloaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to download template");
    }
  }

  // 2. Export Current KPIs to Excel
  async function handleExport() {
    if (rows.length === 0) return;
    try {
      const XLSX = await import("xlsx");
      const exportData = rows.map((r: any) => ({
        Name: r.name,
        Metric: r.metric,
        Target: r.target_value,
        Unit: r.unit ?? "",
        Period: r.period,
        Weight: r.weight,
        Active: r.is_active ? "Yes" : "No",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KPIs");
      XLSX.writeFile(wb, `kpis_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("KPIs exported to Excel");
    } catch (err: any) {
      toast.error(err?.message ?? "Export failed");
    }
  }

  // 3. Handle File Selection and Parse
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportFileName(file.name);
      const rawRows = await parseExcelFile<Record<string, any>>(file);
      if (!rawRows || rawRows.length === 0) {
        toast.error("The selected file is empty or has no data rows.");
        return;
      }

      const parsed: ParsedKpiRow[] = rawRows.map((r) => {
        // Case-insensitive key lookup helper
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            if (r[k] !== undefined && r[k] !== "") return r[k];
            // Check case-insensitive match
            const lowerK = k.toLowerCase().replace(/[\s_-]/g, "");
            for (const rowKey of Object.keys(r)) {
              if (rowKey.toLowerCase().replace(/[\s_-]/g, "") === lowerK) {
                return r[rowKey];
              }
            }
          }
          return undefined;
        };

        const name = String(getVal("name", "kpi_name", "title") ?? "").trim();
        const metric = String(getVal("metric", "metric_name", "metric_code") ?? "").trim();
        const targetValRaw = getVal("target_value", "target", "value");
        const target_value = targetValRaw != null && !isNaN(Number(targetValRaw)) ? Math.max(0, Number(targetValRaw)) : 0;
        const unit = String(getVal("unit", "uom") ?? "").trim();
        
        const rawPeriod = String(getVal("period", "frequency") ?? "monthly").trim().toLowerCase();
        const period = (VALID_PERIODS as readonly string[]).includes(rawPeriod)
          ? (rawPeriod as (typeof VALID_PERIODS)[number])
          : "monthly";

        const weightRaw = getVal("weight", "weightage", "importance");
        const weight = weightRaw != null && !isNaN(Number(weightRaw)) ? Math.max(0, Number(weightRaw)) : 1;

        const activeRaw = getVal("is_active", "active", "enabled");
        let is_active = true;
        if (activeRaw !== undefined) {
          const strActive = String(activeRaw).trim().toLowerCase();
          is_active = strActive === "true" || strActive === "1" || strActive === "yes" || strActive === "y";
        }

        let isValid = true;
        let error: string | undefined;

        if (!name) {
          isValid = false;
          error = "Name is required";
        } else if (!metric) {
          isValid = false;
          error = "Metric is required";
        }

        return {
          name,
          metric,
          target_value,
          unit,
          period,
          weight,
          is_active,
          isValid,
          error,
        };
      });

      setParsedKpis(parsed);
      setImportModalOpen(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to read Excel file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // 4. Confirm Bulk Import
  async function confirmImport() {
    const validRows = parsedKpis.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid KPI rows to import.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await bulkUpsertFn({
        data: {
          kpis: validRows.map((r) => ({
            name: r.name,
            metric: r.metric,
            target_value: r.target_value,
            unit: r.unit || null,
            period: r.period,
            weight: r.weight,
            is_active: r.is_active,
          })),
        },
      });

      toast.success(`Successfully imported ${res.total} KPIs (${res.inserted} created, ${res.updated} updated)`);
      qc.invalidateQueries({ queryKey: ["admin", "kpis"] });
      setImportModalOpen(false);
      setParsedKpis([]);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  const validCount = parsedKpis.filter((r) => r.isValid).length;
  const invalidCount = parsedKpis.length - validCount;

  return (
    <div className="space-y-5">
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">KPIs</h1>
          <p className="text-sm text-muted-foreground">Performance indicators with targets and weights.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelected}
          />

          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadTemplate}
            className="rounded-full gap-1.5"
            title="Download blank Excel template with sample data"
          >
            <Download className="h-4 w-4" /> Download Template
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full gap-1.5"
            title="Import KPIs from an Excel or CSV spreadsheet"
          >
            <Upload className="h-4 w-4" /> Import Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="rounded-full gap-1.5 disabled:opacity-50"
            title="Export all current KPIs to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>

          <Button
            onClick={() => {
              setForm(blank);
              setErrs({});
              setOpen(true);
            }}
            className="rounded-full bg-gradient-brand text-brand-foreground shadow-brand gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add KPI
          </Button>
        </div>
      </div>

      {/* Main KPIs Table */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Name</th>
              <th className="px-4 py-3 text-start">Metric</th>
              <th className="px-4 py-3 text-start">Target</th>
              <th className="px-4 py-3 text-start">Unit</th>
              <th className="px-4 py-3 text-start">Period</th>
              <th className="px-4 py-3 text-start">Weight</th>
              <th className="px-4 py-3 text-start">Active</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No KPIs yet. Add a new KPI or import from Excel.
                </td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.metric}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.target_value}</td>
                  <td className="px-4 py-3">{r.unit ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{r.period}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.weight}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => {
                        setForm({
                          ...r,
                          target_value: Number(r.target_value),
                          weight: Number(r.weight),
                          unit: r.unit ?? "",
                        });
                        setErrs({});
                        setOpen(true);
                      }}
                      className="me-1 inline-grid h-7 w-7 place-items-center rounded-full bg-muted hover:bg-muted/80 hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDelId(r.id)}
                      className="inline-grid h-7 w-7 place-items-center rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit KPI" : "Add KPI"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
                placeholder="e.g. Tasks Completed"
              />
              {errs.name && <p className="text-xs text-destructive mt-1">{errs.name}</p>}
            </div>
            <div>
              <Label>Metric Key</Label>
              <Input
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
                maxLength={200}
                placeholder="e.g. tasks_completed"
              />
              {errs.metric && <p className="text-xs text-destructive mt-1">{errs.metric}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target Value</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.target_value}
                  onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  maxLength={40}
                  placeholder="%, calls, EGP"
                />
              </div>
              <div>
                <Label>Period</Label>
                <Select value={form.period} onValueChange={(v: any) => setForm({ ...form, period: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Weight</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">Enabled for evaluation</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={m.isPending} className="bg-gradient-brand text-brand-foreground">
              {m.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} {form.id ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (delId) dm.mutate(delId);
              }}
              disabled={dm.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {dm.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import from Excel Preview Dialog */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-brand" /> Import KPIs from Excel
            </DialogTitle>
            <DialogDescription>
              Review the parsed data from <span className="font-semibold text-foreground">{importFileName}</span> before importing.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-3 py-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {validCount} valid row{validCount === 1 ? "" : "s"}
            </span>
            {invalidCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> {invalidCount} invalid row{invalidCount === 1 ? "" : "s"} (will be skipped)
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto border border-border rounded-xl">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/50 sticky top-0 uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">Status</th>
                  <th className="px-3 py-2 text-start">Name</th>
                  <th className="px-3 py-2 text-start">Metric</th>
                  <th className="px-3 py-2 text-start">Target</th>
                  <th className="px-3 py-2 text-start">Unit</th>
                  <th className="px-3 py-2 text-start">Period</th>
                  <th className="px-3 py-2 text-start">Weight</th>
                  <th className="px-3 py-2 text-start">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsedKpis.map((row, idx) => (
                  <tr key={idx} className={row.isValid ? "hover:bg-muted/40" : "bg-destructive/5"}>
                    <td className="px-3 py-2">
                      {row.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-success" title="Ready to import" />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive" title={row.error}>
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-[10px]">{row.error}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.name || "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.metric || "—"}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.target_value}</td>
                    <td className="px-3 py-2">{row.unit || "—"}</td>
                    <td className="px-3 py-2 capitalize">{row.period}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.weight}</td>
                    <td className="px-3 py-2">{row.is_active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmImport}
              disabled={validCount === 0 || isImporting}
              className="bg-gradient-brand text-brand-foreground shadow-brand gap-1.5"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isImporting ? "Importing…" : `Confirm & Import (${validCount})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}