import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDashboard } from "./employee.index";

export const Route = createFileRoute("/staff/")({
  component: EmployeeDashboard,
});