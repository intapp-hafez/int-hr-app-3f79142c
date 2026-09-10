import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/attendance-report")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/attendance", search: { tab: "report" } });
  },
});
