import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { listAllowances, upsertAllowance, deleteAllowance, bulkUpsertAllowances } from "@/backend/functions/allowances.functions";
import { AllowanceSchema } from "@/backend/schemas";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { TripAllowancesTab } from "@/components/admin/TripAllowancesTab";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/allowances")({ component: Page });

type Form = {
  id?: string;
  name: string;
  kind: "fixed" | "percent" | "per_day" | "per_km";
  amount: number;
  currency: string;
  taxable: boolean;
  is_active: boolean;
};

const blank: Form = {
  name: "",
  kind: "fixed",
  amount: 0,
  currency: "EGP",
  taxable: false,
  is_active: true,
};

type ParsedAllowanceRow = {
  name: string;
  kind: "fixed" | "percent" | "per_day" | "per_km";
  amount: number;
  currency: string;
  taxable: boolean;
  is_active: boolean;
  isValid: boolean;
  error?: string;
};

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllowances);
  const upsertFn = useServerFn(upsertAllowance);
  const delFn = useServerFn(deleteAllowance);
  const bulkUpsertFn = useServerFn(bulkUpsertAllowances);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("general");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);

  // Excel Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedAllowanceRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "allowances"], queryFn: () => listFn() });

  const m = useMutation({
    mutationFn: (f: Form) => upsertFn({ data: f }),
    onSuccess: () => {
      toast.success(form.id ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", "allowances"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const dm = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "allowances"] });
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function submit() {
    const r = AllowanceSchema.safeParse(form);
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
        "allowances_template.xlsx",
        ["name", "kind", "amount", "currency", "taxable", "is_active"],
        [
          {
            name: "Housing Allowance",
            kind: "fixed",
            amount: 1500,
            currency: "EGP",
            taxable: false,
            is_active: true,
          },
          {
            name: "Transport Per Diem",
            kind: "per_day",
            amount: 100,
            currency: "EGP",
            taxable: false,
            is_active: true,
          },
          {
            name: "Mileage Allowance",
            kind: "per_km",
            amount: 3.5,
            currency: "EGP",
            taxable: false,
            is_active: true,
          },
          {
            name: "Performance Bonus",
            kind: "percent",
            amount: 10,
            currency: "EGP",
            taxable: true,
            is_active: true,
          },
        ]
      );
      toast.success("Allowances template downloaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to download template");
    }
  }

  // 2. Export Current Allowances to Excel
  async function handleExport() {
    if (rows.length === 0) return;
    try {
      const XLSX = await import("xlsx");
      const exportData = rows.map((r: any) => ({
        Name: r.name,
        Kind: r.kind,
        Amount: r.amount,
        Currency: r.currency,
        Taxable: r.taxable ? "Yes" : "No",
        Active: r.is_active ? "Yes" : "No",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Allowances");
      XLSX.writeFile(wb, `allowances_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Allowances exported to Excel");
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

      const parsed: ParsedAllowanceRow[] = rawRows.map((r) => {
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

        const name = String(getVal("name", "allowance_name", "title") ?? "").trim();

        const kindRaw = String(getVal("kind", "type") ?? "fixed").trim().toLowerCase().replace(/[\s-]/g, "_");
        let kind: "fixed" | "percent" | "per_day" | "per_km" = "fixed";
        if (kindRaw === "percent" || kindRaw === "percentage" || kindRaw.includes("percent")) {
          kind = "percent";
        } else if (kindRaw === "per_day" || kindRaw === "daily" || kindRaw.includes("day")) {
          kind = "per_day";
        } else if (kindRaw === "per_km" || kindRaw === "mileage" || kindRaw.includes("km")) {
          kind = "per_km";
        } else {
          kind = "fixed";
        }

        const amtRaw = getVal("amount", "value", "val");
        const amount = amtRaw != null && !isNaN(Number(amtRaw)) ? Math.max(0, Number(amtRaw)) : 0;

        const currency = String(getVal("currency", "curr") ?? "EGP").trim().toUpperCase() || "EGP";

        const taxRaw = getVal("taxable", "is_taxable", "tax");
        let taxable = false;
        if (taxRaw !== undefined) {
          const strTax = String(taxRaw).trim().toLowerCase();
          taxable = strTax === "true" || strTax === "1" || strTax === "yes" || strTax === "y";
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
        }

        return {
          name,
          kind,
          amount,
          currency,
          taxable,
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
      toast.error("No valid allowances to import.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await bulkUpsertFn({
        data: {
          allowances: validRows.map((a) => ({
            name: a.name,
            kind: a.kind,
            amount: a.amount,
            currency: a.currency,
            taxable: a.taxable,
            is_active: a.is_active,
          })),
        },
      });

      toast.success(`Import complete: ${res.inserted} created, ${res.updated} updated`);
      qc.invalidateQueries({ queryKey: ["admin", "allowances"] });
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

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Allowances</h1>
          <p className="text-sm text-muted-foreground">Pay allowances and trip policies.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">General Allowances</TabsTrigger>
          <TabsTrigger value="trips">Trip Allowances</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
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
              title="Import allowances from Excel file"
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
              title="Export existing allowances to Excel"
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
              <Plus className="me-1.5 h-4 w-4" /> Add allowance
            </Button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">Name</th>
                  <th className="px-4 py-3 text-start">Kind</th>
                  <th className="px-4 py-3 text-start">Amount</th>
                  <th className="px-4 py-3 text-start">Currency</th>
                  <th className="px-4 py-3 text-start">Taxable</th>
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
                      No allowances yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 capitalize">{r.kind.replace("_", " ")}</td>
                      <td className="px-4 py-3 font-mono">{r.amount}</td>
                      <td className="px-4 py-3">{r.currency}</td>
                      <td className="px-4 py-3">{r.taxable ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-end">
                        <button
                          onClick={() => {
                            setForm({ ...r, amount: Number(r.amount) });
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
                <DialogTitle>{form.id ? "Edit allowance" : "Add allowance"}</DialogTitle>
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
                    <Label>Kind</Label>
                    <Select
                      value={form.kind}
                      onValueChange={(v: any) => setForm({ ...form, kind: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="percent">Percent of salary</SelectItem>
                        <SelectItem value="per_day">Per day</SelectItem>
                        <SelectItem value="per_km">Per km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      maxLength={8}
                    />
                  </div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label>Taxable</Label>
                  <Switch
                    checked={form.taxable}
                    onCheckedChange={(v) => setForm({ ...form, taxable: v })}
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
                <AlertDialogTitle>Delete allowance?</AlertDialogTitle>
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
                <DialogTitle>Import Allowances Preview</DialogTitle>
                <DialogDescription>
                  Review the parsed allowances from <span className="font-mono font-medium">{importFileName}</span> before importing.
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
                        <th className="px-3 py-2 text-start">Kind</th>
                        <th className="px-3 py-2 text-start">Amount</th>
                        <th className="px-3 py-2 text-start">Currency</th>
                        <th className="px-3 py-2 text-start">Taxable</th>
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
                          <td className="px-3 py-2 capitalize">{r.kind.replace("_", " ")}</td>
                          <td className="px-3 py-2 font-mono">{r.amount}</td>
                          <td className="px-3 py-2">{r.currency}</td>
                          <td className="px-3 py-2">{r.taxable ? "Yes" : "No"}</td>
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
                  Import {validCount} Allowance{validCount === 1 ? "" : "s"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
        <TabsContent value="trips" className="mt-4">
          <TripAllowancesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}