import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings_/roles/allowed-pages")({
  component: AllowedPagesRedirect,
});

function AllowedPagesRedirect() {
  return <Navigate to="/admin/settings/roles" search={{ tab: "allowed-pages" }} replace />;
}
