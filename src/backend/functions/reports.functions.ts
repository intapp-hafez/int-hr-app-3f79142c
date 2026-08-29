import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkDateRange } from "../schemas/date-range";
import { parseInput } from "../schemas/validation-error";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

export const getAdminReportsData = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    parseInput(
      z
      .object({
        range: z.string(),
        branch: z.string(),
        expiryDays: z.number().int().min(1).max(365).optional(),
        from: z.string().optional().nullable(),
        to: z.string().optional().nullable(),
      })
      .superRefine((v, ctx) => {
        const message = checkDateRange(v.from, v.to, { maxDays: 366, optional: true });
        if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["to"] });
      }),
      input,
    )
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Calculate start date
    let startDateStr = "";
    let endDateStr = "";
    let seed = 1;
    
    const now = new Date();
    
    if (data.range === "today") {
      startDateStr = now.toISOString().split("T")[0];
      endDateStr = startDateStr;
      seed = 1;
    } else if (data.range === "yesterday") {
      now.setDate(now.getDate() - 1);
      startDateStr = now.toISOString().split("T")[0];
      endDateStr = startDateStr;
      seed = 1;
    } else if (data.range === "thisMonth") {
      startDateStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      endDateStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      seed = now.getDate(); // approximate days passed
    } else if (data.range.startsWith("month:")) {
      const [year, month] = data.range.split(":")[1].split("-");
      startDateStr = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split("T")[0];
      endDateStr = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];
      seed = new Date(parseInt(year), parseInt(month), 0).getDate();
    } else {
      // fallback to legacy
      seed = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[data.range as string] || 30;
      const d = new Date();
      d.setDate(d.getDate() - seed);
      startDateStr = d.toISOString().split("T")[0];
      endDateStr = new Date().toISOString().split("T")[0];
    }

    // 1. Fetch cities (locations/branches)
    const { data: cities } = await supabase.from("cities").select("id, name_en");

    // 2. Fetch profiles
    let profilesQuery = supabase
      .from("profiles")
      .select("id, full_name, city, department_id, status");
    
    if (data.branch !== "all") {
      profilesQuery = profilesQuery.eq("city", data.branch);
    }
    const { data: profiles } = await profilesQuery;
    
    // Create lookup map for profiles
    const empMap = new Map(profiles?.map((p: any) => [p.id, p]));

    // 3. Fetch departments to resolve names
    const { data: depts } = await supabase.from("departments").select("id, name_en");
    const deptMap = new Map(depts?.map((d: any) => [d.id, d.name_en]));

    // 4. Fetch attendance records in range
    let attQuery = supabase
      .from("attendance")
      .select("id, employee_id, date, in_time, out_time, status, branch, note")
      .gte("date", startDateStr)
      .lte("date", endDateStr);
    
    if (data.branch !== "all") {
      attQuery = attQuery.eq("branch", data.branch);
    }
    const { data: attendanceRaw } = await attQuery;

    // Filter attendance to only included profiles
    const attendance = (attendanceRaw || []).filter((a: any) => empMap.has(a.employee_id));

    // 5. Fetch leaves
    let leavesQuery = supabase
      .from("leaves")
      .select("id, employee_id, leave_type_name, start_date, end_date, status")
      .gte("end_date", startDateStr)
      .lte("start_date", endDateStr);

    const { data: leavesRaw } = await leavesQuery;
    const leaves = (leavesRaw || []).filter((l: any) => empMap.has(l.employee_id));

    // Calculate basic stats
    const headcount = profiles?.length || 0;
    
    // Calculate late & overtime
    let lateCount = 0;
    let totalOvertimeHrs = 0;
    let totalPresent = 0;
    
    const lateList: any[] = [];
    const overtimeList: any[] = [];
    
    attendance.forEach((a: any) => {
      if (a.status === "present") totalPresent++;
      
      // Rough mock calculation for late (assuming shift starts at 09:00)
      if (a.in_time) {
        const inTimeStr = new Date(a.in_time).toTimeString().slice(0, 5);
        if (inTimeStr > "09:05") {
          lateCount++;
          const minsLate = Math.floor((new Date(a.in_time).getTime() - new Date(a.date + "T09:00:00Z").getTime()) / 60000);
          lateList.push({
            employee: empMap.get(a.employee_id)?.full_name || a.employee_id,
            date: a.date,
            checkInTime: inTimeStr,
            minutesLate: Math.max(1, minsLate)
          });
        }
      }
      // Rough calculation for overtime (assuming shift ends at 17:00)
      if (a.out_time) {
        const outTimeStr = new Date(a.out_time).toTimeString().slice(0, 5);
        if (outTimeStr > "17:30") {
          const otHrs = Math.floor((new Date(a.out_time).getTime() - new Date(a.date + "T17:00:00Z").getTime()) / 3600000);
          totalOvertimeHrs += otHrs;
          if (otHrs > 0) {
            overtimeList.push({
              employee: empMap.get(a.employee_id)?.full_name || a.employee_id,
              date: a.date,
              hours: otHrs
            });
          }
        }
      }
    });

    const avgLate = totalPresent ? (lateCount / (seed)).toFixed(1) : "0.0";
    const attendanceRate = totalPresent ? Math.round((totalPresent / (headcount * seed)) * 100) : 0;

    // Process lists for tables
    const dailyAttendance = attendance
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((a: any) => ({
        employee: empMap.get(a.employee_id)?.full_name || a.employee_id,
        branch: a.branch || "-",
        date: a.date,
        status: a.status
      }));

    // Group by employee for monthly summary
    const empAttMap = new Map();
    attendance.forEach((a: any) => {
      if (!empAttMap.has(a.employee_id)) empAttMap.set(a.employee_id, { present: 0, absent: 0, late: 0 });
      const stats = empAttMap.get(a.employee_id);
      if (a.status === "present") stats.present++;
      else if (a.status === "absent") stats.absent++;
      // late is counted if in_time > 09:05
      if (a.in_time && new Date(a.in_time).toTimeString().slice(0,5) > "09:05") stats.late++;
    });

    const monthlyAttendance = Array.from(empAttMap.entries()).map(([empId, stats]) => {
      const p = empMap.get(empId);
      return {
        employee: p?.full_name || empId,
        branch: p?.city || "-",
        daysPresent: stats.present,
        daysAbsent: stats.absent,
        lateCount: stats.late
      };
    });

    const leaveSummary = leaves.map((l: any) => ({
      employee: empMap.get(l.employee_id)?.full_name || l.employee_id,
      type: l.leave_type_name || "Leave",
      start: l.start_date,
      end: l.end_date,
      status: l.status
    }));

    const absenceReport = attendance
      .filter((a: any) => a.status === "absent")
      .map((a: any) => ({
        employee: empMap.get(a.employee_id)?.full_name || a.employee_id,
        date: a.date,
        reason: a.note || "No reason provided"
      }));

    // Expiry reports — window configurable, independent of the selected range
    const todayD = new Date();
    const todayIso = todayD.toISOString().split("T")[0];
    const expiryWindowDays = data.expiryDays ?? 30;
    const in30Iso = new Date(todayD.getTime() + expiryWindowDays * 86400000).toISOString().split("T")[0];
    const daysLeft = (iso: string) =>
      Math.ceil((new Date(iso + "T00:00:00Z").getTime() - new Date(todayIso + "T00:00:00Z").getTime()) / 86400000);

    let idExpQ = supabase
      .from("profiles")
      .select("id, full_name, emp_code, city, department_id, national_id, id_expiry_date, status")
      .eq("status", "Active")
      .not("id_expiry_date", "is", null)
      .gte("id_expiry_date", todayIso)
      .lte("id_expiry_date", in30Iso)
      .order("id_expiry_date", { ascending: true });
    if (data.branch !== "all") idExpQ = idExpQ.eq("city", data.branch);
    const { data: idExpRaw } = await idExpQ;

    const idExpiry = (idExpRaw || []).map((p: any) => ({
      id: p.id,
      employee: p.full_name || p.emp_code || p.id,
      empCode: p.emp_code || "-",
      branch: p.city || "-",
      department: deptMap.get(p.department_id) || "-",
      nationalId: p.national_id || "-",
      expiryDate: p.id_expiry_date,
      daysLeft: daysLeft(p.id_expiry_date),
    }));

    let ctrExpQ = supabase
      .from("profiles")
      .select("id, full_name, emp_code, city, department_id, contract_type, contract_end_date, contract_cancelled, status")
      .eq("status", "Active")
      .not("contract_end_date", "is", null)
      .gte("contract_end_date", todayIso)
      .lte("contract_end_date", in30Iso)
      .order("contract_end_date", { ascending: true });
    if (data.branch !== "all") ctrExpQ = ctrExpQ.eq("city", data.branch);
    const { data: ctrExpRaw } = await ctrExpQ;

    const contractExpiry = (ctrExpRaw || [])
      .filter((p: any) => !p.contract_cancelled)
      .map((p: any) => ({
        id: p.id,
        employee: p.full_name || p.emp_code || p.id,
        empCode: p.emp_code || "-",
        branch: p.city || "-",
        department: deptMap.get(p.department_id) || "-",
        contractType: p.contract_type || "-",
        endDate: p.contract_end_date,
        daysLeft: daysLeft(p.contract_end_date),
      }));

    return {
      employees: (profiles || []).map((p: any) => ({ ...p, dept: deptMap.get(p.department_id) || "Unknown" })),
      locations: cities?.map((c: any) => ({ id: c.id, name: c.name_en })) || [],
      attendance: attendance,
      leaves: leaves,
      kpis: {
        attendanceRate: Math.min(100, attendanceRate),
        avgLate,
        totalOvertimeHrs,
        headcount
      },
      tables: {
        daily: dailyAttendance,
        monthly: monthlyAttendance,
        late: lateList,
        overtime: overtimeList,
        leaves: leaveSummary,
        absence: absenceReport,
        idExpiry,
        contractExpiry
      }
    };
  });

export const getMonthlyAdvances = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({ month: z.string() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [year, mon] = data.month.split("-");
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().split("T")[0];

    const { data: advances } = await (supabase as any)
      .from("employee_advances")
      .select("id, request_number, employee_id, requested_amount, approved_amount, status, created_at, currency, repayment_status")
      .gte("created_at", `${startDate}T00:00:00Z`)
      .lte("created_at", `${endDate}T23:59:59Z`)
      .order("created_at", { ascending: false });

    const empIds = [...new Set((advances || []).map((a: any) => a.employee_id as string))] as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", empIds);

    const empMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

    return (advances || []).map((a: any) => ({
      id: a.id,
      requestNumber: a.request_number,
      employee: empMap.get(a.employee_id) || a.employee_id,
      requestedAmount: a.requested_amount,
      approvedAmount: a.approved_amount,
      status: a.status,
      repaymentStatus: a.repayment_status,
      currency: a.currency || "EGP",
      createdAt: a.created_at,
    }));
  });

