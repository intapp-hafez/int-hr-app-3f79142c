import { createFileRoute } from "@tanstack/react-router";
import { KpiEvaluationView } from "@/components/kpi/KpiEvaluationView";

export const Route = createFileRoute("/manager/kpi-evaluations")({
  component: ManagerKpiEvaluationsPage,
});

function ManagerKpiEvaluationsPage() {
  return <KpiEvaluationView role="manager" />;
}

