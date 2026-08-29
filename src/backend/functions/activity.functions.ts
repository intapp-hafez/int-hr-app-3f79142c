import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { dateRangeSchema } from "../schemas/date-range";
import { parseInput } from "../schemas/validation-error";
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
    const hrIds =
      (await supabaseAdmin.from("user_roles").select("user_id").eq("role", "hr")).data?.map(
        (r) => r.user_id,
      ) ?? [];
    const recipients = Array.from(
      new Set([...(prof?.manager_id ? [prof.manager_id] : []), ...hrIds]),
    );
    if (recipients.length > 0) {
      // fire-and-forget; we already have the row written
      await dispatchTaskNotification({
        recipientUserIds: recipients,
        employeeName: prof?.full_name || "Employee",
        kind: data.kind,
        taskName: data.task_name || "",
        occurredAt: row.occurred_at,
        city: data.city,
        district: data.district,
        note: data.note,
      });
    }
    return { id: row.id };
  });

export const listActivityRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    parseInput(
      dateRangeSchema({ maxDays: 366 }).and(
        z.object({ employeeIds: z.array(z.string().uuid()).optional() }),
      ),
      input,
    ),
  )
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
    const list = rows ?? [];
    // Enrich with the task's manager-assigned city/district so admins see
    // where the task was supposed to happen, not just what the device sent.
    const taskIds = Array.from(new Set(list.map((r: any) => r.task_id).filter(Boolean)));
    if (taskIds.length > 0) {
      const { data: taskRows } = await supabase
        .from("tasks")
        .select("id, city, district, address")
        .in("id", taskIds);
      const byId = new Map((taskRows ?? []).map((t: any) => [t.id, t]));
      return list.map((r: any) => {
        const t = r.task_id ? byId.get(r.task_id) : null;
        return {
          ...r,
          city: r.city ?? t?.city ?? null,
          district: r.district ?? t?.district ?? null,
          task_address: t?.address ?? null,
        };
      });
    }
    return list;
  });
