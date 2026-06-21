import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Wifi, WifiOff, CheckCircle2, Calendar, Sparkles, AlertTriangle, Loader2, LogIn, LogOut, Radio, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useI18n, useTranslators } from "@/lib/i18n";
import { getMe } from "@/backend/functions/auth.functions";
import { checkIn, checkOut, listMyAttendance, listMyAccess } from "@/backend/functions/attendance.functions";
import { listMyLeaves } from "@/backend/functions/leaves.functions";
import { listHolidays } from "@/backend/functions/holidays.functions";

export const Route = createFileRoute("/employee/")({
  component: EmployeeDashboard,
});

function EmployeeDashboard() {
  const { t, lang } = useI18n();
  const { tName, tDept, tBranch, tHoliday } = useTranslators();
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [nearest, setNearest] = useState<{ name: string; distance: number; radius: number; inside: boolean } | null>(null);
  const [liveGeo, setLiveGeo] = useState<{ city?: string; district?: string; street?: string; lat?: number; lng?: number; err?: string } | null>(null);

  const meFn = useServerFn(getMe);
  const attFn = useServerFn(listMyAttendance);
  const lvFn = useServerFn(listMyLeaves);
  const holFn = useServerFn(listHolidays);
  const inFn = useServerFn(checkIn);
  const outFn = useServerFn(checkOut);
  const accessFn = useServerFn(listMyAccess);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const attQ = useQuery({ queryKey: ["my-attendance"], queryFn: () => attFn() });
  const lvQ = useQuery({ queryKey: ["my-leaves"], queryFn: () => lvFn() });
  const holQ = useQuery({ queryKey: ["holidays"], queryFn: () => holFn() });
  const accessQ = useQuery({ queryKey: ["my-access"], queryFn: () => accessFn() });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const upd = () => setOnline(navigator.onLine);
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    return () => { clearInterval(id); window.removeEventListener("online", upd); window.removeEventListener("offline", upd); };
  }, []);

  // Live GPS: read coords on mount + every 60s, reverse-geocode, and compute nearest geofence.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const coords = await getCoords();
      if (cancelled) return;
      if (coords.lat == null || coords.lng == null) {
        setLiveGeo({ err: coords.err });
        return;
      }
      const geo = await reverseGeocode(coords.lat, coords.lng);
      if (cancelled) return;
      setLiveGeo({ ...geo, lat: coords.lat, lng: coords.lng });
      const locs: any[] = (accessQ.data as any)?.locations ?? [];
      if (locs.length) {
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        let best: { name: string; distance: number; radius: number; inside: boolean } | null = null;
        for (const l of locs) {
          const dLat = toRad(l.lat - coords.lat);
          const dLng = toRad(l.lng - coords.lng);
          const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coords.lat)) * Math.cos(toRad(l.lat)) * Math.sin(dLng / 2) ** 2;
          const d = 2 * R * Math.asin(Math.sqrt(s));
          if (!best || d < best.distance) best = { name: l.name, distance: d, radius: l.radius_m, inside: d <= l.radius_m };
        }
        if (!cancelled) setNearest(best);
      }
    }
    refresh();
    const id = setInterval(refresh, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [accessQ.data]);

  const profile: any = meQ.data?.profile ?? null;
  const attendance: any[] = (attQ.data as any[]) ?? [];
  const leaves: any[] = (lvQ.data as any[]) ?? [];
  const holidaysData: any[] = (holQ.data as any[]) ?? [];

  const today = now.toISOString().slice(0, 10);
  const todayRow = attendance.find((a) => a.date === today);
  const isCheckedIn = !!todayRow?.in_time && !todayRow?.out_time;
  const dayComplete = !!todayRow?.in_time && !!todayRow?.out_time;

  const monthStats = useMemo(() => {
    const ym = today.slice(0, 7);
    const m = attendance.filter((a) => typeof a.date === "string" && a.date.startsWith(ym));
    const present = m.filter((a) => a.status === "present" || a.status === "late").length;
    const late = m.filter((a) => a.status === "late").length;
    const approvedLeaves = leaves.filter((l) => l.status === "approved").length;
    return { present, late, leaves: approvedLeaves };
  }, [attendance, leaves, today]);

  const upcomingHolidays = useMemo(
    () => holidaysData.filter((h) => h.date >= today).slice(0, 3),
    [holidaysData, today],
  );

  const localeTag = lang === "ar" ? "ar-EG" : "en-GB";
  const time = now.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString(localeTag, { weekday: "long", day: "numeric", month: "long" });

  async function getCoords(): Promise<{ lat?: number; lng?: number; err?: string }> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return { err: "Geolocation not supported" };
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => resolve({ err: e.message }),
        { timeout: 8000, enableHighAccuracy: true },
      );
    });
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
      if (!r.ok) return {};
      const j: any = await r.json();
      return {
        city: j.city || j.locality || j.principalSubdivision || undefined,
        district: j.localityInfo?.administrative?.find((a: any) => a.adminLevel >= 6)?.name || undefined,
        street: [j.streetNumber, j.streetName].filter(Boolean).join(" ") || undefined,
      };
    } catch { return {}; }
  }

  async function handleAction() {
    const kind: "in" | "out" = isCheckedIn ? "out" : "in";
    setBusy(kind);
    try {
      const coords = await getCoords();
      if (coords.lat != null && coords.lng != null) {
        const locs: any[] = (accessQ.data as any)?.locations ?? [];
        if (locs.length) {
          const R = 6371000;
          const toRad = (d: number) => (d * Math.PI) / 180;
          let best: { name: string; distance: number; radius: number; inside: boolean } | null = null;
          for (const l of locs) {
            const dLat = toRad(l.lat - coords.lat);
            const dLng = toRad(l.lng - coords.lng);
            const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coords.lat)) * Math.cos(toRad(l.lat)) * Math.sin(dLng / 2) ** 2;
            const d = 2 * R * Math.asin(Math.sqrt(s));
            if (!best || d < best.distance) best = { name: l.name, distance: d, radius: l.radius_m, inside: d <= l.radius_m };
          }
          if (best) {
            setNearest(best);
            toast.message(best.inside
              ? `Inside "${best.name}" (${Math.round(best.distance)} m)`
              : `Nearest: "${best.name}" — ${Math.round(best.distance)} m away (allowed ${best.radius} m)`);
          }
        }
      }
      const geo = coords.lat != null && coords.lng != null ? await reverseGeocode(coords.lat, coords.lng) : {};
      const payload = { branch: profile?.branch ?? "HQ", lat: coords.lat, lng: coords.lng, network_ok: online, ...geo };
      if (kind === "in") {
        const res: any = await inFn({ data: payload });
        if (res?.blocked) { toast.error(res.reason); return; }
        toast.success(res?.free_check ? `${t("checkIn")} ✓ (free)` : `${t("checkIn")} ✓`);
      } else {
        const res: any = await outFn({ data: payload });
        if (res?.blocked) { toast.error(res.reason); return; }
        toast.success(`${t("checkOut")} ✓`);
      }
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const submitting = busy !== null;
  const loading = meQ.isLoading || attQ.isLoading;

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm text-muted-foreground">{t("dashboard")}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {loading ? "…" : tName(profile?.full_name) || profile?.email || "—"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {tDept(profile?.department ?? "")} {profile?.branch ? `• ${tBranch(profile.branch)}` : ""}
        </p>
      </section>

      <section className="overflow-hidden rounded-3xl bg-gradient-dark p-6 text-white shadow-soft">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60">{date}</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums">{time}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium backdrop-blur ${todayRow ? "bg-success/30 text-white" : "bg-white/10 text-white/80"}`}>
            {todayRow ? <CheckCircle2 className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {todayRow ? (isCheckedIn ? t("checkIn") : t("present")) : "—"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <StatusPill
            icon={MapPin}
            label={t("gpsStatus")}
            value={
              liveGeo?.err
                ? liveGeo.err
                : [liveGeo?.district, liveGeo?.city].filter(Boolean).join(", ") ||
                  (liveGeo?.lat != null ? `${liveGeo.lat.toFixed(4)}, ${liveGeo.lng?.toFixed(4)}` : "Locating…")
            }
            state={liveGeo?.err ? "fail" : liveGeo?.lat != null ? "ok" : "checking"}
          />
          <StatusPill
            icon={online ? Wifi : WifiOff}
            label={t("networkStatus")}
            value={
              !online
                ? "Offline"
                : nearest
                  ? nearest.inside
                    ? `${nearest.name} · ${Math.round(nearest.distance)} m`
                    : `Outside · ${Math.round(nearest.distance)} m`
                  : ((accessQ.data as any)?.locations?.length ?? 0) === 0
                    ? "Unrestricted"
                    : "Online"
            }
            state={!online ? "fail" : nearest ? (nearest.inside ? "ok" : "fail") : "ok"}
          />
        </div>

        <button
          onClick={handleAction}
          disabled={submitting || loading || dayComplete}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-base font-semibold shadow-brand transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
            isCheckedIn ? "bg-white text-foreground" : "bg-gradient-brand text-brand-foreground"
          }`}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {!submitting && (isCheckedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />)}
          {dayComplete ? t("checkOut") + " ✓" : isCheckedIn ? t("checkOut") : t("checkIn")}
        </button>
        {todayRow?.in_time && (
          <p className="mt-2 text-center text-[11px] text-white/70">
            {new Date(todayRow.in_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}
            {todayRow.out_time ? ` → ${new Date(todayRow.out_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        )}
        {dayComplete && (
          <p className="mt-1 text-center text-[11px] text-white/60">Only one check-in and one check-out per day.</p>
        )}
        {nearest && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] ${nearest.inside ? "bg-success/25 text-white" : "bg-destructive/30 text-white"}`}>
            <span className="font-semibold">{nearest.inside ? "Inside fence" : "Outside fence"}:</span>{" "}
            {nearest.name} · {Math.round(nearest.distance)} m {nearest.inside ? "from center" : "away"} (allowed {nearest.radius} m)
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3">
        <MiniStat label={t("present")} value={String(monthStats.present)} />
        <MiniStat label={t("leaves")} value={String(monthStats.leaves)} />
        <MiniStat label={t("late")} value={String(monthStats.late)} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-brand" /> Allowed locations & networks
        </h2>
        {accessQ.isLoading ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">…</p>
        ) : ((accessQ.data as any)?.locations?.length ?? 0) === 0 && ((accessQ.data as any)?.networks?.length ?? 0) === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">No restrictions — check in from anywhere.</p>
        ) : (
          <ul className="space-y-2">
            {((accessQ.data as any)?.locations ?? []).map((l: any) => (
              <li key={`loc-${l.id}`} className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2">
                <MapPin className="mt-0.5 h-4 w-4 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {Number(l.lat).toFixed(4)}, {Number(l.lng).toFixed(4)} · {l.radius_m} m
                  </p>
                </div>
              </li>
            ))}
            {((accessQ.data as any)?.networks ?? []).map((n: any) => (
              <li key={`net-${n.id}`} className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2">
                <Radio className="mt-0.5 h-4 w-4 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {n.ssid ? `SSID: ${n.ssid}` : "any SSID"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">{t("attendance")}</h2>
        {attendance.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="divide-y divide-border">
            {attendance.slice(0, 3).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm font-medium">{a.date}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.in_time ? new Date(a.in_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {" → "}
                      {a.out_time ? new Date(a.out_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {a.branch ? ` • ${tBranch(a.branch)}` : ""}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${a.status === "late" ? "bg-warning/20 text-warning-foreground" : "bg-success/15 text-success"}`}>
                  {a.status === "late" ? t("late") : t("present")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-brand" /> {t("upcomingHolidays")}
        </h2>
        {upcomingHolidays.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2.5">
            {upcomingHolidays.map((h: any) => (
              <li key={h.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{tHoliday(h.name)}</p>
                </div>
                <span className="text-xs font-semibold tabular-nums">{h.date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ icon: Icon, label, value, state }: { icon: typeof MapPin; label: string; value: string; state: "checking" | "ok" | "fail" }) {
  const stateClasses =
    state === "ok" ? "bg-success/20 ring-success/30" :
    state === "fail" ? "bg-destructive/20 ring-destructive/30" :
    "bg-white/10 ring-white/10";
  return (
    <div className={`rounded-xl px-3 py-2.5 ring-1 backdrop-blur ${stateClasses}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/70">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {state === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
        {state === "fail" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
        {state === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />}
        <p className="truncate text-xs font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
