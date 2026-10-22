import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Play,
  Check,
  X,
  MapPin,
  Search,
  History,
  ChevronDown,
  ChevronUp,
  Compass,
  Building2,
  User,
  Calendar,
  Clock,
  Car,
  FileText,
  Minus,
  Sparkles,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { type TaskStatus, type ManagerTrip } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyTeam } from "@/lib/team.functions";
import { supabase } from "@/integrations/supabase/client";
import { TaskLocationPicker } from "@/components/admin/TaskLocationPicker";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";
import { listTripHistory, listTrips, createTrip, transitionTrip as transitionTripFn, deleteTrip } from "@/backend/functions/trips.functions";

export const Route = createFileRoute("/manager/trips")({
  component: ManagerTripsPage,
});

const STATUSES: TaskStatus[] = ["pending", "in_progress", "done", "cancelled"];

type DbTripView = {
  id: string; destination: string; address: string; date: string; time?: string;
  purpose: string; notes?: string; assignee: string; createdBy: string; status: TaskStatus;
  startedAt?: string; completedAt?: string; history?: ManagerTrip["history"];
};

function statusClass(s: TaskStatus) {
  if (s === "done") return "bg-success/10 text-success";
  if (s === "in_progress") return "bg-brand/10 text-brand";
  if (s === "cancelled") return "bg-muted text-muted-foreground";
  return "bg-warning/10 text-warning";
}

