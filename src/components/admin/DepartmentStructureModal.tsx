import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Plus, Trash2, Users } from "lucide-react";
import { 
  listDepartmentPositions, 
  upsertDepartmentPosition, 
  deleteDepartmentPosition,
  listPositions,
  listJobGrades,
  listSections,
  upsertSection,
  deleteSection
} from "@/backend/functions/directory.functions";

export function DepartmentStructureModal({ 
  departmentId, 
  departmentName, 
  onClose 
}: { 
  departmentId: string; 
  departmentName: string; 
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDepartmentPositions);
  const upsertFn = useServerFn(upsertDepartmentPosition);
  const delFn = useServerFn(deleteDepartmentPosition);
  
  const posFn = useServerFn(listPositions);
  const gradesFn = useServerFn(listJobGrades);
  const secListFn = useServerFn(listSections);
  const secUpsertFn = useServerFn(upsertSection);
  const secDelFn = useServerFn(deleteSection);

  const [activeTab, setActiveTab] = useState<"positions" | "sections">("positions");

  const { data: positions } = useQuery({ queryKey: ["positions"], queryFn: () => posFn() });
  const { data: grades } = useQuery({ queryKey: ["job-grades"], queryFn: () => gradesFn() });
  const { data: sections } = useQuery({ queryKey: ["dept-sections", departmentId], queryFn: () => secListFn({ data: { department_id: departmentId } }) });
  
  const queryKey = ["dept-positions", departmentId];
  const { data: deptPositions, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { department_id: departmentId } })
  });

  const mUpsert = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Position added to department");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Position removed");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const mSecUpsert = useMutation({
    mutationFn: (data: any) => secUpsertFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dept-sections", departmentId] });
      toast.success("Level saved");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const mSecDel = useMutation({
    mutationFn: (id: string) => secDelFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dept-sections", departmentId] });
      toast.success("Level removed");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const [draft, setDraft] = useState({ position_id: "", job_grade_id: "", section_id: "", headcount: 1 });
  const [secDraft, setSecDraft] = useState({ name_en: "", name_ar: "", parent_id: "" });

  const inputCls = "rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">{departmentName} Structure</h2>
              <p className="text-xs text-muted-foreground">Manage levels, positions, and headcount</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex border-b border-border">
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'positions' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('positions')}
          >
            Positions
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'sections' ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('sections')}
          >
            Levels
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'positions' ? (
            <>
              <div className="mb-6 grid grid-cols-5 gap-3">
                <select
                  className={inputCls}
                  value={draft.position_id}
                  onChange={(e) => setDraft({ ...draft, position_id: e.target.value })}
                >
                  <option value="">Select Position...</option>
                  {positions?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name_en} / {p.name_ar}</option>
                  ))}
                </select>

                <select
                  className={inputCls}
                  value={draft.section_id}
                  onChange={(e) => setDraft({ ...draft, section_id: e.target.value })}
                >
                  <option value="">(All Levels)</option>
                  {sections?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name_en}</option>
                  ))}
                </select>
            
            <select
              className={inputCls}
              value={draft.job_grade_id}
              onChange={(e) => setDraft({ ...draft, job_grade_id: e.target.value })}
            >
              <option value="">Select Job Grade...</option>
              {grades?.filter((g: any) => g.active).map((g: any) => (
                <option key={g.id} value={g.id}>{g.name_en}</option>
              ))}
            </select>
            
            <div className="relative">
              <input
                type="number"
                min="1"
                className={`${inputCls} w-full pl-20`}
                value={draft.headcount}
                onChange={(e) => setDraft({ ...draft, headcount: parseInt(e.target.value) || 1 })}
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Headcount:
              </span>
            </div>
            
            <button
              onClick={() => {
                if (!draft.position_id || !draft.job_grade_id || draft.headcount < 1) {
                  return toast.error("Please fill all fields");
                }
                mUpsert.mutate({
                  department_id: departmentId,
                  section_id: draft.section_id,
                  position_id: draft.position_id,
                  job_grade_id: draft.job_grade_id,
                  headcount: draft.headcount
                });
                setDraft({ position_id: "", job_grade_id: "", section_id: "", headcount: 1 });
              }}
              disabled={mUpsert.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="p-4">Position</th>
                  <th className="p-4">Level</th>
                  <th className="p-4">Job Grade</th>
                  <th className="p-4 text-center">Headcount</th>
                  <th className="p-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : !deptPositions || deptPositions.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No positions added to this department yet.</td></tr>
                ) : (
                  deptPositions.map((dp: any) => (
                    <tr key={dp.id} className="hover:bg-muted/20">
                      <td className="p-4 font-medium">{dp.positions?.name_en}</td>
                      <td className="p-4 text-muted-foreground">{dp.sections?.name_en || "—"}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                          {dp.job_grades?.name_en}
                        </span>
                      </td>
                      <td className="p-4 text-center font-semibold">{dp.headcount}</td>
                      <td className="p-4 text-end">
                        <button 
                          onClick={() => mDel.mutate(dp.id)}
                          className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            </>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Level Name (EN)"
                  className={inputCls}
                  value={secDraft.name_en}
                  onChange={(e) => setSecDraft({ ...secDraft, name_en: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Level Name (AR)"
                  className={inputCls}
                  value={secDraft.name_ar}
                  onChange={(e) => setSecDraft({ ...secDraft, name_ar: e.target.value })}
                />
                <select
                  className={inputCls}
                  value={secDraft.parent_id}
                  onChange={(e) => setSecDraft({ ...secDraft, parent_id: e.target.value })}
                >
                  <option value="">— Parent Level (Optional) —</option>
                  {(sections ?? []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name_en} {s.name_ar ? `(${s.name_ar})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!secDraft.name_en || !secDraft.name_ar) return toast.error("Fill both names");
                    mSecUpsert.mutate({
                      department_id: departmentId,
                      parent_id: secDraft.parent_id || null,
                      name_en: secDraft.name_en,
                      name_ar: secDraft.name_ar,
                      active: true
                    });
                    setSecDraft({ name_en: "", name_ar: "", parent_id: "" });
                  }}
                  disabled={mSecUpsert.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Add Level
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 font-medium text-muted-foreground">
                    <tr>
                      <th className="p-4">Name (EN)</th>
                      <th className="p-4">Name (AR)</th>
                      <th className="p-4">Parent Level</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!sections || sections.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No levels created yet.</td></tr>
                    ) : (
                      sections.map((s: any) => (
                        <tr key={s.id} className="hover:bg-muted/20">
                          <td className="p-4 font-medium">
                            {s.parent_name ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground text-xs font-mono">↳</span>
                                <span>{s.name_en}</span>
                                <span className="rounded-md bg-brand/10 text-brand px-1.5 py-0.5 text-[10px] font-medium">Sub-level</span>
                              </div>
                            ) : (
                              s.name_en
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground">{s.name_ar}</td>
                          <td className="p-4 text-xs text-muted-foreground">{s.parent_name || "— (Main Level)"}</td>
                          <td className="p-4">
                            <button onClick={() => mSecUpsert.mutate({ ...s, active: !s.active })}
                              className={`rounded-full px-2 py-1 text-xs ${s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                              {s.active ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="p-4 text-end">
                            <button 
                              onClick={() => mSecDel.mutate(s.id)}
                              className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
