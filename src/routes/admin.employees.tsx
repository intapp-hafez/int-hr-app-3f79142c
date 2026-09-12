import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/employees")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: () => <Outlet />,
});
