import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ScanFace,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  ShieldAlert,
  Smartphone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  UserCheck,
} from "lucide-react";
import {
  getBiometricAuditLogs,
  type BiometricAuditRow,
} from "@/backend/functions/biometrics-health.functions";
import { useI18n } from "@/lib/i18n";
import { DateRangeField } from "@/components/ui/date-input";

type RangeKey = "all" | "today" | "week" | "month" | "custom";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function BiometricAuditViewer() {
  const { t, isAr } = useI18n();
  const fetchLogs = useServerFn(getBiometricAuditLogs);

  const [page, setPage] = useState(1);
  const [method, setMethod] = useState<"all" | "face" | "fingerprint">("all");
  const [eventFilter, setEventFilter] = useState<
    "all" | "enroll" | "unenroll" | "verify" | "login" | "check_in" | "check_out"
  >("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Compute date filter bounds
  const { fromIso, toIso } = useMemo(() => {
    const now = new Date();
    if (range === "today") {
      return { fromIso: startOfDay(now).toISOString(), toIso: endOfDay(now).toISOString() };
    }
    if (range === "week") {
      return { fromIso: startOfWeek(now).toISOString(), toIso: endOfDay(now).toISOString() };
    }
    if (range === "month") {
      return { fromIso: startOfMonth(now).toISOString(), toIso: endOfDay(now).toISOString() };
    }
    if (range === "custom") {
      return {
        fromIso: fromDate ? startOfDay(new Date(fromDate)).toISOString() : undefined,
        toIso: toDate ? endOfDay(new Date(toDate)).toISOString() : undefined,
      };
    }
    return { fromIso: undefined, toIso: undefined };
  }, [range, fromDate, toDate]);

  const {
    data: result,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "biometric-audit-logs",
      page,
      method,
      eventFilter,
      statusFilter,
      searchQuery,
      fromIso,
      toIso,
    ],
    queryFn: () =>
      fetchLogs({
        data: {
          page,
          pageSize: 25,
          method,
          event: eventFilter,
          status: statusFilter,
          query: searchQuery.trim() || undefined,
          fromDate: fromIso,
          toDate: toIso,
        },
      }),
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 1;
  const stats = result?.stats ?? {
    total: 0,
    success: 0,
    failed: 0,
    faceCount: 0,
    fingerprintCount: 0,
    successRate: 0,
  };

  function exportCsv() {
    if (!items.length) return;
    const headers = [
      "Timestamp",
      "Employee",
      "Email",
      "Method",
      "Event",
      "Status",
      "Distance",
      "Device Label",
      "Device ID",
      "IP Address",
      "Reason",
    ];
    const rows = items.map((r) => [
      new Date(r.createdAt).toISOString(),
      r.employeeName,
      r.employeeEmail,
      r.method,
      r.event,
      r.success ? "SUCCESS" : "FAILED",
      r.distance != null ? r.distance : "",
      r.deviceLabel || "",
      r.deviceId || "",
      r.ipAddress || "",
      r.reason || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `biometric-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const rangeOptions: { key: RangeKey; label: string }[] = [
    { key: "all", label: t("rangeAllTime") },
    { key: "today", label: t("rangeToday") },
    { key: "week", label: t("rangeWeek") },
    { key: "month", label: t("rangeMonth") },
    { key: "custom", label: t("rangeCustom") },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{t("totalEvents")}</span>
            <Activity className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
            {stats.total.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("recordedBiometricActions")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{t("successRate")}</span>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-success">
            {stats.successRate}%
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {stats.success} {t("successStatus").toLowerCase()} / {stats.failed} {t("failedStatus").toLowerCase()}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{t("faceRecognition")}</span>
            <ScanFace className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
            {stats.faceCount.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("thresholdNote")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">{t("fingerprintWebauthn")}</span>
            <Fingerprint className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
            {stats.fingerprintCount.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("platformAuthenticators")}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t("searchBiometricsPlaceholder")}
              className="w-full rounded-xl border border-border bg-background py-2 pe-3 ps-9 text-xs outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition"
              title={t("refreshNow")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-brand" : ""}`} />
              <span>{t("refreshNow")}</span>
            </button>

            <button
              onClick={exportCsv}
              disabled={!items.length}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand text-brand-foreground px-3.5 py-2 text-xs font-semibold shadow-brand hover:opacity-95 transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t("exportCsv")}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-xs">
          {/* Method Filter */}
          <div className="flex items-center gap-1">
            <span className="font-medium text-muted-foreground me-1">{isAr ? "الوسيلة:" : "Method:"}</span>
            {(["all", "face", "fingerprint"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  method === m
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "all" ? t("all") : m === "face" ? t("faceRecognition") : t("fingerprint")}
              </button>
            ))}
          </div>

          {/* Event Filter */}
          <div className="flex items-center gap-1">
            <span className="font-medium text-muted-foreground me-1">{isAr ? "العملية:" : "Event:"}</span>
            {(
              [
                { key: "all", label: t("all") },
                { key: "check_in", label: t("checkInEvent") },
                { key: "check_out", label: t("checkOutEvent") },
                { key: "login", label: t("loginEvent") },
                { key: "verify", label: t("verifyEvent") },
                { key: "enroll", label: t("enrollEvent") },
              ] as const
            ).map((e) => (
              <button
                key={e.key}
                onClick={() => {
                  setEventFilter(e.key as any);
                  setPage(1);
                }}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                  eventFilter === e.key
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="font-medium text-muted-foreground me-1">{t("status")}:</span>
            {(["all", "success", "failed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                  statusFilter === s
                    ? s === "success"
                      ? "bg-success text-success-foreground"
                      : s === "failed"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? t("all") : s === "success" ? t("successStatus") : t("failedStatus")}
              </button>
            ))}
          </div>

          {/* Date Range Dropdown */}
          <div className="flex items-center gap-1.5 ms-auto">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={range}
              onChange={(e) => {
                setRange(e.target.value as RangeKey);
                setPage(1);
              }}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground outline-none"
            >
              {rangeOptions.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {range === "custom" && (
          <div className="pt-2 border-t border-border flex items-center gap-3">
            <DateRangeField
              from={fromDate}
              to={toDate}
              onFromChange={(v: string) => {
                setFromDate(v);
                setPage(1);
              }}
              onToChange={(v: string) => {
                setToDate(v);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Biometric Events Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t("date")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("employee")}</th>
                <th className="px-4 py-3 text-start font-semibold">{isAr ? "الوسيلة والعملية" : "Method & Event"}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("status")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("matchDistance")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("deviceAndIp")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("detailsAndReason")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand mb-2" />
                    {isAr ? "جاري تحميل سجلات التدقيق البيومترية..." : "Loading biometric audit records..."}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="font-semibold text-foreground">{t("noBiometricLogsFound")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("noBiometricLogsDesc")}</p>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isFace = row.method === "face";
                  const date = new Date(row.createdAt);
                  const isDistOk =
                    row.distance != null ? row.distance <= 0.5 : row.success;

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="whitespace-nowrap px-4 py-3 text-foreground font-mono">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[11px]">
                            {date.toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {date.toLocaleDateString("en-GB", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand text-xs font-bold">
                            {row.employeeName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate max-w-[140px]">
                              {row.employeeName}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                              {row.employeeEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Method & Event */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              isFace
                                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            }`}
                          >
                            {isFace ? (
                              <ScanFace className="h-3 w-3" />
                            ) : (
                              <Fingerprint className="h-3 w-3" />
                            )}
                            <span className="capitalize">{row.method}</span>
                          </span>

                          <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground uppercase tracking-wider">
                            {row.event.replace("_", " ")}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {row.success ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Distance / Metric */}
                      <td className="px-4 py-3">
                        {row.distance != null ? (
                          <div className="flex flex-col">
                            <span
                              className={`font-mono font-semibold ${
                                isDistOk ? "text-success" : "text-destructive"
                              }`}
                            >
                              d = {row.distance.toFixed(3)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              threshold: 0.500
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>

                      {/* Device & Info */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col max-w-[160px] text-[11px]">
                          {row.deviceLabel ? (
                            <span
                              className="font-medium text-foreground truncate"
                              title={row.deviceLabel}
                            >
                              {row.deviceLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Standard Device</span>
                          )}
                          {row.ipAddress && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                              IP: {row.ipAddress}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Reason / Details */}
                      <td className="px-4 py-3">
                        {row.reason ? (
                          <div className="rounded-lg bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive max-w-[260px] leading-tight">
                            {row.reason}
                          </div>
                        ) : row.success ? (
                          <span className="text-muted-foreground text-[11px]">Verified</span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            {isAr ? (
              <>
                عرض الصفحة <strong className="text-foreground font-mono">{page}</strong> من{" "}
                <strong className="text-foreground font-mono">{totalPages}</strong> ({result?.total ?? 0} إجمالي)
              </>
            ) : (
              <>
                Showing page <strong className="text-foreground">{page}</strong> of{" "}
                <strong className="text-foreground">{totalPages}</strong> ({result?.total ?? 0} total)
              </>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 font-medium hover:bg-muted disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              <span>{t("pagePrev")}</span>
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 font-medium hover:bg-muted disabled:opacity-40 transition"
            >
              <span>{t("pageNext")}</span>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
