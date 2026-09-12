import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkdayTimelineItem = {
  id: string;
  type: "sign_in" | "start_task" | "complete_task" | "start_travel" | "complete_travel" | "sign_out";
  time: string;
  title: string;
  subtitle?: string;
  location?: string;
  lat?: number;
  lng?: number;
  duration_minutes?: number;
  notes?: string;
  task_id?: string;
  status?: string;
};

export type EmployeeWorkdayData = {
  employee: {
    id: string;
    full_name: string;
    emp_code: string | null;
    department: string | null;
    avatar_url: string | null;
  };
  date: string;
  attendance: {
    id?: string;
    in_time: string | null;
    out_time: string | null;
    status: string;
    duration_minutes: number;
    is_signed_in: boolean;
    is_signed_out: boolean;
  };
  metrics: {
    attendance_minutes: number;
    task_minutes: number;
    travel_minutes: number;
    break_minutes: number;
  };
  active_state: {
    type: "task" | "travel";
    id: string;
    title: string;
    started_at: string;
    elapsed_minutes: number;
    location?: string;
  } | null;
  timeline: WorkdayTimelineItem[];
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    city?: string;
    district?: string;
    address?: string;
    estimated_hours?: number;
    started_at?: string;
    completed_at?: string;
  }>;
};

export type TeamMemberTimeStatus = {
  employee_id: string;
  full_name: string;
  emp_code: string | null;
  department: string | null;
  avatar_url: string | null;
  current_status: "on_task" | "traveling" | "idle_checked_in" | "checked_out" | "not_checked_in";
  active_activity_title?: string;
  active_activity_started_at?: string;
  active_activity_elapsed_minutes?: number;
  attendance_in: string | null;
  attendance_out: string | null;
  total_attendance_minutes: number;
  total_task_minutes: number;
  total_travel_minutes: number;
  total_break_minutes: number;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_pending: number;
};

// Helper: difference in minutes between two ISO date strings
function diffMinutes(startISO: string, endISO: string): number {
  const diff = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.max(0, Math.round(diff / 60000));
}

