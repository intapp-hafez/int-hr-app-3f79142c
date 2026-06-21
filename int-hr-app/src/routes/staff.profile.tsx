import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Smartphone, Share, MoreVertical, Plus, Download, CheckCircle2 } from "lucide-react";
import { InstallButton } from "@/components/InstallButton";
import { SettingsPage } from "./employee.settings";

export const Route = createFileRoute("/staff/profile")({
  component: StaffProfile,
});

type Platform = "ios" | "android" | "desktop" | "other";

function detect(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Chrome|Edg|OPR|Opera/i.test(ua)) return "desktop";
  return "other";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function InstallBanner() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detect());
    setInstalled(isStandalone());
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (installed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-3 text-success">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">App installed</p>
          <p className="text-xs opacity-80">You're using INT-HR as an app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand/10 via-card to-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">Install INT-HR App</h2>
          <p className="text-xs text-muted-foreground">
            Faster access, offline-ready, and full-screen experience.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <InstallButton className="w-full justify-center" />
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {platform === "ios" ? "iPhone / iPad" : platform === "android" ? "Android" : "Quick steps"}
        </p>
        <ol className="space-y-1.5 rounded-2xl bg-muted/50 p-3 text-xs">
          {platform === "ios" ? (
            <>
              <Step n={1} icon={<Share className="h-3.5 w-3.5" />}>Tap the <strong>Share</strong> icon in Safari.</Step>
              <Step n={2} icon={<Plus className="h-3.5 w-3.5" />}>Choose <strong>Add to Home Screen</strong>.</Step>
              <Step n={3}>Tap <strong>Add</strong> to confirm.</Step>
            </>
          ) : platform === "android" ? (
            <>
              <Step n={1} icon={<MoreVertical className="h-3.5 w-3.5" />}>Open Chrome menu (⋮).</Step>
              <Step n={2} icon={<Download className="h-3.5 w-3.5" />}>Tap <strong>Install app</strong>.</Step>
              <Step n={3}>Confirm to add to home screen.</Step>
            </>
          ) : (
            <>
              <Step n={1}>Tap <strong>Install app</strong> above.</Step>
              <Step n={2}>Or use your browser menu → <strong>Install</strong>.</Step>
            </>
          )}
        </ol>
      </div>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-brand text-[10px] font-bold text-brand-foreground">{n}</span>
      <span className="flex-1 leading-relaxed">
        {icon && <span className="me-1 inline-flex align-text-bottom">{icon}</span>}
        {children}
      </span>
    </li>
  );
}

function StaffProfile() {
  return (
    <div className="space-y-4">
      <InstallBanner />
      <SettingsPage />
    </div>
  );
}