import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Lock,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  listEvaluationPeriods,
  saveEvaluationPeriod,
  toggleEvaluationPeriodStatus,
} from "@/backend/functions/kpi-evaluations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EvaluationPeriodsTabProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  isAr: boolean;
  dir: "rtl" | "ltr";
}

function getDaysRemainingText(startDate: string, endDate: string, status: string, isAr: boolean): string {
  const today = new Date().toISOString().slice(0, 10);
  const msPerDay = 86_400_000;

  if (status === "active") {
    const diff = Math.ceil((new Date(endDate).getTime() - new Date(today).getTime()) / msPerDay);
    if (diff === 0) return isAr ? "ينتهي اليوم" : "Ends today";
    return isAr ? `متبقي ${diff} يوم` : `${diff} day${diff === 1 ? "" : "s"} left`;
  }
  if (status === "scheduled") {
    const diff = Math.ceil((new Date(startDate).getTime() - new Date(today).getTime()) / msPerDay);
    return isAr ? `يبدأ خلال ${diff} يوم` : `Starts in ${diff} day${diff === 1 ? "" : "s"}`;
  }
  if (status === "expired") {
    return isAr ? "مقفل تلقائياً" : "Auto-Locked";
  }
  return isAr ? "مغلق يدوياً" : "Manually Locked";
}

