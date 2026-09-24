import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, ScanFace, Search, RotateCw, Info, X } from "lucide-react";
import { listFaceEnrollmentHistory, retryFaceEnrollmentDelivery } from "@/backend/functions/face-enrollment-notices.functions";

export const Route = createFileRoute("/admin/face-notifications")({
  head: () => ({
    meta: [
      { title: "Face enrollment notification history · HR" },
      { name: "description", content: "Face enrollment alerts sent to employees with channel, delivery status and trigger state." },
      { property: "og:title", content: "Face enrollment notification history" },
      { property: "og:description", content: "Audit every face enrollment alert and its delivery status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FaceNotificationsPage,
});

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATE_CLS: Record<string, string> = {
  missing: "bg-destructive/10 text-destructive",
  invalid: "bg-warning/15 text-warning-foreground",
  ready: "bg-success/15 text-success",
};
const STATUS_CLS: Record<string, string> = {
  sent: "bg-success/15 text-success",
  failed: "bg-destructive/10 text-destructive",
};

function FaceNotificationsPage() {
  const fn = useServerFn(listFaceEnrollmentHistory);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["face-notif-history"], queryFn: () => fn() });
  const retryFn = useServerFn(retryFaceEnrollmentDelivery);
  const qc = useQueryClient();
  const [detailRoot, setDetailRoot] = useState<string | null>(null);
  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: (r) => {
      if (r.status === "sent") toast.success("Delivered on retry");
      else toast.error(`Retry ${r.status}: ${r.error ?? "unknown error"}`);
      qc.invalidateQueries({ queryKey: ["face-notif-history"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const rootOf = (r: { id: string; retryOf: string | null }) => r.retryOf ?? r.id;
  const chains = useMemo(() => {
    const m = new Map<string, typeof data>();
    for (const r of data) {
      const k = rootOf(r);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    for (const v of m.values()) v.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return m;
  }, [data]);
  const latestIds = useMemo(() => new Set([...chains.values()].map((v) => v[v.length - 1]!.id)), [chains]);
  const [q, setQ] = useState("");
  const [state, setState] = useState("all");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((r) =>
      latestIds.has(r.id) &&
      (state === "all" || r.state === state) &&
      (channel === "all" || r.channel === channel) &&
      (status === "all" || r.status === status) &&
      (!s || `${r.employee} ${r.empCode ?? ""} ${r.recipient ?? ""} ${r.error ?? ""}`.toLowerCase().includes(s)),
    );
  }, [data, latestIds, q, state, channel, status]);

  const statuses = [...new Set(data.map((r) => r.status))];
  const sel = "rounded-xl border border-border bg-card px-3 py-2 text-xs";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div>
        <Link to="/admin/audit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Audit
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <ScanFace className="h-5 w-5 text-brand" /> Face enrollment notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Every face enrollment alert sent to employees, per channel, with its delivery result.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee, code, email, reason…" className="w-full rounded-xl border border-border bg-card py-2 pl-8 pr-3 text-xs" />
        </div>
        <select className={sel} value={state} onChange={(e) => setState(e.target.value)}>
          <option value="all">All states</option><option value="missing">Missing</option><option value="invalid">Invalid</option><option value="ready">Ready</option>
        </select>
        <select className={sel} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="all">All channels</option><option value="inapp">In-app</option><option value="email">Email</option><option value="push">Push</option>
        </select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Time</th>
              <th className="px-4 py-3 text-start">Employee</th>
              <th className="px-4 py-3 text-start">Trigger state</th>
              <th className="px-4 py-3 text-start">Channel</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-start">Details</th>
              <th className="px-4 py-3 text-start">Attempts</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {error && <tr><td colSpan={8} className="px-4 py-8 text-center text-destructive">{(error as Error).message}</td></tr>}
            {!isLoading && !error && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No notifications found.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/10">
                <td className="px-4 py-2.5 whitespace-nowrap font-mono">{fmt(r.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{r.employee}</p>
                  {r.empCode && <p className="text-[10px] text-muted-foreground font-mono">{r.empCode}</p>}
                </td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 font-medium capitalize ${STATE_CLS[r.state] ?? "bg-muted"}`}>{r.state}</span></td>
                <td className="px-4 py-2.5 capitalize">{r.channel === "inapp" ? "In-app" : r.channel}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_CLS[r.status] ?? "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-[260px] truncate" title={r.error ?? ""}>{r.error ?? r.recipient ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono">{chains.get(rootOf(r))?.length ?? 1}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setDetailRoot(rootOf(r))} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-muted"><Info className="h-3 w-3" /> Details</button>
                    {(r.channel === "email" || r.channel === "push") && r.status !== "sent" && r.status !== "suppressed" && (
                      <button disabled={retry.isPending} onClick={() => retry.mutate(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50">
                        <RotateCw className={`h-3 w-3 ${retry.isPending && retry.variables === r.id ? "animate-spin" : ""}`} /> Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailRoot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Delivery attempts</h2>
                <p className="text-xs text-muted-foreground">{chains.get(detailRoot)?.[0]?.employee} · {chains.get(detailRoot)?.[0]?.title}</p>
              </div>
              <button onClick={() => setDetailRoot(null)} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <ol className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
              {(chains.get(detailRoot) ?? []).map((a, i) => (
                <li key={a.id} className="rounded-xl border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Attempt {i + 1}</span>
                    <span className="font-mono text-muted-foreground">{fmt(a.createdAt)}</span>
                    <span className="capitalize">{a.channel === "inapp" ? "In-app" : a.channel}</span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_CLS[a.status] ?? "bg-muted text-muted-foreground"}`}>{a.status}</span>
                    {a.retriedByName && <span className="text-muted-foreground">retried by {a.retriedByName}</span>}
                  </div>
                  <p className="mt-2"><span className="text-muted-foreground">Recipient: </span>{a.recipient ?? "—"}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words"><span className="text-muted-foreground">Error: </span>{a.error ?? "none"}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
