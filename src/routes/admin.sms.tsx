import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sms")({
  component: () => <Navigate to="/admin/directory" search={{ tab: "sms" }} replace />,
});
