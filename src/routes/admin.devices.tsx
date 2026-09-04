import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Ban, ShieldX, Search, Smartphone, ScrollText, RotateCcw, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/date-format";
import {
  listAllDevices,
  decideDevice,
  listDeviceLogs,
  type AdminDeviceRow,
} from "@/backend/functions/devices.functions";

export const Route = createFileRoute("/admin/devices")({
  component: DevicesPage,
  head: () => ({
    meta: [
      { title: "Device Approvals · INT HR" },
      { name: "description", content: "Review, approve, reject or block the devices employees use to record attendance." },
      { property: "og:title", content: "Device Approvals · INT HR" },
      { property: "og:description", content: "Review, approve, reject or block employee attendance devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUSES = ["pending", "approved", "rejected", "blocked", "revoked", "all"] as const;

function statusClass(status: string) {
  return status === "approved"
    ? "bg-success/15 text-success"
    : status === "pending"
      ? "bg-warning/20 text-warning-foreground"
      : "bg-destructive/15 text-destructive";
}

function when(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return `${formatDate(v)} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function DevicesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [logDevice, setLogDevice] = useState<string | null>(null);

  const listFn = useServerFn(listAllDevices);
  const decideFn = useServerFn(decideDevice);
  const logsFn = useServerFn(listDeviceLogs);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["admin", "devices", status, search],
    queryFn: () => listFn({ data: { status, search } }),
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["admin", "device-logs", logDevice ?? "all"],
    queryFn: () => logsFn({ data: logDevice ? { device_id: logDevice } : {} }),
  });

  const decide = useMutation({
    mutationFn: (v: { device_id: string; action: string }) => decideFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(`Device ${v.action}${v.action.endsWith("e") ? "d" : "ed"}`);
      qc.invalidateQueries({ queryKey: ["admin", "devices"] });
      qc.invalidateQueries({ queryKey: ["admin", "device-logs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Device Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Only approved devices can record check-in and check-out.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, device, IP…"
            className="h-9 w-64 rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              status === s ? "bg-gradient-brand text-brand-foreground shadow-brand" : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        {isLoading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
          </p>
        ) : devices.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No devices in this state.</p>
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Device ID</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">First seen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(devices as AdminDeviceRow[]).map((d) => (
                <tr key={d.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{d.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{d.employee_email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="inline-flex items-center gap-1.5 font-medium">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      {d.device_type ?? "Device"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[d.browser, d.os].filter(Boolean).join(" · ") || d.label}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]">{d.id}</td>
                  <td className="px-4 py-3 text-xs">{d.ip_address ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{when(d.first_seen_at ?? d.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusClass(d.status)}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {d.status !== "approved" && (
                        <button
                          onClick={() => decide.mutate({ device_id: d.id, action: d.status === "blocked" ? "unblock" : "approve" })}
                          className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-semibold text-success"
                        >
                          <Check className="h-3.5 w-3.5" /> {d.status === "blocked" ? "Unblock" : "Approve"}
                        </button>
                      )}
                      {d.status !== "rejected" && (
                        <button
                          onClick={() => decide.mutate({ device_id: d.id, action: "reject" })}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <ShieldX className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                      {d.status !== "blocked" && (
                        <button
                          onClick={() => decide.mutate({ device_id: d.id, action: "block" })}
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive"
                        >
                          <Ban className="h-3.5 w-3.5" /> Block
                        </button>
                      )}
                      {d.status === "approved" && (
                        <button
                          onClick={() => decide.mutate({ device_id: d.id, action: "revoke" })}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Revoke
                        </button>
                      )}
                      <button
                        onClick={() => setLogDevice(logDevice === d.id ? null : d.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <ScrollText className="h-3.5 w-3.5" /> History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4" /> Audit log {logDevice ? `· ${logDevice}` : "· all devices"}
          </h2>
          {logDevice && (
            <button onClick={() => setLogDevice(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              Show all
            </button>
          )}
        </div>
        {logsLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading log…</p>
        ) : logs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No device activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
                <span className="w-40 text-muted-foreground">{when(l.created_at)}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold uppercase">{l.action}</span>
                <span className="font-mono text-[11px]">{l.device_id}</span>
                <span className="text-muted-foreground">
                  {l.from_status ?? "—"} → {l.to_status ?? "—"}
                </span>
                {l.ip_address && <span className="text-muted-foreground">IP {l.ip_address}</span>}
                {l.reason && <span className="text-muted-foreground">· {l.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
