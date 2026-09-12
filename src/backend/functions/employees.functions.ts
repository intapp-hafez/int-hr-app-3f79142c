import { createServerFn } from "@tanstack/react-start";
import { requireAdminAccess } from "@/integrations/supabase/admin-auth-middleware";
import { formatEgPhone } from "@/lib/phone";
import { z } from "zod";

export type AdminEmployeeRow = {
  id: string;
  emp_code: string | null;
  full_name: string | null;
  full_name_ar: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  department_id: string | null;
  position_id: string | null;
  city: string | null;
  district: string | null;
  roles: string[];
  status: string;
  inactive_reason: string | null;
  avatar_url: string | null;
  created_at: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_cancelled: boolean | null;
  cost_center_id: string | null;
  shift_id: string | null;
  section_id: string | null;
  job_grade: string | null;
  medical_insurance_number?: string | null;
  medical_insurance_type?: string | null;
};

const SORT_COLS = ["full_name", "email", "created_at", "status", "contract_end_date", "contract_remaining"] as const;
const IMPORT_ROLES = ["admin", "hr", "manager", "employee", "finance"] as const;
export const INACTIVE_REASONS = [
  "Resigned",
  "Terminated",
  "End of Contract",
  "Deceased",
  "Long-Term Leave",
  "Suspended",
] as const;
export type InactiveReason = (typeof INACTIVE_REASONS)[number];

function isStrictIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

const ImportEmployeeRowSchema = z.object({
  empCode: z.string().max(40).optional().default(""),
  name: z.string().max(120).optional().default(""),
  email: z.string().max(160).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  dept: z.string().max(120).optional().default(""),
  role: z.string().max(40).optional().default("employee"),
  status: z.string().max(20).optional().default("Active"),
  password: z.string().max(128).optional().default(""),
  nationalId: z.string().max(40).optional().default(""),
  idIssueDate: z.string().max(20).optional().default(""),
  nationalIdExpiry: z.string().max(20).optional().default(""),
  city: z.string().max(120).optional().default(""),
  district: z.string().max(120).optional().default(""),
  position: z.string().max(120).optional().default(""),
  avatarUrl: z.string().max(800_000).optional().default(""),
});

export type ImportEmployeeResult = {
  ok: boolean;
  importedCount: number;
  results: { index: number; ok: boolean; id?: string; email?: string; error?: string }[];
};

const CreateEmployeeSchema = z.object({
  empCode: z.string().max(40).optional().default(""),
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().max(120).optional().default(""),
  email: z.string().trim().email().max(160),
  phone: z.string().max(40).optional().default(""),
  dept: z.string().max(120).optional().default(""),
  position: z.string().max(120).optional().default(""),
  sectionId: z.string().uuid().optional().or(z.literal("")).default(""),
  jobGrade: z.string().max(100).optional().or(z.literal("")).default(""),
  gender: z.enum(["male", "female"]).optional().or(z.literal("")),
  role: z.enum(IMPORT_ROLES).optional().default("employee"),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
  password: z.string().min(6).max(128),
  city: z.string().max(120).optional().default(""),
  district: z.string().max(120).optional().default(""),
  avatarUrl: z.string().max(800_000).optional().default(""),
  nationalId: z.string().max(40).optional().default(""),
  idIssueDate: z.string().max(20).optional().default(""),
  nationalIdExpiry: z.string().max(20).optional().default(""),
  managerId: z.string().uuid().optional().or(z.literal("")).default(""),
  costCenterId: z.string().uuid().optional().or(z.literal("")).default(""),
  shiftId: z.string().uuid().optional().or(z.literal("")).default(""),
  salaryMode: z.enum(["gross", "net"]).optional().default("gross"),
  salaryGross: z.number().min(0).max(10_000_000).optional().default(0),
  salaryNet: z.number().min(0).max(10_000_000).optional().default(0),
  insuranceSalary: z.number().min(0).max(10_000_000).optional().default(0),
  emergencyFund: z.number().min(0).max(10_000_000).optional().default(0),
  allowance: z.number().min(0).max(10_000_000).optional().default(0),
  targetValue: z.number().min(0).max(10_000_000).optional().default(0),
  targetDuration: z.enum(["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"]).optional().default("Monthly"),
  contractType: z.enum(["FullTime", "PartTime", "Temporary", "Internship", "Probation3M"]).optional().default("FullTime"),
  contractStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  contractEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  contractCancelled: z.boolean().optional().default(false),
  extraEmail: z.string().email().max(255).optional().or(z.literal("")).default(""),
  medicalInsuranceDetails: z.string().max(1000).optional().default(""),
  medicalInsuranceNumber: z.string().max(100).optional().default(""),
  medicalInsuranceType: z.enum(["Private", "Governmental"]).optional().or(z.literal("")).default(""),
  isInsured: z.boolean().optional().default(false),
  militaryExpireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  isFivePercent: z.boolean().optional().default(false),
  socialInsuranceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  customField: z.string().max(1000).optional().default(""),
  loginUrl: z.string().min(1).max(500),
  appName: z.string().max(120).optional().default(""),
});

export type CreateEmployeeResult = {
  ok: boolean;
  id?: string;
  email: string;
  accountCreated: boolean;
  profileCreated: boolean;
  emailSent: boolean;
  warning?: string;
};

export type ListEmployeesResult = {
  rows: AdminEmployeeRow[];
  total: number;
  departments: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  roles: string[];
};

