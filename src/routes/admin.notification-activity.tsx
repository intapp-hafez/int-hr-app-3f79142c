import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Activity, Search } from "lucide-react";
import { listNotificationActivity, type NotificationActivityRow } from "@/backend/functions/notification-activity.functions";

export const Route = createFileRoute("/admin/notification-activity")({
  head: () => ({
    meta: [
      { title: "Notification activity log — INT HR" },
      { name: "description", content: "Audit alert delivery status, read status and timestamps." },
      { property: "og:title", content: "Notification activity log — INT HR" },
      { property: "og:description", content: "Audit alert delivery status, read status and timestamps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationActivityPage,
});

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusClass(s: string) {
  if (/sent|delivered|ok/i.test(s)) return "bg-success/15 text-success";
  if (/fail|error/i.test(s)) return "bg-destructive/15 text-destructive";
  if (/skip|suppress/i.test(s)) return "bg-muted text-muted-foreground";
  return "bg-warning/15 text-warning-foreground";
}

function NotificationActivityPage() {
  const [days, setDays] = useState(14);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [read, setRead] = useState("all");
  const fn = useServerFn(listNotificationActivity);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["notif-activity", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: 60_000,
  });

  const statuses = useMemo(() => Array.from(new Set(data.map((r) => r.status))).sort(), [data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((r: NotificationActivityRow) => {
      if (channel !== "all" && r.channel !== channel) return false;
      if (status !== "all" && r.status !== status) return false;
      if (read === "read" && (r.channel !== "inapp" || !r.read_at)) return false;
      if (read === "unread" && (r.channel !== "inapp" || r.read_at)) return false;
      if (!s) return true;
      return [r.user_name, r.subject, r.recipient, r.category, r.error].some((v) => v?.toLowerCase().includes(s));
    });
  }, [data, q, channel, status, read]);

  const failed = data.filter((r) => /fail|error/i.test(r.status)).length;
  const inapp = data.filter((r) => r.channel === "inapp");
  const readCount = inapp.filter((r) => r.read_at).length;

  const sel = "rounded-xl border border-border bg-card px-3 py-2 text-sm";
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div>
        <Link to="/admin/notification-preferences" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Notification preferences
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Activity className="h-5 w-5 text-brand" /> Notification activity log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Every alert sent in-app, by email or push — with delivery status, read status and time.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total deliveries", data.length],
          ["Failed", failed],
          ["In-app read", `${readCount}/${inapp.length}`],
          ["In-app unread", inapp.length - readCount],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person, title, category, error…" className={`${sel} w-full pl-9`} />
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={sel}>
          {[1, 7, 14, 30, 90].map((d) => <option key={d} value={d}>Last {d} day{d > 1 ? "s" : ""}</option>)}
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={sel}>
          <option value="all">All channels</option><option value="inapp">In-app</option><option value="email">Email</option><option value="push">Push</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="all">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={read} onChange={(e) => setRead(e.target.value)} className={sel}>
          <option value="all">Read & unread</option><option value="read">Read (in-app)</option><option value="unread">Unread (in-app)</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Sent</th><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Alert</th>
              <th className="px-3 py-2">Channel</th><th className="px-3 py-2">Delivery</th><th className="px-3 py-2">Read</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {error && <tr><td colSpan={6} className="px-3 py-8 text-center text-destructive">{(error as Error).message}</td></tr>}
            {!isLoading && !error && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No notifications match.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(r.created_at)}</td>
                <td className="px-3 py-2"><div className="font-medium">{r.user_name}</div><div className="text-xs text-muted-foreground">{r.recipient ?? ""}</div></td>
                <td className="px-3 py-2"><div>{r.subject ?? "—"}</div>{r.category && <div className="text-xs text-muted-foreground">{r.category}</div>}{r.error && <div className="text-xs text-destructive">{r.error}</div>}</td>
                <td className="px-3 py-2 capitalize">{r.channel === "inapp" ? "In-app" : r.channel}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(r.status)}`}>{r.status}</span></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {r.channel !== "inapp" ? <span className="text-muted-foreground">n/a</span> : r.read_at ? <span className="text-success">Read {fmt(r.read_at)}</span> : <span className="text-warning-foreground">Unread</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
