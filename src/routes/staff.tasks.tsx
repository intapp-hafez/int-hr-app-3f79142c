import { createFileRoute } from "@tanstack/react-router";
import { EmployeeTasksPage } from "./employee.tasks";

export const Route = createFileRoute("/staff/tasks")({
  component: EmployeeTasksPage,
});
