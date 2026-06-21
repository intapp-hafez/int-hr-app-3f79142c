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