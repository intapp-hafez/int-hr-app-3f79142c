import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  X,
  Paperclip,
  Search,
  Inbox,
  Calendar,
  CalendarCheck,
  Clock,
  User,
  Building,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";
import {
  listManagerTeamLeaves,
  decideLeave,
  decideLeavesBulk,
  type LeaveQueueRow,
} from "@/backend/functions/leaves.functions";
import { formatDate } from "@/lib/date-format";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/manager/leaves")({
  component: ManagerTeamLeavesPage,
});

const STATUS_TONES: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  pending: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
    icon: Clock,
  },
  approved: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
    icon: XCircle,
  },
  cancelled: {
    bg: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    border: "border-border",
    icon: AlertCircle,
  },
};

type FilterType = "all" | "pending" | "approved" | "rejected";

function ManagerTeamLeavesPage() {
  const { t, isAr } = useI18n();
  const session = useSession();
  const qc = useQueryClient();

  const listFn = useServerFn(listManagerTeamLeaves);
  const decideFn = useServerFn(decideLeave);
  const bulkDecideFn = useServerFn(decideLeavesBulk);

  const [filter, setFilter] = useState<FilterType>("pending");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const { data: rows = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["manager-team-leaves"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["manager-team-leaves"] });
    qc.invalidateQueries({ queryKey: ["manager-dashboard-data"] });
    qc.invalidateQueries({ queryKey: ["manager-stats"] });
    qc.invalidateQueries({ queryKey: ["leave-queue"] });
  };

  const decideMutation = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" | "cancelled" }) => {
      setActionInProgress(v.id);
      return decideFn({ data: { ...v, notify: true } });
    },
    onSuccess: (_, v) => {
      toast.success(
        v.status === "approved"
          ? isAr
            ? "تمت الموافقة على طلب الإجازة بنجاح"
            : "Leave request approved successfully"
          : v.status === "rejected"
          ? isAr
            ? "تم رفض طلب الإجازة"
            : "Leave request rejected"
          : isAr
          ? "تم إلغاء الموافقة"
          : "Approval cancelled"
      );
      setSelected((prev) => {
        const next = { ...prev };
        delete next[v.id];
        return next;
      });
      refreshAll();
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "حدث خطأ أثناء تنفيذ القرار" : "Failed to record decision"));
    },
    onSettled: () => {
      setActionInProgress(null);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (v: { ids: string[]; status: "approved" | "rejected" | "cancelled" }) =>
      bulkDecideFn({ data: { ...v, notify: true } }),
    onSuccess: (res: any, v) => {
      toast.success(
        `${v.status === "approved" ? (isAr ? "تمت الموافقة على" : "Approved") : (isAr ? "تم رفض" : "Rejected")} ${
          res?.done ?? 0
        } ${isAr ? "طلبات إجازة" : "leave requests"}`
      );
      setSelected({});
      refreshAll();
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "فشلت العملية المجمعة" : "Bulk decision failed"));
    },
  });

  const counts = useMemo(() => {
    return {
      all: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.employee_name?.toLowerCase().includes(q) ||
        r.employee_email?.toLowerCase().includes(q) ||
        r.leave_type_name?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([_, v]) => v).map(([k]) => k),
    [selected]
  );

  const toggleSelectAll = () => {
    const pendingInView = filteredRows.filter((r) => r.status === "pending");
    if (selectedIds.length === pendingInView.length && pendingInView.length > 0) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      for (const r of pendingInView) {
        next[r.id] = true;
      }
      setSelected(next);
    }
  };

  const isBusy = decideMutation.isPending || bulkMutation.isPending;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <CalendarCheck className="h-4 w-4" />
            <span>{isAr ? "إدارة الفريق" : "Team Management"}</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {isAr ? "إجازات الفريق" : "Team Leaves"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? "مراجعة واعتماد أو رفض طلبات الإجازات المقدمة من أعضاء فريقك."
              : "Review, approve, or reject leave requests submitted by your team members."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-input bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-xs transition hover:bg-muted disabled:opacity-50"
            title={isAr ? "تحديث البيانات" : "Refresh"}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-brand" : "text-muted-foreground"}`} />
            <span className="hidden sm:inline">{isAr ? "تحديث" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            key: "all",
            label: isAr ? "إجمالي الطلبات" : "Total Requests",
            value: counts.all,
            icon: Calendar,
            color: "text-brand",
            bg: "bg-brand/10",
          },
          {
            key: "pending",
            label: isAr ? "بانتظار القرار" : "Pending Review",
            value: counts.pending,
            icon: Clock,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10",
            badge: counts.pending > 0 ? (isAr ? "يتطلب إجراء" : "Action Needed") : undefined,
          },
          {
            key: "approved",
            label: isAr ? "تمت الموافقة" : "Approved",
            value: counts.approved,
            icon: CheckCircle2,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            key: "rejected",
            label: isAr ? "المرفوضة" : "Rejected",
            value: counts.rejected,
            icon: XCircle,
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10",
          },
        ].map((kpi) => (
          <button
            key={kpi.key}
            onClick={() => setFilter(kpi.key as FilterType)}
            className={`group flex flex-col justify-between rounded-2xl border p-4 text-start transition-all ${
              filter === kpi.key
                ? "border-brand ring-2 ring-brand/20 bg-card shadow-sm"
                : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`grid h-9 w-9 place-items-center rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              {kpi.badge && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 animate-pulse">
                  {kpi.badge}
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="font-display text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{kpi.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "بحث بالاسم، القسم، نوع الإجازة أو السبب…" : "Filter by employee, leave type, reason…"}
            className="w-full rounded-xl border border-input bg-background ps-9 pe-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Filters */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
            {(["pending", "approved", "rejected", "all"] as FilterType[]).map((tab) => {
              const active = filter === tab;
              const tabLabel =
                tab === "pending"
                  ? isAr
                    ? "معلقة"
                    : "Pending"
                  : tab === "approved"
                  ? isAr
                    ? "معتمدة"
                    : "Approved"
                  : tab === "rejected"
                  ? isAr
                    ? "مرفوضة"
                    : "Rejected"
                  : isAr
                  ? "الكل"
                  : "All";
              const count = counts[tab];

              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                    active
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{tabLabel}</span>
                  <span
                    className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ${
                      active ? "bg-brand/15 text-brand" : "bg-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle (Table / Cards) */}
          <div className="flex items-center rounded-xl border border-input bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition ${
                viewMode === "table"
                  ? "bg-muted text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={isAr ? "عرض جدول" : "Table View"}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isAr ? "جدول" : "Table"}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition ${
                viewMode === "cards"
                  ? "bg-muted text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={isAr ? "عرض بطاقات" : "Cards View"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isAr ? "بطاقات" : "Cards"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (if items selected) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-3 px-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-foreground text-[11px]">
              {selectedIds.length}
            </span>
            <span>{isAr ? "طلبات محددة للقرار الجماعي" : "selected requests for decision"}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => bulkMutation.mutate({ ids: selectedIds, status: "approved" })}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isAr ? "موافقة على المحدد" : "Approve Selected"}</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => bulkMutation.mutate({ ids: selectedIds, status: "rejected" })}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              <span>{isAr ? "رفض المحدد" : "Reject Selected"}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelected({})}
              className="px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition"
            >
              {isAr ? "إلغاء التحديد" : "Clear"}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {isAr ? "جاري تحميل طلبات الإجازات…" : "Loading leave requests…"}
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" />
            <span>{isAr ? "حدث خطأ أثناء تحميل الطلبات" : "Error loading requests"}</span>
          </div>
          <p className="mt-1">{(error as Error).message}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredRows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-foreground">
            {search
              ? isAr
                ? "لا توجد نتائج مطابقة لبحثك"
                : "No matching requests found"
              : filter === "pending"
              ? isAr
                ? "لا توجد طلبات إجازة معلقة حالياً"
                : "No pending leave requests"
              : isAr
              ? "لا توجد طلبات إجازة في هذا القسم"
              : "No leave requests in this view"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {search
              ? isAr
                ? "جرب البحث بكلمات أخرى أو مسح نص البحث."
                : "Try adjusting your search criteria."
              : isAr
              ? "سيتم إدراج أي طلبات إجازة يقدمها أعضاء فريقك هنا للمراجعة والاعتماد."
              : "When members of your team request time off, their requests will appear here for review."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-4 text-xs font-semibold text-brand hover:underline"
            >
              {isAr ? "مسح البحث" : "Clear search filter"}
            </button>
          )}
        </div>
      )}

      {/* Table View (Default) */}
      {!isLoading && filteredRows.length > 0 && viewMode === "table" && (
        <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length === filteredRows.filter((r) => r.status === "pending").length
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded-md border-input text-brand focus:ring-brand cursor-pointer"
                      title={isAr ? "تحديد الكل" : "Select all"}
                    />
                  </th>
                  <th className="py-3 px-4 text-start">{isAr ? "الموظف" : "Employee"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "نوع الإجازة" : "Leave Type"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "الفترة والتواريخ" : "Duration & Dates"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "السبب والمرفقات" : "Reason & Proof"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                  <th className="py-3 px-4 text-end">{isAr ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRows.map((item) => {
                  const isSelected = !!selected[item.id];
                  const tone = STATUS_TONES[item.status] || STATUS_TONES.cancelled;
                  const ToneIcon = tone.icon;
                  const isProcessingThis = actionInProgress === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`group transition-colors hover:bg-muted/20 ${
                        isSelected ? "bg-brand/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        {item.status === "pending" ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))
                            }
                            className="h-4 w-4 rounded-md border-input text-brand focus:ring-brand cursor-pointer"
                          />
                        ) : (
                          <span className="inline-block w-4 h-4 text-muted-foreground/30">•</span>
                        )}
                      </td>

                      {/* Employee */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                            {item.employee_name?.charAt(0)?.toUpperCase() ?? "E"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">{item.employee_name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{item.employee_email || "—"}</p>
                            {item.department && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground mt-0.5">
                                <Building className="h-2.5 w-2.5" />
                                <span>{item.department}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-medium text-xs text-foreground">
                            {item.leave_type_name || (isAr ? "إجازة عامة" : "General Leave")}
                          </span>
                          {item.paid != null && (
                            <div className="text-[10px]">
                              {item.paid ? (
                                <span className="text-emerald-600 font-semibold">{isAr ? "مدفوعة" : "Paid"}</span>
                              ) : (
                                <span className="text-muted-foreground font-semibold">{isAr ? "غير مدفوعة" : "Unpaid"}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Duration & Dates */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-xs text-foreground">
                            {item.days ?? 1} {isAr ? "أيام" : "Days"}
                          </span>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>{formatDate(item.start_date)} → {formatDate(item.end_date)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Reason & Proof */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="space-y-1">
                          {item.reason ? (
                            <p className="text-[11px] text-foreground/80 italic truncate max-w-xs" title={item.reason}>
                              "{item.reason}"
                            </p>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                          {item.proof_url && (
                            <div>
                              <a
                                href={item.proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={item.proof_name ?? undefined}
                                className="inline-flex items-center gap-1 rounded-md border border-brand/20 bg-brand/5 px-2 py-0.5 text-[10px] font-semibold text-brand hover:bg-brand/10 transition"
                              >
                                <Paperclip className="h-2.5 w-2.5" />
                                <span className="truncate max-w-[120px]">{item.proof_name || (isAr ? "المرفق الطبي" : "Proof")}</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.bg} ${tone.text} ${tone.border}`}
                        >
                          <ToneIcon className="h-3 w-3" />
                          <span>{item.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-end">
                        {item.status === "pending" ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => decideMutation.mutate({ id: item.id, status: "approved" })}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-1.5 px-2.5 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50"
                              title={isAr ? "موافقة" : "Approve"}
                            >
                              {isProcessingThis ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              <span className="hidden sm:inline">{isAr ? "موافقة" : "Approve"}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => decideMutation.mutate({ id: item.id, status: "rejected" })}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 py-1.5 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 transition disabled:opacity-50"
                              title={isAr ? "رفض" : "Reject"}
                            >
                              {isProcessingThis ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                              <span className="hidden sm:inline">{isAr ? "رفض" : "Reject"}</span>
                            </button>
                          </div>
                        ) : item.status === "approved" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => decideMutation.mutate({ id: item.id, status: "cancelled" })}
                            className="text-[11px] font-medium text-muted-foreground hover:text-rose-600 transition"
                          >
                            {isAr ? "إلغاء الموافقة" : "Revoke"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      {!isLoading && filteredRows.length > 0 && viewMode === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((item) => {
            const isSelected = !!selected[item.id];
            const tone = STATUS_TONES[item.status] || STATUS_TONES.cancelled;
            const ToneIcon = tone.icon;
            const isProcessingThis = actionInProgress === item.id;

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col justify-between rounded-3xl border bg-card p-5 shadow-xs transition-all hover:shadow-md ${
                  isSelected ? "border-brand ring-2 ring-brand/20" : "border-border/80 hover:border-border"
                }`}
              >
                {/* Top: Employee Info & Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      {item.status === "pending" && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))
                          }
                          className="mt-1 h-4 w-4 rounded-md border-input text-brand focus:ring-brand shrink-0 cursor-pointer"
                        />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm text-foreground truncate">{item.employee_name}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{item.employee_email || "—"}</p>
                        {item.department && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Building className="h-2.5 w-2.5" />
                            <span>{item.department}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${tone.bg} ${tone.text} ${tone.border}`}
                    >
                      <ToneIcon className="h-3 w-3" />
                      <span>{item.status}</span>
                    </span>
                  </div>

                  {/* Dates & Duration Banner */}
                  <div className="mt-3.5 rounded-2xl bg-muted/40 border border-border/50 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-muted-foreground">{isAr ? "نوع الإجازة" : "Leave Type"}</span>
                      <span className="font-semibold text-foreground">
                        {item.leave_type_name || (isAr ? "إجازة عامة" : "General Leave")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
                      <span className="text-muted-foreground">{isAr ? "الفترة" : "Duration"}</span>
                      <span className="font-semibold text-foreground">
                        {item.days ?? 1} {isAr ? "أيام" : "Days"}{" "}
                        {item.paid != null && (
                          <span className={item.paid ? "text-emerald-600 font-normal" : "text-muted-foreground font-normal"}>
                            ({item.paid ? (isAr ? "مدفوعة" : "Paid") : isAr ? "غير مدفوعة" : "Unpaid"})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                      <span>{formatDate(item.start_date)}</span>
                      <span>→</span>
                      <span>{formatDate(item.end_date)}</span>
                    </div>

                    {item.reason && (
                      <div className="border-t border-border/40 pt-2 text-[11px] text-foreground/80 italic bg-background/50 rounded-xl p-2">
                        "{item.reason}"
                      </div>
                    )}
                  </div>

                  {/* Attachment Proof */}
                  {item.proof_url && (
                    <div className="mt-2.5">
                      <a
                        href={item.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={item.proof_name ?? undefined}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 transition"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span>{item.proof_name || (isAr ? "معاينة التقرير الطبي / المرفق" : "View attachment proof")}</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-border/60">
                  {item.status === "pending" ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => decideMutation.mutate({ id: item.id, status: "approved" })}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 px-3 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50"
                      >
                        {isProcessingThis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>{isAr ? "موافقة" : "Approve"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => decideMutation.mutate({ id: item.id, status: "rejected" })}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 py-2 px-3 text-xs font-semibold text-rose-700 dark:text-rose-300 transition disabled:opacity-50"
                      >
                        {isProcessingThis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        <span>{isAr ? "رفض" : "Reject"}</span>
                      </button>
                    </div>
                  ) : item.status === "approved" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {isAr ? "تم اعتماد الطلب" : "Approved"}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => decideMutation.mutate({ id: item.id, status: "cancelled" })}
                        className="text-[11px] font-medium text-muted-foreground hover:text-rose-600 transition"
                      >
                        {isAr ? "إلغاء الموافقة" : "Revoke approval"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      {item.status === "rejected"
                        ? isAr
                          ? "تم رفض هذا الطلب"
                          : "This request was rejected"
                        : isAr
                        ? "تم إلغاء الطلب"
                        : "Request was cancelled"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
