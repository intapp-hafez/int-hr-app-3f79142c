import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Clock,
  Briefcase,
  Route as RouteIcon,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  ChevronRight,
  X,
  Loader2,
  Filter,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  getTeamTimeOverview,
  type TeamMemberTimeStatus,
} from "@/backend/functions/workday.functions";
import { MyWorkdayTimeline } from "@/components/employee/MyWorkdayTimeline";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function ManagerTeamTimeDashboard() {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<TeamMemberTimeStatus | null>(null);

  const getTeamTimeFn = useServerFn(getTeamTimeOverview);

  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ["manager-team-time-overview", selectedDate],
    queryFn: () => getTeamTimeFn({ data: { date: selectedDate } }),
    refetchInterval: selectedDate === todayStr ? 30000 : false,
  });

  // Calculate totals
  const totalAttendanceMinutes = members.reduce((sum, m) => sum + m.total_attendance_minutes, 0);
  const totalTaskMinutes = members.reduce((sum, m) => sum + m.total_task_minutes, 0);
  const totalTravelMinutes = members.reduce((sum, m) => sum + m.total_travel_minutes, 0);
  const totalBreakMinutes = members.reduce((sum, m) => sum + m.total_break_minutes, 0);

  const onTaskCount = members.filter((m) => m.current_status === "on_task").length;
  const travelingCount = members.filter((m) => m.current_status === "traveling").length;
  const idleCount = members.filter((m) => m.current_status === "idle_checked_in").length;
  const checkedOutCount = members.filter((m) => m.current_status === "checked_out").length;
  const absentCount = members.filter((m) => m.current_status === "not_checked_in").length;

  const filteredMembers = members.filter((m) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = m.full_name?.toLowerCase().includes(q);
      const matchCode = m.emp_code?.toLowerCase().includes(q);
      const matchDept = m.department?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchDept) return false;
    }
    if (statusFilter !== "all" && m.current_status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Date Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {isAr ? "لوحة متابعة أوقات الفريق" : "Team Time Management Dashboard"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "متابعة ساعات الحضور والمهام وانتقالات الموظفين الميدانية لحظياً"
              : "Live monitoring of employee attendance, direct task hours, and field travel"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "إجمالي الحضور" : "Total Attendance"}</span>
            <Clock className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {formatMinutes(totalAttendanceMinutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {members.length} {isAr ? "موظف" : "members"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "إجمالي وقت المهام" : "Total Task Time"}</span>
            <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatMinutes(totalTaskMinutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isAr ? "ساعات عمل مباشرة" : "Direct execution"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "إجمالي وقت الانتقال" : "Total Travel Time"}</span>
            <RouteIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
            {formatMinutes(totalTravelMinutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isAr ? "بين المواقع والفروع" : "Between branches"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{isAr ? "أوقات الاستراحة / أخرى" : "Break / Other"}</span>
            <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {formatMinutes(totalBreakMinutes)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isAr ? "وقت فاصل" : "Buffer / non-task time"}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "بحث بالاسم، الكود، أو القسم…" : "Search employee, code, or department…"}
            className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-1.5 text-xs focus:outline-hidden"
          />
        </div>

        {/* Status Pills */}
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
            {isAr ? "الكل" : "All"} ({members.length})
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
            {isAr ? "على مهمة" : "On Task"} ({onTaskCount})
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
            {isAr ? "في انتقال" : "Traveling"} ({travelingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("idle_checked_in")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors ${
              statusFilter === "idle_checked_in"
                ? "bg-amber-600 text-white"
                : "border border-border hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isAr ? "حاضر بدون مهمة" : "Checked In"} ({idleCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("checked_out")}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              statusFilter === "checked_out"
                ? "bg-muted-foreground text-white"
                : "border border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            {isAr ? "انصرف" : "Checked Out"} ({checkedOutCount})
          </button>
        </div>
      </div>

      {/* Team Time Roster Table */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/60 text-muted-foreground font-medium">
              <tr>
                <th className="px-4 py-3">{isAr ? "الموظف" : "Employee"}</th>
                <th className="px-4 py-3">{isAr ? "الحالة الحالية" : "Current Status"}</th>
                <th className="px-4 py-3">{isAr ? "ساعات الحضور" : "Attendance"}</th>
                <th className="px-4 py-3">{isAr ? "وقت المهام" : "Task Time"}</th>
                <th className="px-4 py-3">{isAr ? "وقت الانتقال" : "Travel Time"}</th>
                <th className="px-4 py-3">{isAr ? "استراحة" : "Break/Other"}</th>
                <th className="px-4 py-3 text-end">{isAr ? "المخطط الزمني" : "Timeline"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                    {isAr ? "جاري تحميل بيانات الفريق…" : "Loading team time data…"}
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    {isAr ? "لا توجد نتائج مطابقة" : "No matching team members found."}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  let statusBadge = null;
                  if (m.current_status === "on_task") {
                    statusBadge = (
                      <div className="flex flex-col">
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {isAr ? "يعمل على مهمة" : "On Task"}
                        </span>
                        {m.active_activity_title && (
                          <span className="mt-0.5 max-w-[200px] truncate text-[11px] font-medium text-foreground">
                            {m.active_activity_title}
                            {m.active_activity_elapsed_minutes != null && (
                              <span className="ms-1 font-mono text-muted-foreground">
                                ({formatMinutes(m.active_activity_elapsed_minutes)})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  } else if (m.current_status === "traveling") {
                    statusBadge = (
                      <div className="flex flex-col">
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                          {isAr ? "في انتقال ميداني" : "Traveling"}
                        </span>
                        {m.active_activity_title && (
                          <span className="mt-0.5 max-w-[200px] truncate text-[11px] font-medium text-foreground">
                            {m.active_activity_title}
                            {m.active_activity_elapsed_minutes != null && (
                              <span className="ms-1 font-mono text-muted-foreground">
                                ({formatMinutes(m.active_activity_elapsed_minutes)})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  } else if (m.current_status === "idle_checked_in") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        {isAr ? "حاضر (بدون مهمة نشطة)" : "Checked In (Idle)"}
                      </span>
                    );
                  } else if (m.current_status === "checked_out") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {isAr ? "انصرف" : "Checked Out"}
                      </span>
                    );
                  } else {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {isAr ? "لم يسجل حضور" : "Not Checked In"}
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={m.employee_id}
                      onClick={() => setSelectedMember(m)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      {/* Employee Info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 font-bold text-brand">
                            {m.full_name?.charAt(0) || "U"}
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

                      {/* Status */}
                      <td className="px-4 py-3">{statusBadge}</td>

                      {/* Attendance Time */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {formatMinutes(m.total_attendance_minutes)}
                        </span>
                        {m.attendance_in && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(m.attendance_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </td>

                      {/* Task Time */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatMinutes(m.total_task_minutes)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {m.tasks_completed} {isAr ? "منجزة" : "done"}
                        </p>
                      </td>

                      {/* Travel Time */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {formatMinutes(m.total_travel_minutes)}
                        </span>
                      </td>

                      {/* Break Time */}
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {formatMinutes(m.total_break_minutes)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(m);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
                        >
                          {isAr ? "عرض المخطط" : "Timeline"}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Employee Detailed Daily Timeline */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-foreground/40 p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-background p-6 shadow-soft"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/10 font-bold text-brand">
                  {selectedMember.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">
                    {selectedMember.full_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedMember.emp_code ? `${selectedMember.emp_code} · ` : ""}
                    {selectedMember.department || ""} · {selectedDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <MyWorkdayTimeline employeeId={selectedMember.employee_id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
