import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut, MapPin, Plus, X, Wifi, WifiOff } from "lucide-react";
import { checkIn, checkOut, listMyAttendance } from "@/backend/functions/attendance.functions";
import { submitLeave, listMyLeaves, cancelLeave } from "@/backend/functions/leaves.functions";

export const Route = createFileRoute("/employee/check")({ component: CheckPage });

function CheckPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Check in / out</h1>
        <p className="text-xs text-muted-foreground">Live attendance and leave requests.</p>
      </header>
      <CheckInOutCard />
      <AttendanceList />
      <LeavesSection />
    </div>
  );
}

function CheckInOutCard() {
  const qc = useQueryClient();
  const inFn = useServerFn(checkIn);
  const outFn = useServerFn(checkOut);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [note, setNote] = useState("");
  const [branch, setBranch] = useState("HQ");

  async function getCoords(): Promise<{ lat?: number; lng?: number; err?: string }> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return { err: "Geolocation not supported" };
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

  async function go(kind: "in" | "out") {
    setBusy(kind);
    try {
      const coords = await getCoords();
      if (coords.err) { toast.error(`Location error: ${coords.err}`); }
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      const geo = coords.lat != null && coords.lng != null ? await reverseGeocode(coords.lat, coords.lng) : {};
      const payload = { branch, lat: coords.lat, lng: coords.lng, network_ok: online, note: note.trim() || undefined, ...geo };
      if (kind === "in") {
        const res: any = await inFn({ data: payload });
        toast.success(res?.free_check ? "Checked in (free)" : "Checked in");
      } else {
        await outFn({ data: payload });
        toast.success("Checked out");
      }
      setNote("");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
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
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
        <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button disabled={busy !== null} onClick={() => go("in")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
          <LogIn className="h-4 w-4" /> {busy === "in" ? "Checking in…" : "Check in"}
        </button>
        <button disabled={busy !== null} onClick={() => go("out")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-sm font-semibold disabled:opacity-60">
          <LogOut className="h-4 w-4" /> {busy === "out" ? "Checking out…" : "Check out"}
        </button>
      </div>
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