import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Play, Check, X, MapPin, Search, History, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useStore, addTrip, transitionTrip, removeTrip, type TaskStatus, type ManagerTrip } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyTeam } from "@/lib/team.functions";

export const Route = createFileRoute("/manager/trips")({
  component: ManagerTripsPage,
});

const STATUSES: TaskStatus[] = ["pending", "in_progress", "done", "cancelled"];

function statusClass(s: TaskStatus) {
  if (s === "done") return "bg-success/10 text-success";
  if (s === "in_progress") return "bg-brand/10 text-brand";
  if (s === "cancelled") return "bg-muted text-muted-foreground";
  return "bg-warning/10 text-warning";
}

function ManagerTripsPage() {
  const { t } = useI18n();
  const session = useSession();
  const trips = useStore((s) => s.trips);
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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<"all" | TaskStatus>("all");
  const [fEmployee, setFEmployee] = useState("all");
  const [fDate, setFDate] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return trips.filter((tr) => {
      if (!(tr.createdBy === me?.id || teamIds.has(tr.assignee))) return false;
      if (fStatus !== "all" && tr.status !== fStatus) return false;
      if (fEmployee !== "all" && tr.assignee !== fEmployee) return false;
      if (fDate && tr.date !== fDate) return false;
      if (ql && !`${tr.destination} ${tr.address} ${tr.purpose}`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [trips, me, teamIds, fStatus, fEmployee, fDate, q]);

  const labelStatus = (s: TaskStatus) =>
    s === "pending" ? t("statusPending") : s === "in_progress" ? t("statusInProgress") : s === "done" ? t("statusDone") : t("statusCancelled");
  const nameOf = (id: string) => team.find((e) => e.id === id)?.name ?? (me?.id === id ? me.name : id);
  const clearAll = () => { setQ(""); setFStatus("all"); setFEmployee("all"); setFDate(""); };
  const hasFilters = q || fStatus !== "all" || fEmployee !== "all" || fDate;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">{t("trips")}</h1>
          <p className="text-sm text-muted-foreground">{visible.length}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={team.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {t("addTrip")}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchTrips")} className="input ps-9" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} className="input">
            <option value="all">{t("allStatuses")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}
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
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">{t("noTrips")}</div>
      ) : (
        <ul className="space-y-3">
          {visible.map((tr) => (
            <li key={tr.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{tr.destination}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{tr.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr.date}{tr.time ? ` • ${tr.time}` : ""} • {t("assignedTo")}: {nameOf(tr.assignee)}
                  </p>
                  {tr.purpose && <p className="mt-1 text-xs text-foreground">{tr.purpose}</p>}
                  {tr.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">{tr.notes}</p>}
                  {(tr.startedAt || tr.completedAt) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {tr.startedAt && <>{t("startedAt")}: {new Date(tr.startedAt).toLocaleString()}</>}
                      {tr.startedAt && tr.completedAt && " • "}
                      {tr.completedAt && <>{t("completedAt")}: {new Date(tr.completedAt).toLocaleString()}</>}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(tr.status)}`}>{labelStatus(tr.status)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {tr.status === "pending" && (
                  <button onClick={() => me && transitionTrip(tr.id, "in_progress", me.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold">
                    <Play className="h-3 w-3" /> {t("markInProgress")}
                  </button>
                )}
                {tr.status !== "done" && tr.status !== "cancelled" && (
                  <button onClick={() => me && transitionTrip(tr.id, "done", me.id)} className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                    <Check className="h-3 w-3" /> {t("markDone")}
                  </button>
                )}
                {tr.status !== "cancelled" && tr.status !== "done" && (
                  <button onClick={() => me && transitionTrip(tr.id, "cancelled", me.id)} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    <X className="h-3 w-3" /> {t("statusCancelled")}
                  </button>
                )}
                <button
                  onClick={() => setExpanded((m) => ({ ...m, [tr.id]: !m[tr.id] }))}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold"
                >
                  <History className="h-3 w-3" /> {t("history")} ({tr.history?.length ?? 0})
                  {expanded[tr.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <button onClick={() => { removeTrip(tr.id); toast.success("Removed"); }} className="ms-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-danger">
                  <Trash2 className="h-3 w-3" /> {t("delete")}
                </button>
              </div>
              {expanded[tr.id] && <TripHistoryList history={tr.history} nameOf={nameOf} />}
            </li>
          ))}
        </ul>
      )}

      {open && me && <AddTripModal me={me.id} team={team} onClose={() => setOpen(false)} />}
    </div>
  );
}

function TripHistoryList({ history, nameOf }: { history?: ManagerTrip["history"]; nameOf: (id: string) => string }) {
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

function AddTripModal({ me, team, onClose }: { me: string; team: Array<{ id: string; name: string }>; onClose: () => void }) {
  const { t } = useI18n();
  const [destination, setDestination] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState(team[0]?.id ?? "");

  const submit = () => {
    if (!destination.trim()) return toast.error(t("destination"));
    if (!address.trim()) return toast.error(t("tripAddress"));
    if (!assignee) return toast.error(t("assignedTo"));
    addTrip({ destination: destination.trim(), address: address.trim(), date, time: time || undefined, purpose: purpose.trim(), notes: notes.trim() || undefined, assignee, status: "pending", createdBy: me });
    toast.success(t("addTrip"));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/40 p-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-auto w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <h2 className="mb-4 font-display text-lg font-semibold">{t("addTrip")}</h2>
        <div className="space-y-3">
          <Field label={t("destination")}><input value={destination} onChange={(e) => setDestination(e.target.value)} className="input" /></Field>
          <Field label={t("tripAddress")}><input value={address} onChange={(e) => setAddress(e.target.value)} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("taskDate")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
            <Field label={t("tripTime")}><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" /></Field>
          </div>
          <Field label={t("tripPurpose")}><input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input" /></Field>
          <Field label={t("assignedTo")}>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="input">
              {team.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label={t("tripNotes")}><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">{t("cancel")}</button>
          <button onClick={submit} className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand">{t("save")}</button>
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