export const listEmployeesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(25),
        sort: z.enum(SORT_COLS).default("created_at"),
        dir: z.enum(["asc", "desc"]).default("desc"),
        q: z.string().max(120).optional().default(""),
        departmentId: z.string().optional().default(""),
        positionId: z.string().optional().default(""),
        role: z.string().optional().default(""),
        status: z.enum(["", "Active", "Inactive"]).optional().default(""),
        inactiveReason: z.string().optional().default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<ListEmployeesResult> => {
    const { supabase } = context;
    const [{ data: depts }, { data: poss }, { data: allRoles }] = await Promise.all([
      supabase.from("departments").select("id, name_en").order("name_en"),
      supabase.from("positions").select("id, name_en").order("name_en"),
      supabase.from("user_roles").select("role"),
    ]);

    // Optional role filter: pre-fetch matching user ids
    let roleUserIds: string[] | null = null;
    if (data.role) {
      const { data: ru } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", data.role as any);
      roleUserIds = (ru ?? []).map((r: any) => r.user_id);
      if (roleUserIds.length === 0) {
        return {
          rows: [],
          total: 0,
          departments: (depts ?? []).map((d: any) => ({ id: d.id, name: d.name_en })),
          positions: (poss ?? []).map((p: any) => ({ id: p.id, name: p.name_en })),
          roles: Array.from(new Set((allRoles ?? []).map((r: any) => String(r.role)))),
        };
      }
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("profiles")
      .select(
        "id, emp_code, full_name, full_name_ar, cost_center_id, email, phone, department_id, position_id, city, district, status, inactive_reason, avatar_url, created_at, contract_start_date, contract_end_date, contract_cancelled, medical_insurance_number, medical_insurance_type",
        { count: "exact" },
      );

    if (data.q) {
      const term = data.q.replace(/[,%]/g, "");
      const phoneSearch = (formatEgPhone(term) || term).replace(/\s+/g, "%");
      let orStr = `full_name.ilike.%${term}%,full_name_ar.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,phone.ilike.%${phoneSearch}%`;
      if (/^\d+$/.test(term)) {
        orStr += `,emp_code.eq.${term}`;
      }
      q = q.or(orStr);
    }
    if (data.departmentId) q = q.eq("department_id", data.departmentId);
    if (data.positionId) q = q.eq("position_id", data.positionId);
    if (data.status) q = q.eq("status", data.status);
    if (data.inactiveReason) q = q.eq("inactive_reason", data.inactiveReason);
    if (roleUserIds) q = q.in("id", roleUserIds);

    const sortCol = data.sort === "contract_remaining" ? "contract_end_date" : data.sort;
    q = q.order(sortCol, { ascending: data.dir === "asc" }).range(from, to);

    let { data: profiles, error: pe, count } = await q;
    if (pe && (
      pe.message?.includes("full_name_ar") || pe.details?.includes("full_name_ar") ||
      pe.message?.includes("cost_center_id") || pe.details?.includes("cost_center_id") ||
      pe.message?.includes("medical_insurance_number") || pe.details?.includes("medical_insurance_number") ||
      pe.message?.includes("medical_insurance_type") || pe.details?.includes("medical_insurance_type")
    )) {
      let qFallback = supabase
        .from("profiles")
        .select(
          "id, emp_code, full_name, email, phone, department_id, position_id, city, district, status, inactive_reason, avatar_url, created_at, contract_start_date, contract_end_date, contract_cancelled",
          { count: "exact" },
        );
      if (data.q) {
        const term = data.q.replace(/[,%]/g, "");
        const phoneSearch = (formatEgPhone(term) || term).replace(/\s+/g, "%");
        let orStr = `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,phone.ilike.%${phoneSearch}%`;
        if (/^\d+$/.test(term)) {
          orStr += `,emp_code.eq.${term}`;
        }
        qFallback = qFallback.or(orStr);
      }
      if (data.departmentId) qFallback = qFallback.eq("department_id", data.departmentId);
      if (data.positionId) qFallback = qFallback.eq("position_id", data.positionId);
      if (data.status) qFallback = qFallback.eq("status", data.status);
      if (data.inactiveReason) qFallback = qFallback.eq("inactive_reason", data.inactiveReason);
      if (roleUserIds) qFallback = qFallback.in("id", roleUserIds);
      qFallback = qFallback.order(sortCol, { ascending: data.dir === "asc" }).range(from, to);

      const fallbackRes = await qFallback;
      profiles = fallbackRes.data as any;
      pe = fallbackRes.error;
      count = fallbackRes.count;
    }
    if (pe) {
      return { rows: [], total: 0, departments: [], positions: [], roles: [], _error: pe } as any;
    }

    const ids = (profiles ?? []).map((p: any) => p.id);
    const [{ data: rolesRows }, { data: shiftsRows }] = await Promise.all([
      ids.length
        ? supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? (supabase.from("employee_shifts") as any).select("employee_id, shift_id").in("employee_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const shiftMap = new Map<string, string>((shiftsRows ?? []).map((s: any) => [String(s.employee_id), String(s.shift_id)]));

    const dMap = new Map((depts ?? []).map((d: any) => [d.id, d.name_en]));
    const pMap = new Map((poss ?? []).map((p: any) => [p.id, p.name_en]));
    const rows: AdminEmployeeRow[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      emp_code: p.emp_code ?? null,
      full_name: p.full_name,
      full_name_ar: p.full_name_ar ?? null,
      email: p.email,
      phone: p.phone,
      department_id: p.department_id ?? null,
      position_id: p.position_id ?? null,
      department: p.department_id ? (dMap.get(p.department_id) ?? null) : null,
      position: p.position_id ? (pMap.get(p.position_id) ?? null) : null,
      city: p.city,
      district: p.district,
      status: p.status ?? "Active",
      inactive_reason: p.inactive_reason ?? null,
      avatar_url: p.avatar_url ?? null,
      created_at: p.created_at,
      contract_start_date: p.contract_start_date ?? null,
      contract_end_date: p.contract_end_date ?? null,
      contract_cancelled: p.contract_cancelled ?? false,
      cost_center_id: p.cost_center_id ?? null,
      shift_id: shiftMap.get(p.id) ?? null,
      section_id: p.section_id ?? null,
      job_grade: p.job_grade ?? null,
      medical_insurance_number: p.medical_insurance_number ?? null,
      medical_insurance_type: p.medical_insurance_type ?? null,
      roles: (rolesRows ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => String(r.role)),
    }));

    return {
      rows,
      total: count ?? rows.length,
      departments: (depts ?? []).map((d: any) => ({ id: d.id, name: d.name_en })),
      positions: (poss ?? []).map((p: any) => ({ id: p.id, name: p.name_en })),
      roles: Array.from(new Set((allRoles ?? []).map((r: any) => String(r.role)))),
    };
  });

export const updateEmployeeAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().min(2).max(120).nullable().optional(),
        full_name_ar: z.string().max(120).nullable().optional().or(z.literal("")),
        gender: z.enum(["male", "female"]).nullable().optional().or(z.literal("")),
        phone: z.string().max(40).nullable().optional(),
        department_id: z.string().uuid().nullable().optional(),
        section_id: z.string().uuid().nullable().optional().or(z.literal("")),
        position_id: z.string().uuid().nullable().optional(),
        city_id: z.string().uuid().nullable().optional(),
        district_id: z.string().uuid().nullable().optional(),
        manager_id: z.string().uuid().nullable().optional(),
        cost_center_id: z.string().uuid().nullable().optional().or(z.literal("")),
        shift_id: z.string().uuid().nullable().optional().or(z.literal("")),
        locale: z.string().max(10).nullable().optional(),
        national_id: z.string().max(40).nullable().optional(),
        id_issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        id_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        emp_code: z.string().max(40).nullable().optional(),
        status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
        inactive_reason: z.enum(INACTIVE_REASONS).nullable().optional(),
        avatar_url: z.string().max(2_000_000).nullable().optional(),
        allow_past_expiry: z.boolean().optional().default(false),
        salary_mode: z.enum(["gross", "net"]).nullable().optional(),
        salary_gross: z.number().min(0).max(10_000_000).nullable().optional(),
        salary_net: z.number().min(0).max(10_000_000).nullable().optional(),
        insurance_salary: z.number().min(0).max(10_000_000).nullable().optional(),
        emergency_fund: z.number().min(0).max(10_000_000).nullable().optional(),
        allowance: z.number().min(0).max(10_000_000).nullable().optional(),
        target_value: z.number().min(0).max(10_000_000).nullable().optional(),
        target_duration: z.enum(["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"]).nullable().optional(),
        contract_type: z.enum(["FullTime", "PartTime", "Temporary", "Internship", "Probation3M"]).nullable().optional(),
        contract_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        contract_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        contract_cancelled: z.boolean().optional(),
        job_grade: z.string().max(100).nullable().optional(),
        extra_email: z.string().email().max(255).nullable().optional().or(z.literal("")),
        medical_insurance_details: z.string().max(1000).nullable().optional(),
        medical_insurance_number: z.string().max(100).nullable().optional().or(z.literal("")),
        medical_insurance_type: z.enum(["Private", "Governmental"]).nullable().optional().or(z.literal("")),
        is_insured: z.boolean().optional(),
        military_expire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
        is_five_percent: z.boolean().optional(),
        social_insurance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
        custom_field: z.string().max(10000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    // Cross-field date validation: issue <= expiry; expiry not in past unless admin overrides.
    if (data.id_issue_date && data.id_expiry_date && data.id_issue_date > data.id_expiry_date) {
      throw new Error("ID issue date cannot be after the expiry date");
    }
    if (data.id_expiry_date && !data.allow_past_expiry) {
      const today = new Date().toISOString().slice(0, 10);
      if (data.id_expiry_date < today) {
        throw new Error("ID expiry date is in the past. Enable the override to save anyway.");
      }
    }
    const patch: Record<string, any> = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.full_name_ar !== undefined) patch.full_name_ar = data.full_name_ar === "" ? null : data.full_name_ar;
    if (data.gender !== undefined) patch.gender = data.gender === "" ? null : data.gender;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.department_id !== undefined) patch.department_id = data.department_id;
    if (data.section_id !== undefined) patch.section_id = data.section_id === "" ? null : data.section_id;
    if (data.position_id !== undefined) patch.position_id = data.position_id;
    if (data.city_id !== undefined) patch.city_id = data.city_id;
    if (data.district_id !== undefined) patch.district_id = data.district_id;
    if (data.manager_id !== undefined) patch.manager_id = data.manager_id;
    if (data.cost_center_id !== undefined) patch.cost_center_id = data.cost_center_id === "" ? null : data.cost_center_id;
    if (data.locale !== undefined) patch.locale = data.locale;
    if (data.national_id !== undefined) patch.national_id = data.national_id;
    if (data.id_issue_date !== undefined) patch.id_issue_date = data.id_issue_date;
    if (data.id_expiry_date !== undefined) patch.id_expiry_date = data.id_expiry_date;
    if (data.emp_code !== undefined) {
      const code = typeof data.emp_code === "string" ? data.emp_code.trim() : data.emp_code;
      patch.emp_code = code === "" ? null : code;
      if (patch.emp_code) {
        const { data: dup } = await (supabase.from("profiles") as any)
          .select("id")
          .eq("emp_code", patch.emp_code)
          .neq("id", data.id)
          .maybeSingle();
        if (dup) throw new Error(`Employee code "${patch.emp_code}" is already used by another employee.`);
      }
    }
    if (data.status !== undefined) patch.status = data.status;
    if (data.inactive_reason !== undefined) patch.inactive_reason = data.inactive_reason;
    if (patch.status === "Active") {
      patch.inactive_reason = null;
    }
    if (patch.status === "Inactive" && patch.inactive_reason === null) {
      throw new Error("Please choose a reason when marking the employee as Inactive.");
    }
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    if (data.salary_mode !== undefined) patch.salary_mode = data.salary_mode;
    if (data.salary_gross !== undefined) patch.salary_gross = data.salary_gross;
    if (data.salary_net !== undefined) patch.salary_net = data.salary_net;
    if (data.insurance_salary !== undefined) patch.insurance_salary = data.insurance_salary;
    if (data.emergency_fund !== undefined) patch.emergency_fund = data.emergency_fund;
    if (data.allowance !== undefined) patch.allowance = data.allowance;
    if (data.target_value !== undefined) patch.target_value = data.target_value;
    if (data.target_duration !== undefined) patch.target_duration = data.target_duration;
    if (data.contract_type !== undefined) patch.contract_type = data.contract_type;
    if (data.contract_start_date !== undefined) patch.contract_start_date = data.contract_start_date;
    if (data.contract_end_date !== undefined) patch.contract_end_date = data.contract_end_date;
    if (data.contract_cancelled !== undefined) patch.contract_cancelled = data.contract_cancelled;
    if (data.job_grade !== undefined) patch.job_grade = data.job_grade;
    if (data.extra_email !== undefined) patch.extra_email = data.extra_email === "" ? null : data.extra_email;
    if (data.medical_insurance_details !== undefined) patch.medical_insurance_details = data.medical_insurance_details;
    if (data.medical_insurance_number !== undefined) patch.medical_insurance_number = data.medical_insurance_number === "" ? null : data.medical_insurance_number;
    if (data.medical_insurance_type !== undefined) patch.medical_insurance_type = data.medical_insurance_type === "" ? null : data.medical_insurance_type;
    if (data.is_insured !== undefined) patch.is_insured = data.is_insured;
    if (data.military_expire_date !== undefined) patch.military_expire_date = data.military_expire_date === "" ? null : data.military_expire_date;
    if (data.is_five_percent !== undefined) patch.is_five_percent = data.is_five_percent;
    if (data.social_insurance_date !== undefined) patch.social_insurance_date = data.social_insurance_date === "" ? null : data.social_insurance_date;
    if (data.custom_field !== undefined) patch.custom_field = data.custom_field;
    if (
      patch.contract_start_date &&
      patch.contract_end_date &&
      patch.contract_start_date > patch.contract_end_date
    ) {
      throw new Error("Contract start date cannot be after the end date");
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    // Snapshot previous status and custom_field so we can log changes or send notifications.
    let previousStatus: string | null = null;
    let previousCustomField: string | null = null;
    let currentFullName: string | null = null;
    if (patch.status !== undefined || patch.custom_field !== undefined) {
      const { data: prev } = await (supabase.from("profiles") as any)
        .select("status, custom_field, full_name")
        .eq("id", data.id)
        .maybeSingle();
      previousStatus = (prev as any)?.status ?? null;
      previousCustomField = (prev as any)?.custom_field ?? null;
      currentFullName = (prev as any)?.full_name ?? null;
    }
    let { error } = await (supabase.from("profiles") as any).update(patch).eq("id", data.id);
    if (error && (
      error.message?.includes("full_name_ar") || error.details?.includes("full_name_ar") ||
      error.message?.includes("cost_center_id") || error.details?.includes("cost_center_id") ||
      error.message?.includes("medical_insurance_number") || error.details?.includes("medical_insurance_number") ||
      error.message?.includes("medical_insurance_type") || error.details?.includes("medical_insurance_type")
    )) {
      const cleanPatch = { ...patch };
      if (error.message?.includes("full_name_ar") || error.details?.includes("full_name_ar")) delete cleanPatch.full_name_ar;
      if (error.message?.includes("cost_center_id") || error.details?.includes("cost_center_id")) delete cleanPatch.cost_center_id;
      if (error.message?.includes("medical_insurance_number") || error.details?.includes("medical_insurance_number")) delete cleanPatch.medical_insurance_number;
      if (error.message?.includes("medical_insurance_type") || error.details?.includes("medical_insurance_type")) delete cleanPatch.medical_insurance_type;
      const fb = await (supabase.from("profiles") as any).update(cleanPatch).eq("id", data.id);
      error = fb.error;
    }
    if (error) {
      if ((error as any).code === "23505" && /emp_code/.test(error.message)) {
        throw new Error("That employee code is already used by another employee.");
      }
      throw new Error(error.message);
    }
    if (data.shift_id !== undefined) {
      try {
        await (supabase.from("employee_shifts") as any).delete().eq("employee_id", data.id);
        if (data.shift_id) {
          await (supabase.from("employee_shifts") as any).insert({
            employee_id: data.id,
            shift_id: data.shift_id,
          });
        }
      } catch (shiftErr) {
        console.warn("Failed to update employee_shifts:", shiftErr);
      }
    }

    if (patch.status !== undefined && patch.status !== previousStatus) {
      await (supabase as any).from("employee_status_audit").insert({
        profile_id: data.id,
        previous_status: previousStatus,
        new_status: patch.status,
        inactive_reason: patch.status === "Inactive" ? (patch.inactive_reason ?? null) : null,
        source: "update",
        changed_by: userId,
      });
    }

    if (patch.custom_field !== undefined && patch.custom_field !== previousCustomField) {
      try {
        const { loadSmtpConfig } = await import("@/backend/server/smtp-config.server");
        const { sendEmail } = await import("@/backend/server/smtp-client.server");
        const smtp = await loadSmtpConfig();
        if (smtp && smtp.host && smtp.password) {
          const { data: hrRoles } = await (supabase as any).from("user_roles").select("user_id").in("role", ["admin", "hr"]);
          if (hrRoles && hrRoles.length > 0) {
            const hrIds = hrRoles.map((r: any) => r.user_id);
            const { data: hrProfiles } = await (supabase as any).from("profiles").select("email").in("id", hrIds).not("email", "is", null);
            const toEmails = (hrProfiles ?? []).map((p: any) => p.email).filter(Boolean);
            if (toEmails.length > 0) {
              const empName = patch.full_name || data.full_name || currentFullName || "Employee";
              await sendEmail(
                { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
                {
                  from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
                  fromEmail: smtp.from_email,
                  to: toEmails,
                  subject: `New Profile Note for ${empName}`,
                  html: `<p>A new profile note was added for <b>${empName}</b>:</p><blockquote style="border-left: 4px solid #ccc; padding-left: 10px; color: #555;">${patch.custom_field || "<i>Cleared</i>"}</blockquote>`,
                }
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to send profile note email:", err);
      }
    }
    return { ok: true };
  });

export const bulkSetEmployeeStatus = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        status: z.enum(["Active", "Inactive"]),
        inactive_reason: z.enum(INACTIVE_REASONS).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (data.status === "Inactive" && !data.inactive_reason) {
      throw new Error("Please choose a reason when marking employees Inactive.");
    }
    const { data: prevRows } = await (supabase.from("profiles") as any)
      .select("id, status")
      .in("id", data.ids);
    const patch: Record<string, any> = { status: data.status };
    patch.inactive_reason = data.status === "Inactive" ? (data.inactive_reason ?? null) : null;
    const { error } = await (supabase.from("profiles") as any).update(patch).in("id", data.ids);
    if (error) throw new Error(error.message);
    const auditRows = (prevRows ?? [])
      .filter((r: any) => (r.status ?? null) !== data.status)
      .map((r: any) => ({
        profile_id: r.id,
        previous_status: r.status ?? null,
        new_status: data.status,
        inactive_reason: data.status === "Inactive" ? (data.inactive_reason ?? null) : null,
        source: "bulk",
        changed_by: userId,
      }));
    if (auditRows.length > 0) {
      await (supabase as any).from("employee_status_audit").insert(auditRows);
    }
    return { ok: true, count: data.ids.length };
  });

export type EmployeeStatusAuditRow = {
  id: string;
  profile_id: string;
  previous_status: string | null;
  new_status: string;
  inactive_reason: string | null;
  source: string;
  changed_by: string | null;
  changed_by_name: string | null;
  created_at: string;
};

export const listEmployeeStatusAudit = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      profile_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional().default(50),
    }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<EmployeeStatusAuditRow[]> => {
    const { supabase } = context;
    let q = (supabase as any).from("employee_status_audit")
      .select("id, profile_id, previous_status, new_status, inactive_reason, source, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.profile_id) q = q.eq("profile_id", data.profile_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const actorIds: string[] = Array.from(
      new Set(((rows ?? []) as any[]).map((r: any) => r.changed_by as string | null).filter((v): v is string => !!v)),
    );
    const nameMap = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      for (const p of profs ?? []) {
        nameMap.set(String((p as any).id), String((p as any).full_name ?? (p as any).email ?? ""));
      }
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      changed_by_name: r.changed_by ? (nameMap.get(String(r.changed_by)) ?? null) : null,
    }));
  });

