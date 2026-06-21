import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Users, UserCheck, UserX, Clock, CalendarDays, TrendingUp, MapPin, Bell, CheckCheck,
  LogOut as LogOutIcon, ListChecks, CheckCircle2, FileText, Wallet, Shield, BarChart3, Settings,
  Building2, ArrowRight, Plus, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { useStore, markNotificationRead, markAllNotificationsRead } from "@/lib/store";
import { getAdminStats, getAdminDashboard } from "@/backend/functions/dashboard.functions";
import { decideLeave } from "@/backend/functions/leaves.functions";
import { NotificationsCenter } from "@/components/admin/NotificationsCenter";
import { AttendanceTrendChart } from "@/components/admin/AttendanceTrendChart";

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
  const stats = s ?? {
    totalEmployees: 0, present: 0, late: 0, absent: 0, onLeave: 0, attendanceRate: 0,
    checkedOut: 0, pendingLeaves: 0, openTasks: 0, doneTasks: 0,
  } as any;
  const activity = dash?.activity ?? [];
  const pendingLeaves = dash?.pendingLeaves ?? [];
  const upcomingHolidays = dash?.upcomingHolidays ?? [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const totalTasks = (stats.openTasks ?? 0) + (stats.doneTasks ?? 0);
  const taskCompletion = totalTasks > 0 ? Math.round(((stats.doneTasks ?? 0) / totalTasks) * 100) : 0;

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
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand via-brand/90 to-info p-6 text-brand-foreground shadow-brand">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider opacity-90">
              <Sparkles className="h-3.5 w-3.5" /> {t("todayOverview")}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting}, HR Team
            </h1>
            <p className="mt-1 text-sm opacity-90">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live sync
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5" /> {stats.attendanceRate}% attendance
            </span>
          </div>
        </div>
      </header>

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <QuickAction to="/admin/employees" icon={Plus} label="Add Employee" />
        <QuickAction to="/admin/attendance" icon={Clock} label="Attendance" />
        <QuickAction to="/admin/leaves-requests" icon={CalendarDays} label="Leave Requests" badge={stats.pendingLeaves} />
        <QuickAction to="/admin/payroll" icon={Wallet} label="Run Payroll" />
        <QuickAction to="/admin/reports" icon={BarChart3} label="Reports" />
        <QuickAction to="/admin/settings" icon={Settings} label="Settings" />
      </section>

      {/* Colored KPI grid */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard icon={Users} label={t("totalEmployees")} value={String(stats.totalEmployees)} tone="indigo" hint="Across all branches" />
        <KpiCard icon={UserCheck} label={t("present")} value={String(stats.present)} tone="emerald" hint={`${pct(stats.present, stats.totalEmployees)}% of staff`} />
        <KpiCard icon={Clock} label={t("late")} value={String(stats.late)} tone="amber" hint="Arrived after threshold" />
        <KpiCard icon={UserX} label={t("absent")} value={String(stats.absent)} tone="rose" hint="No check-in today" />
        <KpiCard icon={CalendarDays} label={t("onLeave")} value={String(stats.onLeave)} tone="sky" hint="Approved leaves" />
        <KpiCard icon={LogOutIcon} label="Checked out" value={String(stats.checkedOut ?? 0)} tone="violet" hint="Completed shift" />
        <KpiCard icon={ListChecks} label="Open tasks" value={String(stats.openTasks ?? 0)} tone="orange" hint={`${stats.doneTasks ?? 0} completed`} />
        <KpiCard icon={TrendingUp} label={t("attendanceRate")} value={`${stats.attendanceRate}%`} tone="brand" hint="Today" />
      </section>

      {/* Attendance trend + Notifications */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttendanceTrendChart />
        </div>
        <NotificationsCenter />
      </div>

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
          {/* Tasks progress */}
          <div className="rounded-3xl border border-border bg-gradient-to-br from-orange-500/10 via-card to-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                <CheckCircle2 className="h-4 w-4 text-orange-500" /> Tasks progress
              </h2>
              <Link to="/admin/reports" className="text-xs text-brand">{t("viewAll")}</Link>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-3xl font-semibold tabular-nums">{taskCompletion}%</p>
                <p className="text-[11px] text-muted-foreground">{stats.doneTasks ?? 0} of {totalTasks} done</p>
              </div>
              <div className="text-end text-[11px] text-muted-foreground">
                <p>{stats.openTasks ?? 0} open</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-gradient-to-r from-orange-400 to-rose-500" style={{ width: `${taskCompletion}%` }} />
            </div>
          </div>

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

      {/* Manage modules */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Manage</h2>
          <span className="text-[11px] text-muted-foreground">Jump into any module</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <ModuleTile to="/admin/employees" icon={Users} label="Employees" tone="indigo" />
          <ModuleTile to="/admin/attendance" icon={Clock} label="Attendance" tone="emerald" />
          <ModuleTile to="/admin/leaves" icon={CalendarDays} label="Leaves" tone="sky" />
          <ModuleTile to="/admin/payroll" icon={Wallet} label="Payroll" tone="violet" />
          <ModuleTile to="/admin/contracts" icon={FileText} label="Contracts" tone="amber" />
          <ModuleTile to="/admin/networks" icon={Building2} label="Branches" tone="orange" />
          <ModuleTile to="/admin/roles" icon={Shield} label="Roles" tone="rose" />
          <ModuleTile to="/admin/reports" icon={BarChart3} label="Reports" tone="brand" />
        </div>
      </section>

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

type Tone = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "orange" | "brand";
const TONE_BG: Record<Tone, string> = {
  indigo: "from-indigo-500/15 to-indigo-500/5 ring-indigo-500/20",
  emerald: "from-emerald-500/15 to-emerald-500/5 ring-emerald-500/20",
  amber: "from-amber-500/15 to-amber-500/5 ring-amber-500/20",
  rose: "from-rose-500/15 to-rose-500/5 ring-rose-500/20",
  sky: "from-sky-500/15 to-sky-500/5 ring-sky-500/20",
  violet: "from-violet-500/15 to-violet-500/5 ring-violet-500/20",
  orange: "from-orange-500/15 to-orange-500/5 ring-orange-500/20",
  brand: "from-brand/20 to-brand/5 ring-brand/30",
};
const TONE_ICON: Record<Tone, string> = {
  indigo: "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
  emerald: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
  amber: "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
  rose: "bg-rose-500 text-white shadow-lg shadow-rose-500/30",
  sky: "bg-sky-500 text-white shadow-lg shadow-sky-500/30",
  violet: "bg-violet-500 text-white shadow-lg shadow-violet-500/30",
  orange: "bg-orange-500 text-white shadow-lg shadow-orange-500/30",
  brand: "bg-gradient-brand text-brand-foreground shadow-brand",
};

function KpiCard({ icon: Icon, label, value, tone, hint }: { icon: typeof Users; label: string; value: string; tone: Tone; hint?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${TONE_BG[tone]} bg-card p-4 ring-1 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${TONE_ICON[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, badge }: { to: string; icon: typeof Users; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="group relative flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 text-xs font-medium shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && badge > 0 ? (
        <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">{badge}</span>
      ) : (
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}

function ModuleTile({ to, icon: Icon, label, tone }: { to: string; icon: typeof Users; label: string; tone: Tone }) {
  return (
    <Link
      to={to}
      className={`group flex flex-col gap-2 rounded-2xl border border-border bg-gradient-to-br ${TONE_BG[tone]} p-4 transition-all hover:-translate-y-0.5 hover:shadow-md`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${TONE_ICON[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        Open <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${color}`} /> {label}</span>;
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}
