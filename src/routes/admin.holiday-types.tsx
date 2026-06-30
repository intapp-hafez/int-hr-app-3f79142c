import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/holiday-types")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/leaves", search: { tab: "holidayTypes" } });
  },
});