export const importEmployeesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        employees: z.array(ImportEmployeeRowSchema).min(1).max(500),
        loginUrl: z.string().max(500).optional().default(""),
        appName: z.string().max(120).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ImportEmployeeResult> => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/backend/server/admin-client.server");
    const { sendWelcomeEmail } = await import("@/backend/server/welcome-email.server");

    const [{ data: departments }, { data: positions }] = await Promise.all([
      supabase.from("departments").select("id, name_en"),
      supabase.from("positions").select("id, name_en"),
    ]);
    const departmentMap = new Map((departments ?? []).map((d: any) => [String(d.name_en).toLowerCase(), d.id]));
    const positionMap = new Map((positions ?? []).map((p: any) => [String(p.name_en).toLowerCase(), p.id]));

    // Pre-fetch existing empCodes to detect duplicates against the database.
    const incomingCodes = data.employees
      .map((r) => r.empCode.trim())
      .filter((c) => c.length > 0);
    const existingCodeOwner = new Map<string, string>(); // emp_code -> profile id
    if (incomingCodes.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id, emp_code")
        .in("emp_code", incomingCodes);
      for (const r of existing ?? []) {
        if ((r as any).emp_code) existingCodeOwner.set(String((r as any).emp_code), String((r as any).id));
      }
    }
    const seenCodes = new Set<string>();

    // Pre-fetch existing emails to detect existing employees for merge-update.
    const incomingEmails = Array.from(
      new Set(
        data.employees
          .map((r) => r.email.trim().toLowerCase())
          .filter((e) => e.length > 0),
      ),
    );
    const existingByEmail = new Map<string, any>();
    if (incomingEmails.length > 0) {
      const { data: existingProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, emp_code, full_name, email, phone, role, city, district, department_id, position_id, status, avatar_url")
        .in("email", incomingEmails);
      for (const p of existingProfiles ?? []) {
        existingByEmail.set(String((p as any).email).toLowerCase(), p);
      }
    }

    const results: ImportEmployeeResult["results"] = [];
    for (let index = 0; index < data.employees.length; index++) {
      const row = data.employees[index];
      const fullName = row.name.trim();
      const email = row.email.trim().toLowerCase();
      const role = row.role.trim().toLowerCase() || "employee";
      const empCode = row.empCode.trim();

      try {
        if (!fullName || fullName.length < 2) throw new Error("Name is required");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email required");
        if (!IMPORT_ROLES.includes(role as any)) throw new Error(`Invalid role: ${role}`);
        if (row.idIssueDate.trim() && !isStrictIsoDate(row.idIssueDate.trim())) {
          throw new Error("ID issue date must be YYYY-MM-DD");
        }
        if (row.nationalIdExpiry.trim() && !isStrictIsoDate(row.nationalIdExpiry.trim())) {
          throw new Error("ID expiry date must be YYYY-MM-DD");
        }

        const department_id = row.dept.trim() ? (departmentMap.get(row.dept.trim().toLowerCase()) ?? null) : null;
        const position_id = row.position.trim() ? (positionMap.get(row.position.trim().toLowerCase()) ?? null) : null;
        if (row.dept.trim() && !department_id) throw new Error(`Unknown department: ${row.dept}`);
        if (row.position.trim() && !position_id) throw new Error(`Unknown position: ${row.position}`);

        const existing = existingByEmail.get(email);

        // Validate empCode rules in the context of merge-update semantics.
        if (empCode) {
          if (empCode.length > 40) throw new Error("Employee code too long (max 40 chars)");
          if (seenCodes.has(empCode)) throw new Error(`Duplicate employee code in file: ${empCode}`);
          const owner = existingCodeOwner.get(empCode);
          if (owner && (!existing || owner !== existing.id)) {
            throw new Error(`Employee code already exists: ${empCode}`);
          }
        }

        // If employee already exists by email: merge-update missing fields only.
        if (existing) {
          const patch: Record<string, any> = {};
          const fillIfEmpty = (key: string, value: any) => {
            if (value === null || value === undefined || value === "") return;
            const cur = (existing as any)[key];
            if (cur === null || cur === undefined || cur === "") patch[key] = value;
          };
          fillIfEmpty("emp_code", empCode || null);
          fillIfEmpty("full_name", fullName);
          fillIfEmpty("phone", row.phone.trim() || null);
          fillIfEmpty("city", row.city.trim() || null);
          fillIfEmpty("district", row.district.trim() || null);
          fillIfEmpty("department_id", department_id);
          fillIfEmpty("position_id", position_id);
          fillIfEmpty("avatar_url", row.avatarUrl.trim() || null);
          fillIfEmpty("national_id", row.nationalId.trim() || null);
          fillIfEmpty("id_issue_date", row.idIssueDate.trim() || null);
          fillIfEmpty("id_expiry_date", row.nationalIdExpiry.trim() || null);

          if (Object.keys(patch).length > 0) {
            const { error: updErr } = await (supabaseAdmin.from("profiles") as any)
              .update(patch)
              .eq("id", existing.id);
            if (updErr) throw new Error(updErr.message);
            if (patch.emp_code) {
              existingCodeOwner.set(patch.emp_code, existing.id);
              existing.emp_code = patch.emp_code;
            }
          }

          // Ensure the role exists (no-op if already present).
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: existing.id, role: role as any } as any);

          if (empCode) seenCodes.add(empCode);
          results.push({ index, ok: true, id: String(existing.id), email });
          continue;
        }

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: row.password.trim() || undefined,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (createError) throw new Error(createError.message);
        const newId = created.user?.id;
        if (!newId) throw new Error("Auth user was not created");

        const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
          id: newId,
          emp_code: empCode || null,
          full_name: fullName,
          email,
          phone: row.phone.trim() || null,
          role: role as any,
          city: row.city.trim() || null,
          district: row.district.trim() || null,
          department_id,
          position_id,
          status: row.status === "Inactive" ? "Inactive" : "Active",
          avatar_url: row.avatarUrl.trim() || null,
          national_id: row.nationalId.trim() || null,
          id_issue_date: row.idIssueDate.trim() || null,
          id_expiry_date: row.nationalIdExpiry.trim() || null,
        } as any);
        if (profileError) throw new Error(profileError.message);

        const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: newId, role: role as any } as any);
        if (roleError) throw new Error(roleError.message);

        if (empCode) {
          seenCodes.add(empCode);
          existingCodeOwner.set(empCode, String(newId));
        }
        existingByEmail.set(email, {
          id: newId,
          emp_code: empCode || null,
          full_name: fullName,
          email,
          phone: row.phone.trim() || null,
          city: row.city.trim() || null,
          district: row.district.trim() || null,
          department_id,
          position_id,
          avatar_url: row.avatarUrl.trim() || null,
        });
        results.push({ index, ok: true, id: String(newId), email });

        // Best-effort welcome email and SMS; never blocks import.
        if (data.loginUrl && row.password.trim()) {
          void sendWelcomeEmail({
            to: email,
            employeeName: fullName,
            username: email,
            password: row.password.trim(),
            loginUrl: data.loginUrl,
            appName: data.appName || undefined,
          });

          if (row.phone.trim()) {
            const { sendEmployeeWelcomeSms } = await import("./sms.functions");
            void sendEmployeeWelcomeSms({
              data: {
                mobile: row.phone.trim(),
                email: email,
                password: row.password.trim(),
                loginUrl: data.loginUrl,
              },
            }).catch((err) => console.warn("Import welcome SMS failed:", err));
          }
        }
      } catch (e: any) {
        results.push({ index, ok: false, email, error: e?.message ?? "Import failed" });
      }
    }

    const importedCount = results.filter((r) => r.ok).length;
    return { ok: importedCount === data.employees.length, importedCount, results };
  });

