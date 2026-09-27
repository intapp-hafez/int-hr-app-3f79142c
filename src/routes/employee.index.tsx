import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";

export const Route = createFileRoute("/employee/")({
  head: () => ({ meta: [
    { title: "Employee Home | INT-HR" },
    { name: "description", content: "View your workday, attendance, tasks, and requests in INT-HR." },
    { property: "og:title", content: "Employee Home | INT-HR" },
    { property: "og:description", content: "View your workday, attendance, tasks, and requests in INT-HR." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: EmployeeDashboard,
});
