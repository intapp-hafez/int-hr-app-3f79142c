export interface ProjectEmployee {
  id: string;
  name: string;
  name_ar?: string;
  role: string;
  department: string;
  avatarUrl?: string;
  email: string;
  phone?: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  title_ar?: string;
  status: "completed" | "in_progress" | "pending";
  priority: "low" | "medium" | "high";
  assignee: {
    name: string;
    avatarUrl?: string;
  };
  dueDate: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "doc" | "image" | "archive" | "sheet";
  uploadedBy: string;
  uploadedAt: string;
}

export interface ProjectUpdate {
  id: string;
  author: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  content: string;
  timestamp: string;
}

export interface Project {
  id: string; // uuid or code
  code?: string;
  name: string;
  name_ar?: string;
  projectManager: {
    name: string;
    avatarUrl?: string;
  };
  reportedManager: {
    name: string;
    avatarUrl?: string;
  };
  location: string;
  startDate: string;
  endDate: string;
  status: "ongoing" | "upcoming" | "completed" | "on_hold";
  notes: string;
  notes_ar?: string;
  employeesCount: number;
  completedTasksCount: number;
  totalTasksCount: number;
  employees: ProjectEmployee[];
  tasks: ProjectTask[];
  files: ProjectFile[];
  updates: ProjectUpdate[];
}

export const EMPTY_PROJECTS: Project[] = [];
