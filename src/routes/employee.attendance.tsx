import { createFileRoute } from "@tanstack/react-router";
import { AttendancePage } from "@/components/employee/AttendancePage";

export const Route = createFileRoute("/employee/attendance")({
  component: AttendancePage,
});