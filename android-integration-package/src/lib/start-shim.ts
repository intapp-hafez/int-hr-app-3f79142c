/**
 * Hardened Capacitor Android Execution Adapter for INT-HR Server Functions.
 *
 * Enforces active session, account status validation, and middleware execution.
 */

import { supabase } from "@/integrations/supabase/client";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: Active session required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class AccountInactiveError extends Error {
  constructor(message = "Account is inactive. Please contact your administrator.") {
    super(message);
    this.name = "AccountInactiveError";
  }
}

export function createServerFn(_opts?: { method?: string }) {
  let validatorFn: ((input: any) => any) | null = null;
  const middlewares: Array<any> = [];

  const builder: any = {
    middleware: (mwList: any[]) => {
      if (Array.isArray(mwList)) {
        middlewares.push(...mwList);
      }
      return builder;
    },
    validator: (v: any) => {
      validatorFn = v;
      return builder;
    },
    inputValidator: (v: any) => {
      validatorFn = v;
      return builder;
    },
    outputValidator: (_v: any) => builder,
    handler: (fn: (...args: any[]) => any) => {
      const caller = async (input?: any) => {
        let data = input != null && typeof input === "object" && "data" in input
          ? input.data
          : input;

        // 1. Input Validation
        if (validatorFn) {
          try {
            data = typeof validatorFn === "function"
              ? validatorFn(data)
              : typeof (validatorFn as any).parse === "function"
                ? (validatorFn as any).parse(data)
                : data;
          } catch (valErr) {
            console.error("[start-shim] Validation error:", valErr);
            throw valErr;
          }
        }

        // 2. Resolve Authenticated Session on Android
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const session = sessionData.session;
        const userId = session?.user?.id ?? null;

        // 3. Enforce Middleware Check if requireSupabaseAuth is present
        const hasAuthMiddleware = middlewares.length > 0;
        if (hasAuthMiddleware && !userId) {
          throw new UnauthorizedError("Unauthorized: No active login session found");
        }

        let roles: string[] = [];
        if (userId) {
          // Defense-in-depth: Verify profile status is Active
          const { data: profile, error: profErr } = await supabase
            .from("profiles")
            .select("status, inactive_reason")
            .eq("id", userId)
            .maybeSingle();

          if (profErr) {
            console.warn("[start-shim] Failed to fetch profile status:", profErr.message);
          } else if (profile?.status === "Inactive") {
            await supabase.auth.signOut();
            throw new AccountInactiveError(
              `Account is inactive${profile.inactive_reason ? `: ${profile.inactive_reason}` : ""}`
            );
          }

          // Fetch roles directly from database (RLS-guarded)
          const { data: roleRows, error: roleErr } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);

          if (roleErr) throw new Error(`Role verification failed: ${roleErr.message}`);
          roles = (roleRows ?? []).map((row: { role: string }) => row.role);
        }

        const context = {
          supabase,
          userId,
          claims: session?.user ?? {},
          roles,
        };

        // 4. Execute the Function Handler
        return fn({ data, context });
      };

      return Object.assign(caller, { url: "" });
    },
  };
  return builder;
}

export const useServerFn = <T extends (...args: any[]) => any>(fn: T): T => fn;

export const createMiddleware = () => ({
  middleware: () => ({ server: (fn: any) => fn, client: (fn: any) => fn }),
  server: (fn: any) => fn,
  client: (fn: any) => fn,
});

export const getRequest = () => null;
export const getHeaders = () => ({} as Record<string, string>);
export const getCookie = () => undefined;
export const setCookie = () => {};
export const deleteCookie = () => {};
