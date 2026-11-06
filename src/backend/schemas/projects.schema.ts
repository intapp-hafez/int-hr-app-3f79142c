import { z } from "zod";

export const ProjectStatusSchema = z.enum(["ongoing", "upcoming", "completed", "on_hold"]);
export const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const TaskStatusSchema = z.enum(["pending", "in_progress", "completed", "blocked"]);

export const CreateProjectSchema = z.object({
  project_code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  project_manager_name: z.string().min(1),
  project_manager_id: z.string().uuid().optional().nullable(),
  reported_manager_name: z.string().min(1),
  reported_manager_id: z.string().uuid().optional().nullable(),
  location: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().optional(),
  status: ProjectStatusSchema.default("ongoing"),
  assigned_employee_ids: z.array(z.string()).optional(),
  initial_members: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        department: z.string().optional(),
        email: z.string().optional(),
        employee_id: z.string().uuid().optional().nullable(),
      })
    )
    .optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z.string().uuid(),
});

export const ListProjectsSchema = z.object({
  status: z.string().optional(),
  location: z.string().optional(),
  manager: z.string().optional(),
  search: z.string().optional(),
});

export const GetProjectSchema = z.object({
  id: z.string(), // can be UUID or project_code
});

export const DeleteProjectSchema = z.object({
  id: z.string().uuid(),
});

export const CreateProjectTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().optional(),
  assignee_name: z.string().default("Unassigned"),
  assignee_id: z.string().uuid().optional().nullable(),
  priority: TaskPrioritySchema.default("medium"),
  status: TaskStatusSchema.default("pending"),
  due_date: z.string().optional(),
});

export const UpdateProjectTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  assignee_name: z.string().optional(),
  priority: TaskPrioritySchema.optional(),
  status: TaskStatusSchema.optional(),
  due_date: z.string().optional(),
});

export const DeleteProjectTaskSchema = z.object({
  id: z.string().uuid(),
});

export const AddProjectMemberSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(2),
  email: z.string().email().optional(),
  role: z.string().default("Team Member"),
  department: z.string().optional(),
  phone: z.string().optional(),
  employee_id: z.string().uuid().optional().nullable(),
});

export const RemoveProjectMemberSchema = z.object({
  id: z.string().uuid(),
});

export const AddProjectFileSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
  size: z.string().default("0 KB"),
  type: z.string().default("DOCUMENT"),
  url: z.string().default("#"),
  uploaded_by_name: z.string().default("Administrator"),
});

export const DeleteProjectFileSchema = z.object({
  id: z.string().uuid(),
});

export const AddProjectUpdateSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(2),
  content: z.string().min(2),
  author_name: z.string().default("Project Manager"),
  author_role: z.string().default("Project Lead"),
  date: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateProjectTaskInput = z.infer<typeof CreateProjectTaskSchema>;
export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;
export type AddProjectFileInput = z.infer<typeof AddProjectFileSchema>;
export type AddProjectUpdateInput = z.infer<typeof AddProjectUpdateSchema>;

