import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CalendarClock,
  Clock,
  UserX,
  LogIn,
  LogOut,
  CheckCheck,
  ArrowRight,
  Settings2,
  CreditCard,
  FileText,
  ShieldAlert,
  Award,
  Timer,
  DollarSign,
  CheckSquare,
  ChevronDown,
  Check,
  Sparkles,
  Inbox,
  ExternalLink,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAlerts, type AdminAlert } from "@/backend/functions/admin-dashboard-extras.functions";
import { dispatchAdminAlerts } from "@/backend/functions/alert-dispatch.functions";
import { useNotificationPrefs } from "@/lib/notification-prefs";
import { listMyDeliveries, markMyNotificationsRead } from "@/backend/functions/notifications.functions";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

const ICONS: Record<AdminAlert["kind"], typeof Bell> = {
  pending_leave: CalendarClock,
  leave_decision: CheckCheck,
  late: Clock,
  absent: UserX,
  checkin: LogIn,
  checkout: LogOut,
  id_expiry: CreditCard,
  contract_expiry: FileText,
  insurance_expiry: ShieldAlert,
  military_expiry: Award,
  probation_end: Timer,
  advance_payment: DollarSign,
  task_status: CheckSquare,
};

const ALERT_GROUPS_META: Record<
  AdminAlert["kind"],
  { title: string; titleAr: string; icon: typeof Bell; defaultSeverity: "info" | "warning" | "danger"; link: string }
> = {
  id_expiry: {
    title: "National ID Expirations",
    titleAr: "انتهاء بطاقات الرقم القومي",
    icon: CreditCard,
    defaultSeverity: "danger",
    link: "/admin/directory",
  },
  contract_expiry: {
    title: "Contract Expirations",
    titleAr: "انتهاء عقود العمل",
    icon: FileText,
    defaultSeverity: "warning",
    link: "/admin/contracts",
  },
  insurance_expiry: {
    title: "Insurance Renewals",
    titleAr: "تجديد التأمين الطبي والاجتماعي",
    icon: ShieldAlert,
    defaultSeverity: "warning",
    link: "/admin/employees",
  },
  military_expiry: {
    title: "Military Certificates Expiring",
    titleAr: "انتهاء شهادات التجنيد",
    icon: Award,
    defaultSeverity: "warning",
    link: "/admin/directory",
  },
  probation_end: {
    title: "Probation Period Reviews",
    titleAr: "انتهاء فترات الاختبار (3 أشهر)",
    icon: Timer,
    defaultSeverity: "warning",
    link: "/admin/employees",
  },
  pending_leave: {
    title: "Pending Leave Requests",
    titleAr: "طلبات إجازة معلقة",
    icon: CalendarClock,
    defaultSeverity: "warning",
    link: "/admin/leaves-requests",
  },
  leave_decision: {
    title: "Leave Decisions",
    titleAr: "قرارات الإجازات",
    icon: CheckCheck,
    defaultSeverity: "info",
    link: "/admin/leaves",
  },
  advance_payment: {
    title: "Salary Advance Requests",
    titleAr: "طلبات السلف المالية",
    icon: DollarSign,
    defaultSeverity: "warning",
    link: "/admin/payroll",
  },
  late: {
    title: "Late Arrivals",
    titleAr: "حالات التأخير عن الوردية",
    icon: Clock,
    defaultSeverity: "danger",
    link: "/admin/attendance",
  },
  absent: {
    title: "Daily Attendance & Absences",
    titleAr: "الغياب وحضور اليوم",
    icon: UserX,
    defaultSeverity: "danger",
    link: "/admin/attendance",
  },
  checkin: {
    title: "Team Check-In Activity",
    titleAr: "تسجيل حضور الفريق",
    icon: LogIn,
    defaultSeverity: "info",
    link: "/manager/check",
  },
  checkout: {
    title: "Team Check-Out Activity",
    titleAr: "تسجيل انصراف الفريق",
    icon: LogOut,
    defaultSeverity: "info",
    link: "/manager/check",
  },
  task_status: {
    title: "Team Task Status Updates",
    titleAr: "تحديثات مهام الفريق",
    icon: CheckSquare,
    defaultSeverity: "info",
    link: "/manager/tasks",
  },
};

const TONES: Record<string, string> = {
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
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
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200)));
}

const DISPATCHED_KEY = "admin-alerts-dispatched-ids";
function loadDispatched(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISPATCHED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveDispatched(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISPATCHED_KEY, JSON.stringify([...ids].slice(-500)));
}

interface AlertGroup {
  kind: AdminAlert["kind"];
  title: string;
  titleAr: string;
  icon: typeof Bell;
  severity: "info" | "warning" | "danger";
  link?: string;
  alerts: AdminAlert[];
  unreadCount: number;
}

