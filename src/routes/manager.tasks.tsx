import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Play, Pause, Check, X, Search, MapPin, History, ChevronDown, ChevronUp, Users, Upload, Download, ChevronLeft, ChevronRight, LayoutGrid, Table as TableIcon, Loader2, CheckCircle2, Info, RefreshCw } from "lucide-react";
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
import { TaskLocationPicker } from "@/components/admin/TaskLocationPicker";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReassign, setBulkReassign] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

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
  useEffect(() => { setPage(1); }, [q, fStatus, fPriority, fEmployee, fDate, pageSize]);
  useEffect(() => { setSelected(new Set()); }, [q, fStatus, fPriority, fEmployee, fDate, view]);

  const toggleSel = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pageIds = paged.map((tk) => tk.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const togglePageAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allPageSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  const selectedTasks = useMemo(() => tasks.filter((tk) => selected.has(tk.id)), [tasks, selected]);

  const bulkTransition = async (status: TaskStatus) => {
    const targets = selectedTasks.filter((tk) => {
      if (status === "in_progress") return tk.status === "pending" || tk.status === "cancelled";
      if (status === "pending") return tk.status === "in_progress";
      if (status === "done") return tk.status !== "done" && tk.status !== "cancelled";
      return true;
    });
    if (targets.length === 0) { toast.error("No eligible tasks selected"); return; }
    setBulkBusy(true);
    let ok = 0, failed = 0;
    await Promise.all(targets.map(async (tk) => {
      try { await transitionFn({ data: { id: tk.id, status } }); ok++; } catch { failed++; }
    }));
    toast.success(`Updated ${ok}${failed ? ` • ${failed} failed` : ""}`);
    setSelected(new Set());
    setBulkBusy(false);
    invalidate();
  };
  const bulkDoReassign = async (assignees: string[]) => {
    if (selectedTasks.length === 0) return;
    setBulkBusy(true);
    let ok = 0, failed = 0;
    await Promise.all(selectedTasks.map(async (tk) => {
      try { await reassignFn({ data: { id: tk.id, assignees } }); ok++; } catch { failed++; }
    }));
    toast.success(`Reassigned ${ok}${failed ? ` • ${failed} failed` : ""}`);
    setBulkReassign(false);
    setSelected(new Set());
    setBulkBusy(false);
    invalidate();
  };

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
              disabled={importing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleImportFile(f); e.target.value = ""; } }}
            />
          </label>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-90 transition-opacity"
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
        <>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand/5 px-3 py-2 text-xs">
            <span className="font-semibold">{selected.size} selected</span>
            <button disabled={bulkBusy} onClick={() => bulkTransition("in_progress")} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-semibold disabled:opacity-50">
              <Play className="h-3 w-3" /> Start
            </button>
            <button disabled={bulkBusy} onClick={() => bulkTransition("pending")} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-warning disabled:opacity-50">
              <Pause className="h-3 w-3" /> Pause
            </button>
            <button disabled={bulkBusy} onClick={() => bulkTransition("done")} className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-semibold text-success disabled:opacity-50">
              <Check className="h-3 w-3" /> Complete
            </button>
            <button disabled={bulkBusy} onClick={() => setBulkReassign(true)} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-semibold disabled:opacity-50">
              <Users className="h-3 w-3" /> Reassign
            </button>
            <button onClick={() => setSelected(new Set())} className="ms-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-semibold">
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        )}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" checked={allPageSelected} onChange={togglePageAll} aria-label="Select all" />
                </th>
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
              {paged.map((tk) => (
                <tr key={tk.id} className="border-t border-border align-top hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(tk.id)} onChange={() => toggleSel(tk.id)} aria-label={`Select ${tk.title}`} />
                  </td>
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
                    {[
                      tk.city && tk.district && tk.city.toLowerCase() !== tk.district.toLowerCase()
                        ? `${tk.city}, ${tk.district}`
                        : tk.city || tk.district,
                      tk.address,
                    ].filter(Boolean).join(" — ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityClass(tk.priority)}`}>{labelPriority(tk.priority)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(tk.status)}`}>{labelStatus(tk.status)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {(tk.status === "pending" || tk.status === "cancelled") && (
                        <button onClick={() => doTransition(tk.id, "in_progress")} title={t("markInProgress")} className="rounded-full border border-border bg-card p-1.5">
                          <Play className="h-3 w-3" />
                        </button>
                      )}
                      {tk.status === "in_progress" && (
                        <button onClick={() => doTransition(tk.id, "pending")} title="Pause" className="rounded-full border border-border bg-card p-1.5 text-warning">
                          <Pause className="h-3 w-3" />
                        </button>
                      )}
                      {tk.status !== "done" && tk.status !== "cancelled" && (
                        <button onClick={() => doTransition(tk.id, "done")} title={t("markDone")} className="rounded-full bg-success/10 p-1.5 text-success">
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => setReassignFor(tk.id)} title="Reassign" className="rounded-full border border-border bg-card p-1.5">
                        <Users className="h-3 w-3" />
                      </button>
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="input h-8 w-auto py-0 text-xs">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>{visible.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, visible.length)} of {visible.length}</span>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded-full border border-border bg-card p-1 disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span>Page {safePage} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded-full border border-border bg-card p-1 disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        </>
      ) : (
        <ul className="space-y-3">
          {visible.map((tk) => (
            <li key={tk.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{tk.title}</p>
                  {tk.description && <p className="mt-0.5 text-xs text-muted-foreground">{tk.description}</p>}
                  {(tk.city || tk.district || tk.address) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[
                        tk.city && tk.district && tk.city.toLowerCase() !== tk.district.toLowerCase()
                          ? `${tk.city}, ${tk.district}`
                          : tk.city || tk.district,
                        tk.address,
                      ].filter(Boolean).join(" — ")}
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
      {reassignFor && (
        <ReassignModal
          team={team}
          current={tasks.find((tk) => tk.id === reassignFor)?.assignees ?? []}
          onClose={() => setReassignFor(null)}
          onSave={(ids) => doReassign(reassignFor, ids)}
        />
      )}
      {bulkReassign && (
        <ReassignModal
          team={team}
          current={[]}
          onClose={() => setBulkReassign(false)}
          onSave={(ids) => bulkDoReassign(ids)}
        />
      )}
    </div>
  );
}

function ReassignModal({ team, current, onClose, onSave }: { team: Array<{ id: string; name: string }>; current: string[]; onClose: () => void; onSave: (ids: string[]) => void }) {
  const { data: fallbackEmployees = [] } = useQuery({
    queryKey: ["active-employees-assignees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("status", "Active")
        .order("full_name");
      return (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email || "Employee",
      }));
    },
    enabled: team.length === 0,
  });
  const assigneesList = team.length > 0 ? team : fallbackEmployees;
  const [sel, setSel] = useState<string[]>(current);
  const toggle = (id: string) => setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-background p-5 shadow-soft">
        <h3 className="mb-3 font-display text-base font-semibold">Reassign task</h3>
        <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
          {assigneesList.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggle(e.id)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${sel.includes(e.id) ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card"}`}
            >
              {e.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">Cancel</button>
          <button onClick={() => sel.length && onSave(sel)} disabled={sel.length === 0} className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-50">Save</button>
        </div>
      </div>
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

function AddTaskModal({
  me,
  team,
  onClose,
  onCreated,
}: {
  me: string;
  team: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const todayStr = new Date().toISOString().slice(0, 10);
  const createTaskFn = useServerFn(createTask);

  const { data: fallbackEmployees = [] } = useQuery({
    queryKey: ["active-employees-assignees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("status", "Active")
        .order("full_name");
      return (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email || "Employee",
      }));
    },
    enabled: team.length === 0,
  });
  const assigneesList = team.length > 0 ? team : fallbackEmployees;

  // ── Cities & Districts from Database ──
  const { data: geoData } = useQuery({
    queryKey: ["geo", "cities-districts"],
    queryFn: async () => {
      const [{ data: cities }, { data: districts }] = await Promise.all([
        supabase.from("cities").select("id, name_en, name_ar").order("name_en"),
        supabase.from("districts").select("id, city_id, name_en, name_ar").order("name_en"),
      ]);
      return { cities: cities ?? [], districts: districts ?? [] };
    },
    staleTime: 5 * 60_000,
  });
  const dbCities = geoData?.cities ?? [];
  const dbDistricts = geoData?.districts ?? [];

  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    due_date: todayStr,
    due_time: "17:00",
    estimated_hours: "2",
    cityId: "",
    districtId: "",
    city: "",
    district: "",
    address: "",
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    radius_m: 200,
    showMap: false,
    assignees: [] as string[],
  });

  const availableDistricts = useMemo(() => {
    if (!createForm.cityId) return dbDistricts;
    return dbDistricts.filter((d: any) => d.city_id === createForm.cityId);
  }, [dbDistricts, createForm.cityId]);

  const filteredEmployeeList = useMemo(() => {
    if (!assigneeSearch.trim()) return assigneesList;
    const q = assigneeSearch.toLowerCase();
    return assigneesList.filter((e) => e.name.toLowerCase().includes(q));
  }, [assigneesList, assigneeSearch]);

  function handleCityChange(cityId: string) {
    const foundCity = dbCities.find((c: any) => c.id === cityId);
    const cityName = foundCity
      ? isAr
        ? foundCity.name_ar || foundCity.name_en
        : foundCity.name_en || foundCity.name_ar
      : "";

    const districtStillValid = dbDistricts.some(
      (d: any) => d.id === createForm.districtId && d.city_id === cityId,
    );

    setCreateForm((prev) => ({
      ...prev,
      cityId,
      city: cityName,
      districtId: districtStillValid ? prev.districtId : "",
      district: districtStillValid ? prev.district : "",
    }));
  }

  function handleDistrictChange(districtId: string) {
    const foundDist = dbDistricts.find((d: any) => d.id === districtId);
    const distName = foundDist
      ? isAr
        ? foundDist.name_ar || foundDist.name_en
        : foundDist.name_en || foundDist.name_ar
      : "";

    let newCityId = createForm.cityId;
    let newCity = createForm.city;
    if (foundDist && foundDist.city_id && (!createForm.cityId || createForm.cityId !== foundDist.city_id)) {
      newCityId = foundDist.city_id;
      const parentCity = dbCities.find((c: any) => c.id === foundDist.city_id);
      if (parentCity) {
        newCity = isAr ? parentCity.name_ar || parentCity.name_en : parentCity.name_en || parentCity.name_ar;
      }
    }

    setCreateForm((prev) => ({
      ...prev,
      districtId,
      district: distName,
      cityId: newCityId,
      city: newCity,
    }));
  }

  function toggleSelectAllAssignees() {
    if (createForm.assignees.length === assigneesList.length) {
      setCreateForm((prev) => ({ ...prev, assignees: [] }));
    } else {
      setCreateForm((prev) => ({ ...prev, assignees: assigneesList.map((e) => e.id) }));
    }
  }

  async function handleLocationPicked(lat?: number, lng?: number, radius_m?: number) {
    setCreateForm((prev) => ({
      ...prev,
      lat,
      lng,
      radius_m: radius_m !== undefined ? radius_m : prev.radius_m,
    }));

    if (lat == null || lng == null) return;

    try {
      setIsGeocodingAddress(true);
      const geo = await reverseGeocodeCoords(lat, lng, isAr ? "ar" : "en");
      const autoAddress = geo.detailedAddress || geo.street || geo.formatted || "";

      if (autoAddress) {
        setCreateForm((prev) => {
          let updatedCityId = prev.cityId;
          let updatedCity = prev.city;
          let updatedDistrictId = prev.districtId;
          let updatedDistrict = prev.district;

          if (!updatedCityId && geo.city) {
            const normCity = geo.city.trim().toLowerCase();
            const foundCity = dbCities.find(
              (c: any) =>
                (c.name_en && c.name_en.trim().toLowerCase() === normCity) ||
                (c.name_ar && c.name_ar.trim().toLowerCase() === normCity) ||
                normCity.includes((c.name_en || "").toLowerCase()) ||
                normCity.includes((c.name_ar || "").toLowerCase()),
            );
            if (foundCity) {
              updatedCityId = foundCity.id;
              updatedCity = isAr
                ? foundCity.name_ar || foundCity.name_en
                : foundCity.name_en || foundCity.name_ar;
            }
          }

          if (!updatedDistrictId && geo.district) {
            const normDist = geo.district.trim().toLowerCase();
            const foundDist = dbDistricts.find(
              (d: any) =>
                (!updatedCityId || d.city_id === updatedCityId) &&
                ((d.name_en && d.name_en.trim().toLowerCase() === normDist) ||
                  (d.name_ar && d.name_ar.trim().toLowerCase() === normDist) ||
                  normDist.includes((d.name_en || "").toLowerCase()) ||
                  normDist.includes((d.name_ar || "").toLowerCase())),
            );
            if (foundDist) {
              updatedDistrictId = foundDist.id;
              updatedDistrict = isAr
                ? foundDist.name_ar || foundDist.name_en
                : foundDist.name_en || foundDist.name_ar;
              if (!updatedCityId && foundDist.city_id) {
                updatedCityId = foundDist.city_id;
                const parentCity = dbCities.find((c: any) => c.id === foundDist.city_id);
                if (parentCity) {
                  updatedCity = isAr
                    ? parentCity.name_ar || parentCity.name_en
                    : parentCity.name_en || parentCity.name_ar;
                }
              }
            }
          }

          return {
            ...prev,
            address: autoAddress,
            cityId: updatedCityId,
            city: updatedCity,
            districtId: updatedDistrictId,
            district: updatedDistrict,
          };
        });

        toast.success(
          isAr ? "تم تحديد وتعبئة العنوان تلقائياً من الخريطة" : "Address auto-filled from map",
        );
      }
    } catch {
      // ignore
    } finally {
      setIsGeocodingAddress(false);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.error(isAr ? "يرجى كتابة عنوان المهمة" : "Please enter a task title");
      return;
    }
    if (createForm.assignees.length === 0) {
      toast.error(isAr ? "يرجى اختيار موظف واحد على الأقل" : "Please select at least one assignee");
      return;
    }

    try {
      setCreatingTask(true);
      await createTaskFn({
        data: {
          title: createForm.title.trim(),
          description: createForm.description.trim() || undefined,
          priority: createForm.priority,
          due_date: createForm.due_date || undefined,
          due_time: createForm.due_time || undefined,
          estimated_hours: createForm.estimated_hours ? Number(createForm.estimated_hours) : undefined,
          city: createForm.city.trim() || undefined,
          district: createForm.district.trim() || undefined,
          address: createForm.address.trim() || undefined,
          lat: createForm.lat !== undefined ? createForm.lat : undefined,
          lng: createForm.lng !== undefined ? createForm.lng : undefined,
          radius_m: createForm.radius_m ? Number(createForm.radius_m) : undefined,
          assignees: createForm.assignees,
        },
      });
      toast.success(t("taskCreatedSuccess") || (isAr ? "تمت إضافة المهمة بنجاح" : "Task created successfully"));
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl md:max-w-4xl flex-col rounded-3xl bg-background p-6 shadow-soft"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-display text-base font-semibold">
              {t("createTaskTitle") || (isAr ? "إضافة مهمة جديدة" : "Create New Task")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("createTaskDesc") ||
                (isAr
                  ? "حدد تفاصيل التكليف ومواعيد التنفيذ وموقع العمل الجغرافي بدقة"
                  : "Specify assignment details, scheduled time, and geofenced work location")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateTask} className="flex-1 overflow-y-auto py-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ── Left Column: Task Core Details ── */}
            <div className="space-y-3.5">
              {/* Title */}
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  {t("taskTitle") || (isAr ? "عنوان المهمة" : "Task Title")} <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder={isAr ? "مثال: صيانة معدات فرع المعادي" : "e.g. Inspect branch equipment"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  {t("taskDescription") || (isAr ? "الوصف" : "Description")}
                </label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder={isAr ? "تفاصيل إضافية وملاحظات تنفيذ المهمة…" : "Details about the task…"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden resize-none"
                />
              </div>

              {/* Priority & Estimated Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    {t("filterByPriority") || (isAr ? "الأولوية" : "Priority")}
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, priority: e.target.value as TaskPriority })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden font-medium"
                  >
                    <option value="low">{t("priorityLow") || (isAr ? "منخفضة" : "Low")}</option>
                    <option value="medium">{t("priorityMedium") || (isAr ? "متوسطة" : "Medium")}</option>
                    <option value="high">{t("priorityHigh") || (isAr ? "عالية" : "High")}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    {t("estimatedHoursLabel") || (isAr ? "الساعات التقديرية" : "Estimated Hours")}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={createForm.estimated_hours}
                    onChange={(e) => setCreateForm({ ...createForm, estimated_hours: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Due Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    {t("date") || (isAr ? "التاريخ" : "Date")}
                  </label>
                  <input
                    type="date"
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    {isAr ? "الوقت" : "Time"}
                  </label>
                  <input
                    type="time"
                    value={createForm.due_time}
                    onChange={(e) => setCreateForm({ ...createForm, due_time: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* ── Right Column: Assignees & Database Location ── */}
            <div className="space-y-3.5">
              {/* Assignees */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground">
                    {t("assignees") || (isAr ? "المكلفون" : "Assignees")} <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {createForm.assignees.length} {isAr ? "محدد" : "selected"}
                  </span>
                </div>

                {/* Filter / Search within assignees */}
                <div className="rounded-xl border border-input bg-background overflow-hidden">
                  <div className="border-b border-border/60 p-1.5 flex items-center gap-2 bg-muted/20">
                    <Search className="h-3 w-3 text-muted-foreground ms-1.5 shrink-0" />
                    <input
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      placeholder={isAr ? "بحث بالاسم…" : "Filter employees…"}
                      className="w-full bg-transparent text-xs focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={toggleSelectAllAssignees}
                      className="text-[10px] text-brand font-semibold hover:underline shrink-0 px-1"
                    >
                      {createForm.assignees.length === assigneesList.length
                        ? isAr
                          ? "إلغاء الكل"
                          : "Deselect"
                        : isAr
                        ? "تحديد الكل"
                        : "Select all"}
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto p-1.5 space-y-0.5">
                    {filteredEmployeeList.length === 0 ? (
                      <p className="p-2 text-center text-[11px] text-muted-foreground">
                        {isAr ? "لا يوجد موظفين مطابقين" : "No matching employees"}
                      </p>
                    ) : (
                      filteredEmployeeList.map((emp) => {
                        const checked = createForm.assignees.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                              checked ? "bg-brand/10 font-semibold text-brand" : "hover:bg-muted text-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setCreateForm((prev) => ({
                                  ...prev,
                                  assignees: checked
                                    ? prev.assignees.filter((id) => id !== emp.id)
                                    : [...prev.assignees, emp.id],
                                }));
                              }}
                              className="rounded border-input text-brand"
                            />
                            <span className="truncate">{emp.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Location: City & District from Database */}
              <div className="grid grid-cols-2 gap-3">
                {/* City from DB */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    {isAr ? "المدينة (من قاعدة البيانات)" : "City"}
                  </label>
                  <select
                    value={createForm.cityId}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden font-medium"
                  >
                    <option value="">{isAr ? "— اختر المدينة —" : "— Select City —"}</option>
                    {dbCities.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {isAr ? c.name_ar || c.name_en : c.name_en || c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                {/* District from DB */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    {isAr ? "الحي / المنطقة" : "District"}
                  </label>
                  <select
                    value={createForm.districtId}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden font-medium"
                  >
                    <option value="">{isAr ? "— اختر المنطقة —" : "— Select District —"}</option>
                    {availableDistricts.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {isAr ? d.name_ar || d.name_en : d.name_en || d.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Detailed Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-foreground">
                    {isAr ? "العنوان بالتفصيل" : "Address"}
                  </label>
                  {isGeocodingAddress && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand font-medium animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {isAr ? "جاري جلب العنوان من الخريطة…" : "Fetching address from map…"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    placeholder={
                      isGeocodingAddress
                        ? isAr
                          ? "جاري تحديد العنوان من الخريطة…"
                          : "Detecting address from map…"
                        : isAr
                        ? "الشارع ورقم المبنى أو علامة مميزة…"
                        : "Street address, landmark…"
                    }
                    className={`w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden transition-all ${
                      isGeocodingAddress ? "opacity-75 bg-muted/40" : ""
                    } ${createForm.lat != null && createForm.lng != null && !isGeocodingAddress ? "pe-8" : ""}`}
                  />
                  {createForm.lat != null && createForm.lng != null && !isGeocodingAddress && (
                    <button
                      type="button"
                      title={isAr ? "إعادة جلب العنوان من موقع الخريطة" : "Re-fetch address from pinned location"}
                      onClick={() => handleLocationPicked(createForm.lat, createForm.lng, createForm.radius_m)}
                      className="absolute end-2 top-2 text-muted-foreground hover:text-brand transition-colors p-0.5 rounded-md hover:bg-muted"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Radius & Location Geofence Signing Section ── */}
          <div className="mt-4 rounded-2xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                  <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                  <span>{isAr ? "نصف قطر وموقع المهمة (لتسجيل الحضور)" : "Task Location & Check-in Radius"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAr
                    ? "حدد نطاق السماح بالمتر ووقّع الموقع على الخريطة لتأكيد الحضور ضمن النطاق الصحيح."
                    : "Define the check-in radius in meters and sign the exact site on the map."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateForm((prev) => ({ ...prev, showMap: !prev.showMap }))}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                    createForm.lat != null && createForm.lng != null
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : createForm.showMap
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-background hover:bg-muted text-foreground"
                  }`}
                >
                  <MapPin className={`h-3.5 w-3.5 ${createForm.lat != null ? "text-emerald-600 dark:text-emerald-400" : "text-brand"}`} />
                  <span>
                    {createForm.lat != null && createForm.lng != null
                      ? isAr
                        ? "الموقع موقّع على الخريطة"
                        : "Location Signed"
                      : isAr
                      ? "توقيع الموقع على الخريطة"
                      : "Sign on Map"}
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${createForm.showMap ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Radius Controls (Input + Presets) */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {isAr ? "نصف القطر:" : "Radius:"}
                </label>
                <div className="relative w-28">
                  <input
                    type="number"
                    min={10}
                    max={10000}
                    step={10}
                    value={createForm.radius_m}
                    onChange={(e) => {
                      const val = Math.max(10, Math.min(100000, Number(e.target.value) || 10));
                      setCreateForm((prev) => ({ ...prev, radius_m: val }));
                    }}
                    className="w-full rounded-xl border border-input bg-background px-3 py-1.5 pe-8 text-xs font-mono font-semibold focus:outline-hidden"
                  />
                  <span className="absolute end-2.5 top-2 text-[10px] text-muted-foreground pointer-events-none">
                    {isAr ? "متر" : "m"}
                  </span>
                </div>
              </div>

              {/* Preset Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[50, 100, 200, 300, 500, 1000].map((preset) => {
                  const isSelected = createForm.radius_m === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCreateForm((prev) => ({ ...prev, radius_m: preset }))}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        isSelected
                          ? "bg-brand text-brand-foreground shadow-xs"
                          : "border border-border/70 bg-background hover:bg-muted text-foreground/80"
                      }`}
                    >
                      {preset} {isAr ? "م" : "m"}
                    </button>
                  );
                })}
              </div>

              {/* Signed coordinates indicator */}
              {createForm.lat != null && createForm.lng != null && (
                <div className="ms-auto flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono">
                    {createForm.lat.toFixed(5)}, {createForm.lng.toFixed(5)}
                  </span>
                  <span className="text-[10px] opacity-75">
                    · {isAr ? `دائرة ${createForm.radius_m}م` : `${createForm.radius_m}m zone`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm((prev) => ({ ...prev, lat: undefined, lng: undefined }))
                    }
                    className="ms-1 text-[10px] text-destructive hover:underline font-semibold"
                  >
                    {isAr ? "مسح" : "Clear"}
                  </button>
                </div>
              )}
            </div>

            {/* Map Display */}
            {createForm.showMap && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                  <span className="flex items-center gap-1">
                    <Info className="h-3 w-3 text-brand shrink-0" />
                    {isAr
                      ? "انقر في أي مكان على الخريطة لتوقيع الموقع الدقيق. الدائرة الزرقاء تمثل نطاق الحضور المحدد."
                      : "Click anywhere on the map to pin the exact location. The blue circle represents the check-in radius."}
                  </span>
                </div>

                <TaskLocationPicker
                  lat={createForm.lat}
                  lng={createForm.lng}
                  radius_m={createForm.radius_m}
                  cityName={createForm.city}
                  districtName={createForm.district}
                  onChange={handleLocationPicked}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
            >
              {t("cancel") || (isAr ? "إلغاء" : "Cancel")}
            </button>
            <button
              type="submit"
              disabled={creatingTask}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-6 py-2 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 disabled:opacity-50"
            >
              {creatingTask ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {t("addNewTask") || (isAr ? "إضافة المهمة" : "Add Task")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}