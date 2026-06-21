import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CalendarClock, Clock, UserX, LogIn, LogOut, ArrowRight, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAlerts, type AdminAlert } from "@/backend/functions/admin-dashboard-extras.functions";
import { useNotificationPrefs } from "@/lib/notification-prefs";

type Filter = "all" | "pending_leave" | "late" | "absent" | "checkin" | "checkout";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending_leave", label: "Pending leaves" },
  { id: "late", label: "Late" },
  { id: "absent", label: "Absent" },
  { id: "checkin", label: "Check-ins" },
  { id: "checkout", label: "Check-outs" },
];

const ICONS: Record<AdminAlert["kind"], typeof Bell> = {
  pending_leave: CalendarClock,
  late: Clock,
  absent: UserX,
  checkin: LogIn,
  checkout: LogOut,
};

const TONES: Record<AdminAlert["severity"], string> = {
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationsCenter() {
  const [filter, setFilter] = useState<Filter>("all");
  const [pulse, setPulse] = useState(false);
  const qc = useQueryClient();
  const fn = useServerFn(getAdminAlerts);
  const { isEnabled } = useNotificationPrefs();
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => fn(),
    refetchInterval: 20_000,
  });

  // Realtime: invalidate when attendance or leaves change
  useEffect(() => {
    const triggerRefresh = () => {
      setPulse(true);
      qc.invalidateQueries({ queryKey: ["admin-alerts"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["attendance-trend"] });
      window.setTimeout(() => setPulse(false), 1200);
    };
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, triggerRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leaves" }, triggerRefresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const allAlerts = data?.alerts ?? [];
  const alerts = allAlerts.filter((a) => isEnabled(a.kind, "inapp"));
  const counts = data?.counts ?? { pendingLeaves: 0, late: 0, absent: 0, checkout: 0, total: 0 };
  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.kind === filter);

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <span className="relative">
              <Bell className="h-4 w-4 text-brand" />
              {counts.total > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
              )}
            </span>
            Notifications Center
            <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${pulse ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              <Zap className={`h-3 w-3 ${pulse ? "animate-pulse" : ""}`} /> {pulse ? "Updated" : "Live"}
            </span>
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {counts.pendingLeaves} pending leave{counts.pendingLeaves === 1 ? "" : "s"} • {counts.late} late • {counts.absent} absent today
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          disabled={isFetching}
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const c =
            f.id === "all" ? counts.total
            : f.id === "pending_leave" ? counts.pendingLeaves
            : f.id === "late" ? counts.late
            : f.id === "absent" ? counts.absent
            : alerts.filter((a) => a.kind === f.id).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                active ? "bg-brand text-brand-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-background/60"}`}>{c}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground">All clear — no alerts.</div>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pe-1">
          {filtered.map((a) => {
            const Icon = ICONS[a.kind];
            return (
              <li key={a.id}>
                <a
                  href={a.link ?? "/admin"}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-3 transition hover:border-brand/40 hover:bg-muted/60"
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${TONES[a.severity]}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{timeAgo(a.ts)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}