import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  MapPin,
  Wifi,
  ShieldCheck,
  Smartphone,
  Shield,
  LogIn,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { InstallButton } from "@/components/InstallButton";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import heroDashboardImg from "@/assets/hero-dashboard.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INT-HR App — Secure Employee Attendance" },
      {
        name: "description",
        content:
          "GPS geo-fencing, authorized network validation, biometric verification, leave management, and real-time reporting for modern workforces.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, dir } = useI18n();

  const featurePillars = [
    { icon: MapPin, label: t("heroGps") },
    { icon: Wifi, label: t("heroWifi") },
    { icon: ShieldCheck, label: t("heroAudit") },
  ];

  return (
    <div
      dir={dir}
      className="relative flex h-screen max-h-screen w-full flex-col overflow-hidden bg-background text-foreground selection:bg-brand/20 selection:text-brand"
    >
      {/* Dynamic ambient backdrop glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 start-1/4 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-brand/15 to-orange-400/5 blur-[120px] opacity-70" />
        <div className="absolute top-1/3 end-[-10%] h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-amber-500/10 via-brand/10 to-transparent blur-[140px] opacity-60" />
        <div className="absolute -bottom-40 start-[-5%] h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-sky-500/5 via-indigo-500/5 to-transparent blur-[120px] opacity-50" />
      </div>

      {/* Full-Width Glass Header */}
      <header className="shrink-0 w-full border-b border-border/50 bg-background/85 backdrop-blur-md z-50 px-4 sm:px-8 md:px-12 lg:px-16 2xl:px-24 py-2.5 sm:py-3 flex items-center justify-between gap-4">
        <Link to="/" className="transition hover:opacity-90">
          <AppLogo size={26} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <InstallButton variant="ghost" />
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:border-brand/40 hover:bg-accent hover:text-brand transition duration-200"
          >
            <LogIn className="h-3.5 w-3.5 text-brand rtl:rotate-180" />
            <span>{t("signIn")}</span>
          </Link>
          <LanguageToggle />
        </div>
      </header>

      {/* Full-Width Hero Section strictly fitting in viewport */}
      <main className="flex-1 min-h-0 w-full px-4 sm:px-8 md:px-12 lg:px-16 2xl:px-24 py-2 sm:py-4 lg:py-5 flex flex-col justify-center overflow-y-auto lg:overflow-hidden">
        <section
          aria-labelledby="hero-heading"
          className="w-full grid items-center gap-6 lg:gap-8 xl:gap-12 lg:grid-cols-12 my-auto"
        >
          {/* Left Column: Brand, Pitch & Primary Actions */}
          <div className="flex flex-col justify-center space-y-4 sm:space-y-5 xl:space-y-6 lg:col-span-5 xl:col-span-5">
            {/* Live Verification Badge */}
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-border/80 bg-card/80 px-3 py-1 text-[11px] sm:text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="tracking-wide text-[11px] sm:text-xs text-muted-foreground font-medium">
                {t("heroBadge")}
              </span>
            </div>

            {/* Headline */}
            <h1
              id="hero-heading"
              className="font-display text-3xl sm:text-4xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]"
            >
              {t("appName")}.<br />
              <span className="bg-gradient-to-r from-brand via-orange-500 to-amber-500 bg-clip-text text-transparent">
                {t("heroPunchline")}
              </span>
            </h1>

            {/* Subtitle / Tagline */}
            <p className="max-w-lg text-xs sm:text-sm xl:text-base leading-relaxed text-muted-foreground font-normal">
              {t("tagline")}
            </p>

            {/* Call to Actions */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 pt-0.5">
              <Link
                to="/employee"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-background shadow-md transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Smartphone className="h-4 w-4" />
                <span>
                  {t("continueAs")} {t("employee")}
                </span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>
              <Link
                to="/admin"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-brand-foreground shadow-brand transition-all hover:opacity-95 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Shield className="h-4 w-4" />
                <span>
                  {t("continueAs")} {t("administrator")}
                </span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>
            </div>

            {/* 3 Value Pillars */}
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 pt-1">
              {featurePillars.map((f) => (
                <li
                  key={f.label}
                  className="group flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/60 p-2 sm:p-2.5 shadow-sm backdrop-blur-sm transition hover:border-brand/40 hover:bg-card hover:shadow-md"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                    <f.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground">
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Assurance Trust Badges */}
            <div className="flex flex-wrap items-center gap-3.5 text-[11px] sm:text-xs text-muted-foreground pt-0.5">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {t("tamperProof")}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {t("liveBiometrics")}
              </span>
            </div>
          </div>

          {/* Right Column: Scaled Mockup Frame fitting 100vh */}
          <div className="relative flex items-center justify-center lg:col-span-7 xl:col-span-7">
            {/* Ambient Backlight Glow */}
            <div
              aria-hidden="true"
              className="absolute -inset-4 sm:-inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-brand/20 via-orange-400/10 to-transparent blur-3xl opacity-80"
            />

            {/* Showcase Mockup Frame */}
            <div className="relative w-full rounded-xl sm:rounded-2xl border border-border/80 bg-card/50 p-2 sm:p-2.5 shadow-2xl backdrop-blur-sm group transition-all duration-300 hover:border-brand/40 flex items-center justify-center">
              {/* Floating Pill 1 (top-start) */}
              <div className="absolute -top-3 start-4 sm:start-8 z-10 hidden sm:inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/95 px-3 py-1 text-[10px] sm:text-[11px] font-semibold text-foreground shadow-lg backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span>{t("geofencePrecision")}</span>
              </div>

              {/* Floating Pill 2 (bottom-end) */}
              <div className="absolute -bottom-3 end-4 sm:end-8 z-10 hidden sm:inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/95 px-3 py-1 text-[10px] sm:text-[11px] font-semibold text-foreground shadow-lg backdrop-blur-md">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>{t("biometricSecurity")}</span>
              </div>

              <img
                src={heroDashboardImg}
                alt="INT-HR Employee and Admin Experience"
                className="w-full h-auto max-h-[50vh] xl:max-h-[56vh] 2xl:max-h-[62vh] rounded-lg sm:rounded-xl border border-border/40 object-contain shadow-inner"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width={1920}
                height={1072}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Full-Width Compact Footer */}
      <footer className="shrink-0 w-full border-t border-border/60 bg-card/30 backdrop-blur-sm px-4 sm:px-8 md:px-12 lg:px-16 2xl:px-24 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] sm:text-xs text-muted-foreground">
        <span>© 2026 INT-HR App Developer : Mr.Hafez Rahim</span>
        <div className="flex items-center gap-4">
          <span>v1.0 • Built for mobile, tablet, and web</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All Systems Operational
          </span>
        </div>
      </footer>
    </div>
  );
}
