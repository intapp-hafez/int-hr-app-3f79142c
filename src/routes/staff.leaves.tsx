import { createFileRoute } from "@tanstack/react-router";
import { LeavesPage } from "@/components/employee/LeavesPage";

export const Route = createFileRoute("/staff/leaves")({
  component: LeavesPage,
});