import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { listTargetsOvertime, upsertTargetsOvertime, deleteTargetsOvertime, bulkUpsertTargetsOvertime } from "@/backend/functions/targets-overtime.functions";
import { TargetsOvertimeSchema } from "@/backend/schemas";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/targets-overtime")({ component: Page });

type Form = {
  id?: string;
  name: string;
  daily_target_hours: number;
  weekly_target_hours: number;
  overtime_rate: number;
  overtime_cap_hours: number;
  is_active: boolean;
};

const blank: Form = {
  name: "",
  daily_target_hours: 8,
  weekly_target_hours: 40,
  overtime_rate: 1.5,
  overtime_cap_hours: 4,
  is_active: true,
};

type ParsedPolicyRow = {
  name: string;
  daily_target_hours: number;
  weekly_target_hours: number;
  overtime_rate: number;
  overtime_cap_hours: number;
  is_active: boolean;
  isValid: boolean;
  error?: string;
};

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTargetsOvertime);
  const upsertFn = useServerFn(upsertTargetsOvertime);
  const delFn = useServerFn(deleteTargetsOvertime);
  const bulkUpsertFn = useServerFn(bulkUpsertTargetsOvertime);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);

  // Excel Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedPolicyRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "targets_overtime"], queryFn: () => listFn() });

  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: f }),
    onSuccess: () => {
      toast.success(form.id ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", "targets_overtime"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "targets_overtime"] });
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function submit() {
    const r = TargetsOvertimeSchema.safeParse(form);
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
        "targets_overtime_template.xlsx",
        ["name", "daily_target_hours", "weekly_target_hours", "overtime_rate", "overtime_cap_hours", "is_active"],
        [
          {
            name: "Standard Full-Time",
            daily_target_hours: 8,
            weekly_target_hours: 40,
            overtime_rate: 1.5,
            overtime_cap_hours: 4,
            is_active: true,
          },
          {
            name: "Part-Time 6h",
            daily_target_hours: 6,
            weekly_target_hours: 30,
            overtime_rate: 1.25,
            overtime_cap_hours: 2,
            is_active: true,
          },
          {
            name: "Night Shift Policy",
            daily_target_hours: 8,
            weekly_target_hours: 40,
            overtime_rate: 2.0,
            overtime_cap_hours: 4,
            is_active: true,
          },
        ]
      );
      toast.success("Targets & Overtime template downloaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to download template");
    }
  }

  // 2. Export Current Policies to Excel
  async function handleExport() {
    if (rows.length === 0) return;
    try {
      const XLSX = await import("xlsx");
      const exportData = rows.map((r: any) => ({
        Name: r.name,
        "Daily Target (h)": r.daily_target_hours,
        "Weekly Target (h)": r.weekly_target_hours,
        "Overtime Rate": r.overtime_rate,
        "Overtime Cap (h)": r.overtime_cap_hours,
        Active: r.is_active ? "Yes" : "No",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Targets & Overtime");
      XLSX.writeFile(wb, `targets_overtime_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Targets & Overtime exported to Excel");
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

      const parsed: ParsedPolicyRow[] = rawRows.map((r) => {
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            if (r[k] !== undefined && r[k] !== "") return r[k];
            const lowerK = k.toLowerCase().replace(/[\s_-]/g, "");
            for (const rowKey of Object.keys(r)) {
              if (rowKey.toLowerCase().replace(/[\s_-]/g, "") === lowerK) {
                return r[rowKey];
              }
            }
          }
          return undefined;
        };

        const name = String(getVal("name", "policy_name", "title") ?? "").trim();

        const dailyRaw = getVal("daily_target_hours", "daily", "daily_hours", "daily_target");
        const daily_target_hours = dailyRaw != null && !isNaN(Number(dailyRaw)) ? Math.max(0, Math.min(24, Number(dailyRaw))) : 8;

        const weeklyRaw = getVal("weekly_target_hours", "weekly", "weekly_hours", "weekly_target");
        const weekly_target_hours = weeklyRaw != null && !isNaN(Number(weeklyRaw)) ? Math.max(0, Math.min(168, Number(weeklyRaw))) : 40;

        const rateRaw = getVal("overtime_rate", "ot_rate", "rate");
        const overtime_rate = rateRaw != null && !isNaN(Number(rateRaw)) ? Math.max(0, Math.min(10, Number(rateRaw))) : 1.5;

        const capRaw = getVal("overtime_cap_hours", "ot_cap", "cap_hours", "cap");
        const overtime_cap_hours = capRaw != null && !isNaN(Number(capRaw)) ? Math.max(0, Math.min(168, Number(capRaw))) : 4;

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
        }

        return {
          name,
          daily_target_hours,
          weekly_target_hours,
          overtime_rate,
          overtime_cap_hours,
          is_active,
          isValid,
          error,
        };
      });

      setParsedRows(parsed);
      setImportModalOpen(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to parse Excel file");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // 4. Confirm Import
  async function handleConfirmImport() {
    const validRows = parsedRows.filter((p) => p.isValid);
    if (validRows.length === 0) {
      toast.error("No valid policies to import.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await bulkUpsertFn({
        data: {
          policies: validRows.map((p) => ({
            name: p.name,
            daily_target_hours: p.daily_target_hours,
            weekly_target_hours: p.weekly_target_hours,
            overtime_rate: p.overtime_rate,
            overtime_cap_hours: p.overtime_cap_hours,
            is_active: p.is_active,
          })),
        },
      });

      toast.success(`Import complete: ${res.inserted} created, ${res.updated} updated`);
      qc.invalidateQueries({ queryKey: ["admin", "targets_overtime"] });
      setImportModalOpen(false);
      setParsedRows([]);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  const validCount = parsedRows.filter((p) => p.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="space-y-5">
      {/* Hidden input for excel import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Targets & Overtime</h1>
          <p className="text-sm text-muted-foreground">Daily/weekly hour targets and overtime rates.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="rounded-full"
            title="Download blank sample Excel template"
          >
            <Download className="me-1.5 h-3.5 w-3.5" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full"
            title="Import policies from Excel file"
          >
            <Upload className="me-1.5 h-3.5 w-3.5" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="rounded-full"
            title="Export existing policies to Excel"
          >
            <FileSpreadsheet className="me-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            onClick={() => {
              setForm(blank);
              setErrs({});
              setOpen(true);
            }}
            className="rounded-full"
          >
            <Plus className="me-1.5 h-4 w-4" /> Add policy
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Name</th>
              <th className="px-4 py-3 text-start">Daily</th>
              <th className="px-4 py-3 text-start">Weekly</th>
              <th className="px-4 py-3 text-start">OT rate</th>
              <th className="px-4 py-3 text-start">OT cap</th>
              <th className="px-4 py-3 text-start">Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No policies yet.
                </td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono">{r.daily_target_hours}h</td>
                  <td className="px-4 py-3 font-mono">{r.weekly_target_hours}h</td>
                  <td className="px-4 py-3 font-mono">×{r.overtime_rate}</td>
                  <td className="px-4 py-3 font-mono">{r.overtime_cap_hours}h</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => {
                        setForm({
                          ...r,
                          daily_target_hours: Number(r.daily_target_hours),
                          weekly_target_hours: Number(r.weekly_target_hours),
                          overtime_rate: Number(r.overtime_rate),
                          overtime_cap_hours: Number(r.overtime_cap_hours),
                        });
                        setErrs({});
                        setOpen(true);
                      }}
                      className="me-1 inline-grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDelId(r.id)}
                      className="inline-grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-destructive"
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

      {/* Edit / Add Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit policy" : "Add policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
              {errs.name && <p className="text-xs text-destructive">{errs.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Daily target (h)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.daily_target_hours}
                  onChange={(e) => setForm({ ...form, daily_target_hours: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Weekly target (h)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.weekly_target_hours}
                  onChange={(e) => setForm({ ...form, weekly_target_hours: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Overtime rate</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.overtime_rate}
                  onChange={(e) => setForm({ ...form, overtime_rate: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Overtime cap (h)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.overtime_cap_hours}
                  onChange={(e) => setForm({ ...form, overtime_cap_hours: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label>Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={m.isPending}>
              {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {form.id ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete policy?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (delId) dm.mutate(delId);
              }}
              disabled={dm.isPending}
            >
              {dm.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excel Import Preview Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Targets & Overtime Preview</DialogTitle>
            <DialogDescription>
              Review the parsed policies from <span className="font-mono font-medium">{importFileName}</span> before importing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
                Total: {parsedRows.length}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Valid: {validCount}
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> Invalid: {invalidCount}
                </span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b border-border bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-start">Status</th>
                    <th className="px-3 py-2 text-start">Name</th>
                    <th className="px-3 py-2 text-start">Daily Target</th>
                    <th className="px-3 py-2 text-start">Weekly Target</th>
                    <th className="px-3 py-2 text-start">OT Rate</th>
                    <th className="px-3 py-2 text-start">OT Cap</th>
                    <th className="px-3 py-2 text-start">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((p, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-border last:border-b-0 ${
                        !p.isValid ? "bg-destructive/5 text-destructive" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.isValid ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Valid
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive"
                            title={p.error}
                          >
                            {p.error ?? "Invalid"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{p.name || "—"}</td>
                      <td className="px-3 py-2 font-mono">{p.daily_target_hours}h</td>
                      <td className="px-3 py-2 font-mono">{p.weekly_target_hours}h</td>
                      <td className="px-3 py-2 font-mono">×{p.overtime_rate}</td>
                      <td className="px-3 py-2 font-mono">{p.overtime_cap_hours}h</td>
                      <td className="px-3 py-2">{p.is_active ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Note: Invalid rows will be skipped automatically during import.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={validCount === 0 || isImporting}
            >
              {isImporting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Import {validCount} Polic{validCount === 1 ? "y" : "ies"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}