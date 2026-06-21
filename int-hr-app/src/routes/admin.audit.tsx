import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, ShieldAlert, MapPin, Wifi, Filter, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useStore, type AuditEvent } from "@/lib/store";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

type ResultFilter = "all" | "success" | "blocked";

const seedEvents: AuditEvent[] = [
  { id: "seed-1", ts: Date.now() - 1000 * 60 * 18, employeeId: "INT-003", employeeName: "Layla Hassan", action: "check-in", result: "success", branch: "Cairo HQ", gps: "ok", network: "ok", ssid: "INT-Cairo-Secure", distanceM: 42, reason: "Checked in at 08:42", device: "iOS • INT-HR App" },
  { id: "seed-2", ts: Date.now() - 1000 * 60 * 55, employeeId: "INT-002", employeeName: "Omar Khalid", action: "check-in", result: "blocked", branch: "Alexandria Office", gps: "fail", network: "ok", ssid: "INT-Alexandria", distanceM: 1840, reason: "You're 1,840 m from Alexandria Office (allowed: 80 m).", device: "Android • INT-HR App" },
  { id: "seed-3", ts: Date.now() - 1000 * 60 * 60 * 2, employeeId: "INT-004", employeeName: "Yousef Saleh", action: "check-in", result: "blocked", branch: "Giza Branch", gps: "ok", network: "fail", ssid: "Public-WiFi", distanceM: 18, reason: "Unauthorized network", device: "Android • INT-HR App" },
  { id: "seed-4", ts: Date.now() - 1000 * 60 * 60 * 4, employeeId: "INT-001", employeeName: "Hafez Rahim", action: "check-out", result: "success", branch: "Cairo HQ", gps: "ok", network: "ok", ssid: "INT-Cairo-Secure", distanceM: 28, reason: "Checked out at 17:32", device: "Web • Chrome" },
  { id: "seed-5", ts: Date.now() - 1000 * 60 * 60 * 5, employeeId: "INT-007", employeeName: "Sara Al-Qahtani", action: "check-in", result: "blocked", branch: "Alexandria Office", gps: "fail", network: "fail", ssid: "Unknown-WiFi", reason: "Location permission denied.", device: "iOS • Safari" },
];

function AuditPage() {
  const { t } = useI18n();
  const live = useStore((s) => s.auditLog);
  const events = useMemo(() => [...live, ...seedEvents], [live]);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = events.filter((e) => {
    if (filter !== "all" && e.result !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (![e.employeeName, e.branch ?? "", e.ssid ?? "", e.reason ?? ""].some((s) => s.toLowerCase().includes(q))) return false;
    }
    return true;
  });

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
              onClick={() => setFilter(k)}
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("auditFilter")}
            className="w-full rounded-full border border-border bg-card py-2 pe-3 ps-9 text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No audit events match your filters.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
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
