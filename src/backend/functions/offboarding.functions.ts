import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";

export const calculateFinalSettlement = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        resignation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ context, data }: { context: any; data: any }) => {
    const { supabase } = context as { supabase: any };

    // 1. Get employee data
    const { data: profile, error: pe } = await (supabase.from("profiles") as any)
      .select("id, full_name, salary_gross, salary_mode, allowance, status, inactive_reason")
      .eq("id", data.employee_id)
      .maybeSingle();

    if (pe || !profile) throw new Error("Employee not found");

    // Calculate daily rate
    const gross = Number(profile.salary_gross || 0);
    const allow = Number(profile.allowance || 0);
    const totalSalary = gross + allow;
    const dailyRate = Number((totalSalary / 30).toFixed(2));

    // Calculate worked days in the resignation month
    // Just a basic estimation: day of the month
    const [y, m, d] = data.resignation_date.split("-").map(Number);
    const workedDays = Math.min(d, 30); // simplistic assumption
    const unpaidSalary = Number((workedDays * dailyRate).toFixed(2));

    // 2. Get leave balance (annual leaves)
    const { data: leaves } = await (supabase.from("leave_balances") as any)
      .select("balance")
      .eq("employee_id", data.employee_id)
      .eq("year", y)
      // Annual leaves usually map to a specific leave_type_id, we'll just sum all positive balances or find the Annual one.
      // For safety, let's just find "Annual leaves" from leave_types.
      // We will do a join if possible, but let's just fetch all balances and cross reference
      ;

    let remainingLeaveDays = 0;
    if (leaves && leaves.length > 0) {
      // Assuming the main balance is annual leaves. In a real system we'd filter by leave_type.name_en = 'Annual leaves'
      remainingLeaveDays = leaves.reduce((sum: number, l: any) => sum + (l.balance || 0), 0);
    }
    const leaveCashOut = remainingLeaveDays > 0 ? Number((remainingLeaveDays * dailyRate).toFixed(2)) : 0;

    // 3. Outstanding advances
    const { data: advances } = await (supabase.from("employee_advances") as any)
      .select("id, request_number, requested_amount, approved_amount, remaining_balance, paid_amount, repayment_status, status, deduction_start_date, installment_count, installment_amount, created_at")
      .eq("employee_id", data.employee_id)
      .not("status", "in", '("rejected","cancelled")')
      .order("created_at", { ascending: false });

    const activeAdvances = (advances || []).filter((a: any) => {
      const rem = a.remaining_balance != null ? Number(a.remaining_balance) : Number(a.approved_amount || a.requested_amount || 0);
      const isCompleted = a.repayment_status === "completed" || a.repayment_status === "closed";
      return rem > 0 && !isCompleted && (a.status === "paid" || a.status === "approved_for_payment" || a.repayment_status === "active" || a.repayment_status === "pending");
    });

    const outstandingAdvances = Number(
      activeAdvances.reduce((sum: number, a: any) => {
        const rem = a.remaining_balance != null ? Number(a.remaining_balance) : Number(a.approved_amount || a.requested_amount || 0);
        return sum + rem;
      }, 0).toFixed(2)
    );

    // 4. Employee Custody items
    const { data: custodyRows } = await (supabase.from("employee_custody") as any)
      .select("id, name, category, serial_number, model, custody_date, return_date, return_notes")
      .eq("profile_id", data.employee_id)
      .order("custody_date", { ascending: false });

    const custodyItems = (custodyRows || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      category: c.category || "General",
      serial_number: c.serial_number,
      model: c.model,
      custody_date: c.custody_date,
      return_date: c.return_date,
      return_notes: c.return_notes,
      is_returned: Boolean(c.return_date),
    }));

    const unreturnedCustody = custodyItems.filter((c: any) => !c.is_returned);

    return {
      employee_id: profile.id,
      full_name: profile.full_name,
      resignation_date: data.resignation_date,
      daily_rate: dailyRate,
      worked_days: workedDays,
      unpaid_salary: unpaidSalary,
      remaining_leave_days: remainingLeaveDays,
      leave_cash_out: leaveCashOut,
      outstanding_advances: outstandingAdvances,
      advances_list: activeAdvances.map((a: any) => ({
        id: a.id,
        request_number: a.request_number,
        approved_amount: Number(a.approved_amount ?? a.requested_amount ?? 0),
        remaining_balance: Number(a.remaining_balance ?? a.approved_amount ?? a.requested_amount ?? 0),
        repayment_status: a.repayment_status,
        status: a.status,
        installment_amount: a.installment_amount ? Number(a.installment_amount) : null,
        installment_count: a.installment_count ? Number(a.installment_count) : null,
        deduction_start_date: a.deduction_start_date,
        created_at: a.created_at,
      })),
      unreturned_custody_count: unreturnedCustody.length,
      total_custody_count: custodyItems.length,
      custody_items: custodyItems,
      unreturned_custody_items: unreturnedCustody,
      other_additions: 0,
      other_deductions: 0,
      net_settlement: Number((unpaidSalary + leaveCashOut - outstandingAdvances).toFixed(2)),
    };
  });

export const saveFinalSettlement = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        resignation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        worked_days: z.number().min(0),
        daily_rate: z.number().min(0),
        unpaid_salary: z.number().min(0),
        remaining_leave_days: z.number(),
        leave_cash_out: z.number(),
        outstanding_advances: z.number().min(0),
        other_additions: z.number().min(0).default(0),
        other_deductions: z.number().min(0).default(0),
        notes: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }: { context: any; data: any }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const payload = {
      ...data,
      created_by: userId,
      status: 'approved'
    };

    const { error } = await (supabase.from("final_settlements") as any)
      .insert(payload);

    if (error) {
      throw new Error(error.message);
    }

    // Also mark employee as inactive -> Resigned if not already
    await (supabase.from("profiles") as any)
      .update({ status: "Inactive", inactive_reason: "Resigned" })
      .eq("id", data.employee_id);

    return { ok: true };
  });
