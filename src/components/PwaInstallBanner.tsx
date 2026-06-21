/**
 * PwaInstallBanner
 *
 * Shows an install prompt banner when the browser fires `beforeinstallprompt`
 * (Chrome, Edge, Opera, Samsung Browser on Android/Desktop).
 *
 * For Safari on iOS it shows manual instructions since Safari does not
 * support the `beforeinstallprompt` event.
 */
import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { usePwa } from "@/lib/use-pwa";

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

const DISMISSED_KEY = "pwa-banner-dismissed";

export function PwaInstallBanner() {
  const { canInstall, isInstalled, install } = usePwa();
  const [dismissed, setDismissed] = useState(true); // start hidden, set after mount
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(DISMISSED_KEY) === "1";
    setDismissed(wasDismissed);
    setIos(isIos());
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleInstall = async () => {
    const result = await install();
    if (result === "accepted") setDismissed(true);
  };

  // Hide if: already installed, explicitly dismissed, or neither prompt available
  if (isInstalled || dismissed) return null;
  if (!canInstall && !ios) return null;
  if (ios && isInStandaloneMode()) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-4 left-1/2 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 sm:bottom-6"
      aria-label="Install INT-HR App"
    >
      {/* App icon */}
      <img
        src="/icon-192.png"
        alt="INT-HR App icon"
        width={44}
        height={44}
        className="shrink-0 rounded-xl"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-foreground">
          Install INT-HR App
        </p>

        {ios ? (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Tap{" "}
            <span className="inline-flex translate-y-0.5 items-center">
              <Share className="h-3.5 w-3.5 text-blue-500" />
            </span>{" "}
            then <strong>Add to Home Screen</strong> to install.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add to your home screen for the best experience.
          </p>
        )}

        {!ios && (
          <button
            id="pwa-install-btn"
            onClick={handleInstall}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss install banner"
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
