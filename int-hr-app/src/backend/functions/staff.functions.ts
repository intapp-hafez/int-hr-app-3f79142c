import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStaffAccess } from "@/integrations/supabase/admin-auth-middleware";
import { AdminAttendanceSchema, LeaveDecideSchema } from "../schemas";

function combineDateTime(date: string, time?: string | null): string | null {
  if (!time) return null;
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${t}`).toISOString();
}

// ── Attendance management (approve / edit) ───────────────
export const staffListAttendance = createServerFn({ method: "POST" })
  .middleware([requireStaffAccess])
  .inputValidator((i) =>
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      employeeIds: z.array(z.string().uuid()).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("attendance")
      .select(
        "id, employee_id, date, in_time, out_time, branch, status, note, city, district, street, profiles:employee_id(full_name, email)",
      )
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: false })
      .limit(2000);
    if (data.employeeIds?.length) q = q.in("employee_id", data.employeeIds);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      employee_id: r.employee_id as string,
      employee_name: (r.profiles?.full_name ?? r.profiles?.email ?? r.employee_id) as string,
      date: r.date as string,
      in_time: r.in_time as string | null,
      out_time: r.out_time as string | null,
      branch: r.branch as string | null,
      status: r.status as string,
      note: r.note as string | null,
    }));
  });

export const staffUpsertAttendance = createServerFn({ method: "POST" })
  .middleware([requireStaffAccess])
  .inputValidator((i) => AdminAttendanceSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      employee_id: data.employee_id,
      date: data.date,
      in_time: combineDateTime(data.date, data.in_time),
      out_time: combineDateTime(data.date, data.out_time),
      branch: data.branch || null,
      status: data.status,
      note: data.note || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("attendance").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("attendance")
      .upsert(payload, { onConflict: "employee_id,date" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const staffApproveAttendance = createServerFn({ method: "POST" })
  .middleware([requireStaffAccess])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["present", "late", "absent", "leave"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("attendance")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffListEmployees = createServerFn({ method: "GET" })
  .middleware([requireStaffAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id as string,
      name: (r.full_name ?? r.email ?? r.id) as string,
      email: (r.email ?? null) as string | null,
    }));
  });

// ── Leave approvals ──────────────────────────────────────
export const staffListLeaves = createServerFn({ method: "GET" })
  .middleware([requireStaffAccess])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leaves")
      .select(
        "id, employee_id, leave_type_id, leave_type_name, start_date, end_date, days, paid, reason, status, proof_url, proof_mime, proof_name, created_at, profiles:employee_id(full_name, email), leave_types:leave_type_id(requires_proof)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id as string,
      employee_id: r.employee_id as string,
      employee_name: (r.profiles?.full_name ?? r.profiles?.email ?? "—") as string,
      employee_email: (r.profiles?.email ?? null) as string | null,
      leave_type_id: (r.leave_type_id ?? null) as string | null,
      leave_type_name: r.leave_type_name as string | null,
      start_date: r.start_date as string,
      end_date: r.end_date as string,
      days: r.days as number | null,
      paid: r.paid as boolean | null,
      reason: r.reason as string | null,
      status: r.status as string,
      proof_url: (r.proof_url ?? null) as string | null,
      proof_mime: (r.proof_mime ?? null) as string | null,
      proof_name: (r.proof_name ?? null) as string | null,
      requires_proof: !!r.leave_types?.requires_proof,
    }));
  });

export const staffDecideLeave = createServerFn({ method: "POST" })
  .middleware([requireStaffAccess])
  .inputValidator((i) => LeaveDecideSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Fetch leave row for notification details
    const { data: leave, error: leaveErr } = await context.supabase
      .from("leaves")
      .select("id, employee_id, leave_type_id, leave_type_name, start_date, end_date, proof_url, proof_mime")
      .eq("id", data.id)
      .maybeSingle();
    if (leaveErr) throw new Error(leaveErr.message);
    if (!leave) throw new Error("Leave request not found");

    // Re-validate proof on approval against the admin-managed leave type.
    if (data.status === "approved") {
      let requiresProof = false;
      if (leave.leave_type_id) {
        const { data: lt } = await context.supabase
          .from("leave_types").select("requires_proof").eq("id", leave.leave_type_id).maybeSingle();
        requiresProof = !!lt?.requires_proof;
      }
      if (requiresProof && !leave.proof_url) {
        throw new Error("Cannot approve: a doctor proof attachment is required for this leave type.");
      }
      if (leave.proof_url) {
        const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
        if (!leave.proof_mime || !allowed.includes(leave.proof_mime.toLowerCase())) {
          throw new Error("Cannot approve: proof must be a PDF, PNG, or JPEG file.");
        }
        const b64 = leave.proof_url.includes(",") ? leave.proof_url.split(",", 2)[1] : leave.proof_url;
        const decodedBytes = Math.floor((b64.replace(/=+$/g, "").length * 3) / 4);
        if (decodedBytes > 1.5 * 1024 * 1024) {
          throw new Error("Cannot approve: proof file exceeds 1.5 MB.");
        }
      }
    }

    const { error } = await context.supabase
      .from("leaves")
      .update({
        status: data.status,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Send in-app notification via admin client (bypass RLS for notif insert)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", leave.employee_id)
        .maybeSingle();
      const label = leave.leave_type_name ?? "Leave";
      const subject =
        data.status === "approved"
          ? `${label} request approved`
          : data.status === "rejected"
          ? `${label} request rejected`
          : `${label} request cancelled`;
      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: leave.employee_id,
        recipient: profile?.email ?? "",
        channel: "inapp",
        status: "delivered",
        subject,
        payload: {
          kind: "leave_decision",
          leave_id: leave.id,
          status: data.status,
          start_date: leave.start_date,
          end_date: leave.end_date,
          leave_type_name: leave.leave_type_name,
        },
      });
    } catch (e) {
      console.error("[staffDecideLeave] notification insert failed", e);
    }
    return { ok: true };
  });