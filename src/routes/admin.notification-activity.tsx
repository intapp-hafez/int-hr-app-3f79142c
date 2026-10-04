import { createFileRoute, redirect, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/notification-activity")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/audit", search: { tab: "notifications" } });
  },
  component: () => <Navigate to="/admin/audit" search={{ tab: "notifications" }} replace />,
});
