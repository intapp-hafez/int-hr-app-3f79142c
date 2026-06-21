import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLogo } from "@/components/AppLogo";
import { ensureOnboarded } from "@/backend/functions/onboarding.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — INT-HR" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
      const target = roles.includes("admin") || roles.includes("hr")
        ? "/admin"
        : roles.includes("staff")
          ? "/staff"
          : roles.includes("manager")
            ? "/manager"
            : "/employee";
      if (!cancelled) navigate({ to: target, replace: true });
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Forgot password? <Link to="/" className="underline">Contact your administrator</Link>.
        </p>
      </div>
    </div>
  );
}