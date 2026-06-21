import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ListChecks, Route as RouteIcon, CheckCircle2, Bell, CheckCheck, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useStore, markNotificationRead, markAllNotificationsRead } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getManagerEmployee, getTeam } from "@/lib/manager";
import { getManagerStats } from "@/backend/functions/dashboard.functions";

export const Route = createFileRoute("/manager/")({
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const { t } = useI18n();
  const session = useSession();
  const employees = useStore((s) => s.employees);
  const me = getManagerEmployee(session);
  const team = getTeam(employees, me);
  const fn = useServerFn(getManagerStats);
  const { data } = useQuery({ queryKey: ["manager-stats"], queryFn: () => fn(), refetchInterval: 30_000 });
  const stats = data ?? { tasksOpen: 0, tasksDone: 0, trips: 0, pendingLeaves: 0 };

  const notifications = useStore((s) => s.notifications).filter(
    (n) => n.audience === "manager" && n.audienceId === me?.id,
  );
  const unread = notifications.filter((n) => !n.read).length;

  const cards = [
    { to: "/manager/team", icon: Users, label: t("myTeam"), value: team.length },
    { to: "/manager/tasks", icon: ListChecks, label: t("tasks"), value: stats.tasksOpen },
    { to: "/manager/trips", icon: RouteIcon, label: t("trips"), value: stats.trips },
    { to: "/manager/tasks", icon: CheckCircle2, label: t("statusDone"), value: stats.tasksDone },
    { to: "/admin/leaves-requests", icon: CalendarDays, label: "Pending Leaves", value: stats.pendingLeaves },
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">{t("managerPanel")}</p>
        <h1 className="font-display text-2xl font-semibold">{session?.name ?? ""}</h1>
        {me && <p className="text-sm text-muted-foreground">{me.role} • {me.dept}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label + c.to}
            to={c.to}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5"
          >
            <c.icon className="h-5 w-5 text-brand" />
            <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold">{t("myTeam")}</h2>
          <Link to="/manager/team" className="text-xs font-medium text-brand">→</Link>
        </div>
        {team.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noTeamMembers")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {team.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{e.role} • {e.dept}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {e.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Bell className="h-4 w-4 text-brand" /> {t("recentNotifications")}
            {unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">{unread}</span>}
          </h2>
          {unread > 0 && (
            <button
              onClick={() => markAllNotificationsRead((n) => n.audience === "manager" && n.audienceId === me?.id)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand"
            >
              <CheckCheck className="h-3 w-3" /> {t("markAllRead")}
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noNotifications")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.slice(0, 8).map((n) => (
              <li key={n.id} onClick={() => markNotificationRead(n.id)} className={`cursor-pointer py-2.5 ${n.read ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(n.ts).toLocaleTimeString()}</span>
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