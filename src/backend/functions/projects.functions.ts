import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ListProjectsSchema,
  GetProjectSchema,
  DeleteProjectSchema,
  CreateProjectTaskSchema,
  UpdateProjectTaskSchema,
  DeleteProjectTaskSchema,
  AddProjectMemberSchema,
  RemoveProjectMemberSchema,
  AddProjectFileSchema,
  DeleteProjectFileSchema,
  AddProjectUpdateSchema,
} from "../schemas/projects.schema";

// ─── LIST PROJECTS ────────────────────────────────────────────────────────────
export const listCompanyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => ListProjectsSchema.parse(d || {}))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    let query = supabase
      .from("company_projects")
      .select(`
        id,
        project_code,
        name,
        description,
        project_manager_name,
        project_manager_id,
        reported_manager_name,
        reported_manager_id,
        location,
        start_date,
        end_date,
        notes,
        status,
        created_at,
        tasks:project_tasks(id, status),
        members:project_members(id)
      `)
      .order("created_at", { ascending: true });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }
    if (data.location && data.location !== "all") {
      query = query.ilike("location", `%${data.location}%`);
    }
    if (data.manager && data.manager !== "all") {
      query = query.ilike("project_manager_name", `%${data.manager}%`);
    }
    if (data.search && data.search.trim()) {
      const term = data.search.trim();
      query = query.or(`name.ilike.%${term}%,project_code.ilike.%${term}%,project_manager_name.ilike.%${term}%`);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error("[listCompanyProjects] error:", error);
      throw new Error(error.message);
    }

    // Transform into frontend representation with task completion calculation
    return (rows || []).map((row: any) => {
      const tasks = row.tasks || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t: any) => t.status === "completed").length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const membersCount = (row.members || []).length;

      return {
        id: row.id,
        code: row.project_code,
        name: row.name,
        description: row.description || "",
        projectManager: {
          name: row.project_manager_name || "Unassigned",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        },
        reportedManager: {
          name: row.reported_manager_name || "Unassigned",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        },
        employeesCount: membersCount,
        location: row.location || "Head Office",
        startDate: row.start_date || "",
        endDate: row.end_date || "",
        notes: row.notes || "",
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
        progressPercent,
        status: row.status as "ongoing" | "upcoming" | "completed" | "on_hold",
      };
    });
  });

// ─── GET SINGLE PROJECT WITH ALL SUB-ITEMS ─────────────────────────────────────
export const getCompanyProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => GetProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    // Check if input is UUID or project_code
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id);

    let query = supabase.from("company_projects").select("*");
    if (isUuid) {
      query = query.eq("id", data.id);
    } else {
      query = query.eq("project_code", data.id);
    }

    const { data: project, error } = await query.maybeSingle();
    if (error || !project) {
      throw new Error(error?.message || "Project not found");
    }

    const [tasksRes, membersRes, filesRes, updatesRes] = await Promise.all([
      supabase.from("project_tasks").select("*").eq("project_id", project.id).order("created_at", { ascending: true }),
      supabase.from("project_members").select("*").eq("project_id", project.id).order("created_at", { ascending: true }),
      supabase.from("project_files").select("*").eq("project_id", project.id).order("uploaded_at", { ascending: false }),
      supabase.from("project_updates").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
    ]);

    const tasks = (tasksRes.data || []).map((t: any, idx: number) => ({
      id: t.id,
      numericIndex: idx + 1,
      title: t.title,
      assignee: t.assignee_name || "Unassigned",
      priority: (t.priority || "MEDIUM").toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
      dueDate: t.due_date || "",
      status: t.status === "in_progress" ? "In Progress" : t.status === "completed" ? "Completed" : "Pending",
    }));

    const members = (membersRes.data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      role: m.role || "Team Member",
      department: m.department || "Operations",
      email: m.email || "",
      phone: m.phone || "",
      avatar: m.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    }));

    const files = (filesRes.data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size || "0 KB",
      type: f.type || "DOCUMENT",
      uploadedBy: f.uploaded_by_name || "Administrator",
      uploadedDate: f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "",
      url: f.url || "#",
    }));

    const updates = (updatesRes.data || []).map((u: any) => ({
      id: u.id,
      author: u.author_name,
      role: u.author_role,
      date: u.date || (u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : ""),
      title: u.title,
      content: u.content,
      avatar: u.author_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    }));

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "Completed").length;
    const inProgressTasks = tasks.filter((t) => t.status === "In Progress").length;
    const pendingTasks = tasks.filter((t) => t.status === "Pending").length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      id: project.id,
      code: project.project_code,
      name: project.name,
      description: project.description || "",
      projectManager: {
        name: project.project_manager_name,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      },
      reportedManager: {
        name: project.reported_manager_name,
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      },
      employeesCount: members.length,
      location: project.location,
      startDate: project.start_date || "",
      endDate: project.end_date || "",
      notes: project.notes || "",
      tasksCompleted: completedTasks,
      tasksTotal: totalTasks,
      progressPercent,
      status: project.status as "ongoing" | "upcoming" | "completed" | "on_hold",
      situation: {
        completedTasks,
        inProgressTasks,
        pendingTasks,
        projectEmployees: members.length,
        overallProgress: progressPercent,
      },
      keyDates: {
        startDate: project.start_date || "",
        expectedEndDate: project.end_date || "",
        remainingTime: "60 Days",
      },
      tasks,
      employees: members,
      files,
      updates,
    };
  });

