import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Mail,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  RotateCw,
  Copy,
  Check,
  X,
  ExternalLink,
  Filter,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  listEmailLogs,
  resendEmailLog,
  type EmailDeliveryLogItem,
} from "@/backend/functions/email-logs.functions";

const PAGE_SIZE = 15;

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRelative(iso: string | null, isAr: boolean) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "just now";
  if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isAr ? `منذ ${days} ي` : `${days}d ago`;
}

function getCategoryBadge(category: string | null, isAr: boolean) {
  const cat = String(category || "").toLowerCase();
  if (cat.includes("expiry") || cat.includes("id_") || cat.includes("contract") || cat.includes("military")) {
    return {
      label: isAr ? "انتهاء وثائق" : "Document Expiry",
      cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    };
  }
  if (cat.includes("welcome") || cat.includes("onboarding")) {
    return {
      label: isAr ? "ترحيب بموظف" : "Welcome / Onboarding",
      cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    };
  }
  if (cat.includes("leave")) {
    return {
      label: isAr ? "إجازات" : "Leave Decision",
      cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    };
  }
  if (cat.includes("late") || cat.includes("attend") || cat.includes("checkin")) {
    return {
      label: isAr ? "حضور وتأخير" : "Attendance / Late",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    };
  }
  if (cat.includes("test")) {
    return {
      label: isAr ? "تجربة نظام" : "System Test",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  }
  return {
    label: isAr ? "إشعار نظام" : "System Alert",
    cls: "bg-muted text-muted-foreground border-border",
  };
}

export function EmailDeliveryLogCard() {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Detail Modal State
  const [activeItem, setActiveItem] = useState<EmailDeliveryLogItem | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const listFn = useServerFn(listEmailLogs);
  const resendFn = useServerFn(resendEmailLog);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-email-logs", days],
    queryFn: () => listFn({ data: { days } }),
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const logs = data?.logs ?? [];
  const stats = data?.stats ?? { total: 0, sent: 0, failed: 0, skipped: 0 };

  // Categories list for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.category) set.add(l.category);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((item) => {
      // Status filter
      if (statusFilter !== "all") {
        const s = String(item.status || "").toLowerCase();
        if (statusFilter === "sent" && !/sent|delivered|ok/i.test(s)) return false;
        if (statusFilter === "failed" && !/fail|error/i.test(s)) return false;
        if (statusFilter === "skipped" && !/skip|suppress/i.test(s)) return false;
      }
      // Category filter
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      // Query filter
      if (!q) return true;
      return (
        item.recipient?.toLowerCase().includes(q) ||
        item.user_name?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.error?.toLowerCase().includes(q)
      );
    });
  }, [logs, search, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedLogs = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
    toast.success(isAr ? "تم نسخ البريد الإلكتروني" : "Copied to clipboard");
  };

  const handleResend = async (item: EmailDeliveryLogItem) => {
    setResendingId(item.id);
    try {
      const res = await resendFn({ data: { deliveryId: item.id } });
      if (res.ok) {
        toast.success(isAr ? "تمت إعادة إرسال البريد بنجاح" : "Email resent successfully");
        refetch();
      } else {
        toast.error(res.error || (isAr ? "فشل إعادة الإرسال" : "Failed to resend email"));
      }
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "حدث خطأ أثناء الإرسال" : "Error while resending email"));
    } finally {
      setResendingId(null);
    }
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ["Sent At", "Recipient", "Employee Name", "Subject", "Category", "Status", "Error"];
    const rows = filtered.map((l) => [
      l.created_at,
      l.recipient ?? "",
      l.user_name ?? "",
      `"${(l.subject ?? "").replace(/"/g, '""')}"`,
      l.category ?? "",
      l.status,
      `"${(l.error ?? "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sent-emails-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                {isAr ? "سجل رسائل البريد المرسلة" : "Sent Emails Delivery Log"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "متابعة جميع رسائل البريد وحالة تسليمها عبر خادم SMTP وأسباب الأخطاء"
                  : "Track outgoing notifications, delivery statuses, and SMTP transmission results"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              autoRefresh
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
            title={isAr ? "تحديث تلقائي كل 30 ثانية" : "Auto refresh every 30s"}
          >
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            {isAr ? "مباشر" : "Live"}
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {isAr ? "تحديث" : "Refresh"}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {isAr ? "تصدير CSV" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`flex items-center gap-3 rounded-xl border p-3 text-start transition ${
            statusFilter === "all"
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background/50 hover:bg-muted/40"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-foreground">{stats.total}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "إجمالي الرسائل" : "Total Emails"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("sent")}
          className={`flex items-center gap-3 rounded-xl border p-3 text-start transition ${
            statusFilter === "sent"
              ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
              : "border-border bg-background/50 hover:bg-muted/40"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.sent}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "تم التسليم بنجاح" : "Delivered / Sent"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("failed")}
          className={`flex items-center gap-3 rounded-xl border p-3 text-start transition ${
            statusFilter === "failed"
              ? "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500"
              : "border-border bg-background/50 hover:bg-muted/40"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{stats.failed}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "فشل الإرسال" : "Failed / Errors"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("skipped")}
          className={`flex items-center gap-3 rounded-xl border p-3 text-start transition ${
            statusFilter === "skipped"
              ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500"
              : "border-border bg-background/50 hover:bg-muted/40"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-foreground">{stats.skipped}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "تجاوز / معلق" : "Skipped / Suppressed"}
            </div>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground rtl:left-auto rtl:right-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={isAr ? "بحث بالبريد، المستلم، أو الموضوع..." : "Search by email, recipient, or subject..."}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs pl-8 rtl:pl-3 rtl:pr-8 outline-none focus:border-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rtl:right-auto rtl:left-2.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-ring"
        >
          <option value="all">{isAr ? "كل الحالات" : "All Statuses"}</option>
          <option value="sent">{isAr ? "تم التسليم (Sent)" : "Delivered (Sent)"}</option>
          <option value="failed">{isAr ? "فشل (Failed)" : "Failed"}</option>
          <option value="skipped">{isAr ? "تجاوز (Skipped)" : "Skipped"}</option>
        </select>

        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-ring"
          >
            <option value="all">{isAr ? "كل التصنيفات" : "All Categories"}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <select
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-ring"
        >
          <option value={7}>{isAr ? "آخر 7 أيام" : "Last 7 Days"}</option>
          <option value={14}>{isAr ? "آخر 14 يوماً" : "Last 14 Days"}</option>
          <option value={30}>{isAr ? "آخر 30 يوماً" : "Last 30 Days"}</option>
          <option value={90}>{isAr ? "آخر 90 يوماً" : "Last 90 Days"}</option>
        </select>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3.5 py-2.5 text-start font-semibold">{isAr ? "التاريخ والوقت" : "Date & Time"}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{isAr ? "المستلم" : "Recipient"}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{isAr ? "الموضوع والتصنيف" : "Subject & Category"}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{isAr ? "الحالة" : "Status"}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{isAr ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>{isAr ? "جاري تحميل سجل الرسائل..." : "Loading email logs..."}</span>
                  </td>
                </tr>
              ) : pagedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="font-medium text-foreground">
                      {isAr ? "لا توجد رسائل بريد مطابقة" : "No email logs found"}
                    </p>
                    <p className="text-[11px] mt-1">
                      {isAr
                        ? "لم يتم العثور على أي رسائل مرسلة تطابق الفلاتر المحددة"
                        : "No outgoing email events recorded in the selected period"}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedLogs.map((item) => {
                  const s = String(item.status || "").toLowerCase();
                  const isSent = /sent|delivered|ok/i.test(s);
                  const isFailed = /fail|error/i.test(s);
                  const catInfo = getCategoryBadge(item.category, isAr);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition-colors group cursor-pointer"
                      onClick={() => setActiveItem(item)}
                    >
                      {/* Timestamp */}
                      <td className="px-3.5 py-3 align-top whitespace-nowrap">
                        <div className="font-medium text-foreground">{formatRelative(item.created_at, isAr)}</div>
                        <div className="text-[10px] text-muted-foreground" title={item.created_at}>
                          {formatDate(item.created_at)}
                        </div>
                      </td>

                      {/* Recipient */}
                      <td className="px-3.5 py-3 align-top">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="truncate max-w-[200px]" title={item.recipient ?? ""}>
                            {item.recipient || "—"}
                          </span>
                          {item.recipient && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.recipient!);
                              }}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                              title={isAr ? "نسخ البريد" : "Copy email"}
                            >
                              {copiedEmail === item.recipient ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {item.user_name && item.user_name !== "—" && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {item.user_name}
                          </div>
                        )}
                      </td>

                      {/* Subject & Category */}
                      <td className="px-3.5 py-3 align-top">
                        <div className="font-medium text-foreground line-clamp-1" title={item.subject ?? ""}>
                          {item.subject}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium ${catInfo.cls}`}>
                            {catInfo.label}
                          </span>
                          {item.category && item.category !== "general" && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({item.category})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3 align-top whitespace-nowrap">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {isAr ? "تم الإرسال" : "Sent"}
                          </span>
                        ) : isFailed ? (
                          <div className="space-y-0.5">
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                              title={item.error ?? "Failed"}
                            >
                              <AlertCircle className="h-3 w-3" />
                              {isAr ? "فشل الإرسال" : "Failed"}
                            </span>
                            {item.error && (
                              <div
                                className="text-[10px] text-rose-500 max-w-[150px] truncate"
                                title={item.error}
                              >
                                {item.error}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {item.status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 align-top text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setActiveItem(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition"
                            title={isAr ? "عرض التفاصيل" : "View details"}
                          >
                            <Eye className="h-3 w-3" />
                            <span className="hidden sm:inline">{isAr ? "معاينة" : "Details"}</span>
                          </button>

                          {(isFailed || item.status === "skipped_smtp") && (
                            <button
                              type="button"
                              onClick={() => handleResend(item)}
                              disabled={resendingId === item.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition disabled:opacity-50"
                              title={isAr ? "إعادة الإرسال" : "Resend email"}
                            >
                              <RotateCw className={`h-3 w-3 ${resendingId === item.id ? "animate-spin" : ""}`} />
                              <span className="hidden sm:inline">{isAr ? "إعادة" : "Resend"}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <div>
              {isAr
                ? `عرض ${pageStart + 1} - ${Math.min(pageStart + PAGE_SIZE, filtered.length)} من أصل ${filtered.length} رسالة`
                : `Showing ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} emails`}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition disabled:opacity-40"
              >
                {isAr ? "السابق" : "Previous"}
              </button>
              <span className="px-2 font-medium text-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition disabled:opacity-40"
              >
                {isAr ? "التالي" : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over / Modal for Email Details */}
      {activeItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    {isAr ? "تفاصيل رسالة البريد" : "Email Delivery Details"}
                  </h3>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDate(activeItem.created_at)} ({formatRelative(activeItem.created_at, isAr)})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              {/* Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-background/50 rounded-xl border border-border p-3.5">
                <div>
                  <div className="text-muted-foreground text-[11px]">{isAr ? "المستلم (To):" : "Recipient (To):"}</div>
                  <div className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                    <span>{activeItem.recipient || "—"}</span>
                    {activeItem.recipient && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activeItem.recipient!)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {activeItem.user_name && activeItem.user_name !== "—" && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{activeItem.user_name}</div>
                  )}
                </div>

                <div>
                  <div className="text-muted-foreground text-[11px]">{isAr ? "حالة الإرسال:" : "Delivery Status:"}</div>
                  <div className="mt-0.5">
                    {/sent|delivered|ok/i.test(activeItem.status) ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {isAr ? "تم التسليم بنجاح (250 OK)" : "Delivered (250 OK)"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        <AlertCircle className="h-3 w-3" />
                        {activeItem.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="text-muted-foreground text-[11px]">{isAr ? "موضوع الرسالة:" : "Subject:"}</div>
                  <div className="font-semibold text-foreground mt-0.5">{activeItem.subject}</div>
                </div>

                {activeItem.error && (
                  <div className="sm:col-span-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-rose-600 dark:text-rose-400">
                    <div className="font-semibold text-[11px] flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {isAr ? "سبب الخطأ:" : "Error Details:"}
                    </div>
                    <div className="font-mono text-[11px] mt-1 break-words">{activeItem.error}</div>
                  </div>
                )}
              </div>

              {/* Email Content Preview */}
              <div>
                <div className="text-xs font-semibold text-foreground mb-1.5">
                  {isAr ? "محتوى الرسالة المعروضة:" : "Rendered Email Content:"}
                </div>

                {activeItem.html ? (
                  <div
                    className="rounded-xl border border-border bg-white text-slate-900 p-4 max-h-[300px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: activeItem.html }}
                  />
                ) : activeItem.body ? (
                  <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs font-mono whitespace-pre-wrap text-foreground max-h-[300px] overflow-y-auto">
                    {activeItem.body}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    {isAr ? "لا يتوفر نص معاينة لهذه الرسالة" : "No preview body available for this email event"}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-muted/30">
              <span className="text-[11px] font-mono text-muted-foreground">
                ID: {activeItem.id}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResend(activeItem)}
                  disabled={resendingId === activeItem.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${resendingId === activeItem.id ? "animate-spin" : ""}`} />
                  {isAr ? "إعادة إرسال البريد الآن" : "Resend Email Now"}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="rounded-xl border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
