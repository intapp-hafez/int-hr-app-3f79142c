import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, Banknote, StickyNote, Bell } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/finance/")({
  component: FinanceDashboard,
});

function FinanceDashboard() {
  const { t } = useI18n();
  const session = useSession();


  const cards = [
    { to: "/finance/payroll", icon: Wallet, label: t("payrollRun") || "Run Payroll", value: t("manage") || "Manage" },
    { to: "/finance/advances", icon: Banknote, label: t("advances") || "Advances", value: t("review") || "Review" },
    { to: "/finance/sticky-notes", icon: StickyNote, label: t("notes") || "Notes", value: t("view") || "View" },
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">{t("financePanel") || "Finance Panel"}</p>
        <h1 className="font-display text-2xl font-semibold">{session?.name ?? ""}</h1>
        <p className="text-sm text-muted-foreground">{t("financeDepartment") || "Finance Department"}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label + c.to}
            to={c.to}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5"
          >
            <c.icon className="h-5 w-5 text-brand" />
            <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>

      <Link to="/finance/notifications" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-muted">
        <span className="flex items-center gap-2 font-display text-sm font-semibold"><Bell className="h-4 w-4 text-brand" /> {t("recentNotifications")}</span>
        <span className="text-xs text-brand">{t("view") || "View"}</span>
      </Link>
    </div>
  );
}
