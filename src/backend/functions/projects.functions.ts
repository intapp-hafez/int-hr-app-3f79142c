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
    const userId = context.userId;

    try {
      // 1. Resolve user authorization roles and profile
      const [{ data: roleRows }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle(),
      ]);

      const userRoles = (roleRows || []).map((r: any) => r.role);
      const isAdminOrHr = userRoles.includes("admin") || userRoles.includes("hr");
      // If user is a manager or non-admin, or explicitly viewing manager portal, enforce manager-only visibility
      const isManagerScope = !isAdminOrHr || data.role === "manager";

      // 2. If manager scope, look up which projects they belong to as a team member
      const memberProjectIds = new Set<string>();
      if (isManagerScope) {
        const { data: memberRows } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("employee_id", userId);
        if (memberRows) {
          for (const m of memberRows) {
            if (m.project_id) memberProjectIds.add(m.project_id);
          }
        }

        if (profile?.email) {
          const { data: emailMemberRows } = await supabase
            .from("project_members")
            .select("project_id")
            .eq("email", profile.email);
          if (emailMemberRows) {
            for (const m of emailMemberRows) {
              if (m.project_id) memberProjectIds.add(m.project_id);
            }
          }
        }
      }

      // 3. Query projects from database
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
          created_by,
          location,
          start_date,
          end_date,
          notes,
          status,
          created_at,
          tasks:project_tasks(id, status),
          members:project_members(id, employee_id, email)
        `)
        .order("created_at", { ascending: false });

      if (data.status && data.status !== "all") {
        query = query.eq("status", data.status);
      }
      if (data.location && data.location !== "all") {
        query = query.ilike("location", `%${data.location}%`);
      }
      if (data.manager && data.manager !== "all" && !isManagerScope) {
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

      // 4. Filter to manager's related projects if manager scope
      let effectiveRows = rows || [];
      if (isManagerScope) {
        const userFullName = (profile?.full_name || "").trim().toLowerCase();
        const userEmail = (profile?.email || "").trim().toLowerCase();

        effectiveRows = effectiveRows.filter((row: any) => {
          const isPmId = row.project_manager_id && row.project_manager_id === userId;
          const isRmId = row.reported_manager_id && row.reported_manager_id === userId;
          const isCreator = row.created_by && row.created_by === userId;
          const isMember = memberProjectIds.has(row.id);

          const pmName = (row.project_manager_name || "").trim().toLowerCase();
          const rmName = (row.reported_manager_name || "").trim().toLowerCase();

          const isPmName = Boolean(
            userFullName && pmName && (pmName === userFullName || pmName.includes(userFullName) || userFullName.includes(pmName))
          );
          const isRmName = Boolean(
            userFullName && rmName && (rmName === userFullName || rmName.includes(userFullName) || userFullName.includes(rmName))
          );

          const isMemberEmail = Boolean(
            userEmail &&
            Array.isArray(row.members) &&
            row.members.some((m: any) => m.email && m.email.trim().toLowerCase() === userEmail)
          );

          const isRelated = isPmId || isRmId || isCreator || isMember || isPmName || isRmName || isMemberEmail;
          if (!isRelated) return false;

          // Sub-filter for specific manager relation
          if (data.managerRelation === "as_pm" && !(isPmId || isPmName)) return false;
          if (data.managerRelation === "as_rm" && !(isRmId || isRmName)) return false;
          if (data.managerRelation === "as_member" && !(isMember || isMemberEmail)) return false;

          return true;
        });
      }

      // 5. Transform into frontend representation with dynamic task completion calculation
      return effectiveRows.map((row: any, index: number) => {
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
            id: row.project_manager_id || undefined,
            name: row.project_manager_name || "Unassigned",
            avatarUrl: undefined,
          },
          reportedManager: {
            id: row.reported_manager_id || undefined,
            name: row.reported_manager_name || "Unassigned",
            avatarUrl: undefined,
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
    const userId = context.userId;

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

    // Role verification: managers can only view related projects
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle(),
    ]);

    const userRoles = (roleRows || []).map((r: any) => r.role);
    const isAdminOrHr = userRoles.includes("admin") || userRoles.includes("hr");

    if (!isAdminOrHr || data.role === "manager") {
      const userFullName = (profile?.full_name || "").trim().toLowerCase();
      const userEmail = (profile?.email || "").trim().toLowerCase();
      const pmName = (project.project_manager_name || "").trim().toLowerCase();
      const rmName = (project.reported_manager_name || "").trim().toLowerCase();

      const { data: memberRecord } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", project.id)
        .or(`employee_id.eq.${userId}${userEmail ? `,email.eq.${userEmail}` : ""}`)
        .maybeSingle();

      const isRelated =
        project.project_manager_id === userId ||
        project.reported_manager_id === userId ||
        project.created_by === userId ||
        Boolean(memberRecord) ||
        Boolean(userFullName && pmName && (pmName === userFullName || pmName.includes(userFullName) || userFullName.includes(pmName))) ||
        Boolean(userFullName && rmName && (rmName === userFullName || rmName.includes(userFullName) || userFullName.includes(rmName)));

      if (!isAdminOrHr && !isRelated) {
        throw new Error("Unauthorized: You do not have permission to view this project");
      }
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
        avatarUrl: undefined,
      },
      priority: (t.priority || "medium") as "low" | "medium" | "high",
      dueDate: t.due_date || "",
      status: (t.status || "pending") as "completed" | "in_progress" | "pending",
    }));

    const members = (membersRes.data || []).map((m: any) => ({
      id: m.profile_id || m.id,
      name: m.name,
      role: m.role || "Team Member",
      department: m.department || "Operations",
      email: m.email || "",
      phone: m.phone || "",
      avatarUrl: m.avatar_url || undefined,
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
        avatarUrl: u.author_avatar || undefined,
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
        id: project.project_manager_id || undefined,
        name: project.project_manager_name || "Unassigned",
        avatarUrl: undefined,
      },
      reportedManager: {
        id: project.reported_manager_id || undefined,
        name: project.reported_manager_name || "Unassigned",
        avatarUrl: undefined,
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
    const { id, initial_members, assigned_employee_ids, ...rawUpdates } = data;

    const allowedFields: Record<string, any> = {};
    if (rawUpdates.project_code !== undefined) allowedFields.project_code = rawUpdates.project_code;
    if (rawUpdates.name !== undefined) allowedFields.name = rawUpdates.name;
    if (rawUpdates.description !== undefined) allowedFields.description = rawUpdates.description;
    if (rawUpdates.project_manager_name !== undefined) allowedFields.project_manager_name = rawUpdates.project_manager_name;
    if (rawUpdates.project_manager_id !== undefined) allowedFields.project_manager_id = rawUpdates.project_manager_id;
    if (rawUpdates.reported_manager_name !== undefined) allowedFields.reported_manager_name = rawUpdates.reported_manager_name;
    if (rawUpdates.reported_manager_id !== undefined) allowedFields.reported_manager_id = rawUpdates.reported_manager_id;
    if (rawUpdates.location !== undefined) allowedFields.location = rawUpdates.location;
    if (rawUpdates.start_date !== undefined) allowedFields.start_date = rawUpdates.start_date;
    if (rawUpdates.end_date !== undefined) allowedFields.end_date = rawUpdates.end_date;
    if (rawUpdates.notes !== undefined) allowedFields.notes = rawUpdates.notes;
    if (rawUpdates.status !== undefined) allowedFields.status = rawUpdates.status;

    const { data: updated, error } = await supabase
      .from("company_projects")
      .update(allowedFields)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[updateCompanyProject] error:", error);
      throw new Error(error.message);
    }

    // Synchronize project members if provided
    if (initial_members && Array.isArray(initial_members)) {
      try {
        await supabase.from("project_members").delete().eq("project_id", id);
        if (initial_members.length > 0) {
          const memberRows = initial_members.map((m) => ({
            project_id: id,
            name: m.name,
            email: m.email || null,
            role: m.role || "Team Member",
            department: m.department || null,
            employee_id: m.employee_id || null,
          }));
          await supabase.from("project_members").insert(memberRows);
        }
      } catch (memErr) {
        console.warn("[updateCompanyProject] Member sync warning:", memErr);
      }
    }

    return updated;
  });

// ─── DELETE PROJECT ───────────────────────────────────────────────────────────
export const deleteCompanyProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => DeleteProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows || []).map((r: any) => r.role);
    const isAdminOrHr = roles.includes("admin") || roles.includes("hr");

    if (!isAdminOrHr) {
      const { data: proj } = await supabase
        .from("company_projects")
        .select("project_manager_id, created_by")
        .eq("id", data.id)
        .maybeSingle();

      if (!proj || (proj.project_manager_id !== userId && proj.created_by !== userId)) {
        throw new Error("Unauthorized: You do not have permission to delete this project");
      }
    }

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
            avatarUrl: m.avatar_url || undefined,
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
            avatarUrl: e.avatar_url || undefined,
          };
        }),
      };
    } catch (err: any) {
      console.warn("[listProjectAssignablePeople] Error:", err.message);
      return { managers: [], employees: [] };
    }
  });

