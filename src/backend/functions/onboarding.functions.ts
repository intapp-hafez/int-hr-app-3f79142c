import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ensure a profile + default 'employee' role exist for the current user.
 * Backstop in case the handle_new_user trigger didn't fire (older accounts).
 */
export const ensureOnboarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as any)?.email ?? null;
    const fullName = (claims as any)?.user_metadata?.full_name ?? email ?? "";

    await supabase.from("profiles").upsert(
      { id: userId, email, full_name: fullName },
      { onConflict: "id", ignoreDuplicates: true },
    );

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roles || roles.length === 0) {
      await supabase.from("user_roles").insert({ user_id: userId, role: "employee" });
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return { profile, roles: (roleRows ?? []).map((r: { role: string }) => r.role) };
  });