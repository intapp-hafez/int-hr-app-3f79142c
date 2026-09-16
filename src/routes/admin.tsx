import { createFileRoute, Outlet, Link, useRouterState, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { LayoutDashboard, Users, MapPin, Clock, CalendarDays, FileBarChart2, ScrollText, Menu, X, Bell, Search, Wallet, Settings, FileSignature, Shield, Building2, KeyRound, Calculator, UserCog, Network, StickyNote, Banknote, Plane, BarChart3, MessageSquare , Smartphone, Printer, ShieldAlert, ArrowLeft } from "lucide-react";
import { NotificationsBell } from "@/components/admin/NotificationsBell";
import { AppLogo } from "@/components/AppLogo";
import { UserMenu } from "@/components/UserMenu";
import { InstallButton } from "@/components/InstallButton";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { useSession, useAuthReady } from "@/lib/auth";
import { useExportScheduler } from "@/lib/export-scheduler";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getChatUnreadTotal } from "@/backend/functions/chat.functions";
import { usePermissions } from "@/lib/permissions";
import { GlobalSearch } from "@/components/admin/GlobalSearch";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const session = useSession();
  const ready = useAuthReady();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExportScheduler();
  const { can, isAdmin, loading: permsLoading } = usePermissions();

  // Hooks must run unconditionally before any early return below.
  const unreadFn = useServerFn(getChatUnreadTotal);
  const { data: unreadData } = useQuery({
    queryKey: ["chat-unread-total"],
    queryFn: () => unreadFn(),
    refetchInterval: 10000,
    enabled: !!session,
  });
  const unreadMessagesCount = unreadData?.total ?? 0;

  if (typeof window === "undefined") return null;
  if (!ready) return null;
  if (!session) return <Navigate to="/auth" replace />;
  const hasAdminAccess = session.roles?.some((r) => ["admin", "hr", "manager", "user", "finance"].includes(r));
  if (!hasAdminAccess) {
    const target = session.roles?.includes("staff") ? "/staff" : "/employee";
    return <Navigate to={target} replace />;
  }
  const isPureManager = session.roles?.includes("manager") && !session.roles?.some((r) => ["admin", "hr"].includes(r));
  if (isPureManager) {
    if (path.startsWith("/admin/chat")) {
      return <Navigate to="/manager/chat" replace />;
    }
    return <Navigate to="/manager" replace />;
  }

  const navAll = [
    { to: "/admin", icon: LayoutDashboard, label: t("dashboard"), exact: true, page: null },
    { to: "/admin/chat", icon: MessageSquare, label: "Messages & Chat", page: null },
    { to: "/admin/employees", icon: Users, label: t("employees"), page: "employees" },
    { to: "/admin/contracts", icon: FileSignature, label: t("contracts"), page: "contracts" },
    { to: "/admin/geofencing", icon: MapPin, label: t("geofencing"), page: "geofencing" },
    { to: "/admin/attendance", icon: Clock, label: t("attendance"), page: "attendance" },
    { to: "/admin/leaves", icon: CalendarDays, label: t("leaves"), page: "leaves" },
    { to: "/admin/payroll", icon: Wallet, label: t("payroll"), page: "payroll" },
    { to: "/admin/advances", icon: Banknote, label: t("advancesTitle"), page: "advances" },
    { to: "/admin/reports", icon: FileBarChart2, label: t("reports"), page: "reports" },
    { to: "/admin/audit", icon: ScrollText, label: t("audit"), page: "audit" },
    { to: "/admin/directory", icon: Building2, label: t("directory"), page: "directory" },
    { to: "/admin/org-chart", icon: Network, label: t("orgChart"), page: "employees" },
    { to: "/admin/settings", icon: Settings, label: t("settings") || "Settings", page: "settings" },
  ] as const;
  const nav = isAdmin || permsLoading
    ? navAll
    : navAll.filter((n) => n.page === null || can(n.page, "view"));

  const currentRequiredPage = getPageSlugForPath(path);
  const isPageAllowed = isAdmin || permsLoading || !currentRequiredPage || can(currentRequiredPage, "view");

  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path.startsWith(to));

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 py-5">
          <Link to="/"><AppLogo size={26} tone="light" /></Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((n) => {
            const active = isActive(n.to, "exact" in n ? n.exact : false);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-brand"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                <span>{n.label}</span>
                {n.to === "/admin/chat" && unreadMessagesCount > 0 && (
                  <span className="ms-auto grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground shadow-sm">
                    {unreadMessagesCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-2xl bg-sidebar-accent p-4">
          <div className="flex items-center gap-3">
            <UserMenu size="lg" align="start" />
            <p className="font-display text-sm font-semibold">{session.name}</p>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-sidebar p-4 text-sidebar-foreground">
            <div className="mb-4 flex items-center justify-between">
              <AppLogo size={24} tone="light" />
              <button onClick={() => setOpen(false)} className="rounded-full p-1 text-sidebar-foreground/80"><X className="h-5 w-5" /></button>
            </div>
            <nav className="space-y-0.5">
              {nav.map((n) => {
                const active = isActive(n.to, "exact" in n ? n.exact : false);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80"}`}
                  >
                    <n.icon className="h-4 w-4" /> {n.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-muted lg:hidden"><Menu className="h-5 w-5" /></button>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/chat"
              className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Messages & Chat"
            >
              <MessageSquare className="h-5 w-5" />
              {unreadMessagesCount > 0 && (
                <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground shadow-sm">
                  {unreadMessagesCount}
                </span>
              )}
            </Link>
            <Link to="/admin/sticky-notes" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title={t("stickyNotes")}>
              <StickyNote className="h-5 w-5" />
            </Link>
            <InstallButton variant="outline" className="hidden sm:inline-flex" />
            <LanguageToggle />
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {!isPageAllowed ? (
            <AccessRestrictedView pageSlug={currentRequiredPage!} path={path} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

function getPageSlugForPath(path: string): string | null {
  if (path === "/admin" || path === "/admin/") return null;
  if (path.startsWith("/admin/chat") || path.startsWith("/admin/sticky-notes")) return null;
  if (path.startsWith("/admin/employees") || path.startsWith("/admin/org-chart") || path.startsWith("/admin/activity-timeline") || path.startsWith("/admin/manpower") || path.startsWith("/admin/reassign-managers")) return "employees";
  if (path.startsWith("/admin/contracts")) return "contracts";
  if (path.startsWith("/admin/attendance")) return "attendance";
  if (path.startsWith("/admin/leaves-requests")) return "leaves-requests";
  if (path.startsWith("/admin/leaves")) return "leaves";
  if (path.startsWith("/admin/payroll")) return "payroll";
  if (path.startsWith("/admin/advances")) return "advances";
  if (path.startsWith("/admin/geofencing") || path.startsWith("/admin/work-locations")) return "geofencing";
  if (path.startsWith("/admin/networks") || path.startsWith("/admin/devices")) return "networks";
  if (path.startsWith("/admin/shifts")) return "shifts";
  if (path.startsWith("/admin/holiday-types")) return "holiday-types";
  if (path.startsWith("/admin/holidays")) return "holidays";
  if (path.startsWith("/admin/kpis")) return "kpis";
  if (path.startsWith("/admin/allowances")) return "allowances";
  if (path.startsWith("/admin/late-penalties")) return "late-penalties";
  if (path.startsWith("/admin/targets-overtime")) return "targets-overtime";
  if (path.startsWith("/admin/directory")) return "directory";
  if (path.startsWith("/admin/employee-access")) return "employee-access";
  if (path.startsWith("/admin/audit")) return "audit";
  if (path.startsWith("/admin/reports")) return "reports";
  if (path.startsWith("/admin/settings/roles")) return "roles";
  if (path.startsWith("/admin/settings")) return "settings";
  return null;
}

function AccessRestrictedView({ pageSlug, path }: { pageSlug: string; path: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-destructive/20 bg-card p-8 text-center shadow-lg space-y-5">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            {t("accessRestrictedTitle") || "Page Access Restricted"}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("accessRestrictedDesc") || "You do not have permission from your administrator to view this page. This page has not been added to your allowed pages."}
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 py-1 text-[11px] font-mono text-muted-foreground">
            <span>Route:</span> <strong className="text-foreground">{path}</strong>
          </div>
        </div>
        <div className="pt-2">
          <Link
            to="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand text-brand-foreground px-5 py-2.5 text-sm font-semibold shadow-brand hover:opacity-95 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToDashboard") || "Back to Dashboard"}
          </Link>
        </div>
      </div>
    </div>
  );
}
