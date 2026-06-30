import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/holidays")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/leaves", search: { tab: "holidays" } });
  },
});
