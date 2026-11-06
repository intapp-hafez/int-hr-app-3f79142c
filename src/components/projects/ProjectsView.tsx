import React, { useState, useMemo } from "react";
import {
  Folder,
  Plus,
  Search,
  MapPin,
  Calendar,
  Users,
  CheckSquare,
  FileText,
  MoreVertical,
  Edit,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Trash2,
  ListTodo,
  CheckCircle2,
  Clock,
  RefreshCw,
  User,
} from "lucide-react";
import { Project, INITIAL_PROJECTS, loadProjectsFromStorage, saveProjectsToStorage } from "@/lib/projects/projects.data";
import { ProjectDetailView } from "./ProjectDetailView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCompanyProjects,
  createCompanyProject,
  updateCompanyProject,
  deleteCompanyProject,
} from "@/backend/functions/projects.functions";

interface ProjectsViewProps {
  role?: "admin" | "manager";
}

export function ProjectsView({ role = "admin" }: ProjectsViewProps) {
  const { isAr } = useI18n();
  const [projects, setProjects] = useState<Project[]>(() => loadProjectsFromStorage());
  const [selectedProjectId, setSelectedProjectId] = useState<string>("PRJ-002");
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<"details" | "employees" | "tasks" | "files" | "updates">("details");

  // Filters state
  const [statusTab, setStatusTab] = useState<"all" | "ongoing" | "upcoming" | "completed" | "on_hold">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // New Project Dialog state
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjId, setNewProjId] = useState("");
  const [newProjName, setNewProjName] = useState("");
  const [newProjNameAr, setNewProjNameAr] = useState("");
  const [newProjManager, setNewProjManager] = useState("John Reyes");
  const [newProjReportedManager, setNewProjReportedManager] = useState("Maria Santos");
  const [newProjLocation, setNewProjLocation] = useState("Head Office");
  const [newProjStartDate, setNewProjStartDate] = useState("May 01, 2025");
  const [newProjEndDate, setNewProjEndDate] = useState("Aug 31, 2025");
  const [newProjStatus, setNewProjStatus] = useState<Project["status"]>("ongoing");
  const [newProjNotes, setNewProjNotes] = useState("");
  const [newProjNotesAr, setNewProjNotesAr] = useState("");

  // Edit Project Dialog state
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // TanStack Start Server Functions
  const listProjectsFn = useServerFn(listCompanyProjects);
  const createProjectFn = useServerFn(createCompanyProject);
  const updateProjectFn = useServerFn(updateCompanyProject);
  const deleteProjectFn = useServerFn(deleteCompanyProject);
  const queryClient = useQueryClient();

  // Fetch from database with fallback to localStorage
  const { data: dbProjects } = useQuery({
    queryKey: ["company-projects", statusFilter, locationFilter, managerFilter, searchQuery],
    queryFn: async () => {
      try {
        const res = await listProjectsFn({
          data: {
            status: statusFilter,
            location: locationFilter,
            manager: managerFilter,
            search: searchQuery,
          },
        });
        return res;
      } catch (err) {
        return null;
      }
    },
    staleTime: 30000,
  });

  // Sync and persist projects
  const updateProject = (updated: Project) => {
    const next = projects.map((p) => (p.id === updated.id ? updated : p));
    setProjects(next);
    saveProjectsToStorage(next);
    if (detailProject && detailProject.id === updated.id) {
      setDetailProject(updated);
    }

    // Background DB sync if id is UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updated.id)) {
      updateProjectFn({
        data: {
          id: updated.id,
          name: updated.name,
          location: updated.location,
          notes: updated.notes,
          status: updated.status,
        },
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ["company-projects"] }))
        .catch(() => {});
    }
  };

  const handleCreateProject = () => {
    if (!newProjName.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم المشروع" : "Project name is required");
      return;
    }
    const generatedId = newProjId.trim() || `PRJ-${String(projects.length + 1).padStart(3, "0")}`;

    const newProject: Project = {
      id: generatedId,
      name: newProjName.trim(),
      name_ar: newProjNameAr.trim() || undefined,
      projectManager: {
        name: newProjManager,
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      },
      reportedManager: {
        name: newProjReportedManager,
        avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
      },
      location: newProjLocation,
      startDate: newProjStartDate,
      endDate: newProjEndDate,
      status: newProjStatus,
      notes: newProjNotes.trim() || "Project initialized.",
      notes_ar: newProjNotesAr.trim() || undefined,
      employeesCount: 5,
      completedTasksCount: 0,
      totalTasksCount: 4,
      employees: [
        { id: `e-${Date.now()}-1`, name: newProjManager, role: "Project Manager", department: "Project Management", email: `${newProjManager.toLowerCase().replace(/\s+/g, ".")}@integ.com` },
      ],
      tasks: [
        { id: `t-${Date.now()}-1`, title: "Kickoff Meeting & Resource Allocation", status: "in_progress", priority: "high", assignee: { name: newProjManager }, dueDate: "Jun 15, 2025" },
        { id: `t-${Date.now()}-2`, title: "Procurement & Site Preparation", status: "pending", priority: "medium", assignee: { name: newProjManager }, dueDate: "Jul 01, 2025" },
      ],
      files: [],
      updates: [
        { id: `u-${Date.now()}-1`, author: { name: newProjManager, role: "Project Manager" }, content: "Project created and team assigned.", timestamp: "Just now" },
      ],
    };

    const next = [newProject, ...projects];
    setProjects(next);
    saveProjectsToStorage(next);
    setSelectedProjectId(newProject.id);
    setIsNewProjectOpen(false);

    // Background DB insert
    createProjectFn({
      data: {
        project_code: newProject.id,
        name: newProject.name,
        project_manager_name: newProject.projectManager.name,
        reported_manager_name: newProject.reportedManager.name,
        location: newProject.location,
        start_date: "2025-05-01",
        end_date: "2025-08-31",
        notes: newProject.notes,
        status: newProject.status,
      },
    })
      .then((created: any) => {
        queryClient.invalidateQueries({ queryKey: ["company-projects"] });
        if (created?.id) {
          setProjects((prev) =>
            prev.map((p) => (p.id === newProject.id ? { ...p, id: created.id, code: newProject.id } : p))
          );
        }
      })
      .catch((err) => {
        console.warn("DB insert fallback to local storage:", err);
      });

    // Reset inputs
    setNewProjId("");
    setNewProjName("");
    setNewProjNameAr("");
    setNewProjNotes("");
    setNewProjNotesAr("");
    toast.success(isAr ? "تم إنشاء المشروع بنجاح" : "Project created successfully");
  };

  const handleDeleteProject = (projId: string) => {
    if (confirm(isAr ? "هل أنت متأكد من حذف هذا المشروع؟" : "Are you sure you want to delete this project?")) {
      const next = projects.filter((p) => p.id !== projId);
      setProjects(next);
      saveProjectsToStorage(next);
      if (selectedProjectId === projId && next.length > 0) {
        setSelectedProjectId(next[0].id);
      }

      // Background DB delete if UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projId)) {
        deleteProjectFn({ data: { id: projId } })
          .then(() => queryClient.invalidateQueries({ queryKey: ["company-projects"] }))
          .catch(() => {});
      }
      toast.success(isAr ? "تم حذف المشروع" : "Project deleted");
    }
  };

  // Counts for status tabs
  const countAll = projects.length;
  const countOngoing = projects.filter((p) => p.status === "ongoing").length;
  const countUpcoming = projects.filter((p) => p.status === "upcoming").length;
  const countCompleted = projects.filter((p) => p.status === "completed").length;
  const countOnHold = projects.filter((p) => p.status === "on_hold").length;

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // 1. Status Tab filter
      if (statusTab !== "all" && p.status !== statusTab) return false;

      // 2. Dropdown Status filter
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      // 3. Location filter
      if (locationFilter !== "all" && p.location !== locationFilter) return false;

      // 4. Manager filter
      if (managerFilter !== "all" && p.projectManager.name !== managerFilter) return false;

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = p.id.toLowerCase().includes(q);
        const matchesName = p.name.toLowerCase().includes(q) || (p.name_ar && p.name_ar.toLowerCase().includes(q));
        const matchesPm = p.projectManager.name.toLowerCase().includes(q);
        const matchesRm = p.reportedManager.name.toLowerCase().includes(q);
        const matchesLoc = p.location.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesPm && !matchesRm && !matchesLoc) return false;
      }

      return true;
    });
  }, [projects, statusTab, statusFilter, locationFilter, managerFilter, searchQuery]);

  // Selected project for bottom drawer card
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Unique lists for filter dropdowns
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.location)));
  }, [projects]);

  const uniqueManagers = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.projectManager.name)));
  }, [projects]);

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

  // If a project detail view is active, render Image 2
  if (detailProject) {
    return (
      <ProjectDetailView
        project={detailProject}
        onBack={() => setDetailProject(null)}
        onUpdateProject={updateProject}
        role={role}
        initialTab={detailInitialTab}
      />
    );
  }

  // Otherwise render Image 1 (Projects Overview & Table)
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Folder className="h-6 w-6 fill-orange-500/20" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {isAr ? "إدارة المشاريع" : "Projects"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isAr ? "إدارة ومتابعة مشاريع الشركة، والمهام الميدانية، والفرق المعينة" : "Manage company projects, assignments, and related tasks"}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsNewProjectOpen(true)}
          className="h-11 gap-2 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 shadow-sm shadow-orange-600/20"
        >
          <Plus className="h-4 w-4" />
          {isAr ? "مشروع جديد" : "+ New Project"}
        </Button>
      </div>

      {/* ── STATUS TABS ── */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusTab("all")}
            className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              statusTab === "all"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {isAr ? "جميع المشاريع" : "All Projects"} ({countAll})
          </button>

          <button
            onClick={() => setStatusTab("ongoing")}
            className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              statusTab === "ongoing"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {isAr ? "قيد التنفيذ" : "Ongoing"} ({countOngoing})
          </button>

          <button
            onClick={() => setStatusTab("upcoming")}
            className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              statusTab === "upcoming"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {isAr ? "قادمة" : "Upcoming"} ({countUpcoming})
          </button>

          <button
            onClick={() => setStatusTab("completed")}
            className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              statusTab === "completed"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {isAr ? "مكتملة" : "Completed"} ({countCompleted})
          </button>

          <button
            onClick={() => setStatusTab("on_hold")}
            className={`py-3 px-4 border-b-2 font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
              statusTab === "on_hold"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {isAr ? "معلقة" : "On Hold"} ({countOnHold})
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTER BAR ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        {/* Search */}
        <div className="lg:col-span-4 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isAr ? "بحث بالرمز، الاسم، أو المدير..." : "Search by Proj-ID, name, or manager..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-card border-border text-xs"
          />
        </div>

        {/* Location Dropdown */}
        <div className="lg:col-span-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-brand"
          >
            <option value="all">{isAr ? "جميع المواقع" : "All Locations"}</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Manager Dropdown */}
        <div className="lg:col-span-2">
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-brand"
          >
            <option value="all">{isAr ? "جميع المديرين" : "All Managers"}</option>
            {uniqueManagers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Status Dropdown */}
        <div className="lg:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-brand"
          >
            <option value="all">{isAr ? "جميع الحالات" : "All Status"}</option>
            <option value="ongoing">{isAr ? "قيد التنفيذ" : "Ongoing"}</option>
            <option value="upcoming">{isAr ? "قادم" : "Upcoming"}</option>
            <option value="completed">{isAr ? "مكتمل" : "Completed"}</option>
            <option value="on_hold">{isAr ? "معلق" : "On Hold"}</option>
          </select>
        </div>

        {/* Date Range Button */}
        <div className="lg:col-span-2">
          <Button
            variant="outline"
            className="w-full h-10 justify-start gap-2 rounded-xl text-xs font-medium border-border bg-card"
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{isAr ? "النطاق الزمني" : "Date Range"}</span>
          </Button>
        </div>
      </div>

      {/* ── PROJECTS TABLE ── */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/80">
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "الرمز" : "Proj-ID"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "اسم المشروع" : "Name"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "مدير المشروع" : "Project Manager"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "المدير المباشر" : "Reported Manager"}</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">{isAr ? "فريق العمل" : "Employees"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "الموقع" : "Locations"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "تاريخ البدء" : "Start Date"}</th>
                <th className="py-3 px-3.5 whitespace-nowrap">{isAr ? "تاريخ الانتهاء" : "End Date"}</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">{isAr ? "ملاحظات" : "Notes"}</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">{isAr ? "المهام" : "Tasks"}</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">{isAr ? "الحالة" : "Status"}</th>
                <th className="py-3 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((proj) => {
                  const isSelected = selectedProjectId === proj.id;
                  const completedT = proj.tasks.filter((t) => t.status === "completed").length;
                  const totalT = proj.tasks.length || proj.totalTasksCount || 1;

                  return (
                    <tr
                      key={proj.id}
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-orange-500/5 dark:bg-orange-500/10 hover:bg-orange-500/8"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      {/* Proj-ID */}
                      <td className="py-3.5 px-3.5 font-mono font-bold text-orange-600 dark:text-orange-400">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailProject(proj);
                            setDetailInitialTab("details");
                          }}
                          className="hover:underline text-left"
                        >
                          {proj.id}
                        </button>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-3.5 font-semibold text-foreground max-w-[200px] truncate">
                        {isAr ? proj.name_ar || proj.name : proj.name}
                      </td>

                      {/* Project Manager */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full overflow-hidden bg-brand/10 border border-brand/20 shrink-0">
                            {proj.projectManager.avatarUrl ? (
                              <img src={proj.projectManager.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-brand">
                                {proj.projectManager.name.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-foreground whitespace-nowrap">{proj.projectManager.name}</span>
                        </div>
                      </td>

                      {/* Reported Manager */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full overflow-hidden bg-muted border border-border shrink-0">
                            {proj.reportedManager.avatarUrl ? (
                              <img src={proj.reportedManager.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                {proj.reportedManager.name.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-foreground whitespace-nowrap">{proj.reportedManager.name}</span>
                        </div>
                      </td>

                      {/* Employees count */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-mono font-medium">
                          <Users className="h-3.5 w-3.5" />
                          {proj.employees.length || proj.employeesCount}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3.5 text-muted-foreground whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {proj.location}
                        </span>
                      </td>

                      {/* Start Date */}
                      <td className="py-3.5 px-3.5 text-muted-foreground font-mono whitespace-nowrap">
                        {proj.startDate}
                      </td>

                      {/* End Date */}
                      <td className="py-3.5 px-3.5 text-muted-foreground font-mono whitespace-nowrap">
                        {proj.endDate}
                      </td>

                      {/* Notes icon */}
                      <td className="py-3.5 px-2 text-center">
                        <button
                          title={isAr ? proj.notes_ar || proj.notes : proj.notes}
                          onClick={(e) => {
                            e.stopPropagation();
                            toast(isAr ? proj.notes_ar || proj.notes : proj.notes);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </td>

                      {/* Tasks ratio */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                        {completedT} / {totalT}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3.5 text-center">
                        {getStatusBadge(proj.status)}
                      </td>

                      {/* Dropdown Menu */}
                      <td className="py-3.5 px-2 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="h-8 w-8 rounded-lg hover:bg-muted inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => {
                                setDetailProject(proj);
                                setDetailInitialTab("details");
                              }}
                              className="gap-2 text-xs"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {isAr ? "عرض التفاصيل" : "View Details"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDetailProject(proj);
                                setDetailInitialTab("tasks");
                              }}
                              className="gap-2 text-xs"
                            >
                              <ListTodo className="h-3.5 w-3.5" />
                              {isAr ? "إدارة المهام" : "Manage Tasks"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingProject(proj);
                              }}
                              className="gap-2 text-xs"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              {isAr ? "تعديل" : "Edit"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteProject(proj.id)}
                              className="gap-2 text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isAr ? "حذف المشروع" : "Delete Project"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground text-xs">
                    {isAr ? "لا توجد مشاريع مطابقة للبحث" : "No projects match your filter criteria"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── EXPANDED PREVIEW DRAWER / CARD (BOTTOM OF IMAGE 1) ── */}
      {selectedProject && (
        <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Folder className="h-4 w-4 fill-orange-500/20" />
              </div>
              <h3 className="font-bold text-base text-foreground">
                {selectedProject.id} – {isAr ? selectedProject.name_ar || selectedProject.name : selectedProject.name}
              </h3>
              {getStatusBadge(selectedProject.status)}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingProject(selectedProject)}
                className="h-8 gap-1.5 rounded-xl border-border hover:bg-muted text-xs font-medium"
              >
                <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                {isAr ? "تعديل" : "Edit"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDetailProject(selectedProject);
                  setDetailInitialTab("tasks");
                }}
                className="h-8 gap-1.5 rounded-xl border-border hover:bg-muted text-xs font-medium"
              >
                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                {isAr ? "إدارة المهام" : "Manage Tasks"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDetailProject(selectedProject);
                  setDetailInitialTab("details");
                }}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Key metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs pt-1">
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <User className="h-3 w-3" />
                {isAr ? "مدير المشروع" : "Project Manager"}
              </span>
              <p className="font-semibold text-foreground">{selectedProject.projectManager.name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Users className="h-3 w-3" />
                {isAr ? "المدير المباشر" : "Reported Manager"}
              </span>
              <p className="font-semibold text-foreground">{selectedProject.reportedManager.name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Users className="h-3 w-3" />
                {isAr ? "الموظفون" : "Employees"}
              </span>
              <p className="font-bold text-foreground font-mono">{selectedProject.employees.length || selectedProject.employeesCount}</p>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <MapPin className="h-3 w-3" />
                {isAr ? "الموقع" : "Locations"}
              </span>
              <p className="font-semibold text-foreground">{selectedProject.location}</p>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Calendar className="h-3 w-3" />
                {isAr ? "تاريخ الانتهاء" : "End Date"}
              </span>
              <p className="font-semibold text-foreground font-mono">{selectedProject.endDate}</p>
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <FileText className="h-3 w-3" />
                {isAr ? "ملاحظات" : "Notes"}
              </span>
              <p className="text-foreground/80 text-[11px] line-clamp-2 leading-relaxed">
                {isAr ? selectedProject.notes_ar || selectedProject.notes : selectedProject.notes}
              </p>
            </div>
          </div>

          {/* Related Tasks Progress */}
          <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 flex-1 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <CheckSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {isAr ? "المهام المرتبطة" : "Related Tasks"} (
                  {selectedProject.tasks.filter((t) => t.status === "completed").length} {isAr ? "من" : "of"}{" "}
                  {selectedProject.tasks.length} {isAr ? "مكتملة" : "completed"})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(
                        (selectedProject.tasks.filter((t) => t.status === "completed").length /
                          (selectedProject.tasks.length || 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-foreground">
                  {Math.round(
                    (selectedProject.tasks.filter((t) => t.status === "completed").length /
                      (selectedProject.tasks.length || 1)) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailProject(selectedProject);
                setDetailInitialTab("tasks");
              }}
              className="gap-1.5 rounded-xl border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/5 hover:border-orange-500 text-xs font-semibold shrink-0"
            >
              <span>{isAr ? "عرض جميع المهام" : "View All Tasks"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE NEW PROJECT ── */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-orange-500" />
              {isAr ? "إنشاء مشروع جديد" : "Create New Project"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{isAr ? "رمز المشروع" : "Project ID"}</Label>
                <Input
                  placeholder={`PRJ-${String(projects.length + 1).padStart(3, "0")}`}
                  value={newProjId}
                  onChange={(e) => setNewProjId(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>{isAr ? "اسم المشروع (EN) *" : "Project Name (EN) *"}</Label>
                <Input
                  placeholder="e.g. Data Center Modernization"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{isAr ? "اسم المشروع (عربي)" : "Project Name (AR)"}</Label>
              <Input
                placeholder="تحديث مركز البيانات الرئيسي"
                value={newProjNameAr}
                onChange={(e) => setNewProjNameAr(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isAr ? "مدير المشروع" : "Project Manager"}</Label>
                <Input value={newProjManager} onChange={(e) => setNewProjManager(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{isAr ? "المدير المباشر" : "Reported Manager"}</Label>
                <Input value={newProjReportedManager} onChange={(e) => setNewProjReportedManager(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isAr ? "الموقع" : "Location"}</Label>
                <Input value={newProjLocation} onChange={(e) => setNewProjLocation(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{isAr ? "الحالة الأولية" : "Initial Status"}</Label>
                <select
                  value={newProjStatus}
                  onChange={(e: any) => setNewProjStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isAr ? "تاريخ البدء" : "Start Date"}</Label>
                <Input value={newProjStartDate} onChange={(e) => setNewProjStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{isAr ? "تاريخ الانتهاء" : "End Date"}</Label>
                <Input value={newProjEndDate} onChange={(e) => setNewProjEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{isAr ? "الوصف والملاحظات" : "Notes & Description"}</Label>
              <Textarea
                rows={3}
                placeholder="Brief summary of goals, scope, and deliverables..."
                value={newProjNotes}
                onChange={(e) => setNewProjNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewProjectOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateProject} className="bg-orange-600 hover:bg-orange-700 text-white">
              {isAr ? "إنشاء المشروع" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: EDIT PROJECT ── */}
      {editingProject && (
        <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-orange-500" />
                {isAr ? "تعديل بيانات المشروع" : "Edit Project Details"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2 text-xs">
              <div className="space-y-1">
                <Label>{isAr ? "اسم المشروع" : "Project Name"}</Label>
                <Input
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{isAr ? "الموقع" : "Location"}</Label>
                  <Input
                    value={editingProject.location}
                    onChange={(e) => setEditingProject({ ...editingProject, location: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{isAr ? "الحالة" : "Status"}</Label>
                  <select
                    value={editingProject.status}
                    onChange={(e: any) => setEditingProject({ ...editingProject, status: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{isAr ? "تاريخ البدء" : "Start Date"}</Label>
                  <Input
                    value={editingProject.startDate}
                    onChange={(e) => setEditingProject({ ...editingProject, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{isAr ? "تاريخ الانتهاء" : "End Date"}</Label>
                  <Input
                    value={editingProject.endDate}
                    onChange={(e) => setEditingProject({ ...editingProject, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{isAr ? "الوصف والملاحظات" : "Notes & Description"}</Label>
                <Textarea
                  rows={3}
                  value={editingProject.notes}
                  onChange={(e) => setEditingProject({ ...editingProject, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProject(null)}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  updateProject(editingProject);
                  setEditingProject(null);
                  toast.success(isAr ? "تم حفظ التعديلات" : "Project updated");
                }}
                className="bg-brand text-brand-foreground"
              >
                {isAr ? "حفظ التعديلات" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
