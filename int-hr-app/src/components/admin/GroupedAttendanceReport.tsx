import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw, Search, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGroupedAttendance } from "@/backend/functions/grouped-attendance.functions";
import { summarizeAttendance, workedMilliseconds, type AttendanceGroup } from "@/lib/attendance-report";

const labels: Record<AttendanceGroup, string> = { costCenter: "Cost center", department: "Department", location: "Location" };
const hours = (milliseconds: number) => (milliseconds / 3600000).toFixed(2);
const dateText = (iso: string) => iso.split("-").reverse().join("-");
const timeText = (value: string | null) => value ? new Date(value).toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }) : "—";
function isoDate(text: string) {
  const parsed = parse(text, "dd-MM-yyyy", new Date());
  return isValid(parsed) && format(parsed, "dd-MM-yyyy") === text ? format(parsed, "yyyy-MM-dd") : "";
}

export function GroupedAttendanceReport() {
  const [by, setBy] = useState<AttendanceGroup>("costCenter");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [fromText, setFromText] = useState(() => format(new Date(), "01-MM-yyyy"));
  const [toText, setToText] = useState(() => format(new Date(), "dd-MM-yyyy"));
  const [range, setRange] = useState(() => ({ from: format(new Date(), "yyyy-MM-01"), to: format(new Date(), "yyyy-MM-dd") }));
  const [dateError, setDateError] = useState("");
  const fetchReport = useServerFn(getGroupedAttendance);
  const { data: rows = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["grouped-attendance", range.from, range.to],
    queryFn: () => fetchReport({ data: range }),
  });
  const groupNames = useMemo(() => [...new Set(rows.map(r => r[by]))].sort(), [rows, by]);
  const filtered = useMemo(() => rows.filter(row => (selected === "all" || row[by] === selected) &&
    `${row.employee} ${row.code} ${row.costCenter} ${row.department} ${row.location}`.toLowerCase().includes(search.toLowerCase())), [rows, by, selected, search]);
  const groups = useMemo(() => summarizeAttendance(filtered, by), [filtered, by]);
  const total = groups.reduce((sum, group) => sum + group.milliseconds, 0);

  function applyRange() {
    const from = isoDate(fromText), to = isoDate(toText);
    if (!from || !to) { setDateError("Enter valid dates in dd-mm-yyyy format."); return; }
    if (from > to) { setDateError("To date must be on or after From date."); return; }
    if ((Date.parse(to) - Date.parse(from)) / 86400000 >= 366) { setDateError("Select no more than 366 days."); return; }
    setDateError(""); setOpen(null);
    setRange({ from, to });
  }
  function exportReport(kind: "xlsx" | "csv") {
    const sheet = XLSX.utils.aoa_to_sheet([
      [labels[by], "Employee code", "Employee", "Days attended", "Days absent", "Incomplete punches", "Total hours"],
      ...groups.flatMap(group => group.employees.map(e => [group.name, e.code, e.employee, e.daysAttended, e.daysAbsent, e.incomplete, Number(hours(e.milliseconds))])),
      ["Total", "", "", "", "", "", Number(hours(total))],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendance");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ["Employee", "Cost center", "Department", "Location", "Date", "Check-in (Cairo)", "Check-out (Cairo)", "Status", "Hours"],
      ...filtered.map(r => [r.employee, r.costCenter, r.department, r.location, dateText(r.date), timeText(r.checkIn), timeText(r.checkOut), r.status, Number(hours(workedMilliseconds(r)))]),
    ]), "Daily details");
    XLSX.writeFile(book, `Attendance_${by}_${range.from}_${range.to}.${kind}`);
  }

  return <section className="space-y-4 border-y border-border py-6" aria-label="Grouped attendance report">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-lg font-semibold">Attendance & total hours</h2>
        <p className="text-xs text-muted-foreground">{dateText(range.from)} — {dateText(range.to)} · Cairo time</p></div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()} aria-label="Refresh attendance report"><RefreshCw className={isFetching ? "animate-spin" : ""} /></Button>
        <Button variant="outline" size="sm" disabled={!filtered.length || isFetching || !!error} onClick={() => exportReport("xlsx")}><Download />Excel</Button>
        <Button variant="outline" size="sm" disabled={!filtered.length || isFetching || !!error} onClick={() => exportReport("csv")}><Download />CSV</Button>
      </div>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-xs font-medium">Group by
        <Select value={by} onValueChange={v => { setBy(v as AttendanceGroup); setSelected("all"); setOpen(null); }}><SelectTrigger className="w-40" aria-label="Group attendance by"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </label>
      <label className="space-y-1 text-xs font-medium">{labels[by]}
        <Select value={selected} onValueChange={setSelected}><SelectTrigger className="w-52" aria-label={`Filter ${labels[by]}`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All {labels[by].toLowerCase()}s</SelectItem>{groupNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
      </label>
      <label className="space-y-1 text-xs font-medium">From<Input aria-label="Report from date" placeholder="dd-mm-yyyy" value={fromText} onChange={e => setFromText(e.target.value)} className="w-36" /></label>
      <label className="space-y-1 text-xs font-medium">To<Input aria-label="Report to date" placeholder="dd-mm-yyyy" value={toText} onChange={e => setToText(e.target.value)} className="w-36" /></label>
      <Button onClick={applyRange} disabled={isFetching}>Apply</Button>
      <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search attendance employees" placeholder="Search employee or code" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
    </div>
    {dateError && <p role="alert" className="text-sm text-destructive">{dateError}</p>}
    {error ? <p role="alert" className="text-sm text-destructive">Unable to load attendance: {error.message}</p> : isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading attendance…</p> : <>
      <div className="flex flex-wrap gap-6 text-sm"><span><strong>{new Set(filtered.map(r => r.employeeId)).size}</strong> employees</span><span><strong>{filtered.length}</strong> records</span><span><strong>{hours(total)}</strong> total hours</span></div>
      <p className="text-xs text-muted-foreground">Hours use completed check-in/out pairs, without break deductions. Missing or invalid pairs add no hours. Absences are recorded absences only. Cost centers and departments use current employee assignments; locations use check-in GPS or the recorded branch/city.</p>
      {!groups.length && <p className="py-6 text-center text-sm text-muted-foreground">No attendance records match these filters.</p>}
      {groups.map(group => <div key={group.name} className="space-y-2">
        <h3 className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 text-sm font-semibold"><span>{group.name}</span><span>{group.employees.length} employees · {hours(group.milliseconds)} hours</span></h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Employee</th><th className="p-2">Code</th><th className="p-2 text-right">Days attended</th><th className="p-2 text-right">Days absent</th><th className="p-2 text-right">Incomplete</th><th className="p-2 text-right">Total hours</th></tr></thead>
          <tbody>{group.employees.map(employee => {
            const key = `${group.name}:${employee.id}`;
            return <EmployeeRows key={key} employee={employee} expanded={open === key} onToggle={() => setOpen(open === key ? null : key)} />;
          })}</tbody>
        </table></div>
      </div>)}
    </>}
  </section>;
}

function EmployeeRows({ employee, expanded, onToggle }: {
  employee: ReturnType<typeof summarizeAttendance>[number]["employees"][number]; expanded: boolean; onToggle: () => void;
}) {
  return <><tr className="border-t border-border"><td className="p-2"><Button variant="ghost" size="sm" onClick={onToggle} aria-expanded={expanded} className="h-auto whitespace-normal text-left">{expanded ? <ChevronDown /> : <ChevronRight />}{employee.employee}</Button></td><td className="p-2">{employee.code}</td><td className="p-2 text-right tabular-nums">{employee.daysAttended}</td><td className="p-2 text-right tabular-nums">{employee.daysAbsent}</td><td className="p-2 text-right tabular-nums">{employee.incomplete}</td><td className="p-2 text-right font-semibold tabular-nums">{hours(employee.milliseconds)}</td></tr>
    {expanded && <tr><td colSpan={6} className="bg-muted/30 p-3"><table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="p-2">Date</th><th className="p-2">Check-in</th><th className="p-2">Check-out</th><th className="p-2">Status</th><th className="p-2">Location</th><th className="p-2 text-right">Hours</th></tr></thead><tbody>{employee.records.map(r => <tr key={r.id} className="border-t border-border"><td className="p-2">{dateText(r.date)}</td><td className="p-2">{timeText(r.checkIn)}</td><td className="p-2">{timeText(r.checkOut)}</td><td className="p-2 capitalize">{r.status}</td><td className="p-2">{r.location}</td><td className="p-2 text-right">{hours(workedMilliseconds(r))}</td></tr>)}</tbody></table></td></tr>}
  </>;
}