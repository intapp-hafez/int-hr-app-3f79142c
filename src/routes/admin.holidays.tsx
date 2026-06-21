import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/holidays")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/directory", search: { tab: "holidays" } });
  },
});
