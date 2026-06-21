import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut, MapPin, Plus, X, Wifi, WifiOff, Radio, ShieldCheck } from "lucide-react";
import { checkIn, checkOut, listMyAttendance, listMyAccess } from "@/backend/functions/attendance.functions";
import { submitLeave, listMyLeaves, cancelLeave } from "@/backend/functions/leaves.functions";
import { Fingerprint, ScanFace } from "lucide-react";
import {
  listMyBiometrics, verifyFace,
  webauthnAuthOptionsForSelf, webauthnAuthVerifyForSelf,
} from "@/backend/functions/biometrics.functions";
import { FaceCapture } from "@/components/biometrics/FaceCapture";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/employee/check")({ component: CheckPage });

function CheckPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Check in / out</h1>
        <p className="text-xs text-muted-foreground">Live attendance and leave requests.</p>
      </header>
      <CheckInOutCard />
      <AllowedAccessCard />
      <AttendanceList />
      <LeavesSection />
    </div>
  );
}

function CheckInOutCard() {
  const qc = useQueryClient();
  const { t, tf, formatBlocked } = useI18n();
  const inFn = useServerFn(checkIn);
  const outFn = useServerFn(checkOut);
  const attFn = useServerFn(listMyAttendance);
  const accessFn = useServerFn(listMyAccess);
  const bioFn = useServerFn(listMyBiometrics);
  const verifyFaceFn = useServerFn(verifyFace);
  const fpOptsFn = useServerFn(webauthnAuthOptionsForSelf);
  const fpVerifyFn = useServerFn(webauthnAuthVerifyForSelf);
  const attQ = useQuery({ queryKey: ["my-attendance"], queryFn: () => attFn() });
  const accessQ = useQuery({ queryKey: ["my-access"], queryFn: () => accessFn() });
  const bioQ = useQuery({ queryKey: ["biometrics"], queryFn: () => bioFn() });
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [note, setNote] = useState("");
  const [branch, setBranch] = useState("HQ");
  const [nearest, setNearest] = useState<{ name: string; distance: number; radius: number; inside: boolean } | null>(null);
  const [showFace, setShowFace] = useState<null | "in" | "out">(null);
  const [verified, setVerified] = useState<{ face: boolean; fp: boolean }>({ face: false, fp: false });

  const hasFace = !!bioQ.data?.face;
  const hasFp = (bioQ.data?.fingerprints?.length ?? 0) > 0;
  const requiresBio = hasFace || hasFp;
  const bioOk = verified.face || verified.fp || !requiresBio;

  const today = new Date().toISOString().slice(0, 10);
  const todayRow: any = ((attQ.data as any[]) ?? []).find((a) => a.date === today);
  const hasCheckedIn = !!todayRow?.in_time;
  const hasCheckedOut = !!todayRow?.out_time;

  async function getCoords(): Promise<{ lat?: number; lng?: number; err?: string }> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return { err: t("geolocNotSupported") };
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => resolve({ err: e.message }),
        { timeout: 8000, enableHighAccuracy: true },
      );
    });
  }

  async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; district?: string; street?: string }> {
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
      if (!r.ok) return {};
      const j: any = await r.json();
      return {
        city: j.city || j.locality || j.principalSubdivision || undefined,
        district: j.localityInfo?.administrative?.find((a: any) => a.adminLevel >= 6)?.name || j.locality || undefined,
        street: [j.streetNumber, j.streetName].filter(Boolean).join(" ") || j.localityInfo?.informative?.[0]?.name || undefined,
      };
    } catch { return {}; }
  }

  function distMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function computeNearest(lat: number, lng: number) {
    const locs: any[] = (accessQ.data as any)?.locations ?? [];
    if (!locs.length) return null;
    let best: { name: string; distance: number; radius: number; inside: boolean } | null = null;
    for (const l of locs) {
      const d = distMeters(lat, lng, l.lat, l.lng);
      if (!best || d < best.distance) best = { name: l.name, distance: d, radius: l.radius_m, inside: d <= l.radius_m };
    }
    return best;
  }

  async function go(kind: "in" | "out") {
    if (requiresBio && !bioOk) {
      toast.error(t("verifyBiometricFirst"));
      return;
    }
    setBusy(kind);
    try {
      const coords = await getCoords();
      if (coords.err) { toast.error(tf("locationError", { msg: coords.err })); }
      let near: typeof nearest = null;
      if (coords.lat != null && coords.lng != null) {
        near = computeNearest(coords.lat, coords.lng);
        setNearest(near);
        if (near) {
          const msg = near.inside
            ? `Inside "${near.name}" (${Math.round(near.distance)} m / ${near.radius} m)`
            : `Nearest: "${near.name}" — ${Math.round(near.distance)} m away (allowed ${near.radius} m)`;
          toast.message(msg);
        }
      }
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      const geo = coords.lat != null && coords.lng != null ? await reverseGeocode(coords.lat, coords.lng) : {};
      const payload = { branch, lat: coords.lat, lng: coords.lng, network_ok: online, note: note.trim() || undefined, ...geo };
      const addr = [geo.street, geo.district, geo.city].filter(Boolean).join(", ");
      if (kind === "in") {
        const res: any = await inFn({ data: payload });
        if (res?.blocked) { toast.error(formatBlocked(res)); return; }
        toast.success(`${res?.free_check ? "Checked in (free)" : "Checked in"}${addr ? ` · ${addr}` : ""}`);
      } else {
        const res: any = await outFn({ data: payload });
        if (res?.blocked) { toast.error(formatBlocked(res)); return; }
        toast.success(`Checked out${addr ? ` · ${addr}` : ""}`);
      }
      setNote("");
      setVerified({ face: false, fp: false });
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function verifyFingerprint() {
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const options = await fpOptsFn();
      const assertion = await startAuthentication({ optionsJSON: options as any });
      await fpVerifyFn({ data: { response: assertion } });
      setVerified((v) => ({ ...v, fp: true }));
      toast.success("Fingerprint verified");
    } catch (e: any) {
      toast.error(e?.message ?? "Fingerprint verification failed");
    }
  }

  async function handleFaceCapture(descriptor: number[]) {
    const res = await verifyFaceFn({ data: { descriptor } });
    if (res.match) {
      setVerified((v) => ({ ...v, face: true }));
      toast.success(`Face verified (distance ${res.distance?.toFixed(3)})`);
      setShowFace(null);
    } else {
      toast.error(`Face did not match${res.distance != null ? ` (distance ${res.distance.toFixed(3)})` : ""}`);
    }
  }

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Location and network will be recorded.
        {online ? <span className="ml-auto inline-flex items-center gap-1 text-success"><Wifi className="h-3.5 w-3.5" /> Online</span>
                : <span className="ml-auto inline-flex items-center gap-1 text-destructive"><WifiOff className="h-3.5 w-3.5" /> Offline</span>}
      </div>
      {nearest && (
        <div className={`rounded-xl px-3 py-2 text-xs ${nearest.inside ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          <span className="font-semibold">{nearest.inside ? "Inside fence" : "Outside fence"}:</span>{" "}
          {nearest.name} · {Math.round(nearest.distance)} m {nearest.inside ? "from center" : "away"} (allowed {nearest.radius} m)
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
        <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button disabled={busy !== null || hasCheckedIn} onClick={() => go("in")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
          <LogIn className="h-4 w-4" /> {busy === "in" ? "Checking in…" : hasCheckedIn ? "Checked in" : "Check in"}
        </button>
        <button disabled={busy !== null || !hasCheckedIn || hasCheckedOut} onClick={() => go("out")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-sm font-semibold disabled:opacity-60">
          <LogOut className="h-4 w-4" /> {busy === "out" ? "Checking out…" : hasCheckedOut ? "Checked out" : "Check out"}
        </button>
      </div>
      {requiresBio && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Biometric verification {bioOk ? "· ✓ verified" : "required"}
          </p>
          <div className="flex flex-wrap gap-2">
            {hasFace && (
              <button
                onClick={() => setShowFace("in")}
                disabled={verified.face}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                  verified.face ? "bg-success/20 text-success" : "bg-gradient-brand text-brand-foreground shadow-brand"
                }`}
              >
                <ScanFace className="h-3.5 w-3.5" /> {verified.face ? "Face verified" : "Verify face"}
              </button>
            )}
            {hasFp && (
              <button
                onClick={verifyFingerprint}
                disabled={verified.fp}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                  verified.fp ? "bg-success/20 text-success" : "bg-gradient-brand text-brand-foreground shadow-brand"
                }`}
              >
                <Fingerprint className="h-3.5 w-3.5" /> {verified.fp ? "Fingerprint verified" : "Verify fingerprint"}
              </button>
            )}
          </div>
        </div>
      )}
      {(hasCheckedIn || hasCheckedOut) && (
        <p className="text-[11px] text-muted-foreground">
          Only one check-in and one check-out are allowed per day.
        </p>
      )}
      {showFace && (
        <FaceCapture mode="verify" onCapture={handleFaceCapture} onClose={() => setShowFace(null)} />
      )}
    </section>
  );
}

function AllowedAccessCard() {
  const accessFn = useServerFn(listMyAccess);
  const q = useQuery({ queryKey: ["my-access"], queryFn: () => accessFn() });
  const locations = (q.data as any)?.locations ?? [];
  const networks = (q.data as any)?.networks ?? [];
  const empty = !q.isLoading && locations.length === 0 && networks.length === 0;
  return (
    <section className="rounded-3xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand" />
        <h2 className="font-display text-sm font-semibold">Allowed locations & networks</h2>
      </div>
      {empty && (
        <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          No assignments yet — you can check in from anywhere.
        </p>
      )}
      {locations.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Locations</p>
          <ul className="space-y-2">
            {locations.map((l: any) => (
              <li key={l.id} className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                <MapPin className="mt-0.5 h-4 w-4 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {l.lat.toFixed(5)}, {l.lng.toFixed(5)} · radius {l.radius_m} m
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {networks.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Networks</p>
          <ul className="space-y-2">
            {networks.map((n: any) => (
              <li key={n.id} className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                <Radio className="mt-0.5 h-4 w-4 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{n.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {n.ssid ? `SSID: ${n.ssid}` : "any SSID"}{n.bssid ? ` · BSSID: ${n.bssid}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AttendanceList() {
  const list = useServerFn(listMyAttendance);
  const q = useQuery({ queryKey: ["my-attendance"], queryFn: () => list() });
  return (
    <section>
      <h2 className="mb-2 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent</h2>
      {q.error && <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{(q.error as Error).message}</p>}
      <ul className="space-y-2">
        {(q.data ?? []).slice(0, 10).map((a: any) => (
          <li key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{a.date}</p>
              <p className="text-[11px] text-muted-foreground">
                {a.in_time ? new Date(a.in_time).toLocaleTimeString() : "—"} → {a.out_time ? new Date(a.out_time).toLocaleTimeString() : "—"}
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">{a.status}</span>
          </li>
        ))}
        {(q.data ?? []).length === 0 && !q.isLoading && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No records yet</li>
        )}
      </ul>
    </section>
  );
}

function LeavesSection() {
  const qc = useQueryClient();
  const list = useServerFn(listMyLeaves);
  const submit = useServerFn(submitLeave);
  const cancel = useServerFn(cancelLeave);
  const q = useQuery({ queryKey: ["my-leaves"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const mC = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-leaves"] }); toast.success("Cancelled"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">My leaves</h2>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand">
          <Plus className="h-3.5 w-3.5" /> Request
        </button>
      </div>
      {q.error && <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{(q.error as Error).message}</p>}
      <ul className="space-y-2">
        {(q.data ?? []).map((l: any) => (
          <li key={l.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{l.leave_type_name ?? "Leave"}</p>
                <p className="text-xs text-muted-foreground">{l.start_date} → {l.end_date} • {l.days}d</p>
                {l.reason && <p className="mt-1 text-[11px] italic text-muted-foreground">"{l.reason}"</p>}
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">{l.status}</span>
            </div>
            {l.status === "pending" && (
              <button onClick={() => mC.mutate(l.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                <X className="h-3 w-3" /> Cancel request
              </button>
            )}
          </li>
        ))}
        {(q.data ?? []).length === 0 && !q.isLoading && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No leave requests</li>
        )}
      </ul>
      {open && <LeaveModal onClose={() => setOpen(false)} onSubmit={async (d) => {
        try { await submit({ data: d }); toast.success("Submitted"); qc.invalidateQueries({ queryKey: ["my-leaves"] }); setOpen(false); }
        catch (e) { toast.error((e as Error).message); }
      }} />}
    </section>
  );
}

function LeaveModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: { leave_type_name: string; start_date: string; end_date: string; days: number; paid: boolean; reason?: string }) => Promise<void> }) {
  const [type, setType] = useState("Annual Leave");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [paid, setPaid] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  function days(a: string, b: string) {
    if (!a || !b) return 0;
    return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start || !end) return setErr("Start and end required");
    if (new Date(end) < new Date(start)) return setErr("End before start");
    await onSubmit({ leave_type_name: type, start_date: start, end_date: end, days: days(start, end), paid, reason: reason.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">New leave request</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <input className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" value={type} onChange={(e) => setType(e.target.value)} placeholder="Leave type" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
            <input required type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Paid</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" placeholder="Reason (optional)" />
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
          <button className="w-full rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand">Submit</button>
        </form>
      </div>
    </div>
  );
}