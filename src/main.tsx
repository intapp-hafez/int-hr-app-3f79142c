import { createRoot } from "react-dom/client";
import "./styles.css";

// Safeguard against Google Translate / browser auto-translators modifying DOM text nodes
// which causes React Fiber reconciliation to throw NotFoundError during insertBefore or removeChild.
if (typeof Node !== "undefined" && Node.prototype) {
  const origInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode);
    }
    try {
      return origInsertBefore.call(this, newNode, referenceNode);
    } catch (err: any) {
      if (err?.name === "NotFoundError") {
        return this.appendChild(newNode);
      }
      throw err;
    }
  };

  const origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    try {
      return origRemoveChild.call(this, child);
    } catch (err: any) {
      if (err?.name === "NotFoundError") {
        return child;
      }
      throw err;
    }
  };
}

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
