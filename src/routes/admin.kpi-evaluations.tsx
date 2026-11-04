import { createFileRoute } from "@tanstack/react-router";
import { KpiEvaluationView } from "@/components/kpi/KpiEvaluationView";

export const Route = createFileRoute("/admin/kpi-evaluations")({
  head: () => ({ meta: [
    { title: "KPI evaluations & Job descriptions | INT HR" },
    { name: "description", content: "Manage employee evaluations, role templates, criteria and position job descriptions." },
    { property: "og:title", content: "KPI evaluations & Job descriptions | INT HR" },
    { property: "og:description", content: "Manage evaluations and job descriptions by position." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminKpiEvaluationsPage,
});

function AdminKpiEvaluationsPage() {
  return <KpiEvaluationView role="admin" />;
}

