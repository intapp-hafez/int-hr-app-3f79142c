import { useEffect, useState } from "react";
import { Download, Smartphone, X, Share, MoreVertical, Plus } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "android-chromium" | "desktop-chromium" | "ios-safari" | "firefox" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return "ios-safari";
  const isAndroid = /Android/i.test(ua);
  const isChromium = /Chrome|Edg|OPR|Opera/i.test(ua) && !/Firefox/i.test(ua);
  if (isAndroid && isChromium) return "android-chromium";
  if (isChromium) return "desktop-chromium";
  if (/Firefox/i.test(ua)) return "firefox";
  return "other";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function InstallButton({ className = "", variant = "solid" }: { className?: string; variant?: "solid" | "ghost" }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setDeferred(null);
      } catch {
        setOpen(true);
      }
      return;
    }
    setOpen(true);
  }

  const base =
    variant === "solid"
      ? "inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand"
      : "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted";

  return (
    <>
      <button onClick={handleClick} className={`${base} ${className}`} aria-label="Install INT-HR App">
        <Download className="h-4 w-4" />
        Install app
      </button>
      {open && <InstallHelpModal platform={platform} onClose={() => setOpen(false)} />}
    </>
  );
}

function InstallHelpModal({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-6 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <Smartphone className="h-5 w-5 text-brand" /> Install INT-HR App
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Follow the steps for your browser to add INT-HR App to your home screen or desktop.
        </p>

        <div className="space-y-4 text-sm">
          {platform === "ios-safari" && (
            <Steps title="iPhone / iPad — Safari">
              <Step n={1} icon={<Share className="h-4 w-4" />}>Tap the <strong>Share</strong> icon in the toolbar.</Step>
              <Step n={2} icon={<Plus className="h-4 w-4" />}>Choose <strong>Add to Home Screen</strong>.</Step>
              <Step n={3}>Tap <strong>Add</strong> in the top-right.</Step>
            </Steps>
          )}
          {platform === "android-chromium" && (
            <Steps title="Android — Chrome / Edge / Opera">
              <Step n={1} icon={<MoreVertical className="h-4 w-4" />}>Open the browser menu (⋮).</Step>
              <Step n={2}>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</Step>
              <Step n={3}>Confirm to add INT-HR App.</Step>
            </Steps>
          )}
          {platform === "desktop-chromium" && (
            <Steps title="Desktop — Chrome / Edge / Opera">
              <Step n={1}>Look for the <strong>Install</strong> icon in the address bar (right side).</Step>
              <Step n={2}>Or open the browser menu (⋮) and choose <strong>Install INT-HR App…</strong></Step>
              <Step n={3}>Click <strong>Install</strong> to confirm.</Step>
            </Steps>
          )}
          {platform === "firefox" && (
            <Steps title="Firefox">
              <Step n={1}>On Android: open the menu and tap <strong>Install</strong>.</Step>
              <Step n={2}>On desktop, Firefox doesn't support PWA installs natively — you can pin the tab, or open INT-HR App in Chrome / Edge to install.</Step>
            </Steps>
          )}
          {platform === "other" && (
            <Steps title="Your browser">
              <Step n={1}>Open the browser menu.</Step>
              <Step n={2}>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</Step>
              <Step n={3}>For full support, use Chrome, Edge, Opera, or Safari.</Step>
            </Steps>
          )}
        </div>

        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-brand">
          Got it
        </button>
      </div>
    </div>
  );
}

function Steps({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ol className="space-y-2">{children}</ol>
    </div>
  );
}
function Step({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-brand text-[11px] font-bold text-brand-foreground">{n}</span>
      <span className="flex-1 leading-relaxed">{icon && <span className="me-1 inline-flex align-text-bottom">{icon}</span>}{children}</span>
    </li>
  );
}
