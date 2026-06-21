import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Home, Clock, CalendarDays, User } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { useSession, useAuthReady } from "@/lib/auth";
import { UserMenu } from "@/components/UserMenu";

export const Route = createFileRoute("/staff")({
  component: StaffLayout,
});

function StaffLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const session = useSession();
  const ready = useAuthReady();

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