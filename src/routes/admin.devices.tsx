import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/devices")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/directory", search: { tab: "devices" } });
  },
});
