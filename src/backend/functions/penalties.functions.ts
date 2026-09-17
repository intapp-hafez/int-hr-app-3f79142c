import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const PENALTY_TYPES = [
  "Disciplinary",
  "Tardiness / Lateness",
  "Damage / Negligence",
  "Safety / Policy Violation",
  "Unauthorized Absence",
  "Misconduct",
  "Performance",
  "Other",
] as const;

export type PenaltyType = (typeof PENALTY_TYPES)[number];
export type PenaltyStatus = "pending" | "applied" | "cancelled";

export type EmployeePenalty = {
  id: string;
  employee_id: string;
  penalty_date: string;
  penalty_type: string;
  reason: string;
  is_paid: boolean;
  amount: number;
  status: PenaltyStatus;
  created_by: string | null;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * List all penalties for a specific employee
 */
export const listEmployeePenalties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<EmployeePenalty[]> => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase.from("employee_penalties") as any)
      .select(`
        id,
        employee_id,
        penalty_date,
        penalty_type,
        reason,
        is_paid,
        amount,
        status,
        created_by,
        created_at,
        updated_at,
        creator:profiles!employee_penalties_created_by_fkey(full_name)
      `)
      .eq("employee_id", data.employeeId)
      .order("penalty_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback without join in case relationship name is not cached
      const { data: fallbackRows, error: fallbackErr } = await (supabase.from("employee_penalties") as any)
        .select("*")
        .eq("employee_id", data.employeeId)
        .order("penalty_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (fallbackErr) throw new Error(fallbackErr.message);

      return (fallbackRows ?? []).map((r: any) => ({
        id: r.id,
        employee_id: r.employee_id,
        penalty_date: r.penalty_date,
        penalty_type: r.penalty_type,
        reason: r.reason,
        is_paid: !!r.is_paid,
        amount: Number(r.amount) || 0,
        status: (r.status || "pending") as PenaltyStatus,
        created_by: r.created_by,
        creator_name: null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      employee_id: r.employee_id,
      penalty_date: r.penalty_date,
      penalty_type: r.penalty_type,
      reason: r.reason,
      is_paid: !!r.is_paid,
      amount: Number(r.amount) || 0,
      status: (r.status || "pending") as PenaltyStatus,
      created_by: r.created_by,
      creator_name: r.creator?.full_name ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  });

const CreatePenaltySchema = z.object({
  employeeId: z.string().uuid(),
  penaltyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  penaltyType: z.string().min(1).max(100),
  reason: z.string().min(1, "Reason is required"),
  isPaid: z.boolean().default(false),
  amount: z.number().min(0).default(0),
  status: z.enum(["pending", "applied", "cancelled"]).default("pending"),
});

/**
 * Add a new penalty for an employee
 */
export const createEmployeePenalty = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => CreatePenaltySchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: inserted, error } = await (supabase.from("employee_penalties") as any)
      .insert({
        employee_id: data.employeeId,
        penalty_date: data.penaltyDate,
        penalty_type: data.penaltyType,
        reason: data.reason,
        is_paid: data.isPaid,
        amount: data.amount,
        status: data.status,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, penalty: inserted };
  });

const UpdatePenaltySchema = z.object({
  id: z.string().uuid(),
  penaltyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  penaltyType: z.string().min(1).max(100).optional(),
  reason: z.string().min(1).optional(),
  isPaid: z.boolean().optional(),
  amount: z.number().min(0).optional(),
  status: z.enum(["pending", "applied", "cancelled"]).optional(),
});

/**
 * Update an existing penalty
 */
export const updateEmployeePenalty = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => UpdatePenaltySchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const patch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.penaltyDate !== undefined) patch.penalty_date = data.penaltyDate;
    if (data.penaltyType !== undefined) patch.penalty_type = data.penaltyType;
    if (data.reason !== undefined) patch.reason = data.reason;
    if (data.isPaid !== undefined) patch.is_paid = data.isPaid;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.status !== undefined) patch.status = data.status;

    const { data: updated, error } = await (supabase.from("employee_penalties") as any)
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, penalty: updated };
  });

/**
 * Delete a penalty
 */
export const deleteEmployeePenalty = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const { error } = await (supabase.from("employee_penalties") as any)
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
