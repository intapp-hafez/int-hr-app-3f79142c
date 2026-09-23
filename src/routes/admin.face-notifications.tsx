import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, ScanFace, Search } from "lucide-react";
import { listFaceEnrollmentHistory } from "@/backend/functions/face-enrollment-notices.functions";

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
  const [q, setQ] = useState("");
  const [state, setState] = useState("all");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((r) =>
      (state === "all" || r.state === state) &&
      (channel === "all" || r.channel === channel) &&
      (status === "all" || r.status === status) &&
      (!s || `${r.employee} ${r.empCode ?? ""} ${r.recipient ?? ""} ${r.error ?? ""}`.toLowerCase().includes(s)),
    );
  }, [data, q, state, channel, status]);

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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {error && <tr><td colSpan={6} className="px-4 py-8 text-center text-destructive">{(error as Error).message}</td></tr>}
            {!isLoading && !error && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No notifications found.</td></tr>}
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
                <td className="px-4 py-2.5 text-muted-foreground">{r.error ?? r.recipient ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
