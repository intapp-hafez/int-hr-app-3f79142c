import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Wifi, ShieldCheck, Smartphone } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { InstallButton } from "@/components/InstallButton";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import heroDashboardAsset from "@/assets/hero-dashboard.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INT-HR App — Secure Employee Attendance" },
      { name: "description", content: "GPS geo-fencing, authorized network validation, leave management, and real-time reporting for modern workforces." },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, dir } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <AppLogo />
        <div className="flex items-center gap-2">
          <InstallButton variant="ghost" />
          <LanguageToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Geo-fenced • Network-verified
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              {t("appName")}.<br />
              <span className="text-brand">Attendance that can't be faked.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">{t("tagline")}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/employee"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <Smartphone className="h-4 w-4" />
                {t("continueAs")} {t("employee")}
                <ArrowRight className="h-4 w-4 rtl-flip transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:-translate-y-0.5"
              >
                {t("continueAs")} {t("administrator")}
                <ArrowRight className="h-4 w-4 rtl-flip" />
              </Link>
            </div>

            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: MapPin, label: "GPS Geo-Fencing" },
                { icon: Wifi, label: "Wi-Fi / IP Verified" },
                { icon: ShieldCheck, label: "Audit-grade Logs" },
              ].map((f) => (
                <li key={f.label} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-sm shadow-soft">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-foreground">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hero dashboard image */}
          <div className="relative mx-auto w-full">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-3xl" />
            <img
              src={heroDashboardAsset.url}
              alt="INT-HR mobile attendance dashboard showing working hours, GPS status, network status, and check-out"
              className="w-full rounded-2xl border border-border bg-card shadow-brand"
              loading="eager"
              width={1920}
              height={1072}
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
          <span>© 2026 INT-HR App Developer : Mr.Hafez Rahim</span>
          <span>v1.0 • Built for mobile, tablet, and web</span>
        </div>
      </footer>
    </div>
  );
}
