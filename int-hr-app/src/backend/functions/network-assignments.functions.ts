import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

async function assertAdminOrHr(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "hr");
  if (!ok) throw new Error("Forbidden");
}

export const listNetworkAssignmentsForEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ profileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("network_assignments")
      .select("network_id, networks(id, name, ssid, bssid, branch, is_active)")
      .eq("profile_id", data.profileId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => r.networks).filter(Boolean);
  });

export const setEmployeeNetworkAssignment = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({
      profileId: z.string().uuid(),
      networkId: z.string().uuid(),
      assign: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    if (data.assign) {
      const { error } = await (context.supabase.from("network_assignments") as any)
        .upsert(
          { profile_id: data.profileId, network_id: data.networkId, assigned_by: context.userId },
          { onConflict: "network_id,profile_id", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("network_assignments")
        .delete()
        .eq("profile_id", data.profileId)
        .eq("network_id", data.networkId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listGeofenceAssignmentsForEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ profileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("geofence_assignments")
      .select("location_id, geofence_locations(id, name, lat, lng, radius_m, active)")
      .eq("profile_id", data.profileId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => r.geofence_locations).filter(Boolean);
  });

export const setEmployeeGeofenceAssignment = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) =>
    z.object({
      profileId: z.string().uuid(),
      locationId: z.string().uuid(),
      assign: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    if (data.assign) {
      const { error } = await (context.supabase.from("geofence_assignments") as any)
        .upsert(
          { profile_id: data.profileId, location_id: data.locationId, assigned_by: context.userId },
          { onConflict: "location_id,profile_id", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("geofence_assignments")
        .delete()
        .eq("profile_id", data.profileId)
        .eq("location_id", data.locationId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listAllNetworks = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("networks")
      .select("id, name, ssid, bssid, branch, is_active")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAllGeofences = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("geofence_locations")
      .select("id, name, lat, lng, radius_m, active")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
  });

export const listEmployeesForAccess = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, emp_code, departments:department_id(name_en)")
      .order("full_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.full_name ?? r.email ?? r.id,
      emp_code: r.emp_code ?? null,
      department: r.departments?.name_en ?? null,
    }));
  });