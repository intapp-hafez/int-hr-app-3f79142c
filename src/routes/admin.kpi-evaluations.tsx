import { createFileRoute } from "@tanstack/react-router";
import { KpiEvaluationView } from "@/components/kpi/KpiEvaluationView";

export const Route = createFileRoute("/admin/kpi-evaluations")({
  component: AdminKpiEvaluationsPage,
});

function AdminKpiEvaluationsPage() {
  return <KpiEvaluationView role="admin" />;
}

