/**
 * SPA shim for @tanstack/react-start
 *
 * Replaces the TanStack Start server-function runtime for a pure browser SPA
 * build. Instead of POSTing to a server endpoint, handlers are called directly
 * in-process on the client. Auth/data access must use the Supabase JS client
 * (RLS-enforced) rather than a server-side admin client.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── createServerFn ──────────────────────────────────────────────────────────
// Returns a fluent builder. The final .handler(fn) call returns a callable
// that invokes fn({ data, context }) directly in the browser with active auth.
export function createServerFn(_opts?: { method?: string }) {
  const builder: any = {
    middleware: (_mw: any[]) => builder,
    validator: (_v: any) => builder,
    inputValidator: (_v: any) => builder,
    outputValidator: (_v: any) => builder,
    handler: (fn: (...args: any[]) => any) => {
      const caller = async (input?: any) => {
        // TanStack Start callers pass either { data: X } or just X.
        const data = input != null && typeof input === "object" && "data" in input
          ? input.data
          : input;

        // Resolve context dynamically on the client using the browser's auth session
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id ?? null;
        let roles: string[] = [];
        if (userId) {
          const { data: roleRows, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (error) throw new Error(error.message);
          roles = (roleRows ?? []).map((row: { role: string }) => row.role);
        }
        const context = {
          supabase,
          userId,
          claims: sessionData.session?.user ?? {},
          roles,
        };

        return fn({ data, context });
      };
      // Attach a stub url so any code that inspects .url doesn't throw.
      return Object.assign(caller, { url: "" });
    },
  };
  return builder;
}

// ─── useServerFn ─────────────────────────────────────────────────────────────
// In SSR mode this wraps a server-fn into a React mutation hook.
// In SPA mode the function is already callable — return it as-is.
export const useServerFn = <T extends (...args: any[]) => any>(fn: T): T => fn;

// ─── Middleware helpers ───────────────────────────────────────────────────────
export const createMiddleware = (_opts?: any) => {
  const builder: any = {
    middleware: (_mw: any[]) => builder,
    server: (fn: any) => fn,
    client: (fn: any) => fn,
  };
  return builder;
};

// ─── createStart / server utilities ──────────────────────────────────────────
// These are only used in src/start.ts (server entry) — never imported by
// client code, but shimmed to prevent any accidental bundler resolution.
export const createStart = (_factory?: any) => ({});
export const getRequest = () => null;
export const getHeaders = () => ({} as Record<string, string>);
export const getCookie = (_name: string) => undefined as string | undefined;
export const setCookie = () => {};
export const deleteCookie = () => {};
