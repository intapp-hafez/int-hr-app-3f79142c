import { createFileRoute } from "@tanstack/react-router";
import { Download, Upload, FileDown, FileText, Printer, Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";
import { useRef, useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import {
  adminListAttendance,
  adminUpsertAttendance,
  adminDeleteAttendance,
  listEmployeesForAttendance,
  adminReverseGeocode,
} from "@/backend/functions/attendance.functions";
import { AdminAttendanceSchema } from "@/backend/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeafletMap } from "@/components/LeafletMap";
import { listAllGeofences } from "@/backend/functions/network-assignments.functions";
import { EgyptMap } from "@/components/admin/EgyptMap";

export const Route = createFileRoute("/admin/attendance")({
  component: AdminAttendance,
});

const tone: Record<string, string> = {
  present: "bg-success/15 text-success",
  late: "bg-warning/20 text-warning-foreground",
  leave: "bg-info/15 text-info",
  absent: "bg-destructive/15 text-destructive",
};

const STATUSES = ["present", "late", "absent", "leave"] as const;
type Status = (typeof STATUSES)[number];

function toHM(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function calcHours(inIso?: string | null, outIso?: string | null): string {
  if (!inIso || !outIso) return "—";
  const a = new Date(inIso).getTime();
  const b = new Date(outIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const mins = Math.round((b - a) / 60000);
  if (mins < 0) return "—";
  return `${Math.floor(mins / 60)}h ${(mins % 60).toString().padStart(2, "0")}m`;
}

function distMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type Fence = { id: string; name: string; lat: number; lng: number; radius_m: number; active: boolean };

function nearestFence(
  lat: number | null | undefined,
  lng: number | null | undefined,
  fences: Fence[],
): { inside: boolean; name: string; distance: number; radius: number } | null {
  if (lat == null || lng == null || !fences.length) return null;
  let best: { inside: boolean; name: string; distance: number; radius: number } | null = null;
  for (const f of fences) {
    if (!f.active) continue;
    const d = distMeters(lat, lng, f.lat, f.lng);
    if (!best || d < best.distance) {
      best = { inside: d <= f.radius_m, name: f.name, distance: d, radius: f.radius_m };
    }
  }
  return best;
}

function FenceBadge({ check }: { check: ReturnType<typeof nearestFence> }) {
  if (!check) {
    return (
      <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        No GPS
      </span>
    );
  }
  return check.inside ? (
    <span
      title={`${check.name} · ${Math.round(check.distance)} m / ${check.radius} m`}
      className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-success"
    >
      Inside · {check.name}
    </span>
  ) : (
    <span
      title={`Nearest ${check.name} · ${Math.round(check.distance)} m away (allowed ${check.radius} m)`}
      className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-destructive"
    >
      Outside · {Math.round(check.distance)} m
    </span>
  );
}

// In-memory reverse-geocode cache (lat,lng → label).
const geoCache = new Map<string, string>();
const geoInflight = new Map<string, Promise<string>>();

function geoKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function looksLikeCoordinates(value: string) {
  return /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(value.trim());
}

function storedPlaceName(...parts: Array<string | null | undefined>) {
  const label = parts
    .map((part) => part?.trim())
    .filter((part): part is string => !!part && !looksLikeCoordinates(part) && !/^-?\d{1,3}(?:\.\d+)?$/.test(part))
    .join(", ");
  return label && !looksLikeCoordinates(label) ? label : "";
}

async function reverseGeocode(lat: number, lng: number, lookup: (args: { data: { lat: number; lng: number } }) => Promise<string>): Promise<string> {
  const k = geoKey(lat, lng);
  if (geoCache.has(k)) return geoCache.get(k)!;
  if (geoInflight.has(k)) return geoInflight.get(k)!;
  const p = (async () => {
    try {
      const out = await lookup({ data: { lat, lng } });
      geoCache.set(k, out);
      return out;
    } catch {
      const fallback = "Location name unavailable";
      geoCache.set(k, fallback);
      return fallback;
    } finally {
      geoInflight.delete(k);
    }
  })();
  geoInflight.set(k, p);
  return p;
}

function AddressFromCoords({ lat, lng, lookup }: { lat: number; lng: number; lookup: (args: { data: { lat: number; lng: number } }) => Promise<string> }) {
  const k = geoKey(lat, lng);
  const [label, setLabel] = useState<string>(geoCache.get(k) ?? "");
  useEffect(() => {
    let alive = true;
    if (!geoCache.has(k)) {
      reverseGeocode(lat, lng, lookup).then((v) => {
        if (alive) setLabel(v);
      });
    } else {
      setLabel(geoCache.get(k)!);
    }
    return () => {
      alive = false;
    };
  }, [k, lat, lng, lookup]);
  return <span>{label || "Locating…"}</span>;
}

function LocationName({ place, lat, lng, lookup }: { place: string; lat?: number | null; lng?: number | null; lookup: (args: { data: { lat: number; lng: number } }) => Promise<string> }) {
  if (place) return <span>{place}</span>;
  if (lat != null && lng != null) return <AddressFromCoords lat={lat} lng={lng} lookup={lookup} />;
  return null;
}

type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  in_time: string | null;
  out_time: string | null;
  branch: string | null;
  status: string;
  note: string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  free_check?: boolean;
  lat?: number | null;
  lng?: number | null;
  out_lat?: number | null;
  out_lng?: number | null;
  out_city?: string | null;
  out_district?: string | null;
  out_street?: string | null;
};

type FormState = {
  id?: string;
  employee_id: string;
  date: string;
  in_time: string;
  out_time: string;
  branch: string;
  status: Status;
  note: string;
};

const blankForm = (): FormState => ({
  employee_id: "",
  date: new Date().toISOString().slice(0, 10),
  in_time: "",
  out_time: "",
  branch: "",
  status: "present",
  note: "",
});

type TaskActivityRow = { ts: number; employeeId: string; name: string; taskTitle: string; where: string; action: string; note?: string; estimatedHours?: number; city?: string; district?: string };

function exportTaskActivityCsv(rows: TaskActivityRow[]) {
  const header = ["Time", "Date", "Employee", "Task", "City", "District", "Location", "Action", "Estimated Hours", "Note"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header.join(",")]
    .concat(rows.map((r) => [
      new Date(r.ts).toLocaleString(),
      new Date(r.ts).toISOString().slice(0, 10),
      r.name, r.taskTitle, r.city ?? "", r.district ?? "", r.where, r.action,
      r.estimatedHours?.toString() ?? "", r.note ?? "",
    ].map((v) => escape(String(v ?? ""))).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `task-activity-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
function exportTaskActivityXlsx(rows: TaskActivityRow[]) {
  const data = rows.map((r) => ({
    Time: new Date(r.ts).toLocaleString(), Date: new Date(r.ts).toISOString().slice(0, 10),
    Employee: r.name, Task: r.taskTitle, City: r.city ?? "", District: r.district ?? "",
    Location: r.where, Action: r.action, "Estimated Hours": r.estimatedHours ?? "", Note: r.note ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Task Activity");
  XLSX.writeFile(wb, `task-activity-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function printTaskActivityPdf(rows: TaskActivityRow[], title: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = rows.map((r) => `<tr><td>${new Date(r.ts).toLocaleString()}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.taskTitle)}</td><td>${escapeHtml(r.where)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(r.note ?? "")}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(title)}</h1><table><thead><tr><th>Time</th><th>Employee</th><th>Task</th><th>Location</th><th>Action</th><th>Note</th></tr></thead><tbody>${body || `<tr><td colspan="6" style="text-align:center">No records</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

function exportAttendanceCsv(rows: AttendanceRow[]) {
  const header = ["Employee", "Date", "Check In", "Check Out", "Total", "Branch", "Location", "Status", "Note"];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(",")].concat(rows.map((r) => [
    r.employee_name, r.date, toHM(r.in_time), toHM(r.out_time), calcHours(r.in_time, r.out_time),
    r.branch ?? "", [r.street, r.district, r.city].filter(Boolean).join(", "), r.status, r.note ?? "",
  ].map(esc).join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
function printAttendancePdf(rows: AttendanceRow[], title: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = rows.map((r) => `<tr><td>${escapeHtml(r.employee_name)}</td><td>${r.date}</td><td>${toHM(r.in_time)}</td><td>${toHM(r.out_time)}</td><td>${calcHours(r.in_time, r.out_time)}</td><td>${escapeHtml(r.branch ?? "")}</td><td>${escapeHtml([r.street, r.district, r.city].filter(Boolean).join(", "))}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.note ?? "")}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f5f5f5}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(title)}</h1><table><thead><tr><th>Employee</th><th>Date</th><th>In</th><th>Out</th><th>Total</th><th>Branch</th><th>Location</th><th>Status</th><th>Note</th></tr></thead><tbody>${body || `<tr><td colspan="9" style="text-align:center">No records</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

function AdminAttendance() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const tasks = useStore((s) => s.tasks);

  const listFn = useServerFn(adminListAttendance);
  const upsertFn = useServerFn(adminUpsertAttendance);
  const delFn = useServerFn(adminDeleteAttendance);
  const empFn = useServerFn(listEmployeesForAttendance);
  const reverseGeocodeFn = useServerFn(adminReverseGeocode);

  const todayIso = new Date().toISOString().slice(0, 10);
  // Show a wide default window so existing records are visible immediately.
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(yearAgo);
  const [toDate, setToDate] = useState(todayIso);
  const [empFilter, setEmpFilter] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState<string | null>(null);

  // Live map controls
  const [liveOn, setLiveOn] = useState(false);
  const [refreshSec, setRefreshSec] = useState(15);
  const [mapZoom, setMapZoom] = useState(6);

  const empQ = useQuery({ queryKey: ["admin", "attendance", "employees"], queryFn: () => empFn() });
  const employees = empQ.data ?? [];
  const empName = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e.name])), [employees]);

  const queryKey = ["admin", "attendance", { from: fromDate, to: toDate, emp: empFilter }] as const;
  const listQ = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { from: fromDate, to: toDate, employeeIds: empFilter === "all" ? undefined : [empFilter] } }),
    refetchInterval: liveOn ? refreshSec * 1000 : false,
  });
  const rows: AttendanceRow[] = (listQ.data as AttendanceRow[] | undefined) ?? [];

  const geosFn = useServerFn(listAllGeofences);
  const geosQ = useQuery({ queryKey: ["admin", "attendance", "geofences"], queryFn: () => geosFn() });
  const fences = (geosQ.data ?? []) as Array<{ id: string; name: string; lat: number; lng: number; radius_m: number; active: boolean }>;

  const points = useMemo(
    () =>
      rows
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => ({
          id: r.id,
          lat: r.lat as number,
          lng: r.lng as number,
          label: `${r.employee_name} · ${r.date} ${toHM(r.in_time)}`,
          color: r.free_check ? "#f59e0b" : "#2563eb",
        })),
    [rows],
  );

  const upsertM = useMutation({
    mutationFn: (f: FormState) => upsertFn({
      data: {
        id: f.id,
        employee_id: f.employee_id,
        date: f.date,
        in_time: f.in_time || null,
        out_time: f.out_time || null,
        branch: f.branch || null,
        status: f.status,
        note: f.note || null,
      },
    }),
    onSuccess: () => {
      toast.success(form.id ? "Updated" : "Saved");
      qc.invalidateQueries({ queryKey: ["admin", "attendance"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "attendance"] });
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function openAdd() { setForm(blankForm()); setErrs({}); setOpen(true); }
  function openEdit(r: AttendanceRow) {
    setForm({
      id: r.id, employee_id: r.employee_id, date: r.date,
      in_time: toHM(r.in_time) === "—" ? "" : toHM(r.in_time),
      out_time: toHM(r.out_time) === "—" ? "" : toHM(r.out_time),
      branch: r.branch ?? "", status: (r.status as Status) ?? "present", note: r.note ?? "",
    });
    setErrs({}); setOpen(true);
  }
  function submit() {
    const payload = {
      id: form.id, employee_id: form.employee_id, date: form.date,
      in_time: form.in_time || null, out_time: form.out_time || null,
      branch: form.branch || null, status: form.status, note: form.note || null,
    };
    const r = AdminAttendanceSchema.safeParse(payload);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => { const k = i.path[0] as string; if (k && !e[k]) e[k] = i.message; });
      setErrs(e); return;
    }
    setErrs({}); upsertM.mutate(form);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["employee_id", "date", "in_time", "out_time", "branch", "status", "note"],
      ["<uuid>", "2026-05-29", "08:32", "17:18", "Cairo HQ", "present", ""],
    ]);
    ws["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, "attendance-template.xlsx");
  }
  function exportXlsx() {
    const data = rows.map((r) => ({
      employee_id: r.employee_id,
      employee: r.employee_name,
      date: r.date,
      in_time: toHM(r.in_time),
      out_time: toHM(r.out_time),
      total: calcHours(r.in_time, r.out_time),
      branch: r.branch ?? "",
      status: r.status,
      note: r.note ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      let ok = 0, bad = 0;
      for (const r of json) {
        const dateVal = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date ?? "").trim();
        const payload = {
          employee_id: String(r.employee_id ?? "").trim(),
          date: dateVal,
          in_time: String(r.in_time ?? "").trim() || null,
          out_time: String(r.out_time ?? "").trim() || null,
          branch: String(r.branch ?? "").trim() || null,
          status: (STATUSES as readonly string[]).includes(String(r.status)) ? (String(r.status) as Status) : "present",
          note: String(r.note ?? "").trim() || null,
        };
        const parsed = AdminAttendanceSchema.safeParse(payload);
        if (!parsed.success) { bad++; continue; }
        try { await upsertFn({ data: payload }); ok++; } catch { bad++; }
      }
      toast.success(`Imported ${ok} record(s)`, { description: bad ? `${bad} invalid/failed` : undefined });
      qc.invalidateQueries({ queryKey: ["admin", "attendance"] });
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Task activity (still from local store) ──
  const allActivity = useMemo(
    () => tasks.flatMap((tk: any) =>
      (tk.history ?? []).map((h: any) => ({
        ts: h.ts, employeeId: h.by,
        name: empName[h.by] ?? h.by,
        taskTitle: tk.title, city: tk.city ?? "", district: tk.district ?? "",
        where: [tk.district, tk.address].filter(Boolean).join(" — ") || tk.address || "—",
        action: h.to === "in_progress" ? t("taskCheckIn") : h.to === "done" ? t("taskCheckOut") : h.to,
        note: h.note, estimatedHours: tk.estimatedHours,
      })),
    ).sort((a: any, b: any) => b.ts - a.ts) as TaskActivityRow[],
    [tasks, empName, t],
  );
  const taskActivity = useMemo(() => allActivity.filter((r) => {
    const iso = new Date(r.ts).toISOString().slice(0, 10);
    if (iso < fromDate || iso > toDate) return false;
    if (empFilter !== "all" && r.employeeId !== empFilter) return false;
    return true;
  }), [allActivity, fromDate, toDate, empFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("attendance")} log</h1>
          <p className="text-sm text-muted-foreground">DB-backed check-in & check-out records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm"><FileDown className="h-4 w-4" /> {t("downloadTemplate")}</button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand"><Upload className="h-4 w-4" /> {t("import")}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
          <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm"><Download className="h-4 w-4" /> {t("export")} XLSX</button>
          <button onClick={() => exportAttendanceCsv(rows)} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm disabled:opacity-50"><FileText className="h-4 w-4" /> CSV</button>
          <button onClick={() => printAttendancePdf(rows, "Attendance")} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-sm font-semibold text-background disabled:opacity-50"><Printer className="h-4 w-4" /> PDF</button>
          <Button onClick={openAdd} className="rounded-full"><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </div>

      <Tabs defaultValue="records" className="space-y-5">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="map">Live map</TabsTrigger>
          <TabsTrigger value="tasks">Task activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <EgyptMap />
        </TabsContent>

        <TabsContent value="records" className="space-y-5">
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>From</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>To</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>{t("filterEmployee")}</span>
          <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm">
            <option value="all">{t("all")}</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} records</span>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("date")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("checkIn") || "Check In"}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("checkOut") || "Check Out"}</th>
                  <th className="px-4 py-3 text-start font-medium">Total</th>
                  <th className="px-4 py-3 text-start font-medium">{t("location") || "Location"}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {listQ.isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No records in range.</td></tr>
                ) : rows.map((row) => {
                  const checkInPlace = storedPlaceName(row.street, row.district, row.city);
                  const checkOutPlace = storedPlaceName(row.out_street, row.out_district, row.out_city);
                  return (
                  <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{row.employee_name}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.date}</td>
                    <td className="px-4 py-3 font-mono tabular-nums align-top">
                      <div className="flex flex-col">
                        <span>{toHM(row.in_time)}</span>
                        {(checkInPlace || (row.lat != null && row.lng != null)) && (
                          <span className="text-[11px] text-muted-foreground font-sans">
                            <LocationName place={checkInPlace} lat={row.lat} lng={row.lng} lookup={reverseGeocodeFn} />
                          </span>
                        )}
                        {row.in_time && (
                          row.free_check
                            ? <span className="mt-0.5 inline-flex w-fit rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warning-foreground">Free check-in</span>
                            : <FenceBadge check={nearestFence(row.lat, row.lng, fences)} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums align-top">
                      <div className="flex flex-col">
                        <span>{toHM(row.out_time)}</span>
                        {(checkOutPlace || (row.out_lat != null && row.out_lng != null)) && (
                          <span className="text-[11px] text-muted-foreground font-sans">
                            <LocationName place={checkOutPlace} lat={row.out_lat} lng={row.out_lng} lookup={reverseGeocodeFn} />
                          </span>
                        )}
                        {row.out_time && (
                          row.free_check
                            ? <span className="mt-0.5 inline-flex w-fit rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warning-foreground">Free check-out</span>
                            : <FenceBadge check={nearestFence(row.out_lat, row.out_lng, fences)} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{calcHours(row.in_time, row.out_time)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm">{row.branch ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone[row.status] ?? "bg-muted text-muted-foreground"}`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button onClick={() => openEdit(row)} className="me-1 grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDelId(row.id)} className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="map" className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-display text-base font-semibold">Live attendance map</h2>
            <p className="text-xs text-muted-foreground">
              Approved geofences (orange circles) and check-in GPS points.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" /> Inside fence / authorized</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /> Free check-in</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#ea580c]" /> Geofence</span>
          </div>
        </header>
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={liveOn} onChange={(e) => setLiveOn(e.target.checked)} className="h-4 w-4 accent-brand" />
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${liveOn ? "animate-pulse bg-success" : "bg-muted-foreground/40"}`} />
              Real-time
            </span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span>Refresh</span>
            <select
              value={refreshSec}
              onChange={(e) => setRefreshSec(Number(e.target.value))}
              disabled={!liveOn}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
            </select>
          </label>
          <div className="ml-auto inline-flex items-center gap-2 text-muted-foreground">
            <span>Zoom</span>
            <button onClick={() => setMapZoom((z) => Math.max(3, z - 1))} className="grid h-6 w-6 place-items-center rounded-md border border-input bg-background font-bold">−</button>
            <input type="range" min={3} max={18} value={mapZoom} onChange={(e) => setMapZoom(Number(e.target.value))} className="w-32 accent-brand" />
            <button onClick={() => setMapZoom((z) => Math.min(18, z + 1))} className="grid h-6 w-6 place-items-center rounded-md border border-input bg-background font-bold">+</button>
            <span className="w-6 text-center font-mono tabular-nums">{mapZoom}</span>
          </div>
          {listQ.isFetching && liveOn && (
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> updating</span>
          )}
        </div>
        <LeafletMap
          markers={fences.map((f) => ({
            id: f.id, name: f.name, lat: f.lat, lng: f.lng, radius: f.radius_m, active: f.active,
          }))}
          points={points}
          height={420}
          zoom={mapZoom}
        />
          </section>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-5">
          <section className="rounded-3xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">{t("taskActivityToday")}</h2>
                  <p className="text-xs text-muted-foreground">{t("taskActivitySubtitle")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => exportTaskActivityCsv(taskActivity)} disabled={!taskActivity.length} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold disabled:opacity-50"><FileText className="h-3.5 w-3.5" /> {t("exportCsv")}</button>
                  <button onClick={() => exportTaskActivityXlsx(taskActivity)} disabled={!taskActivity.length} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold disabled:opacity-50"><FileDown className="h-3.5 w-3.5" /> {t("exportXlsx")}</button>
                  <button onClick={() => printTaskActivityPdf(taskActivity, t("taskActivityToday"))} disabled={!taskActivity.length} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"><Printer className="h-3.5 w-3.5" /> {t("exportPdf")}</button>
                </div>
              </div>
            </header>
            {taskActivity.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("noActivityInRange")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("date")} / {t("tripTime")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("rowTitle")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("taskLocation")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {taskActivity.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{new Date(row.ts).toLocaleString()}</td>
                      <td className="px-4 py-3">{row.taskTitle}{row.estimatedHours ? <span className="ms-1 text-[10px] text-muted-foreground">({row.estimatedHours}{t("hoursShort")})</span> : null}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{row.where}</span></td>
                      <td className="px-4 py-3"><span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">{row.action}</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{row.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit attendance" : "Add attendance"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employee</Label>
              <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm">
                <option value="">Select…</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {errs.employee_id && <p className="text-xs text-destructive">{errs.employee_id}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />{errs.date && <p className="text-xs text-destructive">{errs.date}</p>}</div>
              <div className="col-span-1"><Label>In</Label><Input type="time" value={form.in_time} onChange={(e) => setForm({ ...form, in_time: e.target.value })} />{errs.in_time && <p className="text-xs text-destructive">{errs.in_time}</p>}</div>
              <div className="col-span-1"><Label>Out</Label><Input type="time" value={form.out_time} onChange={(e) => setForm({ ...form, out_time: e.target.value })} />{errs.out_time && <p className="text-xs text-destructive">{errs.out_time}</p>}</div>
            </div>
            <div><Label>Branch</Label><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} maxLength={120} /></div>
            <div>
              <Label>Status</Label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={upsertM.isPending}>{upsertM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {form.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete attendance record?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (delId) deleteM.mutate(delId); }} disabled={deleteM.isPending}>{deleteM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
