import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, ShieldAlert, MapPin, Wifi, Filter, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuditEvents } from "@/backend/functions/audit.functions";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

type ResultFilter = "all" | "success" | "blocked";
type RangeKey = "all" | "today" | "week" | "month" | "custom";

const PAGE_SIZE = 25;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x; }

function AuditPage() {
  const { t } = useI18n();
  const fetchAudit = useServerFn(getAuditEvents);
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["audit-events"],
    queryFn: () => fetchAudit(),
    refetchInterval: 30000,
  });
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const { fromTs, toTs } = useMemo(() => {
    const now = new Date();
    if (range === "today") return { fromTs: startOfDay(now).getTime(), toTs: endOfDay(now).getTime() };
    if (range === "week")  return { fromTs: startOfWeek(now).getTime(), toTs: endOfDay(now).getTime() };
    if (range === "month") return { fromTs: startOfMonth(now).getTime(), toTs: endOfDay(now).getTime() };
    if (range === "custom") {
      return {
        fromTs: fromDate ? startOfDay(new Date(fromDate)).getTime() : -Infinity,
        toTs: toDate ? endOfDay(new Date(toDate)).getTime() : Infinity,
      };
    }
    return { fromTs: -Infinity, toTs: Infinity };
  }, [range, fromDate, toDate]);

  const filtered = useMemo(() => events.filter((e) => {
    if (filter !== "all" && e.result !== filter) return false;
    if (e.ts < fromTs || e.ts > toTs) return false;
    if (query) {
      const q = query.toLowerCase();
      if (![e.employeeName, e.branch ?? "", e.ssid ?? "", e.reason ?? ""].some((s) => s.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [events, filter, fromTs, toTs, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function exportCsv() {
    const rows = [
      ["Timestamp", "Employee", "Action", "Result", "Branch", "GPS", "Network", "SSID", "Distance (m)", "Reason", "Device"],
      ...filtered.map((e) => [
        new Date(e.ts).toISOString(), e.employeeName, e.action, e.result,
        e.branch ?? "", e.gps, e.network, e.ssid ?? "", e.distanceM ?? "", e.reason ?? "", e.device ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `int-app-audit-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const counts = {
    all: events.length,
    success: events.filter((e) => e.result === "success").length,
    blocked: events.filter((e) => e.result === "blocked").length,
  };

  const rangeOptions: { key: RangeKey; label: string }[] = [
    { key: "all", label: "All time" },
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "custom", label: "Date range" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("audit")}</h1>
          <p className="text-sm text-muted-foreground">Every check-in/out attempt with GPS, network, and failure reasons</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-medium">
          {(["all", "success", "blocked"] as ResultFilter[]).map((k) => (
            <button
              key={k}
              onClick={() => { setFilter(k); setPage(1); }}
              className={`rounded-full px-3 py-1.5 capitalize transition-colors ${filter === k ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"}`}
            >
              {k} <span className="opacity-70">({counts[k]})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Filter className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={t("auditFilter")}
            className="w-full rounded-full border border-border bg-card py-2 pe-3 ps-9 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs font-medium">
          {rangeOptions.map((r) => (
            <button
              key={r.key}
              onClick={() => { setRange(r.key); setPage(1); }}
              className={`rounded-full px-3 py-1.5 transition-colors ${range === r.key ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="rounded-full border border-border bg-card px-3 py-1.5"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="rounded-full border border-border bg-card px-3 py-1.5"
            />
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading audit events…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No audit events match your filters.</p>
        ) : (
          <ul className="divide-y divide-border">
            {paged.map((e) => (
              <li key={e.id} className="grid gap-2 px-5 py-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${e.result === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {e.result === "success" ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {e.employeeName} <span className="font-normal text-muted-foreground">— {e.action} {e.result === "blocked" ? "blocked" : "succeeded"}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{e.reason}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <Chip ok={e.gps === "ok"} icon={MapPin}>
                      GPS {e.gps}{e.distanceM != null ? ` • ${e.distanceM} m` : ""}
                    </Chip>
                    <Chip ok={e.network === "ok"} icon={Wifi}>
                      {e.ssid ?? "Network"} {e.network}
                    </Chip>
                    {e.branch && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{e.branch}</span>}
                    {e.device && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{e.device}</span>}
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground md:text-end">
                  {new Date(e.ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="inline-flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-border bg-card px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-full border border-border bg-card px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ ok, icon: Icon, children }: { ok: boolean; icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
      <Icon className="h-2.5 w-2.5" /> {children}
    </span>
  );
}
