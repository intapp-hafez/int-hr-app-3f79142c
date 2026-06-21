import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Users, UserCheck, UserX, Clock, CalendarDays, TrendingUp, MapPin, Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { useStore, markNotificationRead, markAllNotificationsRead } from "@/lib/store";
import { getAdminStats, getAdminDashboard } from "@/backend/functions/dashboard.functions";
import { decideLeave } from "@/backend/functions/leaves.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const notifications = useStore((s) => s.notifications).filter((n) => n.audience === "hr");
  const unread = notifications.filter((n) => !n.read).length;
  const fn = useServerFn(getAdminStats);
  const dashFn = useServerFn(getAdminDashboard);
  const decideFn = useServerFn(decideLeave);
  const { data: s } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn(), refetchInterval: 30_000 });
  const { data: dash } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => dashFn(), refetchInterval: 30_000 });
  const stats = s ?? { totalEmployees: 0, present: 0, late: 0, absent: 0, onLeave: 0, attendanceRate: 0 };
  const activity = dash?.activity ?? [];
  const pendingLeaves = dash?.pendingLeaves ?? [];
  const upcomingHolidays = dash?.upcomingHolidays ?? [];

  const decideMut = useMutation({
    mutationFn: (vars: { id: string; status: "approved" | "rejected"; name: string }) =>
      decideFn({ data: { id: vars.id, status: vars.status } }),
    onSuccess: (_d, vars) => {
      (vars.status === "approved" ? toast.success : toast.error)(
        `${vars.status === "approved" ? "Approved" : "Rejected"} ${vars.name}'s leave`,
      );
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "leaves"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("todayOverview")}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Good morning, HR Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <span className="me-2 inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Live • synced with 3 branches
        </div>
      </header>

      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users} label={t("totalEmployees")} value={String(stats.totalEmployees)} />
        <Kpi icon={UserCheck} label={t("present")} value={String(stats.present)} tone="success" />
        <Kpi icon={Clock} label={t("late")} value={String(stats.late)} tone="warning" />
        <Kpi icon={UserX} label={t("absent")} value={String(stats.absent)} tone="danger" />
        <Kpi icon={CalendarDays} label={t("onLeave")} value={String(stats.onLeave)} tone="info" />
        <Kpi icon={TrendingUp} label={t("attendanceRate")} value={`${stats.attendanceRate}%`} tone="brand" />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Live activity */}
        <section className="rounded-3xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">{t("liveActivity")}</h2>
            <Link to="/admin/attendance" className="text-xs text-brand">{t("viewAll")}</Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No check-ins yet today.</p>
          ) : (
          <ul className="space-y-1">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/60">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-brand text-[10px] font-semibold text-brand-foreground">
                    {a.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{a.action}{a.branch ? <> • <MapPin className="me-0.5 inline h-3 w-3" />{a.branch}</> : null}</p>
                  </div>
                </div>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">{a.time}</span>
              </li>
            ))}
          </ul>
          )}

          {/* Attendance breakdown bar */}
          <div className="mt-5 rounded-2xl bg-muted/60 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium">Today's distribution</span>
              <span className="text-muted-foreground">{stats.totalEmployees} total</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-background">
              <span className="bg-success" style={{ width: `${pct(stats.present, stats.totalEmployees)}%` }} />
              <span className="bg-warning" style={{ width: `${pct(stats.late, stats.totalEmployees)}%` }} />
              <span className="bg-info" style={{ width: `${pct(stats.onLeave, stats.totalEmployees)}%` }} />
              <span className="bg-destructive" style={{ width: `${pct(stats.absent, stats.totalEmployees)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <Legend color="bg-success" label={`${stats.present} ${t("present")}`} />
              <Legend color="bg-warning" label={`${stats.late} ${t("late")}`} />
              <Legend color="bg-info" label={`${stats.onLeave} ${t("onLeave")}`} />
              <Legend color="bg-destructive" label={`${stats.absent} ${t("absent")}`} />
            </div>
          </div>
        </section>

        {/* Pending leaves */}
        <section className="space-y-5">
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-base font-semibold">{t("pendingLeaves")}</h2>
            {pendingLeaves.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No pending requests.</p>
            ) : (
            <ul className="space-y-3">
              {pendingLeaves.map((l) => (
                <li key={l.id} className="rounded-2xl bg-muted/60 p-3">
                  <p className="text-sm font-semibold">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground">{l.type} • {l.start} → {l.end}</p>
                  <div className="mt-2 flex gap-2">
                    <button disabled={decideMut.isPending} onClick={() => decideMut.mutate({ id: l.id, status: "approved", name: l.name })} className="flex-1 rounded-lg bg-success px-2 py-1.5 text-[11px] font-semibold text-success-foreground disabled:opacity-50">{t("approve")}</button>
                    <button disabled={decideMut.isPending} onClick={() => decideMut.mutate({ id: l.id, status: "rejected", name: l.name })} className="flex-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] font-semibold text-destructive disabled:opacity-50">{t("reject")}</button>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-base font-semibold">{t("upcomingHolidays")}</h2>
            {upcomingHolidays.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No upcoming holidays.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingHolidays.map((h) => (
                  <li key={h.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{h.name}</p>
                      <p className="text-[11px] capitalize text-muted-foreground">{h.type}</p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">{h.date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Bell className="h-4 w-4 text-brand" /> {t("recentNotifications")}
            {unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">{unread}</span>}
          </h2>
          {unread > 0 && (
            <button onClick={() => markAllNotificationsRead((n) => n.audience === "hr")} className="inline-flex items-center gap-1 text-xs font-medium text-brand">
              <CheckCheck className="h-3 w-3" /> {t("markAllRead")}
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noNotifications")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.slice(0, 10).map((n) => (
              <li key={n.id} onClick={() => markNotificationRead(n.id)} className={`cursor-pointer py-2.5 ${n.read ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(n.ts).toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "default" }: { icon: typeof Users; label: string; value: string; tone?: "default" | "success" | "warning" | "danger" | "info" | "brand" }) {
  const tones: Record<string, string> = {
    default: "bg-card text-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
    brand: "bg-gradient-brand text-brand-foreground shadow-brand",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${color}`} /> {label}</span>;
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}
