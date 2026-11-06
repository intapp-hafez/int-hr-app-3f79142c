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

    try {
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
        .order("created_at", { ascending: false });

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
        console.warn("[listCompanyProjects] Database query note:", error.message);
        return [];
      }

      // Transform into frontend representation with dynamic task completion calculation
      return (rows || []).map((row: any, index: number) => {
        const tasks = row.tasks || [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t: any) => t.status === "completed").length;
        const membersCount = (row.members || []).length;

        const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.project_code || "");
        let formattedCode = (!row.project_code || isRawUuid)
          ? `PROJ-${String(index + 1).padStart(3, "0")}`
          : row.project_code;
        if (/^prj-/i.test(formattedCode)) {
          formattedCode = formattedCode.replace(/^prj-/i, "PROJ-");
        }

        return {
          id: row.id,
          code: formattedCode,
          name: row.name,
          name_ar: row.name,
          projectManager: {
            name: row.project_manager_name || "Unassigned",
            avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
          },
          reportedManager: {
            name: row.reported_manager_name || "Unassigned",
            avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
          },
          employeesCount: membersCount,
          location: row.location || "Head Office",
          startDate: row.start_date || "",
          endDate: row.end_date || "",
          notes: row.notes || "",
          completedTasksCount: completedTasks,
          totalTasksCount: totalTasks,
          status: row.status as "ongoing" | "upcoming" | "completed" | "on_hold",
          employees: [],
          tasks: [],
          files: [],
          updates: [],
        };
      });
    } catch (err: any) {
      console.warn("[listCompanyProjects] Error handled:", err.message);
      return [];
    }
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

    const tasks = (tasksRes.data || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      assignee: {
        name: t.assignee_name || "Unassigned",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      priority: (t.priority || "medium") as "low" | "medium" | "high",
      dueDate: t.due_date || "",
      status: (t.status || "pending") as "completed" | "in_progress" | "pending",
    }));

    const members = (membersRes.data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      role: m.role || "Team Member",
      department: m.department || "Operations",
      email: m.email || "",
      phone: m.phone || "",
      avatarUrl: m.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    }));

    const files = (filesRes.data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size || "0 KB",
      type: (f.type ? f.type.toLowerCase() : "pdf") as "pdf" | "doc" | "image" | "sheet" | "archive",
      uploadedBy: f.uploaded_by_name || "Administrator",
      uploadedAt: f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "",
    }));

    const updates = (updatesRes.data || []).map((u: any) => ({
      id: u.id,
      author: {
        name: u.author_name,
        role: u.author_role || "Project Lead",
        avatarUrl: u.author_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      content: u.content,
      timestamp: u.date || (u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : ""),
    }));

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;

    const isCodeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project.project_code || "");
    let formattedCode = (!project.project_code || isCodeUuid) ? "PROJ-001" : project.project_code;
    if (/^prj-/i.test(formattedCode)) {
      formattedCode = formattedCode.replace(/^prj-/i, "PROJ-");
    }

    return {
      id: project.id,
      code: formattedCode,
      name: project.name,
      name_ar: project.name,
      projectManager: {
        name: project.project_manager_name,
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      reportedManager: {
        name: project.reported_manager_name,
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      },
      employeesCount: members.length,
      location: project.location,
      startDate: project.start_date || "",
      endDate: project.end_date || "",
      notes: project.notes || "",
      completedTasksCount: completedTasks,
      totalTasksCount: totalTasks,
      status: project.status as "ongoing" | "upcoming" | "completed" | "on_hold",
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

    // Insert initial members if provided
    if (inserted?.id && data.initial_members && data.initial_members.length > 0) {
      const memberRows = data.initial_members.map((m) => ({
        project_id: inserted.id,
        name: m.name,
        email: m.email || null,
        role: m.role || "Team Member",
        department: m.department || null,
        employee_id: m.employee_id || null,
      }));
      await supabase.from("project_members").insert(memberRows).catch((e: any) => console.warn("Failed inserting members:", e));
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

// ─── ASSIGNABLE PEOPLE (MANAGERS & EMPLOYEES) ─────────────────────────────────
export const listProjectAssignablePeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          role,
          avatar_url,
          department:departments!profiles_department_id_fkey(name_en, name_ar),
          position:positions(name_en, name_ar)
        `)
        .order("full_name", { ascending: true });

      if (error || !profiles || profiles.length === 0) {
        console.warn("[listProjectAssignablePeople] Note:", error?.message);
        return { managers: [], employees: [] };
      }

      // Identify managers: role is admin/manager/hr OR title includes Manager/Lead/Head/Director
      const managerProfiles = profiles.filter((p: any) => {
        const title = (p.position?.name_en || "").toLowerCase();
        return (
          p.role === "manager" ||
          p.role === "admin" ||
          p.role === "hr" ||
          title.includes("manager") ||
          title.includes("head") ||
          title.includes("lead") ||
          title.includes("director")
        );
      });

      // If no managers match criteria, allow any profile
      const effectiveManagers = managerProfiles.length > 0 ? managerProfiles : profiles;

      return {
        managers: effectiveManagers.map((m: any) => {
          const deptName = m.department?.name_en || m.department?.name_ar || "Management";
          const posTitle = m.position?.name_en || m.position?.name_ar || m.role || "Manager";
          return {
            id: m.id,
            name: m.full_name || m.email || "Manager",
            role: posTitle,
            department: deptName,
            avatarUrl: m.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
          };
        }),
        employees: profiles.map((e: any) => {
          const deptName = e.department?.name_en || e.department?.name_ar || "General";
          const posTitle = e.position?.name_en || e.position?.name_ar || e.role || "Team Member";
          return {
            id: e.id,
            name: e.full_name || e.email || "Employee",
            email: e.email || "",
            role: posTitle,
            department: deptName,
            avatarUrl: e.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
          };
        }),
      };
    } catch (err: any) {
      console.warn("[listProjectAssignablePeople] Error:", err.message);
      return { managers: [], employees: [] };
    }
  });

