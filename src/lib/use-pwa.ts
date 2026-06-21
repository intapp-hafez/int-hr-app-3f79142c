/**
 * usePwa — PWA service worker registration + install prompt manager.
 *
 * Usage:
 *   const { canInstall, install, isInstalled, swReady } = usePwa();
 *
 * - canInstall: true when the browser has fired `beforeinstallprompt`
 * - install():  triggers the native install dialog
 * - isInstalled: true once running in standalone/fullscreen mode
 * - swReady: true once the service worker is registered
 */
import { useEffect, useRef, useState } from "react";

export interface PwaState {
  canInstall: boolean;
  isInstalled: boolean;
  swReady: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function usePwa(): PwaState {
  const deferredPrompt = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swReady, setSwReady] = useState(false);

  // Detect if already installed (standalone / fullscreen)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mq.matches || (navigator as any).standalone === true);
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Register the main PWA service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setSwReady(true);

        // Auto-update: when a new SW is waiting, activate it immediately
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const newSw = reg.installing;
          if (!newSw) return;
          newSw.addEventListener("statechange", () => {
            if (newSw.state === "installed" && navigator.serviceWorker.controller) {
              newSw.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed:", err);
      });

    // Reload page when a new SW takes control (after SKIP_WAITING)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  // Capture beforeinstallprompt (Chrome, Edge, Opera, Samsung Browser)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);

    // Hide the banner if user installs from outside
    window.addEventListener("appinstalled", () => {
      deferredPrompt.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt.current) return "unavailable";
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
    return outcome as "accepted" | "dismissed";
  };

  return { canInstall, isInstalled, swReady, install };
}
