import { Download } from "lucide-react";
import { usePwa } from "@/lib/use-pwa";
import { triggerPwaInstall } from "@/components/PwaInstallBanner";
import { useI18n } from "@/lib/i18n";

export function InstallButton({
  className = "",
  variant = "solid",
}: {
  className?: string;
  variant?: "solid" | "ghost" | "outline";
}) {
  const { isInstalled, install, canInstall } = usePwa();
  const { t } = useI18n();

  if (isInstalled) return null;

  async function handleClick() {
    if (canInstall) {
      await install();
    } else {
      // For iOS, Safari, or browsers requiring manual steps, trigger the banner/instructions
      triggerPwaInstall();
    }
  }

  const base =
    variant === "solid"
      ? "inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition active:scale-95"
      : variant === "outline"
        ? "inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/5 px-3.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition"
        : "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${base} ${className}`}
      aria-label={t("installApp") || "Install INT-HR App"}
      title={t("installApp") || "Install App"}
    >
      <Download className="h-4 w-4 shrink-0" />
      <span>{t("installApp") || "Install app"}</span>
    </button>
  );
}
