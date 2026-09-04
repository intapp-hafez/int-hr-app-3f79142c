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
    
    const tasks = data ?? [];
    if (tasks.length > 0) {
      const taskIds = tasks.map((t: any) => t.id);
      const [{ data: acts }, { data: dists }, { data: cities }] = await Promise.all([
        context.supabase
          .from("task_activity")
          .select("id, task_id, kind, occurred_at, note, employee_id")
          .in("task_id", taskIds),
        context.supabase
          .from("districts")
          .select("id, city_id, name_en, name_ar"),
        context.supabase
          .from("cities")
          .select("id, name_en, name_ar"),
      ]);
      
      const cityMap = new Map((cities ?? []).map((c: any) => [c.id, c.name_en]));
      const distToCity = new Map<string, { city: string; district: string }>();
      for (const d of (dists ?? [])) {
        const cName = cityMap.get(d.city_id);
        if (cName) {
          distToCity.set(d.name_en.toLowerCase(), { city: cName, district: d.name_en });
          if (d.name_ar) distToCity.set(d.name_ar.toLowerCase(), { city: cName, district: d.name_en });
          distToCity.set(d.id, { city: cName, district: d.name_en });
        }
      }

      if (acts && acts.length > 0) {
        const byTask = new Map<string, any[]>();
        for (const a of acts) {
          if (!a.task_id) continue;
          const arr = byTask.get(a.task_id) ?? [];
          arr.push(a);
          byTask.set(a.task_id, arr);
        }
        for (const t of tasks) {
          (t as any).task_activity = byTask.get(t.id) ?? [];
        }
      }

      for (const t of tasks) {
        if (!t.city && t.district) {
          const match = distToCity.get(t.district.toLowerCase()) || distToCity.get(t.district);
          if (match) {
            t.city = match.city;
            t.district = match.district;
          }
        } else if (t.city && cityMap.has(t.city)) {
          t.city = cityMap.get(t.city);
        }
      }
    }
    
    return tasks;
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
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      radius_m: data.radius_m ?? null,
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

export const updateTaskAssignees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    assignees: z.array(z.string().uuid()).min(1).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({ assignees: data.assignees })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });