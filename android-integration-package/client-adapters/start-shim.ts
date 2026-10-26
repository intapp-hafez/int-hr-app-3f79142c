/**
 * Capacitor Android Client Execution Adapter for INT-HR Server Functions.
 *
 * TanStack React Start's `createServerFn` handlers are executed directly
 * in the client process, populating the context from the authenticated
 * Supabase session and `user_roles` database table.
 */

import { supabase } from "./supabase.client";

export function createServerFn(_opts?: { method?: string }) {
  let validatorFn: ((input: any) => any) | null = null;
  const builder: any = {
    middleware: (_mw: any[]) => builder,
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

        if (validatorFn) {
          data = typeof validatorFn === "function"
            ? validatorFn(data)
            : typeof (validatorFn as any).parse === "function"
              ? (validatorFn as any).parse(data)
              : data;
        }

        // Dynamically resolve session and roles on the Android client
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
