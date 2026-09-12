import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare, Monitor, Smartphone, Tablet } from "lucide-react";
import { usePwa } from "@/lib/use-pwa";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const DISMISSED_KEY = "pwa-banner-dismissed-ts";
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 4; // 4 hours dismissal so it doesn't annoy the user on every navigation, but reappears in future sessions

export function PwaInstallBanner() {
  const { canInstall, isInstalled, isIos, isAndroid, install } = usePwa();
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setMounted(true);
    const dismissedAt = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_DURATION_MS) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } else {
      setDismissed(false);
    }

    // Allow any button across the app to force-show the install banner/instructions
    const handleForceShow = () => {
      setDismissed(false);
      sessionStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("pwa-show-install", handleForceShow);
    return () => window.removeEventListener("pwa-show-install", handleForceShow);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await install();
      if (result === "accepted") {
        toast.success(t("installSuccess") || "App installed successfully");
        setDismissed(true);
      } else if (result === "unavailable") {
        // In browsers where the direct prompt is not supported or was blocked
        toast.info(t("installAppDesktopDesc") || "Click the Install icon in your browser address bar to install.");
      }
    } catch {
      // Ignored
    } finally {
      setInstalling(false);
    }
  };

  if (!mounted || isInstalled || dismissed) return null;

  // If already standalone (installed), do not show
  if (typeof window !== "undefined") {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return null;
  }

  return (
    <aside
      role="banner"
      aria-label={t("installApp") || "Install INT-HR App"}
      className="fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300 sm:bottom-6 sm:inset-x-auto sm:end-6 sm:w-96"
    >
      <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-card/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 dark:bg-card/90">
        {/* Glow accent */}
        <div className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full bg-brand/15 blur-2xl" />

        <div className="flex items-start gap-3.5">
          {/* App Icon */}
          <div className="relative shrink-0">
            <img
              src="/icon-192.png"
              alt="INT-HR Logo"
              width={48}
              height={48}
              className="h-12 w-12 rounded-xl object-cover shadow-md ring-1 ring-border"
            />
            <div className="absolute -bottom-1 -end-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-foreground shadow-xs">
              {isIos || isAndroid ? (
                <Smartphone className="h-3 w-3" />
              ) : (
                <Monitor className="h-3 w-3" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center justify-between gap-1">
              <h4 className="font-display text-sm font-semibold tracking-tight text-foreground">
                INT-HR App
              </h4>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                PWA
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("installAppDesc") ||
                "Install INT-HR App on your device for quick access, offline mode, and instant alerts."}
            </p>

            {/* Platform-specific instructions */}
            {isIos ? (
              <div className="mt-2.5 space-y-1.5 rounded-xl border border-border/80 bg-muted/50 p-2.5 text-xs text-foreground">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-sky-500/15 font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                    1
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {t("tapShareButton") || "Tap the Share button"}
                    <Share className="inline-block h-3.5 w-3.5 text-sky-500 mx-0.5" />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    2
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    {t("addToHomeScreen") || "Add to Home Screen"}
                    <PlusSquare className="inline-block h-3.5 w-3.5 text-emerald-500 mx-0.5" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  id="pwa-install-btn"
                  onClick={handleInstall}
                  disabled={installing}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-brand transition hover:opacity-95 active:scale-95 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing ? (isAr ? "جاري التثبيت…" : "Installing…") : (t("installApp") || "Install App")}
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  {isAr ? "لاحقاً" : "Later"}
                </button>
              </div>
            )}
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss banner"
            className="shrink-0 -me-1 -mt-1 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Utility helper to programmatically trigger the install prompt or banner anywhere in the app
 */
export function triggerPwaInstall() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pwa-show-install"));
    // Also try to trigger deferred prompt directly if available
    const promptEvent = (window as any).__pwaDeferredPrompt;
    if (promptEvent && typeof promptEvent.prompt === "function") {
      promptEvent.prompt();
    }
  }
}