export function NotificationsBell() {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const qc = useQueryClient();
  const fn = useServerFn(getAdminAlerts);
  const dispatchFn = useServerFn(dispatchAdminAlerts);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"alerts" | "inbox">("alerts");
  const [filterMode, setFilterMode] = useState<"unread" | "all">("unread");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const navigate = useNavigate();
  const inboxFn = useServerFn(listMyDeliveries);
  const markFn = useServerFn(markMyNotificationsRead);

  const inboxQ = useQuery({ queryKey: ["my-notifications"], queryFn: () => inboxFn(), refetchInterval: 30_000 });
  const inbox = ((inboxQ.data ?? []) as any[]).map((n) => {
    const p = (n.payload ?? {}) as any;
    return {
      id: n.id as string,
      title: p.title ?? n.subject ?? "Notification",
      body: (p.body ?? "") as string,
      url: (p.url ?? p.link) as string | undefined,
      severity: (p.severity ?? "info") as string,
      unread: !p.read_at,
      ts: n.created_at as string,
    };
  });
  const inboxUnread = inbox.filter((i) => i.unread).length;

  const go = (url?: string) => {
    setOpen(false);
    if (url && url.startsWith("/")) navigate({ to: url as any });
    else if (url) window.location.href = url;
  };

  const openInbox = async (i: (typeof inbox)[number]) => {
    if (i.unread) {
      await markFn({ data: { ids: [i.id] } }).catch(() => null);
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    }
    go(i.url ?? "/admin");
  };

  const markInboxAll = async () => {
    await markFn({ data: {} }).catch(() => null);
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  };

  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const { isEnabled } = useNotificationPrefs();
  const { data } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => fn(),
    refetchInterval: 20_000,
  });

  // Fan newly arriving alerts out to email/push/in-app on the backend (once each).
  const dispatchedRef = useRef<Set<string> | null>(null);
  if (!dispatchedRef.current) {
    dispatchedRef.current = loadDispatched();
  }

  useEffect(() => {
    if (!data?.alerts?.length || (data as any)?.isManagerScoped) return;
    const currentDispatched = dispatchedRef.current || loadDispatched();
    const fresh = data.alerts.filter((a) => !currentDispatched.has(a.id));
    if (fresh.length === 0) return;
    fresh.forEach((a) => currentDispatched.add(a.id));
    saveDispatched(currentDispatched);
    const payload = fresh.slice(0, 25).map((a) => ({
      alertId: a.id,
      category: a.kind,
      title: a.title,
      body: a.description,
      url: a.link,
    }));
    dispatchFn({ data: { alerts: payload } }).catch(() => {
      /* noop */
    });
  }, [data?.alerts, dispatchFn]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const allAlerts = data?.alerts ?? [];
  const alerts = allAlerts.filter((a) => isEnabled(a.kind, "inapp"));
  const unreadAlerts = alerts.filter((a) => !seen.has(a.id));
  const alertUnread = unreadAlerts.length;
  const unreadCount = alertUnread + inboxUnread;

  const markSingleAlertSeen = (alertId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(seen);
    next.add(alertId);
    setSeen(next);
    saveSeen(next);
  };

  const markGroupRead = (groupAlerts: AdminAlert[], e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(seen);
    groupAlerts.forEach((a) => next.add(a.id));
    setSeen(next);
    saveSeen(next);
  };

  const markAll = () => {
    const next = new Set(seen);
    alerts.forEach((a) => next.add(a.id));
    setSeen(next);
    saveSeen(next);
  };

  const toggleGroup = (kind: string) => {
    setExpandedGroups((prev) => ({ ...prev, [kind]: !prev[kind] }));
  };

  // Filtered alerts based on filterMode ("unread" by default)
  const displayedAlerts = useMemo(() => {
    return filterMode === "unread" ? unreadAlerts : alerts;
  }, [filterMode, unreadAlerts, alerts]);

  // Group displayed alerts by kind
  const groupedAlerts = useMemo(() => {
    const map = new Map<AdminAlert["kind"], AdminAlert[]>();
    for (const a of displayedAlerts) {
      const list = map.get(a.kind) ?? [];
      list.push(a);
      map.set(a.kind, list);
    }

    const groups: AlertGroup[] = [];
    for (const [kind, items] of map.entries()) {
      const meta = ALERT_GROUPS_META[kind] ?? {
        title: kind.replace(/_/g, " "),
        titleAr: kind.replace(/_/g, " "),
        icon: Bell,
        defaultSeverity: "info" as const,
        link: "/admin",
      };

      let highestSeverity: "info" | "warning" | "danger" = meta.defaultSeverity;
      if (items.some((i) => i.severity === "danger")) highestSeverity = "danger";
      else if (items.some((i) => i.severity === "warning")) highestSeverity = "warning";

      groups.push({
        kind,
        title: meta.title,
        titleAr: meta.titleAr,
        icon: meta.icon,
        severity: highestSeverity,
        link: meta.link,
        alerts: items,
        unreadCount: items.filter((i) => !seen.has(i.id)).length,
      });
    }

    // Sort: danger first, then warning, then count
    return groups.sort((a, b) => {
      const sevWeight = { danger: 3, warning: 2, info: 1 };
      const diff = sevWeight[b.severity] - sevWeight[a.severity];
      if (diff !== 0) return diff;
      return b.alerts.length - a.alerts.length;
    });
  }, [displayedAlerts, seen]);

  const displayedInbox = useMemo(() => {
    return filterMode === "unread" ? inbox.filter((i) => i.unread) : inbox;
  }, [filterMode, inbox]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent align="end" className="w-[400px] sm:w-[460px] max-w-[calc(100vw-1rem)] p-0 rounded-2xl shadow-xl overflow-hidden border border-border bg-card">
        {/* Header with Title and Mode Switcher */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-sm font-semibold text-foreground">
                {isAr ? "الإشعارات" : "Notifications"}
              </p>
              {unreadCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                  {unreadCount} {isAr ? "جديد" : "new"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {isAr ? "محدث بالكامل" : "All caught up"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {filterMode === "unread"
                ? isAr
                  ? "عرض التنبيهات غير المقروءة مجمعة"
                  : "Showing unread alerts grouped by topic"
                : isAr
                ? "عرض كافة الإشعارات"
                : "Showing all notifications"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Unread vs All Pill Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode("unread")}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  filterMode === "unread"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isAr ? "غير المقروءة" : "Unread"}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  filterMode === "all"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isAr ? "الكل" : "All"}
              </button>
            </div>

            {(tab === "alerts" ? alertUnread : inboxUnread) > 0 && (
              <button
                type="button"
                onClick={tab === "alerts" ? markAll : markInboxAll}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition"
                title={isAr ? "تحديد الكل كمقروء" : "Mark all as read"}
              >
                <CheckCheck className="h-3 w-3 text-primary" />
                <span className="hidden sm:inline">{isAr ? "قراءة الكل" : "Mark read"}</span>
              </button>
            )}

            <a
              href="/admin/notification-preferences"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              title="Notification preferences"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Tab Switcher: HR/Team alerts vs My inbox */}
        <div className="grid grid-cols-2 gap-1 border-b border-border bg-muted/40 p-1">
          {(["alerts", "inbox"] as const).map((k) => {
            const count = k === "alerts" ? (filterMode === "unread" ? alertUnread : alerts.length) : (filterMode === "unread" ? inboxUnread : inbox.length);
            const isTabActive = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                  isTabActive
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                }`}
              >
                {k === "alerts" ? (
                  <>
                    <Bell className="h-3.5 w-3.5" />
                    <span>{(data as any)?.isManagerScoped ? (isAr ? "تنبيهات الفريق" : "Team alerts") : isAr ? "تنبيهات الموارد البشرية" : "HR alerts"}</span>
                  </>
                ) : (
                  <>
                    <Inbox className="h-3.5 w-3.5" />
                    <span>{isAr ? "صندوق البريد" : "My inbox"}</span>
                  </>
                )}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isTabActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        {tab === "inbox" ? (
          displayedInbox.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                <Check className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {filterMode === "unread" ? (isAr ? "لا توجد رسائل غير مقروءة" : "No unread inbox messages") : isAr ? "صندوق الرسائل فارغ" : "Inbox is empty"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-[240px]">
                {filterMode === "unread" && inbox.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className="text-primary underline mt-1 font-medium"
                  >
                    {isAr ? `عرض ${inbox.length} رسائل سابقة` : `View ${inbox.length} read messages`}
                  </button>
                ) : (
                  isAr ? "جميع رسائل الإشعارات الشخصية مقروءة" : "You have processed all incoming direct notifications"
                )}
              </p>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
              {displayedInbox.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => openInbox(i)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/60 ${
                      i.unread ? "bg-primary/5" : ""
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[i.severity] ?? TONES.info}`}>
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`break-words text-sm leading-snug ${i.unread ? "font-semibold" : "font-medium"}`} title={i.title}>
                          {i.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                          {i.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          <span className="text-[10px] tabular-nums text-muted-foreground">{timeAgo(i.ts)}</span>
                        </div>
                      </div>
                      {i.body && <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">{i.body}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : groupedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {filterMode === "unread" ? (isAr ? "أنت على اطلاع بكل جديد 🎉" : "All caught up! 🎉") : isAr ? "لا توجد تنبيهات حالياً" : "No notifications right now"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[260px]">
              {filterMode === "unread" && alerts.length > 0 ? (
                <>
                  {isAr ? "لا توجد تنبيهات غير مقروءة." : "No unread notifications pending."}{" "}
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className="text-primary underline font-medium"
                  >
                    {isAr ? `عرض ${alerts.length} تنبيهات سابقة` : `Show all ${alerts.length} alerts`}
                  </button>
                </>
              ) : (
                isAr ? "لا توجد تنبيهات تتطلب إجراء حالياً في النظام." : "No active alerts require attention right now."
              )}
            </p>
          </div>
        ) : (
          <div className="max-h-[440px] divide-y divide-border overflow-y-auto">
            {groupedAlerts.map((group) => {
              const Icon = group.icon;
              const isMulti = group.alerts.length > 1;
              const isExpanded = !!expandedGroups[group.kind];

              // If it's a single alert, render directly as a clean standalone item
              if (!isMulti) {
                const a = group.alerts[0];
                const isNew = !seen.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`group flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-muted/60 ${
                      isNew ? "bg-primary/5" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        markSingleAlertSeen(a.id);
                        go(a.link ?? group.link ?? "/admin");
                      }}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[a.severity]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`break-words text-sm leading-snug ${isNew ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
                            {a.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                            {isNew && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                            <span className="text-[10px] tabular-nums text-muted-foreground">{timeAgo(a.ts)}</span>
                          </div>
                        </div>
                        {a.description && (
                          <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">
                            {a.description}
                          </p>
                        )}
                      </div>
                    </button>
                    {isNew && (
                      <button
                        type="button"
                        onClick={(e) => markSingleAlertSeen(a.id, e)}
                        className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition self-center"
                        title={isAr ? "تحديد كمقروء" : "Mark as read"}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              }

              // Multiple alerts of the same kind: render as a Grouped Accordion Card
              return (
                <div key={group.kind} className="border-b border-border/60 last:border-b-0">
                  {/* Group Summary Row */}
                  <div
                    onClick={() => toggleGroup(group.kind)}
                    className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/50 bg-card select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[group.severity]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {isAr ? group.titleAr : group.title}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.2 text-[10px] font-bold text-primary">
                            {group.alerts.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                          {group.alerts.slice(0, 3).map((a) => a.title.replace(/^[^:]+:\s*/, "")).join(", ")}
                          {group.alerts.length > 3 ? ` +${group.alerts.length - 3} ${isAr ? "آخرين" : "more"}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {group.unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => markGroupRead(group.alerts, e)}
                          className="rounded-lg p-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
                          title={isAr ? "تحديد المجموعة كمقروءة" : "Mark group as read"}
                        >
                          <CheckCheck className="h-3.5 w-3.5 text-primary" />
                        </button>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Sub-items List */}
                  {isExpanded && (
                    <div className="bg-muted/20 border-t border-border/40 divide-y divide-border/40 pl-6 sm:pl-8 pr-3 py-1">
                      {group.alerts.map((a) => {
                        const isNew = !seen.has(a.id);
                        return (
                          <div
                            key={a.id}
                            className="group flex items-center justify-between gap-2 py-2 text-xs hover:bg-muted/40 rounded-lg px-2 transition"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                markSingleAlertSeen(a.id);
                                go(a.link ?? group.link ?? "/admin");
                              }}
                              className="flex min-w-0 flex-1 items-start justify-between text-left gap-2"
                            >
                              <div className="min-w-0">
                                <p className={`truncate ${isNew ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                                  {a.title}
                                </p>
                                {a.description && (
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {a.description}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 text-[10px] text-muted-foreground pt-0.5">
                                {timeAgo(a.ts)}
                              </span>
                            </button>
                            {isNew && (
                              <button
                                type="button"
                                onClick={(e) => markSingleAlertSeen(a.id, e)}
                                className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                                title={isAr ? "تحديد كمقروء" : "Mark read"}
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Group Quick Link */}
                      {group.link && (
                        <div className="pt-1.5 pb-1 text-end">
                          <button
                            type="button"
                            onClick={() => go(group.link)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <span>{isAr ? "عرض الكل في السجل" : "View all in directory"}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border px-4 py-2.5 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <a
              href={(data as any)?.isManagerScoped ? "/manager/notifications" : "/admin/notification-preferences"}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:underline transition"
            >
              {isAr ? "مركز تفضيلات الإشعارات" : "Notifications center"} <ArrowRight className="h-3 w-3" />
            </a>
            <a
              href="/admin/notification-preferences"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              {isAr ? "الإعدادات" : "Preferences"}
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
