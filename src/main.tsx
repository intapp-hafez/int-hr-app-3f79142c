import { createRoot } from "react-dom/client";
import "./styles.css";

// Boot with dynamic imports so any module-level error surfaces in the console
// rather than silently killing the page.
async function boot() {
  try {
    const [{ RouterProvider }, { getRouter }, { StrictMode, createElement }, { installPerfProfiler }] = await Promise.all([
      import("@tanstack/react-router"),
      import("./router"),
      import("react"),
      import("./lib/perf-profiler"),
    ]);

    const router = getRouter();
    installPerfProfiler(router as any);
    const rootEl = document.getElementById("root")!;

    createRoot(rootEl).render(
      createElement(StrictMode, null, createElement(RouterProvider, { router })),
    );
  } catch (err) {
    console.error("[boot] fatal:", err);
    const rootEl = document.getElementById("root")!;
    createRoot(rootEl).render(
      <div style={{ padding: 32, fontFamily: "monospace", color: "crimson" }}>
        <b>Boot error (see console)</b>
        <pre style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {err instanceof Error ? err.stack : String(err)}
        </pre>
      </div>,
    );
  }
}

boot();
