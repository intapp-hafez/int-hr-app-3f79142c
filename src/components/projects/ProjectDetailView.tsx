import React, { useState } from "react";
import {
  Folder,
  ArrowLeft,
  Edit,
  MoreVertical,
  Info,
  Users,
  CheckSquare,
  Paperclip,
  MessageSquare,
  Calendar,
  MapPin,
  User,
  Layers,
  FileText,
  BarChart2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Target,
  Zap,
  Plus,
  UserPlus,
  Upload,
  Send,
  Trash2,
  ChevronRight,
  ExternalLink,
  Shield,
  FileDown,
  Download,
} from "lucide-react";
import { Project, ProjectTask, ProjectEmployee, ProjectFile, ProjectUpdate, formatProjectCode } from "@/lib/projects/projects.data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  addProjectMember,
  removeProjectMember,
  addProjectFile,
  deleteProjectFile,
  addProjectUpdate,
} from "@/backend/functions/projects.functions";

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (updated: Project) => void;
  role?: "admin" | "manager";
  initialTab?: "details" | "employees" | "tasks" | "files" | "updates";
}

export function ProjectDetailView({
  project,
  onBack,
  onUpdateProject,
  role = "admin",
  initialTab = "details",
}: ProjectDetailViewProps) {
  const { isAr } = useI18n();
  const [activeTab, setActiveTab] = useState<"details" | "employees" | "tasks" | "files" | "updates">(initialTab);

  // Quick Action Dialog states
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isUploadFileOpen, setIsUploadFileOpen] = useState(false);
  const [isAddUpdateOpen, setIsAddUpdateOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);

  // Form states
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState(project.employees[0]?.name || "John Doe");

  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("Engineering");
  const [newEmpEmail, setNewEmpEmail] = useState("");

  const [newFileName, setNewFileName] = useState("");
  const [newFileSize, setNewFileSize] = useState("2.4 MB");
  const [newFileType, setNewFileType] = useState<"pdf" | "doc" | "image" | "sheet">("pdf");

  const [newUpdateText, setNewUpdateText] = useState("");

  // Edit Project form
  const [editName, setEditName] = useState(project.name);
  const [editLocation, setEditLocation] = useState(project.location);
  const [editStartDate, setEditStartDate] = useState(project.startDate);
  const [editEndDate, setEditEndDate] = useState(project.endDate);
  const [editStatus, setEditStatus] = useState(project.status);
  const [editNotes, setEditNotes] = useState(project.notes);

  // TanStack Start Server Functions
  const createTaskFn = useServerFn(createProjectTask);
  const updateTaskFn = useServerFn(updateProjectTask);
  const deleteTaskFn = useServerFn(deleteProjectTask);
  const addMemberFn = useServerFn(addProjectMember);
  const removeMemberFn = useServerFn(removeProjectMember);
  const addFileFn = useServerFn(addProjectFile);
  const deleteFileFn = useServerFn(deleteProjectFile);
  const addUpdateFn = useServerFn(addProjectUpdate);

  const isProjectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project.id);

  // Calculate task statistics
  const completedTasks = project.tasks.filter((t) => t.status === "completed").length;
  const inProgressTasks = project.tasks.filter((t) => t.status === "in_progress").length;
  const pendingTasks = project.tasks.filter((t) => t.status === "pending").length;
  const totalTasks = project.tasks.length || 1;
  const progressPct = Math.round((completedTasks / totalTasks) * 100);

  // Handlers for quick actions
  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      toast.error(isAr ? "يرجى كتابة عنوان المهمة" : "Task title is required");
      return;
    }
    const newTask: ProjectTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      status: "pending",
      priority: newTaskPriority,
      assignee: { name: newTaskAssignee },
      dueDate: newTaskDueDate || "May 30, 2025",
    };
    const updated: Project = {
      ...project,
      tasks: [newTask, ...project.tasks],
      totalTasksCount: project.tasks.length + 1,
    };
    onUpdateProject(updated);

    if (isProjectUuid) {
      createTaskFn({
        data: {
          project_id: project.id,
          title: newTask.title,
          assignee_name: newTask.assignee.name,
          priority: newTask.priority,
          status: "pending",
          due_date: "2025-05-30",
        },
      }).catch(() => {});
    }

    setNewTaskTitle("");
    setIsAddTaskOpen(false);
    toast.success(isAr ? "تمت إضافة المهمة بنجاح" : "Task added successfully");
  };

  const handleAddEmployee = () => {
    if (!newEmpName.trim()) {
      toast.error(isAr ? "يرجى كتابة اسم الموظف" : "Employee name is required");
      return;
    }
    const newEmp: ProjectEmployee = {
      id: `emp-${Date.now()}`,
      name: newEmpName.trim(),
      role: newEmpRole.trim() || "Team Member",
      department: newEmpDept,
      email: newEmpEmail.trim() || `${newEmpName.toLowerCase().replace(/\s+/g, ".")}@integ.com`,
    };
    const updated: Project = {
      ...project,
      employees: [newEmp, ...project.employees],
      employeesCount: project.employees.length + 1,
    };
    onUpdateProject(updated);

    if (isProjectUuid) {
      addMemberFn({
        data: {
          project_id: project.id,
          name: newEmp.name,
          email: newEmp.email,
          role: newEmp.role,
          department: newEmp.department,
        },
      }).catch(() => {});
    }

    setNewEmpName("");
    setNewEmpRole("");
    setIsAddEmployeeOpen(false);
    toast.success(isAr ? "تم تعيين الموظف في المشروع" : "Employee assigned to project");
  };

  const handleUploadFile = () => {
    if (!newFileName.trim()) {
      toast.error(isAr ? "يرجى كتابة اسم الملف" : "File name is required");
      return;
    }
    const newFile: ProjectFile = {
      id: `file-${Date.now()}`,
      name: newFileName.trim(),
      size: newFileSize,
      type: newFileType,
      uploadedBy: project.projectManager.name,
      uploadedAt: "Just now",
    };
    const updated: Project = {
      ...project,
      files: [newFile, ...project.files],
    };
    onUpdateProject(updated);

    if (isProjectUuid) {
      addFileFn({
        data: {
          project_id: project.id,
          name: newFile.name,
          size: newFile.size,
          type: newFile.type.toUpperCase(),
        },
      }).catch(() => {});
    }

    setNewFileName("");
    setIsUploadFileOpen(false);
    toast.success(isAr ? "تم رفع الملف بنجاح" : "File uploaded successfully");
  };

  const handleAddUpdate = () => {
    if (!newUpdateText.trim()) {
      toast.error(isAr ? "يرجى كتابة نص التحديث" : "Update text is required");
      return;
    }
    const newUp: ProjectUpdate = {
      id: `up-${Date.now()}`,
      author: {
        name: project.projectManager.name,
        role: "Project Manager",
        avatarUrl: project.projectManager.avatarUrl,
      },
      content: newUpdateText.trim(),
      timestamp: "Just now",
    };
    const updated: Project = {
      ...project,
      updates: [newUp, ...project.updates],
    };
    onUpdateProject(updated);

    if (isProjectUuid) {
      addUpdateFn({
        data: {
          project_id: project.id,
          title: "Milestone Progress Update",
          content: newUp.content,
          author_name: project.projectManager.name,
          author_role: "Project Manager",
        },
      }).catch(() => {});
    }

    setNewUpdateText("");
    setIsAddUpdateOpen(false);
    toast.success(isAr ? "تم نشر التحديث للمشروع" : "Project update posted");
  };

  const handleSaveEditProject = () => {
    const updated: Project = {
      ...project,
      name: editName.trim() || project.name,
      location: editLocation.trim() || project.location,
      startDate: editStartDate || project.startDate,
      endDate: editEndDate || project.endDate,
      status: editStatus,
      notes: editNotes.trim() || project.notes,
    };
    onUpdateProject(updated);
    setIsEditProjectOpen(false);
    toast.success(isAr ? "تم تحديث بيانات المشروع" : "Project details updated");
  };

  const handleToggleTaskStatus = (task: ProjectTask) => {
    const nextStatus: ProjectTask["status"] =
      task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending";
    const updatedTasks = project.tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t));
    const completedCount = updatedTasks.filter((t) => t.status === "completed").length;
    const updated: Project = {
      ...project,
      tasks: updatedTasks,
      completedTasksCount: completedCount,
    };
    onUpdateProject(updated);

    if (isProjectUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id)) {
      updateTaskFn({
        data: {
          id: task.id,
          status: nextStatus,
        },
      }).catch(() => {});
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = project.tasks.filter((t) => t.id !== taskId);
    const completedCount = updatedTasks.filter((t) => t.status === "completed").length;
    const updated: Project = {
      ...project,
      tasks: updatedTasks,
      totalTasksCount: updatedTasks.length,
      completedTasksCount: completedCount,
    };
    onUpdateProject(updated);

    if (isProjectUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)) {
      deleteTaskFn({ data: { id: taskId } }).catch(() => {});
    }
    toast.success(isAr ? "تم حذف المهمة" : "Task removed");
  };

  const handleRemoveEmployee = (empId: string) => {
    const updatedEmployees = project.employees.filter((e) => e.id !== empId);
    const updated: Project = {
      ...project,
      employees: updatedEmployees,
      employeesCount: updatedEmployees.length,
    };
    onUpdateProject(updated);

    if (isProjectUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empId)) {
      removeMemberFn({ data: { id: empId } }).catch(() => {});
    }
    toast.success(isAr ? "تم إزالة الموظف من المشروع" : "Member removed from project");
  };

  const handleDeleteFile = (fileId: string) => {
    const updatedFiles = project.files.filter((f) => f.id !== fileId);
    const updated: Project = {
      ...project,
      files: updatedFiles,
    };
    onUpdateProject(updated);

    if (isProjectUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      deleteFileFn({ data: { id: fileId } }).catch(() => {});
    }
    toast.success(isAr ? "تم حذف الملف" : "File removed");
  };

  const getStatusBadge = (status: Project["status"]) => {
    switch (status) {
      case "ongoing":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">{isAr ? "قيد التنفيذ" : "Ongoing"}</Badge>;
      case "completed":
        return <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border-sky-500/30 text-xs font-semibold px-2.5 py-0.5">{isAr ? "مكتمل" : "Completed"}</Badge>;
      case "upcoming":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30 text-xs font-semibold px-2.5 py-0.5">{isAr ? "قادم" : "Upcoming"}</Badge>;
      case "on_hold":
        return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 text-xs font-semibold px-2.5 py-0.5">{isAr ? "معلق" : "On Hold"}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ── BREADCRUMBS & TOP BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <button onClick={onBack} className="hover:text-foreground transition-colors flex items-center gap-1">
              <Folder className="h-3.5 w-3.5 text-orange-500" />
              <span>{isAr ? "المشاريع" : "Projects"}</span>
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-semibold font-mono">{formatProjectCode(project.code || project.id)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Folder className="h-5 w-5 fill-orange-500/20" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {formatProjectCode(project.code || project.id)} — {isAr ? project.name_ar || project.name : project.name}
                </h1>
                {getStatusBadge(project.status)}
              </div>
              <p className="text-xs text-muted-foreground max-w-3xl pt-0.5 line-clamp-1">
                {isAr ? project.notes_ar || project.notes : project.notes}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons on Right */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-9 gap-1.5 rounded-xl border-border hover:bg-muted font-medium text-xs shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {isAr ? "العودة للمشاريع" : "Back to Projects"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditProjectOpen(true)}
            className="h-9 gap-1.5 rounded-xl border-border hover:bg-muted font-medium text-xs shadow-2xs"
          >
            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "تعديل" : "Edit"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddTaskOpen(true)}
            className="h-9 gap-1.5 rounded-xl bg-brand text-brand-foreground hover:brightness-105 border-0 font-medium text-xs shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAr ? "إضافة مهمة" : "Add Task"}
          </Button>
        </div>
      </div>

      {/* ── TABS NAVIGATION BAR ── */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              activeTab === "details"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5 rounded-t-lg"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <Info className="h-4 w-4" />
            <span>{isAr ? "تفاصيل المشروع" : "Project Details"}</span>
          </button>

          <button
            onClick={() => setActiveTab("employees")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              activeTab === "employees"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5 rounded-t-lg"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{isAr ? "فريق العمل" : "Employees"}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] bg-muted font-mono text-muted-foreground">
              {project.employees.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              activeTab === "tasks"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5 rounded-t-lg"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>{isAr ? "المهام" : "Tasks"}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] bg-muted font-mono text-muted-foreground">
              {project.tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              activeTab === "files"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5 rounded-t-lg"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <Paperclip className="h-4 w-4" />
            <span>{isAr ? "المستندات والملفات" : "Files"}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] bg-muted font-mono text-muted-foreground">
              {project.files.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("updates")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              activeTab === "updates"
                ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5 rounded-t-lg"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>{isAr ? "التحديثات والملاحظات" : "Updates"}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] bg-muted font-mono text-muted-foreground">
              {project.updates.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: PROJECT DETAILS ── */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Project Info & Situation Summary (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Card 1: Project Information */}
            <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Info className="h-4 w-4 text-orange-500" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  {isAr ? "معلومات وبيانات المشروع" : "Project Information"}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-xs sm:text-sm">
                {/* Col 1 */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <Folder className="h-3.5 w-3.5 text-orange-500" />
                      {isAr ? "رمز المشروع:" : "Project ID"}
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs bg-muted px-2 py-0.5 rounded">
                      {formatProjectCode(project.code || project.id)}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "اسم المشروع:" : "Project Name"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {isAr ? project.name_ar || project.name : project.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "مدير المشروع:" : "Project Manager"}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full overflow-hidden bg-brand/10 border border-brand/20">
                        {project.projectManager.avatarUrl ? (
                          <img src={project.projectManager.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-brand">
                            {project.projectManager.name.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-foreground">{project.projectManager.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "المدير المباشر:" : "Reported Manager"}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full overflow-hidden bg-muted border border-border">
                        {project.reportedManager.avatarUrl ? (
                          <img src={project.reportedManager.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {project.reportedManager.name.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-foreground">{project.reportedManager.name}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "موقع المشروع:" : "Locations"}
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      {project.location}
                    </span>
                  </div>
                </div>

                {/* Col 2 */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "تاريخ البدء:" : "Start Date"}
                    </span>
                    <span className="font-medium text-foreground">{project.startDate}</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "تاريخ الانتهاء:" : "End Date"}
                    </span>
                    <span className="font-medium text-foreground">{project.endDate}</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "عدد الموظفين:" : "Employees"}
                    </span>
                    <span className="font-bold text-foreground font-mono">{project.employees.length}</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "المهام المرتبطة:" : "Related Tasks"}
                    </span>
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="font-mono text-foreground">
                          {completedTasks} / {project.tasks.length} ({progressPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-1">
                    <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {isAr ? "ملاحظات:" : "Notes"}
                    </span>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {isAr ? project.notes_ar || project.notes : project.notes}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Project Situation (Summary) */}
            <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-orange-500" />
                  <h3 className="font-bold text-sm sm:text-base text-foreground">
                    {isAr ? "ملخص وضع المشروع ومؤشرات الإنجاز" : "Project Situation (Summary)"}
                  </h3>
                </div>
              </div>

              {/* 4 Stat Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* Completed */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-foreground">{completedTasks}</div>
                    <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {isAr ? "مهام منجزة" : "Completed Tasks"}
                    </div>
                  </div>
                </div>

                {/* In Progress */}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-foreground">{inProgressTasks}</div>
                    <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                      {isAr ? "قيد التنفيذ" : "In Progress"}
                    </div>
                  </div>
                </div>

                {/* Pending */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-foreground">{pendingTasks}</div>
                    <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {isAr ? "قيد الانتظار" : "Pending"}
                    </div>
                  </div>
                </div>

                {/* Project Employees */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-foreground">{project.employees.length}</div>
                    <div className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
                      {isAr ? "فريق العمل" : "Project Employees"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground">{isAr ? "نسبة الإنجاز الإجمالية" : "Overall Progress"}</span>
                  <span className="font-mono text-orange-600 dark:text-orange-400 font-bold text-sm">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Project Status Donut, Key Dates, Quick Actions (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card 1: Project Status Donut */}
            <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Target className="h-4 w-4 text-orange-500" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  {isAr ? "حالة وتوزيع المهام" : "Project Status"}
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-6 py-2">
                {/* SVG Donut Chart */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" className="stroke-muted" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#ea580c"
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * progressPct) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold font-mono text-foreground">{progressPct}%</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {isAr ? "إنجاز" : "Progress"}
                    </span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="space-y-2.5 w-full text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      {isAr ? "مكتملة" : "Completed"}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {completedTasks} ({Math.round((completedTasks / totalTasks) * 100)}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                      {isAr ? "قيد التنفيذ" : "In Progress"}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {inProgressTasks} ({Math.round((inProgressTasks / totalTasks) * 100)}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      {isAr ? "قيد الانتظار" : "Pending"}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {pendingTasks} ({Math.round((pendingTasks / totalTasks) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Key Dates */}
            <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Calendar className="h-4 w-4 text-orange-500" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  {isAr ? "المواعيد الرئيسية" : "Key Dates"}
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {isAr ? "تاريخ البدء:" : "Start Date"}
                  </span>
                  <span className="font-semibold text-foreground">{project.startDate}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    {isAr ? "الموعد المستهدف للانتهاء:" : "Expected End Date"}
                  </span>
                  <span className="font-semibold text-foreground">{project.endDate}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    {isAr ? "المدة المتبقية:" : "Remaining Time"}
                  </span>
                  <span className="font-bold font-mono text-orange-600 dark:text-orange-400">
                    {isAr ? "60 يوماً" : "60 Days"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Quick Actions */}
            <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Zap className="h-4 w-4 text-orange-500" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  {isAr ? "إجراءات سريعة" : "Quick Actions"}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setIsAddTaskOpen(true)}
                  className="h-11 justify-start gap-2 rounded-xl text-xs font-semibold hover:border-orange-500/50 hover:bg-orange-500/5"
                >
                  <Plus className="h-3.5 w-3.5 text-orange-500" />
                  {isAr ? "إضافة مهمة" : "+ Add Task"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setIsAddEmployeeOpen(true)}
                  className="h-11 justify-start gap-2 rounded-xl text-xs font-semibold hover:border-orange-500/50 hover:bg-orange-500/5"
                >
                  <UserPlus className="h-3.5 w-3.5 text-orange-500" />
                  {isAr ? "تعيين موظف" : "Add Employee"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setIsUploadFileOpen(true)}
                  className="h-11 justify-start gap-2 rounded-xl text-xs font-semibold hover:border-orange-500/50 hover:bg-orange-500/5"
                >
                  <Upload className="h-3.5 w-3.5 text-orange-500" />
                  {isAr ? "رفع ملف" : "Upload File"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setIsAddUpdateOpen(true)}
                  className="h-11 justify-start gap-2 rounded-xl text-xs font-semibold hover:border-orange-500/50 hover:bg-orange-500/5"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
                  {isAr ? "كتابة تحديث" : "Add Update"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: EMPLOYEES ── */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              {isAr ? "فريق عمل المشروع" : "Project Team Members"} ({project.employees.length})
            </h3>
            <Button
              size="sm"
              onClick={() => setIsAddEmployeeOpen(true)}
              className="gap-1.5 rounded-xl bg-brand text-brand-foreground hover:brightness-105 text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {isAr ? "إضافة موظف" : "Assign Employee"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.employees.map((emp) => (
              <div key={emp.id} className="rounded-2xl border bg-card p-4 shadow-2xs hover:shadow-sm transition-all space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center font-bold text-brand">
                    {emp.avatarUrl ? (
                      <img src={emp.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      emp.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-foreground truncate">{emp.name}</h4>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium truncate">{emp.role}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{emp.department}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmployee(emp.id)}
                    className="text-muted-foreground/60 hover:text-rose-500 transition-colors p-1 rounded-lg"
                    title={isAr ? "إزالة الموظف من المشروع" : "Remove member"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground font-mono truncate">
                  {emp.email}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: TASKS ── */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-orange-500" />
              {isAr ? "مهام ومراحل المشروع" : "Project Tasks & Milestones"} ({project.tasks.length})
            </h3>
            <Button
              size="sm"
              onClick={() => setIsAddTaskOpen(true)}
              className="gap-1.5 rounded-xl bg-brand text-brand-foreground hover:brightness-105 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "مهمة جديدة" : "Add Task"}
            </Button>
          </div>

          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/70 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">{isAr ? "عنوان المهمة" : "Task Title"}</th>
                  <th className="py-3 px-4">{isAr ? "المسؤول" : "Assignee"}</th>
                  <th className="py-3 px-4">{isAr ? "الأولوية" : "Priority"}</th>
                  <th className="py-3 px-4">{isAr ? "تاريخ الاستحقاق" : "Due Date"}</th>
                  <th className="py-3 px-4 text-center">{isAr ? "الحالة" : "Status"}</th>
                  <th className="py-3 px-3 text-center w-12">{isAr ? "حذف" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {project.tasks.map((task, idx) => (
                  <tr key={task.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-3 px-4 text-center font-mono text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-foreground">{task.title}</td>
                    <td className="py-3 px-4 text-foreground/90">{task.assignee.name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        task.priority === "high"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : task.priority === "medium"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">{task.dueDate}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleTaskStatus(task)}
                        title={isAr ? "انقر لتغيير حالة المهمة" : "Click to cycle status: Pending ➔ In Progress ➔ Completed"}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95 ${
                          task.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                            : task.status === "in_progress"
                            ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                        }`}
                      >
                        {task.status === "completed" ? "Completed ✓" : task.status === "in_progress" ? "In Progress ↻" : "Pending ⏳"}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-muted-foreground/60 hover:text-rose-500 transition-colors p-1 rounded-lg"
                        title={isAr ? "حذف المهمة" : "Delete task"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: FILES ── */}
      {activeTab === "files" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-orange-500" />
              {isAr ? "مستندات ومخططات المشروع" : "Project Attachments"} ({project.files.length})
            </h3>
            <Button
              size="sm"
              onClick={() => setIsUploadFileOpen(true)}
              className="gap-1.5 rounded-xl bg-brand text-brand-foreground hover:brightness-105 text-xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5" />
              {isAr ? "رفع ملف" : "Upload File"}
            </Button>
          </div>

          {project.files.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.files.map((file) => (
                <div key={file.id} className="rounded-2xl border bg-card p-4 shadow-2xs hover:shadow-sm transition-all flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-xs text-foreground truncate">{file.name}</h4>
                      <p className="text-[11px] text-muted-foreground">{file.size} • {file.uploadedAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Download className="h-4 w-4" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(file.id)}
                      className="text-muted-foreground/60 hover:text-rose-500 transition-colors p-1.5 rounded-lg"
                      title={isAr ? "حذف الملف" : "Delete file"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center bg-card">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{isAr ? "لا توجد ملفات مرفوعة بعد" : "No files uploaded for this project yet"}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: UPDATES ── */}
      {activeTab === "updates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-orange-500" />
              {isAr ? "سجل التحديثات الميدانية" : "Project Updates & Timeline"} ({project.updates.length})
            </h3>
            <Button
              size="sm"
              onClick={() => setIsAddUpdateOpen(true)}
              className="gap-1.5 rounded-xl bg-brand text-brand-foreground hover:brightness-105 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "كتابة تحديث" : "Post Update"}
            </Button>
          </div>

          <div className="space-y-3">
            {project.updates.map((up) => (
              <div key={up.id} className="rounded-2xl border bg-card p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-brand/10 text-brand font-bold text-xs flex items-center justify-center">
                      {up.author.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-xs text-foreground">{up.author.name}</span>
                    <span className="text-[11px] text-muted-foreground">• {up.author.role}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">{up.timestamp}</span>
                </div>
                <p className="text-xs text-foreground/90 pl-9 leading-relaxed">{up.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: ADD TASK ── */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-orange-500" />
              {isAr ? "إضافة مهمة جديدة للمشروع" : "Add Project Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label>{isAr ? "عنوان المهمة *" : "Task Title *"}</Label>
              <Input
                placeholder="e.g. Server Rack Installation & Cabling"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isAr ? "الأولوية" : "Priority"}</Label>
                <select
                  value={newTaskPriority}
                  onChange={(e: any) => setNewTaskPriority(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{isAr ? "تاريخ الاستحقاق" : "Due Date"}</Label>
                <Input
                  placeholder="e.g. May 30, 2025"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{isAr ? "المسؤول عن التنفيذ" : "Assignee"}</Label>
              <Input
                placeholder="Assignee name"
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleCreateTask} className="bg-brand text-brand-foreground">{isAr ? "حفظ المهمة" : "Save Task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: ASSIGN EMPLOYEE ── */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-orange-500" />
              {isAr ? "تعيين موظف في المشروع" : "Assign Team Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label>{isAr ? "اسم الموظف *" : "Employee Name *"}</Label>
              <Input
                placeholder="e.g. Omar Hassan"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{isAr ? "الدور في المشروع" : "Project Role"}</Label>
              <Input
                placeholder="e.g. Commissioning Engineer"
                value={newEmpRole}
                onChange={(e) => setNewEmpRole(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isAr ? "الإدارة" : "Department"}</Label>
                <Input
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>{isAr ? "البريد الإلكتروني" : "Email"}</Label>
                <Input
                  placeholder="omar.h@integ.com"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleAddEmployee} className="bg-brand text-brand-foreground">{isAr ? "تعيين" : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: UPLOAD FILE ── */}
      <Dialog open={isUploadFileOpen} onOpenChange={setIsUploadFileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              {isAr ? "رفع ملف ومستند للمشروع" : "Upload Project Document"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label>{isAr ? "اسم المستند *" : "File Name *"}</Label>
              <Input
                placeholder="e.g. Electrical_Single_Line_Diagram_v2.pdf"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isAr ? "نوع الملف" : "File Type"}</Label>
                <select
                  value={newFileType}
                  onChange={(e: any) => setNewFileType(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="pdf">PDF Document</option>
                  <option value="doc">Word / Text</option>
                  <option value="sheet">Excel Spreadsheet</option>
                  <option value="image">Image / Blueprint</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{isAr ? "الحجم التقديري" : "Estimated Size"}</Label>
                <Input
                  value={newFileSize}
                  onChange={(e) => setNewFileSize(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadFileOpen(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleUploadFile} className="bg-brand text-brand-foreground">{isAr ? "رفع" : "Upload"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: ADD UPDATE ── */}
      <Dialog open={isAddUpdateOpen} onOpenChange={setIsAddUpdateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-orange-500" />
              {isAr ? "كتابة تحديث ميداني" : "Post Project Update"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <Textarea
              rows={4}
              placeholder="Describe progress, blockers, or milestone accomplishments..."
              value={newUpdateText}
              onChange={(e) => setNewUpdateText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUpdateOpen(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleAddUpdate} className="bg-brand text-brand-foreground">{isAr ? "نشر التحديث" : "Post"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: EDIT PROJECT ── */}
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Edit className="h-5 w-5" />
              </div>
              <span>{isAr ? "تعديل بيانات المشروع" : "Edit Project Details"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "اسم المشروع" : "Project Name"}</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "الموقع" : "Location"}</Label>
                <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="h-10 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "تاريخ البدء" : "Start Date"}</Label>
                <Input value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "تاريخ الانتهاء" : "End Date"}</Label>
                <Input value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "الحالة" : "Status"}</Label>
                <select
                  value={editStatus}
                  onChange={(e: any) => setEditStatus(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand shadow-2xs"
                >
                  <option value="ongoing">{isAr ? "قيد التنفيذ (Ongoing)" : "Ongoing"}</option>
                  <option value="upcoming">{isAr ? "قادم (Upcoming)" : "Upcoming"}</option>
                  <option value="completed">{isAr ? "مكتمل (Completed)" : "Completed"}</option>
                  <option value="on_hold">{isAr ? "معلق (On Hold)" : "On Hold"}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground/90">{isAr ? "الملاحظات والوصف" : "Notes & Description"}</Label>
              <Textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="rounded-xl resize-none text-xs" />
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 pt-3 gap-2">
            <Button variant="outline" onClick={() => setIsEditProjectOpen(false)} className="rounded-xl h-10 px-5 text-xs font-semibold">
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSaveEditProject} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-10 px-6 text-xs font-semibold shadow-sm shadow-orange-600/20">
              {isAr ? "حفظ التعديلات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

