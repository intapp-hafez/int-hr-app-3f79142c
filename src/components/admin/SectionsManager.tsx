import { useState, useMemo } from "react";
import { Plus, Check, X, Pencil, Trash2, CornerDownRight, Search, Filter, Layers } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listSections, upsertSection, deleteSection, listDepartments } from "@/backend/functions/directory.functions";

type SectionDraft = {
  id?: string;
  name_en: string;
  name_ar: string;
  department_id: string;
  parent_id: string;
  active: boolean;
};

const emptyDraft: SectionDraft = {
  name_en: "",
  name_ar: "",
  department_id: "",
  parent_id: "",
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

  // Calculate hierarchical ordering so sub-levels appear directly under their parent
  const hierarchicalSections = useMemo(() => {
    if (!sections) return [];
    let list = sections as any[];

    if (deptFilter) {
      list = list.filter((s: any) => s.department_id === deptFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s: any) =>
        s.name_en?.toLowerCase().includes(q) ||
        s.name_ar?.toLowerCase().includes(q) ||
        s.parent_name?.toLowerCase().includes(q) ||
        s.departments?.name_en?.toLowerCase().includes(q)
      );
    }

    // Direct mapping for fast lookup
    const listMap = new Map(list.map((s: any) => [s.id, s]));
    const roots: any[] = [];
    const childrenMap = new Map<string, any[]>();

    list.forEach((s: any) => {
      if (s.parent_id && listMap.has(s.parent_id)) {
        if (!childrenMap.has(s.parent_id)) childrenMap.set(s.parent_id, []);
        childrenMap.get(s.parent_id)!.push(s);
      } else {
        roots.push(s);
      }
    });

    const ordered: any[] = [];
    const visited = new Set<string>();

    function appendNode(node: any) {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      ordered.push(node);
      const kids = childrenMap.get(node.id) || [];
      kids.forEach(appendNode);
    }

    roots.forEach(appendNode);
    // Append any left out due to cycle
    list.forEach((s: any) => {
      if (!visited.has(s.id)) appendNode(s);
    });

    return ordered;
  }, [sections, deptFilter, searchQuery]);

  // Candidates for parent level given a specific department, excluding self and children
  function getParentCandidates(currentDeptId: string, currentEditingId?: string | null) {
    if (!sections || !currentDeptId) return [];
    return (sections as any[]).filter((s: any) => {
      if (s.department_id !== currentDeptId) return false;
      if (currentEditingId && s.id === currentEditingId) return false;
      if (currentEditingId && s.parent_id === currentEditingId) return false;
      return true;
    });
  }

  const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Levels & Sub-levels</h2>
            <span className="rounded-full bg-brand/10 text-brand px-2.5 py-0.5 text-xs font-semibold">
              Hierarchy
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage organization levels, departments, and nested sub-levels.
          </p>
        </div>
        {draftId !== "new" && (
          <button
            onClick={() => {
              setDraftId("new");
              setDraft({
                ...emptyDraft,
                department_id: deptFilter || "",
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
            {(departments ?? []).map((d: any) => (
              <option key={d.id} value={d.id}>{d.name_en}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 font-medium text-muted-foreground">
            <tr>
              <th className="p-4 w-1/4">Level Name (EN / AR)</th>
              <th className="p-4 w-1/4">Department</th>
              <th className="p-4 w-1/4">Parent Level</th>
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
                    onChange={(e) => {
                      const newDeptId = e.target.value;
                      const candidates = getParentCandidates(newDeptId, null);
                      const stillValid = candidates.some((c) => c.id === draft.parent_id);
                      setDraft({
                        ...draft,
                        department_id: newDeptId,
                        parent_id: stillValid ? draft.parent_id : "",
                      });
                    }}
                  >
                    <option value="">— Select Department —</option>
                    {(departments ?? []).map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name_en}</option>
                    ))}
                  </select>
                </td>
                <td className="p-4 align-top">
                  <select
                    className={inputCls}
                    value={draft.parent_id}
                    disabled={!draft.department_id}
                    onChange={(e) => setDraft({ ...draft, parent_id: e.target.value })}
                  >
                    <option value="">— None (Main Level) —</option>
                    {getParentCandidates(draft.department_id, null).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name_en} {p.name_ar ? `(${p.name_ar})` : ""}
                      </option>
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
                        if (!draft.name_en.trim() || !draft.department_id) {
                          return toast.error("Name and Department are required");
                        }
                        mUpsert.mutate({
                          name_en: draft.name_en.trim(),
                          name_ar: draft.name_ar.trim(),
                          department_id: draft.department_id,
                          parent_id: draft.parent_id || null,
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
                <td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : !hierarchicalSections || hierarchicalSections.length === 0 ? (
              draftId !== "new" && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">No levels found.</td>
                </tr>
              )
            ) : (
              hierarchicalSections.map((s: any) =>
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
                        onChange={(e) => {
                          const newDeptId = e.target.value;
                          const candidates = getParentCandidates(newDeptId, s.id);
                          const stillValid = candidates.some((c) => c.id === draft.parent_id);
                          setDraft({
                            ...draft,
                            department_id: newDeptId,
                            parent_id: stillValid ? draft.parent_id : "",
                          });
                        }}
                      >
                        <option value="">— Select Department —</option>
                        {(departments ?? []).map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name_en}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 align-top">
                      <select
                        className={inputCls}
                        value={draft.parent_id}
                        disabled={!draft.department_id}
                        onChange={(e) => setDraft({ ...draft, parent_id: e.target.value })}
                      >
                        <option value="">— None (Main Level) —</option>
                        {getParentCandidates(draft.department_id, s.id).map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name_en} {p.name_ar ? `(${p.name_ar})` : ""}
                          </option>
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
                            if (!draft.name_en.trim() || !draft.department_id) {
                              return toast.error("Name and Department are required");
                            }
                            mUpsert.mutate({
                              id: s.id,
                              name_en: draft.name_en.trim(),
                              name_ar: draft.name_ar.trim(),
                              department_id: draft.department_id,
                              parent_id: draft.parent_id || null,
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
                      {s.parent_id ? (
                        <div className="flex items-center gap-2.5 pl-4 border-l-2 border-brand/30">
                          <CornerDownRight className="h-4 w-4 text-brand shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">{s.name_en}</p>
                              <span className="rounded-md bg-brand/10 text-brand px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
                                Sub-level
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{s.name_ar || "—"}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2.5">
                          <Layers className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">{s.name_en}</p>
                              <span className="rounded-md bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-medium">
                                Main
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{s.name_ar || "—"}</p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {s.departments?.name_en || "—"}
                    </td>
                    <td className="p-4">
                      {s.parent_name ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <span className="text-muted-foreground">↳</span>
                          <span>{s.parent_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None (Main Level)</span>
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
                            department_id: s.department_id,
                            parent_id: s.parent_id || null,
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
                            setDraftId("new");
                            setDraft({
                              name_en: "",
                              name_ar: "",
                              department_id: s.department_id,
                              parent_id: s.id,
                              active: true,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand bg-brand/10 hover:bg-brand/20 transition-colors"
                          title="Add a sub-level under this level"
                        >
                          <Plus className="h-3.5 w-3.5" /> Sub-level
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftId(s.id);
                            setDraft({
                              name_en: s.name_en,
                              name_ar: s.name_ar,
                              department_id: s.department_id,
                              parent_id: s.parent_id || "",
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
