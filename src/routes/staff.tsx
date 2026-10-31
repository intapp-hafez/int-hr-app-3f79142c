import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Home, ClipboardCheck, FileText, User, Bell, MessageSquare } from "lucide-react";
import logo from "@/assets/int-logo.png";
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
  const unreadCount = (deliveries as any[]).filter((n) => !(n.payload as any)?.read_at).length;

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
    {
      to: "/staff",
      icon: Home,
      label: t("dashboard"),
      isActive: (p: string) => p === "/staff",
    },
    {
      to: "/staff/tasks",
      icon: ClipboardCheck,
      label: t("tasks"),
      isActive: (p: string) => p.startsWith("/staff/tasks"),
    },
    {
      to: "/staff/attendance",
      isCenter: true,
      label: t("attendance"),
      isActive: (p: string) => p.startsWith("/staff/attendance"),
    },
    {
      to: "/staff/leaves",
      icon: FileText,
      label: t("leaveRequests") || "الطلبات",
      isActive: (p: string) => p.startsWith("/staff/leaves"),
    },
    {
      to: "/staff/profile",
      icon: User,
      label: t("profile") || "الملف الشخصي",
      isActive: (p: string) => p.startsWith("/staff/profile"),
    },
  ];

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background shadow-soft">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
          <Link to="/" className="shrink-0"><AppLogo size={24} withWordmark={false} /></Link>
          <LanguageToggle compact />
          <div className="flex items-center gap-2 shrink-0">
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
            <UserMenu size="sm" />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">
          <Outlet />
        </main>

        {/* Mobile Bottom Navbar (Aligned with mobile app style) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border/60 bg-card/95 dark:bg-[#181a1f]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl shadow-2xl">
          <ul className="flex items-end justify-between">
            {items.map((it) => {
              const active = it.isActive(path);
              const Icon = it.icon;

              if (it.isCenter) {
                return (
                  <li key={it.to} className="flex-1">
                    <Link
                      to={it.to}
                      className="group relative -mt-6 flex flex-col items-center justify-center transition-all active:scale-95"
                    >
                      {/* Raised circular emblem with company logo */}
                      <div
                        className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-white p-2.5 shadow-xl ring-4 transition-all duration-200 ${
                          active
                            ? "ring-brand shadow-brand/30 shadow-lg"
                            : "ring-card dark:ring-[#181a1f] shadow-black/30 group-hover:ring-brand/40"
                        }`}
                      >
                        <img
                          src={logo}
                          alt="INT-HR"
                          className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>
                      <span
                        className={`mt-1 text-[11px] font-medium tracking-tight transition-colors ${
                          active ? "font-bold text-brand" : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        {it.label}
                      </span>
                      {active ? (
                        <span className="mt-0.5 h-0.5 w-7 rounded-full bg-brand" />
                      ) : (
                        <span className="mt-0.5 h-0.5 w-7 bg-transparent" />
                      )}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={it.to} className="flex-1">
                  <Link
                    to={it.to}
                    className="group flex flex-col items-center justify-center py-1 transition-all active:scale-95"
                  >
                    <div className="relative flex items-center justify-center">
                      {Icon && (
                        <Icon
                          className={`h-[22px] w-[22px] transition-all duration-200 ${
                            active
                              ? "stroke-[2.2] text-brand"
                              : "stroke-[1.75] text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`mt-1 text-[11px] font-medium tracking-tight transition-colors ${
                        active ? "font-bold text-brand" : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      {it.label}
                    </span>
                    {active ? (
                      <span className="mt-0.5 h-0.5 w-7 rounded-full bg-brand" />
                    ) : (
                      <span className="mt-0.5 h-0.5 w-7 bg-transparent" />
                    )}
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