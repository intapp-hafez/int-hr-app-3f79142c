import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { z } from "zod";

export type GeofenceLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  active: boolean;
  assigned_count: number;
};

export type AssignableEmployee = {
  id: string;
  full_name: string;
  emp_code: string | null;
  department: string | null;
  assigned: boolean;
};

export const listGeofencesAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<GeofenceLocation[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("geofence_locations")
      .select("id, name, lat, lng, radius_m, active, geofence_assignments(profile_id)")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      lat: Number(r.lat),
      lng: Number(r.lng),
      radius_m: r.radius_m,
      active: !!r.active,
      assigned_count: Array.isArray(r.geofence_assignments) ? r.geofence_assignments.length : 0,
    }));
  });

export const createGeofenceAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius_m: z.number().int().min(10).max(5000).default(100),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase.from("geofence_locations") as any)
      .insert({ ...data, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateGeofenceAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        radius_m: z.number().int().min(10).max(5000).optional(),
        active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await (supabase.from("geofence_locations") as any).update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGeofenceAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("geofence_locations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAssignableEmployees = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ locationId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<AssignableEmployee[]> => {
    const { supabase } = context;
    const [{ data: emps, error: e1 }, { data: assigned, error: e2 }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, emp_code, departments:department_id(name_en)")
        .eq("status", "Active")
        .order("full_name", { ascending: true })
        .limit(500),
      supabase.from("geofence_assignments").select("profile_id").eq("location_id", data.locationId),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    const set = new Set((assigned ?? []).map((a: any) => a.profile_id));
    return (emps ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name ?? "—",
      emp_code: p.emp_code ?? null,
      department: p.departments?.name_en ?? null,
      assigned: set.has(p.id),
    }));
  });

export const toggleGeofenceAssignment = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        locationId: z.string().uuid(),
        profileId: z.string().uuid(),
        assign: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.assign) {
      const { error } = await (supabase.from("geofence_assignments") as any).insert({
        location_id: data.locationId,
        profile_id: data.profileId,
        assigned_by: userId,
      });
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("geofence_assignments")
        .delete()
        .eq("location_id", data.locationId)
        .eq("profile_id", data.profileId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const bulkAssignGeofences = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        locationIds: z.array(z.string().uuid()).min(1).max(100),
        profileIds: z.array(z.string().uuid()).min(1).max(500),
        assign: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.assign) {
      const rows = data.locationIds.flatMap((lid) =>
        data.profileIds.map((pid) => ({ location_id: lid, profile_id: pid, assigned_by: userId })),
      );
      const { error } = await (supabase.from("geofence_assignments") as any)
        .upsert(rows, { onConflict: "location_id,profile_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      return { ok: true, count: rows.length };
    } else {
      const { error } = await supabase
        .from("geofence_assignments")
        .delete()
        .in("location_id", data.locationIds)
        .in("profile_id", data.profileIds);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
  });

export const listAllAssignableEmployees = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<AssignableEmployee[]> => {
    const { supabase } = context;
    const { data: emps, error } = await supabase
      .from("profiles")
      .select("id, full_name, emp_code, departments:department_id(name_en)")
      .eq("status", "Active")
      .order("full_name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (emps ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name ?? "—",
      emp_code: p.emp_code ?? null,
      department: p.departments?.name_en ?? null,
      assigned: false,
    }));
  });