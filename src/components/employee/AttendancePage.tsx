import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { MapPin, Wifi, WifiOff, CalendarDays, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { listMyAttendance } from "@/backend/functions/attendance.functions";
import { listMyLeaves } from "@/backend/functions/leaves.functions";

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

  const stats = useMemo(() => {
    const rows = attQ.data ?? [];
    const present = rows.filter((r: any) => r.status === "present").length;
    const late = rows.filter((r: any) => r.status === "late").length;
    const absent = rows.filter((r: any) => r.status === "absent").length;
    return { total: rows.length, present, late, absent };
  }, [attQ.data]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("attendance")}</h1>
        <p className="text-xs text-muted-foreground">My attendance history with check-in/out, location & network checks, and leave overlaps.</p>
      </header>

      <section className="grid grid-cols-4 gap-2">
        <Stat label={t("present")} value={stats.present} tone="text-success" />
        <Stat label={t("late")} value={stats.late} tone="text-warning-foreground" />
        <Stat label={t("absent")} value={stats.absent} tone="text-destructive" />
        <Stat label="Total" value={stats.total} tone="text-foreground" />
      </section>

      {(attQ.error || lvQ.error) && (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          {(attQ.error as Error)?.message ?? (lvQ.error as Error)?.message}
        </p>
      )}

      <section className="space-y-2">
        {attQ.isLoading && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Loading…</div>
        )}
        {!attQ.isLoading && (attQ.data ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No attendance records yet</div>
        )}
        {(attQ.data ?? []).map((a: any) => {
          const overlapping = approvedLeaves.filter((l: any) => dateInRange(a.date, l.start_date, l.end_date));
          const hasGeo = a.lat != null && a.lng != null;
          const hours = hoursBetween(a.in_time, a.out_time);
          return (
            <article key={a.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{a.date}</p>
                  <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {fmtTime(a.in_time)} → {fmtTime(a.out_time)}
                    {hours && <span className="ml-1 font-mono tabular-nums">· {hours}</span>}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusStyle[a.status] ?? "bg-muted text-muted-foreground"}`}>
                  {a.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge
                  ok={hasGeo}
                  icon={<MapPin className="h-3 w-3" />}
                  okText={`Location · ${a.branch ?? "—"}`}
                  failText="Location missing"
                />
                <Badge
                  ok={a.network_ok === true}
                  icon={a.network_ok === true ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  okText="Network OK"
                  failText="Network failed"
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
                    <CalendarDays className="h-3 w-3" /> Leave overlap
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {overlapping.map((l: any) => (
                      <li key={l.id}>
                        {l.leave_type_name ?? "Leave"} · {l.start_date} → {l.end_date} ({l.status})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </section>
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