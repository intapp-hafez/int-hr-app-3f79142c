import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RegisterSchema = z.object({
  device_id: z.string().min(4).max(64),
  label: z.string().min(1).max(120),
  user_agent: z.string().max(500).optional().nullable(),
});

export const registerMyDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof RegisterSchema>) => RegisterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Use admin client to bypass RLS: lookup must see rows owned by other users
    // so we can return a clean ownership error instead of a unique-constraint crash.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from("employee_devices")
      .select("id,user_id,status")
      .eq("id", data.device_id)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (existing && existing.user_id !== userId) {
      throw new Error("This device is already registered to another account.");
    }
    const now = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("employee_devices")
      .upsert(
        {
          id: data.device_id,
          user_id: userId,
          label: data.label,
          user_agent: data.user_agent ?? null,
          // Preserve approval status on re-registration; new rows start pending.
          status: existing?.status ?? "pending",
          last_seen_at: now,
        },
        { onConflict: "id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employee_devices")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const removeMyDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id: string }) => z.object({ device_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employee_devices")
      .delete()
      .eq("id", data.device_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin/HR
async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: isHr } = await supabase.rpc("has_role", { _user_id: userId, _role: "hr" });
  if (!isAdmin && !isHr) throw new Error("Forbidden: admin or HR required");
}

export const listEmployeeDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("employee_devices")
      .select("*")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setEmployeeDeviceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id: string; status: "pending" | "approved" | "revoked" }) =>
    z.object({
      device_id: z.string(),
      status: z.enum(["pending", "approved", "revoked"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("employee_devices")
      .update({ status: data.status })
      .eq("id", data.device_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployeeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { device_id: string }) => z.object({ device_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("employee_devices")
      .delete()
      .eq("id", data.device_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
