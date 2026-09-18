import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, Fingerprint, ScanFace, Eye, EyeOff, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureOnboarded } from "@/backend/functions/onboarding.functions";
import {
  webauthnAuthOptions, webauthnAuthVerify,
  faceLogin,
} from "@/backend/functions/biometrics.functions";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { AppLogo } from "@/components/AppLogo";
import { FaceCapture } from "@/components/biometrics/FaceCapture";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — INT-HR" }] }),
  component: AuthPage,
});

interface SlideItem {
  src: string;
  badge: string;
  title: string;
  description: string;
}

function getSlides(t: (key: any) => string): SlideItem[] {
  return [
    {
      src: "/int-hr.png",
      badge: t("authSlide1Badge"),
      title: t("authSlide1Title"),
      description: t("authSlide1Desc"),
    },
    {
      src: "/int-hr1.png",
      badge: t("authSlide2Badge"),
      title: t("authSlide2Title"),
      description: t("authSlide2Desc"),
    },
    {
      src: "/int-hr2.png",
      badge: t("authSlide3Badge"),
      title: t("authSlide3Title"),
      description: t("authSlide3Desc"),
    },
    {
      src: "/int-hr3.png",
      badge: t("authSlide4Badge"),
      title: t("authSlide4Title"),
      description: t("authSlide4Desc"),
    },
    {
      src: "/int-hr4.png",
      badge: t("authSlide5Badge"),
      title: t("authSlide5Title"),
      description: t("authSlide5Desc"),
    },
    {
      src: "/int-hr5.png",
      badge: t("authSlide6Badge"),
      title: t("authSlide6Title"),
      description: t("authSlide6Desc"),
    },
  ];
}

