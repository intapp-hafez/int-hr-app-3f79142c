import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getMyPreferences, saveMyPreferences } from "@/backend/functions/notifications.functions";

type P = {
  push_enabled: boolean; email_enabled: boolean; inapp_enabled: boolean;
  quiet_start: string | null; quiet_end: string | null; timezone: string;
};

export function DeliverySettingsCard() {
  const getFn = useServerFn(getMyPreferences);
  const saveFn = useServerFn(saveMyPreferences);
  const [p, setP] = useState<P | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getFn().then((d: any) => setP({
      push_enabled: d.push_enabled ?? true, email_enabled: d.email_enabled ?? true, inapp_enabled: d.inapp_enabled ?? true,
      quiet_start: d.quiet_start ? String(d.quiet_start).slice(0, 5) : null,
      quiet_end: d.quiet_end ? String(d.quiet_end).slice(0, 5) : null,
      timezone: d.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    })).catch(() => setP(null));
  }, [getFn]);

  if (!p) return null;
  const save = async () => {
    if ((p.quiet_start && !p.quiet_end) || (!p.quiet_start && p.quiet_end)) return toast.error("Set both quiet hours start and end, or neither.");
    setBusy(true);
    try { await saveFn({ data: p }); toast.success("Delivery settings saved"); }
    catch (e: any) { toast.error(e?.message ?? "Failed to save"); }
    finally { setBusy(false); }
  };
  const row = (k: "inapp_enabled" | "email_enabled" | "push_enabled", label: string, hint: string) => (
    <label className="flex items-center justify-between gap-3 py-2">
      <span><span className="text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
      <Switch checked={p[k]} onCheckedChange={(v) => setP({ ...p, [k]: v })} />
    </label>
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Delivery settings</h2>
        <Link to="/admin/notification-activity" className="text-xs text-brand hover:underline">View notification activity log →</Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Master switches for each channel, plus quiet hours when email and push are held back.</p>
      <div className="mt-3 divide-y divide-border">
        {row("inapp_enabled", "In-app delivery", "Personal messages in your bell inbox")}
        {row("email_enabled", "Email delivery", "Copies sent to your account email")}
        {row("push_enabled", "Push delivery", "Browser and phone push alerts")}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs">Quiet from<input type="time" value={p.quiet_start ?? ""} onChange={(e) => setP({ ...p, quiet_start: e.target.value || null })} className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="text-xs">Until<input type="time" value={p.quiet_end ?? ""} onChange={(e) => setP({ ...p, quiet_end: e.target.value || null })} className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label>
        <span className="pb-2 text-xs text-muted-foreground">Time zone: {p.timezone}</span>
        <button onClick={save} disabled={busy} className="ml-auto rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
