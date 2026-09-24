import logo from "@/assets/int-logo.png";
import { useI18n } from "@/lib/i18n";

export function AppLogo({
  size = 28,
  withWordmark = true,
  hideWordmarkOnMobile = true,
  tone = "auto",
  badge,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  hideWordmarkOnMobile?: boolean;
  tone?: "auto" | "light" | "dark";
  badge?: string;
  className?: string;
}) {
  let isAr = false;
  try {
    const i18n = useI18n();
    isAr = i18n?.isAr ?? false;
  } catch {
    isAr = false;
  }

  const isLight = tone === "light";
  const defaultBadge = isAr ? "تطبيق" : "App";
  const badgeLabel = badge ?? defaultBadge;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Crisp White Elevated Emblem Tile with High-Resolution ht Mark */}
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-xl bg-white shadow-md transition-transform duration-200 hover:scale-105 p-1.5 ${
          isLight
            ? "ring-1 ring-white/20 shadow-black/30"
            : "border border-border/80 shadow-sm"
        }`}
        style={{ width: size + 10, height: size + 10 }}
      >
        <img
          src={logo}
          alt="INT-HR"
          style={{ width: size, height: size }}
          className="h-full w-full object-contain"
        />
      </div>

      {withWordmark && (
        <div className={`flex-col text-start leading-none ${hideWordmarkOnMobile ? "hidden sm:flex" : "flex"}`}>
          <div className="flex items-center gap-1.5">
            <span
              className={`font-display text-base font-extrabold tracking-tight ${
                isLight ? "text-white" : "text-foreground"
              }`}
            >
              INT<span className="text-brand font-black">·</span>HR
            </span>
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase border ${
                isLight
                  ? "bg-white/15 text-white/90 border-white/20"
                  : "bg-brand/10 text-brand border-brand/20"
              }`}
            >
              {badgeLabel}
            </span>
          </div>
          <span
            className={`mt-1 text-[10px] font-medium tracking-normal ${
              isLight ? "text-white/70" : "text-muted-foreground"
            }`}
          >
            {isAr ? "التقنيات المتكاملة" : "Integrated Technics"}
          </span>
        </div>
      )}
    </div>
  );
}
