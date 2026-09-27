import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Home, Clock, Bell, ListChecks, LogIn, MoreHorizontal, MessageSquare } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { useSession, useAuthReady } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDeliveries } from "@/backend/functions/notifications.functions";
import { getChatUnreadTotal } from "@/backend/functions/chat.functions";

export const Route = createFileRoute("/employee")({
  component: EmployeeLayout,
});

function EmployeeLayout() {
  const { t, dir, lang } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const ready = useAuthReady();

  const listFn = useServerFn(listMyDeliveries);
  const { data: deliveries = [] } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => listFn(),
    enabled: !!session,
  });
  const unreadCount = deliveries.length;

  const unreadChatFn = useServerFn(getChatUnreadTotal);
  const { data: chatUnreadData } = useQuery({
    queryKey: ["my-chat-unread"],
    queryFn: () => unreadChatFn(),
    refetchInterval: 10000,
    enabled: !!session,
  });
  const chatUnreadCount = chatUnreadData?.total ?? 0;

  if (typeof window === "undefined") return null;
  if (!ready) return null;
  if (!session) return <Navigate to="/auth" replace />;
  // Staff users belong on /staff, not /employee
  if (session.roles?.includes("staff")) return <Navigate to="/staff" replace />;

  const items = [
    { to: "/employee", icon: Home, label: t("dashboard") },
    { to: "/employee/attendance", icon: Clock, label: t("attendance") },
    { to: "/employee/check", icon: LogIn, label: lang === "ar" ? "حضور" : "Check" },
    { to: "/employee/tasks", icon: ListChecks, label: t("tasks") },
    { to: "/employee/settings", icon: MoreHorizontal, label: t("more") },
  ] as const;
  const currentPage = path === "/employee/check" ? t("checkInOut") :
    items.find((item) => item.to === path)?.label ??
    (path.startsWith("/employee/chat") ? lang === "ar" ? "الرسائل" : "Messages" : path.startsWith("/employee/notifications") ? t("notifications") : t("more"));

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      {/* Mobile-first frame, centered on larger screens */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-soft">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-md">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Link to="/employee" aria-label={t("dashboard")} className="flex min-w-0 w-fit items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <AppLogo size={23} withWordmark={false} />
              <span className="truncate font-display text-base font-bold text-foreground">INT<span className="text-brand">·</span>HR</span>
            </Link>
            <div className="shrink-0"><UserMenu size="sm" /></div>
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <h2 className="min-w-0 truncate font-display text-lg font-semibold text-foreground">{currentPage}</h2>
            <div className="flex shrink-0 items-center gap-1.5">
              <LanguageToggle compact />
              <Link
                to="/employee/chat"
                aria-label="Messages & Chat"
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MessageSquare className="h-5 w-5" />
                {chatUnreadCount > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                    {chatUnreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/employee/notifications"
                aria-label={t("notifications")}
                className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5">
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav aria-label="Employee navigation" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-md">
          <ul className="grid grid-cols-5 gap-0.5">
            {items.map((it) => {
              const active = path === it.to;
              return (
                <li key={it.to} className="min-w-0">
                  <Link
                    to={it.to}
                    aria-current={active ? "page" : undefined}
                    className={`mx-auto flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <it.icon className={`h-5 w-5 shrink-0 ${active ? "stroke-[2.5]" : ""}`} />
                    <span className="w-full truncate text-center">{it.label}</span>
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
