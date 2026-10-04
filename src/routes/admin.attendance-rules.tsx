import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/attendance-rules")({
  head: () => ({
    meta: [
      { title: "Attendance rules — INT HR" },
    ],
  }),
  component: () => <Navigate to="/admin/attendance" search={{ tab: "rules" }} replace />,
});
