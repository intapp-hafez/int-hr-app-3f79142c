import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  Clock,
  Briefcase,
  Route as RouteIcon,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronRight,
  X,
  Loader2,
  FileDown,
  Filter,
  BarChart3,
  Plus,
  Play,
  MapPin,
  RefreshCw,
  User,
  ListFilter,
  Info,
  ExternalLink,
  ChevronDown,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  getTeamTimeOverview,
  getMonthlyTimeManagementReport,
  type TeamMemberTimeStatus,
  type MonthlyEmployeeTimeSummary,
} from "@/backend/functions/workday.functions";
import {
  listTasks,
  transitionTask as transitionTaskFn,
  createTask as createTaskFn,
} from "@/backend/functions/tasks.functions";
import { listEmployeesForAttendance } from "@/backend/functions/attendance.functions";
import { mapTaskRow, type TaskRow } from "@/lib/task-mapping";
import type { ManagerTask, TaskPriority, TaskStatus } from "@/lib/store";
import { MyWorkdayTimeline } from "@/components/employee/MyWorkdayTimeline";
import { TaskLocationPicker } from "@/components/admin/TaskLocationPicker";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type PeriodMode = "tasks" | "daily" | "monthly";

export function AdminTimeManagementView() {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("tasks");
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  // Daily View state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inspectorEmployee, setInspectorEmployee] = useState<{ id: string; name: string } | null>(null);

  // Server functions
  const getDailyFn = useServerFn(getTeamTimeOverview);
  const getMonthlyFn = useServerFn(getMonthlyTimeManagementReport);
  const listTasksFn = useServerFn(listTasks);
  const transitionFn = useServerFn(transitionTaskFn);
  const createTaskServerFn = useServerFn(createTaskFn);
  const listEmployeesFn = useServerFn(listEmployeesForAttendance);

  // ── 1. Real Tasks Query ──
  const tasksQuery = useQuery({
    queryKey: ["tasks-db"],
    queryFn: () => listTasksFn(),
    refetchInterval: periodMode === "tasks" ? 30000 : false,
  });

  const employeesQuery = useQuery({
    queryKey: ["admin", "attendance", "employees"],
    queryFn: () => listEmployeesFn(),
  });
  const employeeList = employeesQuery.data ?? [];

  // ── 2. Cities & Districts from Database ──
  const { data: geoData } = useQuery({
    queryKey: ["geo", "cities-districts"],
    queryFn: async () => {
      const [{ data: cities }, { data: districts }] = await Promise.all([
        supabase.from("cities").select("id, name_en, name_ar").order("name_en"),
        supabase.from("districts").select("id, city_id, name_en, name_ar").order("name_en"),
      ]);
      return { cities: cities ?? [], districts: districts ?? [] };
    },
    staleTime: 5 * 60_000,
  });
  const dbCities = geoData?.cities ?? [];
  const dbDistricts = geoData?.districts ?? [];

  const rawTasks = (tasksQuery.data ?? []) as TaskRow[];
  const tasks = useMemo(() => rawTasks.map(mapTaskRow), [rawTasks]);

  // Tasks Filter State
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskStatus>("all");
  const [taskEmployeeFilter, setTaskEmployeeFilter] = useState<string>("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>("all");
  const [taskDateFilter, setTaskDateFilter] = useState<string>("");
  const [taskSearch, setTaskSearch] = useState<string>("");

  const [selectedTaskDetails, setSelectedTaskDetails] = useState<ManagerTask | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    due_date: todayStr,
    due_time: "17:00",
    estimated_hours: "2",
    cityId: "",
    districtId: "",
    city: "",
    district: "",
    address: "",
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    radius_m: 200,
    showMap: false,
    assignees: [] as string[],
  });

  // Filtered districts based on chosen city
  const availableDistricts = useMemo(() => {
    if (!createForm.cityId) return dbDistricts;
    return dbDistricts.filter((d: any) => d.city_id === createForm.cityId);
  }, [dbDistricts, createForm.cityId]);

  // Filtered employee list in assignee selector
  const filteredEmployeeList = useMemo(() => {
    if (!assigneeSearch.trim()) return employeeList;
    const q = assigneeSearch.toLowerCase();
    return employeeList.filter((e: any) => e.name.toLowerCase().includes(q));
  }, [employeeList, assigneeSearch]);

  function handleCityChange(cityId: string) {
    const foundCity = dbCities.find((c: any) => c.id === cityId);
    const cityName = foundCity
      ? isAr
        ? foundCity.name_ar || foundCity.name_en
        : foundCity.name_en || foundCity.name_ar
      : "";

    // Check if current district still belongs to new city
    const districtStillValid = dbDistricts.some(
      (d: any) => d.id === createForm.districtId && d.city_id === cityId
    );

    setCreateForm((prev) => ({
      ...prev,
      cityId,
      city: cityName,
      districtId: districtStillValid ? prev.districtId : "",
      district: districtStillValid ? prev.district : "",
    }));
  }

  function handleDistrictChange(districtId: string) {
    const foundDist = dbDistricts.find((d: any) => d.id === districtId);
    const distName = foundDist
      ? isAr
        ? foundDist.name_ar || foundDist.name_en
        : foundDist.name_en || foundDist.name_ar
      : "";

    // If district has a parent city, automatically select it if not already selected
    let newCityId = createForm.cityId;
    let newCity = createForm.city;
    if (foundDist && foundDist.city_id && (!createForm.cityId || createForm.cityId !== foundDist.city_id)) {
      newCityId = foundDist.city_id;
      const parentCity = dbCities.find((c: any) => c.id === foundDist.city_id);
      if (parentCity) {
        newCity = isAr ? parentCity.name_ar || parentCity.name_en : parentCity.name_en || parentCity.name_ar;
      }
    }

    setCreateForm((prev) => ({
      ...prev,
      districtId,
      district: distName,
      cityId: newCityId,
      city: newCity,
    }));
  }

  function toggleSelectAllAssignees() {
    if (createForm.assignees.length === employeeList.length) {
      setCreateForm((prev) => ({ ...prev, assignees: [] }));
    } else {
      setCreateForm((prev) => ({ ...prev, assignees: employeeList.map((e: any) => e.id) }));
    }
  }

  // Handle location selection on map with automatic address reverse-geocoding
  async function handleLocationPicked(lat?: number, lng?: number, radius_m?: number) {
    setCreateForm((prev) => ({
      ...prev,
      lat,
      lng,
      radius_m: radius_m !== undefined ? radius_m : prev.radius_m,
    }));

    if (lat == null || lng == null) return;

    try {
      setIsGeocodingAddress(true);
      const geo = await reverseGeocodeCoords(lat, lng, isAr ? "ar" : "en");
      const autoAddress = geo.detailedAddress || geo.street || geo.formatted || "";

      if (autoAddress) {
        setCreateForm((prev) => {
          let updatedCityId = prev.cityId;
          let updatedCity = prev.city;
          let updatedDistrictId = prev.districtId;
          let updatedDistrict = prev.district;

          // If city not chosen yet, try to auto-match from dbCities
          if (!updatedCityId && geo.city) {
            const normCity = geo.city.trim().toLowerCase();
            const foundCity = dbCities.find(
              (c: any) =>
                (c.name_en && c.name_en.trim().toLowerCase() === normCity) ||
                (c.name_ar && c.name_ar.trim().toLowerCase() === normCity) ||
                normCity.includes((c.name_en || "").toLowerCase()) ||
                normCity.includes((c.name_ar || "").toLowerCase())
            );
            if (foundCity) {
              updatedCityId = foundCity.id;
              updatedCity = isAr
                ? foundCity.name_ar || foundCity.name_en
                : foundCity.name_en || foundCity.name_ar;
            }
          }

          // If district not chosen yet, try to auto-match from dbDistricts
          if (!updatedDistrictId && geo.district) {
            const normDist = geo.district.trim().toLowerCase();
            const foundDist = dbDistricts.find(
              (d: any) =>
                (!updatedCityId || d.city_id === updatedCityId) &&
                ((d.name_en && d.name_en.trim().toLowerCase() === normDist) ||
                  (d.name_ar && d.name_ar.trim().toLowerCase() === normDist) ||
                  normDist.includes((d.name_en || "").toLowerCase()) ||
                  normDist.includes((d.name_ar || "").toLowerCase()))
            );
            if (foundDist) {
              updatedDistrictId = foundDist.id;
              updatedDistrict = isAr
                ? foundDist.name_ar || foundDist.name_en
                : foundDist.name_en || foundDist.name_ar;
              if (!updatedCityId && foundDist.city_id) {
                updatedCityId = foundDist.city_id;
                const parentCity = dbCities.find((c: any) => c.id === foundDist.city_id);
                if (parentCity) {
                  updatedCity = isAr
                    ? parentCity.name_ar || parentCity.name_en
                    : parentCity.name_en || parentCity.name_ar;
                }
              }
            }
          }

          return {
            ...prev,
            address: autoAddress,
            cityId: updatedCityId,
            city: updatedCity,
            districtId: updatedDistrictId,
            district: updatedDistrict,
          };
        });

        toast.success(
          isAr ? "تم تحديد وتعبئة العنوان تلقائياً من الخريطة" : "Address auto-filled from map"
        );
      }
    } catch {
      // ignore silently
    } finally {
      setIsGeocodingAddress(false);
    }
  }

  // Tasks KPI Totals
  const taskKpis = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const cancelled = tasks.filter((t) => t.status === "cancelled").length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, inProgress, cancelled, completionRate };
  }, [tasks]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      if (taskStatusFilter !== "all" && t.status !== taskStatusFilter) return false;
      if (taskPriorityFilter !== "all" && t.priority !== taskPriorityFilter) return false;
      if (taskEmployeeFilter !== "all" && !t.assignees.includes(taskEmployeeFilter)) return false;
      if (taskDateFilter && t.date !== taskDateFilter) return false;
      if (q) {
        const text = `${t.title} ${t.description} ${t.district ?? ""} ${t.city ?? ""} ${t.address ?? ""}`.toLowerCase();
        const empMatch = (t.assigneeProfiles ?? []).some(
          (p) => p.name.toLowerCase().includes(q) || (p.empCode && p.empCode.toLowerCase().includes(q))
        );
        if (!text.includes(q) && !empMatch) return false;
      }
      return true;
    });
  }, [tasks, taskStatusFilter, taskPriorityFilter, taskEmployeeFilter, taskDateFilter, taskSearch]);

  // Tasks Pagination
  const [tasksPageSize, setTasksPageSize] = useState(25);
  const [tasksPage, setTasksPage] = useState(1);
  useEffect(() => {
    setTasksPage(1);
  }, [taskSearch, taskStatusFilter, taskPriorityFilter, taskEmployeeFilter, taskDateFilter]);
  const totalTaskPages = Math.max(1, Math.ceil(filteredTasks.length / tasksPageSize));
  const paginatedTasks = useMemo(() => {
    const start = (tasksPage - 1) * tasksPageSize;
    return filteredTasks.slice(start, start + tasksPageSize);
  }, [filteredTasks, tasksPage, tasksPageSize]);

  // Status transition handler
  async function handleStatusTransition(taskId: string, newStatus: TaskStatus) {
    try {
      await transitionFn({ data: { id: taskId, status: newStatus } });
      toast.success(
        newStatus === "done"
          ? t("markDoneSuccess")
          : newStatus === "pending"
          ? t("markPendingSuccess")
          : t("markInProgressSuccess")
      );
      qc.invalidateQueries({ queryKey: ["tasks-db"] });
      if (selectedTaskDetails && selectedTaskDetails.id === taskId) {
        setSelectedTaskDetails((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    }
  }

  // Create Task handler
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.error(isAr ? "يرجى كتابة عنوان المهمة" : "Please enter a task title");
      return;
    }
    if (createForm.assignees.length === 0) {
      toast.error(isAr ? "يرجى اختيار موظف واحد على الأقل" : "Please select at least one assignee");
      return;
    }

    try {
      setCreatingTask(true);
      await createTaskServerFn({
        data: {
          title: createForm.title.trim(),
          description: createForm.description.trim() || undefined,
          priority: createForm.priority,
          due_date: createForm.due_date || undefined,
          due_time: createForm.due_time || undefined,
          estimated_hours: createForm.estimated_hours ? Number(createForm.estimated_hours) : undefined,
          city: createForm.city.trim() || undefined,
          district: createForm.district.trim() || undefined,
          address: createForm.address.trim() || undefined,
          lat: createForm.lat !== undefined ? createForm.lat : undefined,
          lng: createForm.lng !== undefined ? createForm.lng : undefined,
          radius_m: createForm.radius_m ? Number(createForm.radius_m) : undefined,
          assignees: createForm.assignees,
        },
      });
      toast.success(t("taskCreatedSuccess"));
      qc.invalidateQueries({ queryKey: ["tasks-db"] });
      setCreateModalOpen(false);
      setAssigneeSearch("");
      setCreateForm({
        title: "",
        description: "",
        priority: "medium",
        due_date: todayStr,
        due_time: "17:00",
        estimated_hours: "2",
        cityId: "",
        districtId: "",
        city: "",
        district: "",
        address: "",
        lat: undefined,
        lng: undefined,
        radius_m: 200,
        showMap: false,
        assignees: [],
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }

  // Export Tasks to Excel
  async function handleExportTasksXlsx() {
    if (!filteredTasks.length) return;
    try {
      const XLSX = await import("xlsx");
      const exportRows = filteredTasks.map((tk, idx) => ({
        "#": idx + 1,
        "Task Title": tk.title,
        Description: tk.description || "—",
        Status:
          tk.status === "done"
            ? "Done"
            : tk.status === "pending"
            ? "Pending"
            : tk.status === "in_progress"
            ? "In Progress"
            : "Cancelled",
        Priority: tk.priority,
        Assignees: (tk.assigneeProfiles ?? []).map((p) => p.name).join(", ") || tk.assignees.join(", "),
        "Due Date": tk.date || "—",
        "Due Time": tk.dueTime || "—",
        "Completed At": tk.completedAt ? new Date(tk.completedAt).toLocaleString() : "—",
        "Estimated Hours": tk.estimatedHours ?? "—",
        City: tk.city || "—",
        District: tk.district || "—",
        Address: tk.address || "—",
        "Created At": new Date(tk.createdAt).toLocaleDateString(),
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tasks");
      XLSX.writeFile(wb, `Tasks_Report_${todayStr}.xlsx`);
      toast.success(isAr ? "تم تصدير المهام بنجاح" : "Tasks exported successfully");
    } catch (e: any) {
      toast.error("Export failed: " + (e?.message || ""));
    }
  }

  // ── Daily Query ──
  const dailyQuery = useQuery({
    queryKey: ["admin-workday-daily", selectedDate],
    queryFn: () => getDailyFn({ data: { date: selectedDate } }),
    enabled: periodMode === "daily",
    refetchInterval: selectedDate === todayStr ? 30000 : false,
  });

  // ── Monthly Query ──
  const monthlyQuery = useQuery({
    queryKey: ["admin-workday-monthly", selectedYear, selectedMonth],
    queryFn: () => getMonthlyFn({ data: { year: selectedYear, month: selectedMonth } }),
    enabled: periodMode === "monthly",
  });

  // Daily filtered
  const dailyMembers = dailyQuery.data ?? [];
  const filteredDaily = useMemo(() => {
    return dailyMembers.filter((m) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          m.full_name?.toLowerCase().includes(q) ||
          m.emp_code?.toLowerCase().includes(q) ||
          m.department?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (statusFilter !== "all" && m.current_status !== statusFilter) return false;
      return true;
    });
  }, [dailyMembers, search, statusFilter]);

  // Daily metrics totals
  const dailyTotals = useMemo(() => {
    return {
      attendance: dailyMembers.reduce((s, m) => s + m.total_attendance_minutes, 0),
      task: dailyMembers.reduce((s, m) => s + m.total_task_minutes, 0),
      travel: dailyMembers.reduce((s, m) => s + m.total_travel_minutes, 0),
      break: dailyMembers.reduce((s, m) => s + m.total_break_minutes, 0),
      onTask: dailyMembers.filter((m) => m.current_status === "on_task").length,
      traveling: dailyMembers.filter((m) => m.current_status === "traveling").length,
      idle: dailyMembers.filter((m) => m.current_status === "idle_checked_in").length,
      checkedOut: dailyMembers.filter((m) => m.current_status === "checked_out").length,
    };
  }, [dailyMembers]);

  // Monthly filtered
  const monthlyData = monthlyQuery.data;
  const monthlyRows = monthlyData?.rows ?? [];
  const filteredMonthly = useMemo(() => {
    if (!search.trim()) return monthlyRows;
    const q = search.toLowerCase();
    return monthlyRows.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.emp_code?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q),
    );
  }, [monthlyRows, search]);

  // Pagination: Daily
  const [dailyPageSize, setDailyPageSize] = useState(25);
  const [dailyPage, setDailyPage] = useState(1);

  // Pagination: Monthly
  const [monthlyPageSize, setMonthlyPageSize] = useState(25);
  const [monthlyPage, setMonthlyPage] = useState(1);

  useEffect(() => {
    setDailyPage(1);
  }, [search, statusFilter, selectedDate]);

  useEffect(() => {
    setMonthlyPage(1);
  }, [search, selectedYear, selectedMonth]);

  const totalDailyPages = Math.max(1, Math.ceil(filteredDaily.length / dailyPageSize));
  const paginatedDaily = useMemo(() => {
    const start = (dailyPage - 1) * dailyPageSize;
    return filteredDaily.slice(start, start + dailyPageSize);
  }, [filteredDaily, dailyPage, dailyPageSize]);

  const totalMonthlyPages = Math.max(1, Math.ceil(filteredMonthly.length / monthlyPageSize));
  const paginatedMonthly = useMemo(() => {
    const start = (monthlyPage - 1) * monthlyPageSize;
    return filteredMonthly.slice(start, start + monthlyPageSize);
  }, [filteredMonthly, monthlyPage, monthlyPageSize]);

  // Export Monthly report to Excel
  async function handleExportMonthlyXlsx() {
    if (!filteredMonthly.length) return;
    try {
      const XLSX = await import("xlsx");
      const exportRows = filteredMonthly.map((r, idx) => ({
        "#": idx + 1,
        "Employee Code": r.emp_code || "—",
        "Employee Name": r.full_name,
        Department: r.department || "—",
        "Days Attended": r.days_attended,
        "Attendance Hours": (r.total_attendance_minutes / 60).toFixed(2),
        "Task Working Hours": (r.total_task_minutes / 60).toFixed(2),
        "Travel Hours": (r.total_travel_minutes / 60).toFixed(2),
        "Break / Other Hours": (r.total_break_minutes / 60).toFixed(2),
        "Tasks Completed": r.tasks_completed,
        "Productivity Rate (%)": `${r.productivity_rate}%`,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monthly Time Report");
      XLSX.writeFile(wb, `Time_Management_Report_${selectedYear}_${selectedMonth}.xlsx`);
      toast.success(isAr ? "تم تصدير التقرير الشهري بنجاح" : "Monthly report exported");
    } catch (e: any) {
      toast.error("Export failed: " + (e?.message || ""));
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Bar: Mode Switcher & Time Period Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            {periodMode === "tasks"
              ? isAr
                ? "المهام الفعلية للموظفين (المنجزة والمعلقة)"
                : "Real Employee Tasks (Done & Pending)"
              : periodMode === "daily"
              ? isAr
                ? "تحليل ساعات العمل اليومي والمخطط الميداني"
                : "Daily Workday & Field Timeline"
              : isAr
              ? "التقرير الشهري لإدارة أوقات العمل"
              : "Monthly Time Management Report"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {periodMode === "tasks"
              ? isAr
                ? "عرض ومتابعة المهام المسندة للموظفين من قاعدة البيانات وحالات الإنجاز والتعليق"
                : "View and manage real employee tasks from the database, tracked progress, and completion states"
              : periodMode === "daily"
              ? isAr
                ? "تحليل ساعات العمل والمهام وانتقالات الموظفين الميدانية لحظياً"
                : "Analyze active working time, task check-ins, transit, and idle breaks"
              : isAr
              ? "ملخص شامل لساعات العمل والإنتاجية وإنجاز المهام لكل موظف خلال الشهر"
              : "Comprehensive summary of working hours, productivity rates, and completed tasks"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Mode Toggle */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => setPeriodMode("tasks")}
              className={`rounded-full px-3.5 py-1 font-semibold transition-colors ${
                periodMode === "tasks"
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="me-1 inline h-3.5 w-3.5" />
              {isAr ? "مهام الموظفين" : "Real Tasks"}
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("daily")}
              className={`rounded-full px-3.5 py-1 font-semibold transition-colors ${
                periodMode === "daily"
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="me-1 inline h-3.5 w-3.5" />
              {isAr ? "التحليل اليومي" : "Daily Hours"}
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("monthly")}
              className={`rounded-full px-3.5 py-1 font-semibold transition-colors ${
                periodMode === "monthly"
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="me-1 inline h-3.5 w-3.5" />
              {isAr ? "التقرير الشهري" : "Monthly"}
            </button>
          </div>

          {/* Mode-specific Top Bar actions */}
          {periodMode === "tasks" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => qc.invalidateQueries({ queryKey: ["tasks-db"] })}
                disabled={tasksQuery.isFetching}
                title={isAr ? "تحديث المهام" : "Refresh tasks"}
                className="rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${tasksQuery.isFetching ? "animate-spin text-brand" : ""}`} />
              </button>

              <button
                type="button"
                onClick={handleExportTasksXlsx}
                disabled={!filteredTasks.length}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <FileDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {isAr ? "تصدير إكسيل" : "Export Excel"}
              </button>

              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addNewTask")}
              </button>
            </div>
          )}

          {periodMode === "daily" && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-hidden"
              />
            </div>
          )}

          {periodMode === "monthly" && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold focus:outline-hidden"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {isAr ? MONTH_NAMES_AR[m - 1] : MONTH_NAMES[m - 1]}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold focus:outline-hidden"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportMonthlyXlsx}
                disabled={!filteredMonthly.length}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                <FileDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {isAr ? "تصدير إكسيل" : "Export Excel"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 1. REAL TASKS VIEW (Done & Pending) ──                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {periodMode === "tasks" && (
        <div className="space-y-4">
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {/* Total Tasks */}
            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{t("totalTasksCount")}</span>
                <Briefcase className="h-4 w-4 text-brand" />
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{taskKpis.total}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isAr ? "مسجلة بقاعدة البيانات" : "total in database"}
              </p>
            </div>

            {/* Done / Completed */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-xs dark:bg-emerald-500/10">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                <span className="text-xs font-medium">{t("doneTasksCount")}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                {taskKpis.done}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                {isAr ? "تم إنجازها بنجاح" : "successfully done"}
              </p>
            </div>

            {/* Pending Tasks */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-xs dark:bg-amber-500/10">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                <span className="text-xs font-medium">{t("pendingTasksCount")}</span>
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
                {taskKpis.pending}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                {isAr ? "بانتظار البدء" : "awaiting start"}
              </p>
            </div>

            {/* In Progress */}
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3.5 shadow-xs dark:bg-sky-500/10">
              <div className="flex items-center justify-between text-sky-700 dark:text-sky-300">
                <span className="text-xs font-medium">{t("inProgressTasksCount")}</span>
                <Play className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-sky-700 dark:text-sky-300">
                {taskKpis.inProgress}
              </p>
              <p className="mt-0.5 text-[11px] text-sky-700/80 dark:text-sky-300/80">
                {isAr ? "قيد التنفيذ الميداني" : "currently active"}
              </p>
            </div>

            {/* Completion Rate */}
            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{t("completionRate")}</span>
                <BarChart3 className="h-4 w-4 text-brand" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-xl font-bold tracking-tight text-foreground">{taskKpis.completionRate}%</p>
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-brand transition-all"
                    style={{ width: `${taskKpis.completionRate}%` }}
                  />
                </div>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {taskKpis.done} / {taskKpis.total} {isAr ? "مكتملة" : "done"}
              </p>
            </div>
          </div>

          {/* Quick Status Filter Tabs & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
            {/* Quick Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setTaskStatusFilter("all")}
                className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                  taskStatusFilter === "all"
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {t("all")} ({taskKpis.total})
              </button>

              <button
                type="button"
                onClick={() => setTaskStatusFilter("pending")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors ${
                  taskStatusFilter === "pending"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "border border-amber-500/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                }`}
              >
                <Clock className="h-3 w-3" />
                {t("statusPending")} ({taskKpis.pending})
              </button>

              <button
                type="button"
                onClick={() => setTaskStatusFilter("done")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors ${
                  taskStatusFilter === "done"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                {t("statusDone")} ({taskKpis.done})
              </button>

              <button
                type="button"
                onClick={() => setTaskStatusFilter("in_progress")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors ${
                  taskStatusFilter === "in_progress"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "border border-sky-500/30 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                {t("statusInProgress")} ({taskKpis.inProgress})
              </button>

              {taskKpis.cancelled > 0 && (
                <button
                  type="button"
                  onClick={() => setTaskStatusFilter("cancelled")}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                    taskStatusFilter === "cancelled"
                      ? "bg-muted-foreground text-background"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("statusCancelled")} ({taskKpis.cancelled})
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search text */}
              <div className="relative min-w-[200px] flex-1 sm:w-64">
                <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder={t("searchTasks")}
                  className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-1.5 text-xs focus:outline-hidden"
                />
              </div>

              {/* Employee Filter */}
              <select
                value={taskEmployeeFilter}
                onChange={(e) => setTaskEmployeeFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs focus:outline-hidden font-medium"
              >
                <option value="all">{t("allEmployees")}</option>
                {employeeList.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>

              {/* Priority Filter */}
              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs focus:outline-hidden font-medium"
              >
                <option value="all">{t("allPriorities")}</option>
                <option value="high">{t("priorityHigh")}</option>
                <option value="medium">{t("priorityMedium")}</option>
                <option value="low">{t("priorityLow")}</option>
              </select>

              {/* Date Filter */}
              <div className="flex items-center gap-1 rounded-xl border border-input bg-background px-2.5 py-1 text-xs">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <input
                  type="date"
                  value={taskDateFilter}
                  onChange={(e) => setTaskDateFilter(e.target.value)}
                  className="bg-transparent text-xs focus:outline-hidden"
                />
                {taskDateFilter && (
                  <button
                    type="button"
                    onClick={() => setTaskDateFilter("")}
                    className="ms-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Clear All Filters */}
              {(taskSearch ||
                taskStatusFilter !== "all" ||
                taskEmployeeFilter !== "all" ||
                taskPriorityFilter !== "all" ||
                taskDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setTaskSearch("");
                    setTaskStatusFilter("all");
                    setTaskEmployeeFilter("all");
                    setTaskPriorityFilter("all");
                    setTaskDateFilter("");
                  }}
                  className="rounded-xl border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  {t("clearFilters")}
                </button>
              )}
            </div>
          </div>

          {/* Real Tasks Table */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/60 text-muted-foreground font-medium">
                  <tr>
                    <th className="px-4 py-3">{t("taskTitle")}</th>
                    <th className="px-4 py-3">{t("assignees")}</th>
                    <th className="px-4 py-3">{t("filterByStatus")}</th>
                    <th className="px-4 py-3">{t("dueDateTime")}</th>
                    <th className="px-4 py-3">{t("locationDetails")}</th>
                    <th className="px-4 py-3">{t("estimatedHoursLabel")}</th>
                    <th className="px-4 py-3 text-end">{isAr ? "الإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tasksQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                        {isAr ? "جاري جلب المهام الفعلية من قاعدة البيانات…" : "Loading real tasks from database…"}
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                            <Briefcase className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">
                              {isAr ? "لم يتم إنشاء أي مهام في النظام بعد" : "No tasks in the database yet"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {isAr
                                ? "قم بإنشاء وتكليف أول مهمة للموظفين لمتابعة إنجازها الميداني"
                                : "Create and assign the first task to employees to track field progress and completion"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreateModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95"
                          >
                            <Plus className="h-4 w-4" />
                            {t("addNewTask")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                        {isAr ? "لا توجد مهام مطابقة لمعايير البحث الحالية." : "No tasks match the selected filters."}
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map((tk) => {
                      const isOverdue =
                        tk.status === "pending" &&
                        tk.date &&
                        new Date(tk.date).getTime() < new Date(todayStr).getTime();

                      return (
                        <tr
                          key={tk.id}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => setSelectedTaskDetails(tk)}
                        >
                          {/* Task Title & Priority */}
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5">
                                {tk.status === "done" ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                ) : tk.status === "in_progress" ? (
                                  <Play className="h-4 w-4 text-sky-600 dark:text-sky-400 fill-sky-600/20" />
                                ) : (
                                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-foreground text-xs">{tk.title}</span>
                                  {/* Priority pill */}
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                      tk.priority === "high"
                                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                        : tk.priority === "medium"
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                        : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30"
                                    }`}
                                  >
                                    {tk.priority === "high"
                                      ? t("priorityHigh")
                                      : tk.priority === "medium"
                                      ? t("priorityMedium")
                                      : t("priorityLow")}
                                  </span>
                                </div>
                                {tk.description && (
                                  <p className="mt-0.5 max-w-xs truncate text-[11px] text-muted-foreground">
                                    {tk.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Assignee(s) */}
                          <td className="px-4 py-3">
                            {tk.assigneeProfiles && tk.assigneeProfiles.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {tk.assigneeProfiles.map((p) => (
                                  <div
                                    key={p.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspectorEmployee({ id: p.id, name: p.name });
                                    }}
                                    className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium hover:border-brand/40"
                                    title={isAr ? "عرض المخطط الزمني للموظف" : "View employee workday timeline"}
                                  >
                                    <div className="grid h-5 w-5 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                                      {p.name.charAt(0)}
                                    </div>
                                    <span className="font-semibold text-foreground group-hover:text-brand transition-colors">
                                      {p.name}
                                    </span>
                                    {p.department && (
                                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                        · {p.department}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : tk.assignees && tk.assignees.length > 0 ? (
                              <span className="text-[11px] text-muted-foreground">
                                {tk.assignees.length} {isAr ? "موظف مكلف" : "assignees"}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                {isAr ? "غير مكلف" : "Unassigned"}
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-3">
                            {tk.status === "done" ? (
                              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span>{t("statusDone")}</span>
                                {tk.completedAt && (
                                  <span className="text-[10px] opacity-80 ms-1 hidden md:inline">
                                    {new Date(tk.completedAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </div>
                            ) : tk.status === "in_progress" ? (
                              <div className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                                <span>{t("statusInProgress")}</span>
                              </div>
                            ) : tk.status === "pending" ? (
                              <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                <span>{t("statusPending")}</span>
                                {isOverdue && (
                                  <span className="ms-1 rounded-sm bg-destructive/15 px-1 text-[9px] font-bold text-destructive">
                                    {t("overdue")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {t("statusCancelled")}
                              </span>
                            )}
                          </td>

                          {/* Due Date & Time */}
                          <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                            <div>
                              <span>{tk.date || "—"}</span>
                              {tk.dueTime && <span className="text-muted-foreground ms-1">{tk.dueTime}</span>}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="px-4 py-3">
                            {tk.city || tk.district || tk.address ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0 text-brand" />
                                  <span className="truncate max-w-[140px]">
                                    {[tk.city, tk.district, tk.address].filter(Boolean).join(", ")}
                                  </span>
                                </div>
                                {tk.radius_m && (
                                  <div className="flex items-center gap-1 text-[10px] text-brand font-medium">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                                    <span>
                                      {isAr ? `نطاق: ${tk.radius_m}م` : `Radius: ${tk.radius_m}m`}
                                      {tk.lat != null && tk.lng != null ? " · 📍" : ""}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* Estimated Hours */}
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {tk.estimatedHours != null ? (
                              <span>
                                {tk.estimatedHours} {isAr ? "س" : "hrs"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick status transition */}
                              <select
                                value={tk.status}
                                onChange={(e) => handleStatusTransition(tk.id, e.target.value as TaskStatus)}
                                className="rounded-lg border border-input bg-card px-2 py-1 text-[11px] font-semibold focus:outline-hidden"
                              >
                                <option value="pending">{t("statusPending")}</option>
                                <option value="in_progress">{t("statusInProgress")}</option>
                                <option value="done">{t("statusDone")}</option>
                                <option value="cancelled">{t("statusCancelled")}</option>
                              </select>

                              {/* Details Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedTaskDetails(tk)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                                title={isAr ? "عرض التفاصيل وسجل النشاط" : "View details & activity history"}
                              >
                                <Info className="h-3 w-3 text-muted-foreground" />
                                {isAr ? "تفاصيل" : "Details"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Tasks Pagination Bar */}
            {filteredTasks.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{isAr ? "صفوف لكل صفحة:" : "Rows per page:"}</span>
                  <select
                    value={tasksPageSize}
                    onChange={(e) => {
                      setTasksPageSize(Number(e.target.value));
                      setTasksPage(1);
                    }}
                    className="rounded-md border border-input bg-card px-2 py-1 text-xs font-semibold"
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {isAr
                      ? `الصفحة ${tasksPage} من ${totalTaskPages} · ${filteredTasks.length} إجمالي`
                      : `Page ${tasksPage} of ${totalTaskPages} · ${filteredTasks.length} total`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTasksPage((p) => Math.max(1, p - 1))}
                    disabled={tasksPage <= 1}
                    className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  >
                    {isAr ? "السابق" : "Prev"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTasksPage((p) => Math.min(totalTaskPages, p + 1))}
                    disabled={tasksPage >= totalTaskPages}
                    className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  >
                    {isAr ? "التالي" : "Next"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 2. DAILY VIEW ──                                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {periodMode === "daily" && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{isAr ? "إجمالي الحضور" : "Total Attendance"}</span>
                <Clock className="h-4 w-4 text-brand" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-foreground">
                {formatMinutes(dailyTotals.attendance)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {dailyMembers.length} {isAr ? "موظف مسجل" : "total employees"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{isAr ? "وقت تنفيذ المهام" : "Task Working Time"}</span>
                <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatMinutes(dailyTotals.task)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {dailyTotals.onTask} {isAr ? "يعملون الآن" : "currently on task"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{isAr ? "وقت الانتقال الميداني" : "Travel Transit Time"}</span>
                <RouteIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-sky-600 dark:text-sky-400">
                {formatMinutes(dailyTotals.travel)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {dailyTotals.traveling} {isAr ? "في انتقال حالياً" : "currently in transit"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">{isAr ? "استراحة / وقت غير مهام" : "Break / Idle"}</span>
                <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {formatMinutes(dailyTotals.break)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isAr ? "ضمن ساعات الحضور" : "within attendance"}
              </p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? "بحث بالاسم، الكود، أو القسم…" : "Search employee, code, department…"}
                className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-1.5 text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-foreground text-background"
                    : "border border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {isAr ? "الكل" : "All"} ({dailyMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("on_task")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors ${
                  statusFilter === "on_task"
                    ? "bg-emerald-600 text-white"
                    : "border border-border hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {isAr ? "على مهمة" : "On Task"} ({dailyTotals.onTask})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("traveling")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors ${
                  statusFilter === "traveling"
                    ? "bg-sky-600 text-white"
                    : "border border-border hover:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                {isAr ? "في انتقال" : "Traveling"} ({dailyTotals.traveling})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("idle_checked_in")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  statusFilter === "idle_checked_in"
                    ? "bg-amber-600 text-white"
                    : "border border-border hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {isAr ? "حاضر بدون مهمة" : "Idle"} ({dailyTotals.idle})
              </button>
            </div>
          </div>

          {/* Daily Table */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/60 text-muted-foreground font-medium">
                  <tr>
                    <th className="px-4 py-3">{isAr ? "الموظف" : "Employee"}</th>
                    <th className="px-4 py-3">{isAr ? "الحالة الحالية" : "Current Activity"}</th>
                    <th className="px-4 py-3">{isAr ? "ساعات الحضور" : "Attendance Time"}</th>
                    <th className="px-4 py-3">{isAr ? "وقت المهام" : "Task Time"}</th>
                    <th className="px-4 py-3">{isAr ? "وقت الانتقال" : "Travel Time"}</th>
                    <th className="px-4 py-3">{isAr ? "استراحة" : "Break / Other"}</th>
                    <th className="px-4 py-3 text-end">{isAr ? "المخطط اليومي" : "Timeline"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {dailyQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                        {isAr ? "جاري تحميل البيانات…" : "Loading workday data…"}
                      </td>
                    </tr>
                  ) : filteredDaily.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                        {isAr ? "لا توجد نتائج مطابقة" : "No records found for this date."}
                      </td>
                    </tr>
                  ) : (
                    paginatedDaily.map((m) => (
                      <tr
                        key={m.employee_id}
                        onClick={() => setInspectorEmployee({ id: m.employee_id, name: m.full_name })}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 font-bold text-brand">
                              {m.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{m.full_name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {m.emp_code ? `${m.emp_code} · ` : ""}
                                {m.department || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {m.current_status === "on_task" ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {isAr ? "يعمل على مهمة" : "On Task"}
                              </span>
                              {m.active_activity_title && (
                                <p className="mt-0.5 max-w-[180px] truncate text-[11px] font-medium text-foreground">
                                  {m.active_activity_title}
                                </p>
                              )}
                            </div>
                          ) : m.current_status === "traveling" ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                                {isAr ? "في انتقال" : "Traveling"}
                              </span>
                              {m.active_activity_title && (
                                <p className="mt-0.5 max-w-[180px] truncate text-[11px] font-medium text-foreground">
                                  {m.active_activity_title}
                                </p>
                              )}
                            </div>
                          ) : m.current_status === "idle_checked_in" ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                              {isAr ? "حاضر (بدون مهمة)" : "Checked In"}
                            </span>
                          ) : m.current_status === "checked_out" ? (
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {isAr ? "انصرف" : "Checked Out"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                              {isAr ? "لم يسجل حضور" : "Absent"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{formatMinutes(m.total_attendance_minutes)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatMinutes(m.total_task_minutes)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-sky-600 dark:text-sky-400">
                          {formatMinutes(m.total_travel_minutes)}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {formatMinutes(m.total_break_minutes)}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectorEmployee({ id: m.employee_id, name: m.full_name });
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold shadow-xs hover:bg-muted"
                          >
                            {isAr ? "عرض المخطط" : "Timeline"}
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Daily Pagination Bar */}
            {filteredDaily.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{isAr ? "صفوف لكل صفحة:" : "Rows per page:"}</span>
                  <select
                    value={dailyPageSize}
                    onChange={(e) => {
                      setDailyPageSize(Number(e.target.value));
                      setDailyPage(1);
                    }}
                    className="rounded-md border border-input bg-card px-2 py-1 text-xs"
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {isAr
                      ? `الصفحة ${dailyPage} من ${totalDailyPages} · ${filteredDaily.length} إجمالي`
                      : `Page ${dailyPage} of ${totalDailyPages} · ${filteredDaily.length} total`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDailyPage((p) => Math.max(1, p - 1))}
                    disabled={dailyPage <= 1}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  >
                    {isAr ? "السابق" : "Prev"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyPage((p) => Math.min(totalDailyPages, p + 1))}
                    disabled={dailyPage >= totalDailyPages}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  >
                    {isAr ? "التالي" : "Next"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 3. MONTHLY REPORT VIEW ──                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {periodMode === "monthly" && (
        <div className="space-y-4">
          {/* Monthly Totals */}
          {monthlyData && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">
                  {isAr ? "إجمالي الحضور" : "Attendance"}
                </span>
                <p className="mt-2 text-lg font-bold tracking-tight text-foreground">
                  {formatMinutes(monthlyData.totals.total_attendance_minutes)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "ساعات الحضور الشهرية" : "monthly attendance"}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">{isAr ? "وقت تنفيذ المهام" : "Task Hours"}</span>
                <p className="mt-2 text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatMinutes(monthlyData.totals.total_task_minutes)}
                </p>
                <p className="text-[11px] text-muted-foreground">{isAr ? "عمل مباشر" : "direct work"}</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">{isAr ? "وقت الانتقال" : "Travel Hours"}</span>
                <p className="mt-2 text-lg font-bold tracking-tight text-sky-600 dark:text-sky-400">
                  {formatMinutes(monthlyData.totals.total_travel_minutes)}
                </p>
                <p className="text-[11px] text-muted-foreground">{isAr ? "بين الفروع والمواقع" : "transit time"}</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">{isAr ? "المهام المنجزة" : "Tasks Done"}</span>
                <p className="mt-2 text-lg font-bold tracking-tight text-foreground">
                  {monthlyData.totals.total_tasks_completed}
                </p>
                <p className="text-[11px] text-muted-foreground">{isAr ? "مهمة مكتملة" : "completed tasks"}</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs col-span-2 sm:col-span-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {isAr ? "معدل الإنتاجية" : "Productivity Rate"}
                </span>
                <p className="mt-2 text-lg font-bold tracking-tight text-brand">
                  {monthlyData.totals.avg_productivity_rate}%
                </p>
                <p className="text-[11px] text-muted-foreground">{isAr ? "نسبة العمل الفعلي" : "work vs attendance"}</p>
              </div>
            </div>
          )}

          {/* Monthly Table */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/60 text-muted-foreground font-medium">
                  <tr>
                    <th className="px-4 py-3">{isAr ? "الموظف" : "Employee"}</th>
                    <th className="px-4 py-3">{isAr ? "أيام الحضور" : "Days Attended"}</th>
                    <th className="px-4 py-3">{isAr ? "إجمالي الحضور" : "Total Attendance"}</th>
                    <th className="px-4 py-3">{isAr ? "وقت المهام" : "Task Hours"}</th>
                    <th className="px-4 py-3">{isAr ? "وقت الانتقال" : "Travel Hours"}</th>
                    <th className="px-4 py-3">{isAr ? "استراحة" : "Break Hours"}</th>
                    <th className="px-4 py-3">{isAr ? "مهام منجزة" : "Tasks Done"}</th>
                    <th className="px-4 py-3">{isAr ? "معدل الإنجاز" : "Productivity"}</th>
                    <th className="px-4 py-3 text-end">{isAr ? "المخطط" : "Timeline"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {monthlyQuery.isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                        {isAr ? "جاري تجميع التقرير الشهري…" : "Generating monthly report…"}
                      </td>
                    </tr>
                  ) : filteredMonthly.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                        {isAr ? "لا توجد سجلات لهذا الشهر" : "No records found for this month."}
                      </td>
                    </tr>
                  ) : (
                    paginatedMonthly.map((r) => (
                      <tr
                        key={r.employee_id}
                        onClick={() => setInspectorEmployee({ id: r.employee_id, name: r.full_name })}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{r.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.emp_code ? `${r.emp_code} · ` : ""}
                            {r.department || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {r.days_attended} {isAr ? "يوم" : "days"}
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatMinutes(r.total_attendance_minutes)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatMinutes(r.total_task_minutes)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-sky-600 dark:text-sky-400">
                          {formatMinutes(r.total_travel_minutes)}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {formatMinutes(r.total_break_minutes)}
                        </td>
                        <td className="px-4 py-3 font-medium">{r.tasks_completed}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-gradient-brand"
                                style={{ width: `${Math.min(100, r.productivity_rate)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold">{r.productivity_rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectorEmployee({ id: r.employee_id, name: r.full_name });
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold shadow-xs hover:bg-muted"
                          >
                            {isAr ? "عرض" : "Inspect"}
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Monthly Pagination Bar */}
            {filteredMonthly.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{isAr ? "صفوف لكل صفحة:" : "Rows per page:"}</span>
                  <select
                    value={monthlyPageSize}
                    onChange={(e) => {
                      setMonthlyPageSize(Number(e.target.value));
                      setMonthlyPage(1);
                    }}
                    className="rounded-md border border-input bg-card px-2 py-1 text-xs"
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {isAr
                      ? `الصفحة ${monthlyPage} من ${totalMonthlyPages} · ${filteredMonthly.length} إجمالي`
                      : `Page ${monthlyPage} of ${totalMonthlyPages} · ${filteredMonthly.length} total`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMonthlyPage((p) => Math.max(1, p - 1))}
                    disabled={monthlyPage <= 1}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  >
                    {isAr ? "السابق" : "Prev"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyPage((p) => Math.min(totalMonthlyPages, p + 1))}
                    disabled={monthlyPage >= totalMonthlyPages}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  >
                    {isAr ? "التالي" : "Next"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: TASK DETAILS & HISTORY ──                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {selectedTaskDetails && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4"
          onClick={() => setSelectedTaskDetails(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl bg-background p-6 shadow-soft"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">{selectedTaskDetails.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("taskDetails")} · {selectedTaskDetails.date || "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskDetails(null)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {/* Status & Priority Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground">{t("filterByStatus")}:</span>
                  <select
                    value={selectedTaskDetails.status}
                    onChange={(e) => handleStatusTransition(selectedTaskDetails.id, e.target.value as TaskStatus)}
                    className="rounded-lg border border-input bg-card px-2.5 py-1 text-xs font-semibold focus:outline-hidden"
                  >
                    <option value="pending">{t("statusPending")}</option>
                    <option value="in_progress">{t("statusInProgress")}</option>
                    <option value="done">{t("statusDone")}</option>
                    <option value="cancelled">{t("statusCancelled")}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground">{t("filterByPriority")}:</span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${
                      selectedTaskDetails.priority === "high"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        : selectedTaskDetails.priority === "medium"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedTaskDetails.priority}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedTaskDetails.description && (
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1">{t("taskDescription")}</h4>
                  <p className="rounded-xl border border-border bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
                    {selectedTaskDetails.description}
                  </p>
                </div>
              )}

              {/* Assignees list */}
              <div>
                <h4 className="font-semibold text-muted-foreground mb-1.5">{t("assignees")}</h4>
                {selectedTaskDetails.assigneeProfiles && selectedTaskDetails.assigneeProfiles.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedTaskDetails.assigneeProfiles.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedTaskDetails(null);
                          setInspectorEmployee({ id: p.id, name: p.name });
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 hover:border-brand/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 place-items-center rounded-full bg-brand/10 font-bold text-brand text-xs">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {p.empCode ? `${p.empCode} · ` : ""}
                              {p.department || "—"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-brand font-semibold hover:underline">
                          {isAr ? "المخطط" : "Timeline"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {isAr ? "لم يتم تحديد موظفين مكلفين بعد" : "No assignees specified"}
                  </p>
                )}
              </div>

              {/* Location & Time info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border bg-card p-2.5">
                  <span className="text-[10px] text-muted-foreground block">{t("taskLocation")}</span>
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                    <span className="truncate">
                      {[
                        selectedTaskDetails.city,
                        selectedTaskDetails.district,
                        selectedTaskDetails.address,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </span>
                  </div>
                  {selectedTaskDetails.radius_m && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-brand font-medium">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                      <span>
                        {isAr
                          ? `نصف قطر الحضور: ${selectedTaskDetails.radius_m} متر`
                          : `Check-in Radius: ${selectedTaskDetails.radius_m}m`}
                      </span>
                    </div>
                  )}
                  {selectedTaskDetails.lat != null && selectedTaskDetails.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedTaskDetails.lat},${selectedTaskDetails.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      <span>📍 {selectedTaskDetails.lat.toFixed(4)}, {selectedTaskDetails.lng.toFixed(4)}</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-2.5">
                  <span className="text-[10px] text-muted-foreground block">{t("estimatedHoursLabel")}</span>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedTaskDetails.estimatedHours != null
                      ? `${selectedTaskDetails.estimatedHours} ${isAr ? "ساعات" : "hours"}`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Activity History */}
              <div>
                <h4 className="font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {t("taskActivityHistory")}
                </h4>
                {selectedTaskDetails.history && selectedTaskDetails.history.length > 0 ? (
                  <div className="space-y-2 relative border-s-2 border-border ps-3 ms-2">
                    {selectedTaskDetails.history.map((h, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -start-[19px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                        <div className="rounded-xl border border-border bg-card p-2 text-xs">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                            <span className="font-semibold text-foreground">{h.by}</span>
                            <span>{new Date(h.ts).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 font-semibold text-brand">
                            {h.to === "in_progress"
                              ? t("statusInProgress")
                              : h.to === "done"
                              ? t("statusDone")
                              : h.to}
                          </p>
                          {h.note && (
                            <p className="mt-1 text-[11px] text-foreground/80 italic">"{h.note}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    {t("noActivityYet")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: CREATE TASK (WIDER & DB-BACKED CITY/DISTRICT) ──     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-3xl md:max-w-4xl flex-col rounded-3xl bg-background p-6 shadow-soft"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">{t("createTaskTitle")}</h3>
                <p className="text-xs text-muted-foreground">{t("createTaskDesc")}</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTask} className="flex-1 overflow-y-auto py-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* ── Left Column: Task Core Details ── */}
                <div className="space-y-3.5">
                  {/* Title */}
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      {t("taskTitle")} <span className="text-destructive">*</span>
                    </label>
                    <input
                      required
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      placeholder={isAr ? "مثال: صيانة معدات فرع المعادي" : "e.g. Inspect branch equipment"}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block font-semibold text-foreground mb-1">{t("taskDescription")}</label>
                    <textarea
                      rows={3}
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder={isAr ? "تفاصيل إضافية وملاحظات تنفيذ المهمة…" : "Details about the task…"}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden resize-none"
                    />
                  </div>

                  {/* Priority & Estimated Hours */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-foreground mb-1">{t("filterByPriority")}</label>
                      <select
                        value={createForm.priority}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, priority: e.target.value as TaskPriority })
                        }
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden font-medium"
                      >
                        <option value="low">{t("priorityLow")}</option>
                        <option value="medium">{t("priorityMedium")}</option>
                        <option value="high">{t("priorityHigh")}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-foreground mb-1">{t("estimatedHoursLabel")}</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={createForm.estimated_hours}
                        onChange={(e) => setCreateForm({ ...createForm, estimated_hours: e.target.value })}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Due Date & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-foreground mb-1">{t("date")}</label>
                      <input
                        type="date"
                        value={createForm.due_date}
                        onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-foreground mb-1">{isAr ? "الوقت" : "Time"}</label>
                      <input
                        type="time"
                        value={createForm.due_time}
                        onChange={(e) => setCreateForm({ ...createForm, due_time: e.target.value })}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Right Column: Assignees & Database Location ── */}
                <div className="space-y-3.5">
                  {/* Assignees */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-foreground">
                        {t("assignees")} <span className="text-destructive">*</span>
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {createForm.assignees.length} {isAr ? "محدد" : "selected"}
                      </span>
                    </div>

                    {/* Filter / Search within assignees */}
                    <div className="rounded-xl border border-input bg-background overflow-hidden">
                      <div className="border-b border-border/60 p-1.5 flex items-center gap-2 bg-muted/20">
                        <Search className="h-3 w-3 text-muted-foreground ms-1.5 shrink-0" />
                        <input
                          value={assigneeSearch}
                          onChange={(e) => setAssigneeSearch(e.target.value)}
                          placeholder={isAr ? "بحث بالاسم…" : "Filter employees…"}
                          className="w-full bg-transparent text-xs focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={toggleSelectAllAssignees}
                          className="text-[10px] text-brand font-semibold hover:underline shrink-0 px-1"
                        >
                          {createForm.assignees.length === employeeList.length
                            ? isAr
                              ? "إلغاء الكل"
                              : "Deselect"
                            : isAr
                            ? "تحديد الكل"
                            : "Select all"}
                        </button>
                      </div>

                      <div className="max-h-36 overflow-y-auto p-1.5 space-y-0.5">
                        {filteredEmployeeList.length === 0 ? (
                          <p className="p-2 text-center text-[11px] text-muted-foreground">
                            {isAr ? "لا يوجد موظفين مطابقين" : "No matching employees"}
                          </p>
                        ) : (
                          filteredEmployeeList.map((emp: any) => {
                            const checked = createForm.assignees.includes(emp.id);
                            return (
                              <label
                                key={emp.id}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                                  checked ? "bg-brand/10 font-semibold text-brand" : "hover:bg-muted text-foreground"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setCreateForm((prev) => ({
                                      ...prev,
                                      assignees: checked
                                        ? prev.assignees.filter((id) => id !== emp.id)
                                        : [...prev.assignees, emp.id],
                                    }));
                                  }}
                                  className="rounded border-input text-brand"
                                />
                                <span className="truncate">{emp.name}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location: City & District from Database */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* City from DB */}
                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        {isAr ? "المدينة (من قاعدة البيانات)" : "City"}
                      </label>
                      <select
                        value={createForm.cityId}
                        onChange={(e) => handleCityChange(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden font-medium"
                      >
                        <option value="">{isAr ? "— اختر المدينة —" : "— Select City —"}</option>
                        {dbCities.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {isAr ? c.name_ar || c.name_en : c.name_en || c.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* District from DB */}
                    <div>
                      <label className="block font-semibold text-foreground mb-1">
                        {isAr ? "الحي / المنطقة" : "District"}
                      </label>
                      <select
                        value={createForm.districtId}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden font-medium"
                      >
                        <option value="">{isAr ? "— اختر المنطقة —" : "— Select District —"}</option>
                        {availableDistricts.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {isAr ? d.name_ar || d.name_en : d.name_en || d.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Detailed Address */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-foreground">
                        {isAr ? "العنوان بالتفصيل" : "Address"}
                      </label>
                      {isGeocodingAddress && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-brand font-medium animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {isAr ? "جاري جلب العنوان من الخريطة…" : "Fetching address from map…"}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        value={createForm.address}
                        onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                        placeholder={
                          isGeocodingAddress
                            ? isAr
                              ? "جاري تحديد العنوان من الخريطة…"
                              : "Detecting address from map…"
                            : isAr
                            ? "الشارع ورقم المبنى أو علامة مميزة…"
                            : "Street address, landmark…"
                        }
                        className={`w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden transition-all ${
                          isGeocodingAddress ? "opacity-75 bg-muted/40" : ""
                        } ${createForm.lat != null && createForm.lng != null && !isGeocodingAddress ? "pe-8" : ""}`}
                      />
                      {createForm.lat != null && createForm.lng != null && !isGeocodingAddress && (
                        <button
                          type="button"
                          title={isAr ? "إعادة جلب العنوان من موقع الخريطة" : "Re-fetch address from pinned location"}
                          onClick={() => handleLocationPicked(createForm.lat, createForm.lng, createForm.radius_m)}
                          className="absolute end-2 top-2 text-muted-foreground hover:text-brand transition-colors p-0.5 rounded-md hover:bg-muted"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Radius & Location Geofence Signing Section ── */}
              <div className="mt-4 rounded-2xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                      <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                      <span>{isAr ? "نصف قطر وموقع المهمة (لتسجيل الحضور)" : "Task Location & Check-in Radius"}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isAr
                        ? "حدد نطاق السماح بالمتر ووقّع الموقع على الخريطة لتأكيد الحضور ضمن النطاق الصحيح."
                        : "Define the check-in radius in meters and sign the exact site on the map."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCreateForm((prev) => ({ ...prev, showMap: !prev.showMap }))}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                        createForm.lat != null && createForm.lng != null
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : createForm.showMap
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border bg-background hover:bg-muted text-foreground"
                      }`}
                    >
                      <MapPin className={`h-3.5 w-3.5 ${createForm.lat != null ? "text-emerald-600 dark:text-emerald-400" : "text-brand"}`} />
                      <span>
                        {createForm.lat != null && createForm.lng != null
                          ? isAr
                            ? "الموقع موقّع على الخريطة"
                            : "Location Signed"
                          : isAr
                          ? "توقيع الموقع على الخريطة"
                          : "Sign on Map"}
                      </span>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${createForm.showMap ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Radius Controls (Input + Presets) */}
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {isAr ? "نصف القطر:" : "Radius:"}
                    </label>
                    <div className="relative w-28">
                      <input
                        type="number"
                        min={10}
                        max={10000}
                        step={10}
                        value={createForm.radius_m}
                        onChange={(e) => {
                          const val = Math.max(10, Math.min(100000, Number(e.target.value) || 10));
                          setCreateForm((prev) => ({ ...prev, radius_m: val }));
                        }}
                        className="w-full rounded-xl border border-input bg-background px-3 py-1.5 pe-8 text-xs font-mono font-semibold focus:outline-hidden"
                      />
                      <span className="absolute end-2.5 top-2 text-[10px] text-muted-foreground pointer-events-none">
                        {isAr ? "متر" : "m"}
                      </span>
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[50, 100, 200, 300, 500, 1000].map((preset) => {
                      const isSelected = createForm.radius_m === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCreateForm((prev) => ({ ...prev, radius_m: preset }))}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                            isSelected
                              ? "bg-brand text-brand-foreground shadow-xs"
                              : "border border-border/70 bg-background hover:bg-muted text-foreground/80"
                          }`}
                        >
                          {preset} {isAr ? "م" : "m"}
                        </button>
                      );
                    })}
                  </div>

                  {/* Signed coordinates indicator */}
                  {createForm.lat != null && createForm.lng != null && (
                    <div className="ms-auto flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-mono">
                        {createForm.lat.toFixed(5)}, {createForm.lng.toFixed(5)}
                      </span>
                      <span className="text-[10px] opacity-75">
                        · {isAr ? `دائرة ${createForm.radius_m}م` : `${createForm.radius_m}m zone`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCreateForm((prev) => ({ ...prev, lat: undefined, lng: undefined }))
                        }
                        className="ms-1 text-[10px] text-destructive hover:underline font-semibold"
                      >
                        {isAr ? "مسح" : "Clear"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Map Display */}
                {createForm.showMap && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                      <span className="flex items-center gap-1">
                        <Info className="h-3 w-3 text-brand shrink-0" />
                        {isAr
                          ? "انقر في أي مكان على الخريطة لتوقيع الموقع الدقيق. الدائرة الزرقاء تمثل نطاق الحضور المحدد."
                          : "Click anywhere on the map to pin the exact location. The blue circle represents the check-in radius."}
                      </span>
                    </div>

                    <TaskLocationPicker
                      lat={createForm.lat}
                      lng={createForm.lng}
                      radius_m={createForm.radius_m}
                      cityName={createForm.city}
                      districtName={createForm.district}
                      onChange={handleLocationPicked}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-6 py-2 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 disabled:opacity-50"
                >
                  {creatingTask ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {t("addNewTask")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: EMPLOYEE TIMELINE INSPECTION ──                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {inspectorEmployee && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4"
          onClick={() => setInspectorEmployee(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-background p-6 shadow-soft"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/10 font-bold text-brand">
                  {inspectorEmployee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">{inspectorEmployee.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "متابعة المخطط الزمني وساعات العمل" : "Workday & Daily Timeline"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectorEmployee(null)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <MyWorkdayTimeline employeeId={inspectorEmployee.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
