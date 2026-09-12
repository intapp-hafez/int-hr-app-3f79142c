import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { listShifts, upsertShift, deleteShift, bulkUpsertShifts } from "@/backend/functions/shifts.functions";
import { ShiftSchema } from "@/backend/schemas";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/shifts")({ component: Page });

type Form = { id?: string; name: string; start_time: string; end_time: string; grace_minutes: number; is_overnight: boolean; is_active: boolean };
const blank: Form = { name: "", start_time: "09:00", end_time: "17:00", grace_minutes: 0, is_overnight: false, is_active: true };

type ParsedShiftRow = {
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_overnight: boolean;
  is_active: boolean;
  isValid: boolean;
  error?: string;
};

function formatTime12(time24: string): string {
  if (!time24) return "—";
  const [h, m] = time24.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function normalizeTime(val: any): string {
  if (val == null || val === "") return "";
  if (typeof val === "number") {
    // Excel fraction of a day (e.g. 0.375 = 09:00)
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?$/);
  if (match) {
    const hh = match[1].padStart(2, "0");
    const mm = match[2];
    return `${hh}:${mm}`;
  }
  return s;
}

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listShifts);
  const upsertFn = useServerFn(upsertShift);
  const delFn = useServerFn(deleteShift);
  const bulkUpsertFn = useServerFn(bulkUpsertShifts);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);

  // Excel Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [parsedShifts, setParsedShifts] = useState<ParsedShiftRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "shifts"], queryFn: () => listFn() });

  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: f }),
    onSuccess: () => {
      toast.success(form.id ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", "shifts"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "shifts"] });
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function submit() {
    const r = ShiftSchema.safeParse(form);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach(i => {
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
        "shifts_template.xlsx",
        ["name", "start_time", "end_time", "grace_minutes", "is_overnight", "is_active"],
        [
          {
            name: "Morning Shift",
            start_time: "09:00",
            end_time: "17:00",
            grace_minutes: 15,
            is_overnight: false,
            is_active: true,
          },
          {
            name: "Evening Shift",
            start_time: "17:00",
            end_time: "01:00",
            grace_minutes: 15,
            is_overnight: true,
            is_active: true,
          },
          {
            name: "Night Shift",
            start_time: "00:00",
            end_time: "08:00",
            grace_minutes: 10,
            is_overnight: false,
            is_active: true,
          },
        ]
      );
      toast.success("Shifts template downloaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to download template");
    }
  }

  // 2. Export Current Shifts to Excel
  async function handleExport() {
    if (rows.length === 0) return;
    try {
      const XLSX = await import("xlsx");
      const exportData = rows.map((r: any) => ({
        Name: r.name,
        "Start Time": r.start_time,
        "End Time": r.end_time,
        "Grace Minutes": r.grace_minutes,
        Overnight: r.is_overnight ? "Yes" : "No",
        Active: r.is_active ? "Yes" : "No",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Shifts");
      XLSX.writeFile(wb, `shifts_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Shifts exported to Excel");
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

      const parsed: ParsedShiftRow[] = rawRows.map((r) => {
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

        const name = String(getVal("name", "shift_name", "title") ?? "").trim();
        const start_time = normalizeTime(getVal("start_time", "start", "from"));
        const end_time = normalizeTime(getVal("end_time", "end", "to"));

        const graceRaw = getVal("grace_minutes", "grace", "grace_period");
        const grace_minutes = graceRaw != null && !isNaN(Number(graceRaw)) ? Math.max(0, Math.min(240, Number(graceRaw))) : 0;

        const overnightRaw = getVal("is_overnight", "overnight");
        let is_overnight = false;
        if (overnightRaw !== undefined) {
          const strOvernight = String(overnightRaw).trim().toLowerCase();
          is_overnight = strOvernight === "true" || strOvernight === "1" || strOvernight === "yes" || strOvernight === "y";
        }

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
        } else if (!start_time || !/^\d{2}:\d{2}(:\d{2})?$/.test(start_time)) {
          isValid = false;
          error = "Start time must be HH:mm";
        } else if (!end_time || !/^\d{2}:\d{2}(:\d{2})?$/.test(end_time)) {
          isValid = false;
          error = "End time must be HH:mm";
        }

        return {
          name,
          start_time,
          end_time,
          grace_minutes,
          is_overnight,
          is_active,
          isValid,
          error,
        };
      });

      setParsedShifts(parsed);
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
    const validRows = parsedShifts.filter((s) => s.isValid);
    if (validRows.length === 0) {
      toast.error("No valid shifts to import.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await bulkUpsertFn({
        data: {
          shifts: validRows.map((s) => ({
            name: s.name,
            start_time: s.start_time,
            end_time: s.end_time,
            grace_minutes: s.grace_minutes,
            is_overnight: s.is_overnight,
            is_active: s.is_active,
          })),
        },
      });

      toast.success(`Import complete: ${res.inserted} created, ${res.updated} updated`);
      qc.invalidateQueries({ queryKey: ["admin", "shifts"] });
      setImportModalOpen(false);
      setParsedShifts([]);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  const validCount = parsedShifts.filter((s) => s.isValid).length;
  const invalidCount = parsedShifts.length - validCount;

  return (
    <div className="space-y-6">
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
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Shifts</h1>
          <p className="text-sm text-muted-foreground">Manage work shifts and grace periods</p>
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
            title="Import shifts from Excel file"
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
            title="Export existing shifts to Excel"
          >
            <FileSpreadsheet className="me-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            onClick={() => {
              setForm({ id: "", name: "", start_time: "09:00", end_time: "17:00", grace_minutes: 15, is_overnight: false, is_active: true });
              setErrs({});
              setOpen(true);
            }}
            className="rounded-full"
          >
            <Plus className="me-1.5 h-4 w-4" /> Add shift
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Start</th>
              <th className="px-4 py-3 font-semibold">End</th>
              <th className="px-4 py-3 font-semibold">Grace</th>
              <th className="px-4 py-3 font-semibold">Overnight</th>
              <th className="px-4 py-3 font-semibold">Active</th>
              <th className="px-4 py-3"></th>
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
                  No shifts yet.
                </td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono">{formatTime12(r.start_time)}</td>
                  <td className="px-4 py-3 font-mono">{formatTime12(r.end_time)}</td>
                  <td className="px-4 py-3 font-mono">{r.grace_minutes}m</td>
                  <td className="px-4 py-3">{r.is_overnight ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => {
                        setForm({ ...r });
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
            <DialogTitle>{form.id ? "Edit shift" : "Add shift"}</DialogTitle>
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
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>End time</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Grace (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={240}
                value={form.grace_minutes}
                onChange={(e) => setForm({ ...form, grace_minutes: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label>Overnight shift</Label>
              <Switch
                checked={form.is_overnight}
                onCheckedChange={(v) => setForm({ ...form, is_overnight: v })}
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
            <AlertDialogTitle>Delete shift?</AlertDialogTitle>
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
            <DialogTitle>Import Shifts Preview</DialogTitle>
            <DialogDescription>
              Review the parsed shifts from <span className="font-mono font-medium">{importFileName}</span> before importing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
                Total: {parsedShifts.length}
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
                    <th className="px-3 py-2 text-start">Start</th>
                    <th className="px-3 py-2 text-start">End</th>
                    <th className="px-3 py-2 text-start">Grace</th>
                    <th className="px-3 py-2 text-start">Overnight</th>
                    <th className="px-3 py-2 text-start">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedShifts.map((s, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-border last:border-b-0 ${
                        !s.isValid ? "bg-destructive/5 text-destructive" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {s.isValid ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Valid
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive"
                            title={s.error}
                          >
                            {s.error ?? "Invalid"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{s.name || "—"}</td>
                      <td className="px-3 py-2 font-mono">{s.start_time || "—"}</td>
                      <td className="px-3 py-2 font-mono">{s.end_time || "—"}</td>
                      <td className="px-3 py-2 font-mono">{s.grace_minutes}m</td>
                      <td className="px-3 py-2">{s.is_overnight ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{s.is_active ? "Yes" : "No"}</td>
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
              Import {validCount} Shift{validCount === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}