export const createEmployeeAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => CreateEmployeeSchema.parse(input))
  .handler(async ({ context, data }): Promise<CreateEmployeeResult> => {
    const { supabase } = context;

    if (!data.empCode) {
      // Auto-generate employee code
      const { data: lastProfile } = await supabase
        .from("profiles")
        .select("emp_code")
        .like("emp_code", "EMP-%")
        .order("emp_code", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1;
      if (lastProfile && lastProfile.emp_code) {
        const match = lastProfile.emp_code.match(/^EMP-(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      data.empCode = `EMP-${nextNum.toString().padStart(4, "0")}`;
    }

    const { data: result, error } = await supabase.functions.invoke("create-employee-account", { body: data });
    if (error) throw new Error(error.message ?? "Employee account creation failed");
    const created = result as CreateEmployeeResult & { error?: string };
    if (!created?.accountCreated || !created?.profileCreated) {
      throw new Error(created?.error || created?.warning || "Employee account creation failed");
    }

    // Automatically send Welcome SMS with email & password provided in Add Employee form
    if (data.phone && data.password) {
      try {
        const { sendEmployeeWelcomeSms } = await import("./sms.functions");
        await sendEmployeeWelcomeSms({
          data: {
            mobile: data.phone,
            email: data.email,
            password: data.password,
            loginUrl: data.loginUrl,
          },
        });
      } catch (smsErr) {
        console.warn("Automatic welcome SMS failed:", smsErr);
      }
    }

    if (created?.id && data.shiftId) {
      try {
        await (supabase.from("employee_shifts") as any).delete().eq("employee_id", created.id);
        await (supabase.from("employee_shifts") as any).insert({
          employee_id: created.id,
          shift_id: data.shiftId,
        });
      } catch (shiftErr) {
        console.warn("Failed to assign shift:", shiftErr);
      }
    }

    if (created?.id && (data.sectionId || data.jobGrade || data.medicalInsuranceNumber || data.medicalInsuranceType)) {
      try {
        const p: Record<string, any> = {};
        if (data.sectionId) p.section_id = data.sectionId;
        if (data.jobGrade) p.job_grade = data.jobGrade;
        if (data.medicalInsuranceNumber) p.medical_insurance_number = data.medicalInsuranceNumber;
        if (data.medicalInsuranceType) p.medical_insurance_type = data.medicalInsuranceType;
        await (supabase.from("profiles") as any).update(p).eq("id", created.id);
      } catch (err) {
        console.warn("Failed to set sectionId / jobGrade / medical insurance on profile:", err);
      }
    }

    return created;
  });

export const deleteEmployeeAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/backend/server/admin-client.server");
    await hardDeleteUser(supabaseAdmin, data.id);
    return { ok: true };
  });

/**
 * Send the employee welcome email (username + password + login URL).
 * Used by the single Add Employee form, which today persists locally but
 * still needs to email the credentials to the new hire.
 */
export const sendEmployeeWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        to: z.string().email(),
        employeeName: z.string().min(1).max(160),
        username: z.string().min(1).max(160),
        password: z.string().min(1).max(256),
        loginUrl: z.string().min(1).max(500),
        appName: z.string().max(120).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { sendWelcomeEmail } = await import("@/backend/server/welcome-email.server");
    const res = await sendWelcomeEmail({
      to: data.to,
      employeeName: data.employeeName,
      username: data.username,
      password: data.password,
      loginUrl: data.loginUrl,
      appName: data.appName || undefined,
    });
    return res;
  });

export const bulkDeleteEmployeesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/backend/server/admin-client.server");
    let count = 0;
    const errors: string[] = [];
    for (const id of data.ids) {
      try {
        await hardDeleteUser(supabaseAdmin, id);
        count++;
      } catch (e: any) {
        errors.push(`${id}: ${e?.message ?? "delete failed"}`);
      }
    }
    return { ok: errors.length === 0, count, errors };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function hardDeleteUser(admin: any, id: string) {
  // Delete dependent rows first so nothing is left if auth.users has no FK cascade.
  await admin.from("user_roles").delete().eq("user_id", id);
  await admin.from("profiles").delete().eq("id", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  // Ignore "user not found" — auth row may have been removed already.
  if (error && !/not.*found/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export type CityRow = { id: string; name_en: string };
export type DistrictRow = { id: string; city_id: string; name_en: string };
export type ShiftOption = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_overnight: boolean;
  is_active: boolean;
};

export const listCitiesAndDistricts = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<{
    cities: CityRow[];
    districts: DistrictRow[];
    departments: { id: string; name_en: string }[];
    sections: { id: string; department_id: string; name_en: string }[];
    positions: { id: string; name_en: string }[];
    managers: { id: string; name: string }[];
    costCenters: { id: string; code: string; name_en: string; name_ar: string; status: string }[];
    shifts: ShiftOption[];
    jobGrades: { id: string; name_en: string; name_ar: string; active: boolean }[];
  }> => {
    const { supabase } = context;
    const [{ data: cities }, { data: districts }, { data: depts }, { data: secs }, { data: poss }, { data: mgrs }, { data: mgrRoles }, costCentersRes, shiftsRes, jobGradesRes] = await Promise.all([
      supabase.from("cities").select("id, name_en").order("name_en"),
      supabase.from("districts").select("id, city_id, name_en").order("name_en"),
      supabase.from("departments").select("id, name_en").order("name_en"),
      (supabase as any).from("sections").select("id, department_id, name_en").order("name_en"),
      supabase.from("positions").select("id, name_en").order("name_en"),
      supabase.from("profiles").select("id, full_name, email").eq("status", "Active").order("full_name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "manager"]),
      (supabase as any).from("cost_centers").select("id, code, name_en, name_ar, status").order("code").then((r: any) => r.data ?? []).catch(() => []),
      (supabase as any).from("shifts").select("id, name, start_time, end_time, grace_minutes, is_overnight, is_active").order("name").then((r: any) => r.data ?? []).catch(() => []),
      (supabase as any).from("job_grades").select("id, name_en, name_ar, active").order("name_en").then((r: any) => r.data ?? []).catch(() => []),
    ]);
    const allowedMgrIds = new Set((mgrRoles ?? []).map((r: any) => r.user_id));
    const filteredMgrs = (mgrs ?? []).filter((m: any) => allowedMgrIds.has(m.id));
    return {
      cities: (cities ?? []).map((c: any) => ({ id: c.id, name_en: c.name_en })),
      districts: (districts ?? []).map((d: any) => ({ id: d.id, city_id: d.city_id, name_en: d.name_en })),
      departments: (depts ?? []).map((d: any) => ({ id: d.id, name_en: d.name_en })),
      sections: (secs ?? []).map((s: any) => ({ id: s.id, department_id: s.department_id, name_en: s.name_en })),
      positions: (poss ?? []).map((p: any) => ({ id: p.id, name_en: p.name_en })),
      managers: filteredMgrs.map((m: any) => ({ id: m.id, name: m.full_name ?? m.email ?? "—" })),
      costCenters: (Array.isArray(costCentersRes) ? costCentersRes : []).map((c: any) => ({
        id: c.id,
        code: c.code,
        name_en: c.name_en,
        name_ar: c.name_ar,
        status: c.status,
      })),
      shifts: (Array.isArray(shiftsRes) ? shiftsRes : []).map((s: any) => ({
        id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        grace_minutes: s.grace_minutes ?? 0,
        is_overnight: !!s.is_overnight,
        is_active: s.is_active !== false,
      })),
      jobGrades: (Array.isArray(jobGradesRes) ? jobGradesRes : []).map((g: any) => ({
        id: g.id,
        name_en: g.name_en,
        name_ar: g.name_ar,
        active: g.active ?? true,
      })),
    };
  });

export type ProfileDocument = {
  id: string;
  profile_id: string;
  kind: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  data_url: string;
  created_at: string;
};

export const listEmployeeDocuments = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ profile_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ProfileDocument[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("profile_documents")
      .select("id, profile_id, kind, name, mime_type, size_bytes, data_url, created_at")
      .eq("profile_id", data.profile_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any;
  });

export const uploadEmployeeDocument = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z
      .object({
        profile_id: z.string().uuid(),
        kind: z.string().min(1).max(64),
        name: z.string().min(1).max(255),
        mime_type: z.enum(["application/pdf", "image/png", "image/jpeg"]),
        size_bytes: z.number().int().min(1).max(2 * 1024 * 1024),
        data_url: z.string().min(16).max(4 * 1024 * 1024),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase.from("profile_documents") as any)
      .insert({
        profile_id: data.profile_id,
        kind: data.kind,
        name: data.name,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        data_url: data.data_url,
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any).id };
  });

export const deleteEmployeeDocument = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("profile_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type EmployeeDetail = {
  id: string;
  emp_code: string | null;
  full_name: string | null;
  full_name_ar: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  department: string | null;
  position: string | null;
  department_id: string | null;
  position_id: string | null;
  city_id: string | null;
  district_id: string | null;
  city: string | null;
  district: string | null;
  status: string;
  inactive_reason: string | null;
  avatar_url: string | null;
  manager_id: string | null;
  manager_name: string | null;
  locale: string | null;
  national_id: string | null;
  id_issue_date: string | null;
  id_expiry_date: string | null;
  salary_mode: "gross" | "net" | null;
  salary_gross: number | null;
  salary_net: number | null;
  allowance: number | null;
  target_value: number | null;
  target_duration: string | null;
  contract_type: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_cancelled: boolean;
  insurance_salary: number | null;
  emergency_fund: number | null;
  job_grade: string | null;
  cost_center_id: string | null;
  cost_center_code: string | null;
  cost_center_name: string | null;
  shift_id: string | null;
  shift_name: string | null;
  extra_email: string | null;
  medical_insurance_details: string | null;
  medical_insurance_number: string | null;
  medical_insurance_type: string | null;
  is_insured: boolean;
  military_expire_date: string | null;
  is_five_percent: boolean;
  social_insurance_date: string | null;
  custom_field: string | null;
  last_action_date: string | null;
  updated_at: string | null;
  created_at: string;
  roles: string[];
};

export const getEmployeeDetail = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<EmployeeDetail | null> => {
    const { supabase } = context;
    let { data: p, error } = await supabase
      .from("profiles")
      .select("id, emp_code, full_name, full_name_ar, cost_center_id, email, phone, gender, department_id, position_id, city_id, district_id, city, district, status, inactive_reason, avatar_url, manager_id, locale, national_id, id_issue_date, id_expiry_date, salary_mode, salary_gross, salary_net, allowance, target_value, target_duration, contract_type, contract_start_date, contract_end_date, contract_cancelled, job_grade, extra_email, medical_insurance_details, medical_insurance_number, medical_insurance_type, is_insured, military_expire_date, is_five_percent, social_insurance_date, custom_field, last_action_date, created_at, updated_at, insurance_salary, emergency_fund")
      .eq("id", data.id)
      .maybeSingle();
    if (error && (
      error.message?.includes("full_name_ar") || error.details?.includes("full_name_ar") ||
      error.message?.includes("cost_center_id") || error.details?.includes("cost_center_id") ||
      error.message?.includes("medical_insurance_number") || error.details?.includes("medical_insurance_number") ||
      error.message?.includes("medical_insurance_type") || error.details?.includes("medical_insurance_type")
    )) {
      const fb = await supabase
        .from("profiles")
        .select("id, emp_code, full_name, email, phone, gender, department_id, position_id, city_id, district_id, city, district, status, inactive_reason, avatar_url, manager_id, locale, national_id, id_issue_date, id_expiry_date, salary_mode, salary_gross, salary_net, allowance, target_value, target_duration, contract_type, contract_start_date, contract_end_date, contract_cancelled, job_grade, extra_email, medical_insurance_details, is_insured, military_expire_date, is_five_percent, social_insurance_date, custom_field, last_action_date, created_at, updated_at, insurance_salary, emergency_fund")
        .eq("id", data.id)
        .maybeSingle();
      p = fb.data as any;
      error = fb.error;
    }
    if (error) throw new Error(error.message);
    if (!p) return null;
    const [{ data: dept }, { data: pos }, { data: roles }, { data: mgr }, { data: cityRow }, { data: distRow }, ccRow, shiftRow] = await Promise.all([
      (p as any).department_id
        ? supabase.from("departments").select("name_en").eq("id", (p as any).department_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (p as any).position_id
        ? supabase.from("positions").select("name_en").eq("id", (p as any).position_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("user_roles").select("role").eq("user_id", data.id),
      (p as any).manager_id
        ? supabase.from("profiles").select("full_name").eq("id", (p as any).manager_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (p as any).city_id
        ? supabase.from("cities").select("name_en").eq("id", (p as any).city_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (p as any).district_id
        ? supabase.from("districts").select("name_en").eq("id", (p as any).district_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (p as any).cost_center_id
        ? (supabase as any).from("cost_centers").select("id, code, name_en, name_ar").eq("id", (p as any).cost_center_id).maybeSingle().then((r: any) => r.data).catch(() => null)
        : Promise.resolve(null),
      (supabase as any).from("employee_shifts").select("shift_id, shifts(id, name, start_time, end_time)").eq("employee_id", data.id).limit(1).maybeSingle().then((r: any) => r.data).catch(() => null),
    ]);
    return {
      id: (p as any).id,
      emp_code: (p as any).emp_code ?? null,
      full_name: (p as any).full_name,
      full_name_ar: (p as any).full_name_ar ?? null,
      email: (p as any).email,
      phone: (p as any).phone,
      gender: (p as any).gender ?? null,
      department: (dept as any)?.name_en ?? null,
      position: (pos as any)?.name_en ?? null,
      department_id: (p as any).department_id ?? null,
      position_id: (p as any).position_id ?? null,
      city_id: (p as any).city_id ?? null,
      district_id: (p as any).district_id ?? null,
      city: (cityRow as any)?.name_en ?? (p as any).city ?? null,
      district: (distRow as any)?.name_en ?? (p as any).district ?? null,
      status: (p as any).status ?? "Active",
      inactive_reason: (p as any).inactive_reason ?? null,
      avatar_url: (p as any).avatar_url ?? null,
      manager_id: (p as any).manager_id ?? null,
      manager_name: (mgr as any)?.full_name ?? null,
      locale: (p as any).locale ?? null,
      national_id: (p as any).national_id ?? null,
      id_issue_date: (p as any).id_issue_date ?? null,
      id_expiry_date: (p as any).id_expiry_date ?? null,
      salary_mode: (p as any).salary_mode ?? null,
      salary_gross: (p as any).salary_gross !== null && (p as any).salary_gross !== undefined ? Number((p as any).salary_gross) : null,
      salary_net: (p as any).salary_net !== null && (p as any).salary_net !== undefined ? Number((p as any).salary_net) : null,
      allowance: (p as any).allowance !== null && (p as any).allowance !== undefined ? Number((p as any).allowance) : null,
      target_value: (p as any).target_value !== null && (p as any).target_value !== undefined ? Number((p as any).target_value) : null,
      target_duration: (p as any).target_duration ?? null,
      contract_type: (p as any).contract_type ?? null,
      contract_start_date: (p as any).contract_start_date ?? null,
      contract_end_date: (p as any).contract_end_date ?? null,
      contract_cancelled: !!(p as any).contract_cancelled,
      job_grade: (p as any).job_grade ?? null,
      cost_center_id: (p as any).cost_center_id ?? null,
      cost_center_code: (ccRow as any)?.code ?? null,
      cost_center_name: (ccRow as any)?.name_en ? `${(ccRow as any).name_en} (${(ccRow as any).name_ar || ""})` : null,
      shift_id: (shiftRow as any)?.shift_id ?? null,
      shift_name: (shiftRow as any)?.shifts?.name ? `${(shiftRow as any).shifts.name} (${(shiftRow as any).shifts.start_time ?? ""} - ${(shiftRow as any).shifts.end_time ?? ""})` : null,
      extra_email: (p as any).extra_email ?? null,
      medical_insurance_details: (p as any).medical_insurance_details ?? null,
      medical_insurance_number: (p as any).medical_insurance_number ?? null,
      medical_insurance_type: (p as any).medical_insurance_type ?? null,
      is_insured: !!(p as any).is_insured,
      military_expire_date: (p as any).military_expire_date ?? null,
      is_five_percent: !!(p as any).is_five_percent,
      social_insurance_date: (p as any).social_insurance_date ?? null,
      custom_field: (p as any).custom_field ?? null,
      last_action_date: (p as any).last_action_date ?? null,
      updated_at: (p as any).updated_at ?? null,
      created_at: (p as any).created_at,
      roles: (roles ?? []).map((r: any) => String(r.role)),
      insurance_salary: (p as any).insurance_salary !== null && (p as any).insurance_salary !== undefined ? Number((p as any).insurance_salary) : null,
      emergency_fund: (p as any).emergency_fund !== null && (p as any).emergency_fund !== undefined ? Number((p as any).emergency_fund) : null,
    };
  });

async function assertAdminOrHr(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "hr");
  if (!ok) throw new Error("Forbidden");
}

export const getEmployeeAttendanceHistory = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ employee_id: z.string().uuid(), limit: z.number().int().min(1).max(500).default(180) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select("id, date, in_time, out_time, branch, status, note, city, district, free_check")
      .eq("employee_id", data.employee_id)
      .order("date", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getEmployeeLeavesHistory = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) => z.object({ employee_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("leaves")
      .select("id, leave_type_name, start_date, end_date, days, paid, reason, status, created_at")
      .eq("employee_id", data.employee_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const bulkAssignEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      role: z.enum(["admin", "hr", "manager", "employee"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdminOrHr(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/backend/server/admin-client.server");
    const rows = data.ids.map((user_id) => ({ user_id, role: data.role }));
    const { error } = await (supabaseAdmin.from("user_roles") as any)
      .upsert(rows, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const adminTransferEmployee = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((i) => z.object({
    employee_id: z.string().uuid(),
    new_department_id: z.string().uuid().optional().nullable(),
    new_position_id: z.string().uuid().optional().nullable(),
    new_manager_id: z.string().uuid().optional().nullable(),
    effective_date: z.string(),
    note: z.string().optional()
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase.from("profiles")
      .select("department_id, position_id, manager_id")
      .eq("id", data.employee_id)
      .single();

    if (!profile) throw new Error("Employee not found");

    const { error: transferErr } = await (supabase as any).from("department_transfers").insert({
      employee_id: data.employee_id,
      old_department_id: profile.department_id,
      new_department_id: data.new_department_id,
      old_position_id: profile.position_id,
      new_position_id: data.new_position_id,
      old_manager_id: profile.manager_id,
      new_manager_id: data.new_manager_id,
      effective_date: data.effective_date,
      note: data.note,
      created_by: userId,
    });

    if (transferErr) throw new Error("Failed to create transfer audit log: " + transferErr.message);

    const updates: Record<string, any> = {};
    if (data.new_department_id !== undefined) updates.department_id = data.new_department_id;
    if (data.new_position_id !== undefined) updates.position_id = data.new_position_id;
    if (data.new_manager_id !== undefined) updates.manager_id = data.new_manager_id;

    if (Object.keys(updates).length > 0) {
      const { error: profErr } = await supabase.from("profiles").update(updates as any).eq("id", data.employee_id);
      if (profErr) throw new Error("Failed to update employee profile: " + profErr.message);
    }

    return { ok: true };
  });