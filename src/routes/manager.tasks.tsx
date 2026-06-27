import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Play, Pause, Check, X, Search, MapPin, History, ChevronDown, ChevronUp, Users, Upload, Download, ChevronLeft, ChevronRight, LayoutGrid, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { getState, type TaskPriority, type TaskStatus, type ManagerTask } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyTeam } from "@/lib/team.functions";
import { createTask, listTasks, transitionTask as transitionTaskFn, deleteTask as deleteTaskFn, getProfileNames, updateTaskAssignees } from "@/backend/functions/tasks.functions";
import { mapTaskRow, type TaskRow } from "@/lib/task-mapping";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/manager/tasks")({
  component: ManagerTasksPage,
});

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];
const STATUSES: TaskStatus[] = ["pending", "in_progress", "done", "cancelled"];

function priorityClass(p: TaskPriority) {
  if (p === "high") return "bg-danger/10 text-danger";
  if (p === "medium") return "bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}
function statusClass(s: TaskStatus) {
  if (s === "done") return "bg-success/10 text-success";
  if (s === "in_progress") return "bg-brand/10 text-brand";
  if (s === "cancelled") return "bg-muted text-muted-foreground";
  return "bg-warning/10 text-warning";
}

function ManagerTasksPage() {
  const { t } = useI18n();
  const session = useSession();
  const qc = useQueryClient();
  const me = useMemo(
    () => (session?.employeeId ? { id: session.employeeId, name: session.name } : undefined),
    [session],
  );
  const teamFn = useServerFn(getMyTeam);
  const { data: teamData } = useQuery({
    queryKey: ["manager-team-all"],
    queryFn: () => teamFn({ data: { page: 1, pageSize: 100, q: "" } }),
    enabled: !!me,
  });
  const team = useMemo(() => teamData?.rows ?? [], [teamData]);
  const teamIds = useMemo(() => new Set(team.map((e) => e.id)), [team]);
  const listTasksFn = useServerFn(listTasks);
  const transitionFn = useServerFn(transitionTaskFn);
  const deleteFn = useServerFn(deleteTaskFn);
  const reassignFn = useServerFn(updateTaskAssignees);
  const importCreateFn = useServerFn(createTask);
  const { data: taskRows = [] } = useQuery({
    queryKey: ["tasks-db"],
    queryFn: () => listTasksFn(),
    enabled: !!me,
  });
  const tasks = useMemo(() => (taskRows as TaskRow[]).map(mapTaskRow), [taskRows]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks-db"] });

  const profileNamesFn = useServerFn(getProfileNames);
  const creatorIds = useMemo(
    () => Array.from(new Set(tasks.map((tk) => tk.createdBy).filter(Boolean))),
    [tasks],
  );
  const { data: creatorRows = [] } = useQuery({
    queryKey: ["task-creators", creatorIds.sort().join(",")],
    queryFn: () => profileNamesFn({ data: { ids: creatorIds } }),
    enabled: creatorIds.length > 0,
  });
  const creatorMap = useMemo(() => {
    const m = new Map<string, string>();
    (creatorRows as Array<{ id: string; full_name: string | null }>).forEach((r) => {
      if (r.full_name) m.set(r.id, r.full_name);
    });
    return m;
  }, [creatorRows]);

  const doTransition = async (id: string, status: TaskStatus) => {
    try { await transitionFn({ data: { id, status } }); invalidate(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const doDelete = async (id: string) => {
    try { await deleteFn({ data: { id } }); toast.success("Removed"); invalidate(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const doReassign = async (id: string, assignees: string[]) => {
    try { await reassignFn({ data: { id, assignees } }); toast.success("Reassigned"); invalidate(); setReassignFor(null); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<"all" | TaskStatus>("all");
  const [fPriority, setFPriority] = useState<"all" | TaskPriority>("all");
  const [fEmployee, setFEmployee] = useState<string>("all");
  const [fDate, setFDate] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"cards" | "table">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reassignFor, setReassignFor] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return tasks.filter((tk) => {
      if (!(tk.createdBy === me?.id || tk.assignees.some((a) => teamIds.has(a)))) return false;
      if (fStatus !== "all" && tk.status !== fStatus) return false;
      if (fPriority !== "all" && tk.priority !== fPriority) return false;
      if (fEmployee !== "all" && !tk.assignees.includes(fEmployee)) return false;
      if (fDate && tk.date !== fDate) return false;
      if (ql && !`${tk.title} ${tk.description} ${tk.address ?? ""} ${tk.district ?? ""}`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [tasks, me, teamIds, fStatus, fPriority, fEmployee, fDate, q]);

  const labelStatus = (s: TaskStatus) =>
    s === "pending" ? t("statusPending") : s === "in_progress" ? t("statusInProgress") : s === "done" ? t("statusDone") : t("statusCancelled");
  const labelPriority = (p: TaskPriority) =>
    p === "low" ? t("priorityLow") : p === "medium" ? t("priorityMedium") : t("priorityHigh");
  const nameOf = (id: string) =>
    team.find((e) => e.id === id)?.name
      ?? (me?.id === id ? me.name : undefined)
      ?? creatorMap.get(id)
      ?? "Manager";
  const clearAll = () => { setQ(""); setFStatus("all"); setFPriority("all"); setFEmployee("all"); setFDate(""); };
  const hasFilters = q || fStatus !== "all" || fPriority !== "all" || fEmployee !== "all" || fDate;

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => visible.slice((safePage - 1) * pageSize, safePage * pageSize), [visible, safePage, pageSize]);
  useMemo(() => { setPage(1); /* reset */ }, [q, fStatus, fPriority, fEmployee, fDate, pageSize]);

  const teamWithEmail = team as Array<{ id: string; name: string; email?: string | null }>;

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["title", "description", "priority", "due_date", "due_time", "city", "district", "address", "estimated_hours", "assignee_emails"],
      ["Sample task", "Optional description", "medium", new Date().toISOString().slice(0, 10), "09:00", "", "", "", "2", teamWithEmail[0]?.email ?? "employee@example.com"],
    ]);
    ws["!cols"] = [{ wch: 24 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 32 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, "tasks-template.xlsx");
  };

  const handleImportFile = async (file: File) => {
    if (!me) return;
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const byEmail = new Map(teamWithEmail.map((m) => [String(m.email ?? "").toLowerCase(), m.id]));
      let ok = 0, failed = 0;
      for (const r of rows) {
        const title = String(r.title ?? r.Title ?? "").trim();
        if (!title) { failed++; continue; }
        const emails = String(r.assignee_emails ?? r.assignees ?? "")
          .split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        const assignees = emails.map((e) => byEmail.get(e)).filter((x): x is string => !!x);
        if (assignees.length === 0) { failed++; continue; }
        const priorityRaw = String(r.priority ?? "medium").toLowerCase();
        const priority = (["low", "medium", "high"].includes(priorityRaw) ? priorityRaw : "medium") as TaskPriority;
        try {
          await importCreateFn({
            data: {
              title,
              description: String(r.description ?? "").trim() || undefined,
              priority,
              due_date: String(r.due_date ?? "").trim() || null,
              due_time: String(r.due_time ?? "").trim() || null,
              city: String(r.city ?? "").trim() || null,
              district: String(r.district ?? "").trim() || null,
              address: String(r.address ?? "").trim() || null,
              estimated_hours: r.estimated_hours !== "" && r.estimated_hours != null ? Number(r.estimated_hours) : null,
              assignees,
            },
          });
          ok++;
        } catch { failed++; }
      }
      toast.success(`Imported ${ok}${failed ? ` • ${failed} failed` : ""}`);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">{t("tasks")}</h1>
          <p className="text-sm text-muted-foreground">{visible.length}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" /> Template
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
            <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import Excel"}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importing || team.length === 0}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleImportFile(f); e.target.value = ""; } }}
            />
          </label>
          <button
            onClick={() => setOpen(true)}
            disabled={team.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {t("addTask")}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs">
          <button
            onClick={() => setView("cards")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${view === "cards" ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            onClick={() => setView("table")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${view === "table" ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground"}`}
          >
            <TableIcon className="h-3.5 w-3.5" /> Table
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchTasks")} className="input ps-9" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} className="input">
            <option value="all">{t("allStatuses")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}
          </select>
          <select value={fPriority} onChange={(e) => setFPriority(e.target.value as any)} className="input">
            <option value="all">{t("allPriorities")}</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{labelPriority(p)}</option>)}
          </select>
          <select value={fEmployee} onChange={(e) => setFEmployee(e.target.value)} className="input">
            <option value="all">{t("allEmployees")}</option>
            {team.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="input" />
          <button onClick={clearAll} disabled={!hasFilters} className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{t("clearFilters")}</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">{t("noTasks")}</div>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">{t("rowTitle") ?? "Title"}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("assignedTo")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("taskDate")}</th>
                <th className="px-3 py-2 text-start font-semibold">Location</th>
                <th className="px-3 py-2 text-start font-semibold">{t("taskPriority")}</th>
                <th className="px-3 py-2 text-start font-semibold">Status</th>
                <th className="px-3 py-2 text-end font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tk) => (
                <tr key={tk.id} className="border-t border-border align-top hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{tk.title}</div>
                    {tk.description && <div className="text-xs text-muted-foreground">{tk.description}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{tk.assignees.map(nameOf).join(", ")}</td>
                  <td className="px-3 py-2 text-xs">
                    {tk.date}{tk.dueTime ? ` • ${tk.dueTime}` : ""}
                    {tk.estimatedHours ? ` • ${tk.estimatedHours}${t("hoursShort")}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {[tk.district, tk.address].filter(Boolean).join(" — ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityClass(tk.priority)}`}>{labelPriority(tk.priority)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(tk.status)}`}>{labelStatus(tk.status)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {tk.status === "pending" && (
                        <button onClick={() => doTransition(tk.id, "in_progress")} title={t("markInProgress")} className="rounded-full border border-border bg-card p-1.5">
                          <Play className="h-3 w-3" />
                        </button>
                      )}
                      {tk.status !== "done" && tk.status !== "cancelled" && (
                        <button onClick={() => doTransition(tk.id, "done")} title={t("markDone")} className="rounded-full bg-success/10 p-1.5 text-success">
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      {tk.status !== "cancelled" && tk.status !== "done" && (
                        <button onClick={() => doTransition(tk.id, "cancelled")} title={t("statusCancelled")} className="rounded-full border border-border bg-card p-1.5 text-muted-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => doDelete(tk.id)} title={t("delete")} className="rounded-full border border-border bg-card p-1.5 text-danger">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((tk) => (
            <li key={tk.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{tk.title}</p>
                  {tk.description && <p className="mt-0.5 text-xs text-muted-foreground">{tk.description}</p>}
                  {(tk.district || tk.address) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[tk.district, tk.address].filter(Boolean).join(" — ")}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tk.date}{tk.dueTime ? ` • ${tk.dueTime}` : ""}
                    {tk.estimatedHours ? ` • ${tk.estimatedHours}${t("hoursShort")}` : ""}
                    {" • "}{t("assignedTo")}: {tk.assignees.map(nameOf).join(", ")}
                  </p>
                  {(tk.startedAt || tk.completedAt) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {tk.startedAt && <>{t("startedAt")}: {new Date(tk.startedAt).toLocaleString()}</>}
                      {tk.startedAt && tk.completedAt && " • "}
                      {tk.completedAt && <>{t("completedAt")}: {new Date(tk.completedAt).toLocaleString()}</>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityClass(tk.priority)}`}>{labelPriority(tk.priority)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(tk.status)}`}>{labelStatus(tk.status)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {tk.status === "pending" && (
                  <button onClick={() => doTransition(tk.id, "in_progress")} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold">
                    <Play className="h-3 w-3" /> {t("markInProgress")}
                  </button>
                )}
                {tk.status !== "done" && tk.status !== "cancelled" && (
                  <button onClick={() => doTransition(tk.id, "done")} className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                    <Check className="h-3 w-3" /> {t("markDone")}
                  </button>
                )}
                {tk.status !== "cancelled" && tk.status !== "done" && (
                  <button onClick={() => doTransition(tk.id, "cancelled")} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    <X className="h-3 w-3" /> {t("statusCancelled")}
                  </button>
                )}
                <button
                  onClick={() => setExpanded((m) => ({ ...m, [tk.id]: !m[tk.id] }))}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold"
                >
                  <History className="h-3 w-3" /> {t("history")} ({tk.history?.length ?? 0})
                  {expanded[tk.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <button onClick={() => doDelete(tk.id)} className="ms-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-danger">
                  <Trash2 className="h-3 w-3" /> {t("delete")}
                </button>
              </div>
              {expanded[tk.id] && <HistoryList history={tk.history} nameOf={nameOf} />}
            </li>
          ))}
        </ul>
      )}

      {open && me && <AddTaskModal me={me.id} team={team} onClose={() => setOpen(false)} onCreated={invalidate} />}
    </div>
  );
}

function HistoryList({ history, nameOf }: { history?: ManagerTask["history"]; nameOf: (id: string) => string }) {
  const { t } = useI18n();
  if (!history || history.length === 0) {
    return <p className="mt-3 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">{t("noHistory")}</p>;
  }
  return (
    <ul className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-2">
      {history.slice().reverse().map((h, i) => (
        <li key={i} className="text-[11px]">
          <span className="font-mono text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
          {" — "}
          <span className="font-semibold">{nameOf(h.by)}</span>
          {" → "}
          <span>{h.to}</span>
          {h.note && <span className="text-muted-foreground"> · {h.note}</span>}
        </li>
      ))}
    </ul>
  );
}

type Row = { title: string; description: string; cityId: string; district: string; address: string; hours: string };
const emptyRow = (): Row => ({ title: "", description: "", cityId: "", district: "", address: "", hours: "" });

function AddTaskModal({ me, team, onClose, onCreated }: { me: string; team: Array<{ id: string; name: string }>; onClose: () => void; onCreated?: () => void }) {
  const { t } = useI18n();
  const { data: cityData } = useQuery({
    queryKey: ["geo", "cities-districts"],
    queryFn: async () => {
      const [{ data: cities }, { data: districts }] = await Promise.all([
        supabase.from("cities").select("id, name_en").order("name_en"),
        supabase.from("districts").select("id, city_id, name_en").order("name_en"),
      ]);
      return { cities: cities ?? [], districts: districts ?? [] };
    },
    staleTime: 5 * 60_000,
  });
  const cities = cityData?.cities ?? [];
  const districts = cityData?.districts ?? [];
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const createTaskFn = useServerFn(createTask);

  const toggle = (id: string) => setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const updateRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const submit = async () => {
    if (assignees.length === 0) return toast.error(t("taskAssignees"));
    const cleaned = rows.filter((r) => r.title.trim());
    if (cleaned.length === 0) return toast.error(t("rowTitle"));
    setSaving(true);
    const payloads = cleaned.map((r) => ({
      title: r.title.trim(),
      description: r.description.trim(),
      date,
      dueTime: dueTime || undefined,
      priority,
      assignees,
      status: "pending" as TaskStatus,
      createdBy: me,
      district: r.district || undefined,
      address: r.address.trim() || undefined,
      estimatedHours: r.hours ? Number(r.hours) : undefined,
    }));
    try {
      await Promise.all(
        payloads.map((p) =>
          createTaskFn({
            data: {
              title: p.title,
              description: p.description || undefined,
              priority: p.priority,
              due_date: p.date,
              due_time: p.dueTime ?? null,
              district: p.district ?? null,
              address: p.address ?? null,
              estimated_hours: p.estimatedHours ?? null,
              assignees: p.assignees,
            },
          }),
        ),
      );
      toast.success(`${t("addTask")} (${payloads.length})`);
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save tasks");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-foreground/40 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-0 flex w-full max-w-none flex-col rounded-none bg-background p-4 shadow-soft sm:my-auto sm:max-w-4xl sm:rounded-3xl sm:p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">{t("addTask")}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("taskDate")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
            <Field label={t("taskDueTime")}><input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="input" /></Field>
            <Field label={t("taskPriority")}>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="input">
                <option value="low">{t("priorityLow")}</option>
                <option value="medium">{t("priorityMedium")}</option>
                <option value="high">{t("priorityHigh")}</option>
              </select>
            </Field>
          </div>
          <Field label={t("taskAssignees")}>
            <div className="flex flex-wrap gap-1.5">
              {team.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${assignees.includes(e.id) ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-foreground"}`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </Field>

          <div className="rounded-2xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{t("taskLocation")}</p>
              <p className="text-[10px] text-muted-foreground">{t("multiLocationHint")}</p>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-muted/30 p-2">
                  <div className="col-span-12 md:col-span-4">
                    <label className="text-[11px] font-medium">{t("rowTitle")}</label>
                    <input value={r.title} onChange={(e) => updateRow(i, { title: e.target.value })} className="input" />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-medium">{t("taskCity") ?? "City"}</label>
                    <select value={r.cityId} onChange={(e) => updateRow(i, { cityId: e.target.value, district: "" })} className="input">
                      <option value="">—</option>
                      {cities.map((c: any) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-medium">{t("rowSiteDistrict")}</label>
                    <select value={r.district} onChange={(e) => updateRow(i, { district: e.target.value })} className="input" disabled={!r.cityId}>
                      <option value="">—</option>
                      {districts.filter((d: any) => d.city_id === r.cityId).map((d: any) => (
                        <option key={d.id} value={d.name_en}>{d.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-medium">{t("rowAddress")}</label>
                    <input value={r.address} onChange={(e) => updateRow(i, { address: e.target.value })} className="input" />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <label className="text-[11px] font-medium">{t("rowHours")}</label>
                    <input type="number" min="0" step="0.5" value={r.hours} onChange={(e) => updateRow(i, { hours: e.target.value })} className="input" />
                  </div>
                  <div className="col-span-8 md:col-span-1">
                    <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} className="w-full rounded-lg border border-border bg-card p-1.5 text-[11px] text-danger disabled:opacity-30">
                      <Trash2 className="mx-auto h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="col-span-12">
                    <label className="text-[11px] font-medium">{t("taskDescription")}</label>
                    <input value={r.description} onChange={(e) => updateRow(i, { description: e.target.value })} className="input" />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addRow} className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-card px-3 py-1 text-xs font-semibold">
              <Plus className="h-3 w-3" /> {t("addAnotherLocation")}
            </button>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">{t("cancel")}</button>
          <button onClick={submit} disabled={saving} className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-50">{t("save")}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}