/**
 * Lightweight perf profiler — surfaces what's stalling the UI after route
 * navigations / button clicks. Three signals:
 *
 *   1. Route chunk sizes & load duration  (PerformanceObserver "resource")
 *   2. Long tasks > 50ms on the main thread (PerformanceObserver "longtask")
 *   3. Router navigation timing            (router.subscribe)
 *
 * Enable by setting localStorage.PERF = "1" (or it auto-enables in dev).
 * All output is grouped under `[perf]` so it's easy to filter in DevTools.
 */

type AnyRouter = {
  subscribe: (event: string, cb: (e: any) => void) => () => void;
};

const fmtKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const fmtMs = (ms: number) => `${ms.toFixed(1)} ms`;

function enabled() {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("PERF") === "0") return false;
    if (localStorage.getItem("PERF") === "1") return true;
  } catch {}
  return import.meta.env.DEV;
}

let installed = false;

export function installPerfProfiler(router?: AnyRouter) {
  if (!enabled() || installed) return;
  installed = true;

  // 1. Resource timing — every JS/CSS chunk the browser fetches.
  try {
    const ro = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        const url = e.name;
        if (!/\.(js|mjs|css)(\?|$)/.test(url)) continue;
        const size = e.encodedBodySize || e.transferSize || 0;
        const dur = e.duration;
        // Highlight chunks that are big OR slow.
        const heavy = size > 200 * 1024 || dur > 300;
        const tag = heavy ? "%c[perf] chunk*" : "%c[perf] chunk";
        const style = heavy ? "color:#ea7a2c;font-weight:bold" : "color:#888";
        // eslint-disable-next-line no-console
        console.log(
          `${tag} %s  size=%s  dur=%s`,
          style,
          url.replace(location.origin, ""),
          fmtKB(size),
          fmtMs(dur),
        );
      }
    });
    ro.observe({ type: "resource", buffered: true });
  } catch (err) {
    console.warn("[perf] resource observer unavailable", err);
  }

  // 2. Long tasks — anything blocking the main thread > 50ms.
  try {
    const lo = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        // eslint-disable-next-line no-console
        console.log(
          "%c[perf] longtask %s starting at %s",
          "color:#dc2626;font-weight:bold",
          fmtMs(e.duration),
          fmtMs(e.startTime),
        );
      }
    });
    lo.observe({ type: "longtask", buffered: true });
  } catch {
    // longtask not supported in all browsers — ignore silently.
  }

  // 3. Router navigation timing.
  if (router && typeof router.subscribe === "function") {
    let navStart = 0;
    let navPath = "";
    try {
      router.subscribe("onBeforeNavigate", (e: any) => {
        navStart = performance.now();
        navPath = e?.toLocation?.pathname ?? e?.pathname ?? "?";
        // eslint-disable-next-line no-console
        console.log("%c[perf] nav →  %s", "color:#0ea5e9", navPath);
      });
      router.subscribe("onResolved", () => {
        if (!navStart) return;
        const dur = performance.now() - navStart;
        const style = dur > 500 ? "color:#dc2626;font-weight:bold" : "color:#16a34a";
        // eslint-disable-next-line no-console
        console.log(`%c[perf] nav ✓  %s  ${fmtMs(dur)}`, style, navPath);
        navStart = 0;
      });
    } catch (err) {
      console.warn("[perf] router subscribe failed", err);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    "%c[perf] profiler installed — disable with localStorage.PERF='0'",
    "color:#888",
  );
}