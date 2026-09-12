import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  getTeamTimeOverview,
  getMonthlyTimeManagementReport,
  type TeamMemberTimeStatus,
  type MonthlyEmployeeTimeSummary,
} from "@/backend/functions/workday.functions";
import { MyWorkdayTimeline } from "@/components/employee/MyWorkdayTimeline";

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

export function AdminTimeManagementView() {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [periodMode, setPeriodMode] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inspectorEmployee, setInspectorEmployee] = useState<{ id: string; name: string } | null>(null);

  const getDailyFn = useServerFn(getTeamTimeOverview);
  const getMonthlyFn = useServerFn(getMonthlyTimeManagementReport);

  // Daily Query
  const dailyQuery = useQuery({
    queryKey: ["admin-workday-daily", selectedDate],
    queryFn: () => getDailyFn({ data: { date: selectedDate } }),
    enabled: periodMode === "daily",
    refetchInterval: selectedDate === todayStr ? 30000 : false,
  });

  // Monthly Query
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
    return monthlyRows.filter((r) =>
      r.full_name?.toLowerCase().includes(q) ||
      r.emp_code?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q),
    );
  }, [monthlyRows, search]);

  // Pagination: Daily (default 25 per page)
  const [dailyPageSize, setDailyPageSize] = useState(25);
  const [dailyPage, setDailyPage] = useState(1);

  // Pagination: Monthly (default 25 per page)
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
            {isAr ? "إدارة أوقات المهام والمخطط الزمني" : "Task Time Management & Workday Timeline"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "تحليل ساعات العمل والمهام الفعلية وانتقالات الموظفين يومياً وشهرياً"
              : "Analyze active working time, task check-ins, field transit, and idle breaks"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Toggle */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 text-xs">
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
              {isAr ? "يومي" : "Daily View"}
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
              {isAr ? "شهري" : "Monthly Report"}
            </button>
          </div>

          {/* Date Selector for Daily */}
          {periodMode === "daily" ? (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-hidden"
              />
            </div>
          ) : (
            /* Month & Year Selectors for Monthly */
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

      {/* ── DAILY VIEW ── */}
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
                  statusFilter === "all" ? "bg-foreground text-background" : "border border-border hover:bg-muted text-muted-foreground"
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
                        <td className="px-4 py-3 font-medium">
                          {formatMinutes(m.total_attendance_minutes)}
                        </td>
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

      {/* ── MONTHLY REPORT VIEW ── */}
      {periodMode === "monthly" && (
        <div className="space-y-4">
          {/* Monthly Totals */}
          {monthlyData && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
                <span className="text-xs font-medium text-muted-foreground">{isAr ? "إجمالي الحضور" : "Attendance"}</span>
                <p className="mt-2 text-lg font-bold tracking-tight text-foreground">
                  {formatMinutes(monthlyData.totals.total_attendance_minutes)}
                </p>
                <p className="text-[11px] text-muted-foreground">{isAr ? "ساعات الحضور الشهرية" : "monthly attendance"}</p>
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
                <span className="text-xs font-medium text-muted-foreground">{isAr ? "معدل الإنتاجية" : "Productivity Rate"}</span>
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
                        <td className="px-4 py-3 font-medium">{r.days_attended} {isAr ? "يوم" : "days"}</td>
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

      {/* Modal: Employee Timeline Inspection */}
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
                  <h3 className="font-display text-base font-semibold">
                    {inspectorEmployee.name}
                  </h3>
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
