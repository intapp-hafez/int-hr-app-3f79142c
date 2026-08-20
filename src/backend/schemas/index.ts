import { z } from "zod";

export const SmtpConfigSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().max(255),
  password: z.string().max(512).optional(),
  from_email: z.string().email().or(z.literal("")),
  from_name: z.string().max(255),
});
export type SmtpConfigInput = z.infer<typeof SmtpConfigSchema>;

export const SmsConfigSchema = z.object({
  environment: z.enum(["1", "2"]),
  username: z.string().max(255),
  password: z.string().max(255).optional(),
  api_key: z.string().max(512).optional(),
  sender: z.string().max(64),
  language: z.enum(["1", "2", "3"]).default("1"),
  enabled: z.boolean().default(false),
});
export type SmsConfigInput = z.infer<typeof SmsConfigSchema>;

export const SmsSendSchema = z.object({
  mobile: z.string().min(5).max(500), // comma-separated numbers
  message: z.string().min(1).max(1000),
  language: z.enum(["1", "2", "3"]).optional(),
  delayUntil: z.string().regex(/^\d{12}$/).optional(),
});
export type SmsSendInput = z.infer<typeof SmsSendSchema>;

export const NotificationPrefsSchema = z.object({
  push_enabled: z.boolean(),
  email_enabled: z.boolean(),
  inapp_enabled: z.boolean(),
  quiet_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
  quiet_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
  timezone: z.string().min(1).max(64),
});

export const ExportScheduleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  employee_ids: z.array(z.string().uuid()).max(500).default([]),
  date_range_kind: z.enum(["today", "yesterday", "last_7_days", "last_30_days"]).default("today"),
  format: z.enum(["csv", "xlsx"]),
  recipients: z.array(z.string().email()).min(1).max(50),
  send_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timezone: z.string().min(1).max(64),
  enabled: z.boolean(),
  report_kind: z.enum(["activity", "id_expiry", "contract_expiry"]).default("activity"),
  frequency: z.enum(["daily", "weekly"]).default("daily"),
  weekday: z.number().int().min(0).max(6).nullable().default(null),
  expiry_days: z.number().int().min(1).max(365).default(30),
});
export type ExportScheduleInput = z.infer<typeof ExportScheduleSchema>;

export const TaskActivitySchema = z.object({
  kind: z.enum(["start_task", "complete_task", "start_trip", "complete_trip"]),
  task_id: z.string().uuid().optional().nullable(),
  task_name: z.string().max(255).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});
export type TaskActivityInput = z.infer<typeof TaskActivitySchema>;

// ── Directory ──────────────────────────────────────────────
export const NamedRowSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().min(1).max(120),
  name_ar: z.string().max(120).default(""),
  active: z.boolean().optional(),
  responsible_person_id: z.string().uuid().nullable().optional(),
});
export const DistrictRowSchema = z.object({
  id: z.string().uuid().optional(),
  city_id: z.string().uuid(),
  name_en: z.string().min(1).max(120),
  name_ar: z.string().max(120).default(""),
});
export const LeaveTypeRowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  annual_days: z.number().int().min(0).max(365).default(0),
  paid: z.boolean().default(true),
  active: z.boolean().default(true),
  requires_proof: z.boolean().default(false),
});

// ── Attendance ─────────────────────────────────────────────
export const AttendanceCheckSchema = z.object({
  branch: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  network_ok: z.boolean().optional(),
  note: z.string().max(500).optional(),
  ssid: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  street: z.string().max(255).optional().nullable(),
  device_id: z.string().optional(),
});

// ── Leaves ────────────────────────────────────────────────
export const LeaveSubmitSchema = z.object({
  leave_type_id: z.string().uuid().optional().nullable(),
  leave_type_name: z.string().max(120).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(365),
  paid: z.boolean().default(true),
  reason: z.string().max(1000).optional(),
  proof_url: z.string().max(2_500_000).optional().nullable(),
  proof_mime: z.string().max(64).optional().nullable(),
  proof_name: z.string().max(255).optional().nullable(),
});
export const LeaveDecideSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "cancelled"]),
});

