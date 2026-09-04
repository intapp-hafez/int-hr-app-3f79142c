import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  ArrowLeft,
  RotateCcw,
  Mail,
  Smartphone,
  MonitorSmartphone,
  Check,
  BellRing,
  BellOff,
  CreditCard,
  CalendarClock,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { enablePush, disablePush, isPushSubscribed, getPushSupport } from "@/lib/push-client";
import {
  useNotificationPrefs,
  CATEGORY_META,
  CATEGORY_GROUPS,
  CHANNEL_META,
  type AlertCategory,
  type AlertChannel,
} from "@/lib/notification-prefs";

export const Route = createFileRoute("/admin/notification-preferences")({
  component: NotificationPreferencesPage,
});

const CHANNEL_ICON: Record<AlertChannel, typeof Mail> = {
  inapp: MonitorSmartphone,
  email: Mail,
  push: Smartphone,
};

const GROUP_ICONS: Record<string, typeof Bell> = {
  expirations: CreditCard,
  requests: CalendarClock,
  attendance: Clock,
};

function NotificationPreferencesPage() {
  const { prefs, update, setCategoryAll, reset } = useNotificationPrefs();
  const [pushOn, setPushOn] = useState(false);
  const [pushSupport, setPushSupport] = useState<string>("unsupported");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPushSupport(getPushSupport());
    isPushSubscribed().then(setPushOn);
  }, []);

  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success("Push notifications disabled");
      } else {
        const r = await enablePush();
        if (r.ok) {
          setPushOn(true);
          toast.success("Push notifications enabled");
        } else {
          toast.error(r.reason);
        }
      }
    } finally {
      setBusy(false);
      setPushSupport(getPushSupport());
    }
  };

  const enableAll = () => {
    (Object.keys(prefs) as AlertCategory[]).forEach((c) => setCategoryAll(c, true));
    toast.success("All notifications enabled");
  };
  const muteAll = () => {
    (Object.keys(prefs) as AlertCategory[]).forEach((c) => setCategoryAll(c, false));
    toast.success("All notifications muted");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <Bell className="h-5 w-5 text-brand" /> Notification preferences
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which alerts you receive and how. Settings are saved automatically per device and synced to your account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={enableAll} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            <Check className="h-3.5 w-3.5" /> Enable all
          </button>
          <button onClick={muteAll} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            Mute all
          </button>
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Push enable card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${pushOn ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
            {pushOn ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-sm font-semibold">Browser push notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {pushSupport === "unsupported"
                ? "This browser does not support web push."
                : pushOn
                  ? "This device is subscribed. Alerts you enabled below will arrive even when the tab is closed."
                  : "Allow notifications to receive push alerts on this device."}
            </p>
          </div>
        </div>
        <button
          onClick={togglePush}
          disabled={busy || pushSupport === "unsupported"}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${pushOn ? "border border-border bg-card hover:bg-muted" : "bg-brand text-brand-foreground hover:opacity-90"} disabled:opacity-50`}
        >
          {busy ? "Working…" : pushOn ? "Disable on this device" : "Enable push"}
        </button>
      </div>

      {/* Channel legend */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CHANNEL_META.map((ch) => {
          const Icon = CHANNEL_ICON[ch.id];
          return (
            <div key={ch.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{ch.label}</p>
                <p className="text-[11px] text-muted-foreground">{ch.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grouped Category Sections */}
      <div className="space-y-6">
        {CATEGORY_GROUPS.map((group) => {
          const items = CATEGORY_META.filter((c) => c.group === group.id);
          const GroupIcon = GROUP_ICONS[group.id] || Bell;

          const enableGroup = () => {
            items.forEach((c) => setCategoryAll(c.id, true));
            toast.success(`Enabled all ${group.label.toLowerCase()}`);
          };
          const muteGroup = () => {
            items.forEach((c) => setCategoryAll(c.id, false));
            toast.success(`Muted all ${group.label.toLowerCase()}`);
          };

          return (
            <div key={group.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
              {/* Group Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
                    <GroupIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight">{group.label}</h2>
                    <p className="text-[11px] text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={enableGroup}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-brand hover:bg-brand/10 transition-colors"
                  >
                    Enable group
                  </button>
                  <span className="text-muted-foreground/40">•</span>
                  <button
                    onClick={muteGroup}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Mute group
                  </button>
                </div>
              </div>

              {/* Table Column Headers */}
              <div className="hidden grid-cols-[1fr_repeat(3,minmax(80px,110px))] items-center gap-2 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid">
                <span>Notification Type</span>
                {CHANNEL_META.map((ch) => (
                  <span key={ch.id} className="text-center">{ch.label}</span>
                ))}
              </div>

              {/* Category Rows */}
              <ul className="divide-y divide-border">
                {items.map((cat) => (
                  <li
                    key={cat.id}
                    className="grid grid-cols-1 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/10 sm:grid-cols-[1fr_repeat(3,minmax(80px,110px))]"
                  >
                    <div>
                      <p className="text-sm font-medium">{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground">{cat.description}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:contents">
                      {CHANNEL_META.map((ch) => (
                        <label key={ch.id} className="flex items-center justify-center gap-2 sm:flex-col sm:gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground sm:hidden">{ch.label}</span>
                          <Switch
                            checked={prefs[cat.id]?.[ch.id] ?? false}
                            onCheckedChange={(v) => update(cat.id, ch.id, v)}
                            aria-label={`${cat.label} via ${ch.label}`}
                          />
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        In-app alerts appear in the bell and notifications center immediately. Email and push delivery require those channels to be configured for your account.
      </p>
    </div>
  );
}