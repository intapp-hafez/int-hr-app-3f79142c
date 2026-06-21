import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Home, Users, ListChecks, Route as RouteIcon, LogOut, LogIn } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { useSession, useAuthReady, signOut } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";

export const Route = createFileRoute("/manager")({
  component: ManagerLayout,
});

function ManagerLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const ready = useAuthReady();
  // navigate handled inside UserMenu / inline logout

  if (typeof window === "undefined") return null;
  if (!ready) return null;
  if (!session) return <Navigate to="/auth" replace />;
  if (session.role === "admin") return <Navigate to="/admin" replace />;
  if (session.role === "staff") return <Navigate to="/staff" replace />;
  if (session.role === "employee") return <Navigate to="/employee" replace />;

  const doLogout = async () => { await signOut(); window.location.href = "/auth"; };

  const items = [
    { to: "/manager", icon: Home, label: t("dashboard"), exact: true },
    { to: "/manager/check", icon: LogIn, label: "Check in/out" },
    { to: "/manager/team", icon: Users, label: t("myTeam") },
    { to: "/manager/tasks", icon: ListChecks, label: t("tasks") },
    { to: "/manager/trips", icon: RouteIcon, label: t("trips") },
  ] as const;

  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path.startsWith(to));

  return (
    <div dir={dir} className="min-h-screen bg-muted/40">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-border bg-background lg:flex">
          <div className="flex items-center gap-2 border-b border-border px-4 py-4">
            <Link to="/"><AppLogo size={28} /></Link>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {items.map((it) => {
              const active = isActive(it.to, "exact" in it ? it.exact : false);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <it.icon className="h-4 w-4" />
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <button
              onClick={doLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> {t("logout")}
            </button>
          </div>
        </aside>

        <div className="mx-auto flex w-full max-w-5xl flex-col bg-background shadow-soft lg:max-w-none lg:shadow-none">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <AppLogo size={24} />
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                {t("manager")}
              </span>
            </Link>
            <span className="hidden text-sm font-semibold lg:inline">{t("managerPanel")}</span>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline lg:hidden">{session.name}</span>
              <LanguageToggle />
              <UserMenu size="sm" />
            </div>
          </header>

          <main className="flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-8">
            <Outlet />
          </main>

          {/* Mobile bottom nav */}
          <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl border-t border-border bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden">
            <ul className="flex items-center justify-between">
              {items.map((it) => {
                const active = isActive(it.to, "exact" in it ? it.exact : false);
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
    </div>
  );
}