export const getEmployeeDailyWorkday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        employeeId: z.string().uuid().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(input || {}),
  )
  .handler(async ({ data, context }): Promise<EmployeeWorkdayData> => {
    const { supabase, userId } = context;
    const targetUserId = data.employeeId || userId;
    const date = data.date || new Date().toISOString().slice(0, 10);
    const isToday = date === new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // Check authorization: self, admin, hr, or manager of this employee
    if (targetUserId !== userId) {
      const { data: callerRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (callerRoles ?? []).map((r: any) => r.role);
      const isAdminOrHr = roles.includes("admin") || roles.includes("hr");

      if (!isAdminOrHr) {
        const { data: subordinate } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", targetUserId)
          .eq("manager_id", userId)
          .maybeSingle();
        if (!subordinate) {
          throw new Error("Unauthorized to view time details for this employee");
        }
      }
    }

    // 1. Fetch employee profile & department
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, emp_code, department_id, avatar_url")
      .eq("id", targetUserId)
      .maybeSingle();

    let departmentName: string | null = null;
    if (profile?.department_id) {
      const { data: dept } = await supabase
        .from("departments")
        .select("name_en")
        .eq("id", profile.department_id)
        .maybeSingle();
      departmentName = dept?.name_en ?? null;
    }

    // 2. Fetch Attendance for this day
    const { data: attendanceRow } = await supabase
      .from("attendance")
      .select("id, in_time, out_time, status, branch, city, district")
      .eq("employee_id", targetUserId)
      .eq("date", date)
      .maybeSingle();

    // 3. Fetch task_activity logs for this employee on this date
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data: activities = [] } = await supabase
      .from("task_activity")
      .select("id, kind, task_id, task_name, occurred_at, city, district, lat, lng, note")
      .eq("employee_id", targetUserId)
      .gte("occurred_at", startOfDay)
      .lte("occurred_at", endOfDay)
      .order("occurred_at", { ascending: true });

    // 4. Fetch assigned tasks
    const { data: allTasks = [] } = await supabase
      .from("tasks")
      .select("id, title, status, priority, city, district, address, estimated_hours, started_at, completed_at, due_date")
      .contains("assignees", [targetUserId]);

    const tasksList = allTasks ?? [];

    // Build chronological timeline & intervals
    const timelineItems: WorkdayTimelineItem[] = [];

    // Add Sign-in to timeline if present
    if (attendanceRow?.in_time) {
      timelineItems.push({
        id: `att-in-${attendanceRow.id}`,
        type: "sign_in",
        time: attendanceRow.in_time,
        title: "Signed In (Workday Started)",
        location: [attendanceRow.district, attendanceRow.city, attendanceRow.branch].filter(Boolean).join(" · ") || undefined,
        status: "completed",
      });
    }

    // Process task & travel activities
    // Map pairs of start_task -> complete_task, and start_trip -> complete_trip
    let totalTaskMinutes = 0;
    let totalTravelMinutes = 0;

    let activeState: EmployeeWorkdayData["active_state"] = null;

    let currentOpenTask: { id: string; name: string; started_at: string; city?: string; district?: string } | null = null;
    let currentOpenTrip: { id: string; name: string; started_at: string; city?: string; district?: string } | null = null;

    for (const act of activities ?? []) {
      const loc = [act.district, act.city].filter(Boolean).join(" · ") || undefined;

      if (act.kind === "start_task") {
        currentOpenTask = {
          id: act.task_id || act.id,
          name: act.task_name || "Task",
          started_at: act.occurred_at,
          city: act.city || undefined,
          district: act.district || undefined,
        };
        timelineItems.push({
          id: act.id,
          type: "start_task",
          time: act.occurred_at,
          title: `Started Task: ${act.task_name || "Task"}`,
          location: loc,
          lat: act.lat ?? undefined,
          lng: act.lng ?? undefined,
          task_id: act.task_id ?? undefined,
          notes: act.note ?? undefined,
          status: "in_progress",
        });
      } else if (act.kind === "complete_task") {
        let duration = 0;
        if (currentOpenTask && (!act.task_id || act.task_id === currentOpenTask.id)) {
          duration = diffMinutes(currentOpenTask.started_at, act.occurred_at);
          currentOpenTask = null;
        }
        totalTaskMinutes += duration;
        timelineItems.push({
          id: act.id,
          type: "complete_task",
          time: act.occurred_at,
          title: `Completed Task: ${act.task_name || "Task"}`,
          duration_minutes: duration > 0 ? duration : undefined,
          location: loc,
          lat: act.lat ?? undefined,
          lng: act.lng ?? undefined,
          task_id: act.task_id ?? undefined,
          notes: act.note ?? undefined,
          status: "completed",
        });
      } else if (act.kind === "start_trip") {
        currentOpenTrip = {
          id: act.task_id || act.id,
          name: act.task_name || "Travel",
          started_at: act.occurred_at,
          city: act.city || undefined,
          district: act.district || undefined,
        };
        timelineItems.push({
          id: act.id,
          type: "start_travel",
          time: act.occurred_at,
          title: `Started Travel: ${act.task_name || "Travel to site"}`,
          location: loc,
          lat: act.lat ?? undefined,
          lng: act.lng ?? undefined,
          notes: act.note ?? undefined,
          status: "in_progress",
        });
      } else if (act.kind === "complete_trip") {
        let duration = 0;
        if (currentOpenTrip) {
          duration = diffMinutes(currentOpenTrip.started_at, act.occurred_at);
          currentOpenTrip = null;
        }
        totalTravelMinutes += duration;
        timelineItems.push({
          id: act.id,
          type: "complete_travel",
          time: act.occurred_at,
          title: `Arrived / Completed Travel: ${act.task_name || "Travel"}`,
          duration_minutes: duration > 0 ? duration : undefined,
          location: loc,
          lat: act.lat ?? undefined,
          lng: act.lng ?? undefined,
          notes: act.note ?? undefined,
          status: "completed",
        });
      }
    }

    // Check if task or trip is still active right now
    if (isToday) {
      if (currentOpenTask) {
        const elapsed = diffMinutes(currentOpenTask.started_at, nowIso);
        totalTaskMinutes += elapsed;
        activeState = {
          type: "task",
          id: currentOpenTask.id,
          title: currentOpenTask.name,
          started_at: currentOpenTask.started_at,
          elapsed_minutes: elapsed,
          location: [currentOpenTask.district, currentOpenTask.city].filter(Boolean).join(" · ") || undefined,
        };
      } else if (currentOpenTrip) {
        const elapsed = diffMinutes(currentOpenTrip.started_at, nowIso);
        totalTravelMinutes += elapsed;
        activeState = {
          type: "travel",
          id: currentOpenTrip.id,
          title: currentOpenTrip.name,
          started_at: currentOpenTrip.started_at,
          elapsed_minutes: elapsed,
          location: [currentOpenTrip.district, currentOpenTrip.city].filter(Boolean).join(" · ") || undefined,
        };
      } else {
        // Also check if any task is in_progress in the tasks table
        const runningTask = tasksList.find((t: any) => t.status === "in_progress");
        if (runningTask && runningTask.started_at) {
          const elapsed = diffMinutes(runningTask.started_at, nowIso);
          totalTaskMinutes += elapsed;
          activeState = {
            type: "task",
            id: runningTask.id,
            title: runningTask.title,
            started_at: runningTask.started_at,
            elapsed_minutes: elapsed,
            location: [runningTask.district, runningTask.city].filter(Boolean).join(" · ") || undefined,
          };
        }
      }
    }

    // Add Sign-out to timeline if present
    if (attendanceRow?.out_time) {
      timelineItems.push({
        id: `att-out-${attendanceRow.id}`,
        type: "sign_out",
        time: attendanceRow.out_time,
        title: "Signed Out (Workday Ended)",
        location: [attendanceRow.district, attendanceRow.city, attendanceRow.branch].filter(Boolean).join(" · ") || undefined,
        status: "completed",
      });
    }

    // Sort timeline chronologically
    timelineItems.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Calculate total attendance duration
    let totalAttendanceMinutes = 0;
    if (attendanceRow?.in_time) {
      const endTime = attendanceRow.out_time || (isToday ? nowIso : `${date}T17:00:00.000Z`);
      totalAttendanceMinutes = diffMinutes(attendanceRow.in_time, endTime);
    }

    // Break / idle time is the remaining time within attendance
    const combinedProductiveMinutes = totalTaskMinutes + totalTravelMinutes;
    const breakMinutes = Math.max(0, totalAttendanceMinutes - combinedProductiveMinutes);

    return {
      employee: {
        id: profile?.id ?? targetUserId,
        full_name: profile?.full_name ?? "Employee",
        emp_code: profile?.emp_code ?? null,
        department: departmentName,
        avatar_url: profile?.avatar_url ?? null,
      },
      date,
      attendance: {
        id: attendanceRow?.id,
        in_time: attendanceRow?.in_time ?? null,
        out_time: attendanceRow?.out_time ?? null,
        status: attendanceRow?.status ?? "not_checked_in",
        duration_minutes: totalAttendanceMinutes,
        is_signed_in: !!attendanceRow?.in_time,
        is_signed_out: !!attendanceRow?.out_time,
      },
      metrics: {
        attendance_minutes: totalAttendanceMinutes,
        task_minutes: totalTaskMinutes,
        travel_minutes: totalTravelMinutes,
        break_minutes: breakMinutes,
      },
      active_state: activeState,
      timeline: timelineItems,
      tasks: tasksList.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        city: t.city ?? undefined,
        district: t.district ?? undefined,
        address: t.address ?? undefined,
        estimated_hours: t.estimated_hours ?? undefined,
        started_at: t.started_at ?? undefined,
        completed_at: t.completed_at ?? undefined,
      })),
    };
  });

