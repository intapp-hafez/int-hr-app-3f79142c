import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function today() { return new Date().toISOString().slice(0, 10); }

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const d = today();
    const [emp, att, lv, tk] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("attendance").select("status, out_time").eq("date", d),
      supabase.from("leaves").select("status"),
      supabase.from("tasks").select("status"),
    ]);
    const attRows = att.data ?? [];
    const present = attRows.filter((r: any) => r.status === "present").length;
    const late = attRows.filter((r: any) => r.status === "late").length;
    const checkedOut = attRows.filter((r: any) => !!r.out_time).length;
    const totalEmployees = emp.count ?? 0;
    const absent = Math.max(0, totalEmployees - attRows.length);
    const pendingLeaves = (lv.data ?? []).filter((r: any) => r.status === "pending").length;
    const onLeave = (lv.data ?? []).filter((r: any) => r.status === "approved").length;
    const openTasks = (tk.data ?? []).filter((r: any) => r.status !== "done" && r.status !== "cancelled").length;
    const doneTasks = (tk.data ?? []).filter((r: any) => r.status === "done").length;
    const attendanceRate = totalEmployees > 0 ? Math.round(((present + late) / totalEmployees) * 100) : 0;
    return { totalEmployees, present, late, absent, checkedOut, onLeave, pendingLeaves, openTasks, doneTasks, attendanceRate };
  });

export type AdminDashboardActivity = {
  id: string;
  name: string;
  action: string;
  branch: string | null;
  time: string;
};

export type AdminDashboardPendingLeave = {
  id: string;
  name: string;
  type: string;
  start: string;
  end: string;
};

export type UpcomingHoliday = {
  id: string;
  name: string;
  date: string;
  type: string;
};

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const d = today();
    const [att, lv, hol] = await Promise.all([
      supabase
        .from("attendance")
        .select("id, in_time, out_time, status, branch, employee_id, profiles:employee_id(full_name)")
        .eq("date", d)
        .order("in_time", { ascending: false })
        .limit(8),
      supabase
        .from("leaves")
        .select("id, leave_type_name, start_date, end_date, profiles:employee_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("holidays")
        .select("id, name, date, type")
        .gte("date", d)
        .order("date", { ascending: true })
        .limit(5),
    ]);
    const activity: AdminDashboardActivity[] = (att.data ?? []).map((r: any) => {
      const isOut = !!r.out_time;
      const ts = isOut ? r.out_time : r.in_time;
      return {
        id: r.id,
        name: r.profiles?.full_name ?? "—",
        action: isOut ? "Checked out" : `Checked in${r.status === "late" ? " (late)" : ""}`,
        branch: r.branch,
        time: ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      };
    });
    const pendingLeaves: AdminDashboardPendingLeave[] = (lv.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.profiles?.full_name ?? "—",
      type: r.leave_type_name ?? "Leave",
      start: r.start_date,
      end: r.end_date,
    }));
    const upcomingHolidays: UpcomingHoliday[] = (hol.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      date: r.date,
      type: r.type,
    }));
    return { activity, pendingLeaves, upcomingHolidays };
  });

export type ManagerDashboardData = {
  teamCount: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  attendanceRate: number;
  tasksOpen: number;
  tasksDone: number;
  tripsCount: number;
  pendingLeavesCount: number;
  recentLeaves: Array<{
    id: string;
    employeeName: string;
    employeeEmail: string | null;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number | null;
    reason: string | null;
    status: string;
    createdAt: string | null;
  }>;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    dueTime: string | null;
    assigneesCount: number;
  }>;
  teamPresence: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
    role: string;
    avatarUrl: string | null;
    status: "present" | "late" | "checked_out" | "on_leave" | "absent";
    inTime: string | null;
    outTime: string | null;
  }>;
};