export function EvaluationPeriodsTab({
  selectedYear,
  onYearChange,
  isAr,
  dir,
}: EvaluationPeriodsTabProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [searchQuery, setSearchQuery] = useState("");
  const [quarterFilter, setQuarterFilter] = useState<"all" | "q1" | "q2" | "q3" | "q4">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "scheduled" | "expired" | "manually_closed"
  >("all");

  // Modal state for Create / Edit period
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [formManagerId, setFormManagerId] = useState("");
  const [formQuarter, setFormQuarter] = useState<"q1" | "q2" | "q3" | "q4">("q1");
  const [formStartDate, setFormStartDate] = useState(todayStr);
  const [formEndDate, setFormEndDate] = useState(todayStr);
  const [formReason, setFormReason] = useState("");

  // Modal state for Reopen / Extend period
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopeningPeriod, setReopeningPeriod] = useState<any | null>(null);
  const [reopenEndDate, setReopenEndDate] = useState(todayStr);
  const [reopenReason, setReopenReason] = useState("");

  const listPeriodsFn = useServerFn(listEvaluationPeriods);
  const savePeriodFn = useServerFn(saveEvaluationPeriod);
  const togglePeriodFn = useServerFn(toggleEvaluationPeriodStatus);

  const {
    data: periodsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["kpi-evaluation-periods", selectedYear],
    queryFn: () => listPeriodsFn({ data: { year: selectedYear, quarter: "all", status: "all" } }),
  });

  const managers = periodsData?.managers || [];
  const periods = periodsData?.periods || [];
  const logs = periodsData?.logs || [];

  const saveMutation = useMutation({
    mutationFn: (payload: {
      id?: string;
      managerId: string;
      year: number;
      quarter: "q1" | "q2" | "q3" | "q4";
      startDate: string;
      endDate: string;
      reason?: string;
    }) => savePeriodFn({ data: payload }),
    onSuccess: () => {
      toast.success(
        isAr
          ? editingPeriodId
            ? "تم تحديث فترة التقييم بنجاح"
            : "تم إنشاء فترة التقييم بنجاح"
          : editingPeriodId
            ? "Evaluation period updated successfully"
            : "Evaluation period created successfully"
      );
      setPeriodModalOpen(false);
      setEditingPeriodId(null);
      setFormReason("");
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation-periods"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-my-manager-periods"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "فشل حفظ فترة التقييم" : "Failed to save evaluation period"));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      action: "reopen" | "close";
      newEndDate?: string;
      reason?: string;
    }) => togglePeriodFn({ data: payload }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === "close"
          ? isAr
            ? "تم إغلاق فترة التقييم يدوياً"
            : "Evaluation period manually closed"
          : isAr
            ? "تمت إعادة فتح وتمديد فترة التقييم بنجاح"
            : "Evaluation period reopened successfully"
      );
      setReopenModalOpen(false);
      setReopeningPeriod(null);
      setReopenReason("");
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation-periods"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-my-manager-periods"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "تعذر تنفيذ الإجراء" : "Action failed"));
    },
  });

  // Compute summary stats
  const stats = useMemo(() => {
    const active = periods.filter((p: any) => p.status === "active").length;
    const scheduled = periods.filter((p: any) => p.status === "scheduled").length;
    const locked = periods.filter(
      (p: any) => p.status === "expired" || p.status === "manually_closed"
    ).length;
    return {
      totalManagers: managers.length,
      active,
      scheduled,
      locked,
    };
  }, [managers, periods]);

  // Build unified rows: configured periods + managers without any period yet (when statusFilter === 'all')
  const displayRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchedPeriods = periods.filter((p: any) => {
      if (quarterFilter !== "all" && p.quarter !== quarterFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q) {
        const name = String(p.manager_name || "").toLowerCase();
        const dept = String(p.department_name || "").toLowerCase();
        const deptAr = String(p.department_name_ar || "").toLowerCase();
        const code = String(p.manager_code || "").toLowerCase();
        if (!name.includes(q) && !dept.includes(q) && !deptAr.includes(q) && !code.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const managersWithPeriods = new Set(periods.map((p: any) => p.manager_id));
    const unassignedManagers =
      statusFilter === "all" && quarterFilter === "all"
        ? managers
            .filter((m: any) => !managersWithPeriods.has(m.id))
            .filter((m: any) => {
              if (!q) return true;
              const name = String(m.full_name || "").toLowerCase();
              const dept = String(m.department_name || "").toLowerCase();
              const deptAr = String(m.department_name_ar || "").toLowerCase();
              return name.includes(q) || dept.includes(q) || deptAr.includes(q);
            })
            .map((m: any) => ({
              id: `unassigned-${m.id}`,
              isUnassigned: true,
              manager_id: m.id,
              manager_name: m.full_name,
              manager_code: m.emp_code,
              department_name: m.department_name,
              department_name_ar: m.department_name_ar,
              team_count: m.team_count,
              quarter: null,
              status: "unassigned",
            }))
        : [];

    return [...matchedPeriods, ...unassignedManagers];
  }, [periods, managers, searchQuery, quarterFilter, statusFilter]);

  const handleOpenCreateModal = (managerId?: string) => {
    setEditingPeriodId(null);
    setFormManagerId(managerId || managers[0]?.id || "");
    setFormQuarter(quarterFilter !== "all" ? quarterFilter : "q1");
    setFormStartDate(todayStr);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 14);
    setFormEndDate(nextMonth.toISOString().slice(0, 10));
    setFormReason("");
    setPeriodModalOpen(true);
  };

  const handleOpenEditModal = (period: any) => {
    setEditingPeriodId(period.id);
    setFormManagerId(period.manager_id);
    setFormQuarter(period.quarter);
    setFormStartDate(period.start_date);
    setFormEndDate(period.end_date);
    setFormReason("");
    setPeriodModalOpen(true);
  };

  const handleOpenReopenModal = (period: any) => {
    setReopeningPeriod(period);
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 7);
    const defaultEndStr = defaultEnd.toISOString().slice(0, 10);
    setReopenEndDate(period.end_date >= todayStr ? period.end_date : defaultEndStr);
    setReopenReason("");
    setReopenModalOpen(true);
  };

  const handleSubmitPeriod = () => {
    if (!formManagerId) {
      toast.error(isAr ? "يرجى اختيار المدير" : "Please select a manager");
      return;
    }
    if (!formStartDate || !formEndDate) {
      toast.error(isAr ? "يرجى تحديد تاريخ البداية والنهاية" : "Please select start and end dates");
      return;
    }
    if (formEndDate < formStartDate) {
      toast.error(isAr ? "تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية" : "End date must be on or after start date");
      return;
    }

    saveMutation.mutate({
      ...(editingPeriodId ? { id: editingPeriodId } : {}),
      managerId: formManagerId,
      year: selectedYear,
      quarter: formQuarter,
      startDate: formStartDate,
      endDate: formEndDate,
      reason: formReason.trim(),
    });
  };

  const handleConfirmReopen = () => {
    if (!reopeningPeriod) return;
    if (!reopenEndDate || reopenEndDate < reopeningPeriod.start_date) {
      toast.error(isAr ? "تاريخ الانتهاء الجديد غير صالح" : "Invalid new end date");
      return;
    }
    toggleMutation.mutate({
      id: reopeningPeriod.id,
      action: "reopen",
      newEndDate: reopenEndDate,
      reason: reopenReason.trim(),
    });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold gap-1.5 px-2.5 py-0.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {isAr ? "نشط" : "Active"}
          </Badge>
        );
      case "scheduled":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[11px] font-bold gap-1 px-2.5 py-0.5">
            <CalendarClock className="h-3 w-3" />
            {isAr ? "مجدول" : "Scheduled"}
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold gap-1 px-2.5 py-0.5">
            <Lock className="h-3 w-3" />
            {isAr ? "منتهي" : "Expired"}
          </Badge>
        );
      case "manually_closed":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold gap-1 px-2.5 py-0.5">
            <XCircle className="h-3 w-3" />
            {isAr ? "مغلق يدوياً" : "Manually Closed"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[11px] text-muted-foreground font-medium px-2.5 py-0.5">
            {isAr ? "غير محدد" : "Not Assigned"}
          </Badge>
        );
    }
  };

  const renderActionLabel = (action: string) => {
    switch (action) {
      case "created":
        return isAr ? "إنشاء فترة" : "created";
      case "updated":
        return isAr ? "تعديل فترة" : "updated";
      case "extended":
        return isAr ? "تمديد فترة" : "extended";
      case "reopened":
        return isAr ? "إعادة فتح" : "reopened";
      case "manually_closed":
        return isAr ? "إغلاق يدوي" : "manually closed";
      default:
        return action;
    }
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-border bg-card p-5 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isAr ? "حوكمة صلاحيات التقييم" : "Evaluation Access Control"}
            </span>
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">
            {isAr ? "فترات تقييم المديرين والتحكم بالوصول" : "Evaluation Periods & Manager Access Control"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "تحديد فترات البداية والنهاية لكل ربع سنوي، مع الإغلاق التلقائي وإمكانية إعادة الفتح وسجل التدقيق."
              : "Configure quarterly evaluation windows, automatic expiration locks, admin reopen controls, and full audit history."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl gap-1.5 h-9 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>{isAr ? "تحديث" : "Refresh"}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => handleOpenCreateModal()}
            className="rounded-xl gap-1.5 h-9 bg-orange-600 hover:bg-orange-700 text-white font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>{isAr ? "فترة تقييم جديدة" : "New Evaluation Period"}</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {isAr ? "إجمالي المديرين" : "Total Managers"}
            </span>
            <p className="font-display text-2xl font-bold text-foreground">{stats.totalManagers}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-card p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {isAr ? "فترات نشطة" : "Active Windows"}
            </span>
            <p className="font-display text-2xl font-bold text-emerald-600">{stats.active}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-card p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {isAr ? "فترات مجدولة" : "Scheduled"}
            </span>
            <p className="font-display text-2xl font-bold text-blue-600">{stats.scheduled}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-card p-4 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {isAr ? "منتهية / مغلقة" : "Expired / Closed"}
            </span>
            <p className="font-display text-2xl font-bold text-rose-600">{stats.locked}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <Lock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "ابحث باسم المدير أو القسم..." : "Search manager or department..."}
            className="rounded-xl ps-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold h-9 cursor-pointer"
          >
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear + 1}>{currentYear + 1}</option>
          </select>

          <select
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value as any)}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold h-9 cursor-pointer"
          >
            <option value="all">{isAr ? "جميع الأرباع (Q1–Q4)" : "Quarter: All (Q1–Q4)"}</option>
            <option value="q1">Q1</option>
            <option value="q2">Q2</option>
            <option value="q3">Q3</option>
            <option value="q4">Q4</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold h-9 cursor-pointer"
          >
            <option value="all">{isAr ? "الحالة: الكل" : "Status: All"}</option>
            <option value="active">{isAr ? "نشط" : "Active"}</option>
            <option value="scheduled">{isAr ? "مجدول" : "Scheduled"}</option>
            <option value="expired">{isAr ? "منتهي" : "Expired"}</option>
            <option value="manually_closed">{isAr ? "مغلق يدوياً" : "Manually Closed"}</option>
          </select>
        </div>
      </div>

      {/* Manager Evaluation Periods Table */}
      <div className="rounded-3xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/20">
          <h3 className="font-display text-sm font-bold text-foreground">
            {isAr ? "جدول فترات تقييم المديرين" : "Manager Evaluation Periods"}
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {displayRows.length} {isAr ? "سجل" : "records"}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <span>{isAr ? "جارٍ تحميل فترات التقييم..." : "Loading evaluation periods..."}</span>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <ShieldAlert className="h-8 w-8 text-muted-foreground/50 mx-auto" />
            <p className="font-semibold text-foreground">
              {isAr ? "لا توجد نتائج مطابقة" : "No matching evaluation periods found"}
            </p>
            <p>
              {isAr
                ? "قم بإضافة فترة تقييم جديدة أو تعديل خيارات البحث والفلترة."
                : "Create a new evaluation period or adjust your search/filter criteria."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-4 py-3 text-start">{isAr ? "المدير" : "Manager"}</th>
                  <th className="px-4 py-3 text-start">{isAr ? "القسم والفريق" : "Department & Team"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "الربع" : "Quarter"}</th>
                  <th className="px-4 py-3 text-start">{isAr ? "فترة التقييم (من → إلى)" : "Evaluation Window (Start → End)"}</th>
                  <th className="px-4 py-3 text-center">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-end">{isAr ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {displayRows.map((row: any) => {
                  const initials = String(row.manager_name || "MG")
                    .split(" ")
                    .slice(0, 2)
                    .map((w: string) => w[0])
                    .join("")
                    .toUpperCase();

                  const deptLabel = isAr
                    ? row.department_name_ar || row.department_name || "غير محدد"
                    : row.department_name || "Unassigned";

                  return (
                    <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{row.manager_name}</div>
                            {row.manager_code && (
                              <span className="text-[10px] font-mono text-muted-foreground">{row.manager_code}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="font-medium text-foreground">{deptLabel}</span>
                        <span className="mx-1.5">•</span>
                        <span className="text-[11px]">
                          {row.team_count} {isAr ? "موظف" : "Team Members"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {row.quarter ? (
                          <Badge variant="outline" className="font-mono font-bold text-[11px]">
                            {String(row.quarter).toUpperCase()} {row.evaluation_year}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {row.isUnassigned ? (
                          <span className="text-muted-foreground italic text-[11px]">
                            {isAr ? "لم يتم تعيين فترة تقييم بعد" : "No period assigned yet"}
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs text-foreground font-medium">
                              {row.start_date} <span className="text-muted-foreground mx-1">→</span> {row.end_date}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {getDaysRemainingText(row.start_date, row.end_date, row.status, isAr)}
                              {row.reopened_count > 0 && (
                                <span className="ms-2 text-orange-600 font-medium">
                                  • {isAr ? `أعيد فتحه ${row.reopened_count} مرة` : `Reopened ${row.reopened_count}x`}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">{renderStatusBadge(row.status)}</td>

                      <td className="px-4 py-3 text-end">
                        {row.isUnassigned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCreateModal(row.manager_id)}
                            className="h-7 px-2.5 text-[11px] rounded-lg gap-1 border-orange-300 text-orange-600 hover:bg-orange-50 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>{isAr ? "تعيين فترة" : "Assign Period"}</span>
                          </Button>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {(row.status === "expired" || row.status === "manually_closed") && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenReopenModal(row)}
                                className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white cursor-pointer gap-1"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>{isAr ? "إعادة فتح / تمديد" : "Reopen / Extend"}</span>
                              </Button>
                            )}

                            {row.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  toggleMutation.mutate({
                                    id: row.id,
                                    action: "close",
                                    reason: "Manually closed by HR Admin",
                                  })
                                }
                                disabled={toggleMutation.isPending}
                                className="h-7 px-2.5 text-[11px] rounded-lg border-rose-300 text-rose-600 hover:bg-rose-50 cursor-pointer gap-1"
                              >
                                <Lock className="h-3 w-3" />
                                <span>{isAr ? "إغلاق" : "Close"}</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditModal(row)}
                              className="h-7 px-2.5 text-[11px] rounded-lg cursor-pointer gap-1"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>{row.status === "active" ? (isAr ? "تمديد" : "Extend") : (isAr ? "تعديل" : "Edit")}</span>
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Period Audit Log Card */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-orange-600" />
            <span>{isAr ? "سجل التدقيق والتغييرات لفترات التقييم" : "Recent Period Audit Log"}</span>
          </h3>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {logs.length} {isAr ? "حركة" : "entries"}
          </Badge>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {isAr ? "لا توجد حركات مسجلة في سجل التدقيق بعد." : "No audit log entries recorded yet."}
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
            {logs.map((log: any) => (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-start sm:items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-semibold text-foreground">{log.admin_name}</span>{" "}
                    <span className="text-muted-foreground">{renderActionLabel(log.action)}</span>{" "}
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 mx-0.5">
                      {String(log.quarter).toUpperCase()} {log.evaluation_year}
                    </Badge>{" "}
                    <span className="text-muted-foreground">{isAr ? "للمدير" : "for"}</span>{" "}
                    <span className="font-semibold text-foreground">{log.manager_name}</span>
                    {log.new_start_date && log.new_end_date && (
                      <span className="text-[11px] font-mono text-muted-foreground ms-1.5">
                        ({log.new_start_date} → {log.new_end_date})
                      </span>
                    )}
                    {log.reason && (
                      <span className="block text-[11px] text-muted-foreground italic mt-0.5">
                        “{log.reason}”
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Evaluation Period Dialog */}
      <Dialog open={periodModalOpen} onOpenChange={setPeriodModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-orange-600" />
              <span>
                {editingPeriodId
                  ? isAr
                    ? "تعديل / تمديد فترة التقييم"
                    : "Edit / Extend Evaluation Period"
                  : isAr
                    ? "تعيين فترة تقييم جديدة"
                    : "Assign New Evaluation Period"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isAr
                ? "حدد المدير، الربع السنوي، وتاريخي البداية والنهاية. يمنع النظام تداخل الفترات لنفس المدير والربع."
                : "Select manager, quarter, start and end dates. Overlapping periods for the same manager and quarter are blocked."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isAr ? "المدير" : "Manager"}</Label>
              <select
                value={formManagerId}
                onChange={(e) => setFormManagerId(e.target.value)}
                disabled={!!editingPeriodId}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium h-9 cursor-pointer"
              >
                <option value="">{isAr ? "-- اختر المدير --" : "-- Select Manager --"}</option>
                {managers.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({isAr ? m.department_name_ar || m.department_name || "عام" : m.department_name || "General"} • {m.team_count})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isAr ? "الربع السنوي" : "Quarter"}</Label>
                <select
                  value={formQuarter}
                  onChange={(e) => setFormQuarter(e.target.value as any)}
                  disabled={!!editingPeriodId}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold h-9 cursor-pointer"
                >
                  <option value="q1">Q1</option>
                  <option value="q2">Q2</option>
                  <option value="q3">Q3</option>
                  <option value="q4">Q4</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isAr ? "السنة" : "Year"}</Label>
                <Input value={selectedYear} disabled className="rounded-xl h-9 text-xs font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isAr ? "تاريخ البداية" : "Start Date"}</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isAr ? "تاريخ النهاية" : "End Date"}</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isAr ? "سبب التعديل / ملاحظات (اختياري)" : "Reason / Notes (Optional)"}
              </Label>
              <Input
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder={isAr ? "مثال: فتح تقييم الربع الأول لفريق المبيعات" : "e.g., Opening Q1 evaluation window"}
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPeriodModalOpen(false)}
              className="rounded-xl cursor-pointer"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitPeriod}
              disabled={saveMutation.isPending}
              className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white cursor-pointer gap-1.5"
            >
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{editingPeriodId ? (isAr ? "حفظ التعديلات" : "Save Changes") : (isAr ? "إنشاء الفترة" : "Create Period")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen / Extend Expired Period Dialog */}
      <Dialog open={reopenModalOpen} onOpenChange={setReopenModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold flex items-center gap-2 text-orange-600">
              <RotateCcw className="h-5 w-5" />
              <span>{isAr ? "إعادة فتح وتمديد فترة التقييم" : "Reopen & Extend Evaluation Period"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {reopeningPeriod &&
                (isAr
                  ? `إعادة فتح تقييم ${String(reopeningPeriod.quarter).toUpperCase()} (${reopeningPeriod.evaluation_year}) للمدير ${reopeningPeriod.manager_name}.`
                  : `Reopening ${String(reopeningPeriod.quarter).toUpperCase()} (${reopeningPeriod.evaluation_year}) for ${reopeningPeriod.manager_name}.`)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isAr ? "تاريخ الانتهاء الجديد" : "New End Date"}</Label>
              <Input
                type="date"
                value={reopenEndDate}
                onChange={(e) => setReopenEndDate(e.target.value)}
                className="rounded-xl h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isAr ? "سبب إعادة الفتح" : "Reopen Reason"}</Label>
              <Input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder={isAr ? "مثال: استكمال تقييم موظف جديد أو تعديل ملاحظات" : "e.g., Extending deadline for late submission"}
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReopenModalOpen(false)}
              className="rounded-xl cursor-pointer"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReopen}
              disabled={toggleMutation.isPending}
              className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white cursor-pointer gap-1.5"
            >
              {toggleMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isAr ? "تأكيد إعادة الفتح" : "Confirm Reopen"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
