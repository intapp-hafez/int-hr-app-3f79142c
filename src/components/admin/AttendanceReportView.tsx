import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Printer, Loader2 } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { formatDate } from "@/lib/date-format";
import { adminAttendanceReport, type AttendanceReportRow } from "@/backend/functions/attendance.functions";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function time(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function deviceClass(s: string) {
  return s === "approved"
    ? "text-success"
    : s === "pending"
      ? "text-warning-foreground"
      : "text-destructive";
}

export function AttendanceReportView() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));

  // Guard against a swapped range (e.g. picking "to" before "from").
  const rangeFrom = from <= to ? from : to;
  const rangeTo = from <= to ? to : from;

  const reportFn = useServerFn(adminAttendanceReport);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin", "attendance-report", rangeFrom, rangeTo],
    queryFn: () => reportFn({ data: { from: rangeFrom, to: rangeTo } }),
  });

  const byDept = useMemo(() => {
    const m = new Map<string, AttendanceReportRow[]>();
    for (const r of rows as AttendanceReportRow[]) {
      const list = m.get(r.department) ?? [];
      list.push(r);
      m.set(r.department, list);
    }
    return Array.from(m.entries())
      .map(([dept, list]) => [dept, list.sort((a, b) => a.employee_name.localeCompare(b.employee_name) || a.date.localeCompare(b.date))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Attendance Report</h2>
          <p className="text-sm text-muted-foreground">
            Check-ins, check-outs and device status, grouped by department.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            From
            <DateInput value={from} onChange={setFrom} className="mt-1 w-40" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            To
            <DateInput value={to} onChange={setTo} className="mt-1 w-40" />
          </label>
          <button
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-brand-foreground shadow-brand cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          {(error as Error).message}
        </p>
      )}

      <div id="hr-doc-print-area" className="space-y-6 rounded-2xl border border-border bg-card p-6">
        <div className="text-center">
          <h3 className="text-lg font-bold">Attendance Report</h3>
          <p className="text-sm text-muted-foreground">
            {formatDate(rangeFrom)} — {formatDate(rangeTo)}
          </p>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
          </p>
        ) : byDept.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records in this period.</p>
        ) : (
          byDept.map(([dept, list]) => (
            <section key={dept} className="break-inside-avoid space-y-2">
              <h3 className="border-b border-border pb-1 text-sm font-bold uppercase tracking-wider">
                {dept} <span className="font-normal text-muted-foreground">· {list.length} records</span>
              </h3>
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-1.5">Code</th>
                    <th className="py-1.5">Employee</th>
                    <th className="py-1.5">Date</th>
                    <th className="py-1.5">Check-in</th>
                    <th className="py-1.5">Check-out</th>
                    <th className="py-1.5">Status</th>
                    <th className="py-1.5">Branch</th>
                    <th className="py-1.5">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, i) => (
                    <tr key={`${r.employee_id}-${r.date}-${i}`} className="border-t border-border">
                      <td className="py-1.5 font-mono">{r.emp_code ?? "—"}</td>
                      <td className="py-1.5 font-medium">{r.employee_name}</td>
                      <td className="py-1.5 font-mono">{formatDate(r.date)}</td>
                      <td className="py-1.5 font-mono">{time(r.in_time)}</td>
                      <td className="py-1.5 font-mono">{time(r.out_time)}</td>
                      <td className="py-1.5 capitalize">{r.status}</td>
                      <td className="py-1.5">{r.branch ?? "—"}</td>
                      <td className={`py-1.5 font-semibold capitalize ${deviceClass(r.device_status)}`}>
                        {r.device_status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