export const getTeamTimeOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        department: z.string().optional(),
      })
      .parse(input || {}),
  )
  .handler(async ({ data, context }): Promise<TeamMemberTimeStatus[]> => {
    const { supabase, userId } = context;
    const date = data.date || new Date().toISOString().slice(0, 10);
    const isToday = date === new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // Determine scope: admin/hr vs manager
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (callerRoles ?? []).map((r: any) => r.role);
    const isAdminOrHr = roles.includes("admin") || roles.includes("hr");

    let empQuery = (supabase.from("profiles") as any)
      .select("id, full_name, emp_code, department_id, avatar_url, manager_id");

    if (!isAdminOrHr) {
      empQuery = empQuery.eq("manager_id", userId);
    }
    if (data.department) {
      empQuery = empQuery.eq("department_id", data.department);
    }

    const { data: employees = [] } = await empQuery.order("full_name", { ascending: true });
    if (!employees || employees.length === 0) return [];

    const empIds = employees.map((e: any) => e.id);

    // Parallel fetch attendance, activities, tasks, and departments
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const [
      { data: attendanceRows = [] },
      { data: allActivities = [] },
      { data: allTasks = [] },
      { data: depts = [] },
    ] = await Promise.all([
      supabase
        .from("attendance")
        .select("employee_id, in_time, out_time, status")
        .in("employee_id", empIds)
        .eq("date", date),
      supabase
        .from("task_activity")
        .select("employee_id, kind, task_id, task_name, occurred_at, city, district")
        .in("employee_id", empIds)
        .gte("occurred_at", startOfDay)
        .lte("occurred_at", endOfDay)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("id, title, status, assignees, started_at, completed_at")
        .or(empIds.map((id: string) => `assignees.cs.{${id}}`).join(",")),
      supabase.from("departments").select("id, name_en"),
    ]);

    const deptMap = new Map((depts ?? []).map((d: any) => [d.id, d.name_en]));
    const attByEmp = new Map((attendanceRows ?? []).map((a: any) => [a.employee_id, a]));

    const actByEmp = new Map<string, any[]>();
    for (const a of allActivities ?? []) {
      const arr = actByEmp.get(a.employee_id) ?? [];
      arr.push(a);
      actByEmp.set(a.employee_id, arr);
    }

    const tasksByEmp = new Map<string, any[]>();
    for (const t of allTasks ?? []) {
      for (const assignee of t.assignees ?? []) {
        const arr = tasksByEmp.get(assignee) ?? [];
        arr.push(t);
        tasksByEmp.set(assignee, arr);
      }
    }

    return employees.map((emp: any) => {
      const att = attByEmp.get(emp.id);
      const acts = actByEmp.get(emp.id) ?? [];
      const empTasks = tasksByEmp.get(emp.id) ?? [];
      const deptName = emp.department_id ? deptMap.get(emp.department_id) ?? null : null;

      let totalTaskMinutes = 0;
      let totalTravelMinutes = 0;
      let activeTask: { name: string; started_at: string } | null = null;
      let activeTrip: { name: string; started_at: string } | null = null;

      let openTask: { started_at: string; name: string } | null = null;
      let openTrip: { started_at: string; name: string } | null = null;

      for (const a of acts) {
        if (a.kind === "start_task") {
          openTask = { started_at: a.occurred_at, name: a.task_name || "Task" };
        } else if (a.kind === "complete_task" && openTask) {
          totalTaskMinutes += diffMinutes(openTask.started_at, a.occurred_at);
          openTask = null;
        } else if (a.kind === "start_trip") {
          openTrip = { started_at: a.occurred_at, name: a.task_name || "Travel" };
        } else if (a.kind === "complete_trip" && openTrip) {
          totalTravelMinutes += diffMinutes(openTrip.started_at, a.occurred_at);
          openTrip = null;
        }
      }

      if (isToday) {
        if (openTask) {
          const el = diffMinutes(openTask.started_at, nowIso);
          totalTaskMinutes += el;
          activeTask = openTask;
        } else if (openTrip) {
          const el = diffMinutes(openTrip.started_at, nowIso);
          totalTravelMinutes += el;
          activeTrip = openTrip;
        } else {
          const running = empTasks.find((t: any) => t.status === "in_progress");
          if (running && running.started_at) {
            const el = diffMinutes(running.started_at, nowIso);
            totalTaskMinutes += el;
            activeTask = { name: running.title, started_at: running.started_at };
          }
        }
      }

      let totalAttendanceMinutes = 0;
      if (att?.in_time) {
        const endTime = att.out_time || (isToday ? nowIso : `${date}T17:00:00.000Z`);
        totalAttendanceMinutes = diffMinutes(att.in_time, endTime);
      }

      const breakMinutes = Math.max(0, totalAttendanceMinutes - (totalTaskMinutes + totalTravelMinutes));

      let currentStatus: TeamMemberTimeStatus["current_status"] = "not_checked_in";
      let activeTitle: string | undefined = undefined;
      let activeStartedAt: string | undefined = undefined;
      let activeElapsed: number | undefined = undefined;

      if (att?.out_time) {
        currentStatus = "checked_out";
      } else if (att?.in_time) {
        if (activeTask) {
          currentStatus = "on_task";
          activeTitle = activeTask.name;
          activeStartedAt = activeTask.started_at;
          activeElapsed = diffMinutes(activeTask.started_at, nowIso);
        } else if (activeTrip) {
          currentStatus = "traveling";
          activeTitle = activeTrip.name;
          activeStartedAt = activeTrip.started_at;
          activeElapsed = diffMinutes(activeTrip.started_at, nowIso);
        } else {
          currentStatus = "idle_checked_in";
        }
      }

      const tasksCompleted = empTasks.filter((t: any) => t.status === "done").length;
      const tasksInProgress = empTasks.filter((t: any) => t.status === "in_progress").length;
      const tasksPending = empTasks.filter((t: any) => t.status === "pending").length;

      return {
        employee_id: emp.id,
        full_name: emp.full_name,
        emp_code: emp.emp_code,
        department: deptName,
        avatar_url: emp.avatar_url,
        current_status: currentStatus,
        active_activity_title: activeTitle,
        active_activity_started_at: activeStartedAt,
        active_activity_elapsed_minutes: activeElapsed,
        attendance_in: att?.in_time ?? null,
        attendance_out: att?.out_time ?? null,
        total_attendance_minutes: totalAttendanceMinutes,
        total_task_minutes: totalTaskMinutes,
        total_travel_minutes: totalTravelMinutes,
        total_break_minutes: breakMinutes,
        tasks_completed: tasksCompleted,
        tasks_in_progress: tasksInProgress,
        tasks_pending: tasksPending,
      };
    });
  });