// ── Tasks / Trips ─────────────────────────────────────────
export const TaskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_time: z.string().max(8).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  estimated_hours: z.number().min(0).max(999).optional().nullable(),
  assignees: z.array(z.string().uuid()).max(50).default([]),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  radius_m: z.number().min(10).max(100000).optional().nullable(),
});
export const TripCreateSchema = z.object({
  destination: z.string().min(1).max(200),
  address: z.string().max(255).optional().nullable(),
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trip_time: z.string().max(8).optional().nullable(),
  purpose: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  city: z.string().uuid().optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  radius_m: z.number().min(10).max(100000).optional().nullable(),
  assignee: z.string().uuid(),
  overnight_nights: z.number().min(0).max(365).optional().default(0),
  transport_type: z.string().max(50).optional().nullable(),
  manual_allowance: z.number().min(0).max(100000).optional().nullable(),
});
export const TransitionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]),
  note: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// ── Admin config tables ───────────────────────────────────
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export const ShiftSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  start_time: z.string().regex(TIME_RE, "Use HH:mm"),
  end_time: z.string().regex(TIME_RE, "Use HH:mm"),
  grace_minutes: z.number().int().min(0).max(240).default(0),
  is_overnight: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const LatePenaltySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  from_minutes: z.number().int().min(0).max(600),
  to_minutes: z.number().int().min(0).max(600),
  penalty_type: z.enum(["deduction_minutes", "deduction_amount", "warning"]),
  penalty_value: z.number().min(0).max(1000000).default(0),
  is_active: z.boolean().default(true),
}).refine((d) => d.to_minutes >= d.from_minutes, { path: ["to_minutes"], message: "Must be ≥ from" });

export const AllowanceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["fixed", "percent", "per_day", "per_km"]),
  amount: z.number().min(0).max(1000000).default(0),
  currency: z.string().trim().min(1).max(8).default("EGP"),
  taxable: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const TargetsOvertimeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  daily_target_hours: z.number().min(0).max(24).default(8),
  weekly_target_hours: z.number().min(0).max(168).default(40),
  overtime_rate: z.number().min(0).max(10).default(1.5),
  overtime_cap_hours: z.number().min(0).max(168).default(4),
  is_active: z.boolean().default(true),
});

export const KpiSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  metric: z.string().trim().min(1).max(200),
  target_value: z.number().min(0).max(1e12).default(0),
  unit: z.string().trim().max(40).optional().nullable(),
  period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  weight: z.number().min(0).max(100).default(1),
  is_active: z.boolean().default(true),
});

export const HolidayTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use #RRGGBB").default("#3B82F6"),
  is_paid: z.boolean().default(true),
  affects_attendance: z.boolean().default(true),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const NetworkSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  ssid: z.string().trim().max(64).optional().nullable(),
  bssid: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, "Use MAC format AA:BB:CC:DD:EE:FF").optional().nullable().or(z.literal("")),
  branch: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
});

// ── Admin attendance CRUD ────────────────────────────────
export const AdminAttendanceSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  in_time: z.string().regex(TIME_RE).optional().nullable(),
  out_time: z.string().regex(TIME_RE).optional().nullable(),
  branch: z.string().trim().max(120).optional().nullable(),
  status: z.enum(["present", "late", "absent", "leave"]),
  note: z.string().trim().max(500).optional().nullable(),
});

// ── Employee Advance Management ────────────────────────────
export const ADVANCE_STATUSES = [
  "draft",
  "pending_manager",
  "pending_hr",
  "pending_finance",
  "approved_for_payment",
  "paid",
  "rejected",
  "cancelled",
  "returned",
] as const;
export type AdvanceStatus = (typeof ADVANCE_STATUSES)[number];

export const AdvanceRequestSchema = z.object({
  requested_amount: z.number().positive("Amount must be greater than zero"),
  reason: z.string().min(1, "Reason is required").max(2000),
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  attachment_url: z.string().max(2_500_000).optional().nullable(),
  currency: z.string().max(8).default("EGP"),
});
export type AdvanceRequestInput = z.infer<typeof AdvanceRequestSchema>;

export const AdvanceDecideSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approved", "rejected", "returned", "cancelled"]),
  comments: z.string().max(2000).optional().nullable(),
});
export type AdvanceDecideInput = z.infer<typeof AdvanceDecideSchema>;

export const AdvancePaymentSchema = z.object({
  id: z.string().uuid(),
  approved_amount: z.number().positive(),
  installment_count: z.number().int().min(1).max(60),
  deduction_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comments: z.string().max(2000).optional().nullable(),
});
export type AdvancePaymentInput = z.infer<typeof AdvancePaymentSchema>;