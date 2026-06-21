import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CalendarClock, Clock, UserX, LogIn, LogOut, CheckCheck, ArrowRight, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAlerts, type AdminAlert } from "@/backend/functions/admin-dashboard-extras.functions";
import { dispatchAdminAlerts } from "@/backend/functions/alert-dispatch.functions";
import { useNotificationPrefs } from "@/lib/notification-prefs";

const ICONS: Record<AdminAlert["kind"], typeof Bell> = {
  pending_leave: CalendarClock,
  late: Clock,
  absent: UserX,
  checkin: LogIn,
  checkout: LogOut,
};
const TONES: Record<AdminAlert["severity"], string> = {
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const SEEN_KEY = "admin-alerts-seen-ids";
function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")); } catch { return new Set(); }
}
function saveSeen(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200)));
}

export function NotificationsBell() {
  const qc = useQueryClient();
  const fn = useServerFn(getAdminAlerts);
  const dispatchFn = useServerFn(dispatchAdminAlerts);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const { isEnabled } = useNotificationPrefs();
  const { data } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => fn(),
    refetchInterval: 20_000,
  });

  // Fan newly arriving alerts out to email/push/in-app on the backend (once each).
  const dispatchedRef = (typeof window !== "undefined")
    ? (window as any).__alertDispatched ?? ((window as any).__alertDispatched = new Set<string>())
    : new Set<string>();
  useEffect(() => {
    if (!data?.alerts?.length) return;
    const fresh = data.alerts.filter((a) => !dispatchedRef.has(a.id));
    if (fresh.length === 0) return;
    fresh.forEach((a) => dispatchedRef.add(a.id));
    const payload = fresh.slice(0, 25).map((a) => ({
      alertId: a.id,
      category: a.kind,
      title: a.title,
      body: a.description,
      url: a.link,
    }));
    dispatchFn({ data: { alerts: payload } }).catch(() => { /* noop */ });
  }, [data?.alerts, dispatchFn, dispatchedRef]);

  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["admin-alerts"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["attendance-trend"] });
    };
    const channel = supabase
      .channel("admin-bell-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leaves" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const allAlerts = data?.alerts ?? [];
  const alerts = allAlerts.filter((a) => isEnabled(a.kind, "inapp"));
  const unread = alerts.filter((a) => !seen.has(a.id));
  const unreadCount = unread.length;

  const markAll = () => {
    const next = new Set(seen);
    alerts.forEach((a) => next.add(a.id));
    setSeen(next);
    saveSeen(next);
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && unreadCount > 0) {
      // mark seen once panel is opened
      const next = new Set(seen);
      alerts.forEach((a) => next.add(a.id));
      setSeen(next);
      saveSeen(next);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative rounded-full border border-border bg-card p-2 text-foreground transition hover:bg-accent"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success/70" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-display text-sm font-semibold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {alerts.length === 0 ? "All clear" : `${unreadCount} new • ${alerts.length} total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
            <a
              href="/admin/notification-preferences"
              className="inline-flex items-center gap-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Notification preferences"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">No notifications right now.</div>
        ) : (
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {alerts.map((a) => {
              const Icon = ICONS[a.kind];
              const isNew = !seen.has(a.id);
              return (
                <li key={a.id}>
                  <a
                    href={a.link ?? "/admin"}
                    className={`flex items-start gap-3 px-4 py-3 transition hover:bg-muted/60 ${isNew ? "bg-brand/[0.04]" : ""}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[a.severity]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`truncate text-sm ${isNew ? "font-semibold" : "font-medium"}`}>{a.title}</p>
                        {isNew && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{a.description}</p>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeAgo(a.ts)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <a href="/admin" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-brand hover:bg-muted">
              Notifications center <ArrowRight className="h-3 w-3" />
            </a>
            <a href="/admin/notification-preferences" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Preferences
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}