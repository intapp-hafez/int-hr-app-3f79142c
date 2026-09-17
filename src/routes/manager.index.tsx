import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  ListChecks,
  Route as RouteIcon,
  CheckCircle2,
  CalendarDays,
  CalendarCheck,
  UserCheck,
  Clock,
  ArrowUpRight,
  Plus,
  LogIn,
  Building,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  getManagerDashboardData,
  type ManagerDashboardData,
} from "@/backend/functions/dashboard.functions";
import { decideLeave } from "@/backend/functions/leaves.functions";
import { formatDate } from "@/lib/date-format";

export const Route = createFileRoute("/manager/")({
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const { t, isAr } = useI18n();
  const session = useSession();
  const qc = useQueryClient();

  const getDashboardFn = useServerFn(getManagerDashboardData);
  const decideFn = useServerFn(decideLeave);

  const [actingLeaveId, setActingLeaveId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["manager-dashboard-data"],
    queryFn: () => getDashboardFn(),
    refetchInterval: 30_000,
  });

  const decideMutation = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) => {
      setActingLeaveId(v.id);
      return decideFn({ data: { ...v, notify: true } });
    },
    onSuccess: (_, v) => {
      toast.success(
        v.status === "approved"
          ? isAr
            ? "تمت الموافقة على طلب الإجازة"
            : "Leave request approved"
          : isAr
          ? "تم رفض طلب الإجازة"
          : "Leave request rejected"
      );
      qc.invalidateQueries({ queryKey: ["manager-dashboard-data"] });
      qc.invalidateQueries({ queryKey: ["manager-team-leaves"] });
      qc.invalidateQueries({ queryKey: ["manager-team-leaves-badge"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "فشل تنفيذ الإجراء" : "Failed to record decision"));
    },
    onSettled: () => {
      setActingLeaveId(null);
    },
  });

  const dashboard: ManagerDashboardData = data ?? {
    teamCount: 0,
    presentToday: 0,
    absentToday: 0,
    onLeaveToday: 0,
    attendanceRate: 0,
    tasksOpen: 0,
    tasksDone: 0,
    tripsCount: 0,
    pendingLeavesCount: 0,
    recentLeaves: [],
    recentTasks: [],
    teamPresence: [],
  };

  const currentDateFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [isAr]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Welcome Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-linear-to-br from-card via-card to-brand/5 p-6 shadow-xs sm:p-8">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isAr ? "لوحة تحكم المدير التنفيذية" : "Manager Executive Overview"}</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-normal text-muted-foreground">{currentDateFormatted}</span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isAr ? "أهلاً بك، " : "Welcome back, "}
              <span className="text-brand">{session?.name ?? "Manager"}</span>
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 font-medium text-foreground">
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                {session?.email ?? "empo@hr.com"}
              </span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                {dashboard.presentToday} {isAr ? "حاضر اليوم من" : "present today of"} {dashboard.teamCount} {isAr ? "موظف" : "team members"}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/manager/tasks"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground shadow-xs hover:bg-brand/90 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isAr ? "مهمة جديدة" : "New Task"}</span>
            </Link>

            <Link
              to="/manager/trips"
              className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition"
            >
              <RouteIcon className="h-3.5 w-3.5 text-brand" />
              <span>{isAr ? "رحلة عمل" : "New Trip"}</span>
            </Link>

            <Link
              to="/manager/leaves"
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition"
            >
              <CalendarCheck className="h-3.5 w-3.5 text-amber-500" />
              <span>{isAr ? "إجازات الفريق" : "Team Leaves"}</span>
              {dashboard.pendingLeavesCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {dashboard.pendingLeavesCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title={isAr ? "تحديث البيانات" : "Refresh data"}
              className="grid h-8 w-8 place-items-center rounded-xl border border-input bg-card text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-brand" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {/* Team Members */}
        <Link
          to="/manager/team"
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-brand/50"
        >
          <div className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <Users className="h-4 w-4" />
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-3">
            <p className="font-display text-2xl font-bold text-foreground">{dashboard.teamCount}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{isAr ? "أعضاء فريقي" : "My Team"}</p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {dashboard.presentToday} {isAr ? "نشط اليوم" : "active today"}
          </p>
        </Link>

        {/* Attendance Rate */}
        <Link
          to="/manager/team"
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {dashboard.presentToday}/{dashboard.teamCount}
            </span>
          </div>
          <div className="mt-3">
            <p className="font-display text-2xl font-bold text-foreground">{dashboard.attendanceRate}%</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{isAr ? "نسبة الحضور" : "Attendance Rate"}</p>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, dashboard.attendanceRate)}%` }}
            />
          </div>
        </Link>

        {/* Pending Leaves */}
        <Link
          to="/manager/leaves"
          className={`group relative overflow-hidden rounded-3xl border p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md ${
            dashboard.pendingLeavesCount > 0
              ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
              : "border-border/80 bg-card hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CalendarDays className="h-4 w-4" />
            </span>
            {dashboard.pendingLeavesCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 animate-pulse">
                {isAr ? "يتطلب قرار" : "Action"}
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="font-display text-2xl font-bold text-foreground">{dashboard.pendingLeavesCount}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{isAr ? "إجازات معلقة" : "Pending Leaves"}</p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {isAr ? "انقر للمراجعة والاعتماد" : "Click to review & approve"}
          </p>
        </Link>

        {/* Tasks Open */}
        <Link
          to="/manager/tasks"
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-brand/50"
        >
          <div className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ListChecks className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {dashboard.tasksDone} {isAr ? "مكتمل" : "done"}
            </span>
          </div>
          <div className="mt-3">
            <p className="font-display text-2xl font-bold text-foreground">{dashboard.tasksOpen}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{isAr ? "المهام النشطة" : "Active Tasks"}</p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {dashboard.tasksDone} {isAr ? "مهمة منجزة" : "tasks completed"}
          </p>
        </Link>

        {/* Trips */}
        <Link
          to="/manager/trips"
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-brand/50 col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <RouteIcon className="h-4 w-4" />
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-3">
            <p className="font-display text-2xl font-bold text-foreground">{dashboard.tripsCount}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{isAr ? "رحلات العمل" : "Field Trips"}</p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {isAr ? "سجل الزيارات والبدلات" : "Visits & allowances"}
          </p>
        </Link>
      </div>

      {/* ── Main Two-Column Sections ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Urgent Pending Leaves & Recent Tasks */}
        <div className="space-y-6 lg:col-span-2">
          {/* Urgent Team Leaves Waiting for Action */}
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CalendarCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    {isAr ? "طلبات إجازات بانتظار قرارك" : "Pending Team Leave Requests"}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? "إجراء سريع: اعتماد أو رفض فوري" : "Quick action: 1-click approve or reject"}
                  </p>
                </div>
              </div>

              <Link
                to="/manager/leaves"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>{isAr ? "عرض كل الإجازات" : "View All"}</span>
                <span>→</span>
              </Link>
            </div>

            {dashboard.recentLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-8 text-center bg-muted/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
                <p className="mt-2 text-xs font-medium text-foreground">
                  {isAr ? "رائع! لا توجد طلبات إجازة معلقة حالياً" : "All caught up! No pending leave requests"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAr
                    ? "عندما يقدم أحد أعضاء فريقك طلب إجازة، سيظهر هنا فوراً."
                    : "Requests from your team will appear here for fast review."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.recentLeaves.map((leave) => {
                  const isProcessing = actingLeaveId === leave.id;

                  return (
                    <div
                      key={leave.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3.5 transition-all hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {leave.employeeName}
                          </span>
                          <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                            {leave.leaveType}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {leave.days ?? 1} {isAr ? "أيام" : "days"}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span>
                            {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                          </span>
                          {leave.reason && (
                            <>
                              <span>•</span>
                              <span className="truncate italic max-w-xs">"{leave.reason}"</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Fast Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={decideMutation.isPending}
                          onClick={() => decideMutation.mutate({ id: leave.id, status: "approved" })}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>{isAr ? "موافقة" : "Approve"}</span>
                        </button>

                        <button
                          type="button"
                          disabled={decideMutation.isPending}
                          onClick={() => decideMutation.mutate({ id: leave.id, status: "rejected" })}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 transition disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          <span>{isAr ? "رفض" : "Reject"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Active Tasks */}
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <ListChecks className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    {isAr ? "المهام القائمة للفريق" : "Ongoing Team Tasks"}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? "متابعة تقدم المهام والمسندين إليها" : "Monitor execution and assignments"}
                  </p>
                </div>
              </div>

              <Link
                to="/manager/tasks"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>{isAr ? "إدارة المهام" : "Manage Tasks"}</span>
                <span>→</span>
              </Link>
            </div>

            {dashboard.recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-8 text-center bg-muted/20">
                <ListChecks className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-xs font-medium text-foreground">
                  {isAr ? "لا توجد مهام نشطة حالياً" : "No active tasks at the moment"}
                </p>
                <Link
                  to="/manager/tasks"
                  className="mt-2 text-xs font-semibold text-brand hover:underline"
                >
                  {isAr ? "+ إنشاء مهمة جديدة" : "+ Create new task"}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {dashboard.recentTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-xs text-foreground truncate">{t.title}</p>
                        <span
                          className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
                            t.priority === "high"
                              ? "bg-rose-500/10 text-rose-600"
                              : t.priority === "medium"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t.dueDate ? `${isAr ? "تاريخ الاستحقاق: " : "Due: "}${t.dueDate}` : isAr ? "بدون موعد نهائي" : "No due date"}
                        {t.dueTime ? ` (${t.dueTime})` : ""} • {t.assigneesCount} {isAr ? "مسند إليهم" : "assignees"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize shrink-0 ${
                        t.status === "done"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : t.status === "in_progress"
                          ? "bg-brand/10 text-brand"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 1 Col: Live Team Presence */}
        <div>
          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    {isAr ? "حضور الفريق اليوم" : "Live Team Presence"}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {dashboard.presentToday} {isAr ? "متواجد حالياً" : "active right now"}
                  </p>
                </div>
              </div>

              <Link
                to="/manager/team"
                className="text-xs font-semibold text-brand hover:underline"
              >
                {isAr ? "الفريق بالكامل" : "View All"}
              </Link>
            </div>

            {dashboard.teamPresence.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-8 text-center bg-muted/20">
                <Users className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-xs font-medium text-foreground">
                  {isAr ? "لم يتم تعيين موظفين بعد" : "No team members assigned"}
                </p>
                <Link
                  to="/manager/team"
                  className="mt-1 text-[11px] text-brand hover:underline"
                >
                  {isAr ? "عرض دليل الموظفين" : "Explore directory"}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {dashboard.teamPresence.slice(0, 8).map((member) => {
                  const isPresent = member.status === "present";
                  const isLate = member.status === "late";
                  const isCheckedOut = member.status === "checked_out";
                  const isOnLeave = member.status === "on_leave";

                  return (
                    <div key={member.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar / Initials with Status Ring */}
                        <div className="relative shrink-0">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                              isPresent
                                ? "bg-emerald-500"
                                : isLate
                                ? "bg-amber-500"
                                : isCheckedOut
                                ? "bg-blue-500"
                                : isOnLeave
                                ? "bg-purple-500"
                                : "bg-muted-foreground/40"
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate">{member.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {member.role} • {member.department}
                          </p>
                        </div>
                      </div>

                      {/* Presence Badge */}
                      <div className="text-end shrink-0">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <span>{isAr ? "حاضر" : "In"}</span>
                            {member.inTime && <span>• {member.inTime}</span>}
                          </span>
                        ) : isLate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            <span>{isAr ? "متأخر" : "Late"}</span>
                            {member.inTime && <span>• {member.inTime}</span>}
                          </span>
                        ) : isCheckedOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                            <span>{isAr ? "انصرف" : "Out"}</span>
                            {member.outTime && <span>• {member.outTime}</span>}
                          </span>
                        ) : isOnLeave ? (
                          <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                            {isAr ? "في إجازة" : "On Leave"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {isAr ? "لم يسجل" : "Not in yet"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}