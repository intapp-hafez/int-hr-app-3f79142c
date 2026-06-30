import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
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
} from "@/backend/functions/employees.functions";
import { getEmployeeWorkingDays } from "@/backend/functions/employee-working-days.functions";
import { getMe } from "@/backend/functions/auth.functions";
import {
  listEmployeeDevices,
  setEmployeeDeviceStatus,
  deleteEmployeeDevice,
} from "@/backend/functions/devices.functions";
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
import { User as UserIcon, ShieldCheck, IdCard, Briefcase, CalendarDays, Plane, AlertCircle } from "lucide-react";
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


export const Route = createFileRoute("/admin/employees/$id")({
  component: EmployeeDetail,
});

type Tab = "info" | "attendance" | "leaves" | "devices";

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

      <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-sm">
        {(["info", "attendance", "leaves", "devices"] as Tab[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-full px-3 py-2 font-medium capitalize transition-colors ${
              tab === k ? "bg-gradient-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(k)}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab employee={employee} />}
      {tab === "attendance" && <AttendanceTab employeeName={employee.name} />}
      {tab === "leaves" && <LeavesTab leaves={leaves} />}
      {tab === "devices" && <DevicesTab devices={devices} />}
    </div>
  );
}

import type { EmployeeDetail as EmployeeDetailRow } from "@/backend/functions/employees.functions";

function RealEmployeeView({ detail, canEdit }: { detail: EmployeeDetailRow; canEdit: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const cityFn = useServerFn(listCitiesAndDistricts);
  const { data: locs } = useQuery({ queryKey: ["cities-districts"], queryFn: () => cityFn(), enabled: editing, staleTime: 5 * 60_000 });
  const updateFn = useServerFn(updateEmployeeAdmin);
  const initialForm = useMemo(() => ({
    full_name: detail.full_name ?? "",
    phone: detail.phone ?? "",
    emp_code: detail.emp_code ?? "",
    national_id: detail.national_id ?? "",
    id_issue_date: detail.id_issue_date ?? "",
    id_expiry_date: detail.id_expiry_date ?? "",
    city_id: detail.city_id ?? "",
    district_id: detail.district_id ?? "",
    department_id: detail.department_id ?? "",
    position_id: detail.position_id ?? "",
    manager_id: detail.manager_id ?? "",
    status: detail.status as "Active" | "Inactive",
    allow_past_expiry: false,
    salary_mode: (detail.salary_mode ?? "gross") as "gross" | "net",
    salary_gross: detail.salary_gross ?? 0,
    salary_net: detail.salary_net ?? 0,
    allowance: detail.allowance ?? 0,
    target_value: detail.target_value ?? 0,
    target_duration: (detail.target_duration ?? "Monthly") as "Daily"|"Weekly"|"Monthly"|"Quarterly"|"Yearly",
    contract_type: (detail.contract_type ?? "FullTime") as "FullTime"|"PartTime"|"Temporary"|"Internship"|"Probation3M",
    contract_start_date: detail.contract_start_date ?? "",
    contract_end_date: detail.contract_end_date ?? "",
    contract_cancelled: !!detail.contract_cancelled,
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
  const upd = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const districtsForCity = (locs?.districts ?? []).filter((d) => !form.city_id || d.city_id === form.city_id);
  type SideTab = "overview" | "employment" | "identity" | "roles" | "assignments" | "attendance" | "leaves" | "documents" | "devices";
  const [sideTab, setSideTab] = useState<SideTab>("overview");
  const sideNav: { id: SideTab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: UserIcon },
    { id: "employment", label: "Employment", icon: Briefcase },
    { id: "identity", label: "Identity", icon: IdCard },
    { id: "roles", label: "Roles", icon: ShieldCheck },
    { id: "assignments", label: "Assignments", icon: Target },
    { id: "attendance", label: "Attendance", icon: CalendarDays },
    { id: "leaves", label: "Leaves", icon: Plane },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "devices", label: "Devices", icon: Smartphone },
  ];

  async function save() {
    setErr(null);
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
      await updateFn({
        data: {
          id: detail.id,
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
          emp_code: form.emp_code.trim() || null,
          national_id: form.national_id.trim() || null,
          id_issue_date: form.id_issue_date || null,
          id_expiry_date: form.id_expiry_date || null,
          city_id: form.city_id || null,
          district_id: form.district_id || null,
          department_id: form.department_id || null,
          position_id: form.position_id || null,
          manager_id: form.manager_id || null,
          status: form.status,
          allow_past_expiry: form.allow_past_expiry,
          salary_mode: form.salary_mode,
          salary_gross: Number(form.salary_gross) || 0,
          salary_net: Number(form.salary_net) || 0,
          allowance: Number(form.allowance) || 0,
          target_value: Number(form.target_value) || 0,
          target_duration: form.target_duration,
          contract_type: form.contract_type,
          contract_start_date: form.contract_start_date || null,
          contract_end_date: form.contract_end_date || null,
          contract_cancelled: form.contract_cancelled,
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
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              {detail.status === "Active" ? t("active") : t("inactive")}
            </span>
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur hover:bg-white/25"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

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
          <EditField label="Employee Code"><input className={editInputCls + " font-mono"} value={form.emp_code} onChange={(e) => upd("emp_code", e.target.value)} /></EditField>
          <EditField label="Status">
            <select className={editInputCls} value={form.status} onChange={(e) => upd("status", e.target.value as any)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </EditField>
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
            <select className={editInputCls} value={form.department_id} onChange={(e) => upd("department_id", e.target.value)}>
              <option value="">—</option>
              {(locs?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name_en}</option>)}
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
          <EditField label="National ID"><input className={editInputCls + " font-mono"} value={form.national_id} onChange={(e) => upd("national_id", e.target.value)} /></EditField>
          <EditField label="ID Issue Date"><input type="date" className={editInputCls + " font-mono"} value={form.id_issue_date} onChange={(e) => upd("id_issue_date", e.target.value)} /></EditField>
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
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground md:col-span-3">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={form.contract_cancelled} onChange={(e) => upd("contract_cancelled", e.target.checked)} />
            Contract cancelled
          </label>
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
          <EditField label="Target Value"><input type="number" min={0} className={editInputCls + " font-mono"} value={form.target_value || ""} onChange={(e) => upd("target_value", Number(e.target.value))} /></EditField>
          <EditField label="Target Duration">
            <select className={editInputCls} value={form.target_duration} onChange={(e) => upd("target_duration", e.target.value as any)}>
              {["Daily","Weekly","Monthly","Quarterly","Yearly"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </EditField>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground md:col-span-3">
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
                    className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? "bg-gradient-brand text-brand-foreground shadow-brand"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <n.icon className="h-4 w-4" />
                    <span>{n.label}</span>
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
                  <Info icon={Calendar} label="Status" value={detail.status} />
                  <Info icon={Calendar} label="Created" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"} />
                  <Info icon={Calendar} label="Updated" value={detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "—"} />
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
                  <Info icon={Calendar} label="Allowance" value={detail.allowance != null ? `${detail.allowance.toLocaleString()} EGP` : "—"} mono />
                  <Info icon={Calendar} label="Target" value={detail.target_value != null ? `${detail.target_value} / ${detail.target_duration ?? "—"}` : "—"} />
                </div>
              </div>
            )}

            {sideTab === "identity" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <h2 className="mb-4 font-display text-base font-semibold">Identity</h2>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                  <Info icon={FileText} label="National ID" value={detail.national_id ?? "—"} mono />
                  <Info icon={Calendar} label="ID Issue Date" value={detail.id_issue_date ?? "—"} />
                  <Info icon={Calendar} label="ID Expiry Date" value={detail.id_expiry_date ?? "—"} />
                </div>
              </div>
            )}

            {sideTab === "roles" && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <h2 className="mb-3 font-display text-base font-semibold">Roles</h2>
                <div className="flex flex-wrap gap-1.5">
                  {detail.roles.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No roles assigned.</span>
                  ) : (
                    detail.roles.map((r) => (
                      <span key={r} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">{r}</span>
                    ))
                  )}
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

const editInputCls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
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
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                d.status === "approved" ? "bg-success/15 text-success" :
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
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const monthStart = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-01`;
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

  const weeklyDays: number[] = wdData?.weekly ?? [0, 1, 2, 3, 4];
  const monthOverride = wdData?.months.find((m: any) => m.year === cursor.year && m.month === cursor.month);
  const workingDayIdx: number[] = monthOverride?.days ?? weeklyDays;

  const attByDate = useMemo(() => {
    const m = new Map<string, any>();
    (attData ?? []).forEach((r: any) => { if (r.date) m.set(r.date, r); });
    return m;
  }, [attData]);

  const isFuture = (d: Date) => d.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const rows = useMemo(() => {
    const list: Array<{ date: string; dayLabel: string; dow: number; rec: any; isWorking: boolean; future: boolean }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(cursor.year, cursor.month - 1, d);
      const iso = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      list.push({
        date: iso,
        dayLabel: dt.toLocaleDateString(undefined, { weekday: "short" }),
        dow: dt.getDay(),
        rec: attByDate.get(iso),
        isWorking: workingDayIdx.includes(dt.getDay()),
        future: isFuture(dt),
      });
    }
    return list;
  }, [daysInMonth, cursor.year, cursor.month, attByDate, workingDayIdx]);

  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0, working = 0;
    rows.forEach((r) => {
      if (!r.isWorking) return;
      working++;
      if (r.future) return;
      const s = String(r.rec?.status ?? "").toLowerCase();
      if (r.rec && (s === "late" || (r.rec.in_time && s.includes("late")))) late++;
      else if (r.rec && r.rec.in_time) present++;
      else absent++;
    });
    return { present, late, absent, working };
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
    if (!r.isWorking) return { label: "OFF", cls: "bg-muted text-muted-foreground" };
    if (r.future) return { label: "—", cls: "bg-transparent text-muted-foreground" };
    const rec = r.rec;
    const s = String(rec?.status ?? "").toLowerCase();
    if (s === "late" || (rec && s.includes("late"))) return { label: "LATE", cls: "bg-amber-500/15 text-amber-600" };
    if (rec?.in_time) return { label: "PRESENT", cls: "bg-emerald-500/15 text-emerald-600" };
    return { label: "ABSENT", cls: "bg-destructive/10 text-destructive" };
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
          <span className="text-muted-foreground">/ <span className="font-semibold text-foreground tabular-nums">{stats.working}</span> working days</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-start font-semibold">Date</th>
              <th className="px-3 py-3 text-start font-semibold">Day</th>
              <th className="px-3 py-3 text-start font-semibold">Check In</th>
              <th className="px-3 py-3 text-start font-semibold">Check Out</th>
              <th className="px-3 py-3 text-start font-semibold">Hours</th>
              <th className="px-5 py-3 text-end font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : rows.map((r) => {
              const st = statusFor(r);
              return (
                <tr key={r.date} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[13px] tabular-nums">{r.date}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.dayLabel}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{r.rec?.in_time ? new Date(r.rec.in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{r.rec?.out_time ? new Date(r.rec.out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{hours(r.rec)}</td>
                  <td className="px-5 py-3 text-end">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
                <p className="text-[11px] text-muted-foreground font-mono">{l.start_date} → {l.end_date}</p>
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
            className={`rounded-2xl border px-3 py-2.5 text-start transition-colors ${
              filter === k ? "border-brand bg-gradient-brand text-brand-foreground shadow-brand" : "border-border bg-card hover:bg-muted/50"
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
              className={`flex-1 min-w-[110px] rounded-xl px-3 py-2 font-semibold transition-colors ${
                subTab === k.id
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
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      form.salaryMode === m
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
      [t("date")]: a.date,
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
                  <td className="px-4 py-3 font-medium">{a.date}</td>
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
    : info.remaining < 0
      ? { pill: "bg-destructive/15 text-destructive", text: "text-destructive", Icon: AlertTriangle, label: t("expired") }
      : info.remaining === 0
        ? { pill: "bg-destructive/15 text-destructive", text: "text-destructive", Icon: AlertTriangle, label: t("endsToday") }
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
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  d.status === "approved" ? "bg-success/15 text-success" :
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
