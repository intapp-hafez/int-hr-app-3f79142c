import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Mail,
  Smartphone,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  listNotificationActivity,
  type NotificationActivityRow,
} from "@/backend/functions/notification-activity.functions";

const PAGE_SIZE = 25;

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusBadgeClass(s: string) {
  if (/sent|delivered|ok/i.test(s)) return "bg-success/15 text-success border-success/30";
  if (/fail|error/i.test(s)) return "bg-destructive/15 text-destructive border-destructive/30";
  if (/skip|suppress/i.test(s)) return "bg-muted text-muted-foreground border-border";
  return "bg-warning/15 text-warning-foreground border-warning/30";
}

function ChannelIcon({ channel }: { channel: string }) {
  switch (channel.toLowerCase()) {
    case "email":
      return <Mail className="h-3.5 w-3.5 text-blue-500" />;
    case "push":
      return <Smartphone className="h-3.5 w-3.5 text-purple-500" />;
    default:
      return <Bell className="h-3.5 w-3.5 text-brand" />;
  }
}

export function NotificationAuditViewer() {
  const [days, setDays] = useState(14);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [read, setRead] = useState("all");
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fn = useServerFn(listNotificationActivity);
  const { data = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["notif-activity", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const statuses = useMemo(() => Array.from(new Set(data.map((r) => r.status))).sort(), [data]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((r: NotificationActivityRow) => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (status !== "all" && r.status !== status) return false;
      if (read === "read" && (r.channel !== "inapp" || !r.read_at)) return false;
      if (read === "unread" && (r.channel !== "inapp" || r.read_at)) return false;
      if (!s) return true;
      return [r.user_name, r.subject, r.recipient, r.category, r.error].some((v) =>
        v?.toLowerCase().includes(s)
      );
    });
  }, [data, q, channel, status, read]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // Stats
  const failed = data.filter((r) => /fail|error/i.test(r.status)).length;
  const inapp = data.filter((r) => r.channel === "inapp");
  const readCount = inapp.filter((r) => r.read_at).length;
  const readRate = inapp.length > 0 ? Math.round((readCount / inapp.length) * 100) : 0;

  function exportCsv() {
    if (!filtered.length) return;
    const headers = [
      "Sent At",
      "Recipient Name",
      "Recipient Target",
      "Subject",
      "Category",
      "Channel",
      "Status",
      "Read At",
      "Error",
    ];
    const rows = filtered.map((r) => [
      r.created_at ? new Date(r.created_at).toISOString() : "",
      r.user_name ?? "",
      r.recipient ?? "",
      r.subject ?? "",
      r.category ?? "",
      r.channel,
      r.status,
      r.read_at ? new Date(r.read_at).toISOString() : "",
      r.error ?? "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notification-audit-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const sel = "rounded-xl border border-border bg-card px-3 py-2 text-xs sm:text-sm font-medium transition focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="space-y-5">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Deliveries</span>
            <Send className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold tracking-tight tabular-nums">
            {data.length}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Last {days} days</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Failed Deliveries</span>
            <AlertCircle className={`h-4 w-4 ${failed > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
          <div className={`mt-1.5 font-display text-2xl font-bold tracking-tight tabular-nums ${failed > 0 ? "text-destructive" : ""}`}>
            {failed}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Requires attention</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>In-App Read Rate</span>
            <Eye className="h-4 w-4 text-success" />
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold tracking-tight tabular-nums text-success">
            {readRate}%
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {readCount} of {inapp.length} opened
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>In-App Unread</span>
            <EyeOff className="h-4 w-4 text-warning-foreground" />
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold tracking-tight tabular-nums">
            {inapp.length - readCount}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Pending employee view</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search person, title, category, error…"
              className="w-full rounded-full border border-border bg-card py-2 pe-3 pl-9 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <select
            value={days}
            onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
            className={sel}
          >
            {[1, 7, 14, 30, 90].map((d) => (
              <option key={d} value={d}>
                Last {d} day{d > 1 ? "s" : ""}
              </option>
            ))}
          </select>

          <select
            value={channel}
            onChange={(e) => { setChannel(e.target.value); setPage(1); }}
            className={sel}
          >
            <option value="all">All channels</option>
            <option value="inapp">In-app</option>
            <option value="email">Email</option>
            <option value="push">Push</option>
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className={sel}
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={read}
            onChange={(e) => { setRead(e.target.value); setPage(1); }}
            className={sel}
          >
            <option value="all">Read & unread</option>
            <option value="read">Read (in-app)</option>
            <option value="unread">Unread (in-app)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Toggle auto-refresh"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              autoRefresh
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Auto-refresh</span>
          </button>

          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-sm transition disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Activity Table */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Alert & Subject</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Delivery Status</th>
                <th className="px-4 py-3">Read Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-brand" />
                    Loading notification logs…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                    {(error as Error).message}
                  </td>
                </tr>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No notification deliveries match your filters.
                  </td>
                </tr>
              )}
              {paged.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/30 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-medium tabular-nums text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground/70" />
                      {fmt(r.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground text-sm">{r.user_name}</div>
                    {r.recipient && (
                      <div className="text-xs text-muted-foreground font-mono">{r.recipient}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="font-medium text-foreground text-sm">{r.subject ?? "—"}</div>
                    {r.category && (
                      <span className="mt-1 inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {r.category}
                      </span>
                    )}
                    {r.error && (
                      <div className="mt-1 flex items-start gap-1 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{r.error}</span>
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium capitalize text-foreground">
                      <ChannelIcon channel={r.channel} />
                      {r.channel === "inapp" ? "In-app" : r.channel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {/sent|delivered|ok/i.test(r.status) ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : /fail|error/i.test(r.status) ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : null}
                      {r.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {r.channel !== "inapp" ? (
                      <span className="text-muted-foreground">n/a</span>
                    ) : r.read_at ? (
                      <span className="inline-flex items-center gap-1 font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" /> Read {fmt(r.read_at)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-warning-foreground">
                        <Clock className="h-3 w-3" /> Unread
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} entries
          </span>
          <div className="inline-flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted transition"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
