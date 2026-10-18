export type AttendanceGroup = "costCenter" | "department" | "location";
export type AttendanceDetail = {
  id: string; employeeId: string; employee: string; code: string;
  costCenter: string; department: string; location: string;
  date: string; checkIn: string | null; checkOut: string | null; status: string;
};

export function workedMilliseconds(row: Pick<AttendanceDetail, "checkIn" | "checkOut">) {
  if (!row.checkIn || !row.checkOut) return 0;
  const duration = Date.parse(row.checkOut) - Date.parse(row.checkIn);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export function incompletePunch(row: Pick<AttendanceDetail, "checkIn" | "checkOut">) {
  if (!row.checkIn && !row.checkOut) return false;
  return !row.checkIn || !row.checkOut || !Number.isFinite(Date.parse(row.checkIn)) ||
    !Number.isFinite(Date.parse(row.checkOut)) || Date.parse(row.checkOut) < Date.parse(row.checkIn);
}

export function summarizeAttendance(rows: AttendanceDetail[], by: AttendanceGroup) {
  const groups = new Map<string, Map<string, AttendanceDetail[]>>();
  for (const row of rows) {
    const group = groups.get(row[by]) ?? new Map<string, AttendanceDetail[]>();
    const employee = group.get(row.employeeId) ?? [];
    employee.push(row);
    group.set(row.employeeId, employee);
    groups.set(row[by], group);
  }
  return Array.from(groups, ([name, employees]) => {
    const summaries = Array.from(employees, ([id, records]) => ({
      id, employee: records[0].employee, code: records[0].code,
      daysAttended: new Set(records.filter(r => r.checkIn).map(r => r.date)).size,
      daysAbsent: new Set(records.filter(r => r.status === "absent").map(r => r.date)).size,
      incomplete: records.filter(incompletePunch).length,
      milliseconds: records.reduce((total, row) => total + workedMilliseconds(row), 0),
      records: records.sort((a, b) => b.date.localeCompare(a.date)),
    })).sort((a, b) => a.employee.localeCompare(b.employee));
    return { name, employees: summaries, milliseconds: summaries.reduce((n, e) => n + e.milliseconds, 0) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export type ReportFence = { id: string; name: string; lat: number; lng: number; radius_m: number };
export function reportLocation(lat: number | null, lng: number | null, fences: ReportFence[], fallback: string | null) {
  if (lat != null && lng != null) {
    const radians = (v: number) => v * Math.PI / 180;
    const matches = fences.map(fence => {
      const a = Math.sin(radians(fence.lat - lat) / 2) ** 2 + Math.cos(radians(lat)) *
        Math.cos(radians(fence.lat)) * Math.sin(radians(fence.lng - lng) / 2) ** 2;
      return { fence, distance: 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) };
    }).filter(v => v.distance <= v.fence.radius_m).sort((a, b) => a.distance - b.distance);
    if (matches[0]) return matches[0].fence.name;
  }
  return fallback?.trim() ? `${fallback.trim()} (recorded branch/city)` : "Unknown location";
}