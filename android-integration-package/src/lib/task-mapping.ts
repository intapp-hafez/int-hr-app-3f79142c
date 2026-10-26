import type { ManagerTask, TaskPriority, TaskStatus } from "@/lib/store";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_m?: number | null;
  estimated_hours: number | string | null;
  assignees: string[];
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  creator_name?: string | null;
  task_activity?: { id: string; kind: string; occurred_at: string; note: string | null; employee_id: string; employee_name?: string }[];
  assignee_profiles?: { id: string; full_name: string | null; emp_code?: string | null; department?: string | null; avatar_url?: string | null }[];
};

export function mapTaskRow(row: TaskRow): ManagerTask {
  const history = (row.task_activity ?? []).map((a) => ({
    ts: Date.parse(a.occurred_at),
    by: a.employee_name || a.employee_id,
    to: (a.kind === "start_task" ? "in_progress" : a.kind === "complete_task" ? "done" : "pending") as TaskStatus,
    note: a.note ?? undefined,
  })).sort((a, b) => a.ts - b.ts);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    date: row.due_date ?? row.created_at.slice(0, 10),
    dueTime: row.due_time ?? undefined,
    priority: (row.priority as TaskPriority) ?? "medium",
    assignees: row.assignees ?? [],
    status: (row.status as TaskStatus) ?? "pending",
    createdBy: row.created_by,
    creatorName: row.creator_name ?? undefined,
    createdAt: Date.parse(row.created_at),
    city: row.city ?? undefined,
    district: row.district ?? undefined,
    address: row.address ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    radius_m: row.radius_m ?? undefined,
    estimatedHours: row.estimated_hours != null ? Number(row.estimated_hours) : undefined,
    startedAt: row.started_at ? Date.parse(row.started_at) : undefined,
    completedAt: row.completed_at ? Date.parse(row.completed_at) : undefined,
    history,
    assigneeProfiles: (row.assignee_profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name || p.id,
      empCode: p.emp_code || undefined,
      department: p.department || undefined,
      avatarUrl: p.avatar_url || undefined,
    })),
  };
}