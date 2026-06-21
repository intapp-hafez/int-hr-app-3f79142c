import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TaskCreateSchema, TransitionSchema } from "../schemas";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("tasks")
      .select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getProfileNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return [] as Array<{ id: string; full_name: string | null }>;
    const { data: rows, error } = await context.supabase
      .from("profiles").select("id, full_name").in("id", data.ids);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => TaskCreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase.from("tasks").insert({
      title: data.title,
      description: data.description ?? null,
      priority: data.priority,
      due_date: data.due_date ?? null,
      due_time: data.due_time ?? null,
      city: data.city ?? null,
      district: data.district ?? null,
      address: data.address ?? null,
      estimated_hours: data.estimated_hours ?? null,
      assignees: data.assignees,
      created_by: context.userId,
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const transitionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => TransitionSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: { status: typeof data.status; started_at?: string; completed_at?: string } = { status: data.status };
    if (data.status === "in_progress") patch.started_at = now;
    if (data.status === "done") patch.completed_at = now;
    const { data: row, error } = await supabase.from("tasks").update(patch).eq("id", data.id)
      .select("id, title").single();
    if (error) throw new Error(error.message);

    const kind = data.status === "in_progress" ? "start_task"
      : data.status === "done" ? "complete_task" : null;
    if (kind) {
      const { logTaskActivity } = await import("./activity.functions");
      await (logTaskActivity as any)({
        data: {
          kind,
          task_id: row.id,
          task_name: row.title,
          city: data.city ?? null,
          district: data.district ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          note: data.note ?? null,
        },
      });
    }
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });