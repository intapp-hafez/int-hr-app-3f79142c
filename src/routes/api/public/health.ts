import { createFileRoute } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

const CRITICAL_ROUTES = [
  "/",
  "/auth",
  "/admin",
  "/admin/payroll-settings",
  "/admin/reassign-managers",
  "/employee",
  "/manager",
  "/staff",
] as const;

function collectRegisteredPaths(): Set<string> {
  const paths = new Set<string>();
  const visit = (node: any) => {
    if (!node) return;
    if (typeof node.fullPath === "string") paths.add(node.fullPath || "/");
    if (typeof node.path === "string" && node.path.startsWith("/")) paths.add(node.path);
    const children = (node.children ?? {}) as Record<string, any>;
    for (const key of Object.keys(children)) visit(children[key]);
  };
  visit(routeTree as any);
  return paths;
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const registered = collectRegisteredPaths();
          const routes = CRITICAL_ROUTES.map((path) => {
            const isRegistered = registered.has(path) || registered.has(`${path}/`);
            return { path, registered: isRegistered, status: isRegistered ? 200 : 0, ok: isRegistered };
          });
          const allOk = registered.size > 0 && routes.every((r) => r.ok);
          const body = {
            ok: allOk,
            timestamp: new Date().toISOString(),
            routeTree: { generated: registered.size > 0, totalRoutes: registered.size },
            routes,
          };
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (error) {
          console.error("health check failed", error);
          return new Response(
            JSON.stringify({
              ok: false,
              error: "HEALTH_CHECK_FAILED",
              message: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});