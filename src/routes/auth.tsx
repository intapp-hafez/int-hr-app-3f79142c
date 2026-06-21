import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, Fingerprint, ScanFace, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLogo } from "@/components/AppLogo";
import { ensureOnboarded } from "@/backend/functions/onboarding.functions";
import {
  webauthnAuthOptions, webauthnAuthVerify,
  faceLogin,
} from "@/backend/functions/biometrics.functions";
import { useServerFn } from "@tanstack/react-start";
import { FaceCapture } from "@/components/biometrics/FaceCapture";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — INT-HR" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const redirectTo = (() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("redirect");
    if (!raw) return null;
    // Only allow same-origin, non-auth paths
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/auth")) return null;
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
    let cancelled = false;
    async function redirectIfSignedIn(userId?: string) {
      if (!userId || cancelled) return;
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
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in");
      // onAuthStateChange will redirect by role
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithFingerprint() {
    if (!email) return toast.error("Enter your email first");
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
      toast.success("Signed in with fingerprint");
    } catch (e: any) {
      toast.error(e?.message ?? "Fingerprint sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFaceCapture(descriptor: number[]) {
    setBusy(true);
    try {
      const session = await faceLoginFn({ data: { email, descriptor } });
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw error;
      toast.success("Signed in with face");
      setShowFace(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Face sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-soft">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/"><AppLogo size={26} /></Link>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with your email and password.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={6}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-0 top-0 grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </button>
        </form>

        <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={signInWithFingerprint}
            disabled={busy || !email}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold disabled:opacity-60"
          >
            <Fingerprint className="h-4 w-4" /> Fingerprint
          </button>
          <button
            type="button"
            onClick={() => {
              if (!email) return toast.error("Enter your email first");
              setShowFace(true);
            }}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold disabled:opacity-60"
          >
            <ScanFace className="h-4 w-4" /> Face
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Biometrics require enrolment from <em>More → Face & fingerprint</em> after first sign-in.
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Forgot password? <Link to="/" className="underline">Contact your administrator</Link>.
        </p>
      </div>
      {showFace && (
        <FaceCapture mode="verify" onCapture={handleFaceCapture} onClose={() => setShowFace(false)} />
      )}
    </div>
  );
}