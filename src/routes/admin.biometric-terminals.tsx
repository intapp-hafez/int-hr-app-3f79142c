import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Cpu, MapPin, Plus, Power, Activity, X, Pencil } from "lucide-react";
import {
  listBiometricTerminals,
  saveBiometricTerminal,
  setBiometricTerminalStatus,
  getBiometricTerminalActivity,
} from "@/backend/functions/biometric-terminals.functions";

export const Route = createFileRoute("/admin/biometric-terminals")({
  head: () => ({
    meta: [
      { title: "Biometric attendance devices · HR" },
      { name: "description", content: "Register, disable and review activity of biometric attendance devices by work location." },
      { property: "og:title", content: "Biometric attendance devices" },
      { property: "og:description", content: "Manage face and fingerprint attendance devices per location." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TerminalsPage,
});

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (iso: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type Form = { id?: string; name: string; deviceCode: string; kind: "face" | "fingerprint" | "both"; locationId: string; notes: string };
const EMPTY: Form = { name: "", deviceCode: "", kind: "face", locationId: "", notes: "" };

function TerminalsPage() {
  const listFn = useServerFn(listBiometricTerminals);
  const saveFn = useServerFn(saveBiometricTerminal);
  const statusFn = useServerFn(setBiometricTerminalStatus);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["bio-terminals"], queryFn: () => listFn() });
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [activityOf, setActivityOf] = useState<{ code: string; name: string } | null>(null);
  const [locFilter, setLocFilter] = useState("all");
  const refresh = () => qc.invalidateQueries({ queryKey: ["bio-terminals"] });

  const save = useMutation({
    mutationFn: (f: Form) => saveFn({ data: { ...f, notes: f.notes || null } }),
    onSuccess: () => { toast.success("Device saved"); setForm(null); refresh(); },
    onError: (e) => {
      const m = (e as Error).message;
      try { setFormErr(JSON.parse(m)[0]?.message ?? m); } catch { setFormErr(m); }
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; status: "active" | "disabled" }) => statusFn({ data: v }),
    onSuccess: (_, v) => { toast.success(v.status === "disabled" ? "Device disabled" : "Device enabled"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const locations = data?.locations ?? [];
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["terminals"]>();
    for (const t of data?.terminals ?? []) {
      const k = t.locationId ?? "none";
      if (locFilter !== "all" && k !== locFilter) continue;
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()];
  }, [data, locFilter]);
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? "No location";
  const inp = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/admin/audit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Audit
          </Link>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <Cpu className="h-5 w-5 text-brand" /> Biometric attendance devices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Register face and fingerprint devices at each work location, disable them, and review their activity.</p>
        </div>
        <div className="flex gap-2">
          <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
            <option value="all">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button onClick={() => { setFormErr(null); setForm({ ...EMPTY }); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Register device
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {(error || data?.error) && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{data?.error ?? (error as Error).message}</p>
      )}
      {!isLoading && !data?.error && groups.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No devices registered yet.</p>
      )}

      {groups.map(([locId, list]) => (
        <section key={locId} className="rounded-2xl border border-border bg-card">
          <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-brand" /> {locName(locId)}
            <span className="text-xs font-normal text-muted-foreground">· {list.length} device(s)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-start">Device</th>
                  <th className="px-4 py-2 text-start">Type</th>
                  <th className="px-4 py-2 text-start">Status</th>
                  <th className="px-4 py-2 text-start">Last activity</th>
                  <th className="px-4 py-2 text-start">Scans (30 days)</th>
                  <th className="px-4 py-2 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{t.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{t.deviceCode}</p>
                    </td>
                    <td className="px-4 py-2.5 capitalize">{t.kind === "both" ? "Face + fingerprint" : t.kind}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${t.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono">{fmt(t.lastSeen)}</td>
                    <td className="px-4 py-2.5">{t.events30d}{t.failed30d > 0 && <span className="text-destructive"> · {t.failed30d} failed</span>}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setActivityOf({ code: t.deviceCode, name: t.name })} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-muted"><Activity className="h-3 w-3" /> Activity</button>
                        <button onClick={() => { setFormErr(null); setForm({ id: t.id, name: t.name, deviceCode: t.deviceCode, kind: t.kind as Form["kind"], locationId: t.locationId ?? "", notes: t.notes ?? "" }); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-muted"><Pencil className="h-3 w-3" /> Edit</button>
                        <button
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ id: t.id, status: t.status === "active" ? "disabled" : "active" })}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 disabled:opacity-50 ${t.status === "active" ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success"}`}
                        >
                          <Power className="h-3 w-3" /> {t.status === "active" ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={(e) => { e.preventDefault(); setFormErr(null); save.mutate(form); }}
            className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{form.id ? "Edit device" : "Register device"}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-xs font-medium">Name<input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main entrance kiosk" /></label>
            <label className="block text-xs font-medium">Device code<input className={`${inp} font-mono`} value={form.deviceCode} onChange={(e) => setForm({ ...form, deviceCode: e.target.value })} placeholder="DEV-XXXX" /></label>
            <label className="block text-xs font-medium">Type
              <select className={inp} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Form["kind"] })}>
                <option value="face">Face</option><option value="fingerprint">Fingerprint</option><option value="both">Face + fingerprint</option>
              </select>
            </label>
            <label className="block text-xs font-medium">Location
              <select className={inp} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                <option value="">Choose a location…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.active ? "" : " (inactive)"}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium">Notes<textarea className={inp} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-border px-3 py-2 text-xs">Cancel</button>
              <button type="submit" disabled={save.isPending} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}

      {activityOf && <ActivityDialog code={activityOf.code} name={activityOf.name} onClose={() => setActivityOf(null)} />}
    </div>
  );
}

function ActivityDialog({ code, name, onClose }: { code: string; name: string; onClose: () => void }) {
  const fn = useServerFn(getBiometricTerminalActivity);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["bio-terminal-activity", code], queryFn: () => fn({ data: { deviceCode: code } }) });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Activity · {name}</h2>
            <p className="font-mono text-xs text-muted-foreground">{code} · last 100 events</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="px-3 py-2 text-start">Time</th><th className="px-3 py-2 text-start">Employee</th><th className="px-3 py-2 text-start">Event</th><th className="px-3 py-2 text-start">Result</th><th className="px-3 py-2 text-start">Reason</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {error && <tr><td colSpan={5} className="px-3 py-6 text-center text-destructive">{(error as Error).message}</td></tr>}
              {!isLoading && !error && data.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No activity recorded for this device.</td></tr>}
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{fmt(a.at)}</td>
                  <td className="px-3 py-2">{a.employee}</td>
                  <td className="px-3 py-2">{a.event} <span className="text-muted-foreground">({a.method})</span></td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 font-medium ${a.success ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>{a.success ? "OK" : "Failed"}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{a.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
