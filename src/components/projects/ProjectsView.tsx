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
  X,
  Check,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Project, ProjectEmployee, formatProjectCode } from "@/lib/projects/projects.data";
import { ProjectDetailView } from "./ProjectDetailView";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { SearchableManagerSelect } from "./SearchableManagerSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
  getCompanyProject,
  createCompanyProject,
  updateCompanyProject,
  deleteCompanyProject,
  listProjectAssignablePeople,
} from "@/backend/functions/projects.functions";

interface ProjectsViewProps {
  role?: "admin" | "manager";
}

export function ProjectsView({ role = "admin" }: ProjectsViewProps) {
  const { isAr } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
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
  const [newProjManager, setNewProjManager] = useState("");
  const [newProjReportedManager, setNewProjReportedManager] = useState("");
  const [newProjLocation, setNewProjLocation] = useState("Head Office");
  const [newProjStartDate, setNewProjStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newProjEndDate, setNewProjEndDate] = useState("");
  const [newProjStatus, setNewProjStatus] = useState<Project["status"]>("ongoing");
  const [newProjNotes, setNewProjNotes] = useState("");
  const [newProjNotesAr, setNewProjNotesAr] = useState("");

  // Edit Project Dialog state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editEmployeeIds, setEditEmployeeIds] = useState<string[]>([]);
  const [isEditEmployeeDropdownOpen, setIsEditEmployeeDropdownOpen] = useState(false);
  const [editEmployeeSearchQuery, setEditEmployeeSearchQuery] = useState("");

  const handleStartEdit = (proj: Project) => {
    setEditingProject(proj);
    setEditEmployeeIds((proj.employees || []).map((e) => e.id));
    setEditEmployeeSearchQuery("");
  };

  // Multi-employee selection state for Create Project modal
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  // TanStack Start Server Functions
  const listProjectsFn = useServerFn(listCompanyProjects);
  const getProjectFn = useServerFn(getCompanyProject);
  const createProjectFn = useServerFn(createCompanyProject);
  const updateProjectFn = useServerFn(updateCompanyProject);
  const deleteProjectFn = useServerFn(deleteCompanyProject);
  const listAssignablePeopleFn = useServerFn(listProjectAssignablePeople);
  const queryClient = useQueryClient();

  const { data: assignablePeople, isLoading: isPeopleLoading } = useQuery({
    queryKey: ["project-assignable-people"],
    queryFn: async () => {
      try {
        return await listAssignablePeopleFn();
      } catch (err) {
        console.warn("[listProjectAssignablePeople] query error:", err);
        return { managers: [], employees: [] };
      }
    },
    staleTime: 60000,
  });

  // Database-driven Managers list
  const availableManagers = useMemo(() => {
    return assignablePeople?.managers || [];
  }, [assignablePeople]);

  // Database-driven Employees list
  const availableEmployees = useMemo<ProjectEmployee[]>(() => {
    return assignablePeople?.employees || [];
  }, [assignablePeople]);

  // Set default managers when list loads from DB
  React.useEffect(() => {
    if (availableManagers.length > 0) {
      if (!newProjManager) {
        setNewProjManager(availableManagers[0].name);
      }
      if (!newProjReportedManager) {
        setNewProjReportedManager(availableManagers[1]?.name || availableManagers[0].name);
      }
    }
  }, [availableManagers, newProjManager, newProjReportedManager]);

  // Filtered employees for dropdown search
  const filteredSelectableEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return availableEmployees;
    const q = employeeSearchQuery.toLowerCase().trim();
    return availableEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [availableEmployees, employeeSearchQuery]);

  const filteredEditSelectableEmployees = useMemo(() => {
    if (!editEmployeeSearchQuery.trim()) return availableEmployees;
    const q = editEmployeeSearchQuery.toLowerCase().trim();
    return availableEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [availableEmployees, editEmployeeSearchQuery]);

  // Fetch projects strictly from database
  const {
    data: dbProjects,
    isLoading: isProjectsLoading,
    refetch: refetchProjects,
  } = useQuery({
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
        return (res as Project[]) || [];
      } catch (err) {
        console.warn("[company-projects query]", err);
        return [];
      }
    },
    staleTime: 5000,
  });

  // Sync state when DB projects load
  React.useEffect(() => {
    if (dbProjects) {
      setProjects(dbProjects);
      if (dbProjects.length > 0) {
        if (!selectedProjectId || !dbProjects.some((p) => p.id === selectedProjectId)) {
          setSelectedProjectId(dbProjects[0].id);
        }
      } else {
        setSelectedProjectId("");
      }
    }
  }, [dbProjects, selectedProjectId]);

  // Open detail view with real-time DB enrichment
  const handleOpenDetail = async (
    proj: Project,
    tab: "details" | "employees" | "tasks" | "files" | "updates" = "details"
  ) => {
    setDetailInitialTab(tab);
    setDetailProject(proj);
    try {
      const full = await getProjectFn({ data: { id: proj.id } });
      if (full && full.id) {
        setDetailProject(full as any);
      }
    } catch (err) {
      console.warn("[handleOpenDetail] error:", err);
    }
  };

  // Sync project updates directly to DB
  const updateProject = async (updated: Project) => {
    try {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updated.id)) {
        await updateProjectFn({
          data: {
            id: updated.id,
            project_code: updated.code || undefined,
            name: updated.name,
            project_manager_name: updated.projectManager.name,
            project_manager_id: updated.projectManager.id || undefined,
            reported_manager_name: updated.reportedManager.name,
            reported_manager_id: updated.reportedManager.id || undefined,
            location: updated.location,
            notes: updated.notes,
            status: updated.status,
            start_date: updated.startDate || undefined,
            end_date: updated.endDate || undefined,
            initial_members: (updated.employees || []).map((e) => ({
              name: e.name,
              role: e.role,
              department: e.department,
              email: e.email,
              employee_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id) ? e.id : null,
            })),
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["company-projects"] });
      await refetchProjects();
      if (detailProject && detailProject.id === updated.id) {
        setDetailProject(updated);
      }
      toast.success(isAr ? "تم تحديث المشروع في قاعدة البيانات" : "Project updated in database");
    } catch (err: any) {
      console.error("[updateProject] error:", err);
      toast.error(err.message || (isAr ? "فشل تحديث المشروع" : "Failed to update project"));
    }
  };

  const handleCreateProject = async () => {
    if (!newProjName.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم المشروع" : "Project name is required");
      return;
    }
    const generatedCode = newProjId.trim() || `PROJ-${String(projects.length + 1).padStart(3, "0")}`;

    const assignedEmployeesList = availableEmployees.filter((e) =>
      selectedEmployeeIds.includes(e.id)
    );

    try {
      const created = await createProjectFn({
        data: {
          project_code: generatedCode,
          name: newProjName.trim(),
          project_manager_name: newProjManager || (availableManagers[0]?.name ?? "Unassigned"),
          reported_manager_name: newProjReportedManager || (availableManagers[1]?.name ?? availableManagers[0]?.name ?? "Unassigned"),
          location: newProjLocation || "Head Office",
          start_date: newProjStartDate || undefined,
          end_date: newProjEndDate || undefined,
          notes: newProjNotes.trim() || undefined,
          status: newProjStatus,
          initial_members: assignedEmployeesList.map((e) => ({
            employee_id: e.id,
            name: e.name,
            role: e.role,
            department: e.department,
            email: e.email,
          })),
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["company-projects"] });
      await refetchProjects();
      if (created?.id) {
        setSelectedProjectId(created.id);
      }
      setIsNewProjectOpen(false);
      setNewProjId("");
      setNewProjName("");
      setNewProjNameAr("");
      setNewProjNotes("");
      setNewProjNotesAr("");
      setSelectedEmployeeIds([]);
      toast.success(isAr ? "تم إنشاء المشروع بنجاح وحفظه في قاعدة البيانات" : "Project created successfully");
    } catch (err: any) {
      console.error("[handleCreateProject] error:", err);
      toast.error(err.message || (isAr ? "فشل إنشاء المشروع" : "Failed to create project"));
    }
  };

  const handleDeleteProject = async (projId: string) => {
    if (confirm(isAr ? "هل أنت متأكد من حذف هذا المشروع نهائياً؟" : "Are you sure you want to permanently delete this project?")) {
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projId)) {
          await deleteProjectFn({ data: { id: projId } });
        }
        await queryClient.invalidateQueries({ queryKey: ["company-projects"] });
        await refetchProjects();
        toast.success(isAr ? "تم حذف المشروع" : "Project deleted");
      } catch (err: any) {
        console.error("[handleDeleteProject] error:", err);
        toast.error(err.message || (isAr ? "فشل حذف المشروع" : "Failed to delete project"));
      }
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
        const matchesId = p.id.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q));
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
              {isProjectsLoading ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-muted-foreground text-xs">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                      <p className="font-medium text-muted-foreground">
                        {isAr ? "جاري تحميل المشاريع من قاعدة البيانات..." : "Loading projects from database..."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((proj) => {
                  const isSelected = selectedProjectId === proj.id;
                  const completedT = proj.tasks.filter((t) => t.status === "completed").length;
                  const totalT = proj.tasks.length || proj.totalTasksCount || 1;

                  return (
                    <tr
                      key={proj.id}
                      onClick={() => handleOpenDetail(proj, "details")}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? "bg-orange-500/5 dark:bg-orange-500/10 hover:bg-orange-500/10"
                          : "hover:bg-orange-500/5 dark:hover:bg-orange-500/10"
                      }`}
                    >
                      {/* Proj-ID */}
                      <td className="py-3.5 px-3.5 font-mono font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(proj, "details");
                          }}
                          className="hover:underline text-left inline-block"
                        >
                          {formatProjectCode(proj.code || proj.id, filteredProjects.indexOf(proj))}
                        </button>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-3.5 font-semibold text-foreground max-w-[200px] truncate">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(proj, "details");
                          }}
                          className="hover:underline hover:text-orange-600 dark:hover:text-orange-400 text-left font-semibold text-foreground truncate max-w-full inline-block transition-colors"
                        >
                          {isAr ? proj.name_ar || proj.name : proj.name}
                        </button>
                      </td>

                      {/* Project Manager */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar
                            id={proj.projectManager.id || proj.projectManager.name}
                            name={proj.projectManager.name}
                            url={proj.projectManager.avatarUrl}
                            className="h-7 w-7 rounded-full shrink-0"
                            fallbackClassName="text-[10px]"
                          />
                          <span className="font-medium text-foreground whitespace-nowrap">{proj.projectManager.name}</span>
                        </div>
                      </td>

                      {/* Reported Manager */}
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar
                            id={proj.reportedManager.id || proj.reportedManager.name}
                            name={proj.reportedManager.name}
                            url={proj.reportedManager.avatarUrl}
                            className="h-7 w-7 rounded-full shrink-0"
                            fallbackClassName="text-[10px]"
                          />
                          <span className="font-medium text-foreground whitespace-nowrap">{proj.reportedManager.name}</span>
                        </div>
                      </td>

                      {/* Employees count */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(proj, "employees");
                          }}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-orange-600 dark:hover:text-orange-400 font-mono font-medium hover:underline"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span>{proj.employees.length || proj.employeesCount}</span>
                        </button>
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
                      <td className="py-3.5 px-3 text-center font-mono font-bold">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(proj, "tasks");
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-orange-600 dark:hover:text-orange-400 hover:underline"
                        >
                          {completedT} / {totalT}
                        </button>
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
                              onClick={() => handleOpenDetail(proj, "details")}
                              className="gap-2 text-xs"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {isAr ? "عرض التفاصيل" : "View Details"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenDetail(proj, "tasks")}
                              className="gap-2 text-xs"
                            >
                              <ListTodo className="h-3.5 w-3.5" />
                              {isAr ? "إدارة المهام" : "Manage Tasks"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                handleStartEdit(proj);
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
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-muted-foreground text-xs">
                    <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <Folder className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-sm text-foreground">
                          {isAr ? "لا توجد مشاريع في قاعدة البيانات" : "No projects found in database"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {isAr
                            ? "انقر فوق زر \"مشروع جديد\" لإنشاء أول مشروع للشركة مع تعيين المديرين وفريق العمل."
                            : "Click '+ New Project' above to create your first company project with real team assignments."}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsNewProjectOpen(true)}
                        className="mt-1 h-8 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isAr ? "مشروع جديد" : "+ New Project"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground text-xs">
                    {isAr ? "لا توجد مشاريع مطابقة للبحث أو التصفية" : "No projects match your filter criteria"}
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
              <h3
                onClick={() => handleOpenDetail(selectedProject, "details")}
                className="font-bold text-base text-foreground cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 hover:underline flex items-center gap-1.5 transition-colors"
                title={isAr ? "انقر لفتح تفاصيل المشروع" : "Click to view project details"}
              >
                {formatProjectCode(selectedProject.code || selectedProject.id, projects.indexOf(selectedProject))} – {isAr ? selectedProject.name_ar || selectedProject.name : selectedProject.name}
              </h3>
              {getStatusBadge(selectedProject.status)}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => handleOpenDetail(selectedProject, "details")}
                className="h-8 gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {isAr ? "عرض التفاصيل" : "View Details"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartEdit(selectedProject)}
                className="h-8 gap-1.5 rounded-xl border-border hover:bg-muted text-xs font-medium"
              >
                <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                {isAr ? "تعديل" : "Edit"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenDetail(selectedProject, "tasks")}
                className="h-8 gap-1.5 rounded-xl border-border hover:bg-muted text-xs font-medium"
              >
                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                {isAr ? "إدارة المهام" : "Manage Tasks"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenDetail(selectedProject, "details")}
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
              <div className="flex items-center gap-1.5 pt-0.5">
                <EmployeeAvatar
                  id={selectedProject.projectManager.id || selectedProject.projectManager.name}
                  name={selectedProject.projectManager.name}
                  url={selectedProject.projectManager.avatarUrl}
                  className="h-5 w-5 rounded-full shrink-0"
                  fallbackClassName="text-[8px]"
                />
                <p className="font-semibold text-foreground truncate">{selectedProject.projectManager.name}</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Users className="h-3 w-3" />
                {isAr ? "المدير المباشر" : "Reported Manager"}
              </span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <EmployeeAvatar
                  id={selectedProject.reportedManager.id || selectedProject.reportedManager.name}
                  name={selectedProject.reportedManager.name}
                  url={selectedProject.reportedManager.avatarUrl}
                  className="h-5 w-5 rounded-full shrink-0"
                  fallbackClassName="text-[8px]"
                />
                <p className="font-semibold text-foreground truncate">{selectedProject.reportedManager.name}</p>
              </div>
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
              onClick={() => handleOpenDetail(selectedProject, "tasks")}
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
        <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Folder className="h-5 w-5" />
              </div>
              <span>{isAr ? "إنشاء مشروع جديد" : "Create New Project"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            {/* Row 1: Code & Name (EN) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "رمز المشروع" : "Project ID"}</Label>
                <Input
                  placeholder={`PROJ-${String(projects.length + 1).padStart(3, "0")}`}
                  value={newProjId}
                  onChange={(e) => setNewProjId(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "اسم المشروع (EN) *" : "Project Name (EN) *"}</Label>
                <Input
                  placeholder="e.g. Data Center Modernization"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            {/* Row 2: Name (AR) & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "اسم المشروع (عربي)" : "Project Name (AR)"}</Label>
                <Input
                  placeholder="تحديث مركز البيانات الرئيسي"
                  value={newProjNameAr}
                  onChange={(e) => setNewProjNameAr(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "الموقع" : "Location"}</Label>
                <Input
                  value={newProjLocation}
                  onChange={(e) => setNewProjLocation(e.target.value)}
                  placeholder="e.g. Head Office / Riyadh / Cairo"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            {/* Row 3: Managers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "مدير المشروع" : "Project Manager"}</Label>
                <SearchableManagerSelect
                  value={newProjManager}
                  onChange={(m) => setNewProjManager(m.name)}
                  options={availableManagers}
                  placeholder={isAr ? "اختر مدير المشروع..." : "Select project manager..."}
                  isAr={isAr}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "المدير المباشر" : "Reported Manager"}</Label>
                <SearchableManagerSelect
                  value={newProjReportedManager}
                  onChange={(m) => setNewProjReportedManager(m.name)}
                  options={availableManagers}
                  placeholder={isAr ? "اختر المدير المباشر..." : "Select reported manager..."}
                  isAr={isAr}
                />
              </div>
            </div>

            {/* Row 4: Multi-Select Assigned Employees Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 font-semibold text-foreground/90">
                  <Users className="h-3.5 w-3.5 text-orange-500" />
                  {isAr ? "تعيين أعضاء الفريق (تحديد متعدد من قاعدة البيانات)" : "Assign Team Employees (Multi-Select)"}
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {selectedEmployeeIds.length} {isAr ? "موظف محدد" : "employees selected"}
                </span>
              </div>

              <Popover open={isEmployeeDropdownOpen} onOpenChange={setIsEmployeeDropdownOpen}>
                <PopoverTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    className="min-h-[46px] w-full rounded-xl border border-input bg-background p-2 text-xs cursor-pointer flex flex-wrap items-center gap-1.5 hover:border-orange-500/50 transition-colors focus:ring-1 focus:ring-brand shadow-2xs"
                  >
                    {selectedEmployeeIds.length === 0 ? (
                      <span className="text-muted-foreground px-2 py-1 select-none">
                        {isAr ? "اختر موظفين لتعيينهم في المشروع..." : "Click to select employees from database..."}
                      </span>
                    ) : (
                      selectedEmployeeIds.map((empId) => {
                        const emp = availableEmployees.find((e) => e.id === empId);
                        if (!emp) return null;
                        return (
                          <span
                            key={emp.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20 px-2.5 py-1 text-[11px] font-medium"
                          >
                            <span>{emp.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmployeeIds((prev) => prev.filter((id) => id !== emp.id));
                              }}
                              className="hover:text-rose-600 rounded-sm"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })
                    )}
                    <div className="ms-auto pe-2 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </PopoverTrigger>

                <PopoverContent className="w-[680px] max-w-[90vw] p-0 rounded-2xl shadow-xl border border-border" align="start">
                  <div className="p-3 border-b border-border/60 bg-muted/30 space-y-2.5">
                    <div className="relative">
                      <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder={isAr ? "بحث عن موظف بالاسم أو التخصص..." : "Search employee name, role, department..."}
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        className="h-9 ps-8 text-xs rounded-xl bg-background"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                      <span>{filteredSelectableEmployees.length} {isAr ? "موظف متاح بقاعدة البيانات" : "employees available in DB"}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeIds(availableEmployees.map((e) => e.id))}
                          className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                        >
                          {isAr ? "تحديد الكل" : "Select All"}
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeIds([])}
                          className="text-muted-foreground hover:text-foreground font-semibold"
                        >
                          {isAr ? "مسح" : "Clear"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-border/40 p-1">
                    {filteredSelectableEmployees.map((emp) => {
                      const isSelected = selectedEmployeeIds.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployeeIds((prev) =>
                              isSelected ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                            );
                          }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                            isSelected ? "bg-orange-500/10" : "hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox checked={isSelected} className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600" />
                          <EmployeeAvatar
                            id={emp.id}
                            name={emp.name}
                            url={emp.avatarUrl}
                            className="h-8 w-8 rounded-full shrink-0"
                            fallbackClassName="text-[10px]"
                          />
                          <div className="min-w-0 flex-1 text-xs">
                            <p className="font-semibold text-foreground truncate">{emp.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{emp.role} • {emp.department}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Row 5: Dates & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "تاريخ البدء" : "Start Date"}</Label>
                <Input
                  type="date"
                  value={newProjStartDate}
                  onChange={(e) => setNewProjStartDate(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "تاريخ الانتهاء" : "End Date"}</Label>
                <Input
                  type="date"
                  value={newProjEndDate}
                  onChange={(e) => setNewProjEndDate(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "الحالة الأولية" : "Initial Status"}</Label>
                <select
                  value={newProjStatus}
                  onChange={(e: any) => setNewProjStatus(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand shadow-2xs"
                >
                  <option value="ongoing">{isAr ? "قيد التنفيذ (Ongoing)" : "Ongoing"}</option>
                  <option value="upcoming">{isAr ? "قادم (Upcoming)" : "Upcoming"}</option>
                  <option value="completed">{isAr ? "مكتمل (Completed)" : "Completed"}</option>
                  <option value="on_hold">{isAr ? "معلق (On Hold)" : "On Hold"}</option>
                </select>
              </div>
            </div>

            {/* Row 6: Description */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground/90">{isAr ? "الوصف والملاحظات" : "Notes & Description"}</Label>
              <Textarea
                rows={3}
                placeholder="Brief summary of goals, scope, and deliverables..."
                value={newProjNotes}
                onChange={(e) => setNewProjNotes(e.target.value)}
                className="rounded-xl resize-none text-xs"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 pt-3 gap-2">
            <Button variant="outline" onClick={() => setIsNewProjectOpen(false)} className="rounded-xl h-10 px-5 text-xs font-semibold">
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateProject} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-10 px-6 text-xs font-semibold shadow-sm shadow-orange-600/20">
              {isAr ? "إنشاء المشروع" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: EDIT PROJECT ── */}
      {editingProject && (
        <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
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
              {/* Row 1: Code & Name (EN) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "رمز المشروع" : "Project ID / Code"}</Label>
                  <Input
                    value={editingProject.code || formatProjectCode(editingProject.id)}
                    onChange={(e) => setEditingProject({ ...editingProject, code: e.target.value })}
                    className="h-10 rounded-xl font-mono"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "اسم المشروع (EN) *" : "Project Name (EN) *"}</Label>
                  <Input
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Row 2: Name (AR) & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "اسم المشروع (عربي)" : "Project Name (AR)"}</Label>
                  <Input
                    value={editingProject.name_ar || editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name_ar: e.target.value })}
                    placeholder="تحديث مركز البيانات الرئيسي"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "الموقع" : "Location"}</Label>
                  <Input
                    value={editingProject.location}
                    onChange={(e) => setEditingProject({ ...editingProject, location: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Row 3: Managers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "مدير المشروع" : "Project Manager"}</Label>
                  <SearchableManagerSelect
                    value={editingProject.projectManager.name}
                    onChange={(m) =>
                      setEditingProject({
                        ...editingProject,
                        projectManager: {
                          ...editingProject.projectManager,
                          name: m.name,
                          id: m.id || editingProject.projectManager.id,
                          avatarUrl: m.avatarUrl,
                        },
                      })
                    }
                    options={availableManagers}
                    placeholder={isAr ? "اختر مدير المشروع..." : "Select project manager..."}
                    isAr={isAr}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "المدير المباشر" : "Reported Manager"}</Label>
                  <SearchableManagerSelect
                    value={editingProject.reportedManager.name}
                    onChange={(m) =>
                      setEditingProject({
                        ...editingProject,
                        reportedManager: {
                          ...editingProject.reportedManager,
                          name: m.name,
                          id: m.id || editingProject.reportedManager.id,
                          avatarUrl: m.avatarUrl,
                        },
                      })
                    }
                    options={availableManagers}
                    placeholder={isAr ? "اختر المدير المباشر..." : "Select reported manager..."}
                    isAr={isAr}
                  />
                </div>
              </div>

              {/* Row 4: Assigned Team Members Popover */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-foreground/90">
                    {isAr ? "أعضاء فريق المشروع المكلفون" : "Assigned Team Members / Employees"}
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {editEmployeeIds.length} {isAr ? "موظف محدد" : "employees selected"}
                  </span>
                </div>

                <Popover open={isEditEmployeeDropdownOpen} onOpenChange={setIsEditEmployeeDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-auto min-h-[42px] justify-between text-left font-normal rounded-xl border-input bg-background hover:bg-muted/30 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 max-w-[85%]">
                        {editEmployeeIds.length === 0 ? (
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {isAr ? "اختر موظفي المشروع..." : "Select team members from database..."}
                          </span>
                        ) : (
                          availableEmployees
                            .filter((e) => editEmployeeIds.includes(e.id))
                            .slice(0, 4)
                            .map((emp) => (
                              <Badge
                                key={emp.id}
                                variant="secondary"
                                className="gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[11px] px-2 py-0.5 rounded-lg"
                              >
                                <UserCheck className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{emp.name.split(" ")[0]}</span>
                              </Badge>
                            ))
                        )}
                        {editEmployeeIds.length > 4 && (
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 rounded-lg">
                            +{editEmployeeIds.length - 4} {isAr ? "آخرين" : "more"}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-70" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent align="start" className="w-[420px] sm:w-[600px] md:w-[680px] p-2 rounded-2xl shadow-xl">
                    <div className="p-2 border-b border-border/50 flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        placeholder={isAr ? "بحث بالاسم، الدور، أو الإدارة..." : "Search by name, role, or department..."}
                        value={editEmployeeSearchQuery}
                        onChange={(e) => setEditEmployeeSearchQuery(e.target.value)}
                        className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs"
                      />
                      {editEmployeeIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditEmployeeIds([])}
                          className="h-7 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {isAr ? "إلغاء التحديد" : "Clear all"}
                        </Button>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-border/40 p-1">
                      {filteredEditSelectableEmployees.map((emp) => {
                        const isSelected = editEmployeeIds.includes(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => {
                              setEditEmployeeIds((prev) =>
                                isSelected ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                              );
                            }}
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                              isSelected ? "bg-orange-500/10" : "hover:bg-muted/50"
                            }`}
                          >
                            <Checkbox checked={isSelected} className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600" />
                            <EmployeeAvatar
                              id={emp.id}
                              name={emp.name}
                              url={emp.avatarUrl}
                              className="h-8 w-8 rounded-full shrink-0"
                              fallbackClassName="text-[10px]"
                            />
                            <div className="min-w-0 flex-1 text-xs">
                              <p className="font-semibold text-foreground truncate">{emp.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{emp.role} • {emp.department}</p>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Row 5: Dates & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "تاريخ البدء" : "Start Date"}</Label>
                  <Input
                    value={editingProject.startDate}
                    onChange={(e) => setEditingProject({ ...editingProject, startDate: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "تاريخ الانتهاء" : "End Date"}</Label>
                  <Input
                    value={editingProject.endDate}
                    onChange={(e) => setEditingProject({ ...editingProject, endDate: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground/90">{isAr ? "الحالة" : "Status"}</Label>
                  <select
                    value={editingProject.status}
                    onChange={(e: any) => setEditingProject({ ...editingProject, status: e.target.value })}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand shadow-2xs"
                  >
                    <option value="ongoing">{isAr ? "قيد التنفيذ (Ongoing)" : "Ongoing"}</option>
                    <option value="upcoming">{isAr ? "قادم (Upcoming)" : "Upcoming"}</option>
                    <option value="completed">{isAr ? "مكتمل (Completed)" : "Completed"}</option>
                    <option value="on_hold">{isAr ? "معلق (On Hold)" : "On Hold"}</option>
                  </select>
                </div>
              </div>

              {/* Row 6: Notes */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground/90">{isAr ? "الوصف والملاحظات" : "Notes & Description"}</Label>
                <Textarea
                  rows={3}
                  value={editingProject.notes}
                  onChange={(e) => setEditingProject({ ...editingProject, notes: e.target.value })}
                  className="rounded-xl resize-none text-xs"
                />
              </div>
            </div>
            <DialogFooter className="border-t border-border/60 pt-3 gap-2">
              <Button variant="outline" onClick={() => setEditingProject(null)} className="rounded-xl h-10 px-5 text-xs font-semibold">
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  const selectedEmps = availableEmployees.filter((e) => editEmployeeIds.includes(e.id));
                  updateProject({
                    ...editingProject,
                    employees: selectedEmps.length > 0 ? selectedEmps : editingProject.employees,
                    employeesCount: selectedEmps.length || editingProject.employeesCount,
                  });
                  setEditingProject(null);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-10 px-6 text-xs font-semibold shadow-sm shadow-orange-600/20"
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
