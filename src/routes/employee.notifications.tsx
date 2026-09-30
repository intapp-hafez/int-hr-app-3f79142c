import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { syncMyFaceEnrollmentNotice } from "@/backend/functions/face-enrollment-notices.functions";
import { CheckCircle2, Info, AlertTriangle, ShieldAlert, Loader2, BellOff, CheckCheck, BellRing, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDeliveries, markMyNotificationsRead } from "@/backend/functions/notifications.functions";
import { enablePush, getPushSupport, isPushSubscribed } from "@/lib/push-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/employee/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — INT HR" },
      { name: "description", content: "Your leave, advance, task and attendance notifications." },
      { property: "og:title", content: "Notifications — INT HR" },
      { property: "og:description", content: "Your leave, advance, task and attendance notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const toneMap = {
  success: { icon: CheckCircle2, bg: "bg-success/10", fg: "text-success" },
  info: { icon: Info, bg: "bg-info/10", fg: "text-info" },
  warning: { icon: AlertTriangle, bg: "bg-warning/20", fg: "text-warning-foreground" },
  danger: { icon: ShieldAlert, bg: "bg-destructive/10", fg: "text-destructive" },
} as const;

function pickTone(severity?: string | null): keyof typeof toneMap {
  const s = String(severity ?? "info").toLowerCase();
  if (s === "success") return "success";
  if (s === "warning" || s === "warn") return "warning";
  if (s === "danger" || s === "error" || s === "critical") return "danger";
  return "info";
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  try { return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" }); } catch { return iso; }
}

const CATS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "leave", label: "Leaves" },
  { key: "advance", label: "Advances" },
  { key: "task", label: "Tasks" },
] as const;

export function NotificationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listMyDeliveries);
  const markFn = useServerFn(markMyNotificationsRead);
  const syncFaceFn = useServerFn(syncMyFaceEnrollmentNotice);
  const [filter, setFilter] = useState<(typeof CATS)[number]["key"]>("all");
  const [pushState, setPushState] = useState<"unknown" | "on" | "off" | "unsupported">("unknown");

  const faceSync = useQuery({ queryKey: ["face-enrollment-notice"], queryFn: () => syncFaceFn(), staleTime: 60_000 });
  const { data = [], isLoading, refetch } = useQuery({ queryKey: ["my-notifications"], queryFn: () => listFn(), refetchInterval: 30_000 });

  useEffect(() => { if (faceSync.data?.notified) refetch(); }, [faceSync.data?.notified, refetch]);

  useEffect(() => {
    if (getPushSupport() === "unsupported") { setPushState("unsupported"); return; }
    isPushSubscribed().then((v) => setPushState(v ? "on" : "off")).catch(() => setPushState("off"));
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: u }) => {
      if (!u.user) return;
      channel = supabase
        .channel(`my-notifs-${u.user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notif_deliveries", filter: `user_id=eq.${u.user.id}` }, () => {
          qc.invalidateQueries({ queryKey: ["my-notifications"] });
        })
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [qc]);

  const items = useMemo(() => (data as any[]).map((n) => {
    const p = (n.payload ?? {}) as any;
    const cat = String(p.category ?? p.kind ?? "").toLowerCase();
    return {
      id: n.id as string,
      title: p.title ?? n.subject ?? "Notification",
      body: p.body ?? null,
      url: p.url as string | undefined,
      tone: pickTone(n.severity ?? p.severity),
      unread: !p.read_at,
      cat: cat.includes("leave") ? "leave" : cat.includes("advance") ? "advance" : cat.includes("task") || cat.includes("trip") ? "task" : cat,
      at: n.created_at as string,
    };
  }), [data]);

  const unreadCount = items.filter((i) => i.unread).length;
  const shown = items.filter((i) => filter === "all" ? true : filter === "unread" ? i.unread : i.cat === filter);

  const markRead = async (ids?: string[]) => {
    await markFn({ data: { ids } }).catch(() => null);
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  };

  const open = async (i: (typeof items)[number]) => {
    if (i.unread) await markRead([i.id]);
    if (i.url && i.url.startsWith("/")) navigate({ to: i.url as any });
  };

  const turnOnPush = async () => {
    const r = await enablePush();
    if (r.ok) { setPushState("on"); toast.success("Phone alerts turned on"); }
    else toast.error(r.reason);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("notifications")}</h1>
          <p className="text-xs text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markRead()}>
            <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {pushState === "off" && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <BellRing className="h-5 w-5 shrink-0 text-primary" />
          <p className="flex-1 text-xs text-muted-foreground">Get alerts on this device even when the app is closed.</p>
          <Button size="sm" onClick={turnOnPush}>Turn on</Button>
        </div>
      )}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${filter === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}
          >
            {c.label}{c.key === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!isLoading && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground">
          <BellOff className="mx-auto mb-2 h-6 w-6" />
          No notifications here.
        </div>
      )}
      <ul className="space-y-2">
        {shown.map((n) => {
          const tone = toneMap[n.tone];
          const Icon = tone.icon;
          return (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                className={`flex w-full gap-3 rounded-2xl border p-4 text-left transition hover:bg-accent/50 ${n.unread ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone.bg} ${tone.fg}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${n.unread ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      {fmtTime(n.at)}
                      {n.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                </div>
                {n.url && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
