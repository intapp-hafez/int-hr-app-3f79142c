import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";

export const Route = createFileRoute("/staff/")({
  component: EmployeeDashboard,
});