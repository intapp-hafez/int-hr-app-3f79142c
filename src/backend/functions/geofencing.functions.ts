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
  radius_m?: number | null;
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

export const bulkCreateGeofencesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        locations: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(80),
              lat: z.number().min(-90).max(90),
              lng: z.number().min(-180).max(180),
              radius_m: z.number().int().min(10).max(5000).default(100),
              active: z.boolean().default(true),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = data.locations.map((loc) => ({
      ...loc,
      created_by: userId,
    }));
    const { data: rows, error } = await (supabase.from("geofence_locations") as any)
      .insert(payload)
      .select("id");
    if (error) throw new Error(error.message);
    return { count: (rows ?? []).length };
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
    const [{ data: emps, error: e1 }, assignedRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, emp_code, departments:department_id(name_en)")
        .eq("status", "Active")
        .order("full_name", { ascending: true })
        .limit(500),
      supabase
        .from("geofence_assignments")
        .select("profile_id, radius_m")
        .eq("location_id", data.locationId),
    ]);
    if (e1) throw new Error(e1.message);

    let assignedRows: any[] = [];
    if (assignedRes.error) {
      // Fallback if radius_m column is not yet present
      const fallback = await supabase
        .from("geofence_assignments")
        .select("profile_id")
        .eq("location_id", data.locationId);
      if (fallback.error) throw new Error(fallback.error.message);
      assignedRows = fallback.data ?? [];
    } else {
      assignedRows = assignedRes.data ?? [];
    }

    const assignMap = new Map<string, { radius_m: number | null }>();
    for (const a of assignedRows) {
      assignMap.set(a.profile_id, { radius_m: a.radius_m != null ? Number(a.radius_m) : null });
    }

    return (emps ?? []).map((p: any) => {
      const info = assignMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name ?? "—",
        emp_code: p.emp_code ?? null,
        department: p.departments?.name_en ?? null,
        assigned: !!info,
        radius_m: info ? info.radius_m : null,
      };
    });
  });

export const toggleGeofenceAssignment = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        locationId: z.string().uuid(),
        profileId: z.string().uuid(),
        assign: z.boolean(),
        radius_m: z.number().int().min(10).max(10000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.assign) {
      const payload: any = {
        location_id: data.locationId,
        profile_id: data.profileId,
        assigned_by: userId,
      };
      if (data.radius_m !== undefined) {
        payload.radius_m = data.radius_m;
      }
      const { error } = await (supabase.from("geofence_assignments") as any).insert(payload);
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
        // Fallback without radius_m if column does not exist yet
        if (`${error.message}`.toLowerCase().includes("radius_m")) {
          delete payload.radius_m;
          const retry = await (supabase.from("geofence_assignments") as any).insert(payload);
          if (retry.error && !`${retry.error.message}`.toLowerCase().includes("duplicate")) {
            throw new Error(retry.error.message);
          }
        } else {
          throw new Error(error.message);
        }
      }
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

export const updateGeofenceAssignmentRadius = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        locationId: z.string().uuid(),
        profileId: z.string().uuid(),
        radius_m: z.number().int().min(10).max(10000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await (supabase.from("geofence_assignments") as any)
      .update({ radius_m: data.radius_m })
      .eq("location_id", data.locationId)
      .eq("profile_id", data.profileId);
    if (error) throw new Error(error.message);
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