export const getManagerDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagerDashboardData> => {
    const { supabase, userId } = context;
    const d = today();

    // 1. Resolve manager team IDs
    const { getTeamMemberIds } = await import("@/lib/team.functions");
    const { isAdmin, ids: scopedIds } = await getTeamMemberIds(supabase, userId);

    // If manager has specific direct reports/managed dept members, use them;
    // Otherwise fallback to active profiles so the manager view has real data
    let teamProfiles: any[] = [];
    if (!isAdmin && scopedIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, department_id, position_id, departments:department_id(name_en, name_ar), positions:position_id(name_en)")
        .in("id", scopedIds);
      teamProfiles = data ?? [];
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, department_id, position_id, departments:department_id(name_en, name_ar), positions:position_id(name_en)")
        .neq("id", userId)
        .eq("status", "Active")
        .limit(30);
      teamProfiles = data ?? [];
    }

    const teamIds = teamProfiles.map((p) => p.id);

    // 2. Fetch concurrent data in parallel
    const [attRes, leavesRes, tasksRes, tripsRes] = await Promise.all([
      // Today attendance
      teamIds.length > 0
        ? supabase
            .from("attendance")
            .select("id, employee_id, in_time, out_time, status")
            .eq("date", d)
            .in("employee_id", teamIds)
        : Promise.resolve({ data: [] as any[] }),
      // Leaves (pending and active)
      supabase
        .from("leaves")
        .select("id, employee_id, leave_type_name, start_date, end_date, days, reason, status, created_at, profiles:employee_id(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(100),
      // Tasks
      supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, due_time, assignees, created_by")
        .order("created_at", { ascending: false })
        .limit(50),
      // Trips
      supabase
        .from("trips")
        .select("id, status, assignee, created_by")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const attendanceRows = attRes.data ?? [];
    const allLeaves = leavesRes.data ?? [];
    const allTasks = tasksRes.data ?? [];
    const allTrips = tripsRes.data ?? [];

    // Filter leaves for this manager's team scope
    const teamLeaves = scopedIds.length > 0 && !isAdmin
      ? allLeaves.filter((l: any) => scopedIds.includes(l.employee_id))
      : allLeaves;

    const pendingLeaves = teamLeaves.filter((l: any) => l.status === "pending");

    // Filter tasks
    const relevantTasks = allTasks.filter(
      (t: any) =>
        t.created_by === userId ||
        (t.assignees ?? []).some((a: string) => a === userId || teamIds.includes(a))
    );
    const tasksOpen = relevantTasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
    const tasksDone = relevantTasks.filter((t: any) => t.status === "done").length;

    // Filter trips
    const relevantTrips = allTrips.filter(
      (tr: any) => tr.created_by === userId || tr.assignee === userId || teamIds.includes(tr.assignee)
    );

    // Compute attendance & presence map
    const attMap = new Map<string, any>();
    for (const r of attendanceRows) {
      attMap.set(r.employee_id, r);
    }

    const todayLeavesEmpIds = new Set<string>();
    for (const l of teamLeaves) {
      if (l.status === "approved" && l.start_date <= d && l.end_date >= d) {
        todayLeavesEmpIds.add(l.employee_id);
      }
    }

    let presentToday = 0;
    let lateToday = 0;

    const teamPresence: ManagerDashboardData["teamPresence"] = teamProfiles.map((p) => {
      const att = attMap.get(p.id);
      const isOnLeave = todayLeavesEmpIds.has(p.id);
      let status: "present" | "late" | "checked_out" | "on_leave" | "absent" = "absent";

      if (isOnLeave) {
        status = "on_leave";
      } else if (att) {
        if (att.out_time) {
          status = "checked_out";
        } else if (att.status === "late") {
          status = "late";
          lateToday++;
          presentToday++;
        } else {
          status = "present";
          presentToday++;
        }
      }

      return {
        id: p.id,
        name: p.full_name || p.email || "Employee",
        email: p.email || "",
        department: p.departments?.name_en ?? p.departments?.name_ar ?? "General",
        role: p.positions?.name_en || "Team Member",
        avatarUrl: p.avatar_url ?? null,
        status,
        inTime: att?.in_time ? new Date(att.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
        outTime: att?.out_time ? new Date(att.out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
      };
    });

    const teamCount = teamProfiles.length;
    const onLeaveToday = todayLeavesEmpIds.size;
    const absentToday = Math.max(0, teamCount - presentToday - onLeaveToday);
    const attendanceRate = teamCount > 0 ? Math.round((presentToday / teamCount) * 100) : 0;

    const recentLeaves = pendingLeaves.slice(0, 5).map((l: any) => ({
      id: l.id,
      employeeName: l.profiles?.full_name ?? "Employee",
      employeeEmail: l.profiles?.email ?? null,
      leaveType: l.leave_type_name ?? "Annual Leave",
      startDate: l.start_date,
      endDate: l.end_date,
      days: l.days ?? null,
      reason: l.reason ?? null,
      status: l.status,
      createdAt: l.created_at ?? null,
    }));

    const recentTasks = relevantTasks.slice(0, 5).map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority ?? "medium",
      dueDate: t.due_date ?? null,
      dueTime: t.due_time ?? null,
      assigneesCount: (t.assignees ?? []).length,
    }));

    return {
      teamCount,
      presentToday,
      absentToday,
      onLeaveToday,
      attendanceRate,
      tasksOpen,
      tasksDone,
      tripsCount: relevantTrips.length,
      pendingLeavesCount: pendingLeaves.length,
      recentLeaves,
      recentTasks,
      teamPresence,
    };
  });

export const getManagerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [tasks, trips, leaves] = await Promise.all([
      supabase.from("tasks").select("id, status, assignees, created_by"),
      supabase.from("trips").select("id, status, assignee, created_by"),
      supabase.from("leaves").select("id, status"),
    ]);
    const myTasks = (tasks.data ?? []).filter((t: any) => t.created_by === userId || (t.assignees ?? []).includes(userId));
    const myTrips = (trips.data ?? []).filter((t: any) => t.created_by === userId || t.assignee === userId);
    const open = myTasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
    const done = myTasks.filter((t: any) => t.status === "done").length;
    const pendingLeaves = (leaves.data ?? []).filter((l: any) => l.status === "pending").length;
    return { tasksOpen: open, tasksDone: done, trips: myTrips.length, pendingLeaves };
  });

export const getEmployeeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const d = today();
    const [att, lv, tk] = await Promise.all([
      supabase.from("attendance").select("in_time, out_time, status, branch").eq("employee_id", userId).eq("date", d).maybeSingle(),
      supabase.from("leaves").select("status").eq("employee_id", userId),
      supabase.from("tasks").select("id, status, assignees"),
    ]);
    const myTasks = (tk.data ?? []).filter((t: any) => (t.assignees ?? []).includes(userId));
    const open = myTasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
    const leavesCount = (lv.data ?? []).length;
    const pendingLeaves = (lv.data ?? []).filter((l: any) => l.status === "pending").length;
    return { today: att.data ?? null, tasksOpen: open, leavesCount, pendingLeaves };
  });