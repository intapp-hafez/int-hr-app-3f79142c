import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Home, Clock, Bell, ListChecks, LogIn, MoreHorizontal } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { useSession, useAuthReady } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDeliveries } from "@/backend/functions/notifications.functions";

export const Route = createFileRoute("/employee")({
  component: EmployeeLayout,
});

function EmployeeLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const ready = useAuthReady();

  if (typeof window === "undefined") return null;
  if (!ready) return null;
  if (!session) return <Navigate to="/auth" replace />;
  // Staff users belong on /staff, not /employee
  if (session.roles?.includes("staff")) return <Navigate to="/staff" replace />;

  const items = [
    { to: "/employee", icon: Home, label: t("dashboard") },
    { to: "/employee/attendance", icon: Clock, label: t("attendance") },
    { to: "/employee/check", icon: LogIn, label: "Check" },
    { to: "/employee/tasks", icon: ListChecks, label: t("tasks") },
    { to: "/employee/settings", icon: MoreHorizontal, label: "More" },
  ] as const;

  const listFn = useServerFn(listMyDeliveries);
  const { data: deliveries = [] } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => listFn(),
    enabled: !!session,
  });
  const unreadCount = deliveries.length;

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      {/* Mobile-first frame, centered on larger screens */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-soft">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
          <Link to="/"><AppLogo size={24} /></Link>
          <div className="flex items-center gap-2">
            <Link
              to="/employee/notifications"
              aria-label={t("notifications")}
              className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                  {unreadCount}
                </span>
              )}
            </Link>
            <LanguageToggle />
            <UserMenu size="sm" />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur">
          <ul className="flex items-center justify-between">
            {items.map((it) => {
              const active = path === it.to;
              return (
                <li key={it.to} className="flex-1">
                  <Link
                    to={it.to}
                    className={`mx-auto flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors ${
                      active ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <it.icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                    <span>{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
