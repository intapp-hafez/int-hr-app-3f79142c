import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LogIn,
  LogOut,
  ListChecks,
  FileText,
  CalendarCheck2,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  Award,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n, useTranslators } from "@/lib/i18n";
import { getMe } from "@/backend/functions/auth.functions";
import { listMyAttendance } from "@/backend/functions/attendance.functions";
import { listMyLeaves } from "@/backend/functions/leaves.functions";
import { listHolidays } from "@/backend/functions/holidays.functions";
import { listTasks } from "@/backend/functions/tasks.functions";
import { mapTaskRow } from "@/lib/task-mapping";
import { useStore, type ManagerTask } from "@/lib/store";
import { useSession } from "@/lib/auth";
import { formatDate } from "@/lib/date-format";

export function EmployeeDashboard() {
  const { t, lang } = useI18n();
  const { tName, tDept, tBranch, tHoliday } = useTranslators();
  const [now, setNow] = useState(new Date());
  const [showKpiModal, setShowKpiModal] = useState(false);

  const meFn = useServerFn(getMe);
  const attFn = useServerFn(listMyAttendance);
  const lvFn = useServerFn(listMyLeaves);
  const holFn = useServerFn(listHolidays);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const attQ = useQuery({ queryKey: ["my-attendance"], queryFn: () => attFn() });
  const lvQ = useQuery({ queryKey: ["my-leaves"], queryFn: () => lvFn() });
  const holQ = useQuery({ queryKey: ["holidays"], queryFn: () => holFn() });

  const session = useSession();
  const employees = useStore((s) => s.employees);
  const currentEmpId = useStore((s) => s.currentEmployeeId);
  const meId = session?.employeeId ?? employees.find((e) => e.name === session?.name)?.id ?? currentEmpId;

  const listTasksFn = useServerFn(listTasks);
  const { data: taskRows = [] } = useQuery({
    queryKey: ["tasks-db"],
    queryFn: () => listTasksFn(),
    enabled: !!meId,
  });
  
  const tasks: ManagerTask[] = useMemo(() => (taskRows as any[]).map(mapTaskRow), [taskRows]);
  const allMyTasks: ManagerTask[] = useMemo(() => {
    const myKey = (id: string) => id === meId || id === session?.employeeId;
    return tasks.filter((tk) => tk.assignees.some(myKey));
  }, [tasks, meId, session?.employeeId]);
  const myTasks: ManagerTask[] = useMemo(() => {
    return allMyTasks.filter((tk) => tk.status === "pending").slice(0, 5);
  }, [allMyTasks]);
  const completedTasksCount = useMemo(() => {
    return allMyTasks.filter((tk: any) => tk.status === "completed" || tk.status === "done").length;
  }, [allMyTasks]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const profile: any = meQ.data?.profile ?? null;
  const attendance: any[] = (attQ.data as any[]) ?? [];
  const leaves: any[] = (lvQ.data as any[]) ?? [];
  const holidaysData: any[] = (holQ.data as any[]) ?? [];

  const today = now.toISOString().slice(0, 10);
  const todayRow = attendance.find((a) => a.date === today);
  const isCheckedIn = !!todayRow?.in_time && !todayRow?.out_time;
  const dayComplete = !!todayRow?.in_time && !!todayRow?.out_time;

  const monthStats = useMemo(() => {
    const ym = today.slice(0, 7);
    const m = attendance.filter((a) => typeof a.date === "string" && a.date.startsWith(ym));
    const present = m.filter((a) => a.status === "present" || a.status === "late").length;
    const onTime = m.filter((a) => a.status === "present").length;
    const late = m.filter((a) => a.status === "late").length;
    const approvedLeaves = leaves.filter((l) => l.status === "approved").length;
    const totalRecorded = m.length;
    const attendanceRate = totalRecorded > 0 ? Math.round((present / totalRecorded) * 100) : 100;
    const onTimeRate = present > 0 ? Math.round((onTime / present) * 100) : 100;
    return { present, onTime, late, leaves: approvedLeaves, attendanceRate, onTimeRate };
  }, [attendance, leaves, today]);

  const upcomingHolidays = useMemo(
    () => holidaysData.filter((h) => h.date >= today).slice(0, 3),
    [holidaysData, today],
  );

  const localeTag = lang === "ar" ? "ar-EG" : "en-GB";
  const date = now.toLocaleDateString(localeTag, { weekday: "long", day: "numeric", month: "long" });

  const loading = meQ.isLoading || attQ.isLoading;

  return (
    <div className="space-y-5">
      <section className="min-w-0 text-start">
        <p className="text-xs font-medium text-muted-foreground">{t("welcome")}</p>
        <h1 className="mt-1 break-words font-display text-2xl font-semibold">
          {loading ? "…" : tName(profile?.full_name) || profile?.email || "—"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {tDept(profile?.department ?? "")} {profile?.branch ? `• ${tBranch(profile.branch)}` : ""}
        </p>
      </section>

      <Link
        to="/employee/check"
        className="group block rounded-md border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{date}</p>
            <h2 className="mt-2 font-display text-lg font-semibold text-foreground">{t("checkInOut")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {todayRow?.in_time
                ? `${new Date(todayRow.in_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}${todayRow.out_time ? ` → ${new Date(todayRow.out_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}` : ""}`
                : t("ready")}
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            {isCheckedIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold text-primary">
          <span>{isCheckedIn ? t("checkOut") : dayComplete ? t("checkInOut") : t("checkIn")}</span>
          <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
        </div>
      </Link>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-foreground">{lang === "ar" ? "مساحة العمل" : "Workspace"}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Link to="/employee/tasks" className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-3.5 transition-colors hover:border-info/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted">
            <ListChecks className="h-5 w-5 text-info" />
            <div className="min-w-0"><h3 className="text-sm font-semibold">{t("myTasks")}</h3><p className="mt-1 text-xs text-muted-foreground">{myTasks.length} {t("pending")}</p></div>
          </Link>
          <Link to="/employee/leaves" className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-3.5 transition-colors hover:border-warning/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted">
            <FileText className="h-5 w-5 text-warning-foreground" />
            <div className="min-w-0"><h3 className="text-sm font-semibold">{lang === "ar" ? "الطلبات" : "Requests"}</h3><p className="mt-1 text-xs text-muted-foreground">{monthStats.leaves} {t("leaves")}</p></div>
          </Link>
          <Link to="/employee/attendance" className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-3.5 transition-colors hover:border-success/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted">
            <CalendarCheck2 className="h-5 w-5 text-success" />
            <div className="min-w-0"><h3 className="text-sm font-semibold">{t("attendance")}</h3><p className="mt-1 text-xs text-muted-foreground">{monthStats.present} {t("present")}</p></div>
          </Link>
          <Button type="button" variant="outline" onClick={() => setShowKpiModal(true)} className="h-auto min-w-0 flex-col items-start gap-3 whitespace-normal rounded-md border-border bg-card p-3.5 text-start shadow-none hover:border-primary/40 hover:bg-muted">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div className="min-w-0"><h3 className="text-sm font-semibold">{t("kpis")}</h3><p className="mt-1 text-xs text-muted-foreground">{monthStats.attendanceRate}% {t("attendanceRate")}</p></div>
          </Button>
        </div>
      </section>

      {/* KPI Details Modal */}
      <Dialog open={showKpiModal} onOpenChange={setShowKpiModal}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-brand">
              <TrendingUp className="h-5 w-5" />
              <DialogTitle className="font-display text-lg font-semibold">
                {lang === "ar" ? "مؤشرات الأداء (KPIs)" : "Performance & KPIs"}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "ar"
                ? "ملخص مؤشرات الأداء الخاصة بك للشهر الحالي"
                : "Your personal performance metrics for the current month"}
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Overall Score Banner */}
            <div className="flex items-center justify-between rounded-2xl bg-gradient-brand p-4 text-brand-foreground shadow-brand">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider opacity-85">
                  {lang === "ar" ? "التقييم العام" : "Overall Score"}
                </p>
                <p className="mt-1 font-display text-3xl font-bold">{monthStats.attendanceRate}%</p>
                <p className="text-xs opacity-90 mt-0.5">
                  {monthStats.attendanceRate >= 90
                    ? lang === "ar" ? "أداء ممتاز" : "Excellent performance"
                    : monthStats.attendanceRate >= 75
                      ? lang === "ar" ? "أداء جيد جداً" : "Good performance"
                      : lang === "ar" ? "يحتاج إلى تحسين" : "Needs attention"}
                </p>
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 backdrop-blur">
                <Award className="h-7 w-7 text-white" />
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>{t("attendanceRate")}</span>
                </div>
                <p className="mt-2 font-display text-xl font-bold text-foreground">
                  {monthStats.attendanceRate}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {monthStats.present} {t("present")}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>{lang === "ar" ? "الالتزام بالوقت" : "On-Time Rate"}</span>
                </div>
                <p className="mt-2 font-display text-xl font-bold text-foreground">
                  {monthStats.onTimeRate}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {monthStats.late} {t("late")}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListChecks className="h-4 w-4 text-amber-500" />
                  <span>{lang === "ar" ? "إنجاز المهام" : "Tasks Done"}</span>
                </div>
                <p className="mt-2 font-display text-xl font-bold text-foreground">
                  {allMyTasks.length > 0 ? `${Math.round((completedTasksCount / allMyTasks.length) * 100)}%` : "100%"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {completedTasksCount} / {allMyTasks.length || myTasks.length} {t("tasks")}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span>{t("leaves")}</span>
                </div>
                <p className="mt-2 font-display text-xl font-bold text-foreground">
                  {monthStats.leaves}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {lang === "ar" ? "إجازات معتمدة" : "Approved leaves"}
                </p>
              </div>
            </div>

            {/* Quick Links inside modal */}
            <div className="flex gap-2 pt-1">
              <Link
                to="/employee/attendance"
                onClick={() => setShowKpiModal(false)}
                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-center text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                {t("attendanceRecords")} →
              </Link>
              <Link
                to="/employee/tasks"
                onClick={() => setShowKpiModal(false)}
                className="flex-1 rounded-xl bg-brand py-2.5 text-center text-xs font-semibold text-brand-foreground hover:opacity-90 transition-opacity"
              >
                {t("myTasks")} →
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-brand" /> {t("myTasks")}
        </h2>
        {myTasks.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">No new assigned tasks.</p>
        ) : (
          <ul className="space-y-2">
            {myTasks.map((tk) => (
              <li key={tk.id} className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold">{tk.title}</p>
                <p className="text-[11px] text-muted-foreground">{tk.date} {tk.dueTime ? `• ${tk.dueTime}` : ""}</p>
                {tk.description && <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{tk.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">{t("attendance")}</h2>
        {attendance.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="divide-y divide-border">
            {attendance.slice(0, 3).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm font-medium">{formatDate(a.date)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.in_time ? new Date(a.in_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {" → "}
                      {a.out_time ? new Date(a.out_time).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" }) : "—"}
                      {a.branch ? ` • ${tBranch(a.branch)}` : ""}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${a.status === "late" ? "bg-warning/20 text-warning-foreground" : "bg-success/15 text-success"}`}>
                  {a.status === "late" ? t("late") : t("present")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-brand" /> {t("upcomingHolidays")}
        </h2>
        {upcomingHolidays.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2.5">
            {upcomingHolidays.map((h: any) => (
              <li key={h.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{tHoliday(h.name)}</p>
                </div>
                <span className="text-xs font-semibold tabular-nums">{formatDate(h.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
