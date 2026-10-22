import { createFileRoute } from "@tanstack/react-router";
import { EmployeeAdvancesPage } from "@/components/employee/EmployeeAdvancesPage";

export const Route = createFileRoute("/employee/advances")({
  component: EmployeeAdvancesPage,
});
