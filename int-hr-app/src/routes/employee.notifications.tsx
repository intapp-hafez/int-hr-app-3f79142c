import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Info, AlertTriangle, ShieldAlert, Loader2, BellOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDeliveries } from "@/backend/functions/notifications.functions";

export const Route = createFileRoute("/employee/notifications")({
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
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

function NotificationsPage() {
  const { t } = useI18n();
  const listFn = useServerFn(listMyDeliveries);
  const { data = [], isLoading } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => listFn(),
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("notifications")}</h1>
      {isLoading && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!isLoading && data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground">
          <BellOff className="mx-auto mb-2 h-6 w-6" />
          You have no notifications yet.
        </div>
      )}
      <ul className="space-y-2">
        {data.map((n: any) => {
          const tone = toneMap[pickTone(n.severity)];
          const Icon = tone.icon;
          return (
            <li key={n.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone.bg} ${tone.fg}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{n.title ?? n.event ?? "Notification"}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{fmtTime(n.created_at)}</span>
                </div>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
