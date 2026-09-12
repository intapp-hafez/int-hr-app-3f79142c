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
  isIos: boolean;
  isAndroid: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIosUa = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return (isIosUa || isIpadOs) && !(window as any).MSStream;
}

export function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(window.navigator.userAgent);
}

export function usePwa(): PwaState {
  const deferredPrompt = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  // Detect platform & standalone mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsIos(isIosDevice());
    setIsAndroid(isAndroidDevice());

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

    // Check if early event was already captured by index.html script
    if ((window as any).__pwaDeferredPrompt) {
      deferredPrompt.current = (window as any).__pwaDeferredPrompt;
      setCanInstall(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaDeferredPrompt = e;
      deferredPrompt.current = e;
      setCanInstall(true);
    };

    const onEarlyReady = () => {
      if ((window as any).__pwaDeferredPrompt) {
        deferredPrompt.current = (window as any).__pwaDeferredPrompt;
        setCanInstall(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    window.addEventListener("pwa-prompt-ready", onEarlyReady);

    // Hide the banner if user installs from outside
    window.addEventListener("appinstalled", () => {
      (window as any).__pwaDeferredPrompt = null;
      deferredPrompt.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
      window.removeEventListener("pwa-prompt-ready", onEarlyReady);
    };
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const promptEvent = deferredPrompt.current || (typeof window !== "undefined" && (window as any).__pwaDeferredPrompt);
    if (!promptEvent) return "unavailable";
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      (window as any).__pwaDeferredPrompt = null;
      deferredPrompt.current = null;
      setCanInstall(false);
      if (outcome === "accepted") setIsInstalled(true);
      return outcome as "accepted" | "dismissed";
    } catch {
      return "unavailable";
    }
  };

  return { canInstall, isInstalled, swReady, isIos, isAndroid, install };
}
