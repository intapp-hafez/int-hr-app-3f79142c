import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { formatDate } from "@/lib/date-format";
import { EmployeeTripsPanel } from "@/components/employee/EmployeeTripsPanel";
import { EmployeeCustodyPanel } from "@/components/admin/EmployeeCustodyPanel";
import { AvatarUploader } from "@/components/AvatarUploader";
import { useQuery } from "@tanstack/react-query";
import {
  getEmployeeDetail,
  listCitiesAndDistricts,
  listEmployeeDocuments,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
  updateEmployeeAdmin,
  getEmployeeAttendanceHistory,
  getEmployeeLeavesHistory,
  INACTIVE_REASONS,
  listEmployeeStatusAudit,
} from "@/backend/functions/employees.functions";
import { getEmployeeWorkingDays } from "@/backend/functions/employee-working-days.functions";
import { listHolidays } from "@/backend/functions/holidays.functions";
import { staffDecideLeave } from "@/backend/functions/staff.functions";
import { getMe } from "@/backend/functions/auth.functions";
import {
  listEmployeeDevices,
  setEmployeeDeviceStatus,
  deleteEmployeeDevice,
} from "@/backend/functions/devices.functions";
import { listJobGrades } from "@/backend/functions/directory.functions";
import {
  adminListStickyNotes,
  adminCreateStickyNote,
  adminUpdateStickyNote,
  adminDeleteStickyNote,
  STICKY_COLORS,
  type StickyNote,
} from "@/backend/functions/sticky-notes.functions";
import { listAllAdvances } from "@/backend/functions/advances.functions";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Smartphone,
  Check,
  X,
  Upload,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { User as UserIcon, ShieldCheck, IdCard, Briefcase, CalendarDays, Plane, AlertCircle, StickyNote as StickyNoteIcon, Plus, Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Info as InfoIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import {
  useStore,
  updateEmployee,
  setDeviceStatus,
  removeDevice,
  renewContract,
  cancelContract,
  reactivateContract,
  rehireEmployee,
  logAudit,
  type Employee,
  type Device,
} from "@/lib/store";
import { getContractInfo, fmtDate } from "@/lib/contracts";
import { validateRehire } from "@/lib/employees.functions";
import { computeSalaryPair } from "@/lib/salary-calc";
import { FileSignature, RotateCcw, Ban, CheckCircle2, AlertTriangle } from "lucide-react";
import { locations, myAttendance } from "@/lib/mock-data";
import { formatEgPhone, isValidEgPhone } from "@/lib/phone";
import { useViewerRole, canViewSensitive, maskSensitive } from "@/lib/access";
import { validateAndStoreDocument } from "@/lib/documents.functions";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Save } from "lucide-react";
import { EmployeeAssignmentsPicker } from "@/components/EmployeeAssignmentsPicker";
import { Target } from "lucide-react";
import { Package } from "lucide-react";


export const Route = createFileRoute("/admin/employees/$id")({
  component: EmployeeDetail,
});

type Tab = "info" | "attendance" | "leaves" | "devices" | "trips" | "custody";

function EmployeeDetail() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const employee = useStore((s) => s.employees.find((e) => e.id === id));
  const leaves = useStore((s) => s.leaves.filter((l) => l.name === employee?.name));
  const devices = useStore((s) => s.devices.filter((d) => d.employeeId === id));
  const [tab, setTab] = useState<Tab>("info");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const detailFn = useServerFn(getEmployeeDetail);
  const meFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me", "roles"], queryFn: () => meFn(), staleTime: 60_000 });
  const isAdmin = (me?.roles ?? []).includes("admin") || (me?.roles ?? []).includes("hr");
  const { data: realDetail, isLoading: realLoading } = useQuery({
    queryKey: ["employee", "detail", id],
    queryFn: () => detailFn({ data: { id } }),
    enabled: isUuid && !employee,
  });

  if (!employee && isUuid) {
    if (realLoading) {
      return <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</p>;
    }
    if (realDetail) {
      return <RealEmployeeView detail={realDetail} canEdit={isAdmin || realDetail.id === (me?.profile as any)?.id} />;
    }
  }

  if (!employee) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Link to="/admin/employees" className="mt-3 inline-block text-sm font-semibold text-brand">{t("backToEmployees")}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/admin/employees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl-flip" /> {t("backToEmployees")}
      </Link>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="bg-gradient-brand p-6 text-brand-foreground">
          <div className="flex flex-wrap items-center gap-4">
            {isUuid ? (
              <AvatarUploader userId={employee.id} name={employee.name} url={(employee as any).avatarUrl} size="lg" canEdit={isAdmin} />
            ) : (
              <EmployeeAvatar
                id={employee.id}
                name={employee.name}
                url={(employee as any).avatarUrl}
                className="h-16 w-16 rounded-2xl"
                fallbackClassName="rounded-2xl bg-white/15 text-xl backdrop-blur text-brand-foreground"
              />
            )}
            <div className="flex-1">
              <h1 className="font-display text-2xl font-semibold">{employee.name}</h1>
              <p className="text-sm opacity-90">{employee.role} • {employee.dept}</p>
              {((employee as any).emp_code || (employee as any).empCode) && (
                <p className="mt-1 inline-block rounded-md bg-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold backdrop-blur">
                  {(employee as any).emp_code ?? (employee as any).empCode}
                </p>
              )}
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              {employee.status === "Active" ? t("active") : t("inactive")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 text-sm md:grid-cols-5">
          <Info icon={Mail} label={t("email")} value={employee.email} />
          <Info icon={Phone} label={t("phone")} value={(employee as any).phone ?? "—"} mono />
          <Info icon={UserIcon} label={t("gender")} value={(employee as any).gender ? ((employee as any).gender.charAt(0).toUpperCase() + (employee as any).gender.slice(1)) : "—"} />
          <Info icon={Building2} label={t("department")} value={employee.dept} />
          <Info icon={MapPin} label={t("branch")} value={employee.branch} />
          <Info icon={Calendar} label="Employee Code" value={(employee as any).emp_code ?? (employee as any).empCode ?? "—"} mono />
        </div>
      </div>

      <ContractCard
        employeeId={employee.id}
        contractType={(employee as any).contractType}
        employeeStatus={employee.status}
        currentPosition={(employee as any).position ?? employee.role}
        currentSalary={Number((employee as any).salary) || 0}
        currentSalaryMode={((employee as any).salaryMode ?? "gross") as "gross" | "net"}
      />

      <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-sm overflow-x-auto whitespace-nowrap">
        {(["info", "attendance", "leaves", "devices", "trips", "custody"] as Tab[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full font-medium capitalize transition-colors ${tab === k ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {k === "trips" ? (t("tripAllowance") ?? "Trip Allowance") : k === "custody" ? "Custody" : t(k)}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab employee={employee} />}
      {tab === "attendance" && <AttendanceTab employeeName={employee.name} />}
      {tab === "leaves" && <LeavesTab leaves={leaves} />}
      {tab === "devices" && <DevicesTab devices={devices} />}
      {tab === "trips" && <EmployeeTripsPanel employeeId={employee.id} />}
      {tab === "custody" && <EmployeeCustodyPanel employeeId={employee.id} />}
    </div>
  );
}


import type { EmployeeDetail as EmployeeDetailRow } from "@/backend/functions/employees.functions";
import { adminTransferEmployee } from "@/backend/functions/employees.functions";

function EmployeeTransferModal({ detail, close }: { detail: EmployeeDetailRow, close: () => void }) {
  const qc = useQueryClient();
  const transferFn = useServerFn(adminTransferEmployee);
  const cityFn = useServerFn(listCitiesAndDistricts);
  const { data: locs } = useQuery({ queryKey: ["cities-districts"], queryFn: () => cityFn(), staleTime: 5 * 60_000 });
  const [form, setForm] = useState({
    new_department_id: detail.department_id ?? "",
    new_position_id: detail.position_id ?? "",
    new_manager_id: detail.manager_id ?? "",
    effective_date: new Date().toISOString().slice(0, 10),
    note: ""
  });
  const [saving, setSaving] = useState(false);
  
  async function save() {
    setSaving(true);
    try {
      await transferFn({ data: {
        employee_id: detail.id,
        new_department_id: form.new_department_id || null,
        new_position_id: form.new_position_id || null,
        new_manager_id: form.new_manager_id || null,
        effective_date: form.effective_date,
        note: form.note || undefined
      }});
      toast.success("Employee transferred successfully");
      qc.invalidateQueries({ queryKey: ["admin"] });
      close();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const editInputCls = "w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border p-5 pb-4">
          <h2 className="text-xl font-semibold">Transfer Employee</h2>
          <p className="text-sm text-muted-foreground">Reassign {detail.full_name} to a new department or manager.</p>
        </div>
        <div className="p-5 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New Department
            <select className={editInputCls + " mt-1"} value={form.new_department_id} onChange={e => setForm(f => ({...f, new_department_id: e.target.value}))}>
              <option value="">— Unchanged —</option>
              {(locs?.departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name_en}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New Position
            <select className={editInputCls + " mt-1"} value={form.new_position_id} onChange={e => setForm(f => ({...f, new_position_id: e.target.value}))}>
              <option value="">— Unchanged —</option>
              {(locs?.positions ?? []).map(p => <option key={p.id} value={p.id}>{p.name_en}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New Manager
            <select className={editInputCls + " mt-1"} value={form.new_manager_id} onChange={e => setForm(f => ({...f, new_manager_id: e.target.value}))}>
              <option value="">— Unchanged —</option>
              {(locs?.managers ?? []).filter(m => m.id !== detail.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Effective Date
            <input type="date" className={editInputCls + " mt-1 font-mono"} value={form.effective_date} onChange={e => setForm(f => ({...f, effective_date: e.target.value}))} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Transfer Note
            <textarea className={editInputCls + " mt-1 min-h-[80px]"} value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))} placeholder="Reason for transfer..." />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-muted/30 p-4">
          <button onClick={close} className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button disabled={saving} onClick={save} className="rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
            {saving ? "Transferring..." : "Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RealEmployeeView({ detail, canEdit }: { detail: EmployeeDetailRow; canEdit: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const cityFn = useServerFn(listCitiesAndDistricts);
  const gradesFn = useServerFn(listJobGrades);
  const { data: locs } = useQuery({ queryKey: ["cities-districts"], queryFn: () => cityFn(), enabled: editing, staleTime: 5 * 60_000 });
  const { data: grades } = useQuery({ queryKey: ["job-grades"], queryFn: () => gradesFn(), enabled: editing, staleTime: 5 * 60_000 });
  const updateFn = useServerFn(updateEmployeeAdmin);
  const initialForm = useMemo(() => ({
    full_name: detail.full_name ?? "",
    phone: detail.phone ?? "",
    gender: detail.gender ?? "",
    emp_code: detail.emp_code ?? "",
    national_id: detail.national_id ?? "",
    is_passport: detail.national_id ? !/^\d{14}$/.test(detail.national_id) : false,
    id_issue_date: detail.id_issue_date ?? "",
    id_expiry_date: detail.id_expiry_date ?? "",
    city_id: detail.city_id ?? "",
    district_id: detail.district_id ?? "",
    department_id: detail.department_id ?? "",
    section_id: (detail as any).section_id ?? "",
    position_id: detail.position_id ?? "",
    manager_id: detail.manager_id ?? "",
    status: detail.status as "Active" | "Inactive",
    inactive_reason: (detail.inactive_reason ?? "") as "" | (typeof INACTIVE_REASONS)[number],
    allow_past_expiry: false,
    salary_mode: (detail.salary_mode ?? "gross") as "gross" | "net",
    salary_gross: detail.salary_gross ?? 0,
    salary_net: detail.salary_net ?? 0,
    allowance: detail.allowance ?? 0,
    insurance_salary: (detail as any).insurance_salary ?? 0,
    emergency_fund: (detail as any).emergency_fund ?? 0,
    target_value: detail.target_value ?? 0,
    target_duration: (detail.target_duration ?? "Monthly") as "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Yearly",
    contract_type: (detail.contract_type ?? "FullTime") as "FullTime" | "PartTime" | "Temporary" | "Internship" | "Probation3M",
    contract_start_date: detail.contract_start_date ?? "",
    contract_end_date: detail.contract_end_date ?? "",
    contract_cancelled: !!detail.contract_cancelled,
    job_grade: detail.job_grade ?? "",
    extra_email: (detail as any).extra_email ?? "",
    medical_insurance_details: (detail as any).medical_insurance_details ?? "",
    is_insured: !!(detail as any).is_insured,
    military_expire_date: (detail as any).military_expire_date ?? "",
    is_five_percent: !!(detail as any).is_five_percent,
    social_insurance_date: (detail as any).social_insurance_date ?? "",
    custom_field: (detail as any).custom_field ?? "",
  }), [detail]);
  const [form, setForm] = useState(initialForm);
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Reset form when entering edit mode or detail refreshes
  useEffect(() => {
    if (editing) setForm(initialForm);
  }, [editing, initialForm]);

  // Warn on browser tab close / refresh while there are unsaved changes
  useEffect(() => {
    if (!editing || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing, isDirty]);

  function tryCancel() {
    if (isDirty) setConfirmCancel(true);
    else { setEditing(false); setErr(null); }
  }

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nationalIdErr, setNationalIdErr] = useState<string | null>(null);

  function validateNationalId(id: string, isPassport: boolean): string | null {
    if (!id) return "Required";
    if (isPassport) {
      return /^[a-zA-Z0-9]{1,15}$/.test(id) ? null : "Invalid passport format";
    }
    return /^[23]\d{13}$/.test(id) ? null : "Must be 14 digits starting with 2 or 3";
  }

  const upd = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const districtsForCity = (locs?.districts ?? []).filter((d) => !form.city_id || d.city_id === form.city_id);
  const sectionsForDept = (locs?.sections ?? []).filter((s: any) => !form.department_id || s.department_id === form.department_id);
  type SideTab = "overview" | "employment" | "assignments" | "attendance" | "leaves" | "documents" | "devices" | "notes" | "advances" | "status" | "offboarding" | "trips" | "custody";
  const [sideTab, setSideTab] = useState<SideTab>("overview");
  const sideNav: { id: SideTab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: UserIcon },
    { id: "employment", label: "Employment", icon: Briefcase },
    { id: "assignments", label: "Assignments", icon: Target },
    { id: "attendance", label: "Attendance", icon: CalendarDays },
    { id: "leaves", label: "Leaves", icon: Plane },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "devices", label: "Allowed devices", icon: Smartphone },
    { id: "notes", label: "Notes", icon: StickyNoteIcon },
    { id: "advances", label: "Advances", icon: Banknote },
    { id: "status", label: "Status history", icon: Clock },
    { id: "trips", label: t("tripAllowance" as any) ?? "Trip Allowance", icon: MapPin },
    { id: "custody", label: "Custody", icon: Package },
    { id: "offboarding", label: "Offboarding", icon: Plane },
  ];

  async function save() {
    setErr(null);
    if (!form.national_id) {
      setErr("National ID is required");
      return;
    }
    if (form.is_passport) {
      if (!/^[a-zA-Z0-9]{1,15}$/.test(form.national_id)) {
        setErr("Invalid passport format");
        return;
      }
    } else {
      if (!/^[23]\d{13}$/.test(form.national_id)) {
        setErr("Must be 14 digits starting with 2 or 3");
        return;
      }
    }
    if (form.id_issue_date && form.id_expiry_date && form.id_issue_date > form.id_expiry_date) {
      setErr("Issue date cannot be after expiry date.");
      return;
    }
    if (form.id_expiry_date && !form.allow_past_expiry) {
      const today = new Date().toISOString().slice(0, 10);
      if (form.id_expiry_date < today) {
        setErr("Expiry date is in the past. Tick the override to save anyway.");
        return;
      }
    }
    setSaving(true);
    try {
      if (form.status === "Inactive" && !form.inactive_reason) {
        setErr(t("inactiveReasonRequired"));
        setSaving(false);
        return;
      }
      await updateFn({
        data: {
          id: detail.id,
          full_name: form.full_name.trim() || null,
          gender: form.gender || null,
          phone: form.phone.trim() || null,
          emp_code: form.emp_code.trim() || null,
          national_id: form.national_id.trim() || null,
          id_issue_date: form.id_issue_date || null,
          id_expiry_date: form.id_expiry_date || null,
          city_id: form.city_id || null,
          district_id: form.district_id || null,
          department_id: form.department_id || null,
          section_id: form.section_id || null,
          position_id: form.position_id || null,
          manager_id: form.manager_id || null,
          job_grade: form.job_grade || null,
          status: form.status,
          inactive_reason: form.status === "Active" ? null : (form.inactive_reason || null),
          allow_past_expiry: form.allow_past_expiry,
          salary_mode: form.salary_mode,
          salary_gross: Number(form.salary_gross) || 0,
          salary_net: Number(form.salary_net) || 0,
          allowance: Number(form.allowance) || 0,
          insurance_salary: Number(form.insurance_salary) || 0,
          emergency_fund: Number(form.emergency_fund) || 0,
          target_value: Number(form.target_value) || 0,
          target_duration: form.target_duration,
          contract_type: form.contract_type,
          contract_start_date: form.contract_start_date || null,
          contract_end_date: form.contract_end_date || null,
          contract_cancelled: form.contract_cancelled,
          extra_email: form.extra_email.trim() || null,
          medical_insurance_details: form.medical_insurance_details.trim() || null,
          is_insured: form.is_insured,
          military_expire_date: form.military_expire_date || null,
          is_five_percent: form.is_five_percent,
          social_insurance_date: form.social_insurance_date || null,
          custom_field: form.custom_field.trim() || null,
        },
      });
      toast.success("Saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["employee", "detail", detail.id] });
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link to="/admin/employees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl-flip" /> {t("backToEmployees")}
      </Link>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="bg-gradient-brand p-6 text-brand-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <AvatarUploader
              userId={detail.id}
              name={detail.full_name ?? detail.email ?? "?"}
              url={detail.avatar_url}
              size="lg"
              canEdit={canEdit}
            />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold truncate">{detail.full_name ?? detail.email ?? "—"}</h1>
              <p className="text-sm opacity-90 truncate">
                {(detail.roles[0] ?? "employee")} • {detail.department ?? "—"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-90">
                {detail.email && (
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{detail.email}</span>
                )}
                {detail.phone && (
                  <span className="inline-flex items-center gap-1 font-mono"><Phone className="h-3 w-3" />{detail.phone}</span>
                )}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider shadow-sm ${detail.status === "Active" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
              {detail.status === "Active" ? t("active") : t("inactive")}
              {detail.status === "Inactive" && detail.inactive_reason ? (
                <span className="ms-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal">
                  {detail.inactive_reason}
                </span>
              ) : null}
            </span>
            {detail.gender && (
              <span className="rounded-full bg-success text-success-foreground px-3 py-1 text-xs font-semibold uppercase tracking-wider shadow-sm">
                {detail.gender === "Male" ? (t("male" as any) ?? detail.gender) : detail.gender === "Female" ? (t("female" as any) ?? detail.gender) : detail.gender}
              </span>
            )}
            {canEdit && !editing && (
              <>
                <button
                  onClick={() => setTransferModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur hover:bg-white/25"
                >
                  {t("transfer" as any) ?? "Transfer"}
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur hover:bg-white/25"
                >
                  <Pencil className="h-3 w-3" /> {t("edit") ?? "Edit"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {transferModalOpen && <EmployeeTransferModal detail={detail} close={() => setTransferModalOpen(false)} />}

      {editing ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {isDirty && (
            <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs font-medium text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" /> You have unsaved changes.
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 p-5 text-sm md:grid-cols-3">
            <EditField label="Full name"><input className={editInputCls} value={form.full_name} onChange={(e) => upd("full_name", e.target.value)} /></EditField>
            <EditField label="Phone"><input className={editInputCls + " font-mono"} value={form.phone} onChange={(e) => upd("phone", e.target.value)} /></EditField>
            <EditField label={t("gender")}>
              <select className={editInputCls} value={form.gender} onChange={(e) => upd("gender", e.target.value)}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </EditField>
            <EditField label="Employee Code"><input className={editInputCls + " font-mono"} value={form.emp_code} onChange={(e) => upd("emp_code", e.target.value)} /></EditField>
            <EditField label="Extra Email (Outlook,Gmail)"><input type="email" className={editInputCls} value={form.extra_email} onChange={(e) => upd("extra_email", e.target.value)} /></EditField>
            <EditField label="Status">
              <select className={editInputCls} value={form.status} onChange={(e) => upd("status", e.target.value as any)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </EditField>
            {form.status === "Inactive" && (
              <EditField label="Inactive reason *">
                <select
                  className={`${editInputCls} ${form.status === "Inactive" && !form.inactive_reason && err ? "border-destructive" : ""}`}
                  value={form.inactive_reason}
                  onChange={(e) => { upd("inactive_reason", e.target.value as any); if (err) setErr(null); }}
                  aria-invalid={form.status === "Inactive" && !form.inactive_reason && !!err}
                >
                  <option value="">{t("selectReasonPlaceholder")}</option>
                  {INACTIVE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {form.status === "Inactive" && !form.inactive_reason && err === t("inactiveReasonRequired") && (
                  <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err}</p>
                )}
              </EditField>
            )}
            <EditField label="City">
              <select className={editInputCls} value={form.city_id} onChange={(e) => { upd("city_id", e.target.value); upd("district_id", ""); }}>
                <option value="">—</option>
                {(locs?.cities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
              </select>
            </EditField>
            <EditField label="District">
              <select className={editInputCls} value={form.district_id} onChange={(e) => upd("district_id", e.target.value)} disabled={!form.city_id}>
                <option value="">—</option>
                {districtsForCity.map((d) => <option key={d.id} value={d.id}>{d.name_en}</option>)}
              </select>
            </EditField>
            <EditField label="Department">
              <select className={editInputCls} value={form.department_id} onChange={(e) => { upd("department_id", e.target.value); upd("section_id", ""); }}>
                <option value="">—</option>
                {(locs?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name_en}</option>)}
              </select>
            </EditField>
            <EditField label="Level">
              <select className={editInputCls} value={form.section_id} onChange={(e) => {
                const sec = sectionsForDept.find((s: any) => s.id === e.target.value);
                upd("section_id", e.target.value);
                if (sec && !form.department_id) upd("department_id", sec.department_id);
              }}>
                <option value="">—</option>
                {sectionsForDept.map((s: any) => <option key={s.id} value={s.id}>{s.name_en}</option>)}
              </select>
            </EditField>
            <EditField label="Position">
              <select className={editInputCls} value={form.position_id} onChange={(e) => upd("position_id", e.target.value)}>
                <option value="">—</option>
                {(locs?.positions ?? []).map((p) => <option key={p.id} value={p.id}>{p.name_en}</option>)}
              </select>
            </EditField>
            <EditField label="Manager">
              <select className={editInputCls} value={form.manager_id} onChange={(e) => upd("manager_id", e.target.value)}>
                <option value="">—</option>
                {(locs?.managers ?? []).filter((m) => m.id !== detail.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </EditField>
            <EditField label="Job Grade (Trips)">
              <select className={editInputCls} value={form.job_grade} onChange={(e) => upd("job_grade", e.target.value)}>
                <option value="">(None)</option>
                {(grades ?? []).filter((g: any) => g.active).map((g: any) => (
                  <option key={g.name_en} value={g.name_en}>{g.name_en}</option>
                ))}
              </select>
            </EditField>
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                National ID
                <label className="flex cursor-pointer items-center gap-1.5 normal-case tracking-normal">
                  <input type="checkbox" checked={form.is_passport} onChange={(e) => { upd("is_passport", e.target.checked); setNationalIdErr(validateNationalId(form.national_id, e.target.checked)); }} className="rounded border-input text-brand focus:ring-brand" />
                  Passport
                </label>
              </span>
              <input className={editInputCls + " font-mono" + (nationalIdErr ? " border-destructive" : "")} value={form.national_id} onChange={(e) => { upd("national_id", e.target.value); setNationalIdErr(validateNationalId(e.target.value, form.is_passport)); }} onBlur={() => setNationalIdErr(validateNationalId(form.national_id, form.is_passport))} maxLength={form.is_passport ? 15 : 14} placeholder={form.is_passport ? "Passport Number" : "14-digit National ID"} />
              {nationalIdErr && <p className="mt-1 text-xs font-medium text-destructive">{nationalIdErr}</p>}
            </label>
            <EditField label="ID Issue Date"><input type="date" className={editInputCls + " font-mono"} value={form.id_issue_date} onChange={(e) => {
              const d = e.target.value;
              upd("id_issue_date", d);
              if (d) {
                const exp = new Date(d);
                exp.setFullYear(exp.getFullYear() + 7);
                exp.setDate(exp.getDate() - 1);
                upd("id_expiry_date", exp.toISOString().slice(0, 10));
              }
            }} /></EditField>
            <EditField label="ID Expiry Date"><input type="date" className={editInputCls + " font-mono"} value={form.id_expiry_date} onChange={(e) => upd("id_expiry_date", e.target.value)} /></EditField>
            <EditField label="Contract Type">
              <select className={editInputCls} value={form.contract_type} onChange={(e) => upd("contract_type", e.target.value as any)}>
                <option value="FullTime">Full-time</option>
                <option value="PartTime">Part-time</option>
                <option value="Temporary">Temporary</option>
                <option value="Internship">Internship</option>
                <option value="Probation3M">Probation (3 months)</option>
              </select>
            </EditField>
            <EditField label="Contract Start Date">
              <input type="date" className={editInputCls + " font-mono"} value={form.contract_start_date} onChange={(e) => upd("contract_start_date", e.target.value)} />
            </EditField>
            <EditField label="Contract End Date">
              <div className="space-y-1.5">
                <input type="date" className={editInputCls + " font-mono"} value={form.contract_end_date} onChange={(e) => upd("contract_end_date", e.target.value)} />
                {form.contract_end_date && (
                  <ContractDaysBadge endDate={form.contract_end_date} cancelled={form.contract_cancelled} />
                )}
              </div>
            </EditField>
            <label className="hidden items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={form.contract_cancelled} onChange={(e) => upd("contract_cancelled", e.target.checked)} />
              Contract cancelled
            </label>

            <EditField label="Medical Insurance Details"><input className={editInputCls} value={form.medical_insurance_details} onChange={(e) => upd("medical_insurance_details", e.target.value)} /></EditField>

            <EditField label="Social Insurance Date">
              <input type="date" className={editInputCls + " font-mono"} value={form.social_insurance_date} onChange={(e) => upd("social_insurance_date", e.target.value)} />
            </EditField>
            <EditField label="Military Expire Date">
              <input type="date" className={editInputCls + " font-mono"} value={form.military_expire_date} onChange={(e) => upd("military_expire_date", e.target.value)} />
            </EditField>
            <div className="md:col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Custom Notes / Fields</label>
                <button type="button" onClick={() => {
                  let arr = [];
                  try { arr = JSON.parse(form.custom_field || "[]"); if (!Array.isArray(arr)) arr = []; } catch { arr = []; }
                  arr.push({ id: crypto.randomUUID(), title: "", details: "", type: "text", value: "" });
                  upd("custom_field", JSON.stringify(arr));
                }} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted">
                  <Plus className="h-3 w-3" /> Add Field
                </button>
              </div>
              <div className="space-y-3">
                {(() => {
                  let arr = [];
                  try { 
                    arr = JSON.parse(form.custom_field || "[]"); 
                    if (!Array.isArray(arr)) arr = []; 
                  } catch { 
                    if (form.custom_field) {
                      arr = [{ id: 'legacy', title: "Legacy Note", details: "", type: "text", value: form.custom_field }];
                    }
                  }
                  
                  if (arr.length === 0) return <p className="text-xs text-muted-foreground italic">No custom fields added.</p>;

                  return arr.map((f: any, i: number) => (
                    <div key={f.id || i} className="flex gap-2 items-start rounded-xl border border-border bg-muted/10 p-3">
                      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase text-muted-foreground">Title</span>
                          <input className={editInputCls} value={f.title || ""} onChange={(e) => {
                            const newArr = [...arr]; newArr[i].title = e.target.value; upd("custom_field", JSON.stringify(newArr));
                          }} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase text-muted-foreground">Details</span>
                          <input className={editInputCls} value={f.details || ""} onChange={(e) => {
                            const newArr = [...arr]; newArr[i].details = e.target.value; upd("custom_field", JSON.stringify(newArr));
                          }} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase text-muted-foreground">Type</span>
                          <select className={editInputCls} value={f.type || "text"} onChange={(e) => {
                            const newArr = [...arr]; newArr[i].type = e.target.value; 
                            if (newArr[i].type === 'number') newArr[i].value = Number(newArr[i].value) || 0;
                            upd("custom_field", JSON.stringify(newArr));
                          }}>
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-medium uppercase text-muted-foreground">Value</span>
                          <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'} className={editInputCls} value={f.value || ""} onChange={(e) => {
                            const newArr = [...arr]; 
                            newArr[i].value = f.type === 'number' ? Number(e.target.value) : e.target.value; 
                            upd("custom_field", JSON.stringify(newArr));
                          }} />
                        </label>
                      </div>
                      <button type="button" onClick={() => {
                        const newArr = arr.filter((_: any, idx: number) => idx !== i);
                        upd("custom_field", JSON.stringify(newArr));
                      }} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive self-center">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div className="col-span-full border-t border-border mt-2 mb-2"></div>
            <EditField label="Salary Basis">
              <select className={editInputCls} value={form.salary_mode} onChange={(e) => upd("salary_mode", e.target.value as any)}>
                <option value="gross">Gross</option>
                <option value="net">Net</option>
              </select>
            </EditField>
            <EditField label="Salary Gross (EGP)">
              <input
                type="number"
                min={0}
                readOnly={form.salary_mode === "net"}
                className={editInputCls + " font-mono" + (form.salary_mode === "net" ? " bg-muted/40 text-muted-foreground" : "")}
                value={form.salary_gross || ""}
                onChange={(e) => {
                  const { gross, net } = computeSalaryPair(Number(e.target.value), "gross");
                  upd("salary_gross", gross);
                  upd("salary_net", net);
                }}
              />
            </EditField>
            <EditField label="Salary Net (EGP)">
              <input
                type="number"
                min={0}
                readOnly={form.salary_mode === "gross"}
                className={editInputCls + " font-mono" + (form.salary_mode === "gross" ? " bg-muted/40 text-muted-foreground" : "")}
                value={form.salary_net || ""}
                onChange={(e) => {
                  const { gross, net } = computeSalaryPair(Number(e.target.value), "net");
                  upd("salary_net", net);
                  upd("salary_gross", gross);
                }}
              />
            </EditField>
            <EditField label="Allowance (EGP)"><input type="number" min={0} className={editInputCls + " font-mono"} value={form.allowance || ""} onChange={(e) => upd("allowance", Number(e.target.value))} /></EditField>
            <EditField label="Insurance Salary (EGP)"><input type="number" min={0} className={editInputCls + " font-mono"} value={form.insurance_salary || ""} onChange={(e) => upd("insurance_salary", Number(e.target.value))} /></EditField>
            <EditField label="Emergency Relief Fund (EGP)"><input type="number" min={0} className={editInputCls + " font-mono"} value={form.emergency_fund || ""} onChange={(e) => upd("emergency_fund", Number(e.target.value))} /></EditField>
            <EditField label="Target Value"><input type="number" min={0} className={editInputCls + " font-mono"} value={form.target_value || ""} onChange={(e) => upd("target_value", Number(e.target.value))} /></EditField>
            <EditField label="Target Duration">
              <select className={editInputCls} value={form.target_duration} onChange={(e) => upd("target_duration", e.target.value as any)}>
                {["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </EditField>
            <div className="flex h-full items-center pt-5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={form.is_five_percent} onChange={(e) => upd("is_five_percent", e.target.checked)} />
                5% Quota (Disability)
              </label>
            </div>
            <div className="flex h-full items-center pt-5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={form.is_insured} onChange={(e) => upd("is_insured", e.target.checked)} />
                Is Insured
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground md:col-span-1">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={form.allow_past_expiry} onChange={(e) => upd("allow_past_expiry", e.target.checked)} />
              Override: allow expiry date in the past (admin/HR only)
            </label>
            {err && <p className="md:col-span-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
            <div className="md:col-span-3 flex justify-end gap-2">
              <button onClick={tryCancel} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold">Cancel</button>
              <button disabled={saving || !isDirty} onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-4 self-start rounded-3xl border border-border bg-card p-2">
            <nav className="flex md:flex-col gap-1 overflow-x-auto">
              {sideNav.map((n) => {
                const active = sideTab === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setSideTab(n.id)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${active
                        ? "bg-gradient-brand text-brand-foreground shadow-brand"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                  >
                    <n.icon className="h-4 w-4" />
                    <span>{t((n.id === "status" ? "status_history" : n.id === "trips" ? "tripAllowance" : n.id) as any) ?? n.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-5 min-w-0">
            {sideTab === "overview" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <h2 className="mb-4 font-display text-base font-semibold">Overview</h2>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                  <Info icon={Calendar} label="Employee Code" value={detail.emp_code ?? "—"} mono />
                  <Info icon={Building2} label={t("department")} value={detail.department ?? "—"} />
                  <Info icon={Briefcase} label={t("position") ?? "Position"} value={detail.position ?? "—"} />
                  <Info icon={MapPin} label={t("city")} value={detail.city ?? "—"} />
                  <Info icon={MapPin} label="District" value={detail.district ?? "—"} />
                  <Info icon={UserIcon} label="Manager" value={detail.manager_name ?? detail.manager_id ?? "—"} />
                  <Info icon={Calendar} label="Locale" value={detail.locale ?? "—"} />
                  <Info icon={Plane} label="Job Grade (Trips)" value={detail.job_grade ?? "—"} />
                  <Info icon={FileText} label="National ID" value={detail.national_id ?? "—"} mono />
                  <Info icon={Calendar} label="ID Issue Date" value={detail.id_issue_date ?? "—"} />
                  <Info icon={Calendar} label="ID Expiry Date" value={detail.id_expiry_date ?? "—"} />
                  <Info icon={Calendar} label="Created" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"} />
                  <Info icon={Calendar} label="Updated" value={detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "—"} />
                  <Info icon={UserIcon} label="5% Quota (Disability)" value={(detail as any).is_five_percent ? "Yes" : "No"} />
                  <Info icon={UserIcon} label="Is Insured" value={(detail as any).is_insured ? "Yes" : "No"} />
                  <div className="flex flex-col gap-1 md:col-span-3 mt-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Roles</span>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.roles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        detail.roles.map((r) => (
                          <span key={r} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">{r}</span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-3 mt-4 border-t border-border pt-4">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Custom Notes / Fields</span>
                    {(() => {
                      let arr = [];
                      try {
                        arr = JSON.parse((detail as any).custom_field || "[]");
                        if (!Array.isArray(arr)) arr = [];
                      } catch {
                        if ((detail as any).custom_field) arr = [{ id: 'legacy', title: "Legacy Note", details: "", type: "text", value: (detail as any).custom_field }];
                      }
                      if (arr.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
                      return (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {arr.map((f: any, i: number) => (
                            <div key={f.id || i} className="rounded-xl border border-border bg-muted/20 p-3">
                              <p className="font-semibold text-sm text-foreground truncate" title={f.title || "Untitled"}>{f.title || "Untitled"}</p>
                              {f.details && <p className="text-xs text-muted-foreground mt-0.5 truncate" title={f.details}>{f.details}</p>}
                              <p className="mt-2 text-sm text-foreground break-words font-mono bg-background border border-border rounded-lg px-2 py-1">{f.value || "—"}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {sideTab === "employment" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <h2 className="mb-4 font-display text-base font-semibold">Employment & Compensation</h2>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                  <Info icon={Calendar} label="Contract Type" value={detail.contract_type ?? "—"} />
                  <Info icon={Calendar} label="Contract Start" value={detail.contract_start_date ?? "—"} />
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Contract End</span>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {detail.contract_end_date ? (
                        <>
                          <span className="font-mono">{detail.contract_end_date}</span>
                          <ContractDaysBadge endDate={detail.contract_end_date} cancelled={detail.contract_cancelled} />
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                  <Info icon={Calendar} label="Salary Basis" value={detail.salary_mode ? (detail.salary_mode === "gross" ? "Gross" : "Net") : "—"} />
                  <Info icon={Calendar} label="Salary (Gross)" value={detail.salary_gross != null ? `${detail.salary_gross.toLocaleString()} EGP` : "—"} mono />
                  <Info icon={Calendar} label="Salary (Net)" value={detail.salary_net != null ? `${detail.salary_net.toLocaleString()} EGP` : "—"} mono />
                  <Info icon={Calendar} label="Insurance Salary" value={(detail as any).insurance_salary != null ? `${(detail as any).insurance_salary.toLocaleString()} EGP` : "—"} mono />
                  <Info icon={Calendar} label="Emergency Relief Fund" value={(detail as any).emergency_fund != null ? `${(detail as any).emergency_fund.toLocaleString()} EGP` : "—"} mono />
                  <Info icon={Calendar} label="Allowance" value={detail.allowance != null ? `${detail.allowance.toLocaleString()} EGP` : "—"} mono />
                  <Info icon={Plane} label="Job Grade (Trips)" value={detail.job_grade ?? "—"} />
                  <Info icon={Calendar} label="Target" value={detail.target_value != null ? `${detail.target_value} / ${detail.target_duration ?? "—"}` : "—"} />
                </div>
              </div>
            )}



            {sideTab === "assignments" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <h2 className="mb-4 font-display text-base font-semibold">Assignments</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Select KPIs, Allowances, Targets &amp; Overtime, and Shifts to apply to this employee.
                </p>
                <EmployeeAssignmentsPicker employeeId={detail.id} />
              </div>
            )}

            {sideTab === "documents" && (
              <DocumentsPanel profileId={detail.id} canManage={canEdit} />
            )}

            {sideTab === "attendance" && (
              <AttendanceHistoryPanel employeeId={detail.id} />
            )}

            {sideTab === "leaves" && (
              <LeavesHistoryPanel employeeId={detail.id} />
            )}

            {sideTab === "devices" && (
              <EmployeeDevicesPanel userId={detail.id} canManage={canEdit} />
            )}

            {sideTab === "notes" && (
              <EmployeeNotesPanel profileId={detail.id} canManage={canEdit} />
            )}

            {sideTab === "advances" && (
              <AdvancesTab employeeId={detail.id} />
            )}

            {sideTab === "status" && (
              <StatusHistoryPanel profileId={detail.id} />
            )}

            {sideTab === "offboarding" && (
              <AdminOffboarding employeeId={detail.id} resignationDate={detail.contract_end_date || new Date().toISOString().slice(0, 10)} />
            )}

            {sideTab === "trips" && (
              <EmployeeTripsPanel employeeId={detail.id} />
            )}

            {sideTab === "custody" && (
              <EmployeeCustodyPanel employeeId={detail.id} />
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes on this profile. Leaving edit mode will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setForm(initialForm); setErr(null); setEditing(false); setConfirmCancel(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { calculateFinalSettlement, saveFinalSettlement } from "@/backend/functions/offboarding.functions";

function AdminOffboarding({ employeeId, resignationDate }: { employeeId: string; resignationDate: string }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(resignationDate);
  const calcFn = useServerFn(calculateFinalSettlement);
  const saveFn = useServerFn(saveFinalSettlement);

  const { data: settlement, isLoading } = useQuery({
    queryKey: ["offboarding", employeeId, date],
    queryFn: () => calcFn({ data: { employee_id: employeeId, resignation_date: date } }),
    enabled: !!employeeId,
  });

  const [saving, setSaving] = useState(false);

  async function handleApprove() {
    if (!settlement) return;
    setSaving(true);
    try {
      await saveFn({
        data: {
          employee_id: employeeId,
          resignation_date: date,
          worked_days: settlement.worked_days,
          daily_rate: settlement.daily_rate,
          unpaid_salary: settlement.unpaid_salary,
          remaining_leave_days: settlement.remaining_leave_days,
          leave_cash_out: settlement.leave_cash_out,
          outstanding_advances: settlement.outstanding_advances,
          other_additions: 0,
          other_deductions: 0,
        }
      });
      toast.success("Final settlement approved and saved!");
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="text-lg font-semibold">Final Settlement</h3>
        <p className="text-sm text-muted-foreground">Calculate end of service dues based on the resignation date.</p>
      </div>

      <div className="max-w-xl rounded-2xl border border-border bg-card p-5">
        <label className="mb-4 block text-sm font-semibold">
          Resignation Date
          <input type="date" className="input mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Calculating...</div>
        ) : settlement ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/30 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Daily Rate</p>
                <p className="font-mono font-medium">{settlement.daily_rate} EGP</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Worked Days (Current Month)</p>
                <p className="font-mono font-medium">{settlement.worked_days}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unpaid Salary</p>
                <p className="font-mono font-medium text-green-600">+{settlement.unpaid_salary} EGP</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining Leaves ({settlement.remaining_leave_days})</p>
                <p className="font-mono font-medium text-green-600">+{settlement.leave_cash_out} EGP</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Outstanding Advances/Loans</p>
                <p className="font-mono font-medium text-destructive">-{settlement.outstanding_advances} EGP</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gradient-brand/10 p-4 border border-brand/20">
              <span className="font-semibold text-brand">Net Settlement</span>
              <span className="font-mono text-xl font-bold text-brand">{settlement.net_settlement} EGP</span>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button disabled={saving} onClick={handleApprove} className="rounded-xl bg-gradient-brand px-6 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
                {saving ? "Saving..." : "Approve & Mark Resigned"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const editInputCls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";

function EditField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </label>
  );
}

function ContractDaysBadge({ endDate, cancelled }: { endDate: string; cancelled?: boolean }) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
  const absDays = Math.abs(days);
  const plural = absDays === 1 ? "" : "s";

  if (cancelled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <Ban className="h-3 w-3" /> Cancelled
            </span>
          </TooltipTrigger>
          <TooltipContent>Contract was cancelled</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (days < 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              <AlertCircle className="h-3 w-3" /> Expired {absDays} day{plural}
            </span>
          </TooltipTrigger>
          <TooltipContent>Contract ended {absDays} day{plural} ago</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (days <= 30) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
              <AlertTriangle className="h-3 w-3" /> {days} day{plural} left
            </span>
          </TooltipTrigger>
          <TooltipContent>Contract expires in {days} day{plural} — renewal recommended</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> {days} day{plural} remaining
          </span>
        </TooltipTrigger>
        <TooltipContent>Contract expires on {endDate}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const DOC_KIND_LABELS: Record<string, string> = {
  docIdFront: "ID — Front",
  docIdBack: "ID — Back",
  docContract: "Contract",
  docCriminalFront: "Criminal Record",
  docMilitaryFront: "Military — Front",
  docMilitaryBack: "Military — Back",
  docMedicalInsurance: "Medical Insurance",
  docSocialInsurance: "Social Insurance",
  docOther: "Other",
};

function DocumentsPanel({ profileId, canManage }: { profileId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmployeeDocuments);
  const uploadFn = useServerFn(uploadEmployeeDocument);
  const deleteFn = useServerFn(deleteEmployeeDocument);
  const validateFn = useServerFn(validateAndStoreDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>("docIdFront");
  const [busy, setBusy] = useState(false);
  const { data: docs, isLoading } = useQuery({
    queryKey: ["employee", "documents", profileId],
    queryFn: () => listFn({ data: { profile_id: profileId } }),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error("read failed"));
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(file);
      });
      const validated = await validateFn({ data: { name: file.name, type: file.type, size: file.size, dataUrl } });
      await uploadFn({
        data: {
          profile_id: profileId,
          kind,
          name: validated.name,
          mime_type: validated.type as any,
          size_bytes: validated.size,
          data_url: validated.dataUrl,
        },
      });
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["employee", "documents", profileId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["employee", "documents", profileId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</h3>
        {canManage && (
          <div className="flex items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs">
              {Object.entries(DOC_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={onFile} />
            <button disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
              <Upload className="h-3 w-3" /> {busy ? "Uploading…" : "Upload"}
            </button>
          </div>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !docs || docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{DOC_KIND_LABELS[d.kind] ?? d.kind}</p>
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-[11px] text-muted-foreground">{(d.size_bytes / 1024).toFixed(1)} KB · {new Date(d.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1">
                <a href={d.data_url} target="_blank" rel="noreferrer" download={d.name} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground">
                  <Download className="h-3.5 w-3.5" />
                </a>
                {canManage && (
                  <button onClick={() => onDelete(d.id)} className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-destructive hover:bg-destructive/15">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DevicesTab({ devices }: { devices: Device[] }) {
  // (kept for legacy non-UUID path)
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => (prev.size === devices.length ? new Set() : new Set(devices.map((d) => d.id))));

  const bulk = (status: Device["status"]) => {
    if (selected.size === 0) return;
    selected.forEach((id) => setDeviceStatus(id, status));
    toast.success(`${selected.size} · ${status === "approved" ? t("approved") : t("revoke")}`);
    setSelected(new Set());
  };

  if (devices.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        — {t("devices")} —
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.size === devices.length && devices.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 accent-brand"
          />
          <span className="text-muted-foreground">
            {selected.size > 0 ? `${selected.size} / ${devices.length}` : t("all")}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            disabled={selected.size === 0}
            onClick={() => bulk("approved")}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand disabled:opacity-40"
          >
            <Check className="h-3 w-3" /> {t("approve")}
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => bulk("revoked")}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            {t("revoke")}
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {devices.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3 min-w-0">
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
                className="mt-2 h-4 w-4 accent-brand"
              />
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground"><Smartphone className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{d.label}</p>
                <p className="font-mono text-[11px] text-muted-foreground truncate">{d.id}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(d.registeredAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${d.status === "approved" ? "bg-success/15 text-success" :
                  d.status === "pending" ? "bg-warning/20 text-warning-foreground" :
                    "bg-destructive/15 text-destructive"
                }`}>
                {d.status === "approved" ? t("approved") : d.status === "pending" ? t("pending") : t("revoke")}
              </span>
              {d.status !== "approved" && (
                <button
                  onClick={() => { setDeviceStatus(d.id, "approved"); toast.success(t("deviceApproved")); }}
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
                >
                  <Check className="h-3 w-3" /> {t("approve")}
                </button>
              )}
              {d.status === "approved" && (
                <button
                  onClick={() => { setDeviceStatus(d.id, "revoked"); toast.message("Revoked"); }}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                >
                  {t("revoke")}
                </button>
              )}
              <button onClick={() => removeDevice(d.id)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type LeaveStatus = "All" | "Pending" | "Approved" | "Rejected";

function AttendanceHistoryPanel({ employeeId }: { employeeId: string }) {
  const fn = useServerFn(getEmployeeAttendanceHistory);
  const wdFn = useServerFn(getEmployeeWorkingDays);
  const holFn = useServerFn(listHolidays);
  const leavesFn = useServerFn(getEmployeeLeavesHistory);
  const decideLeaveFn = useServerFn(staffDecideLeave);
  const qc = useQueryClient();
  const [pendingLeaveId, setPendingLeaveId] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirm, setConfirm] = useState<
    | null
    | {
      kind: "single" | "bulk";
      title: string;
      description: string;
      conflicts: string[];
      onConfirm: () => Promise<void> | void;
    }
  >(null);
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const monthLabel = new Date(cursor.year, cursor.month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

  const { data: attData, isLoading } = useQuery({
    queryKey: ["employee", "attendance", employeeId, cursor.year, cursor.month],
    queryFn: () => fn({ data: { employee_id: employeeId, limit: 500 } }),
  });
  const { data: wdData } = useQuery({
    queryKey: ["employee", "working-days", employeeId],
    queryFn: () => wdFn({ data: { employee_id: employeeId } }),
  });
  const { data: holidaysData } = useQuery({
    queryKey: ["holidays", "all"],
    queryFn: () => holFn(),
  });
  const { data: leavesData } = useQuery({
    queryKey: ["employee", "leaves", employeeId],
    queryFn: () => leavesFn({ data: { employee_id: employeeId } }),
  });

  const weeklyDays: number[] = wdData?.weekly ?? [0, 1, 2, 3, 4];
  const monthOverride = wdData?.months.find((m: any) => m.year === cursor.year && m.month === cursor.month);
  const workingDayIdx: number[] = monthOverride?.days ?? weeklyDays;
  const dateOnDays: number[] =
    (wdData as any)?.dateOn?.find((o: any) => o.year === cursor.year && o.month === cursor.month)?.days ?? [];
  const dateOffDays: number[] =
    (wdData as any)?.dateOff?.find((o: any) => o.year === cursor.year && o.month === cursor.month)?.days ?? [];
  const isWorkingDate = (dt: Date): boolean => {
    const dom = dt.getDate();
    if (dateOnDays.includes(dom)) return true;
    if (dateOffDays.includes(dom)) return false;
    return workingDayIdx.includes(dt.getDay());
  };

  const holidayByDate = useMemo(() => {
    const m = new Map<string, { name: string; type: string }>();
    (holidaysData ?? []).forEach((h: any) => {
      if (!h?.date) return;
      m.set(h.date, { name: h.name, type: h.type });
      if (h.recurring) {
        // Apply recurring holiday to the currently viewed year
        const mmdd = String(h.date).slice(5);
        const iso = `${cursor.year}-${mmdd}`;
        if (!m.has(iso)) m.set(iso, { name: h.name, type: h.type });
      }
    });
    return m;
  }, [holidaysData, cursor.year]);

  // Leave days (all statuses that matter) → date -> { id, type, paid, status }
  const leaveByDate = useMemo(() => {
    const m = new Map<string, { id: string; type: string; paid: boolean | null; status: string }>();
    // Priority: approved > pending > rejected/cancelled (last write wins so iterate in reverse priority)
    const priority: Record<string, number> = { approved: 3, pending: 2, rejected: 1, cancelled: 1 };
    (leavesData ?? []).forEach((l: any) => {
      if (!l?.start_date || !l?.end_date) return;
      const status = String(l.status ?? "").toLowerCase();
      if (!priority[status]) return;
      const start = new Date(l.start_date + "T00:00:00");
      const end = new Date(l.end_date + "T00:00:00");
      for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const existing = m.get(iso);
        if (!existing || (priority[status] ?? 0) > (priority[existing.status] ?? 0)) {
          m.set(iso, { id: l.id, type: l.leave_type_name ?? "Leave", paid: l.paid, status });
        }
      }
    });
    return m;
  }, [leavesData]);

  // Leave by id (full range) so we can compute conflicts across the entire request, not just visible days.
  const leaveById = useMemo(() => {
    const m = new Map<string, { id: string; type: string; paid: boolean | null; status: string; start: string; end: string }>();
    (leavesData ?? []).forEach((l: any) => {
      if (!l?.id || !l?.start_date || !l?.end_date) return;
      m.set(l.id, {
        id: l.id,
        type: l.leave_type_name ?? "Leave",
        paid: l.paid,
        status: String(l.status ?? "").toLowerCase(),
        start: l.start_date,
        end: l.end_date,
      });
    });
    return m;
  }, [leavesData]);

  const attByDate = useMemo(() => {
    const m = new Map<string, any>();
    (attData ?? []).forEach((r: any) => { if (r.date) m.set(r.date, r); });
    return m;
  }, [attData]);

  const isFuture = (d: Date) => d.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Iterate every ISO date in a leave's full range (may span outside the visible month).
  function eachDateInLeave(id: string): string[] {
    const l = leaveById.get(id);
    if (!l) return [];
    const out: string[] = [];
    const start = new Date(l.start + "T00:00:00");
    const end = new Date(l.end + "T00:00:00");
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return out;
  }

  // Compute conflicts if the given leave were approved: overlapping holidays,
  // weekend/OFF days per the working schedule, and other approved leaves.
  function conflictsForLeave(id: string): { holidays: string[]; weekendOff: string[]; overlaps: Array<{ id: string; type: string; date: string }> } {
    const dates = eachDateInLeave(id);
    const holidays: string[] = [];
    const weekendOff: string[] = [];
    const overlaps: Array<{ id: string; type: string; date: string }> = [];
    for (const iso of dates) {
      if (holidayByDate.has(iso)) holidays.push(iso);
      const dt = new Date(iso + "T00:00:00");
      if (!isWorkingDate(dt)) weekendOff.push(iso);
      const other = leaveByDate.get(iso);
      if (other && other.id !== id && other.status === "approved") {
        overlaps.push({ id: other.id, type: other.type, date: iso });
      }
    }
    return { holidays, weekendOff, overlaps };
  }

  function summarizeConflicts(c: ReturnType<typeof conflictsForLeave>): string[] {
    const lines: string[] = [];
    if (c.holidays.length) lines.push(`${c.holidays.length} holiday day${c.holidays.length === 1 ? "" : "s"} (${c.holidays.slice(0, 3).join(", ")}${c.holidays.length > 3 ? "…" : ""})`);
    if (c.weekendOff.length) lines.push(`${c.weekendOff.length} weekend/OFF day${c.weekendOff.length === 1 ? "" : "s"}`);
    if (c.overlaps.length) {
      const types = Array.from(new Set(c.overlaps.map((o) => o.type))).slice(0, 3).join(", ");
      lines.push(`${c.overlaps.length} overlap${c.overlaps.length === 1 ? "" : "s"} with existing approved leave (${types})`);
    }
    return lines;
  }

  const rows = useMemo(() => {
    const list: Array<{ date: string; dayLabel: string; dow: number; rec: any; isWorking: boolean; future: boolean; holiday: { name: string; type: string } | null; leave: { id: string; type: string; paid: boolean | null; status: string } | null }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(cursor.year, cursor.month - 1, d);
      const iso = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const holiday = holidayByDate.get(iso) ?? null;
      const leave = leaveByDate.get(iso) ?? null;
      list.push({
        date: iso,
        dayLabel: dt.toLocaleDateString(undefined, { weekday: "short" }),
        dow: dt.getDay(),
        rec: attByDate.get(iso),
        isWorking: isWorkingDate(dt) && !holiday && !(leave && leave.status === "approved"),
        future: isFuture(dt),
        holiday,
        leave,
      });
    }
    return list;
  }, [daysInMonth, cursor.year, cursor.month, attByDate, workingDayIdx, dateOnDays, dateOffDays, holidayByDate, leaveByDate]);

  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0, leave = 0, working = 0;
    rows.forEach((r) => {
      if (!r.isWorking) return;
      working++;
      if (r.future) return;
      if (r.leave && r.leave.status === "approved") { leave++; return; }
      const s = String(r.rec?.status ?? "").toLowerCase();
      if (r.rec && (s === "late" || (r.rec.in_time && s.includes("late")))) late++;
      else if (r.rec && r.rec.in_time) present++;
      else absent++;
    });
    return { present, late, absent, leave, working };
  }, [rows]);

  function hours(rec: any): string {
    if (!rec?.in_time || !rec?.out_time) return "—";
    const ms = new Date(rec.out_time).getTime() - new Date(rec.in_time).getTime();
    if (!isFinite(ms) || ms <= 0) return "—";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  }

  function statusFor(r: typeof rows[number]): { label: string; cls: string } {
    // Precedence: HOLIDAY > LEAVE > OFF > attendance status. Both labels are
    // also rendered alongside when the day is simultaneously a holiday and leave.
    if (r.holiday) return { label: "HOLIDAY", cls: "bg-violet-500/15 text-violet-600" };
    if (r.leave && r.leave.status === "approved") return { label: "LEAVE", cls: "bg-sky-500/15 text-sky-600" };
    if (r.leave && r.leave.status === "pending") return { label: "PENDING", cls: "bg-amber-500/15 text-amber-600" };
    if (!r.isWorking) return { label: "OFF", cls: "bg-muted text-muted-foreground" };
    if (r.future) return { label: "—", cls: "bg-transparent text-muted-foreground" };
    const rec = r.rec;
    const s = String(rec?.status ?? "").toLowerCase();
    if (s === "late" || (rec && s.includes("late"))) return { label: "LATE", cls: "bg-amber-500/15 text-amber-600" };
    if (rec?.in_time) return { label: "PRESENT", cls: "bg-emerald-500/15 text-emerald-600" };
    return { label: "ABSENT", cls: "bg-destructive/10 text-destructive" };
  }

  function explainFor(r: typeof rows[number], label: string): string {
    const parts: string[] = [];
    if (r.holiday) parts.push(`Holiday: ${r.holiday.name}${r.holiday.type ? ` (${r.holiday.type})` : ""}`);
    if (r.leave) {
      const paidTxt = r.leave.paid === false ? " · unpaid" : r.leave.paid ? " · paid" : "";
      parts.push(`Leave request: ${r.leave.type} — ${r.leave.status}${paidTxt}`);
    }
    if (label === "OFF" && !r.holiday) parts.push("Non-working day per weekly schedule");
    if (label === "PRESENT") parts.push(`Checked in${r.rec?.in_time ? ` at ${new Date(r.rec.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`);
    if (label === "LATE") parts.push("Check-in flagged as late");
    if (label === "ABSENT") parts.push("No check-in recorded on a working day");
    if (label === "—") parts.push("Future date");
    return parts.join(" • ") || label;
  }

  async function decideLeave(id: string, status: "approved" | "rejected" | "cancelled") {
    setPendingLeaveId(id);
    try {
      await decideLeaveFn({ data: { id, status } });
      toast.success(status === "approved" ? "Leave approved" : status === "rejected" ? "Leave rejected" : "Leave cancelled");
      await qc.invalidateQueries({ queryKey: ["employee", "leaves", employeeId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setPendingLeaveId(null);
    }
  }

  function requestApprove(id: string) {
    const l = leaveById.get(id);
    if (!l) return;
    const c = conflictsForLeave(id);
    const lines = summarizeConflicts(c);
    if (lines.length === 0) {
      void decideLeave(id, "approved");
      return;
    }
    setConfirm({
      kind: "single",
      title: `${l.status === "pending" ? "Approve" : "Re-open"} leave with conflicts?`,
      description: `${l.type} (${l.start} → ${l.end}) has scheduling conflicts:`,
      conflicts: lines,
      onConfirm: () => decideLeave(id, "approved"),
    });
  }

  // ── Bulk selection helpers ─────────────────────────
  function toggleDate(iso: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  }
  function clearSelection() { setSelectedDates(new Set()); }

  // Distinct leave requests touched by the selection.
  const selectedLeaves = useMemo(() => {
    const ids = new Set<string>();
    selectedDates.forEach((iso) => {
      const l = leaveByDate.get(iso);
      if (l) ids.add(l.id);
    });
    return Array.from(ids)
      .map((id) => leaveById.get(id))
      .filter(Boolean) as Array<{ id: string; type: string; paid: boolean | null; status: string; start: string; end: string }>;
  }, [selectedDates, leaveByDate, leaveById]);

  const bulkCounts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    selectedLeaves.forEach((l) => { if (l.status in c) (c as any)[l.status]++; });
    return c;
  }, [selectedLeaves]);

  async function runBulk(
    filter: (l: (typeof selectedLeaves)[number]) => boolean,
    status: "approved" | "rejected" | "cancelled",
    verb: string,
  ) {
    const targets = selectedLeaves.filter(filter);
    if (targets.length === 0) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const l of targets) {
      try {
        await decideLeaveFn({ data: { id: l.id, status } });
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    await qc.invalidateQueries({ queryKey: ["employee", "leaves", employeeId] });
    clearSelection();
    if (fail === 0) toast.success(`${verb} ${ok} leave${ok === 1 ? "" : "s"}`);
    else toast.error(`${verb} ${ok} · ${fail} failed`);
  }

  function requestBulkApprove() {
    const targets = selectedLeaves.filter((l) => l.status !== "approved");
    if (targets.length === 0) return;
    // Aggregate conflicts across all targets.
    const allLines: string[] = [];
    for (const l of targets) {
      const c = conflictsForLeave(l.id);
      const lines = summarizeConflicts(c);
      if (lines.length) allLines.push(`${l.type} (${l.start} → ${l.end}): ${lines.join("; ")}`);
    }
    const doIt = () => runBulk((l) => l.status !== "approved", "approved", "Approved");
    if (allLines.length === 0) { void doIt(); return; }
    setConfirm({
      kind: "bulk",
      title: `Approve / re-open ${targets.length} leave${targets.length === 1 ? "" : "s"}?`,
      description: "Some requests have scheduling conflicts:",
      conflicts: allLines,
      onConfirm: doIt,
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="font-display text-base font-semibold tracking-tight">{monthLabel}</h2>
          <button
            onClick={() => shiftMonth(1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span><span className="font-semibold text-emerald-600 tabular-nums">{stats.present}</span> <span className="text-muted-foreground">present</span></span>
          <span><span className="font-semibold text-amber-600 tabular-nums">{stats.late}</span> <span className="text-muted-foreground">late</span></span>
          <span><span className="font-semibold text-destructive tabular-nums">{stats.absent}</span> <span className="text-muted-foreground">absent</span></span>
          <span><span className="font-semibold text-sky-600 tabular-nums">{stats.leave}</span> <span className="text-muted-foreground">leave</span></span>
          <span className="text-muted-foreground">/ <span className="font-semibold text-foreground tabular-nums">{stats.working}</span> working days</span>
        </div>
      </div>
      {selectedDates.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedDates.size} day{selectedDates.size === 1 ? "" : "s"} selected</span>
            <span>·</span>
            <span>{selectedLeaves.length} leave request{selectedLeaves.length === 1 ? "" : "s"}</span>
            {bulkCounts.pending > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700">{bulkCounts.pending} pending</span>}
            {bulkCounts.approved > 0 && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-700">{bulkCounts.approved} approved</span>}
            {(bulkCounts.rejected + bulkCounts.cancelled) > 0 && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{bulkCounts.rejected + bulkCounts.cancelled} closed</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={bulkBusy || selectedLeaves.every((l) => l.status === "approved")}
              onClick={requestBulkApprove}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/25 disabled:opacity-40"
            >
              <Check className="h-3 w-3" /> Approve / Re-open
            </button>
            <button
              type="button"
              disabled={bulkBusy || bulkCounts.approved === 0}
              onClick={() => runBulk((l) => l.status === "approved", "cancelled", "Revoked")}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold hover:bg-muted/80 disabled:opacity-40"
            >
              <X className="h-3 w-3" /> Revoke approved
            </button>
            <button
              type="button"
              disabled={bulkBusy || bulkCounts.pending === 0}
              onClick={() => runBulk((l) => l.status === "pending", "rejected", "Rejected")}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/25 disabled:opacity-40"
            >
              <X className="h-3 w-3" /> Revoke pending
            </button>
            <button type="button" onClick={clearSelection} className="rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-semibold w-8">
                <input
                  type="checkbox"
                  aria-label="Select all leave days"
                  checked={(() => {
                    const leaveRows = rows.filter((r) => r.leave);
                    return leaveRows.length > 0 && leaveRows.every((r) => selectedDates.has(r.date));
                  })()}
                  onChange={(e) => {
                    const leaveRows = rows.filter((r) => r.leave);
                    if (e.target.checked) setSelectedDates(new Set(leaveRows.map((r) => r.date)));
                    else clearSelection();
                  }}
                />
              </th>
              <th className="px-3 py-3 text-start font-semibold">Date</th>
              <th className="px-3 py-3 text-start font-semibold">Day</th>
              <th className="px-3 py-3 text-start font-semibold">Check In</th>
              <th className="px-3 py-3 text-start font-semibold">Check Out</th>
              <th className="px-3 py-3 text-start font-semibold">Hours</th>
              <th className="px-3 py-3 text-end font-semibold">Status</th>
              <th className="px-5 py-3 text-end font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : rows.map((r) => {
              const st = statusFor(r);
              const explain = explainFor(r, st.label);
              const busy = r.leave ? pendingLeaveId === r.leave.id : false;
              const rowConflicts = r.leave ? conflictsForLeave(r.leave.id) : null;
              const conflictLines = rowConflicts ? summarizeConflicts(rowConflicts) : [];
              const paidLabel = r.leave ? (r.leave.paid === false ? "unpaid" : r.leave.paid ? "paid" : "n/a") : "";
              return (
                <tr key={r.date} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {r.leave ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.date}`}
                        checked={selectedDates.has(r.date)}
                        onChange={() => toggleDate(r.date)}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-[13px] tabular-nums">{formatDate(r.date)}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {r.dayLabel}
                    {r.holiday && <span className="ms-2 text-[11px] font-medium text-violet-600">· {r.holiday.name}</span>}
                    {r.leave && (
                      <span className={`ms-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${r.leave.status === "approved" ? "bg-sky-500/15 text-sky-600"
                          : r.leave.status === "pending" ? "bg-amber-500/15 text-amber-600"
                            : "bg-muted text-muted-foreground"
                        }`}>
                        {r.leave.status === "pending" ? "Pending" : r.leave.status === "approved" ? "Leave" : r.leave.status}
                        {" · "}{r.leave.type}
                        {r.leave.paid === false ? " · unpaid" : r.leave.paid ? " · paid" : ""}
                      </span>
                    )}
                    {conflictLines.length > 0 && (
                      <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive" title={conflictLines.join(" · ")}>
                        <AlertTriangle className="h-3 w-3" /> conflict
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums">{r.rec?.in_time ? new Date(r.rec.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{r.rec?.out_time ? new Date(r.rec.out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{hours(r.rec)}</td>
                  <td className="px-3 py-3 text-end">
                    <div className="inline-flex items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" aria-label="Why this status?" className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                              <InfoIcon className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[300px] text-[11px] leading-relaxed">
                            <div>{explain}</div>
                            {r.leave && (
                              <div className="mt-1 border-t border-primary-foreground/20 pt-1">
                                <div><span className="font-semibold">Type:</span> {r.leave.type}</div>
                                <div><span className="font-semibold">Compensation:</span> {paidLabel}</div>
                                <div><span className="font-semibold">Status:</span> {r.leave.status}</div>
                              </div>
                            )}
                            {conflictLines.length > 0 && (
                              <div className="mt-1 border-t border-primary-foreground/20 pt-1">
                                <div className="font-semibold">Conflicts:</div>
                                <ul className="list-disc ps-4">
                                  {conflictLines.map((l, i) => <li key={i}>{l}</li>)}
                                </ul>
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-end">
                    {r.leave ? (
                      <div className="inline-flex items-center gap-1.5">
                        {r.leave.status !== "approved" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => requestApprove(r.leave!.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/25 disabled:opacity-50"
                            title={r.leave.status === "pending" ? "Approve pending leave" : "Re-open and approve leave"}
                          >
                            <Check className="h-3 w-3" /> {r.leave.status === "pending" ? "Approve" : "Re-open"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => decideLeave(r.leave!.id, "cancelled")}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
                            title="Revoke leave for this range"
                          >
                            <X className="h-3 w-3" /> Revoke
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {confirm?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.conflicts && confirm.conflicts.length > 0 && (
            <ul className="max-h-56 list-disc space-y-1 overflow-auto rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 ps-6 text-xs text-amber-900">
              {confirm.conflicts.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                if (c) await c.onConfirm();
              }}
            >
              Proceed anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LeavesHistoryPanel({ employeeId }: { employeeId: string }) {
  const fn = useServerFn(getEmployeeLeavesHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["employee", "leaves", employeeId],
    queryFn: () => fn({ data: { employee_id: employeeId } }),
  });
  const rows = (data ?? []) as any[];
  const tone = (s: string) =>
    s === "approved" ? "bg-emerald-500/10 text-emerald-600" :
      s === "rejected" ? "bg-destructive/10 text-destructive" :
        s === "cancelled" ? "bg-muted text-muted-foreground" :
          "bg-amber-500/10 text-amber-600";
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-base font-semibold">Leaves</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leave requests.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{l.leave_type_name ?? "Leave"} · {l.days ?? "—"}d {l.paid === false ? "(unpaid)" : ""}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{formatDate(l.start_date)} → {formatDate(l.end_date)}</p>
                {l.reason && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{l.reason}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone(l.status)}`}>{l.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeavesTab({ leaves }: { leaves: Array<{ id: number; type: string; start: string; end: string; status: string }> }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<LeaveStatus>("All");
  const counts = {
    All: leaves.length,
    Pending: leaves.filter((l) => l.status === "Pending").length,
    Approved: leaves.filter((l) => l.status === "Approved").length,
    Rejected: leaves.filter((l) => l.status === "Rejected").length,
  };
  const labels: Record<LeaveStatus, string> = {
    All: t("all"), Pending: t("pending"), Approved: t("approved"), Rejected: t("rejected"),
  };
  const filtered = filter === "All" ? leaves : leaves.filter((l) => l.status === filter);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {(["All", "Pending", "Approved", "Rejected"] as LeaveStatus[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-2xl border px-3 py-2.5 text-start transition-colors ${filter === k ? "border-brand bg-gradient-brand text-brand-foreground shadow-brand" : "border-border bg-card hover:bg-muted/50"
              }`}
          >
            <p className={`text-[10px] uppercase tracking-wider ${filter === k ? "text-brand-foreground/80" : "text-muted-foreground"}`}>{labels[k]}</p>
            <p className="font-display text-lg font-semibold tabular-nums">{counts[k]}</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-sm font-semibold">{l.type}</p>
                <p className="text-[11px] text-muted-foreground">{l.start} → {l.end}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${leaveTone(l.status)}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${leaveDot(l.status)}`} />
                {l.status === "Approved" ? t("approved") : l.status === "Rejected" ? t("rejected") : t("pending")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoTab({ employee }: { employee: Employee }) {
  const { t } = useI18n();
  const viewerRole = useViewerRole();
  const allowedToSeeSensitive = canViewSensitive(viewerRole);
  const allEmployees = useStore((s) => s.employees);
  const gradesFn = useServerFn(listJobGrades);
  const { data: grades } = useQuery({ queryKey: ["job-grades"], queryFn: () => gradesFn(), staleTime: 5 * 60_000 });
  const departments = useMemo(
    () => Array.from(new Set(allEmployees.map((x) => x.dept).filter(Boolean))),
    [allEmployees],
  );
  const managerOptions = useMemo(
    () => allEmployees.filter((x) => x.id !== employee.id),
    [allEmployees, employee.id],
  );
  const e = employee as any;
  const [form, setForm] = useState({
    phone: e.phone ?? "",
    personalPhone: e.personalPhone ?? "",
    branch: employee.branch,
    status: employee.status as string,
    gender: e.gender ?? "",
    country: e.country ?? "Egypt",
    city: e.city ?? "",
    district: e.district ?? "",
    street: e.street ?? "",
    building: e.building ?? "",
    flat: e.flat ?? "",
    nationalId: e.nationalId ?? "",
    nationalIdExpiry: e.nationalIdExpiry ?? "",
    dept: employee.dept ?? "",
    manager: e.manager ?? "",
    job_grade: e.job_grade ?? "",
    contractType: e.contractType ?? "FullTime",
    position: e.position ?? employee.role,
    notes: e.notes ?? "",
    salary: String(e.salary ?? ""),
    salaryMode: (e.salaryMode ?? "gross") as "gross" | "net",
    allowance: String(e.allowance ?? ""),
    target: String(e.target ?? ""),
    targetDuration: e.targetDuration ?? "Monthly",
    password: e.password ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, StoredDoc | undefined>>(e.documents ?? {});
  const [subTab, setSubTab] = useState<InfoSubTab>("personal");
  const [revealId, setRevealId] = useState(false);

  const upd = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setErr(null);
    const trimmed = form.phone.trim();
    if (trimmed && !isValidEgPhone(trimmed)) {
      setErr(t("phoneInvalid"));
      return;
    }
    // National ID expiry validation
    const exp = form.nationalIdExpiry.trim();
    if (form.nationalId.trim()) {
      if (!exp) { setErr(t("idExpiryRequired")); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) { setErr(t("idExpiryInvalid")); return; }
      const d = new Date(exp + "T00:00:00");
      if (Number.isNaN(d.getTime())) { setErr(t("idExpiryInvalid")); return; }
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (d.getTime() < today.getTime()) { setErr(t("idExpiryInPast")); return; }
    }
    const normalized = trimmed ? formatEgPhone(trimmed) : "";
    // Derive gross & net from selected basis
    const sal = form.salary ? Number(form.salary) : undefined;
    const salaryGross = sal == null ? undefined : (form.salaryMode === "gross" ? sal : Math.round(sal / 0.9));
    const salaryNet = sal == null ? undefined : (form.salaryMode === "net" ? sal : Math.round(sal * 0.9));
    updateEmployee(employee.id, {
      ...form,
      phone: normalized,
      salary: sal,
      salaryGross,
      salaryNet,
      allowance: form.allowance ? Number(form.allowance) : undefined,
      target: form.target ? Number(form.target) : undefined,
      documents: docs,
    } as Partial<Employee>);
    setForm((f) => ({ ...f, phone: normalized }));
    toast.success(t("save"));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1 text-xs">
          {(SUB_TABS).map((k) => (
            <button
              key={k.id}
              onClick={() => setSubTab(k.id)}
              className={`flex-1 min-w-[110px] rounded-xl px-3 py-2 font-semibold transition-colors ${subTab === k.id
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {t(k.labelKey as any)}
            </button>
          ))}
        </div>

        {subTab === "personal" && (
          <Section title={t("personalInfo")}>
            <Field label={t("phone")}>
              <input
                type="tel" dir="ltr" inputMode="tel" value={form.phone}
                onChange={(ev) => upd("phone", formatEgPhone(ev.target.value))}
                maxLength={20} placeholder="+20 100 123 4567"
                className={inputCls + " font-mono"}
              />
            </Field>
            <Field label={t("personalPhone")}>
              <input
                type="tel" dir="ltr" inputMode="tel" value={form.personalPhone}
                onChange={(ev) => upd("personalPhone", ev.target.value)}
                maxLength={20} className={inputCls + " font-mono"}
              />
            </Field>
            <Field label={t("gender")}>
              <select value={form.gender} onChange={(ev) => upd("gender", ev.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="Male">{t("male")}</option>
                <option value="Female">{t("female")}</option>
              </select>
            </Field>
            <Field label={t("nationalId")}>
              <SensitiveInput
                value={form.nationalId}
                onChange={(v) => upd("nationalId", v)}
                allowed={allowedToSeeSensitive}
                revealed={revealId}
                onToggle={() => setRevealId((r) => !r)}
              />
            </Field>
            <Field label={t("idExpiry")}>
              <input
                type="date"
                value={form.nationalIdExpiry}
                onChange={(ev) => upd("nationalIdExpiry", ev.target.value)}
                className={inputCls + " font-mono"}
              />
            </Field>
          </Section>
        )}

        {subTab === "address" && (
          <Section title={t("addressInfo")}>
            <Field label={t("country")}><input value={form.country} onChange={(ev) => upd("country", ev.target.value)} className={inputCls} /></Field>
            <Field label={t("city")}><input value={form.city} onChange={(ev) => upd("city", ev.target.value)} className={inputCls} /></Field>
            <Field label={t("district")}><input value={form.district} onChange={(ev) => upd("district", ev.target.value)} className={inputCls} /></Field>
            <Field label={t("street")}><input value={form.street} onChange={(ev) => upd("street", ev.target.value)} className={inputCls} /></Field>
            <Field label={t("building")}><input value={form.building} onChange={(ev) => upd("building", ev.target.value)} className={inputCls} /></Field>
            <Field label={t("flat")}><input value={form.flat} onChange={(ev) => upd("flat", ev.target.value)} className={inputCls} /></Field>
          </Section>
        )}

        {subTab === "employment" && (
          <Section title={t("employmentInfo")}>
            <Field label={t("branch")}>
              <select value={form.branch} onChange={(ev) => upd("branch", ev.target.value)} className={inputCls}>
                {locations.map((l) => <option key={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label={t("department")}>
              <select value={form.dept} onChange={(ev) => upd("dept", ev.target.value)} className={inputCls}>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Job Grade (For Allowances)">
              <select value={form.job_grade} onChange={(ev) => upd("job_grade", ev.target.value)} className={inputCls}>
                <option value="">(None)</option>
                {(grades ?? []).filter((g: any) => g.active).map((g: any) => (
                  <option key={g.name_en} value={g.name_en}>{g.name_en}</option>
                ))}
              </select>
            </Field>
            <Field label={t("manager")}>
              <select value={form.manager} onChange={(ev) => upd("manager", ev.target.value)} className={inputCls}>
                <option value="">{t("noManager")}</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                ))}
              </select>
            </Field>
            <Field label={t("status")}>
              <select value={form.status} onChange={(ev) => upd("status", ev.target.value)} className={inputCls}>
                <option value="Active">{t("active")}</option>
                <option value="Inactive">{t("inactive")}</option>
              </select>
            </Field>
            <Field label={t("position")}>
              <input value={form.position} onChange={(ev) => upd("position", ev.target.value)} className={inputCls} />
            </Field>
            <Field label={t("notes")} full>
              <textarea
                value={form.notes} onChange={(ev) => upd("notes", ev.target.value)}
                rows={3} placeholder={t("notesPlaceholder")}
                className={inputCls + " min-h-[80px] resize-y"}
              />
            </Field>
          </Section>
        )}

        {subTab === "salary" && (
          <Section title={t("tabSalary")}>
            <Field label={t("salaryMode")} full>
              <div className="flex gap-2">
                {(["gross", "net"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${form.salaryMode === m
                        ? "border-brand bg-gradient-brand text-brand-foreground shadow-brand"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <input
                      type="radio"
                      name="salaryMode"
                      className="sr-only"
                      value={m}
                      checked={form.salaryMode === m}
                      onChange={() => upd("salaryMode", m)}
                    />
                    {m === "gross" ? t("salaryGross") : t("salaryNet")}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={`${t("salary")} (${form.salaryMode === "gross" ? t("salaryGross") : t("salaryNet")})`}>
              <input type="number" min={0} value={form.salary} onChange={(ev) => upd("salary", ev.target.value)} className={inputCls + " font-mono"} />
            </Field>
            <Field label={form.salaryMode === "gross" ? t("salaryNet") : t("salaryGross")}>
              <input
                readOnly
                value={(() => {
                  const n = Number(form.salary);
                  if (!form.salary || Number.isNaN(n)) return "";
                  // Simple demo conversion: 10% tax/insurance delta between gross and net.
                  const v = form.salaryMode === "gross" ? n * 0.9 : n / 0.9;
                  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
                })()}
                className={inputCls + " font-mono bg-muted/40 text-muted-foreground"}
              />
            </Field>
            <Field label={t("allowance")}>
              <input type="number" min={0} value={form.allowance} onChange={(ev) => upd("allowance", ev.target.value)} className={inputCls + " font-mono"} />
            </Field>
            <Field label={t("targetValue")}>
              <input type="number" min={0} value={form.target} onChange={(ev) => upd("target", ev.target.value)} className={inputCls + " font-mono"} />
            </Field>
            <Field label={t("targetDuration")}>
              <select value={form.targetDuration} onChange={(ev) => upd("targetDuration", ev.target.value)} className={inputCls}>
                <option value="Daily">{t("targetDaily")}</option>
                <option value="Weekly">{t("targetWeekly")}</option>
                <option value="Monthly">{t("targetMonthly")}</option>
                <option value="Quarterly">{t("targetQuarterly")}</option>
              </select>
            </Field>
            <Field label={t("contractType")}>
              <select value={form.contractType} onChange={(ev) => upd("contractType", ev.target.value)} className={inputCls}>
                <option value="FullTime">{t("fullTime")}</option>
                <option value="PartTime">{t("partTime")}</option>
                <option value="Temporary">{t("contractTemp")}</option>
                <option value="Internship">{t("contractIntern")}</option>
                <option value="Probation3M">{t("contractProbation3M")}</option>
              </select>
            </Field>
            <Field label={t("password")}>
              <SensitiveInput
                value={form.password}
                onChange={(v) => upd("password", v)}
                allowed={allowedToSeeSensitive}
                revealed={revealId}
                onToggle={() => setRevealId((r) => !r)}
              />
            </Field>
          </Section>
        )}

        {subTab === "documents" && (
          <Section title={t("documents")} grid={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              {DOC_KEYS.map((k) => (
                <DocUpload
                  key={k}
                  label={t(k as any)}
                  doc={docs[k]}
                  onChange={(d) => setDocs((prev) => ({ ...prev, [k]: d }))}
                />
              ))}
            </div>
          </Section>
        )}

        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        <div className="flex justify-end">
          <button onClick={save} className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand">{t("save")}</button>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-border bg-card p-5 h-fit">
        <h3 className="font-display text-base font-semibold">{t("todayOverview")}</h3>
        <Stat label={t("present")} value="19" />
        <Stat label={t("late")} value="2" />
        <Stat label={t("leaves")} value="12d" />
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm";

type InfoSubTab = "personal" | "address" | "employment" | "salary" | "documents";
const SUB_TABS: { id: InfoSubTab; labelKey: string }[] = [
  { id: "personal", labelKey: "tabPersonal" },
  { id: "address", labelKey: "tabAddress" },
  { id: "employment", labelKey: "tabEmployment" },
  { id: "salary", labelKey: "tabSalary" },
  { id: "documents", labelKey: "tabDocuments" },
];

function SensitiveInput({
  value, onChange, allowed, revealed, onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  allowed: boolean;
  revealed: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const showReal = allowed && revealed;
  const displayValue = showReal ? value : maskSensitive(value);
  return (
    <div className="flex items-center gap-2">
      <input
        value={displayValue}
        onChange={(ev) => showReal && onChange(ev.target.value)}
        readOnly={!showReal}
        maxLength={64}
        className={inputCls + " font-mono " + (!showReal ? "text-muted-foreground" : "")}
        aria-label={showReal ? "value" : t("masked")}
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={!allowed}
        title={allowed ? (revealed ? t("hide") : t("reveal")) : t("restrictedRole")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!allowed ? <Lock className="h-4 w-4" /> : revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const DOC_KEYS = [
  "docIdFront",
  "docIdBack",
  "docContract",
  "docCriminalFront",
  "docMilitaryFront",
  "docMilitaryBack",
  "docBirthCertificate",
  "docSkillsCert",
  "docMedicalInsurance",
  "docSocialInsurance",
] as const;

type StoredDoc = { name: string; type: string; size: number; dataUrl: string };

function Section({ title, children, grid = true }: { title: string; children: React.ReactNode; grid?: boolean }) {
  return (
    <div className="space-y-3 rounded-3xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {grid ? <div className="grid gap-3 sm:grid-cols-2">{children}</div> : children}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DocUpload({ label, doc, onChange }: { label: string; doc?: StoredDoc; onChange: (d: StoredDoc | undefined) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const validate = useServerFn(validateAndStoreDocument);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const accept = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
  const MAX = 2 * 1024 * 1024;

  async function handle(file?: File | null) {
    if (!file) return;
    setErrorMsg(null);
    setLastFile(file);
    const okType = ["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(file.type);
    if (!okType) { setErrorMsg(t("invalidFileType")); toast.error(t("invalidFileType")); return; }
    if (file.size > MAX) { setErrorMsg(t("fileTooLarge")); toast.error(t("fileTooLarge")); return; }
    setBusy(true);
    setProgress(0);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 90));
        };
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      setProgress(95);
      const res = await validate({
        data: { name: file.name, type: file.type, size: file.size, dataUrl },
      });
      setProgress(100);
      onChange({ name: res.name, type: res.type, size: res.size, dataUrl: res.dataUrl });
      setLastFile(null);
    } catch (err: any) {
      const code = String(err?.message ?? "").trim();
      const key = code === "fileTooLarge" || code === "invalidFileType" ? code : "uploadRejected";
      setErrorMsg(t(key as any));
      toast.error(t(key as any));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
      {doc ? (
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-card text-muted-foreground"><FileText className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <a href={doc.dataUrl} download={doc.name} className="block truncate text-xs font-semibold text-foreground hover:underline">{doc.name}</a>
            <p className="text-[10px] text-muted-foreground">{(doc.size / 1024).toFixed(0)} KB</p>
          </div>
          <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50">{busy ? t("validating") : t("replace")}</button>
          <button type="button" onClick={() => onChange(undefined)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
          <Upload className="h-3.5 w-3.5" /> {busy ? t("uploading") : t("upload")} <span className="text-[10px] opacity-70">PDF · PNG · JPG · ≤2MB</span>
        </button>
      )}
      {busy && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-brand transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {errorMsg && !busy && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          <span className="truncate">{errorMsg}</span>
          {lastFile && (
            <button type="button" onClick={() => handle(lastFile)} className="shrink-0 rounded-md border border-destructive/30 bg-background px-2 py-0.5 text-[10px] font-semibold">
              {t("retry")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ employeeName }: { employeeName: string }) {
  const { t } = useI18n();
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const statusLabel = (s: string) =>
    s === "present" ? t("present") :
      s === "late" ? t("late") :
        s === "absent" ? t("absent") :
          s === "leave" ? t("onLeave") :
            s;

  // Shift policy: 09:00 → 17:00
  const SHIFT_IN = 9 * 60;
  const SHIFT_OUT = 17 * 60;
  const toMin = (s: string) => {
    if (!s || s === "—") return null;
    const [h, m] = s.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const fmtMin = (n: number) => `${Math.floor(n / 60)}h ${(n % 60).toString().padStart(2, "0")}m`;
  const lateMin = (inT: string) => {
    const v = toMin(inT);
    return v == null ? 0 : Math.max(0, v - SHIFT_IN);
  };
  const earlyMin = (outT: string) => {
    const v = toMin(outT);
    return v == null ? 0 : Math.max(0, SHIFT_OUT - v);
  };

  const rows = myAttendance;

  const summary = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    return { total, present, absent };
  }, [rows]);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = rows.map((a) => ({
      [t("date")]: formatDate(a.date),
      [t("in")]: a.in,
      [t("out")]: a.out,
      [t("workingHours")]: a.hours,
      "Late (min)": lateMin(a.in),
      "Early Out (min)": earlyMin(a.out),
      [t("status")]: statusLabel(a.status),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const safe = employeeName.replace(/[^a-z0-9_-]+/gi, "_");
    XLSX.writeFile(wb, `attendance_${safe}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Days</p>
          <p className="mt-1 font-display text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("present")}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-success">{summary.present}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("absent")}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-destructive">{summary.absent}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("rowsPerPage")}</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
          >
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button
          onClick={exportExcel}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-semibold text-brand-foreground shadow-brand"
        >
          <Download className="h-3.5 w-3.5" /> {t("exportExcel")}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t("date")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("in")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("out")}</th>
                <th className="px-4 py-3 text-end font-semibold">Late</th>
                <th className="px-4 py-3 text-end font-semibold">Early Out</th>
                <th className="px-4 py-3 text-end font-semibold">{t("workingHours")}</th>
                <th className="px-4 py-3 text-end font-semibold">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">{t("noAttendance")}</td></tr>
              ) : slice.map((a) => {
                const lm = lateMin(a.in);
                const em = earlyMin(a.out);
                return (
                  <tr key={a.date} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{formatDate(a.date)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{a.in}</span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">{a.out}</td>
                    <td className={`px-4 py-3 text-end font-mono tabular-nums ${lm > 0 ? "text-warning-foreground" : "text-muted-foreground"}`}>
                      {lm > 0 ? fmtMin(lm) : "—"}
                    </td>
                    <td className={`px-4 py-3 text-end font-mono tabular-nums ${em > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {em > 0 ? fmtMin(em) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end font-mono tabular-nums">{a.hours}</td>
                    <td className="px-4 py-3 text-end">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${attTone(a.status)}`}>
                        {statusLabel(a.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("pageOf").replace("{page}", String(safePage)).replace("{total}", String(totalPages))}</span>
        <div className="flex items-center gap-1">
          <button
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 font-semibold disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl-flip" /> {t("prev")}
          </button>
          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 font-semibold disabled:opacity-40"
          >
            {t("next")} <ChevronRight className="h-3.5 w-3.5 rtl-flip" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-display text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
function leaveTone(s: string) {
  return s === "Approved" ? "bg-success/15 text-success" : s === "Rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-warning-foreground";
}
function leaveDot(s: string) {
  return s === "Approved" ? "bg-success" : s === "Rejected" ? "bg-destructive" : "bg-warning";
}

function ContractCard({
  employeeId,
  contractType,
  employeeStatus,
  currentPosition,
  currentSalary,
  currentSalaryMode,
}: {
  employeeId: string;
  contractType?: string;
  employeeStatus?: string;
  currentPosition?: string;
  currentSalary?: number;
  currentSalaryMode?: "gross" | "net";
}) {
  const { t } = useI18n();
  // Subscribe so renew/cancel triggers re-render.
  useStore((s) => s.contractOverrides[employeeId]);
  const info = getContractInfo(employeeId, contractType);

  const tone = info.cancelled
    ? { pill: "bg-muted text-muted-foreground", text: "text-muted-foreground", Icon: Ban, label: t("cancelled") }
    : info.remaining <= 0
      ? { pill: "bg-destructive/15 text-destructive", text: "text-destructive", Icon: AlertTriangle, label: t("expired") }
      : info.remaining <= 30
        ? { pill: "bg-destructive/15 text-destructive", text: "text-destructive", Icon: AlertTriangle, label: t("expiringSoon") }
        : info.remaining <= 90
          ? { pill: "bg-warning/15 text-warning", text: "text-warning", Icon: CheckCircle2, label: t("upcoming") }
          : { pill: "bg-success/15 text-success", text: "text-success", Icon: CheckCircle2, label: t("active") };

  const remainingText =
    info.remaining < 0
      ? `${Math.abs(info.remaining)} ${t("daysAgo")}`
      : info.remaining === 0
        ? t("endsToday")
        : `${info.remaining} ${t("days")}`;

  const endIso = fmtDate(info.end);
  const [dialog, setDialog] = useState<"renew12" | "renew6" | "cancel" | "reactivate" | null>(null);
  const [rehireOpen, setRehireOpen] = useState(false);
  const canRehire = employeeStatus && employeeStatus !== "Active";

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground">
            <FileSignature className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-base font-semibold">{t("contractInfo")}</p>
            <p className="text-xs text-muted-foreground">{contractType ?? "FullTime"}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}>
          <tone.Icon className="h-3 w-3" /> {tone.label}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground">{t("contractStart")}</p>
          <p className="mt-1 font-mono text-sm font-semibold">{fmtDate(info.start)}</p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground">{t("contractEnd")}</p>
          <p className="mt-1 font-mono text-sm font-semibold">{endIso}</p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="text-[11px] text-muted-foreground">{t("remainingDays")}</p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${tone.text}`}>{remainingText}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!info.cancelled && (
          <>
            <button
              onClick={() => setDialog("renew12")}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t("renewOneYear")}
            </button>
            <button
              onClick={() => setDialog("renew6")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t("renewSixMonths")}
            </button>
            <button
              onClick={() => setDialog("cancel")}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15"
            >
              <Ban className="h-3.5 w-3.5" /> {t("cancelContract")}
            </button>
          </>
        )}
        {info.cancelled && (
          <button
            onClick={() => setDialog("reactivate")}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t("reactivateContract")}
          </button>
        )}
        {canRehire && (
          <button
            onClick={() => setRehireOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t("rehire")}
          </button>
        )}
      </div>

      <AlertDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "cancel" ? t("cancelContract") : dialog === "reactivate" ? t("reactivateContract") : t("renew")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "cancel" ? t("confirmCancelContract") : dialog === "reactivate" ? t("confirmReactivateContract") : t("confirmRenewContract")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDialog(null)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (dialog === "renew12") { renewContract(employeeId, 12, endIso); toast.success(t("contractRenewed")); }
                else if (dialog === "renew6") { renewContract(employeeId, 6, endIso); toast.success(t("contractRenewed")); }
                else if (dialog === "cancel") { cancelContract(employeeId); toast.message(t("contractCancelledMsg")); }
                else if (dialog === "reactivate") { reactivateContract(employeeId); toast.success(t("contractRenewed")); }
                setDialog(null);
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rehireOpen && (
        <RehireModal
          employeeId={employeeId}
          defaults={{
            position: currentPosition ?? "",
            salary: currentSalary ?? 0,
            salaryMode: currentSalaryMode ?? "gross",
            contractType: contractType ?? "FullTime",
          }}
          onClose={() => setRehireOpen(false)}
        />
      )}
    </div>
  );
}

function RehireModal({
  employeeId,
  defaults,
  onClose,
}: {
  employeeId: string;
  defaults: { position: string; salary: number; salaryMode: "gross" | "net"; contractType: string };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const employee = useStore((s) => s.employees.find((e) => e.id === employeeId));
  const validate = useServerFn(validateRehire);
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [position, setPosition] = useState(defaults.position);
  const [salary, setSalary] = useState(String(defaults.salary || ""));
  const [salaryMode, setSalaryMode] = useState<"gross" | "net">(defaults.salaryMode);
  const [contractType, setContractType] = useState(defaults.contractType);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return setErr(t("idExpiryInvalid"));
    if (!position.trim()) return setErr("Position required");
    const sal = Number(salary);
    if (!sal || sal <= 0) return setErr("Salary required");
    const info = getContractInfo(employeeId, defaults.contractType);
    setBusy(true);
    try {
      const res = await validate({
        data: {
          employeeId,
          startDate,
          contractType,
          salaryMode,
          salary: sal,
          position: position.trim(),
          currentContractEnd: fmtDate(info.end),
          currentContractCancelled: info.cancelled,
        },
      });
      if (!res.ok) {
        setErr(t(res.error as any) || t("serverValidationFailed"));
        return;
      }
      rehireEmployee(employeeId, { startDate, contractType, position: position.trim(), salary: sal, salaryMode });
      logAudit({
        employeeId,
        employeeName: employee?.name ?? employeeId,
        action: "rehire",
        result: "success",
        gps: "unknown",
        network: "unknown",
        reason: `${t("rehireAudit")} · start=${startDate} · type=${contractType} · salary=${sal} (${salaryMode})`,
      });
      toast.success(t("rehireSuccess"));
      onClose();
    } catch {
      setErr(t("serverValidationFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-6 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("rehireEmployee")}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("rehireStartDate")}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls + " font-mono"} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("position")}</span>
            <input value={position} onChange={(e) => setPosition(e.target.value)} maxLength={60} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("contractType")}</span>
            <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputCls}>
              <option value="FullTime">{t("fullTime")}</option>
              <option value="PartTime">{t("partTime")}</option>
              <option value="Temporary">{t("contractTemp")}</option>
              <option value="Internship">{t("contractIntern")}</option>
              <option value="Probation3M">{t("contractProbation3M")}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("salary")}</span>
              <input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} className={inputCls + " font-mono"} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("salaryMode")}</span>
              <select value={salaryMode} onChange={(e) => setSalaryMode(e.target.value as "gross" | "net")} className={inputCls}>
                <option value="gross">{t("salaryGross")}</option>
                <option value="net">{t("salaryNet")}</option>
              </select>
            </label>
          </div>
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold">{t("cancel")}</button>
          <button disabled={busy} onClick={submit} className="flex-1 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">{busy ? t("validating") : t("confirm")}</button>
        </div>
      </div>
    </div>
  );
}
function attTone(s: string) {
  return s === "present" ? "bg-success/15 text-success" : s === "late" ? "bg-warning/20 text-warning-foreground" : s === "leave" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground";
}

function EmployeeDevicesPanel({ userId, canManage }: { userId: string; canManage: boolean }) {
  const listFn = useServerFn(listEmployeeDevices);
  const setStatusFn = useServerFn(setEmployeeDeviceStatus);
  const deleteFn = useServerFn(deleteEmployeeDevice);
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["employee-devices", userId],
    queryFn: () => listFn({ data: { user_id: userId } }),
  });

  async function setStatus(device_id: string, status: "approved" | "revoked" | "pending") {
    try {
      await setStatusFn({ data: { device_id, status } });
      toast.success(`Device ${status}`);
      qc.invalidateQueries({ queryKey: ["employee-devices", userId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }
  async function remove(device_id: string) {
    try {
      await deleteFn({ data: { device_id } });
      toast.success("Device removed");
      qc.invalidateQueries({ queryKey: ["employee-devices", userId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Devices</h2>
        <span className="text-xs text-muted-foreground">{rows.length} registered</span>
      </div>
      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No devices registered for this employee.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((d: any) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{d.label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">{d.id}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Registered {new Date(d.created_at).toLocaleString()}
                    {d.last_seen_at ? ` · Last seen ${new Date(d.last_seen_at).toLocaleString()}` : ""}
                  </p>
                  {d.user_agent && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{d.user_agent}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${d.status === "approved" ? "bg-success/15 text-success" :
                    d.status === "pending" ? "bg-warning/20 text-warning-foreground" :
                      "bg-destructive/15 text-destructive"
                  }`}>{d.status}</span>
                {canManage && d.status !== "approved" && (
                  <button onClick={() => setStatus(d.id, "approved")} className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand">
                    <Check className="h-3 w-3" /> Approve
                  </button>
                )}
                {canManage && d.status === "approved" && (
                  <button onClick={() => setStatus(d.id, "revoked")} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
                    Revoke
                  </button>
                )}
                {canManage && (
                  <button onClick={() => remove(d.id)} className="rounded-full border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const COLOR_LABELS: Record<string, string> = {
  "bg-yellow-200": "Yellow",
  "bg-pink-200": "Pink",
  "bg-green-200": "Green",
  "bg-blue-200": "Blue",
  "bg-purple-200": "Purple",
  "bg-orange-200": "Orange",
};

function EmployeeNotesPanel({ profileId, canManage }: { profileId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListStickyNotes);
  const createFn = useServerFn(adminCreateStickyNote);
  const updateFn = useServerFn(adminUpdateStickyNote);
  const deleteFn = useServerFn(adminDeleteStickyNote);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["employee", "notes", profileId],
    queryFn: () => listFn({ data: { profile_id: profileId } }),
  });

  const addNote = async (color: string) => {
    try {
      await createFn({ data: { profile_id: profileId, color } });
      qc.invalidateQueries({ queryKey: ["employee", "notes", profileId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const saveNote = async (n: StickyNote) => {
    try {
      await updateFn({ data: { id: n.id, title: n.title ?? "", content: n.content ?? "", color: n.color as any } });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["employee", "notes", profileId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const removeNote = async (id: string) => {
    try {
      await deleteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["employee", "notes", profileId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const patchLocal = (id: string, patch: Partial<StickyNote>) => {
    qc.setQueryData(["employee", "notes", profileId], (old: StickyNote[] | undefined) => {
      if (!old) return old;
      return old.map(n => n.id === id ? { ...n, ...patch } : n);
    });
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold inline-flex items-center gap-2">
          <StickyNoteIcon className="h-4 w-4" /> Notes
        </h2>
        {canManage && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">New:</span>
            {STICKY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => addNote(c)}
                title={`Add ${COLOR_LABELS[c] ?? c} note`}
                className={`h-6 w-6 rounded-full border border-border shadow-sm transition hover:scale-110 ${c}`}
              />
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <StickyNoteIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No notes yet. Add one above.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((n) => (
            <div key={n.id} className={`flex flex-col rounded-2xl p-4 shadow-sm ring-1 ring-black/5 ${n.color} text-slate-900`}>
              <input
                value={n.title ?? ""}
                onChange={(e) => patchLocal(n.id, { title: e.target.value })}
                placeholder="Title"
                readOnly={!canManage}
                className="w-full bg-transparent text-base font-semibold placeholder:text-slate-600/60 focus:outline-none"
              />
              <textarea
                value={n.content ?? ""}
                onChange={(e) => patchLocal(n.id, { content: e.target.value })}
                placeholder="Write something…"
                rows={4}
                readOnly={!canManage}
                className="mt-2 w-full flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-slate-600/60 focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {canManage && STICKY_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => patchLocal(n.id, { color: c })}
                      title={COLOR_LABELS[c] ?? c}
                      className={`h-4 w-4 rounded-full border border-black/10 ${c} ${n.color === c ? "ring-2 ring-slate-900/60" : ""}`}
                    />
                  ))}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => saveNote(n)} className="inline-flex items-center gap-1 rounded-full bg-slate-900/10 px-2.5 py-1 text-[10px] font-medium hover:bg-slate-900/20">
                      <Save className="h-3 w-3" /> Save
                    </button>
                    <button onClick={() => confirm("Delete note?") && removeNote(n.id)} className="inline-flex items-center gap-1 rounded-full bg-slate-900/10 px-2 py-1 text-[10px] font-medium hover:bg-red-500/20 text-red-700">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2 text-[10px] text-slate-700/70">
                Updated {new Date(n.updated_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusHistoryPanel({ profileId }: { profileId: string }) {
  const fn = useServerFn(listEmployeeStatusAudit);
  const { data, isLoading } = useQuery({
    queryKey: ["employee", "status-audit", profileId],
    queryFn: () => fn({ data: { profile_id: profileId, limit: 100 } }),
  });
  const rows = data ?? [];
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-base font-semibold">Status history</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-2xl border border-border bg-background p-3 text-sm">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">{r.source}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.previous_status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                    {r.previous_status ?? "—"}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.new_status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                    {r.new_status}
                  </span>
                  {r.inactive_reason && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      {r.inactive_reason}
                    </span>
                  )}
                </div>
                {r.changed_by_name && (
                  <p className="mt-1 text-xs text-muted-foreground">by {r.changed_by_name}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import { getAdvanceEligibility, updateAnnualAdvanceLimit } from "@/backend/functions/advances.functions";

function AdvancesTab({ employeeId }: { employeeId: string }) {
  const [page, setPage] = useState(1);
  const [editingLimit, setEditingLimit] = useState(false);
  const [annualLimit, setAnnualLimit] = useState("");

  const advancesFn = useServerFn(listAllAdvances);
  const eligibilityFn = useServerFn(getAdvanceEligibility);
  const updateLimitFn = useServerFn(updateAnnualAdvanceLimit);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "employee-advances", employeeId, page],
    queryFn: () => advancesFn({ data: { employee_id: employeeId, page, limit: 15 } })
  });

  const { data: eligibility, refetch: refetchEligibility } = useQuery({
    queryKey: ["admin", "employee-advance-eligibility", employeeId],
    queryFn: () => eligibilityFn({ data: { employee_id: employeeId } })
  });

  useEffect(() => {
    if (eligibility?.annualLimit && !editingLimit) {
      setAnnualLimit(eligibility.annualLimit.toString());
    }
  }, [eligibility, editingLimit]);

  const saveLimit = async () => {
    try {
      await updateLimitFn({ data: { employee_id: employeeId, limit: Number(annualLimit) } });
      toast.success("Annual limit updated successfully");
      setEditingLimit(false);
      refetchEligibility();
    } catch (e: any) {
      toast.error(e.message || "Failed to update limit");
    }
  };

  return (
    <div className="space-y-4">
      {/* Annual Limit Settings */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-base font-semibold">Advance Eligibility</h2>
          {!editingLimit ? (
            <button
              onClick={() => setEditingLimit(true)}
              className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand"
            >
              Edit Limit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingLimit(false)}
                className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={saveLimit}
                className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground"
              >
                Save
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Annual Advance Limit</p>
            {editingLimit ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  value={annualLimit}
                  onChange={(e) => setAnnualLimit(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
                />
                <span className="text-sm font-medium text-muted-foreground">EGP</span>
              </div>
            ) : (
              <p className="text-2xl font-display font-semibold text-brand">{Number(annualLimit).toLocaleString()} EGP</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">The maximum total amount this employee can request per year.</p>
          </div>
          
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Used This Year</p>
            <p className="text-2xl font-display font-semibold text-amber-500">
              {eligibility?.usedThisYear?.toLocaleString() ?? 0} EGP
            </p>
            <p className="text-xs text-muted-foreground mt-2">Total advances approved in the current calendar year.</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-base font-semibold">Advances History</h2>
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data?.advances.length === 0 ? (
        <p className="text-sm text-muted-foreground">No advances found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">Request #</th>
                <th className="px-3 py-2 text-start">Date</th>
                <th className="px-3 py-2 text-start">Amount</th>
                <th className="px-3 py-2 text-start">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.advances.map(a => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-mono text-xs text-brand">{a.request_number}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-mono font-medium">{a.requested_amount} {a.currency}</td>
                  <td className="px-3 py-2 capitalize">{a.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  );
}
