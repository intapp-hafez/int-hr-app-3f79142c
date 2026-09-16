import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { FileSignature, Bell, FileText, Layers } from "lucide-react";

export const Route = createFileRoute("/admin/contracts")({
  component: ContractsLayout,
});

function ContractsLayout() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {t("contracts")}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage employee contracts, templates, and notifications.
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
          <Link
            to="/admin/contracts"
            activeOptions={{ exact: true }}
            className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground [&.active]:border-primary [&.active]:text-primary"
          >
            <FileSignature className="h-4 w-4" />
            Contracts
          </Link>
          <Link
            to="/admin/contracts/notifications"
            className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground [&.active]:border-primary [&.active]:text-primary"
          >
            <Bell className="h-4 w-4" />
            Contract Notifications
          </Link>
          <div className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed">
            <FileText className="h-4 w-4" />
            Templates
          </div>
          <div className="flex items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed">
            <Layers className="h-4 w-4" />
            Contract Types
          </div>
        </nav>
      </div>

      <div className="pt-2">
        <Outlet />
      </div>
    </div>
  );
}