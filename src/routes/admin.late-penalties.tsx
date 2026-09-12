import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { listLatePenalties, upsertLatePenalty, deleteLatePenalty, bulkUpsertLatePenalties } from "@/backend/functions/late-penalties.functions";
import { LatePenaltySchema } from "@/backend/schemas";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/late-penalties")({ component: Page });

type Form = {
  id?: string;
  name: string;
  from_minutes: number;
  to_minutes: number;
  penalty_type: "deduction_minutes" | "deduction_amount" | "warning";
  penalty_value: number;
  is_active: boolean;
};

const blank: Form = {
  name: "",
  from_minutes: 0,
  to_minutes: 15,
  penalty_type: "warning",
  penalty_value: 0,
  is_active: true,
};

type ParsedPenaltyRow = {
  name: string;
  from_minutes: number;
  to_minutes: number;
  penalty_type: "deduction_minutes" | "deduction_amount" | "warning";
  penalty_value: number;
  is_active: boolean;
  isValid: boolean;
  error?: string;
};

const VALID_TYPES = ["deduction_minutes", "deduction_amount", "warning"] as const;

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listLatePenalties);
  const upsertFn = useServerFn(upsertLatePenalty);
  const delFn = useServerFn(deleteLatePenalty);
  const bulkUpsertFn = useServerFn(bulkUpsertLatePenalties);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);

  // Excel Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedPenaltyRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "late_penalties"], queryFn: () => listFn() });

  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: f }),
    onSuccess: () => {
      toast.success(form.id ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", "late_penalties"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "late_penalties"] });
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function submit() {
    const r = LatePenaltySchema.safeParse(form);
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

  const labels: Record<string, string> = {
    deduction_minutes: "Deduct minutes",
    deduction_amount: "Deduct amount",
    warning: "Warning only",
  };

  // 1. Download Excel Template
  async function handleDownloadTemplate() {
    try {
      await downloadTemplate(
        "late_penalties_template.xlsx",
        ["name", "from_minutes", "to_minutes", "penalty_type", "penalty_value", "is_active"],
        [
          {
            name: "Grace Late (1-15 min)",
            from_minutes: 1,
            to_minutes: 15,
            penalty_type: "warning",
            penalty_value: 0,
            is_active: true,
          },
          {
            name: "Moderate Late (16-30 min)",
            from_minutes: 16,
            to_minutes: 30,
            penalty_type: "deduction_minutes",
            penalty_value: 30,
            is_active: true,
          },
          {
            name: "Heavy Late (31-60 min)",
            from_minutes: 31,
            to_minutes: 60,
            penalty_type: "deduction_amount",
            penalty_value: 50,
            is_active: true,
          },
        ]
      );
      toast.success("Late penalties template downloaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to download template");
    }
  }

  // 2. Export Current Penalties to Excel
  async function handleExport() {
    if (rows.length === 0) return;
    try {
      const XLSX = await import("xlsx");
      const exportData = rows.map((r: any) => ({
        Name: r.name,
        "From (minutes)": r.from_minutes,
        "To (minutes)": r.to_minutes,
        "Penalty Type": labels[r.penalty_type] ?? r.penalty_type,
        "Penalty Value": r.penalty_value,
        Active: r.is_active ? "Yes" : "No",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Late Penalties");
      XLSX.writeFile(wb, `late_penalties_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Late penalties exported to Excel");
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

      const parsed: ParsedPenaltyRow[] = rawRows.map((r) => {
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

        const name = String(getVal("name", "penalty_name", "rule_name", "title") ?? "").trim();
        const fromRaw = getVal("from_minutes", "from", "start_minute", "min_minutes");
        const from_minutes = fromRaw != null && !isNaN(Number(fromRaw)) ? Math.max(0, Math.min(600, Math.round(Number(fromRaw)))) : 0;

        const toRaw = getVal("to_minutes", "to", "end_minute", "max_minutes");
        const to_minutes = toRaw != null && !isNaN(Number(toRaw)) ? Math.max(0, Math.min(600, Math.round(Number(toRaw)))) : 15;

        const typeRaw = String(getVal("penalty_type", "type", "kind") ?? "warning").trim().toLowerCase().replace(/[\s-]/g, "_");
        let penalty_type: "deduction_minutes" | "deduction_amount" | "warning" = "warning";
        if (typeRaw.includes("minute") || typeRaw === "deduction_minutes" || typeRaw === "deduct_minutes") {
          penalty_type = "deduction_minutes";
        } else if (typeRaw.includes("amount") || typeRaw.includes("money") || typeRaw === "deduction_amount" || typeRaw === "deduct_amount") {
          penalty_type = "deduction_amount";
        } else if (typeRaw.includes("warn") || typeRaw === "warning") {
          penalty_type = "warning";
        }

        const valRaw = getVal("penalty_value", "value", "penalty_amount", "amount");
        const penalty_value = valRaw != null && !isNaN(Number(valRaw)) ? Math.max(0, Number(valRaw)) : 0;

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
        } else if (to_minutes < from_minutes) {
          isValid = false;
          error = "To minutes must be ≥ From minutes";
        }

        return {
          name,
          from_minutes,
          to_minutes,
          penalty_type,
          penalty_value,
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
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid rules to import.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await bulkUpsertFn({
        data: {
          rules: validRows.map((r) => ({
            name: r.name,
            from_minutes: r.from_minutes,
            to_minutes: r.to_minutes,
            penalty_type: r.penalty_type,
            penalty_value: r.penalty_value,
            is_active: r.is_active,
          })),
        },
      });

      toast.success(`Import complete: ${res.inserted} created, ${res.updated} updated`);
      qc.invalidateQueries({ queryKey: ["admin", "late_penalties"] });
      setImportModalOpen(false);
      setParsedRows([]);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
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
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Late penalties</h1>
          <p className="text-sm text-muted-foreground">Rules applied when employees arrive late.</p>
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
            title="Import late penalties from Excel file"
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
            title="Export existing late penalties to Excel"
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
            <Plus className="me-1.5 h-4 w-4" /> Add rule
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Name</th>
              <th className="px-4 py-3 text-start">From</th>
              <th className="px-4 py-3 text-start">To</th>
              <th className="px-4 py-3 text-start">Penalty</th>
              <th className="px-4 py-3 text-start">Value</th>
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
                  No rules yet.
                </td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono">{r.from_minutes}m</td>
                  <td className="px-4 py-3 font-mono">{r.to_minutes}m</td>
                  <td className="px-4 py-3">{labels[r.penalty_type] ?? r.penalty_type}</td>
                  <td className="px-4 py-3 font-mono">{r.penalty_value}</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => {
                        setForm({ ...r, penalty_value: Number(r.penalty_value) });
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
            <DialogTitle>{form.id ? "Edit rule" : "Add rule"}</DialogTitle>
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
                <Label>From (min late)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.from_minutes}
                  onChange={(e) => setForm({ ...form, from_minutes: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>To (min late)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.to_minutes}
                  onChange={(e) => setForm({ ...form, to_minutes: Number(e.target.value) || 0 })}
                />
                {errs.to_minutes && <p className="text-xs text-destructive">{errs.to_minutes}</p>}
              </div>
            </div>
            <div>
              <Label>Penalty type</Label>
              <Select
                value={form.penalty_type}
                onValueChange={(v: any) => setForm({ ...form, penalty_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Warning only</SelectItem>
                  <SelectItem value="deduction_minutes">Deduct minutes</SelectItem>
                  <SelectItem value="deduction_amount">Deduct amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Penalty value</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.penalty_value}
                onChange={(e) => setForm({ ...form, penalty_value: Number(e.target.value) || 0 })}
              />
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
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
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
            <DialogTitle>Import Late Penalties Preview</DialogTitle>
            <DialogDescription>
              Review the parsed rules from <span className="font-mono font-medium">{importFileName}</span> before importing.
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
                    <th className="px-3 py-2 text-start">From</th>
                    <th className="px-3 py-2 text-start">To</th>
                    <th className="px-3 py-2 text-start">Type</th>
                    <th className="px-3 py-2 text-start">Value</th>
                    <th className="px-3 py-2 text-start">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-border last:border-b-0 ${
                        !r.isValid ? "bg-destructive/5 text-destructive" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.isValid ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Valid
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive"
                            title={r.error}
                          >
                            {r.error ?? "Invalid"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.name || "—"}</td>
                      <td className="px-3 py-2 font-mono">{r.from_minutes}m</td>
                      <td className="px-3 py-2 font-mono">{r.to_minutes}m</td>
                      <td className="px-3 py-2">{labels[r.penalty_type] ?? r.penalty_type}</td>
                      <td className="px-3 py-2 font-mono">{r.penalty_value}</td>
                      <td className="px-3 py-2">{r.is_active ? "Yes" : "No"}</td>
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
              Import {validCount} Rule{validCount === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}