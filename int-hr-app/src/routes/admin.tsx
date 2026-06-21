import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Users, MapPin, Clock, CalendarDays, FileBarChart2, ScrollText, Menu, X, Bell, Search, Wallet, Settings, FileSignature, Shield, Building2, KeyRound } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { UserMenu } from "@/components/UserMenu";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { useSession, useAuthReady } from "@/lib/auth";
import { useExportScheduler } from "@/lib/export-scheduler";
import { usePermissions } from "@/lib/permissions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const session = useSession();
  const ready = useAuthReady();
  useExportScheduler();
  const { can, isAdmin, loading: permsLoading } = usePermissions();

  if (typeof window === "undefined") return null;
  if (!ready) return null;
  if (!session) return <Navigate to="/auth" replace />;
  const hasAdminAccess = session.roles?.some((r) => ["admin", "hr", "manager", "user"].includes(r));
  if (!hasAdminAccess) {
    const target = session.roles?.includes("staff") ? "/staff" : "/employee";
    return <Navigate to={target} replace />;
  }

  const navAll = [
    { to: "/admin", icon: LayoutDashboard, label: t("dashboard"), exact: true, page: null },
    { to: "/admin/employees", icon: Users, label: t("employees"), page: "employees" },
    { to: "/admin/contracts", icon: FileSignature, label: t("contracts"), page: "contracts" },
    { to: "/admin/geofencing", icon: MapPin, label: t("geofencing"), page: "geofencing" },
    { to: "/admin/employee-access", icon: KeyRound, label: "Employee Access", page: "employee-access" },
    { to: "/admin/attendance", icon: Clock, label: t("attendance"), page: "attendance" },
    { to: "/admin/leaves", icon: CalendarDays, label: t("leaves"), page: "leaves" },
    
    { to: "/admin/payroll", icon: Wallet, label: t("payroll"), page: "payroll" },
    { to: "/admin/reports", icon: FileBarChart2, label: t("reports"), page: "reports" },
    { to: "/admin/audit", icon: ScrollText, label: t("audit"), page: "audit" },
    { to: "/admin/directory", icon: Building2, label: "Directory", page: "directory" },
    { to: "/admin/roles", icon: Shield, label: "Roles", page: "roles" },
    { to: "/admin/settings", icon: Settings, label: t("settings") || "Settings", page: "settings" },
  ] as const;
  const nav = isAdmin || permsLoading
    ? navAll
    : navAll.filter((n) => n.page === null || can(n.page, "view"));

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
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder={t("search")}
                className="w-72 rounded-full border border-input bg-card py-2 ps-9 pe-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button className="relative rounded-full border border-border bg-card p-2 text-foreground hover:bg-accent">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand" />
            </button>
            <UserMenu />
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