function AuthImageSlider({ slides, t }: { slides: SlideItem[]; t: (k: any) => string }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, slides.length]);

  return (
    <div
      className="relative flex h-full max-h-screen w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-sidebar via-sidebar/95 to-sidebar-accent p-4 sm:p-6 lg:p-7 xl:p-8 text-sidebar-foreground select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background ambient lighting effects */}
      <div className="absolute -top-32 -end-32 h-96 w-96 rounded-full bg-brand/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -start-32 h-96 w-96 rounded-full bg-brand-accent/15 blur-3xl pointer-events-none" />

      {/* Floating Top Header */}
      <div className="relative z-10 shrink-0 flex items-center justify-between pb-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-3.5 py-1 text-xs font-semibold text-foreground backdrop-blur-md shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          {slides[current].badge}
        </span>
        <span className="text-xs font-mono text-muted-foreground bg-background/50 rounded-lg px-2.5 py-1 backdrop-blur-sm border border-border/60 shadow-sm">
          {current + 1} / {slides.length}
        </span>
      </div>

      {/* Central Immersive Showcase - Maximized Height & Width */}
      <div className="relative z-10 flex-1 min-h-0 w-full my-auto flex items-center justify-center py-1">
        <div className="relative h-full w-full max-h-[82vh] 2xl:max-h-[86vh] max-w-5xl 2xl:max-w-6xl aspect-[16/10] overflow-hidden rounded-2xl xl:rounded-3xl border border-border/80 bg-black/60 shadow-2xl backdrop-blur-md group">
          {slides.map((slide, idx) => (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-all duration-700 ease-in-out ${idx === current
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "opacity-0 scale-95 pointer-events-none"
                }`}
            >
              <img
                src={slide.src}
                alt={slide.badge}
                className="h-full w-full object-contain object-center p-1.5 sm:p-2 xl:p-3 drop-shadow-xl"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation Controls */}
      <div className="relative z-10 shrink-0 flex items-center justify-between pt-3 border-t border-border/50">
        {/* Slide Dots / Pill Indicators */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrent(idx)}
              aria-label={`${t("goToSlide")} ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${idx === current
                  ? "w-8 bg-brand shadow-sm"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
            />
          ))}
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
            aria-label={t("prevSlide")}
            className="grid h-8 w-8 xl:h-9 xl:w-9 place-items-center rounded-xl border border-border bg-background/60 text-foreground hover:bg-muted transition active:scale-95 shadow-sm backdrop-blur"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
            aria-label={t("nextSlide")}
            className="grid h-8 w-8 xl:h-9 xl:w-9 place-items-center rounded-xl border border-border bg-background/60 text-foreground hover:bg-muted transition active:scale-95 shadow-sm backdrop-blur"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileImageSlider({ slides }: { slides: SlideItem[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="lg:hidden mb-6 overflow-hidden rounded-2xl border border-border bg-muted/30 p-2.5 space-y-2 shadow-sm">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-black/50 border border-border/60">
        <img
          src={slides[current].src}
          alt={slides[current].badge}
          className="h-full w-full object-contain p-1 transition-all duration-500"
        />
        <div className="absolute top-2 start-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/75 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Sparkles className="h-3 w-3 text-brand" /> {slides[current].badge}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end px-1">
        <div className="flex items-center gap-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrent(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === current ? "w-5 bg-brand" : "w-1.5 bg-muted-foreground/30"
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthPage() {
  const { t, dir, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const slides = getSlides(t);

  const redirectTo = (() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("redirect");
    if (!raw) return null;
    // Only allow same-origin, non-auth paths
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/auth")) return null;
    // Ignore the public landing page so role-based home takes over after sign-in
    if (raw === "/" || raw === "") return null;
    return raw;
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showFace, setShowFace] = useState(false);
  const fpOptsFn = useServerFn(webauthnAuthOptions);
  const fpVerifyFn = useServerFn(webauthnAuthVerify);
  const faceLoginFn = useServerFn(faceLogin);

  useEffect(() => {
    document.title = t("authPageTitle");
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    async function redirectIfSignedIn(userId?: string) {
      if (!userId || cancelled) return;

      // Verify active account status
      const { data: prof } = await supabase
        .from("profiles")
        .select("status, inactive_reason")
        .eq("id", userId)
        .maybeSingle();

      if ((prof as any)?.status === "Inactive") {
        await supabase.auth.signOut();
        const reason = (prof as any)?.inactive_reason ? ` (${(prof as any).inactive_reason})` : "";
        toast.error(`${t("accountInactive")}${reason}`);
        return;
      }

      // Ensure profile + default role exist before routing into the app.
      let roles: string[] = [];
      try {
        const res = await ensureOnboarded();
        roles = res.roles;
      } catch {
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        roles = (roleRows ?? []).map((r: { role: string }) => r.role);
      }
      const roleHome = roles.includes("admin") || roles.includes("hr")
        ? "/admin"
        : roles.includes("finance")
          ? "/finance"
          : roles.includes("staff")
            ? "/staff"
            : roles.includes("manager")
              ? "/manager"
              : "/employee";
      if (cancelled) return;
      if (redirectTo) {
        window.location.replace(redirectTo);
      } else {
        navigate({ to: roleHome, replace: true });
      }
    }
    supabase.auth.getSession().then(({ data }) => redirectIfSignedIn(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      redirectIfSignedIn(s?.user.id);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate, t, redirectTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      // Defense-in-depth: check profile status immediately
      if (authData?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("status, inactive_reason")
          .eq("id", authData.user.id)
          .maybeSingle();

        if ((prof as any)?.status === "Inactive") {
          await supabase.auth.signOut();
          const reason = (prof as any)?.inactive_reason ? ` (${(prof as any).inactive_reason})` : "";
          toast.error(`${t("accountInactive")}${reason}`);
          return;
        }
      }

      toast.success(t("signedInSuccess"));
      // onAuthStateChange will redirect by role
    } catch (err: any) {
      const rawMsg = typeof err?.message === "string" ? err.message : "";
      const msg = rawMsg.toLowerCase();
      const code = typeof err?.code === "string" ? err.code.toLowerCase() : "";

      if (
        msg.includes("banned") ||
        msg.includes("inactive") ||
        msg.includes("disabled") ||
        code === "user_banned"
      ) {
        toast.error(t("accountInactive"));
      } else if (
        msg.includes("invalid login credentials") ||
        msg.includes("invalid_credentials") ||
        code === "invalid_credentials"
      ) {
        toast.error(t("invalidCredentials"));
      } else if (msg.includes("email not confirmed")) {
        toast.error(t("verifyEmailFirst"));
      } else if (!rawMsg || rawMsg === "{}" || rawMsg === "[object Object]") {
        toast.error(t("authFailed"));
      } else {
        toast.error(rawMsg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInWithFingerprint() {
    if (!email) return toast.error(t("enterEmailFirst"));
    setBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const options = await fpOptsFn({ data: { email } });
      const assertion = await startAuthentication({ optionsJSON: options as any });
      const session = await fpVerifyFn({ data: { email, response: assertion } });
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw error;
      toast.success(t("signedInWithFingerprint"));
    } catch (e: any) {
      const msg = e?.message?.toLowerCase() || "";
      if (msg.includes("inactive") || msg.includes("banned")) {
        toast.error(t("accountInactive"));
      } else {
        toast.error(e?.message ?? t("fingerprintSignInFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFaceCapture(descriptor: number[]) {
    setBusy(true);
    try {
      const res = await faceLoginFn({ data: { email, descriptor } });
      if (res?.access_token && res?.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (error) throw error;
        toast.success(t("signedInWithFace"));
        setShowFace(false);
        return;
      }

      // If face matched in database and password is typed in the form, sign in seamlessly
      if (res?.matched && password) {
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (authErr) throw authErr;
        toast.success(t("signedInWithFace"));
        setShowFace(false);
        return;
      }

      if (res?.matched) {
        toast.success(lang === "ar" ? "تم التحقق من الوجه بنجاح!" : "Face verified successfully!");
        setShowFace(false);
        return;
      }

      throw new Error(res?.error || t("faceSignInFailed"));
    } catch (e: any) {
      const msg = e?.message?.toLowerCase() || "";
      if (msg.includes("inactive") || msg.includes("banned")) {
        toast.error(t("accountInactive"));
      } else {
        toast.error(e?.message ?? t("faceSignInFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-background flex flex-col lg:grid lg:grid-cols-12 overflow-x-hidden lg:overflow-hidden">
      {/* Left Column: Sign-in Form (Full height, edge-to-edge container, centered inner form, no scrollbar) */}
      <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 min-h-screen lg:min-h-0 lg:h-full flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 lg:px-8 lg:py-6 xl:px-12 xl:py-8 bg-card border-b lg:border-b-0 lg:border-e border-border/80 shadow-xl lg:shadow-none z-10 overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-md mx-auto my-auto py-2">
          {/* Brand header & Language switcher */}
          <div className="mb-4 xl:mb-6 pb-3 xl:pb-4 border-b border-border/50 flex items-center justify-between gap-3">
            <Link to="/" className="group transition hover:opacity-95">
              <AppLogo size={30} badge={lang === "ar" ? "بوابة" : "Portal"} />
            </Link>

            {/* Premium segmented language selector */}
            <div className="flex items-center rounded-full border border-border/70 bg-muted/40 p-1 backdrop-blur-sm shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`flex items-center justify-center rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                  lang === "en"
                    ? "bg-brand text-brand-foreground shadow-sm shadow-brand/30 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <span className="hidden sm:inline text-[11px] tracking-wide">English</span>
                <span className="sm:hidden text-[11px] font-semibold">En</span>
              </button>
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`flex items-center justify-center rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                  lang === "ar"
                    ? "bg-brand text-brand-foreground shadow-sm shadow-brand/30 font-bold font-sans"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <span className="hidden sm:inline text-[11px]">العربية</span>
                <span className="sm:hidden text-[11px] font-semibold">Ar</span>
              </button>
            </div>
          </div>

          {/* Mobile Product Carousel (hidden on lg+) */}
          <MobileImageSlider slides={slides} />

          {/* Welcome title & subtitle */}
          <div className="text-center">
            <h1 className="font-display text-2xl xl:text-3xl font-bold tracking-tight text-foreground">
              {t("welcomeBack")}
            </h1>
            <p className="mt-1.5 text-xs xl:text-sm text-muted-foreground">
              {t("authSubtitle")}
            </p>
          </div>

          {/* Sign-in Form */}
          <form onSubmit={submit} className="mt-5 xl:mt-6 space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                {t("email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="employee@company.com"
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs sm:text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-sm transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                {t("password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 pe-11 text-xs sm:text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute end-0 top-0 grid h-full w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-xs sm:text-sm font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition disabled:opacity-60 active:scale-[0.99]"
            >
              <LogIn className="h-4 w-4 rtl:rotate-180" /> {t("signIn")}
            </button>
          </form>

          {/* Biometrics divider & options */}
          <div className="mt-4 xl:mt-5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {t("orBiometrics")} <span className="h-px flex-1 bg-border" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={signInWithFingerprint}
              disabled={busy || !email}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted px-3 py-2 text-xs font-semibold text-foreground transition disabled:opacity-60 shadow-sm"
            >
              <Fingerprint className="h-4 w-4 text-purple-500" /> {t("fingerprint")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!email) return toast.error(t("enterEmailFirst"));
                setShowFace(true);
              }}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted px-3 py-2 text-xs font-semibold text-foreground transition disabled:opacity-60 shadow-sm"
            >
              <ScanFace className="h-4 w-4 text-sky-500" /> {t("face")}
            </button>
          </div>

          <p className="mt-2 text-center text-[10px] sm:text-[11px] text-muted-foreground leading-relaxed">
            {t("biometricsEnrolmentHint")}
          </p>
        </div>

        {/* Footer Support link */}
        <div className="pt-4 border-t border-border/60 text-center text-xs text-muted-foreground w-full max-w-md mx-auto shrink-0">
          {t("needHelpSigningIn")}{" "}
          <Link to="/" className="font-semibold text-foreground underline underline-offset-4 hover:text-brand transition">
            {t("contactAdmin")}
          </Link>
        </div>
      </div>

      {/* Right Column: Full-Width Interactive Showcase Slider */}
      <div className="hidden lg:flex lg:col-span-8 xl:col-span-8 2xl:col-span-9 h-full max-h-screen overflow-hidden flex-col relative bg-gradient-to-br from-sidebar via-sidebar/95 to-sidebar-accent">
        <AuthImageSlider slides={slides} t={t} />
      </div>

      {showFace && (
        <FaceCapture mode="verify" onCapture={handleFaceCapture} onClose={() => setShowFace(false)} />
      )}
    </div>
  );
}