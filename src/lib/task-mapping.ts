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
  estimated_hours: number | string | null;
  assignees: string[];
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export function mapTaskRow(row: TaskRow): ManagerTask {
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
    createdAt: Date.parse(row.created_at),
    city: row.city ?? undefined,
    district: row.district ?? undefined,
    address: row.address ?? undefined,
    estimatedHours: row.estimated_hours != null ? Number(row.estimated_hours) : undefined,
    startedAt: row.started_at ? Date.parse(row.started_at) : undefined,
    completedAt: row.completed_at ? Date.parse(row.completed_at) : undefined,
    history: [],
  };
}