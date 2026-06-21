import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LeaveSubmitSchema, LeaveDecideSchema } from "../schemas";

export const submitLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => LeaveSubmitSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Resolve requires_proof from the admin-managed leave type when possible.
    let requiresProof = false;
    if (data.leave_type_id) {
      const { data: lt } = await context.supabase
        .from("leave_types").select("requires_proof, name").eq("id", data.leave_type_id).maybeSingle();
      requiresProof = !!lt?.requires_proof;
    }
    if (requiresProof && !data.proof_url) {
      throw new Error("A doctor proof attachment is required for this leave type.");
    }
    if (data.proof_url) {
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!data.proof_mime || !allowed.includes(data.proof_mime.toLowerCase())) {
        throw new Error("Proof must be a PDF, PNG, or JPEG file.");
      }
      // Enforce 1.5 MB on the decoded payload (data URL base64 length → bytes).
      const b64 = data.proof_url.includes(",") ? data.proof_url.split(",", 2)[1] : data.proof_url;
      const decodedBytes = Math.floor((b64.replace(/=+$/g, "").length * 3) / 4);
      if (decodedBytes > 1.5 * 1024 * 1024) {
        throw new Error("Proof file must be 1.5 MB or smaller.");
      }
    }
    const { error, data: row } = await context.supabase.from("leaves").insert({
      employee_id: context.userId,
      leave_type_id: data.leave_type_id ?? null,
      leave_type_name: data.leave_type_name ?? null,
      start_date: data.start_date,
      end_date: data.end_date,
      days: data.days,
      paid: data.paid,
      reason: data.reason ?? null,
      status: "pending",
      proof_url: data.proof_url ?? null,
      proof_mime: data.proof_mime ?? null,
      proof_name: data.proof_name ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const decideLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => LeaveDecideSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leaves").update({
      status: data.status,
      decided_by: context.userId,
      decided_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyLeaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("leaves")
      .select("*").eq("employee_id", context.userId)
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAllLeaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("leaves")
      .select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type AdminLeaveRow = {
  id: string;
  employee_name: string;
  leave_type_name: string | null;
  start_date: string;
  end_date: string;
  days: number | null;
  paid: boolean | null;
  reason: string | null;
  status: string;
  proof_url: string | null;
  proof_mime: string | null;
  proof_name: string | null;
};

export const listAllLeavesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminLeaveRow[]> => {
    const { data, error } = await context.supabase
      .from("leaves")
      .select("id, leave_type_name, start_date, end_date, days, paid, reason, status, proof_url, proof_mime, proof_name, profiles:employee_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      employee_name: r.profiles?.full_name ?? "—",
      leave_type_name: r.leave_type_name,
      start_date: r.start_date,
      end_date: r.end_date,
      days: r.days,
      paid: r.paid,
      reason: r.reason,
      status: r.status,
      proof_url: r.proof_url ?? null,
      proof_mime: r.proof_mime ?? null,
      proof_name: r.proof_name ?? null,
    }));
  });

export const cancelLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leaves").update({ status: "cancelled" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public to any authenticated user — returns active leave types from the
// admin-managed catalog so employees/managers see the same list.
export const listActiveLeaveTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leave_types")
      .select("id, name, paid, annual_days, requires_proof")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });