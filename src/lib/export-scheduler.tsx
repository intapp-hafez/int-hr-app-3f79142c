import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getState,
  buildTaskActivityRows,
  rangeForSchedule,
  markScheduleRan,
  recordExportDelivery,
  type ExportSchedule,
  type TaskActivityExportRow,
} from "./store";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}
function hmNow(d: Date) {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function downloadCsv(rows: TaskActivityExportRow[], file: string) {
  const header = ["Time", "Date", "Employee", "Task", "City", "District", "Location", "Action", "Estimated Hours", "Note"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header.join(",")]
    .concat(rows.map((r) => [
      new Date(r.ts).toLocaleString(),
      new Date(r.ts).toISOString().slice(0, 10),
      r.name, r.taskTitle, r.city, r.district, r.where, r.action,
      r.estimatedHours?.toString() ?? "", r.note ?? "",
    ].map((v) => esc(String(v ?? ""))).join(",")))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = file; a.click();
  URL.revokeObjectURL(url);
}
async function downloadXlsx(rows: TaskActivityExportRow[], file: string) {
  // Lazy-load the heavy `xlsx` bundle only when an actual export runs,
  // so admin layout mount doesn't pull ~600KB of parsing code.
  const XLSX = await import("xlsx");
  const data = rows.map((r) => ({
    Time: new Date(r.ts).toLocaleString(),
    Date: new Date(r.ts).toISOString().slice(0, 10),
    Employee: r.name, Task: r.taskTitle,
    City: r.city, District: r.district, Location: r.where,
    Action: r.action, "Estimated Hours": r.estimatedHours ?? "", Note: r.note ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Task Activity");
  XLSX.writeFile(wb, file);
}

export function runSchedule(sch: ExportSchedule, opts?: { manual?: boolean }) {
  const { from, to } = rangeForSchedule(sch.rangeKind);
  const rows = buildTaskActivityRows(from, to, sch.employeeIds);
  const today = isoDay(new Date());
  const file = `${sch.name.replace(/[^\w-]+/g, "_")}-${from}_${to}.${sch.format}`;
  if (rows.length === 0) {
    recordExportDelivery(sch, 0, file, "no_records");
    markScheduleRan(sch.id, today, "no_records");
    if (opts?.manual) toast.message(`No records in range for "${sch.name}"`);
    return;
  }
  const smtp = getState().smtp;
  if (!smtp.enabled || !smtp.host) {
    recordExportDelivery(sch, rows.length, file, "skipped_smtp");
    markScheduleRan(sch.id, today, "skipped_smtp");
    if (opts?.manual) toast.warning(`SMTP is disabled — "${sch.name}" not emailed`);
    return;
  }
  if (sch.format === "csv") downloadCsv(rows, file);
  else void downloadXlsx(rows, file);
  recordExportDelivery(sch, rows.length, file, "sent");
  markScheduleRan(sch.id, today, "sent");
  toast.success(`Auto-export "${sch.name}" sent to ${sch.recipients.length || 1} recipient(s)`);
}

/** Mount once in admin layout. Ticks every 30s and runs due schedules. */
export function useExportScheduler() {
  const lock = useRef(false);
  useEffect(() => {
    const tick = () => {
      if (lock.current) return;
      lock.current = true;
      try {
        const now = new Date();
        const hm = hmNow(now);
        const today = isoDay(now);
        for (const sch of getState().exportSchedules) {
          if (!sch.enabled) continue;
          if (sch.lastRunDate === today) continue;
          if (hm < sch.sendTime) continue;
          runSchedule(sch);
        }
      } finally {
        lock.current = false;
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
}