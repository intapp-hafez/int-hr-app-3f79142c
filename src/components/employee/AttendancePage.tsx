import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { MapPin, Wifi, WifiOff, CalendarDays, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/date-format";
import { listMyAttendance } from "@/backend/functions/attendance.functions";
import { listMyLeaves } from "@/backend/functions/leaves.functions";
import { ValidationHistoryPanel } from "./ValidationHistoryPanel";

const statusStyle: Record<string, string> = {
  present: "bg-success/15 text-success",
  late: "bg-warning/20 text-warning-foreground",
  absent: "bg-destructive/15 text-destructive",
  leave: "bg-info/15 text-info",
  holiday: "bg-muted text-muted-foreground",
  weekend: "bg-muted text-muted-foreground",
};

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function hoursBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function dateInRange(d: string, start: string, end: string) {
  return d >= start && d <= end;
}

export function AttendancePage() {
  const { t } = useI18n();
  const att = useServerFn(listMyAttendance);
  const lv = useServerFn(listMyLeaves);
  const attQ = useQuery({ queryKey: ["my-attendance"], queryFn: () => att() });
  const lvQ = useQuery({ queryKey: ["my-leaves"], queryFn: () => lv() });

  const approvedLeaves = useMemo(
    () => (lvQ.data ?? []).filter((l: any) => l.status === "approved" || l.status === "pending"),
    [lvQ.data],
  );

  const [preset, setPreset] = useState<"7" | "30" | "month" | "all" | "custom">("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    if (preset === "7") return { s: iso(new Date(now.getTime() - 6 * 86400000)), e: iso(now) };
    if (preset === "30") return { s: iso(new Date(now.getTime() - 29 * 86400000)), e: iso(now) };
    if (preset === "month") return { s: iso(new Date(now.getFullYear(), now.getMonth(), 1)), e: iso(now) };
    if (preset === "custom") return { s: from || "0000-01-01", e: to || "9999-12-31" };
    return { s: "0000-01-01", e: "9999-12-31" };
  }, [preset, from, to]);
  const rowsF = useMemo(
    () => ((attQ.data ?? []) as any[]).filter((r) => r.date >= range.s && r.date <= range.e),
    [attQ.data, range],
  );

  const stats = useMemo(() => {
    const rows = rowsF;
    const present = rows.filter((r: any) => r.status === "present").length;
    const late = rows.filter((r: any) => r.status === "late").length;
    const absent = rows.filter((r: any) => r.status === "absent").length;
    return { total: rows.length, present, late, absent };
  }, [rowsF]);

  return (
    <div className="space-y-5">
      <header className="text-center space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("attendance")}</h1>
        <p className="text-xs text-muted-foreground">{t("attendanceSubtitle")}</p>
      </header>

      <section className="grid grid-cols-4 gap-2">
        <Stat label={t("present")} value={stats.present} tone="text-success" />
        <Stat label={t("late")} value={stats.late} tone="text-warning-foreground" />
        <Stat label={t("absent")} value={stats.absent} tone="text-destructive" />
        <Stat label={t("total")} value={stats.total} tone="text-foreground" />
      </section>

      <section className="space-y-2">
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-muted p-1 text-xs font-semibold">
          {([["7", "7 days"], ["30", "30 days"], ["month", "Month"], ["all", "All"], ["custom", "Custom"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPreset(k)} className={`rounded-lg py-2 ${preset === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted-foreground">From<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-[11px] text-muted-foreground">To<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{rowsF.length} day{rowsF.length === 1 ? "" : "s"} shown{preset === "custom" && from ? ` · from ${formatDate(from)}` : ""}{preset === "custom" && to ? ` to ${formatDate(to)}` : ""}</p>
      </section>

      {(attQ.error || lvQ.error) && (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          {(attQ.error as Error)?.message ?? (lvQ.error as Error)?.message}
        </p>
      )}

      <section className="space-y-2">
        {attQ.isLoading && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{t("loading")}</div>
        )}
        {!attQ.isLoading && rowsF.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{t("noAttendanceRecordsYet")}</div>
        )}
        {rowsF.map((a: any) => {
          const overlapping = approvedLeaves.filter((l: any) => dateInRange(a.date, l.start_date, l.end_date));
          const hasGeo = a.lat != null && a.lng != null;
          const hours = hoursBetween(a.in_time, a.out_time);
          return (
            <article key={a.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{formatDate(a.date)}</p>
                  <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {hours ?? "—"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusStyle[a.status] ?? "bg-muted text-muted-foreground"}`}>
                  {a.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check in</p>
                  <p className="font-display text-lg font-semibold tabular-nums">{fmtTime(a.in_time)}</p>
                </div>
                <div className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check out</p>
                  <p className="font-display text-lg font-semibold tabular-nums">{fmtTime(a.out_time)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge
                  ok={hasGeo}
                  icon={<MapPin className="h-3 w-3" />}
                  okText={`${t("locationBadge")} · ${a.branch ?? "—"}`}
                  failText={t("locationMissing")}
                />
                <Badge
                  ok={a.network_ok === true}
                  icon={a.network_ok === true ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  okText={t("networkOk")}
                  failText={t("networkFailed")}
                />
                {hasGeo && (
                  <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                    {Number(a.lat).toFixed(4)}, {Number(a.lng).toFixed(4)}
                  </span>
                )}
              </div>

              {a.note && (
                <p className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] italic text-muted-foreground">"{a.note}"</p>
              )}

              {overlapping.length > 0 && (
                <div className="rounded-lg border border-info/30 bg-info/10 px-2.5 py-1.5 text-[11px] text-info">
                  <p className="inline-flex items-center gap-1 font-semibold">
                    <CalendarDays className="h-3 w-3" /> {t("leaveOverlap")}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {overlapping.map((l: any) => (
                      <li key={l.id}>
                        {l.leave_type_name ?? "Leave"} · {formatDate(l.start_date)} → {formatDate(l.end_date)} ({l.status})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <ValidationHistoryPanel />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className={`font-display text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Badge({ ok, icon, okText, failText }: { ok: boolean; icon: React.ReactNode; okText: string; failText: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
      {icon} {ok ? okText : failText}
    </span>
  );
}