function ManagerTripsPage() {
  const { t } = useI18n();
  const session = useSession();
  const qc = useQueryClient();
  const listFn = useServerFn(listTrips);
  const transFn = useServerFn(transitionTripFn);
  const delFn = useServerFn(deleteTrip);
  const me = useMemo(
    () => (session?.employeeId ? { id: session.employeeId, name: session.name } : undefined),
    [session],
  );
  const { data: rawTrips = [] } = useQuery({
    queryKey: ["manager-trips"],
    queryFn: () => listFn(),
    enabled: !!me,
  });
  const histFn = useServerFn(listTripHistory);
  const { data: histData } = useQuery({ queryKey: ["trip-history"], queryFn: () => histFn(), enabled: !!me });
  const histByTrip = useMemo(() => {
    const m: Record<string, NonNullable<ManagerTrip["history"]>> = {};
    const label: Record<string, string> = { created: "Created", started: "Started", finished: "Finished", cancelled: "Cancelled", status: "Status changed", allowance: "Allowance changed" };
    for (const h of (histData?.rows ?? []).slice().reverse()) {
      const note = h.event === "allowance"
        ? `${h.allowanceBefore ?? "—"} → ${h.allowanceAfter ?? "—"} EGP`
        : h.event === "created" && h.allowanceAfter != null ? `Allowance ${h.allowanceAfter} EGP` : undefined;
      (m[h.tripId] ??= []).push({ ts: h.createdAt, by: h.changedByName, to: label[h.event] ?? h.event, note } as any);
    }
    return m;
  }, [histData]);
  const trips: DbTripView[] = useMemo(() => (rawTrips as any[]).map((r) => ({
    id: r.id, destination: r.destination ?? "", address: r.address ?? "", date: r.trip_date,
    time: r.trip_time ?? undefined, purpose: r.purpose ?? "", notes: r.notes ?? undefined,
    assignee: r.assignee, createdBy: r.created_by, status: r.status,
    startedAt: r.started_at ?? undefined, completedAt: r.completed_at ?? undefined, history: histByTrip[r.id] ?? [],
  })), [rawTrips, histByTrip]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["manager-trips"] }); qc.invalidateQueries({ queryKey: ["trip-history"] }); };
  const transitionTrip = async (id: string, status: TaskStatus, _by: string) => {
    try { await transFn({ data: { id, status } }); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const removeTrip = async (id: string) => {
    try { await delFn({ data: { id } }); refresh(); toast.success("Removed"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };
  const teamFn = useServerFn(getMyTeam);
  const { data: teamData } = useQuery({
    queryKey: ["manager-team-all"],
    queryFn: () => teamFn({ data: { page: 1, pageSize: 500, q: "" } }),
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
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-90 transition-opacity"
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
                <button onClick={() => removeTrip(tr.id)} className="ms-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-danger">
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

function AddTripModal({
  me,
  team,
  onClose,
}: {
  me: string;
  team: Array<{
    id: string;
    name: string;
    email?: string;
    department?: string | null;
    position?: string | null;
    avatar_url?: string | null;
  }>;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const { data: cityData } = useQuery({
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
  const cities = cityData?.cities ?? [];
  const districts = cityData?.districts ?? [];

  const assigneesList = team;

  const [destination, setDestination] = useState("");
  const [address, setAddress] = useState("");
  const [cityId, setCityId] = useState("");
  const [district, setDistrict] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState(assigneesList[0]?.id ?? "");

  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);

  useEffect(() => {
    if (!assignee && assigneesList[0]?.id) {
      setAssignee(assigneesList[0].id);
    }
  }, [assigneesList, assignee]);

  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  const [radius_m, setRadiusM] = useState<number>(500);
  const [showMap, setShowMap] = useState(false);
  const [overnightNights, setOvernightNights] = useState<number>(0);
  const [transportType, setTransportType] = useState<string>("");

  const qc = useQueryClient();
  const createFn = useServerFn(createTrip);
  const [saving, setSaving] = useState(false);

  const selectedEmployee = useMemo(
    () => assigneesList.find((e) => e.id === assignee),
    [assigneesList, assignee],
  );

  const filteredTeam = useMemo(() => {
    if (!assigneeSearch.trim()) return assigneesList;
    const q = assigneeSearch.toLowerCase();
    return assigneesList.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q)),
    );
  }, [assigneesList, assigneeSearch]);

  const submit = async () => {
    if (!destination.trim()) {
      return toast.error(isAr ? "يرجى تحديد وجهة المأمورية" : "Please enter a destination");
    }
    if (!address.trim()) {
      return toast.error(isAr ? "يرجى إدخال عنوان المأمورية" : "Please enter an address");
    }
    if (!assignee) {
      return toast.error(isAr ? "يرجى اختيار المكلف بالمأمورية" : "Please select an assignee");
    }
    setSaving(true);
    try {
      await createFn({
        data: {
          destination: destination.trim(),
          address: address.trim(),
          trip_date: date,
          trip_time: time || null,
          purpose: purpose.trim() || null,
          notes: notes.trim() || null,
          assignee,
          city: cityId || null,
          district: district || null,
          lat: lat ?? null,
          lng: lng ?? null,
          radius_m: lat != null ? radius_m : null,
          overnight_nights: overnightNights,
          transport_type: transportType || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["manager-trips"] });
      toast.success(isAr ? "تم حفظ مأمورية العمل بنجاح" : "Trip created successfully");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save trip");
    } finally {
      setSaving(false);
    }
  };

  const cityName =
    cities.find((c: any) => c.id === cityId)?.[isAr ? "name_ar" : "name_en"] ||
    cities.find((c: any) => c.id === cityId)?.name_en ||
    destination;

  const quickPurposes = isAr
    ? ["معاينة موقع", "اجتماع عميل", "صيانة طارئة", "تسليم وتشغيل", "فحص دوري"]
    : ["Site Inspection", "Client Meeting", "Emergency Maintenance", "Delivery & Setup", "Periodic Audit"];

  const transportOptions = [
    {
      id: "company_car",
      label: isAr ? "سيارة الشركة" : "Company Car",
      sub: isAr ? "سيارة مخصصة للمأمورية" : "Dedicated vehicle",
      icon: Car,
    },
    {
      id: "expense",
      label: isAr ? "مصروفات انتقال" : "Travel Expenses",
      sub: isAr ? "بدل انتقال معتمد" : "Expense reimbursement",
      icon: Sparkles,
    },
    {
      id: "public",
      label: isAr ? "مواصلات أخرى" : "Public / Other",
      sub: isAr ? "قطار / حافلة / تاكسي" : "Transit or taxi",
      icon: Navigation,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-foreground/40 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex max-h-[92vh] w-full max-w-4xl lg:max-w-5xl flex-col rounded-3xl bg-background border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-3.5 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-xs">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                {isAr ? "إضافة مأمورية عمل جديدة" : "Add Business Trip"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "تكليف عضو من الفريق بالمأمورية وتحديد الوجهة والمواعيد والبدلات"
                  : "Assign team member, schedule, destination and transport logistics"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Form Body with 2-Column Desktop Grid (No side scrollbar) ── */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-4 sm:p-5 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* ── Column 1: Core Details, Schedule & Transport ── */}
            <div className="space-y-4">
              {/* Card 1: Assignee & Core Details */}
              <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-foreground border-b border-border/50 pb-1.5">
                  <User className="h-3.5 w-3.5 text-brand" />
                  <span>{isAr ? "المكلف والهدف من المأمورية" : "Assignee & Trip Core"}</span>
                </div>

                {/* Assignee Combobox */}
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    {isAr ? "المكلف بالمأمورية" : "Assigned Team Member"} <span className="text-destructive">*</span>
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAssigneeMenuOpen((v) => !v)}
                      className="w-full flex items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-start transition-all hover:border-brand/40 focus:outline-hidden focus:ring-2 focus:ring-brand/20"
                    >
                      {selectedEmployee ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-xs">
                            {selectedEmployee.avatar_url ? (
                              <img
                                src={selectedEmployee.avatar_url}
                                alt=""
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              selectedEmployee.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="font-semibold text-foreground text-xs truncate">
                              {selectedEmployee.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {selectedEmployee.position || selectedEmployee.email || (isAr ? "عضو الفريق" : "Team member")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {isAr ? "اختر أحد أعضاء الفريق…" : "Select a team member…"}
                        </span>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground shrink-0 ms-2 transition-transform duration-200 ${
                          assigneeMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {assigneeMenuOpen && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-2xl border border-border bg-background shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-2 border-b border-border/60 bg-muted/30">
                          <div className="relative">
                            <Search className="h-3.5 w-3.5 text-muted-foreground absolute start-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              autoFocus
                              value={assigneeSearch}
                              onChange={(e) => setAssigneeSearch(e.target.value)}
                              placeholder={isAr ? "بحث بالاسم أو البريد…" : "Search team members…"}
                              className="w-full bg-background rounded-lg border border-input ps-8 pe-2.5 py-1.5 text-xs focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto p-1.5 space-y-1">
                          {filteredTeam.length === 0 ? (
                            <p className="p-3 text-center text-muted-foreground">
                              {assigneesList.length === 0
                                ? isAr
                                  ? "لا يوجد أعضاء في فريقك"
                                  : "No team members assigned"
                                : isAr
                                ? "لا توجد نتائج مطابقة"
                                : "No matching members found"}
                            </p>
                          ) : (
                            filteredTeam.map((emp) => {
                              const isSelected = emp.id === assignee;
                              return (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => {
                                    setAssignee(emp.id);
                                    setAssigneeMenuOpen(false);
                                    setAssigneeSearch("");
                                  }}
                                  className={`w-full flex items-center justify-between rounded-xl p-2 text-start transition-colors ${
                                    isSelected
                                      ? "bg-brand/10 font-semibold text-brand"
                                      : "hover:bg-muted text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-xs text-foreground">
                                      {emp.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 truncate">
                                      <p className="text-xs truncate">{emp.name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        {emp.position || emp.email}
                                      </p>
                                    </div>
                                  </div>
                                  {isSelected && <Check className="h-4 w-4 text-brand shrink-0 ms-2" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Destination & Purpose */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      {isAr ? "وجهة المأمورية / العميل" : "Destination / Site"} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder={isAr ? "مثال: فرع الإسكندرية - مركز البيانات" : "e.g. Alexandria Data Center"}
                        className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      {isAr ? "الغرض من المأمورية" : "Trip Purpose"}
                    </label>
                    <input
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder={isAr ? "مثال: فحص وتحديث الخوادم" : "e.g. Server maintenance and audit"}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </div>

                {/* Quick Purpose Suggestion Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-muted-foreground me-1 font-medium">
                    {isAr ? "اقتراحات سريعة:" : "Quick suggestions:"}
                  </span>
                  {quickPurposes.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurpose(p)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${
                        purpose === p
                          ? "border-brand bg-brand/10 text-brand font-semibold"
                          : "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 3: Schedule, Overnight & Transport */}
              <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-4">
                <div className="flex items-center gap-2 font-semibold text-foreground border-b border-border/50 pb-2">
                  <Calendar className="h-4 w-4 text-brand" />
                  <span>{isAr ? "المواعيد والإقامة ووسيلة النقل" : "Schedule, Stay & Transport"}</span>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      {isAr ? "تاريخ السفر" : "Trip Date"} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-2 text-xs focus:outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      {isAr ? "وقت الانطلاق" : "Departure Time"}
                    </label>
                    <div className="relative">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-2 text-xs focus:outline-hidden font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Overnight Nights Stepper */}
                <div className="rounded-xl border border-input/60 bg-background/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-semibold text-foreground text-xs block">
                      {isAr ? "ليالي الإقامة (المبيت)" : "Overnight Nights"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {isAr
                        ? "حدد عدد ليالي المبيت لاحتساب بدل السفر والإقامة تلقائياً"
                        : "Sets per-diem allowance & accommodation rate calculation"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      disabled={overnightNights <= 0}
                      onClick={() => setOvernightNights((n) => Math.max(0, n - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-card text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex flex-col items-center min-w-[105px]">
                      <span className="font-display text-base font-bold text-foreground">
                        {overnightNights}
                      </span>
                      <span className="text-[10px] font-semibold text-brand">
                        {overnightNights === 0
                          ? isAr
                            ? "بدون مبيت (عودة)"
                            : "Same-day trip"
                          : overnightNights === 1
                          ? isAr
                            ? "ليلة واحدة"
                            : "1 Night stay"
                          : isAr
                          ? `${overnightNights} ليالي إقامة`
                          : `${overnightNights} Nights stay`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOvernightNights((n) => n + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-card text-foreground hover:bg-muted transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Transport Type Cards */}
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    {isAr ? "وسيلة النقل المعتمدة" : "Transport Type"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {transportOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = transportType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTransportType(isSelected ? "" : opt.id)}
                          className={`flex flex-col items-start p-3 rounded-xl border text-start transition-all ${
                            isSelected
                              ? "border-brand bg-brand/10 shadow-xs"
                              : "border-input bg-background hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <Icon
                              className={`h-4 w-4 ${isSelected ? "text-brand" : "text-muted-foreground"}`}
                            />
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-brand" />
                            )}
                          </div>
                          <span
                            className={`font-semibold text-xs ${
                              isSelected ? "text-brand" : "text-foreground"
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {opt.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Column 2: Location, Geofence Map & Notes ── */}
            <div className="space-y-4">
              {/* Card 2: Location & Address */}
              <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-brand" />
                    <span>{isAr ? "الموقع الجغرافي والعنوان" : "Location & Address"}</span>
                  </div>
                  {lat != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      {isAr ? "إحداثيات محددة" : "GPS Coordinates Set"}
                    </span>
                  )}
                </div>

                {/* City & District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      {isAr ? "المدينة / المحافظة" : "City"}
                    </label>
                    <select
                      value={cityId}
                      onChange={(e) => {
                        setCityId(e.target.value);
                        setDistrict("");
                      }}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden font-medium"
                    >
                      <option value="">{isAr ? "— اختر المدينة —" : "— Select City —"}</option>
                      {cities.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {isAr && c.name_ar ? c.name_ar : c.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      {isAr ? "الحي / المنطقة" : "District"}
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      disabled={!cityId}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden disabled:opacity-50 font-medium"
                    >
                      <option value="">{isAr ? "— اختر المنطقة —" : "— Select District —"}</option>
                      {districts
                        .filter((d: any) => d.city_id === cityId)
                        .map((d: any) => (
                          <option key={d.id} value={d.name_en}>
                            {isAr && d.name_ar ? d.name_ar : d.name_en}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Address with Map Pin Toggle */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    {isAr ? "العنوان التفصيلي" : "Street Address"} <span className="text-destructive">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={
                          isAr
                            ? "الشارع ورقم المبنى أو معالم الموقع…"
                            : "Street name, building number, landmarks…"
                        }
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                        showMap || lat != null
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border bg-background hover:bg-muted text-foreground"
                      }`}
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{showMap ? (isAr ? "إخفاء الخريطة" : "Hide Map") : (isAr ? "تحديد بالخريطة" : "Pin on Map")}</span>
                    </button>
                  </div>
                </div>

                {/* Unfolded Interactive Map */}
                {showMap && (
                  <div className="mt-2 rounded-2xl border border-brand/30 bg-background/50 p-2.5 shadow-inner space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1">
                      <span>
                        {isAr
                          ? "انقر على الخريطة لتحديد الموقع الجغرافي ونطاق الحضور"
                          : "Click on map to position geofence destination coordinates"}
                      </span>
                      {lat != null && lng != null && (
                        <span className="font-mono text-[10px] text-brand">
                          {lat.toFixed(4)}, {lng.toFixed(4)} ({radius_m}m)
                        </span>
                      )}
                    </div>
                    <TaskLocationPicker
                      lat={lat}
                      lng={lng}
                      radius_m={radius_m}
                      cityName={cityName}
                      districtName={district}
                      onChange={async (l, g, r) => {
                        setLat(l);
                        setLng(g);
                        setRadiusM(r ?? 500);
                        if (l != null && g != null) {
                          try {
                            const geo = await reverseGeocodeCoords(l, g);
                            const autoAddress =
                              geo.detailedAddress || geo.street || geo.formatted;
                            if (autoAddress) setAddress(autoAddress);
                          } catch {
                            // ignore
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Card 4: Notes & Instructions */}
              <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-foreground border-b border-border/50 pb-1.5">
                  <FileText className="h-3.5 w-3.5 text-brand" />
                  <span>{isAr ? "ملاحظات وتوجيهات المأمورية" : "Special Notes & Instructions"}</span>
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isAr
                      ? "تعليمات أمنية، تصاريح دخول، مهمات أو معدات يلزم اصطحابها…"
                      : "Gate pass requirements, safety protocols, equipment checklist…"
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand/20 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/80 px-6 py-3 bg-muted/20">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground w-full sm:w-auto truncate">
            {destination && (
              <span className="font-semibold text-foreground truncate">
                📍 {destination}
              </span>
            )}
            {selectedEmployee && (
              <>
                <span>•</span>
                <span className="truncate">👤 {selectedEmployee.name}</span>
              </>
            )}
            {date && (
              <>
                <span>•</span>
                <span>📅 {date}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 ms-auto shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="disabled:opacity-50 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-5 py-2 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition-opacity"
            >
              {saving ? (
                <span>{isAr ? "جاري الحفظ…" : "Saving…"}</span>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{isAr ? "حفظ المأمورية" : "Save Changes"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}