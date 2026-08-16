import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CustodyItem = {
  id: string;
  profile_id: string;
  custody_date: string;
  name: string;
  serial_number: string | null;
  model: string | null;
  category: string | null;
  notes: string | null;
  return_date: string | null;
  return_notes: string | null;
  returned_by: string | null;
  created_at: string;
};

export const CUSTODY_CATEGORIES = [
  // IT & Electronics
  "Laptop",
  "Desktop",
  "Tablet",
  "Mobile",
  "SIM Card",
  "Printer",
  "Scanner",
  "External Hard Drive",
  "Flash Drive",
  "Monitor",
  "Keyboard & Mouse",
  "Headset",
  "Camera",
  "Projector",
  "Router / Network Device",
  // Vehicles & Transport
  "Car",
  "Motorcycle",
  "Fuel Card",
  "Vehicle Tools Kit",
  // Office & Furniture
  "Desk",
  "Chair",
  "Cabinet / Safe",
  "ID Badge",
  "Access Card",
  "Office Keys",
  "Stamp / Seal",
  // Uniforms & PPE
  "Uniform",
  "Safety Equipment",
  "Protective Gear",
  // Field & Tools
  "Tools",
  "Measuring Equipment",
  "Walkie-Talkie",
  // Financial
  "Petty Cash Box",
  "Credit Card",
  // Other
  "Other",
] as const;

export const listEmployeeCustody = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ profileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("employee_custody")
      .select("*")
      .eq("profile_id", data.profileId)
      .order("custody_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CustodyItem[];
  });

export const addEmployeeCustody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        profileId: z.string().uuid(),
        custody_date: z.string().min(1),
        name: z.string().min(1).max(200),
        serial_number: z.string().max(120).optional().nullable(),
        model: z.string().max(120).optional().nullable(),
        category: z.string().max(60).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("employee_custody")
      .insert({
        profile_id: data.profileId,
        custody_date: data.custody_date,
        name: data.name,
        serial_number: data.serial_number || null,
        model: data.model || null,
        category: data.category || null,
        notes: data.notes || null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CustodyItem;
  });

export const deleteEmployeeCustody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("employee_custody")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEmployeeCustody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        custody_date: z.string().min(1),
        name: z.string().min(1).max(200),
        serial_number: z.string().max(120).optional().nullable(),
        model: z.string().max(120).optional().nullable(),
        category: z.string().max(60).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("employee_custody")
      .update({
        custody_date: data.custody_date,
        name: data.name,
        serial_number: data.serial_number || null,
        model: data.model || null,
        category: data.category || null,
        notes: data.notes || null,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CustodyItem;
  });

export const returnEmployeeCustody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        return_date: z.string().min(1),
        returned_by: z.string().trim().max(200).optional().nullable(),
        return_notes: z.string().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("employee_custody")
      .update({
        return_date: data.return_date,
        returned_by: data.returned_by?.trim() || null,
        return_notes: data.return_notes || null,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CustodyItem;
  });