// ─── CREATE PROJECT ───────────────────────────────────────────────────────────
export const createCompanyProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => CreateProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: inserted, error } = await supabase
      .from("company_projects")
      .insert({
        project_code: data.project_code,
        name: data.name,
        description: data.description || null,
        project_manager_name: data.project_manager_name,
        project_manager_id: data.project_manager_id || null,
        reported_manager_name: data.reported_manager_name,
        reported_manager_id: data.reported_manager_id || null,
        location: data.location,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        notes: data.notes || null,
        status: data.status,
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("[createCompanyProject] error:", error);
      throw new Error(error.message);
    }

    return inserted;
  });

// ─── UPDATE PROJECT ───────────────────────────────────────────────────────────
export const updateCompanyProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => UpdateProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { id, ...updates } = data;

    const { data: updated, error } = await supabase
      .from("company_projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[updateCompanyProject] error:", error);
      throw new Error(error.message);
    }

    return updated;
  });

// ─── DELETE PROJECT ───────────────────────────────────────────────────────────
export const deleteCompanyProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => DeleteProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { error } = await supabase.from("company_projects").delete().eq("id", data.id);
    if (error) {
      console.error("[deleteCompanyProject] error:", error);
      throw new Error(error.message);
    }

    return { success: true };
  });

// ─── TASKS MANAGEMENT ─────────────────────────────────────────────────────────
export const createProjectTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => CreateProjectTaskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: task, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: data.project_id,
        title: data.title,
        description: data.description || null,
        assignee_name: data.assignee_name,
        assignee_id: data.assignee_id || null,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date || null,
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return task;
  });

export const updateProjectTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => UpdateProjectTaskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { id, ...updates } = data;

    const { data: task, error } = await supabase
      .from("project_tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return task;
  });

export const deleteProjectTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => DeleteProjectTaskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { error } = await supabase.from("project_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── MEMBERS MANAGEMENT ───────────────────────────────────────────────────────
export const addProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => AddProjectMemberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: member, error } = await supabase
      .from("project_members")
      .insert({
        project_id: data.project_id,
        name: data.name,
        email: data.email || null,
        role: data.role,
        department: data.department || null,
        phone: data.phone || null,
        employee_id: data.employee_id || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return member;
  });

export const removeProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => RemoveProjectMemberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { error } = await supabase.from("project_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── FILES MANAGEMENT ─────────────────────────────────────────────────────────
export const addProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => AddProjectFileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: file, error } = await supabase
      .from("project_files")
      .insert({
        project_id: data.project_id,
        name: data.name,
        size: data.size,
        type: data.type,
        url: data.url,
        uploaded_by_name: data.uploaded_by_name,
        uploaded_by_id: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return file;
  });

export const deleteProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => DeleteProjectFileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { error } = await supabase.from("project_files").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── UPDATES MANAGEMENT ───────────────────────────────────────────────────────
export const addProjectUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => AddProjectUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: update, error } = await supabase
      .from("project_updates")
      .insert({
        project_id: data.project_id,
        title: data.title,
        content: data.content,
        author_name: data.author_name,
        author_role: data.author_role,
        date: data.date || new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        author_id: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return update;
  });
