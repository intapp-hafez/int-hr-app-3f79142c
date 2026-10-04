import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDeliveries } from "@/backend/functions/notifications.functions";

type To = "/staff/notifications" | "/manager/notifications" | "/finance/notifications" | "/employee/notifications";

/** Header bell for non-admin panels: shows the real unread in-app count and links to the panel's inbox. */
export function PanelNotificationsBell({ to, label = "Notifications" }: { to: To; label?: string }) {
  const listFn = useServerFn(listMyDeliveries);
  const { data = [] } = useQuery({ queryKey: ["my-notifications"], queryFn: () => listFn(), refetchInterval: 30_000 });
  const unread = (data as any[]).filter((n) => !(n.payload as any)?.read_at).length;
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
