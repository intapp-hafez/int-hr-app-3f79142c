import { createFileRoute, Outlet, Link, useRouterState, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { LayoutDashboard, Users, MapPin, Clock, CalendarDays, FileBarChart2, ScrollText, Menu, X, Bell, Search, Wallet, Settings, FileSignature, Shield, Building2, KeyRound, Calculator, UserCog, Network, StickyNote, Banknote, Plane, BarChart3, MessageSquare , Smartphone, Printer, ShieldAlert, ArrowLeft, Navigation, PanelLeftClose, PanelLeftOpen, ChevronDown, Sliders } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

type NavItem = {
  to: string;
  icon: any;
  label: string;
  exact?: boolean;
  page: string | null;
};

type NavGroup = {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
};

type NavEntry =
  | { type: "item"; item: NavItem }
  | { type: "group"; group: NavGroup };

function AdminLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_sidebar_collapsed") === "true";
    }
    return false;
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    employees: true,
    operations: true,
    payrolls: true,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("admin_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  const session = useSession();
  const ready = useAuthReady();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExportScheduler();
  const { can, isAdmin, perms, loading: permsLoading } = usePermissions();

  // Hooks must run unconditionally before any early return below.
  const unreadFn = useServerFn(getChatUnreadTotal);
  const { data: unreadData } = useQuery({
    queryKey: ["chat-unread-total"],
    queryFn: () => unreadFn(),
    refetchInterval: 10000,
    enabled: !!session,
  });
  const unreadMessagesCount = unreadData?.total ?? 0;

  const isItemActive = (to: string, exact?: boolean) => {
    if (to === "/admin/geofencing" && path.startsWith("/admin/work-locations")) return true;
    if (to === "/admin/geofencing" && (path.startsWith("/admin/networks") || path.startsWith("/admin/devices"))) return true;
    if (to === "/admin/attendance" && (path.startsWith("/admin/shifts") || path.startsWith("/admin/attendance-rules") || path.startsWith("/admin/attendance-report") || path.startsWith("/admin/targets-overtime") || path.startsWith("/admin/late-penalties"))) return true;
    if (to === "/admin/leaves" && (path.startsWith("/admin/leaves-requests") || path.startsWith("/admin/holidays") || path.startsWith("/admin/holiday-types"))) return true;
    if (to === "/admin/audit" && (path.startsWith("/admin/biometrics-health") || path.startsWith("/admin/face-notifications") || path.startsWith("/admin/biometric-terminals") || path.startsWith("/admin/notification-activity"))) return true;
    if (to === "/admin/payroll" && path.startsWith("/admin/payroll-settings")) return true;
    if (to === "/admin/settings" && path.startsWith("/admin/settings")) return true;
    if (to === "/admin/employees" && (path.startsWith("/admin/activity-timeline") || path.startsWith("/admin/manpower") || path.startsWith("/admin/reassign-managers"))) return true;
    return exact ? path === to : path.startsWith(to);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isItemActive(item.to, item.exact));
  };

  const navStructure = useMemo<NavEntry[]>(() => [
    {
      type: "item",
      item: { to: "/admin", icon: LayoutDashboard, label: t("dashboard"), exact: true, page: null },
    },
    {
      type: "item",
      item: { to: "/admin/chat", icon: MessageSquare, label: t("messagesAndChat"), page: null },
    },
    // 1- Employees: Employees, contracts
    {
      type: "group",
      group: {
        id: "employees",
        label: t("employees") || "Employees",
        icon: Users,
        items: [
          { to: "/admin/employees", icon: Users, label: t("employees") || "Employees", page: "employees" },
          { to: "/admin/contracts", icon: FileSignature, label: t("contracts") || "Contracts", page: "contracts" },
        ],
      },
    },
    // 2- Operations: Attendance, Geo fencing, leaves, audit logs
    {
      type: "group",
      group: {
        id: "operations",
        label: t("operations") || "Operations",
        icon: Sliders,
        items: [
          { to: "/admin/attendance", icon: Clock, label: t("attendance") || "Attendance", page: "attendance" },
          { to: "/admin/geofencing", icon: MapPin, label: t("geofencing") || "Geo-Fencing", page: "geofencing" },
          { to: "/admin/applied-trip-allowances", icon: Navigation, label: "Applied Trip Allowances", page: "attendance" },
          { to: "/admin/leaves", icon: CalendarDays, label: t("leaves") || "Leaves", page: "leaves" },
          { to: "/admin/audit", icon: ScrollText, label: t("auditLogs") || t("audit") || "Audit Logs", page: "audit" },
        ],
      },
    },
    // 3- Payrolls: payrolls, advances
    {
      type: "group",
      group: {
        id: "payrolls",
        label: t("payrolls") || t("payroll") || "Payrolls",
        icon: Wallet,
        items: [
          { to: "/admin/payroll", icon: Wallet, label: t("payroll") || "Payroll", page: "payroll" },
          { to: "/admin/advances", icon: Banknote, label: t("advances") || t("advancesTitle") || "Advances", page: "advances" },
        ],
      },
    },
    // 4- Reports
    {
      type: "item",
      item: { to: "/admin/reports", icon: FileBarChart2, label: t("reports") || "Reports", page: "reports" },
    },
    // 5- Directory
    {
      type: "item",
      item: { to: "/admin/directory", icon: Building2, label: t("directory") || "Directory", page: "directory" },
    },
    // 6- Settings
    {
      type: "item",
      item: { to: "/admin/settings", icon: Settings, label: t("settings") || "Settings", page: "settings" },
    },
    // 7- Org chart
    {
      type: "item",
      item: { to: "/admin/org-chart", icon: Network, label: t("orgChart") || "Org Chart", page: "employees" },
    },
  ], [t]);

  const filteredNav: NavEntry[] = useMemo(() => {
    return navStructure
      .map((entry): NavEntry | null => {
        if (entry.type === "item") {
          const allowed = isAdmin || permsLoading || entry.item.page === null || can(entry.item.page, "view");
          return allowed ? entry : null;
        }
        if (entry.type === "group") {
          const visibleItems = entry.group.items.filter(
            (sub) => isAdmin || permsLoading || sub.page === null || can(sub.page, "view"),
          );
          if (visibleItems.length === 0) return null;
          return {
            type: "group",
            group: {
              ...entry.group,
              items: visibleItems,
            },
          };
        }
        return null;
      })
      .filter((e): e is NavEntry => e !== null);
  }, [navStructure, isAdmin, permsLoading, perms]);

  useEffect(() => {
    const activeEntry = navStructure.find(
      (entry) => entry.type === "group" && entry.group.items.some((i) => isItemActive(i.to, i.exact)),
    );
    if (activeEntry && activeEntry.type === "group") {
      const gid = activeEntry.group.id;
      setOpenGroups((prev) => {
        if (prev[gid]) return prev;
        return { ...prev, [gid]: true };
      });
    }
  }, [path, navStructure]);

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

  const currentRequiredPage = getPageSlugForPath(path);
  const isPageAllowed = isAdmin || permsLoading || !currentRequiredPage || can(currentRequiredPage, "view");

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      {/* Sidebar (desktop) */}
      <aside
        className={`fixed inset-y-0 start-0 z-30 hidden flex-col bg-sidebar text-sidebar-foreground lg:flex transition-all duration-300 ease-in-out ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div
          className={`px-3.5 py-3.5 border-b border-sidebar-border/60 flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <Link to="/" className="flex items-center gap-2 overflow-hidden" title="INT-HR">
            <AppLogo size={24} tone="light" withWordmark={!collapsed} />
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              title={dir === "rtl" ? "طي الشريط الجانبي" : "Collapse sidebar"}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <nav className="flex-1 space-y-1.5 px-3 py-3 overflow-y-auto overflow-x-hidden">
          {filteredNav.map((entry) => {
            if (entry.type === "item") {
              const active = isItemActive(entry.item.to, entry.item.exact);
              return (
                <Link
                  key={entry.item.to}
                  to={entry.item.to}
                  title={collapsed ? entry.item.label : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[13px] font-semibold leading-snug transition-all ${
                    collapsed ? "justify-center px-2" : ""
                  } ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-brand"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <entry.item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{entry.item.label}</span>}
                  {entry.item.to === "/admin/chat" && unreadMessagesCount > 0 && (
                    collapsed ? (
                      <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-sidebar" />
                    ) : (
                      <span className="ms-auto grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground shadow-sm">
                        {unreadMessagesCount}
                      </span>
                    )
                  )}
                </Link>
              );
            }

            // Group entry
            const groupActive = isGroupActive(entry.group);
            const isGroupOpen = !!openGroups[entry.group.id];

            if (collapsed) {
              return (
                <DropdownMenu key={entry.group.id}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title={entry.group.label}
                      className={`group relative flex w-full items-center justify-center rounded-xl p-2.5 text-xs font-semibold transition-all ${
                        groupActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-brand"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <entry.group.icon className="h-4 w-4 shrink-0" />
                      {groupActive && (
                        <span className="absolute top-1.5 end-1.5 h-1.5 w-1.5 rounded-full bg-brand ring-2 ring-sidebar" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side={dir === "rtl" ? "left" : "right"}
                    align="start"
                    className="min-w-48 z-50 bg-popover text-popover-foreground border-border shadow-lg"
                  >
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1.5">
                      {entry.group.label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {entry.group.items.map((subItem) => {
                      const subActive = isItemActive(subItem.to, subItem.exact);
                      return (
                        <DropdownMenuItem key={subItem.to} asChild>
                          <Link
                            to={subItem.to}
                            className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                              subActive ? "font-semibold text-brand bg-brand/10" : ""
                            }`}
                          >
                            <subItem.icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{subItem.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <div key={entry.group.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.group.id)}
                  className={`group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[13px] font-semibold leading-snug transition-all ${
                    groupActive
                      ? "text-sidebar-foreground bg-sidebar-accent/50"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <entry.group.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/75" />
                    <span className="truncate">{entry.group.label}</span>
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60 transition-transform duration-200 ${
                      isGroupOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isGroupOpen && (
                  <div className="ms-4 space-y-1 border-s border-sidebar-border/60 ps-2.5 pt-0.5">
                    {entry.group.items.map((subItem) => {
                      const subActive = isItemActive(subItem.to, subItem.exact);
                      return (
                        <Link
                          key={subItem.to}
                          to={subItem.to}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                            subActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                        >
                          <subItem.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className={`m-2.5 rounded-xl bg-sidebar-accent/80 p-2.5 transition-all ${collapsed ? "flex justify-center" : ""}`}>
          <div className="flex items-center gap-2.5">
            <UserMenu size="md" align="start" />
            {!collapsed && (
              <p className="font-display text-xs sm:text-sm font-semibold truncate text-sidebar-foreground">
                {session.name}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-sidebar p-3 text-sidebar-foreground flex flex-col h-full">
            <div className="mb-3 flex items-center justify-between px-1">
              <AppLogo size={24} tone="light" hideWordmarkOnMobile={false} />
              <button onClick={() => setOpen(false)} className="rounded-full p-1 text-sidebar-foreground/80"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto px-1">
              {filteredNav.map((entry) => {
                if (entry.type === "item") {
                  const active = isItemActive(entry.item.to, entry.item.exact);
                  return (
                    <Link
                      key={entry.item.to}
                      to={entry.item.to}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[13px] font-semibold leading-snug ${
                        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80"
                      }`}
                    >
                      <entry.item.icon className="h-4 w-4" />
                      <span className="truncate">{entry.item.label}</span>
                      {entry.item.to === "/admin/chat" && unreadMessagesCount > 0 && (
                        <span className="ms-auto grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground shadow-sm">
                          {unreadMessagesCount}
                        </span>
                      )}
                    </Link>
                  );
                }

                const groupActive = isGroupActive(entry.group);
                const isGroupOpen = !!openGroups[entry.group.id];

                return (
                  <div key={entry.group.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(entry.group.id)}
                      className={`group flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-[13px] font-semibold leading-snug ${
                        groupActive
                          ? "text-sidebar-foreground bg-sidebar-accent/50"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <entry.group.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/75" />
                        <span className="truncate">{entry.group.label}</span>
                      </div>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60 transition-transform duration-200 ${
                          isGroupOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isGroupOpen && (
                      <div className="ms-4 space-y-1 border-s border-sidebar-border/60 ps-2.5 pt-0.5">
                        {entry.group.items.map((subItem) => {
                          const subActive = isItemActive(subItem.to, subItem.exact);
                          return (
                            <Link
                              key={subItem.to}
                              to={subItem.to}
                              onClick={() => setOpen(false)}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                subActive
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                            >
                              <subItem.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                              <span className="truncate">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className={`transition-all duration-300 ease-in-out ${collapsed ? "lg:ps-20" : "lg:ps-64"}`}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-muted lg:hidden"><Menu className="h-5 w-5" /></button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden lg:inline-flex rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={collapsed ? (dir === "rtl" ? "توسيع الشريط الجانبي" : "Expand sidebar") : (dir === "rtl" ? "طي الشريط الجانبي" : "Collapse sidebar")}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/chat"
              className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={t("messagesAndChat")}
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
  if (path.startsWith("/admin/audit") || path.startsWith("/admin/biometrics-health") || path.startsWith("/admin/face-notifications") || path.startsWith("/admin/biometric-terminals") || path.startsWith("/admin/notification-activity")) return "audit";
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
