import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Home, Clock, Bell, ListChecks, LogIn, MoreHorizontal, Banknote, MessageSquare } from "lucide-react";
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
  const { t, dir } = useI18n();
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
    { to: "/employee/check", icon: LogIn, label: t("checkInOut") },
    { to: "/employee/tasks", icon: ListChecks, label: t("tasks") },
    { to: "/employee/settings", icon: MoreHorizontal, label: t("more") },
  ] as const;

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      {/* Mobile-first frame, centered on larger screens */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-soft">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-xl shadow-sm">
          <Link to="/" className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80">
            <AppLogo size={24} withWordmark={false} />
            <span className="font-display text-[17px] font-bold tracking-tight text-foreground">INT<span className="text-brand">·</span>HR</span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="scale-90 sm:scale-100 origin-right">
              <LanguageToggle compact />
            </div>
            
            <div className="flex items-center gap-1 border-l border-border/60 pl-2 sm:pl-3">
              <Link
                to="/employee/chat"
                aria-label="Messages & Chat"
                className="relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-95"
              >
                <MessageSquare className="h-[22px] w-[22px]" strokeWidth={2.2} />
                {chatUnreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                    {chatUnreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/employee/notifications"
                aria-label={t("notifications")}
                className="relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-95"
              >
                <Bell className="h-[22px] w-[22px]" strokeWidth={2.2} />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </div>

            <div className="pl-1">
              <UserMenu size="sm" />
            </div>
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
