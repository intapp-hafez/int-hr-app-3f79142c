import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { NamedRowSchema, DistrictRowSchema, LeaveTypeRowSchema } from "../schemas";

// ── Departments ────────────────────────────────────
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("departments").select("*").order("name_en");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => NamedRowSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("departments").upsert({
      id: data.id, name_en: data.name_en, name_ar: data.name_ar, active: data.active ?? true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("departments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Positions ──────────────────────────────────────
export const listPositions = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("positions").select("*").order("name_en");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const upsertPosition = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => NamedRowSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("positions").upsert({
      id: data.id, name_en: data.name_en, name_ar: data.name_ar, active: data.active ?? true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const deletePosition = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("positions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Cities + Districts ─────────────────────────────
export const listCitiesWithDistricts = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data: cities, error: ce } = await context.supabase.from("cities").select("*").order("name_en");
    if (ce) throw new Error(ce.message);
    const { data: districts, error: de } = await context.supabase.from("districts").select("*").order("name_en");
    if (de) throw new Error(de.message);
    return (cities ?? []).map((c) => ({
      ...c, districts: (districts ?? []).filter((d) => d.city_id === c.id),
    }));
  });
export const upsertCity = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => NamedRowSchema.omit({ active: true }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cities").upsert({
      id: data.id, name_en: data.name_en, name_ar: data.name_ar,
    });
    if (error) {
      if ((error as any).code === "23505") throw new Error(`City "${data.name_en}" already exists`);
      throw new Error(error.message);
    }
    return { ok: true };
  });
export const deleteCity = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const upsertDistrict = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => DistrictRowSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("districts").upsert({
      id: data.id, city_id: data.city_id, name_en: data.name_en, name_ar: data.name_ar,
    });
    if (error) {
      if ((error as any).code === "23505") throw new Error(`District "${data.name_en}" already exists in this city`);
      throw new Error(error.message);
    }
    return { ok: true };
  });
export const deleteDistrict = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("districts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Leave types ────────────────────────────────────
export const listLeaveTypes = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("leave_types").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const upsertLeaveType = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => LeaveTypeRowSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leave_types").upsert({
      id: data.id, name: data.name, annual_days: data.annual_days, paid: data.paid, active: data.active, requires_proof: data.requires_proof,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const deleteLeaveType = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leave_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });