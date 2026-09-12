import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Home, Clock, CalendarDays, User, Bell, MessageSquare } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { useSession, useAuthReady } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDeliveries } from "@/backend/functions/notifications.functions";
import { getChatUnreadTotal } from "@/backend/functions/chat.functions";

export const Route = createFileRoute("/staff")({
  component: StaffLayout,
});

function StaffLayout() {
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
  const allowed = ["staff", "admin", "hr"];
  if (!session.roles.some((r) => allowed.includes(r))) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="text-sm text-muted-foreground">
            The staff panel is available to users with the <strong>staff</strong> role.
          </p>
          <Link to="/" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const items = [
    { to: "/staff", icon: Home, label: t("dashboard") },
    { to: "/staff/attendance", icon: Clock, label: t("attendance") },
    { to: "/staff/leaves", icon: CalendarDays, label: t("leaves") },
    { to: "/staff/profile", icon: User, label: "Profile" },
  ] as const;

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-soft">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
          <Link to="/"><AppLogo size={24} /></Link>
          <div className="flex items-center gap-2">
            <Link
              to="/staff/chat"
              aria-label="Messages & Chat"
              className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
            >
              <MessageSquare className="h-4 w-4" />
              {chatUnreadCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground shadow-sm">
                  {chatUnreadCount}
                </span>
              )}
            </Link>
            <Link
              to="/staff/notifications"
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