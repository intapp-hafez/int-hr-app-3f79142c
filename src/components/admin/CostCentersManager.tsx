import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search, Download, Upload, FileSpreadsheet, X, CheckCircle2, XCircle } from "lucide-react";
import { listCostCenters, upsertCostCenter, deleteCostCenter, type CostCenterRow } from "@/backend/functions/directory.functions";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { useI18n } from "@/lib/i18n";

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

type CostCenterDraft = {
  id?: string;
  code: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  status: "active" | "inactive";
};

const emptyDraft: CostCenterDraft = {
  code: "",
  name_en: "",
  name_ar: "",
  description_en: "",
  description_ar: "",
  status: "active",
};

export function CostCentersManager() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listCostCenters);
  const upsertFn = useServerFn(upsertCostCenter);
  const deleteFn = useServerFn(deleteCostCenter);

  const { data: costCenters = [], isLoading } = useQuery({
    queryKey: ["cost_centers"],
    queryFn: () => listFn(),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<CostCenterDraft>(emptyDraft);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const upsertMut = useMutation({
    mutationFn: (data: CostCenterDraft) => upsertFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      qc.invalidateQueries({ queryKey: ["cities-districts"] });
      toast.success(draft.id ? "Cost center updated" : "Cost center added");
      setModalOpen(false);
      setDraft(emptyDraft);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save cost center"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      qc.invalidateQueries({ queryKey: ["cities-districts"] });
      toast.success("Cost center deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete cost center"),
  });

  const filtered = useMemo(() => {
    let list = costCenters;
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status.toLowerCase() === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name_en.toLowerCase().includes(q) ||
          c.name_ar.toLowerCase().includes(q) ||
          (c.description_en && c.description_en.toLowerCase().includes(q)) ||
          (c.description_ar && c.description_ar.toLowerCase().includes(q))
      );
    }
    return list;
  }, [costCenters, statusFilter, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedList = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function openCreate() {
    setDraft(emptyDraft);
    setModalOpen(true);
  }

  function openEdit(item: CostCenterRow) {
    setDraft({
      id: item.id,
      code: item.code,
      name_en: item.name_en,
      name_ar: item.name_ar,
      description_en: item.description_en ?? "",
      description_ar: item.description_ar ?? "",
      status: item.status.toLowerCase() === "inactive" ? "inactive" : "active",
    });
    setModalOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.code.trim()) return toast.error("Code (#) is required");
    if (!draft.name_en.trim()) return toast.error("English name is required");
    if (!draft.name_ar.trim()) return toast.error("Arabic name is required");
    upsertMut.mutate(draft);
  }

  function toggleStatus(item: CostCenterRow) {
    const nextStatus = item.status.toLowerCase() === "active" ? "inactive" : "active";
    upsertMut.mutate({
      id: item.id,
      code: item.code,
      name_en: item.name_en,
      name_ar: item.name_ar,
      description_en: item.description_en ?? "",
      description_ar: item.description_ar ?? "",
      status: nextStatus,
    });
  }

  async function handleImport(file: File) {
    try {
      const rows = await parseExcelFile<{
        code?: string;
        name_en?: string;
        name_ar?: string;
        description_en?: string;
        description_ar?: string;
        status?: string;
      }>(file);
      let ok = 0;
      let fail = 0;
      for (const r of rows) {
        const code = String(r.code ?? "").trim();
        const name_en = String(r.name_en ?? "").trim();
        const name_ar = String(r.name_ar ?? "").trim();
        if (!code || !name_en || !name_ar) {
          fail++;
          continue;
        }
        try {
          await upsertMut.mutateAsync({
            code,
            name_en,
            name_ar,
            description_en: String(r.description_en ?? "").trim(),
            description_ar: String(r.description_ar ?? "").trim(),
            status: String(r.status ?? "").toLowerCase() === "inactive" ? "inactive" : "active",
          });
          ok++;
        } catch {
          fail++;
        }
      }
      toast.success(`Imported ${ok} cost centers, failed ${fail}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    }
  }

  async function handleExport() {
    const XLSX = await import("xlsx");
    const data = filtered.map((c) => ({
      code: c.code,
      name_en: c.name_en,
      name_ar: c.name_ar,
      description_en: c.description_en ?? "",
      description_ar: c.description_ar ?? "",
      status: c.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CostCenters");
    XLSX.writeFile(wb, `cost_centers_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              downloadTemplate(
                "cost_centers_template.xlsx",
                ["code", "name_en", "name_ar", "description_en", "description_ar", "status"],
                [
                  {
                    code: "CC-101",
                    name_en: "Operations",
                    name_ar: "العمليات",
                    description_en: "Operations cost center",
                    description_ar: "مركز تكلفة العمليات",
                    status: "active",
                  },
                ]
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Download template
          </button>
          <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-muted">
            <Upload className="h-3.5 w-3.5" /> Import from Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
          </button>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> {t("addCostCenter" as any) ?? "Add Cost Center"}
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search cost centers by code, name, description…"
            className={inputCls + " ps-9"}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setPage(1);
          }}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-start font-semibold"># Code</th>
              <th className="px-4 py-3 text-start font-semibold">{t("nameEn" as any) ?? "Name (EN)"}</th>
              <th className="px-4 py-3 text-start font-semibold">{t("nameAr" as any) ?? "Name (AR)"}</th>
              <th className="px-4 py-3 text-start font-semibold">Description (EN)</th>
              <th className="px-4 py-3 text-start font-semibold">Description (AR)</th>
              <th className="px-4 py-3 text-start font-semibold">Status</th>
              <th className="px-4 py-3 text-end font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagedList.map((c) => {
              const isActive = c.status.toLowerCase() === "active";
              return (
                <tr key={c.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">
                    <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                      {c.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{c.name_en}</td>
                  <td className="px-4 py-3 font-medium text-foreground" dir="rtl">
                    {c.name_ar}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate" title={c.description_en ?? ""}>
                    {c.description_en || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate" dir="rtl" title={c.description_ar ?? ""}>
                    {c.description_ar || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(c)}
                      title="Click to toggle status"
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                      }`}
                    >
                      {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        title="Edit"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete cost center "${c.code} - ${c.name_en}"?`)) {
                            deleteMut.mutate(c.id);
                          }
                        }}
                        title="Delete"
                        className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pagedList.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  {isLoading ? "Loading cost centers…" : "No cost centers found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2 text-sm">
          <button
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted-foreground text-xs">
            Page {safePage} of {pageCount} ({filtered.length} total)
          </span>
          <button
            disabled={safePage >= pageCount}
            onClick={() => setPage(safePage + 1)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-semibold">
                {draft.id ? (t("editCostCenter" as any) ?? "Edit Cost Center") : (t("addCostCenter" as any) ?? "Add Cost Center")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    # Code <span className="text-destructive">*</span>
                  </span>
                  <input
                    required
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    placeholder="e.g. CC-101"
                    className={inputCls + " font-mono"}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Status <span className="text-destructive">*</span>
                  </span>
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
                    className={inputCls}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("nameEn" as any) ?? "Name (English)"} <span className="text-destructive">*</span>
                  </span>
                  <input
                    required
                    value={draft.name_en}
                    onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
                    placeholder="e.g. Operations"
                    className={inputCls}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("nameAr" as any) ?? "Name (Arabic)"} <span className="text-destructive">*</span>
                  </span>
                  <input
                    required
                    dir="rtl"
                    value={draft.name_ar}
                    onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
                    placeholder="مثال: العمليات"
                    className={inputCls}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("descriptionEn" as any) ?? "Description (English)"}
                </span>
                <textarea
                  rows={2}
                  value={draft.description_en}
                  onChange={(e) => setDraft({ ...draft, description_en: e.target.value })}
                  placeholder="Optional notes or details…"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("descriptionAr" as any) ?? "Description (Arabic)"}
                </span>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={draft.description_ar}
                  onChange={(e) => setDraft({ ...draft, description_ar: e.target.value })}
                  placeholder="ملاحظات أو تفاصيل اختيارية…"
                  className={inputCls}
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={upsertMut.isPending}
                  className="rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
                >
                  {upsertMut.isPending ? "Saving…" : draft.id ? "Save changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