export const startTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from_location: z.string().trim().optional(),
        to_location: z.string().trim().min(1, "Destination required"),
        related_task_id: z.string().uuid().optional(),
        note: z.string().trim().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Interlock: check if another task or travel is in progress
    const { data: runningTasks } = await supabase
      .from("tasks")
      .select("id, title")
      .contains("assignees", [userId])
      .eq("status", "in_progress")
      .limit(1);

    if (runningTasks && runningTasks.length > 0) {
      throw new Error(`Cannot start travel while task "${runningTasks[0].title}" is in progress. Please complete or pause it first.`);
    }

    const { data: openActivities } = await supabase
      .from("task_activity")
      .select("id, kind, task_name")
      .eq("employee_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(1);

    if (openActivities && openActivities.length > 0 && openActivities[0].kind === "start_trip") {
      throw new Error("You already have an active travel session. Please arrive or complete it first.");
    }

    const now = new Date().toISOString();
    const destinationTitle = data.from_location
      ? `${data.from_location} → ${data.to_location}`
      : data.to_location;

    const { data: row, error } = await supabase
      .from("task_activity")
      .insert({
        employee_id: userId,
        kind: "start_trip",
        task_id: data.related_task_id ?? null,
        task_name: destinationTitle,
        occurred_at: now,
        city: data.city ?? null,
        district: data.district ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        note: data.note ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const completeTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        to_location: z.string().trim().optional(),
        note: z.string().trim().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
      })
      .parse(input || {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    // Find the latest start_trip for this user
    const { data: openTrip } = await supabase
      .from("task_activity")
      .select("id, task_id, task_name")
      .eq("employee_id", userId)
      .eq("kind", "start_trip")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tripName = data.to_location || openTrip?.task_name || "Arrived at destination";

    const { data: row, error } = await supabase
      .from("task_activity")
      .insert({
        employee_id: userId,
        kind: "complete_trip",
        task_id: openTrip?.task_id ?? null,
        task_name: tripName,
        occurred_at: now,
        city: data.city ?? null,
        district: data.district ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        note: data.note ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export type MonthlyEmployeeTimeSummary = {
  employee_id: string;
  full_name: string;
  emp_code: string | null;
  department: string | null;
  avatar_url: string | null;
  days_attended: number;
  total_attendance_minutes: number;
  total_task_minutes: number;
  total_travel_minutes: number;
  total_break_minutes: number;
  tasks_completed: number;
  productivity_rate: number;
};

export type MonthlyTimeReportResult = {
  year: number;
  month: number;
  rows: MonthlyEmployeeTimeSummary[];
  totals: {
    total_attendance_minutes: number;
    total_task_minutes: number;
    total_travel_minutes: number;
    total_break_minutes: number;
    total_tasks_completed: number;
    avg_productivity_rate: number;
  };
};

export const getMonthlyTimeManagementReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        year: z.number().int().min(2020).max(2035),
        month: z.number().int().min(1).max(12),
        department: z.string().optional(),
        employeeId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<MonthlyTimeReportResult> => {
    const { supabase, userId } = context;

    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (callerRoles ?? []).map((r: any) => r.role);
    const isAdminOrHr = roles.includes("admin") || roles.includes("hr");

    const startDate = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const lastDayNum = new Date(data.year, data.month, 0).getDate();
    const endDate = `${data.year}-${String(data.month).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;

    let empQuery = (supabase.from("profiles") as any)
      .select("id, full_name, emp_code, department_id, avatar_url, manager_id");

    if (!isAdminOrHr) {
      empQuery = empQuery.eq("manager_id", userId);
    }
    if (data.department) {
      empQuery = empQuery.eq("department_id", data.department);
    }
    if (data.employeeId) {
      empQuery = empQuery.eq("id", data.employeeId);
    }

    const { data: employees = [] } = await empQuery.order("full_name", { ascending: true });
    if (!employees || employees.length === 0) {
      return {
        year: data.year,
        month: data.month,
        rows: [],
        totals: {
          total_attendance_minutes: 0,
          total_task_minutes: 0,
          total_travel_minutes: 0,
          total_break_minutes: 0,
          total_tasks_completed: 0,
          avg_productivity_rate: 0,
        },
      };
    }

    const empIds = employees.map((e: any) => e.id);

    const [
      { data: attendanceRows = [] },
      { data: allActivities = [] },
      { data: allTasks = [] },
      { data: depts = [] },
    ] = await Promise.all([
      supabase
        .from("attendance")
        .select("employee_id, date, in_time, out_time")
        .in("employee_id", empIds)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("task_activity")
        .select("employee_id, kind, task_id, task_name, occurred_at")
        .in("employee_id", empIds)
        .gte("occurred_at", startIso)
        .lte("occurred_at", endIso)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("id, status, assignees, completed_at")
        .eq("status", "done")
        .gte("completed_at", startIso)
        .lte("completed_at", endIso),
      supabase.from("departments").select("id, name_en"),
    ]);

    const deptMap = new Map((depts ?? []).map((d: any) => [d.id, d.name_en]));

    const attByEmp = new Map<string, any[]>();
    for (const a of attendanceRows ?? []) {
      const arr = attByEmp.get(a.employee_id) ?? [];
      arr.push(a);
      attByEmp.set(a.employee_id, arr);
    }

    const actByEmp = new Map<string, any[]>();
    for (const act of allActivities ?? []) {
      const arr = actByEmp.get(act.employee_id) ?? [];
      arr.push(act);
      actByEmp.set(act.employee_id, arr);
    }

    const completedTasksByEmp = new Map<string, number>();
    for (const t of allTasks ?? []) {
      for (const ass of t.assignees ?? []) {
        completedTasksByEmp.set(ass, (completedTasksByEmp.get(ass) ?? 0) + 1);
      }
    }

    const nowIso = new Date().toISOString();

    const rows: MonthlyEmployeeTimeSummary[] = employees.map((emp: any) => {
      const atts = attByEmp.get(emp.id) ?? [];
      const acts = actByEmp.get(emp.id) ?? [];
      const tasksCompleted = completedTasksByEmp.get(emp.id) ?? 0;
      const deptName = emp.department_id ? deptMap.get(emp.department_id) ?? null : null;

      const attendedDaysSet = new Set(atts.filter((a: any) => a.in_time).map((a: any) => a.date));
      const daysAttended = attendedDaysSet.size;

      let totalAttendanceMinutes = 0;
      for (const a of atts) {
        if (a.in_time) {
          const end = a.out_time || (a.date === nowIso.slice(0, 10) ? nowIso : `${a.date}T17:00:00.000Z`);
          totalAttendanceMinutes += diffMinutes(a.in_time, end);
        }
      }

      let totalTaskMinutes = 0;
      let totalTravelMinutes = 0;

      let openTask: { started_at: string } | null = null;
      let openTrip: { started_at: string } | null = null;

      for (const a of acts) {
        if (a.kind === "start_task") {
          openTask = { started_at: a.occurred_at };
        } else if (a.kind === "complete_task" && openTask) {
          totalTaskMinutes += diffMinutes(openTask.started_at, a.occurred_at);
          openTask = null;
        } else if (a.kind === "start_trip") {
          openTrip = { started_at: a.occurred_at };
        } else if (a.kind === "complete_trip" && openTrip) {
          totalTravelMinutes += diffMinutes(openTrip.started_at, a.occurred_at);
          openTrip = null;
        }
      }

      const totalBreakMinutes = Math.max(0, totalAttendanceMinutes - (totalTaskMinutes + totalTravelMinutes));
      const productiveMinutes = totalTaskMinutes + totalTravelMinutes;
      const productivityRate = totalAttendanceMinutes > 0
        ? Math.min(100, Math.round((productiveMinutes / totalAttendanceMinutes) * 100))
        : 0;

      return {
        employee_id: emp.id,
        full_name: emp.full_name,
        emp_code: emp.emp_code,
        department: deptName,
        avatar_url: emp.avatar_url,
        days_attended: daysAttended,
        total_attendance_minutes: totalAttendanceMinutes,
        total_task_minutes: totalTaskMinutes,
        total_travel_minutes: totalTravelMinutes,
        total_break_minutes: totalBreakMinutes,
        tasks_completed: tasksCompleted,
        productivity_rate: productivityRate,
      };
    });

    const sumAtt = rows.reduce((s, r) => s + r.total_attendance_minutes, 0);
    const sumTask = rows.reduce((s, r) => s + r.total_task_minutes, 0);
    const sumTravel = rows.reduce((s, r) => s + r.total_travel_minutes, 0);
    const sumBreak = rows.reduce((s, r) => s + r.total_break_minutes, 0);
    const sumTasks = rows.reduce((s, r) => s + r.tasks_completed, 0);
    const avgProd = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.productivity_rate, 0) / rows.length) : 0;

    return {
      year: data.year,
      month: data.month,
      rows,
      totals: {
        total_attendance_minutes: sumAtt,
        total_task_minutes: sumTask,
        total_travel_minutes: sumTravel,
        total_break_minutes: sumBreak,
        total_tasks_completed: sumTasks,
        avg_productivity_rate: avgProd,
      },
    };
  });

