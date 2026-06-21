import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { TaskActivitySchema } from "../schemas";

export const logTaskActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TaskActivitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("task_activity")
      .insert({ employee_id: userId, ...data })
      .select("id, occurred_at")
      .single();
    if (error) throw new Error(error.message);

    // Dispatch notifications to the employee's manager and all HR users.
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, manager_id")
      .eq("id", userId)
      .maybeSingle();
    const { dispatchTaskNotification } = await import("../server/notification-dispatch.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hrIds = (await supabaseAdmin.from("user_roles").select("user_id").eq("role", "hr")).data?.map((r) => r.user_id) ?? [];
    const recipients = Array.from(new Set([...(prof?.manager_id ? [prof.manager_id] : []), ...hrIds]));
    if (recipients.length > 0) {
      // fire-and-forget; we already have the row written
      await dispatchTaskNotification({
        recipientUserIds: recipients,
        employeeName: prof?.full_name || "Employee",
        kind: data.kind,
        taskName: data.task_name || "",
        occurredAt: row.occurred_at,
        city: data.city, district: data.district, note: data.note,
      });
    }
    return { id: row.id };
  });

export const listActivityRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    employeeIds: z.array(z.string().uuid()).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("task_activity")
      .select("*")
      .gte("occurred_at", `${data.from}T00:00:00Z`)
      .lte("occurred_at", `${data.to}T23:59:59Z`)
      .order("occurred_at", { ascending: true })
      .limit(5000);
    if (data.employeeIds && data.employeeIds.length > 0) q = q.in("employee_id", data.employeeIds);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });