import { useRef, useSyncExternalStore } from "react";
import {
  employees as initialEmployees,
  locations as initialLocations,
  leaveRequests as initialLeaves,
  wifiNetworks as initialNetworks,
} from "./mock-data";

export type Employee = (typeof initialEmployees)[number];
export type PayrollOverrides = {
  presentOverride?: number;
  lateOverride?: number;
  absentOverride?: number;
  leaveOverride?: number;
  bonus?: number;
  extraPenalty?: number;
};
export type Location = (typeof initialLocations)[number];
export type LeaveRequest = (typeof initialLeaves)[number] & { reason?: string };
export type Network = (typeof initialNetworks)[number];

export type AttendanceLog = {
  id: string;
  employeeId: string;
  date: string;
  inTime?: string;
  outTime?: string;
  branch: string;
  status: "present" | "late" | "absent";
};

export type AuditEvent = {
  id: string;
  ts: number;
  employeeId: string;
  employeeName: string;
  action: "check-in" | "check-out" | "rehire";
  result: "success" | "blocked";
  branch?: string;
  gps: "ok" | "fail" | "unknown";
  network: "ok" | "fail" | "unknown";
  ssid?: string;
  distanceM?: number;
  reason?: string;
  device?: string;
};

export type Device = {
  id: string;
  employeeId: string;
  label: string;
  userAgent: string;
  registeredAt: number;
  status: "pending" | "approved" | "revoked";
};

export type Kpi = { id: string; name: string; weight: number; target: number; unit: string };

export type LeaveTypeDef = { id: string; name: string; annualDays: number; paid: boolean; active: boolean };
export type HolidayTypeDef = { id: string; name: string; active: boolean };

export type DepartmentDef = { id: string; nameEn: string; nameAr: string; active: boolean };
export type PositionDef = { id: string; nameEn: string; nameAr: string; active: boolean };
export type DistrictDef = { id: string; nameEn: string; nameAr: string };
export type CityDef = { id: string; nameEn: string; nameAr: string; districts: DistrictDef[] };

export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskHistoryEntry = {
  ts: number;
  by: string;             // employeeId who acted
  from?: TaskStatus;
  to: TaskStatus;
  note?: string;
};
export type ManagerTask = {
  id: string;
  title: string;
  description: string;
  date: string;        // YYYY-MM-DD
  dueTime?: string;    // HH:mm
  priority: TaskPriority;
  assignees: string[]; // employeeIds
  status: TaskStatus;
  createdBy: string;   // manager employeeId
  createdAt: number;
  // Site/location & effort
  city?: string;
  district?: string;
  address?: string;
  estimatedHours?: number;
  // Employee progress (check-in/out via task)
  startedAt?: number;
  completedAt?: number;
  history?: TaskHistoryEntry[];
};
export type ManagerTrip = {
  id: string;
  destination: string;
  address: string;
  date: string;
  time?: string;
  purpose: string;
  assignee: string;    // employeeId
  status: TaskStatus;
  notes?: string;
  createdBy: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  history?: TaskHistoryEntry[];
};

export type Notification = {
  id: string;
  ts: number;
  audience: "manager" | "hr";
  audienceId?: string; // manager's employee id (when audience === "manager")
  title: string;
  body: string;
  meta?: Record<string, string | number | undefined>;
  read: boolean;
};

// ── SMTP & notification preferences ───────────────
export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;       // SSL/TLS
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  enabled: boolean;
};

export type NotifChannels = { push: boolean; email: boolean; inApp: boolean };
export type QuietHours = { enabled: boolean; start: string; end: string }; // "HH:mm"
export type NotifPrefs = { channels: NotifChannels; quietHours: QuietHours };

export type NotifDelivery = {
  id: string;
  ts: number;
  channel: "push" | "email" | "inApp";
  recipientKey: string;     // "hr" or "manager:<empId>"
  recipientLabel: string;
  title: string;
  body: string;
  status: "sent" | "suppressed_quiet" | "suppressed_pref" | "skipped_smtp";
};

// ── Scheduled HR auto-exports ─────────────────────
export type ExportSchedule = {
  id: string;
  name: string;
  enabled: boolean;
  employeeIds: string[];                   // empty = all employees
  rangeKind: "today" | "yesterday" | "last7" | "last30";
  format: "csv" | "xlsx";
  sendTime: string;                        // "HH:mm"
  recipients: string[];                    // email addresses
  lastRunDate?: string;                    // YYYY-MM-DD of last execution
  lastRunStatus?: "sent" | "skipped_smtp" | "no_records";
};

const DEFAULT_PREFS: NotifPrefs = {
  channels: { push: true, email: true, inApp: true },
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
};
const DEFAULT_SMTP: SmtpSettings = {
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  username: "",
  password: "",
  fromName: "INT-HR",
  fromEmail: "",
  enabled: false,
};

export type Policy = {
  // Shift
  shiftIn: string;       // "09:00"
  shiftOut: string;      // "17:00"
  graceMinutes: number;  // late grace
  // Late tiers (minutes ⇒ EGP penalty)
  lateTier1Min: number; lateTier1Penalty: number;
  lateTier2Min: number; lateTier2Penalty: number;
  lateTier3Min: number; lateTier3Penalty: number;
  // Early checkout (minutes ⇒ EGP penalty per occurrence)
  earlyGraceMinutes: number;
  earlyPenaltyPerHour: number;
  // Absent
  absentPenaltyPerDay: number;
  // Overtime
  overtimeRatePerHour: number;
  overtimeAfterMinutes: number;
  // Allowances
  transportAllowance: number;
  mealAllowance: number;
  housingAllowance: number;
  // Targets / KPI
  defaultMonthlyTarget: number;
  targetBonusPerUnit: number;
  kpis: Kpi[];
  leaveTypes: LeaveTypeDef[];
  holidayTypes: HolidayTypeDef[];
  departments: DepartmentDef[];
  positions: PositionDef[];
  cities: CityDef[];
};

const DEFAULT_POLICY: Policy = {
  shiftIn: "09:00",
  shiftOut: "17:00",
  graceMinutes: 5,
  lateTier1Min: 10,  lateTier1Penalty: 25,
  lateTier2Min: 30,  lateTier2Penalty: 75,
  lateTier3Min: 60,  lateTier3Penalty: 200,
  earlyGraceMinutes: 5,
  earlyPenaltyPerHour: 100,
  absentPenaltyPerDay: 500,
  overtimeRatePerHour: 75,
  overtimeAfterMinutes: 30,
  transportAllowance: 500,
  mealAllowance: 400,
  housingAllowance: 1000,
  defaultMonthlyTarget: 20,
  targetBonusPerUnit: 50,
  kpis: [
    { id: "k1", name: "Attendance Rate", weight: 30, target: 95, unit: "%" },
    { id: "k2", name: "Sales Closed", weight: 40, target: 20, unit: "deals" },
    { id: "k3", name: "Customer Satisfaction", weight: 30, target: 4.5, unit: "/5" },
  ],
  leaveTypes: [
    { id: "lt1", name: "Annual Leave", annualDays: 21, paid: true, active: true },
    { id: "lt2", name: "Sick Leave", annualDays: 14, paid: true, active: true },
    { id: "lt3", name: "Emergency", annualDays: 5, paid: true, active: true },
    { id: "lt4", name: "Hajj/Umrah", annualDays: 30, paid: true, active: true },
    { id: "lt5", name: "Unpaid", annualDays: 0, paid: false, active: true },
  ],
  holidayTypes: [
    { id: "ht1", name: "Religious", active: true },
    { id: "ht2", name: "National", active: true },
    { id: "ht3", name: "Company", active: true },
  ],
  departments: [
    { id: "d1", nameEn: "Sales", nameAr: "المبيعات", active: true },
    { id: "d2", nameEn: "Marketing", nameAr: "التسويق", active: true },
    { id: "d3", nameEn: "Human Resources", nameAr: "الموارد البشرية", active: true },
    { id: "d4", nameEn: "Engineering", nameAr: "الهندسة", active: true },
    { id: "d5", nameEn: "Finance", nameAr: "المالية", active: true },
    { id: "d6", nameEn: "Operations", nameAr: "العمليات", active: true },
  ],
  positions: [
    { id: "p1", nameEn: "Manager", nameAr: "مدير", active: true },
    { id: "p2", nameEn: "Team Lead", nameAr: "قائد فريق", active: true },
    { id: "p3", nameEn: "Senior", nameAr: "أول", active: true },
    { id: "p4", nameEn: "Junior", nameAr: "مبتدئ", active: true },
    { id: "p5", nameEn: "Intern", nameAr: "متدرب", active: true },
  ],
  cities: [
    {
      id: "c1", nameEn: "Cairo", nameAr: "القاهرة",
      districts: [
        { id: "c1d1", nameEn: "Nasr City", nameAr: "مدينة نصر" },
        { id: "c1d2", nameEn: "Maadi", nameAr: "المعادي" },
        { id: "c1d3", nameEn: "Heliopolis", nameAr: "مصر الجديدة" },
        { id: "c1d4", nameEn: "Zamalek", nameAr: "الزمالك" },
        { id: "c1d5", nameEn: "Downtown", nameAr: "وسط البلد" },
      ],
    },
    {
      id: "c2", nameEn: "Alexandria", nameAr: "الإسكندرية",
      districts: [
        { id: "c2d1", nameEn: "Smouha", nameAr: "سموحة" },
        { id: "c2d2", nameEn: "Sidi Gaber", nameAr: "سيدي جابر" },
        { id: "c2d3", nameEn: "Stanley", nameAr: "ستانلي" },
        { id: "c2d4", nameEn: "Miami", nameAr: "ميامي" },
      ],
    },
    {
      id: "c3", nameEn: "Giza", nameAr: "الجيزة",
      districts: [
        { id: "c3d1", nameEn: "Dokki", nameAr: "الدقي" },
        { id: "c3d2", nameEn: "Mohandessin", nameAr: "المهندسين" },
        { id: "c3d3", nameEn: "6th of October", nameAr: "السادس من أكتوبر" },
        { id: "c3d4", nameEn: "Sheikh Zayed", nameAr: "الشيخ زايد" },
      ],
    },
  ],
};

type State = {
  employees: Employee[];
  locations: Location[];
  leaves: LeaveRequest[];
  networks: Network[];
  attendance: AttendanceLog[];
  auditLog: AuditEvent[];
  devices: Device[];
  currentEmployeeId: string;
  todayCheckInAt?: string;
  todayCheckOutAt?: string;
  policy: Policy;
  contractOverrides: Record<string, { start?: string; end?: string; status?: "active" | "cancelled" }>;
  tasks: ManagerTask[];
  trips: ManagerTrip[];
  notifications: Notification[];
  smtp: SmtpSettings;
  notifPrefs: Record<string, NotifPrefs>; // key: "hr" | `manager:${empId}`
  notifDeliveries: NotifDelivery[];
  exportSchedules: ExportSchedule[];
};

const today = () => new Date().toISOString().slice(0, 10);

// Seed one already-approved device for the current employee so the demo flow works.
const SEED_DEVICE_ID = "DEV-SEED-INT-001";

const state: State = {
  employees: [...initialEmployees],
  locations: [...initialLocations],
  leaves: [...initialLeaves],
  networks: [...initialNetworks],
  attendance: [],
  auditLog: [],
  devices: [
    {
      id: SEED_DEVICE_ID,
      employeeId: "INT-001",
      label: "Hafez's Phone",
      userAgent: "Demo Seed Device",
      registeredAt: Date.now() - 86_400_000,
      status: "approved",
    },
  ],
  currentEmployeeId: "INT-001",
  policy: { ...DEFAULT_POLICY },
  contractOverrides: {},
  tasks: [],
  trips: [],
  notifications: [],
  smtp: { ...DEFAULT_SMTP },
  notifPrefs: {},
  notifDeliveries: [],
  exportSchedules: [],
};

const subs = new Set<() => void>();
let version = 0;
const emit = () => { version++; subs.forEach((s) => s()); };

function set(updater: (s: State) => void) {
  updater(state);
  emit();
}

export function subscribe(cb: () => void) {
  subs.add(cb);
  return () => subs.delete(cb);
}

// Cached snapshot per hook instance so selectors returning new array refs
// (e.g. .filter()) don't trigger infinite render loops in useSyncExternalStore.
export function useStore<T>(selector: (s: State) => T): T {
  const cache = useRef<{ v: number; val: T } | null>(null);
  const getSnapshot = () => {
    if (cache.current && cache.current.v === version) return cache.current.val;
    const val = selector(state);
    cache.current = { v: version, val };
    return val;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getState() {
  return state;
}

// ── Employees ──────────────────────────────────────
export function addEmployee(e: Omit<Employee, "id"> & { id?: string }) {
  const id = e.id ?? `INT-${String(state.employees.length + 1).padStart(3, "0")}`;
  set((s) => {
    s.employees = [...s.employees, { ...e, id } as Employee];
  });
  return id;
}

export function updateEmployee(id: string, patch: Partial<Employee>) {
  set((s) => {
    s.employees = s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e));
  });
}

// ── Policy / HR rules ─────────────────────────────
export function updatePolicy(patch: Partial<Policy>) {
  set((s) => { s.policy = { ...s.policy, ...patch }; });
}
export function resetPolicy() {
  set((s) => { s.policy = { ...DEFAULT_POLICY }; });
}
export function upsertKpi(kpi: Kpi) {
  set((s) => {
    const exists = s.policy.kpis.some((k) => k.id === kpi.id);
    s.policy = {
      ...s.policy,
      kpis: exists ? s.policy.kpis.map((k) => (k.id === kpi.id ? kpi : k)) : [...s.policy.kpis, kpi],
    };
  });
}
export function removeKpi(id: string) {
  set((s) => { s.policy = { ...s.policy, kpis: s.policy.kpis.filter((k) => k.id !== id) }; });
}

// Leave types
export function upsertLeaveType(lt: LeaveTypeDef) {
  set((s) => {
    const exists = s.policy.leaveTypes.some((l) => l.id === lt.id);
    s.policy = {
      ...s.policy,
      leaveTypes: exists
        ? s.policy.leaveTypes.map((l) => (l.id === lt.id ? lt : l))
        : [...s.policy.leaveTypes, lt],
    };
  });
}
export function removeLeaveType(id: string) {
  set((s) => { s.policy = { ...s.policy, leaveTypes: s.policy.leaveTypes.filter((l) => l.id !== id) }; });
}

// Holiday types
export function upsertHolidayType(ht: HolidayTypeDef) {
  set((s) => {
    const exists = s.policy.holidayTypes.some((h) => h.id === ht.id);
    s.policy = {
      ...s.policy,
      holidayTypes: exists
        ? s.policy.holidayTypes.map((h) => (h.id === ht.id ? ht : h))
        : [...s.policy.holidayTypes, ht],
    };
  });
}
export function removeHolidayType(id: string) {
  set((s) => { s.policy = { ...s.policy, holidayTypes: s.policy.holidayTypes.filter((h) => h.id !== id) }; });
}

// Departments
export function upsertDepartment(d: DepartmentDef) {
  set((s) => {
    const exists = s.policy.departments.some((x) => x.id === d.id);
    s.policy = {
      ...s.policy,
      departments: exists ? s.policy.departments.map((x) => (x.id === d.id ? d : x)) : [...s.policy.departments, d],
    };
  });
}
export function removeDepartment(id: string) {
  set((s) => { s.policy = { ...s.policy, departments: s.policy.departments.filter((x) => x.id !== id) }; });
}

// Positions
export function upsertPosition(p: PositionDef) {
  set((s) => {
    const exists = s.policy.positions.some((x) => x.id === p.id);
    s.policy = {
      ...s.policy,
      positions: exists ? s.policy.positions.map((x) => (x.id === p.id ? p : x)) : [...s.policy.positions, p],
    };
  });
}
export function removePosition(id: string) {
  set((s) => { s.policy = { ...s.policy, positions: s.policy.positions.filter((x) => x.id !== id) }; });
}

// Cities & districts
export function upsertCity(c: CityDef) {
  set((s) => {
    const exists = s.policy.cities.some((x) => x.id === c.id);
    s.policy = {
      ...s.policy,
      cities: exists ? s.policy.cities.map((x) => (x.id === c.id ? c : x)) : [...s.policy.cities, c],
    };
  });
}
export function removeCity(id: string) {
  set((s) => { s.policy = { ...s.policy, cities: s.policy.cities.filter((x) => x.id !== id) }; });
}
export function upsertDistrict(cityId: string, d: DistrictDef) {
  set((s) => {
    s.policy = {
      ...s.policy,
      cities: s.policy.cities.map((c) => {
        if (c.id !== cityId) return c;
        const exists = c.districts.some((x) => x.id === d.id);
        return {
          ...c,
          districts: exists ? c.districts.map((x) => (x.id === d.id ? d : x)) : [...c.districts, d],
        };
      }),
    };
  });
}
export function removeDistrict(cityId: string, districtId: string) {
  set((s) => {
    s.policy = {
      ...s.policy,
      cities: s.policy.cities.map((c) =>
        c.id !== cityId ? c : { ...c, districts: c.districts.filter((x) => x.id !== districtId) },
      ),
    };
  });
}

// Networks
export function upsertNetwork(n: Network) {
  set((s) => {
    const exists = s.networks.some((x) => x.id === n.id);
    s.networks = exists ? s.networks.map((x) => (x.id === n.id ? n : x)) : [...s.networks, n];
  });
}
export function removeNetwork(id: number) {
  set((s) => { s.networks = s.networks.filter((x) => x.id !== id); });
}

// ── Manager: tasks & trips ─────────────────────────
function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Notifications ──────────────────────────────────
export function addNotification(n: Omit<Notification, "id" | "ts" | "read">) {
  const entry: Notification = { ...n, id: uid("NTF"), ts: Date.now(), read: false };
  set((s) => { s.notifications = [entry, ...s.notifications].slice(0, 200); });
  dispatchNotification(entry);
  return entry;
}

// ── Notification preferences & SMTP ────────────────
export function getNotifPrefs(key: string): NotifPrefs {
  return state.notifPrefs[key] ?? DEFAULT_PREFS;
}
export function updateNotifPrefs(key: string, prefs: NotifPrefs) {
  set((s) => { s.notifPrefs = { ...s.notifPrefs, [key]: prefs }; });
}
export function updateSmtp(patch: Partial<SmtpSettings>) {
  set((s) => { s.smtp = { ...s.smtp, ...patch }; });
}

function inQuietHours(now: Date, qh: QuietHours): boolean {
  if (!qh.enabled) return false;
  const [sh, sm] = qh.start.split(":").map(Number);
  const [eh, em] = qh.end.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

function recordDelivery(d: Omit<NotifDelivery, "id" | "ts">) {
  const entry: NotifDelivery = { ...d, id: uid("DLV"), ts: Date.now() };
  set((s) => { s.notifDeliveries = [entry, ...s.notifDeliveries].slice(0, 500); });
}

function dispatchNotification(n: Notification) {
  const key = n.audience === "hr" ? "hr" : `manager:${n.audienceId ?? ""}`;
  const label = n.audience === "hr" ? "HR" : (empName(n.audienceId ?? "") || "Manager");
  const prefs = getNotifPrefs(key);
  const quiet = inQuietHours(new Date(), prefs.quietHours);
  const base = { recipientKey: key, recipientLabel: label, title: n.title, body: n.body };
  // Push
  if (!prefs.channels.push) recordDelivery({ ...base, channel: "push", status: "suppressed_pref" });
  else if (quiet) recordDelivery({ ...base, channel: "push", status: "suppressed_quiet" });
  else recordDelivery({ ...base, channel: "push", status: "sent" });
  // Email
  if (!prefs.channels.email) recordDelivery({ ...base, channel: "email", status: "suppressed_pref" });
  else if (quiet) recordDelivery({ ...base, channel: "email", status: "suppressed_quiet" });
  else if (!state.smtp.enabled || !state.smtp.host) recordDelivery({ ...base, channel: "email", status: "skipped_smtp" });
  else recordDelivery({ ...base, channel: "email", status: "sent" });
  // In-app (always recorded; suppressed only if user disabled inApp — notification still stored)
  if (!prefs.channels.inApp) recordDelivery({ ...base, channel: "inApp", status: "suppressed_pref" });
  else recordDelivery({ ...base, channel: "inApp", status: "sent" });
}
export function markNotificationRead(id: string) {
  set((s) => { s.notifications = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)); });
}
export function markAllNotificationsRead(filter: (n: Notification) => boolean) {
  set((s) => { s.notifications = s.notifications.map((n) => (filter(n) ? { ...n, read: true } : n)); });
}

function empName(id: string) {
  return state.employees.find((e) => e.id === id)?.name ?? id;
}
function managerIdOf(employeeId: string): string | undefined {
  const emp = state.employees.find((e) => e.id === employeeId) as any;
  return emp?.managerId;
}
function notifyTaskEvent(task: ManagerTask, kind: "created" | "started" | "completed" | "cancelled", actorEmpId: string, note?: string) {
  const actor = empName(actorEmpId);
  const where = [task.district, task.address].filter(Boolean).join(" — ");
  const verb =
    kind === "created" ? "self-assigned" :
    kind === "started" ? "started" :
    kind === "completed" ? "completed" : "cancelled";
  const title = `${actor} ${verb}: ${task.title}`;
  const body = [
    `Date: ${task.date}${task.dueTime ? " " + task.dueTime : ""}`,
    where ? `Location: ${where}` : null,
    note ? `Note: ${note}` : null,
  ].filter(Boolean).join(" • ");
  const meta = { taskId: task.id, employeeId: actorEmpId, where, note };
  // HR always gets notified
  addNotification({ audience: "hr", title, body, meta });
  // Notify the actor's manager (if any) and the task creator's manager target
  const seen = new Set<string>();
  const targets = [managerIdOf(actorEmpId), task.createdBy].filter((x): x is string => !!x && x !== actorEmpId);
  for (const mgrId of targets) {
    if (seen.has(mgrId)) continue;
    seen.add(mgrId);
    addNotification({ audience: "manager", audienceId: mgrId, title, body, meta });
  }
}
function notifyTripEvent(trip: ManagerTrip, kind: "started" | "completed" | "cancelled", actorEmpId: string, note?: string) {
  const actor = empName(actorEmpId);
  const verb = kind === "started" ? "started trip" : kind === "completed" ? "completed trip" : "cancelled trip";
  const title = `${actor} ${verb}: ${trip.destination}`;
  const body = [
    `Date: ${trip.date}${trip.time ? " " + trip.time : ""}`,
    trip.address ? `Location: ${trip.address}` : null,
    note ? `Note: ${note}` : null,
  ].filter(Boolean).join(" • ");
  const meta = { tripId: trip.id, employeeId: actorEmpId, note };
  addNotification({ audience: "hr", title, body, meta });
  const seen = new Set<string>();
  const targets = [managerIdOf(actorEmpId), trip.createdBy].filter((x): x is string => !!x && x !== actorEmpId);
  for (const mgrId of targets) {
    if (seen.has(mgrId)) continue;
    seen.add(mgrId);
    addNotification({ audience: "manager", audienceId: mgrId, title, body, meta });
  }
}

export function addTask(input: Omit<ManagerTask, "id" | "createdAt">) {
  const t: ManagerTask = { ...input, id: uid("TSK"), createdAt: Date.now(), history: input.history ?? [] };
  set((s) => { s.tasks = [t, ...s.tasks]; });
  return t;
}
/** Employee self-assigns a task. Notifies manager + HR. */
export function selfAssignTask(input: {
  employeeId: string;
  title: string;
  description?: string;
  date: string;
  dueTime?: string;
  city?: string;
  district?: string;
  address?: string;
  estimatedHours?: number;
  priority?: TaskPriority;
}) {
  const created = addTask({
    title: input.title,
    description: input.description ?? "",
    date: input.date,
    dueTime: input.dueTime,
    priority: input.priority ?? "medium",
    assignees: [input.employeeId],
    status: "pending",
    createdBy: input.employeeId,
    city: input.city,
    district: input.district,
    address: input.address,
    estimatedHours: input.estimatedHours,
  });
  notifyTaskEvent(created, "created", input.employeeId);
  return created;
}
export function addTasksBatch(inputs: Array<Omit<ManagerTask, "id" | "createdAt">>) {
  const created: ManagerTask[] = inputs.map((input) => ({
    ...input,
    id: uid("TSK"),
    createdAt: Date.now(),
    history: input.history ?? [],
  }));
  set((s) => { s.tasks = [...created, ...s.tasks]; });
  return created;
}
export function updateTask(id: string, patch: Partial<ManagerTask>) {
  set((s) => { s.tasks = s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)); });
}
export function transitionTask(id: string, to: TaskStatus, by: string, note?: string) {
  let updated: ManagerTask | undefined;
  let prev: TaskStatus | undefined;
  set((s) => {
    s.tasks = s.tasks.map((t) => {
      if (t.id !== id) return t;
      const entry: TaskHistoryEntry = { ts: Date.now(), by, from: t.status, to, note: note?.trim() || undefined };
      const patch: Partial<ManagerTask> = { status: to };
      if (to === "in_progress" && !t.startedAt) patch.startedAt = entry.ts;
      if (to === "done") patch.completedAt = entry.ts;
      const next = { ...t, ...patch, history: [...(t.history ?? []), entry] };
      prev = t.status;
      updated = next;
      return next;
    });
  });
  if (updated && prev !== to) {
    const kind = to === "in_progress" ? "started" : to === "done" ? "completed" : to === "cancelled" ? "cancelled" : null;
    if (kind) notifyTaskEvent(updated, kind, by, note);
  }
}
export function removeTask(id: string) {
  set((s) => { s.tasks = s.tasks.filter((t) => t.id !== id); });
}
export function addTrip(input: Omit<ManagerTrip, "id" | "createdAt">) {
  const t: ManagerTrip = { ...input, id: uid("TRP"), createdAt: Date.now(), history: input.history ?? [] };
  set((s) => { s.trips = [t, ...s.trips]; });
  return t;
}
export function updateTrip(id: string, patch: Partial<ManagerTrip>) {
  set((s) => { s.trips = s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)); });
}
export function transitionTrip(id: string, to: TaskStatus, by: string, note?: string) {
  let updated: ManagerTrip | undefined;
  let prev: TaskStatus | undefined;
  set((s) => {
    s.trips = s.trips.map((t) => {
      if (t.id !== id) return t;
      const entry: TaskHistoryEntry = { ts: Date.now(), by, from: t.status, to, note: note?.trim() || undefined };
      const patch: Partial<ManagerTrip> = { status: to };
      if (to === "in_progress" && !t.startedAt) patch.startedAt = entry.ts;
      if (to === "done") patch.completedAt = entry.ts;
      const next = { ...t, ...patch, history: [...(t.history ?? []), entry] };
      prev = t.status;
      updated = next;
      return next;
    });
  });
  if (updated && prev !== to) {
    const kind = to === "in_progress" ? "started" : to === "done" ? "completed" : to === "cancelled" ? "cancelled" : null;
    if (kind) notifyTripEvent(updated, kind, by, note);
  }
}
export function removeTrip(id: string) {
  set((s) => { s.trips = s.trips.filter((t) => t.id !== id); });
}

// ── Contracts ──────────────────────────────────────
export function renewContract(empId: string, months: number, currentEndIso: string) {
  set((s) => {
    const cur = s.contractOverrides[empId] ?? {};
    const base = new Date(currentEndIso);
    base.setMonth(base.getMonth() + months);
    s.contractOverrides = {
      ...s.contractOverrides,
      [empId]: { ...cur, end: base.toISOString().slice(0, 10), status: "active" },
    };
  });
}
export function cancelContract(empId: string) {
  set((s) => {
    const cur = s.contractOverrides[empId] ?? {};
    s.contractOverrides = { ...s.contractOverrides, [empId]: { ...cur, status: "cancelled" } };
  });
}
export function reactivateContract(empId: string) {
  set((s) => {
    const cur = s.contractOverrides[empId] ?? {};
    s.contractOverrides = { ...s.contractOverrides, [empId]: { ...cur, status: "active" } };
  });
}

// Rehire — reactivates employee + writes a fresh contract window.
const REHIRE_MONTHS: Record<string, number> = {
  Probation3M: 3,
  Internship: 6,
  Temporary: 6,
  PartTime: 12,
  FullTime: 12,
};
export function rehireEmployee(empId: string, patch: {
  startDate: string;
  contractType: string;
  position: string;
  salary: number;
  salaryMode: "gross" | "net";
}) {
  const months = REHIRE_MONTHS[patch.contractType] ?? 12;
  const start = new Date(patch.startDate + "T00:00:00");
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  const endIso = end.toISOString().slice(0, 10);
  const sal = Number(patch.salary) || 0;
  const salaryGross = patch.salaryMode === "gross" ? sal : Math.round(sal / 0.9);
  const salaryNet = patch.salaryMode === "net" ? sal : Math.round(sal * 0.9);
  set((s) => {
    s.employees = s.employees.map((e) =>
      e.id === empId
        ? ({
            ...e,
            status: "Active",
            position: patch.position,
            role: patch.position || (e as any).role,
            contractType: patch.contractType,
            salary: sal,
            salaryMode: patch.salaryMode,
            salaryGross,
            salaryNet,
          } as Employee)
        : e,
    );
    s.contractOverrides = {
      ...s.contractOverrides,
      [empId]: { start: patch.startDate, end: endIso, status: "active" },
    };
  });
}

// ── Locations ──────────────────────────────────────
export function updateLocation(id: number, patch: Partial<Location>) {
  set((s) => {
    s.locations = s.locations.map((l) => (l.id === id ? { ...l, ...patch } : l));
  });
}
export function addLocation(loc: Omit<Location, "id">) {
  const id = Math.max(0, ...state.locations.map((l) => l.id)) + 1;
  set((s) => {
    s.locations = [...s.locations, { ...loc, id }];
  });
}

// ── Leaves ─────────────────────────────────────────
export function submitLeave(req: Omit<LeaveRequest, "id" | "status"> & { status?: LeaveRequest["status"] }) {
  const id = Math.max(0, ...state.leaves.map((l) => l.id)) + 1;
  set((s) => {
    s.leaves = [{ ...req, id, status: req.status ?? "Pending" }, ...s.leaves];
  });
}
export function setLeaveStatus(id: number, status: LeaveRequest["status"]) {
  set((s) => {
    s.leaves = s.leaves.map((l) => (l.id === id ? { ...l, status } : l));
  });
}

// ── Attendance / Check-in ──────────────────────────
export function checkIn(opts: { branch: string }) {
  const t = new Date();
  const hhmm = t.toTimeString().slice(0, 5);
  const isLate = t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 0);
  set((s) => {
    s.todayCheckInAt = hhmm;
    s.todayCheckOutAt = undefined;
    s.attendance = [
      {
        id: `${today()}-${s.currentEmployeeId}`,
        employeeId: s.currentEmployeeId,
        date: today(),
        inTime: hhmm,
        branch: opts.branch,
        status: isLate ? "late" : "present",
      },
      ...s.attendance.filter((a) => !(a.date === today() && a.employeeId === s.currentEmployeeId)),
    ];
  });
  return hhmm;
}

export function checkOut() {
  const hhmm = new Date().toTimeString().slice(0, 5);
  set((s) => {
    s.todayCheckOutAt = hhmm;
    s.attendance = s.attendance.map((a) =>
      a.date === today() && a.employeeId === s.currentEmployeeId ? { ...a, outTime: hhmm } : a,
    );
  });
  return hhmm;
}

// ── Attendance import (bulk) with dedup by (employeeId,date) ──
export type ImportRow = {
  employeeId: string;
  date: string;
  inTime?: string;
  outTime?: string;
  branch?: string;
  status?: "present" | "late" | "absent";
};

export function importAttendance(rows: ImportRow[]) {
  const seen = new Set(state.attendance.map((a) => `${a.date}|${a.employeeId}`));
  const incomingSeen = new Set<string>();
  const accepted: AttendanceLog[] = [];
  let duplicates = 0;
  let invalid = 0;

  for (const r of rows) {
    if (!r.employeeId || !r.date) { invalid++; continue; }
    const key = `${r.date}|${r.employeeId}`;
    if (seen.has(key) || incomingSeen.has(key)) { duplicates++; continue; }
    const emp = state.employees.find((e) => e.id === r.employeeId);
    if (!emp) { invalid++; continue; }
    incomingSeen.add(key);
    const inTime = r.inTime?.trim() || undefined;
    const status: AttendanceLog["status"] =
      r.status ?? (!inTime ? "absent" : (inTime > "09:00" ? "late" : "present"));
    accepted.push({
      id: `${r.date}-${r.employeeId}`,
      employeeId: r.employeeId,
      date: r.date,
      inTime,
      outTime: r.outTime?.trim() || undefined,
      branch: r.branch || emp.branch,
      status,
    });
  }

  set((s) => { s.attendance = [...accepted, ...s.attendance]; });
  return { added: accepted.length, duplicates, invalid };
}

// ── Audit log ──────────────────────────────────────
export function logAudit(ev: Omit<AuditEvent, "id" | "ts">) {
  const entry: AuditEvent = {
    ...ev,
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
  };
  set((s) => {
    s.auditLog = [entry, ...s.auditLog].slice(0, 500);
  });
  return entry;
}

// ── Devices ────────────────────────────────────────
const DEVICE_KEY = "int-device-id";
export function getCurrentDeviceId(): string {
  if (typeof window === "undefined") return SEED_DEVICE_ID;
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `DEV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function deviceLabelGuess(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent;
  const platform =
    /iPhone/.test(ua) ? "iPhone" :
    /iPad/.test(ua) ? "iPad" :
    /Android/.test(ua) ? "Android" :
    /Mac/.test(ua) ? "Mac" :
    /Windows/.test(ua) ? "Windows PC" :
    /Linux/.test(ua) ? "Linux" : "Device";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${platform} • ${browser}`;
}

export function registerDevice(opts: { employeeId: string; label?: string }) {
  const id = getCurrentDeviceId();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const existing = state.devices.find((d) => d.id === id && d.employeeId === opts.employeeId);
  if (existing) return existing;
  const device: Device = {
    id,
    employeeId: opts.employeeId,
    label: opts.label ?? deviceLabelGuess(),
    userAgent: ua,
    registeredAt: Date.now(),
    status: "pending",
  };
  set((s) => { s.devices = [device, ...s.devices]; });
  return device;
}

export function setDeviceStatus(id: string, status: Device["status"]) {
  set((s) => {
    s.devices = s.devices.map((d) => (d.id === id ? { ...d, status } : d));
  });
}

export function removeDevice(id: string) {
  set((s) => { s.devices = s.devices.filter((d) => d.id !== id); });
}

export function getApprovedDevice(employeeId: string, deviceId: string): Device | undefined {
  return state.devices.find(
    (d) => d.employeeId === employeeId && d.id === deviceId && d.status === "approved",
  );
}

// ── Geo helpers ────────────────────────────────────
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function getCurrentPosition(timeoutMs = 8000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocation not supported"));
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 30_000,
    });
  });
}

// ── Scheduled HR exports ──────────────────────────
export type TaskActivityExportRow = {
  ts: number;
  employeeId: string;
  name: string;
  taskTitle: string;
  city: string;
  district: string;
  where: string;
  action: string;
  note?: string;
  estimatedHours?: number;
};

export function upsertExportSchedule(sch: ExportSchedule) {
  set((s) => {
    const exists = s.exportSchedules.some((x) => x.id === sch.id);
    s.exportSchedules = exists
      ? s.exportSchedules.map((x) => (x.id === sch.id ? sch : x))
      : [...s.exportSchedules, sch];
  });
}
export function removeExportSchedule(id: string) {
  set((s) => { s.exportSchedules = s.exportSchedules.filter((x) => x.id !== id); });
}
export function newExportScheduleId() {
  return uid("SCH");
}
export function markScheduleRan(id: string, dateIso: string, status: ExportSchedule["lastRunStatus"]) {
  set((s) => {
    s.exportSchedules = s.exportSchedules.map((x) =>
      x.id === id ? { ...x, lastRunDate: dateIso, lastRunStatus: status } : x,
    );
  });
}

/** Compute task-activity rows between two YYYY-MM-DD dates (inclusive). */
export function buildTaskActivityRows(fromIso: string, toIso: string, employeeIds?: string[]): TaskActivityExportRow[] {
  const allow = employeeIds && employeeIds.length > 0 ? new Set(employeeIds) : null;
  const rows: TaskActivityExportRow[] = [];
  for (const tk of state.tasks) {
    for (const h of tk.history ?? []) {
      const iso = new Date(h.ts).toISOString().slice(0, 10);
      if (iso < fromIso || iso > toIso) continue;
      if (allow && !allow.has(h.by)) continue;
      rows.push({
        ts: h.ts,
        employeeId: h.by,
        name: empName(h.by),
        taskTitle: tk.title,
        city: tk.city ?? "",
        district: tk.district ?? "",
        where: [tk.district, tk.address].filter(Boolean).join(" — ") || tk.address || "—",
        action: h.to,
        note: h.note,
        estimatedHours: tk.estimatedHours,
      });
    }
  }
  return rows.sort((a, b) => b.ts - a.ts);
}

/** Compute the [from, to] ISO dates for a schedule, anchored to `now`. */
export function rangeForSchedule(kind: ExportSchedule["rangeKind"], now = new Date()): { from: string; to: string } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (kind === "today") return { from: iso(d), to: iso(d) };
  if (kind === "yesterday") {
    const y = new Date(d); y.setDate(d.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  const days = kind === "last7" ? 7 : 30;
  const from = new Date(d); from.setDate(d.getDate() - days);
  return { from: iso(from), to: iso(d) };
}

/** Record simulated email deliveries for an export run. */
export function recordExportDelivery(sch: ExportSchedule, recordCount: number, fileName: string, status: "sent" | "skipped_smtp" | "no_records") {
  const title = `Auto-export: ${sch.name}`;
  const body = status === "sent"
    ? `Sent ${recordCount} record(s) — ${fileName}`
    : status === "no_records"
      ? `No records in range — nothing sent`
      : `SMTP disabled — export skipped`;
  const recips = sch.recipients.length ? sch.recipients : ["hr@local"];
  for (const to of recips) {
    set((s) => {
      const d: NotifDelivery = {
        id: uid("DLV"),
        ts: Date.now(),
        channel: "email",
        recipientKey: `export:${sch.id}`,
        recipientLabel: to,
        title,
        body,
        status: status === "sent" ? "sent" : status === "skipped_smtp" ? "skipped_smtp" : "suppressed_pref",
      };
      s.notifDeliveries = [d, ...s.notifDeliveries].slice(0, 500);
    });
  }
}
