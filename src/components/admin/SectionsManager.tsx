import { useState, useMemo } from "react";
import { Plus, Check, X, Pencil, Trash2, Search, Filter, Layers, FileSpreadsheet } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listSections, upsertSection, deleteSection, listDepartments } from "@/backend/functions/directory.functions";

type SectionDraft = {
  id?: string;
  name_en: string;
  name_ar: string;
  department_id: string;
  active: boolean;
};

const emptyDraft: SectionDraft = {
  name_en: "",
  name_ar: "",
  department_id: "",
  active: true,
};

export function SectionsManager() {
  const qc = useQueryClient();
  const fetchSections = useServerFn(listSections);
  const fetchDepartments = useServerFn(listDepartments);
  const mUpsertFn = useServerFn(upsertSection);
  const mDelFn = useServerFn(deleteSection);

  const { data: sections, isLoading } = useQuery({ queryKey: ["all-sections"], queryFn: () => fetchSections() });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => fetchDepartments() });

  const [draftId, setDraftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SectionDraft>(emptyDraft);
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const mUpsert = useMutation({
    mutationFn: (data: any) => mUpsertFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-sections"] });
      toast.success("Level saved successfully");
      setDraftId(null);
      setDraft(emptyDraft);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => mDelFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-sections"] });
      toast.success("Level deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredSections = useMemo(() => {
    if (!sections) return [];
    let list = sections as any[];

    if (deptFilter === "__global__") {
      list = list.filter((s: any) => !s.department_id);
    } else if (deptFilter) {
      list = list.filter((s: any) => s.department_id === deptFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s: any) =>
        s.name_en?.toLowerCase().includes(q) ||
        s.name_ar?.toLowerCase().includes(q) ||
        s.departments?.name_en?.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a: any, b: any) => {
      return (a.name_en || "").localeCompare(b.name_en || "", undefined, { numeric: true, sensitivity: "base" });
    });
  }, [sections, deptFilter, searchQuery]);

  async function handleExport() {
    const list = filteredSections;
    if (!list || list.length === 0) {
      toast.error("No levels to export");
      return;
    }
    const XLSX = await import("xlsx");
    const exportRows = list.map((s: any) => ({
      "Level Name (EN)": s.name_en ?? "",
      "Level Name (AR)": s.name_ar ?? "",
      "Department": s.departments?.name_en ?? (s.department_id ? s.department_name ?? "" : "All Departments (Global)"),
      "Status": s.active ? "Active" : "Inactive",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Levels");
    XLSX.writeFile(wb, `levels_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${exportRows.length} levels`);
  }

  const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Levels</h2>
            <span className="rounded-full bg-brand/10 text-brand px-2.5 py-0.5 text-xs font-semibold">
              Grading
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage organization levels and grading bands (LEVEL 1 to LEVEL 6, A+, B+, C+).
          </p>
        </div>
        {draftId !== "new" && (
          <button
            onClick={() => {
              setDraftId("new");
              setDraft({
                ...emptyDraft,
                department_id: deptFilter === "__global__" ? "" : deptFilter || "",
              });
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Level
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search levels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-1.5 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand"
          >
            <option value="">All Departments</option>
            <option value="__global__">— Company-wide (Global) —</option>
            {(departments ?? []).map((d: any) => (
              <option key={d.id} value={d.id}>{d.name_en}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={!filteredSections || filteredSections.length === 0}
          className="ms-auto inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> Export Excel
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 font-medium text-muted-foreground">
            <tr>
              <th className="p-4 w-1/3">Level Name (EN / AR)</th>
              <th className="p-4 w-1/3">Department</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {draftId === "new" && (
              <tr className="bg-brand/5">
                <td className="p-4">
                  <div className="space-y-2">
                    <input
                      autoFocus
                      placeholder="e.g. LEVEL 1 - A+"
                      className={inputCls}
                      value={draft.name_en}
                      onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
                    />
                    <input
                      placeholder="e.g. المستوى 1 - A+"
                      className={inputCls}
                      value={draft.name_ar}
                      onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
                    />
                  </div>
                </td>
                <td className="p-4 align-top">
                  <select
                    className={inputCls}
                    value={draft.department_id}
                    onChange={(e) => setDraft({ ...draft, department_id: e.target.value })}
                  >
                    <option value="">— All Departments (Global) —</option>
                    {(departments ?? []).map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name_en}</option>
                    ))}
                  </select>
                </td>
                <td className="p-4 align-top">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, active: !draft.active })}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      draft.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {draft.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-4 align-top text-end">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!draft.name_en.trim()) {
                          return toast.error("Level Name is required");
                        }
                        mUpsert.mutate({
                          name_en: draft.name_en.trim(),
                          name_ar: draft.name_ar.trim() || draft.name_en.trim(),
                          department_id: draft.department_id || null,
                          active: draft.active,
                        });
                      }}
                      className="rounded-lg p-1.5 text-brand hover:bg-brand/10 bg-brand/5"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftId(null)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : !filteredSections || filteredSections.length === 0 ? (
              draftId !== "new" && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">No levels found.</td>
                </tr>
              )
            ) : (
              filteredSections.map((s: any) =>
                draftId === s.id ? (
                  <tr key={s.id} className="bg-brand/5">
                    <td className="p-4">
                      <div className="space-y-2">
                        <input
                          autoFocus
                          placeholder="Name (EN)"
                          className={inputCls}
                          value={draft.name_en}
                          onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
                        />
                        <input
                          placeholder="Name (AR)"
                          className={inputCls}
                          value={draft.name_ar}
                          onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <select
                        className={inputCls}
                        value={draft.department_id}
                        onChange={(e) => setDraft({ ...draft, department_id: e.target.value })}
                      >
                        <option value="">— All Departments (Global) —</option>
                        {(departments ?? []).map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name_en}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 align-top">
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, active: !draft.active })}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          draft.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {draft.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-4 align-top text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!draft.name_en.trim()) {
                              return toast.error("Level Name is required");
                            }
                            mUpsert.mutate({
                              id: s.id,
                              name_en: draft.name_en.trim(),
                              name_ar: draft.name_ar.trim() || draft.name_en.trim(),
                              department_id: draft.department_id || null,
                              active: draft.active,
                            });
                          }}
                          className="rounded-lg p-1.5 text-brand hover:bg-brand/10 bg-brand/5"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftId(null)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-start gap-2.5">
                        <Layers className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">{s.name_en}</p>
                          <p className="text-xs text-muted-foreground">{s.name_ar || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {s.departments?.name_en || (
                        <span className="text-xs font-medium text-brand/80 bg-brand/5 px-2 py-0.5 rounded-md">
                          Global (All Departments)
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() =>
                          mUpsert.mutate({
                            id: s.id,
                            name_en: s.name_en,
                            name_ar: s.name_ar,
                            department_id: s.department_id || null,
                            active: !s.active,
                          })
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-4 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDraftId(s.id);
                            setDraft({
                              name_en: s.name_en,
                              name_ar: s.name_ar,
                              department_id: s.department_id || "",
                              active: s.active,
                            });
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete level "${s.name_en}"?`)) {
                              mDelete.mutate(s.id);
                            }
                          }}
                          className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
