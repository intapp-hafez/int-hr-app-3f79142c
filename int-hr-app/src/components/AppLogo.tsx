import logo from "@/assets/int-logo.png";

export function AppLogo({ size = 28, withWordmark = true, tone = "auto" }: { size?: number; withWordmark?: boolean; tone?: "auto" | "light" | "dark" }) {
  const textClass = tone === "light" ? "text-white" : tone === "dark" ? "text-foreground" : "text-foreground";
  return (
    <div className="flex items-center gap-2">
      <img src={logo} alt="INT-HR App" width={size} height={size} className="rounded-md" />
      {withWordmark && (
        <span className={`font-display text-base font-semibold tracking-tight ${textClass}`}>
          INT-HR App
        </span>
      )}
    </div>
  );
}
