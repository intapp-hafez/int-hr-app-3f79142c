import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Plus, Trash2, Layers, Pencil, Check, Download } from "lucide-react";
import { 
  listSubSections, 
  upsertSubSection, 
  deleteSubSection 
} from "@/backend/functions/directory.functions";

interface DepartmentSectionsModalProps {
  departmentId: string;
  departmentName: string;
  onClose: () => void;
}

export function DepartmentSectionsModal({
  departmentId,
  departmentName,
  onClose,
}: DepartmentSectionsModalProps) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSubSections);
  const upsertFn = useServerFn(upsertSubSection);
  const delFn = useServerFn(deleteSubSection);

  const queryKey = ["dept-subsections", departmentId];
  const { data: subSections, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { department_id: departmentId } }),
  });

  const mUpsert = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Section saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Section removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [draft, setDraft] = useState({ code: "", name_en: "", name_ar: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ code: "", name_en: "", name_ar: "", active: true });

  const inputCls = "rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand";

  function handleSaveEdit(id: string) {
    if (!editDraft.name_en.trim()) return toast.error("English name is required");
    mUpsert.mutate(
      {
        id,
        department_id: departmentId,
        code: editDraft.code.trim() || null,
        name_en: editDraft.name_en.trim(),
        name_ar: editDraft.name_ar.trim(),
        active: editDraft.active,
      },
      {
        onSuccess: () => setEditingId(null),
      }
    );
  }

  async function handleExport() {
    const list = subSections ?? [];
    if (list.length === 0) {
      toast.error("No sections to export");
      return;
    }
    const XLSX = await import("xlsx");
    const exportRows = list.map((s: any) => ({
      "Department": departmentName,
      "Code": s.code ?? "",
      "Section Name (EN)": s.name_en ?? "",
      "Section Name (AR)": s.name_ar ?? "",
      "Status": s.active ? "Active" : "Inactive",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${departmentName.slice(0, 20)} Sections`);
    XLSX.writeFile(wb, `${departmentName}_sections_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${exportRows.length} sections`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">{departmentName} — Sections</h2>
              <p className="text-xs text-muted-foreground">
                Manage sections for this department (e.g. {departmentName} → sections a, b, c, d)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              title="Export sections to Excel"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" title="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="p-6 space-y-5">
          {/* Add section input row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Code (optional)"
              className={inputCls}
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <input
              type="text"
              placeholder="Section Name (EN) *"
              className={inputCls}
              value={draft.name_en}
              onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
            />
            <input
              type="text"
              placeholder="Section Name (AR)"
              className={inputCls}
              value={draft.name_ar}
              onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
            />
            <button
              onClick={() => {
                if (!draft.name_en.trim()) return toast.error("English name is required");
                mUpsert.mutate({
                  department_id: departmentId,
                  code: draft.code.trim() || null,
                  name_en: draft.name_en.trim(),
                  name_ar: draft.name_ar.trim(),
                  active: true,
                });
                setDraft({ code: "", name_en: "", name_ar: "" });
              }}
              disabled={mUpsert.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add Section
            </button>
          </div>

          {/* Sections table */}
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="p-4 w-28">Code</th>
                  <th className="p-4">Name (EN)</th>
                  <th className="p-4">Name (AR)</th>
                  <th className="p-4 w-24">Status</th>
                  <th className="p-4 w-24 text-end"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading sections...</td></tr>
                ) : !subSections || subSections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No sections added for {departmentName} yet. Add sections above (e.g. a, b, c, d).
                    </td>
                  </tr>
                ) : (
                  subSections.map((s: any) => editingId === s.id ? (
                    <tr key={s.id} className="bg-brand/5">
                      <td className="p-3">
                        <input
                          className={inputCls}
                          placeholder="Code"
                          value={editDraft.code}
                          onChange={(e) => setEditDraft({ ...editDraft, code: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          autoFocus
                          className={inputCls}
                          placeholder="Name (EN)"
                          value={editDraft.name_en}
                          onChange={(e) => setEditDraft({ ...editDraft, name_en: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(s.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className={inputCls}
                          placeholder="Name (AR)"
                          value={editDraft.name_ar}
                          onChange={(e) => setEditDraft({ ...editDraft, name_ar: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(s.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setEditDraft({ ...editDraft, active: !editDraft.active })}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            editDraft.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {editDraft.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(s.id)}
                            disabled={mUpsert.isPending}
                            className="rounded-lg p-1.5 text-brand bg-brand/10 hover:bg-brand/20"
                            title="Save changes"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="p-4 font-mono text-xs text-muted-foreground">{s.code || "—"}</td>
                      <td className="p-4 font-medium">{s.name_en}</td>
                      <td className="p-4 text-muted-foreground">{s.name_ar || "—"}</td>
                      <td className="p-4">
                        <button
                          onClick={() => mUpsert.mutate({ ...s, active: !s.active })}
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
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
                              setEditingId(s.id);
                              setEditDraft({
                                code: s.code ?? "",
                                name_en: s.name_en ?? "",
                                name_ar: s.name_ar ?? "",
                                active: s.active ?? true,
                              });
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                            title="Edit section"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => mDel.mutate(s.id)}
                            disabled={mDel.isPending}
                            className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                            title="Delete section"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
