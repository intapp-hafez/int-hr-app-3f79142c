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
// ── Work Locations (employee-centric assignment) ─────────────

export type EmployeeWorkLocation = {
  location_id: string;
  name: string;
  lat: number;
  lng: number;
  location_radius_m: number;
  radius_m: number | null;
  is_default: boolean;
};

export type EmployeeWorkLocations = {
  id: string;
  full_name: string;
  emp_code: string | null;
  department: string | null;
  assignments: EmployeeWorkLocation[];
};

export const listEmployeeWorkLocations = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<{ locations: GeofenceLocation[]; employees: EmployeeWorkLocations[] }> => {
    const supabase: any = context.supabase;
    const [locRes, empRes] = await Promise.all([
      supabase.from("geofence_locations").select("id, name, lat, lng, radius_m, active").order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, emp_code, departments:department_id(name_en)")
        .eq("status", "Active")
        .order("full_name", { ascending: true })
        .limit(1000),
    ]);
    if (locRes.error) throw new Error(locRes.error.message);
    if (empRes.error) throw new Error(empRes.error.message);

    let assignRows: any[] = [];
    const full = await supabase
      .from("geofence_assignments")
      .select("profile_id, location_id, radius_m, is_default");
    if (full.error) {
      const partial = await supabase.from("geofence_assignments").select("profile_id, location_id");
      assignRows = partial.data ?? [];
    } else {
      assignRows = full.data ?? [];
    }

    const locations: GeofenceLocation[] = ((locRes.data ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      lat: Number(r.lat),
      lng: Number(r.lng),
      radius_m: Number(r.radius_m ?? 100),
      active: !!r.active,
      assigned_count: assignRows.filter((a) => a.location_id === r.id).length,
    }));
    const locMap = new Map(locations.map((l) => [l.id, l]));

    const employees: EmployeeWorkLocations[] = ((empRes.data ?? []) as any[]).map((p) => ({
      id: p.id,
      full_name: p.full_name ?? "—",
      emp_code: p.emp_code ?? null,
      department: p.departments?.name_en ?? null,
      assignments: assignRows
        .filter((a) => a.profile_id === p.id && locMap.has(a.location_id))
        .map((a) => {
          const l = locMap.get(a.location_id)!;
          return {
            location_id: l.id,
            name: l.name,
            lat: l.lat,
            lng: l.lng,
            location_radius_m: l.radius_m,
            radius_m: a.radius_m == null ? null : Number(a.radius_m),
            is_default: !!a.is_default,
          };
        }),
    }));

    return { locations, employees };
  });

export const saveEmployeeWorkLocation = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        profileId: z.string().uuid(),
        locationId: z.string().uuid(),
        radius_m: z.number().int().min(10).max(10000).nullable().optional(),
        makeDefault: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabase: any = context.supabase;
    const userId = context.userId;

    const { data: existing } = await supabase
      .from("geofence_assignments")
      .select("id")
      .eq("profile_id", data.profileId)
      .eq("location_id", data.locationId)
      .maybeSingle();

    const patch: Record<string, unknown> = {};
    if (data.radius_m !== undefined) patch.radius_m = data.radius_m;
    if (data.makeDefault) patch.is_default = true;

    if (existing) {
      if (Object.keys(patch).length) {
        const res = await supabase.from("geofence_assignments").update(patch).eq("id", existing.id);
        if (res.error && !`${res.error.message}`.includes("is_default") && !`${res.error.message}`.includes("radius_m")) {
          throw new Error(res.error.message);
        }
      }
    } else {
      const payload: any = { profile_id: data.profileId, location_id: data.locationId, assigned_by: userId, ...patch };
      const res = await supabase.from("geofence_assignments").insert(payload);
      if (res.error) {
        const retry = await supabase
          .from("geofence_assignments")
          .insert({ profile_id: data.profileId, location_id: data.locationId, assigned_by: userId });
        if (retry.error && !`${retry.error.message}`.toLowerCase().includes("duplicate")) {
          throw new Error(retry.error.message);
        }
      }
    }

    if (data.makeDefault) {
      // Only one default per employee.
      await supabase
        .from("geofence_assignments")
        .update({ is_default: false })
        .eq("profile_id", data.profileId)
        .neq("location_id", data.locationId);
    }
    return { ok: true };
  });

export const removeEmployeeWorkLocation = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({ profileId: z.string().uuid(), locationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("geofence_assignments")
      .delete()
      .eq("profile_id", data.profileId)
      .eq("location_id", data.locationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
