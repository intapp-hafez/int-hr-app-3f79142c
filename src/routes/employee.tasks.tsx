import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from "react";
import { ListChecks, Route as RouteIcon, MapPin, Play, Check, History, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStore, transitionTrip, selfAssignTask, getState, type TaskStatus, type TaskPriority } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTasks, transitionTask as transitionTaskFn, getProfileNames } from "@/backend/functions/tasks.functions";
import { mapTaskRow, type TaskRow } from "@/lib/task-mapping";
import { useMemo } from "react";

export const Route = createFileRoute("/employee/tasks")({
  component: EmployeeTasksPage,
});

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

function EmployeeTasksPage() {
  const { t } = useI18n();
  const session = useSession();
  const employees = useStore((s) => s.employees);
  const currentEmpId = useStore((s) => s.currentEmployeeId);
  const trips = useStore((s) => s.trips);

  const meId = session?.employeeId
    ?? employees.find((e) => e.name === session?.name)?.id
    ?? currentEmpId;

  const qc = useQueryClient();
  const listTasksFn = useServerFn(listTasks);
  const transitionFn = useServerFn(transitionTaskFn);
  const profileNamesFn = useServerFn(getProfileNames);
  const { data: taskRows = [] } = useQuery({
    queryKey: ["tasks-db"],
    queryFn: () => listTasksFn(),
    enabled: !!meId,
  });
  const tasks = useMemo(() => (taskRows as TaskRow[]).map(mapTaskRow), [taskRows]);
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

  const getLocation = (): Promise<{ lat?: number; lng?: number }> =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
      const done = (v: { lat?: number; lng?: number }) => resolve(v);
      const timer = setTimeout(() => done({}), 4000);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(timer); done({ lat: p.coords.latitude, lng: p.coords.longitude }); },
        () => { clearTimeout(timer); done({}); },
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 },
      );
    });

  const transitionTask = async (id: string, status: TaskStatus, _by: string, note?: string) => {
    try {
      const loc = await getLocation();
      await transitionFn({ data: { id, status, note, lat: loc.lat, lng: loc.lng } });
      qc.invalidateQueries({ queryKey: ["tasks-db"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  // Match assignment by auth user id OR legacy store id
  const myKey = (id: string) => id === meId || id === session?.employeeId;
  const myTasks = tasks.filter((tk) => tk.assignees.some(myKey));
  const myTrips = trips.filter((tr) => myKey(tr.assignee));

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

  const [liveGeo, setLiveGeo] = useState<{ city?: string; district?: string; err?: string; lat?: number; lng?: number }>({});
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const coords = await getLocation();
      if (cancelled) return;
      if (coords.lat == null || coords.lng == null) return setLiveGeo({ err: "Location unavailable" });
      try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=en`);
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setLiveGeo({ 
          city: j.city || j.locality || j.principalSubdivision || undefined,
          district: j.localityInfo?.administrative?.find((a: any) => a.adminLevel >= 6)?.name || j.locality || undefined,
          lat: coords.lat,
          lng: coords.lng
        });
      } catch { }
    }
    refresh();
    const id = setInterval(refresh, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const [taskGeo, setTaskGeo] = useState<Record<string, { city?: string; district?: string }>>({});

  useEffect(() => {
    const needGeocode = myTasks.filter((t) => (!t.city || !t.district) && t.lat != null && t.lng != null && !taskGeo[t.id]);
    if (needGeocode.length === 0) return;

    needGeocode.forEach(async (t) => {
      try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${t.lat}&longitude=${t.lng}&localityLanguage=en`);
        if (!r.ok) return;
        const j = await r.json();
        const city = j.city || j.locality || j.principalSubdivision || undefined;
        const district = j.localityInfo?.administrative?.find((a: any) => a.adminLevel >= 6)?.name || j.locality || undefined;
        if (city || district) {
          setTaskGeo((prev) => ({ ...prev, [t.id]: { city, district } }));
        }
      } catch { }
    });
  }, [myTasks]);

  const formatLocation = (tk: (typeof myTasks)[number]) => {
    const geo = taskGeo[tk.id];
    let city = tk.city || geo?.city;
    let district = tk.district || geo?.district;

    // If city is missing, infer from district via geoData
    const targetDistrict = district?.toLowerCase();
    if (!city && district && targetDistrict && geoData) {
      const d = geoData.districts.find(
        (x: any) =>
          x.id === district ||
          x.name_en?.toLowerCase() === targetDistrict ||
          x.name_ar === district
      );
      if (d) {
        district = d.name_en;
        const c = geoData.cities.find((x: any) => x.id === d.city_id);
        if (c) city = c.name_en;
      }
    }

    if (city && geoData) {
      const c = geoData.cities.find((x: any) => x.id === city);
      if (c) city = c.name_en;
    }

    if (district && geoData) {
      const d = geoData.districts.find((x: any) => x.id === district);
      if (d) district = d.name_en;
    }

    const cityDistrict = city && district && city.toLowerCase() !== district.toLowerCase()
      ? `${city}, ${district}`
      : city || district;

    return [cityDistrict, tk.address].filter(Boolean).join(" — ");
  };

  const isLocationValid = (tk: any) => {
    if (tk.lat != null && tk.lng != null && liveGeo.lat != null && liveGeo.lng != null) {
      const R = 6371e3; // metres
      const p1 = (liveGeo.lat * Math.PI) / 180;
      const p2 = (tk.lat * Math.PI) / 180;
      const dp = ((tk.lat - liveGeo.lat) * Math.PI) / 180;
      const dl = ((tk.lng - liveGeo.lng) * Math.PI) / 180;
      const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      const radius = tk.radius_m || 500;
      return distance <= radius;
    }
    if (!tk.district && !tk.city) return true;
    if (tk.district && liveGeo.district) {
      if (liveGeo.district.toLowerCase().includes(tk.district.toLowerCase()) || tk.district.toLowerCase().includes(liveGeo.district.toLowerCase())) {
        return true;
      }
    }
    if (tk.city && liveGeo.city) {
      if (liveGeo.city.toLowerCase().includes(tk.city.toLowerCase()) || tk.city.toLowerCase().includes(liveGeo.city.toLowerCase())) {
        return true;
      }
    }
    if (!liveGeo.district && !liveGeo.city) return false;
    return false;
  };

  const [prompt, setPrompt] = useState<null | { kind: "task" | "trip"; id: string; to: TaskStatus; label: string }>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const labelStatus = (s: TaskStatus) =>
    s === "pending" ? t("statusPending") : s === "in_progress" ? t("statusInProgress") : s === "done" ? t("statusDone") : t("statusCancelled");
  const labelPriority = (p: TaskPriority) =>
    p === "low" ? t("priorityLow") : p === "medium" ? t("priorityMedium") : t("priorityHigh");
  const managerName = (id: string) =>
    employees.find((e) => e.id === id)?.name ?? creatorMap.get(id) ?? "Manager";
  const toggle = (id: string) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-brand" />
          <h2 className="font-display text-base font-semibold">{t("myTasks")}</h2>
          <span className="text-xs text-muted-foreground">({myTasks.length})</span>
        </div>
        {myTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">{t("noTasks")}</div>
        ) : (
          <ul className="space-y-3">
            {myTasks.map((tk) => {
              const locStr = formatLocation(tk);
              return (
              <li key={tk.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{tk.title}</p>
                    {tk.description && <p className="mt-0.5 text-xs text-muted-foreground">{tk.description}</p>}
                    {locStr && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{locStr}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tk.date}{tk.dueTime ? ` • ${tk.dueTime}` : ""}
                      {tk.estimatedHours ? ` • ${tk.estimatedHours}${t("hoursShort")}` : ""}
                      {" • "}{t("createdBy")}: {managerName(tk.createdBy)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityClass(tk.priority)}`}>{labelPriority(tk.priority)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(tk.status)}`}>{labelStatus(tk.status)}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tk.status === "pending" && (
                    <button
                      disabled={!isLocationValid(tk)}
                      title={!isLocationValid(tk) ? t("locationRequiredStart") : ""}
                      onClick={() => setPrompt({ kind: "task", id: tk.id, to: "in_progress", label: t("taskCheckIn") })}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" /> {t("markInProgress")}
                    </button>
                  )}
                  {tk.status !== "done" && tk.status !== "cancelled" && (
                    <button
                      disabled={tk.status !== "in_progress" || !isLocationValid(tk)}
                      title={!isLocationValid(tk) ? t("locationRequiredComplete") : ""}
                      onClick={() => setPrompt({ kind: "task", id: tk.id, to: "done", label: t("taskCheckOut") })}
                      className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> {t("markDone")}
                    </button>
                  )}
                  <button onClick={() => toggle(tk.id)} className="ms-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold">
                    <History className="h-3 w-3" /> {tk.history?.length ?? 0} {expanded[tk.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                {expanded[tk.id] && (
                  <ul className="mt-3 space-y-1 rounded-lg bg-muted/40 p-2 text-[11px]">
                    {!tk.history?.length && <li className="text-muted-foreground">{t("noHistory")}</li>}
                    {tk.history?.slice().reverse().map((h, i) => (
                      <li key={i}>
                        <span className="font-mono text-muted-foreground">{new Date(h.ts).toLocaleString()}</span> — {h.to}{h.note ? ` · ${h.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <RouteIcon className="h-4 w-4 text-brand" />
          <h2 className="font-display text-base font-semibold">{t("myTrips")}</h2>
          <span className="text-xs text-muted-foreground">({myTrips.length})</span>
        </div>
        {myTrips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">{t("noTrips")}</div>
        ) : (
          <ul className="space-y-3">
            {myTrips.map((tr) => (
              <li key={tr.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{tr.destination}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{tr.address}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tr.date}{tr.time ? ` • ${tr.time}` : ""}</p>
                    {tr.purpose && <p className="mt-1 text-xs">{tr.purpose}</p>}
                    {tr.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">{tr.notes}</p>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(tr.status)}`}>{labelStatus(tr.status)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tr.status === "pending" && (
                    <button 
                      onClick={() => setPrompt({ kind: "trip", id: tr.id, to: "in_progress", label: t("markInProgress") })} 
                      disabled={!isLocationValid(tr)}
                      title={!isLocationValid(tr) ? t("locationRequiredStart") : ""}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" /> {t("markInProgress")}
                    </button>
                  )}
                  {tr.status !== "done" && tr.status !== "cancelled" && (
                    <button 
                      onClick={() => setPrompt({ kind: "trip", id: tr.id, to: "done", label: t("markDone") })} 
                      disabled={tr.status !== "in_progress" || !isLocationValid(tr)}
                      title={!isLocationValid(tr) ? t("locationRequiredComplete") : ""}
                      className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> {t("markDone")}
                    </button>
                  )}
                  <button onClick={() => toggle(tr.id)} className="ms-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold">
                    <History className="h-3 w-3" /> {tr.history?.length ?? 0} {expanded[tr.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                {expanded[tr.id] && (
                  <ul className="mt-3 space-y-1 rounded-lg bg-muted/40 p-2 text-[11px]">
                    {!tr.history?.length && <li className="text-muted-foreground">{t("noHistory")}</li>}
                    {tr.history?.slice().reverse().map((h, i) => (
                      <li key={i}>
                        <span className="font-mono text-muted-foreground">{new Date(h.ts).toLocaleString()}</span> — {h.to}{h.note ? ` · ${h.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {prompt && (
        <NoteModal
          label={prompt.label}
          onClose={() => setPrompt(null)}
          onConfirm={(note) => {
            if (prompt.kind === "task") transitionTask(prompt.id, prompt.to, meId, note);
            else transitionTrip(prompt.id, prompt.to, meId, note);
            toast.success(prompt.label);
            setPrompt(null);
          }}
        />
      )}
    </div>
  );
}

function SelfAssignModal({ meId, meName, onClose }: { meId: string; meName: string; onClose: () => void }) {
  const { t } = useI18n();
  const cities = getState().policy.cities;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cityId, setCityId] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("");
  const city = cities.find((c) => c.id === cityId);

  const submit = () => {
    if (!title.trim()) return toast.error(t("rowTitle"));
    selfAssignTask({
      employeeId: meId,
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      dueTime: startTime || undefined,
      city: city?.nameEn,
      district: district || undefined,
      address: address.trim() || undefined,
      estimatedHours: hours ? Number(hours) : undefined,
    });
    toast.success(t("notifyManagerHr"), { description: `${meName} • ${title.trim()}` });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/40 p-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-auto w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold">{t("selfAssign")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("selfAssignSubtitle")}</p>
        <div className="mt-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{t("rowTitle")}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{t("taskDescription")}</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">{t("taskDate")}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">{t("startTime")}</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">{t("taskCity")}</span>
              <select value={cityId} onChange={(e) => { setCityId(e.target.value); setDistrict(""); }} className="input">
                <option value="">—</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">{t("rowSiteDistrict")}</span>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} className="input" disabled={!city}>
                <option value="">—</option>
                {city?.districts.map((d) => <option key={d.id} value={d.nameEn}>{d.nameEn}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-2 block space-y-1.5">
              <span className="text-xs font-medium">{t("rowAddress")}</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">{t("rowHours")}</span>
              <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className="input" />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">{t("cancel")}</button>
          <button onClick={submit} className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand">{t("save")}</button>
        </div>
      </div>
    </div>
  );
}

function NoteModal({ label, onClose, onConfirm }: { label: string; onClose: () => void; onConfirm: (note: string) => void }) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-soft">
        <h3 className="mb-3 font-display text-base font-semibold">{label}</h3>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">{t("optionalNote")}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t("notePlaceholder")} className="input" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">{t("cancel")}</button>
          <button onClick={() => onConfirm(note)} className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand">{t("confirm")}</button>
        </div>
      </div>
    </div>
  );
}