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

      // Collect unique profile IDs from assignees, creators, and activities
      const allProfileIds = new Set<string>();
      for (const t of tasks) {
        if (Array.isArray(t.assignees)) {
          for (const aid of t.assignees) {
            if (typeof aid === "string" && aid) allProfileIds.add(aid);
          }
        }
        if (t.created_by && typeof t.created_by === "string") {
          allProfileIds.add(t.created_by);
        }
      }
      for (const a of acts ?? []) {
        if (a.employee_id) allProfileIds.add(a.employee_id);
      }

      let profRows: any[] = [];
      let deptRows: any[] = [];
      const pIds = Array.from(allProfileIds);
      if (pIds.length > 0) {
        const [{ data: profs }, { data: depts }] = await Promise.all([
          context.supabase
            .from("profiles")
            .select("id, full_name, emp_code, department_id, avatar_url")
            .in("id", pIds),
          context.supabase
            .from("departments")
            .select("id, name_en, name_ar"),
        ]);
        profRows = profs ?? [];
        deptRows = depts ?? [];
      }

      const deptMap = new Map((deptRows ?? []).map((d: any) => [d.id, d.name_en || d.name_ar]));
      const profMap = new Map<string, any>();
      for (const p of profRows) {
        profMap.set(p.id, {
          id: p.id,
          full_name: p.full_name || p.id,
          emp_code: p.emp_code || null,
          department: p.department_id ? deptMap.get(p.department_id) : null,
          avatar_url: p.avatar_url || null,
        });
      }

      if (acts && acts.length > 0) {
        const byTask = new Map<string, any[]>();
        for (const a of acts) {
          if (!a.task_id) continue;
          const p = profMap.get(a.employee_id);
          const enriched = {
            ...a,
            employee_name: p?.full_name || a.employee_id,
          };
          const arr = byTask.get(a.task_id) ?? [];
          arr.push(enriched);
          byTask.set(a.task_id, arr);
        }
        for (const t of tasks) {
          (t as any).task_activity = byTask.get(t.id) ?? [];
        }
      }

      for (const t of tasks) {
        // Attach rich assignee profiles
        const assignedList: any[] = [];
        if (Array.isArray(t.assignees)) {
          for (const aid of t.assignees) {
            const p = profMap.get(aid);
            if (p) assignedList.push(p);
            else assignedList.push({ id: aid, full_name: aid });
          }
        }
        (t as any).assignee_profiles = assignedList;
        if (t.created_by && profMap.has(t.created_by)) {
          (t as any).creator_name = profMap.get(t.created_by)?.full_name;
        }

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
    const { supabase, userId } = context;

    if (data.status === "in_progress") {
      // 1. Check if another task is already in progress for this employee
      const { data: running } = await supabase
        .from("tasks")
        .select("id, title")
        .contains("assignees", [userId])
        .eq("status", "in_progress")
        .neq("id", data.id)
        .limit(1);

      if (running && running.length > 0) {
        throw new Error(
          `Cannot start task because "${running[0].title}" is already in progress. Please complete or pause it first.`
        );
      }

      // 2. Check if active travel is in progress
      const { data: latestAct } = await supabase
        .from("task_activity")
        .select("id, kind, task_name")
        .eq("employee_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAct && latestAct.kind === "start_trip") {
        throw new Error(
          `Cannot start task while travel "${latestAct.task_name || "Travel"}" is in progress. Please arrive and complete travel first.`
        );
      }
    }

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