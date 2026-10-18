import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { reportLocation, type AttendanceDetail, type ReportFence } from "@/lib/attendance-report";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date (dd-mm-yyyy).");
const rangeSchema = z.object({ from: date, to: date }).refine(v => v.from <= v.to,
  { message: "To date must be on or after From date.", path: ["to"] }).refine(v =>
    (Date.parse(v.to) - Date.parse(v.from)) / 86400000 < 366,
  { message: "Select a period of no more than 366 days.", path: ["to"] });

// Paginate rather than relying on Supabase's default row limit.
async function readAll(query: any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export const getGroupedAttendance = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data, context }): Promise<AttendanceDetail[]> => {
    const db = context.supabase as any;
    const [attendance, profiles, departments, centers, fences] = await Promise.all([
      readAll(db.from("attendance").select("id, employee_id, date, in_time, out_time, status, branch, city, lat, lng")
        .gte("date", data.from).lte("date", data.to).order("id")),
      readAll(db.from("profiles").select("id, full_name, emp_code, department_id, cost_center_id").order("id")),
      readAll(db.from("departments").select("id, name_en").order("id")),
      readAll(db.from("cost_centers").select("id, name_en").order("id")),
      readAll(db.from("geofence_locations").select("id, name, lat, lng, radius_m").order("id")),
    ]);
    const people = new Map(profiles.map(p => [p.id, p]));
    const deptNames = new Map(departments.map(d => [d.id, d.name_en]));
    const centerNames = new Map(centers.map(c => [c.id, c.name_en]));
    return attendance.map(row => {
      const person = people.get(row.employee_id);
      return {
        id: row.id, employeeId: row.employee_id, employee: person?.full_name || row.employee_id,
        code: person?.emp_code || "—", date: row.date, checkIn: row.in_time, checkOut: row.out_time,
        status: row.status, department: deptNames.get(person?.department_id) || "Unassigned department",
        costCenter: centerNames.get(person?.cost_center_id) || "Unassigned cost center",
        location: reportLocation(row.lat, row.lng, fences as ReportFence[], row.branch || row.city),
      };
    });
  });