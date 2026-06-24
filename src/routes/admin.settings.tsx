import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Save, RotateCcw, Plus, Trash2, Clock, Wallet, Target, AlertTriangle, Gauge, CalendarDays, Sparkles, Pencil, X, Check, Wifi, Building2, Briefcase, MapPin, Mail, Bell, BellRing, Send, CalendarClock, Play, Timer, Coins, Tag, ChevronRight, Shield, Eye, EyeOff, Copy, KeyRound } from "lucide-react";
import { getVapidStatus } from "@/backend/functions/vapid-status.functions";
import { getSmtpConfig, saveSmtpConfig, sendTestEmail } from "@/backend/functions/smtp.functions";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  useStore,
  updatePolicy,
  resetPolicy,
  upsertKpi,
  removeKpi,
  upsertLeaveType,
  removeLeaveType,
  upsertHolidayType,
  removeHolidayType,
  upsertDepartment,
  removeDepartment,
  upsertPosition,
  removePosition,
  upsertCity,
  removeCity,
  upsertDistrict,
  removeDistrict,
  upsertNetwork,
  removeNetwork,
  updateSmtp,
  updateNotifPrefs,
  getNotifPrefs,
  upsertExportSchedule,
  removeExportSchedule,
  newExportScheduleId,
  type Kpi,
  type LeaveTypeDef,
  type HolidayTypeDef,
  type Policy,
  type DepartmentDef,
  type PositionDef,
  type CityDef,
  type DistrictDef,
  type Network,
  type SmtpSettings,
  type NotifPrefs,
  type ExportSchedule,
} from "@/lib/store";
import { runSchedule } from "@/lib/export-scheduler";

const SecurityPanel = lazy(() => import("@/components/admin/SecurityPanel").then((mod) => ({ default: mod.SecurityPanel })));

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

type Section = "shift" | "penalties" | "allowances" | "targets" | "kpis" | "holidayTypes" | "networks" | "smtp" | "notifPrefs" | "push" | "autoExports" | "security";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring";

function emptySchedule(): ExportSchedule {
  return {
    id: "",
    name: "",
    enabled: true,
    employeeIds: [],
    rangeKind: "yesterday",
    format: "csv",
    sendTime: "08:00",
    recipients: [],
  };
}

function AdminSettings() {
  const { t, lang } = useI18n();
  const policy = useStore((s) => s.policy);
  const networks = useStore((s) => s.networks);
  const smtp = useStore((s) => s.smtp);
  const notifPrefsMap = useStore((s) => s.notifPrefs);
  const employees = useStore((s) => s.employees);
  const schedules = useStore((s) => s.exportSchedules);
  const deliveries = useStore((s) => s.notifDeliveries);
  const managers = employees.filter((e) => employees.some((x) => (x as any).managerId === e.id));
  const [section, setSection] = useState<Section>("smtp");
  const [smtpDraft, setSmtpDraft] = useState<SmtpSettings>(smtp);
  const [schDraft, setSchDraft] = useState<ExportSchedule>(() => emptySchedule());
  const [recipientsText, setRecipientsText] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const loadSmtpFn = useServerFn(getSmtpConfig);
  const saveSmtpFn = useServerFn(saveSmtpConfig);
  const testSmtpFn = useServerFn(sendTestEmail);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadSmtpFn();
        if (cancelled || !remote) return;
        setSmtpDraft((d) => ({
          ...d,
          host: remote.host ?? d.host,
          port: remote.port ?? d.port,
          secure: remote.secure ?? d.secure,
          username: remote.username ?? d.username,
          fromEmail: remote.from_email ?? d.fromEmail,
          fromName: remote.from_name ?? d.fromName,
          password: "",
        }));
      } catch (e) {
        // non-fatal: keep local draft
        console.warn("Failed to load SMTP config", e);
      }
    })();
    return () => { cancelled = true; };
  }, [loadSmtpFn]);

  async function persistSmtp() {
    setSmtpSaving(true);
    try {
      await saveSmtpFn({
        data: {
          host: smtpDraft.host.trim(),
          port: Number(smtpDraft.port) || 0,
          secure: !!smtpDraft.secure,
          username: smtpDraft.username.trim(),
          password: smtpDraft.password ? smtpDraft.password : undefined,
          from_email: smtpDraft.fromEmail.trim(),
          from_name: smtpDraft.fromName.trim(),
        },
      });
      updateSmtp({ ...smtpDraft, password: "" });
      setSmtpDraft((d) => ({ ...d, password: "" }));
      toast.success(t("settingsSaved"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save SMTP settings");
    } finally {
      setSmtpSaving(false);
    }
  }

  async function testSmtp() {
    const to = smtpDraft.fromEmail.trim();
    if (!to) {
      toast.error("Set a From Email first");
      return;
    }
    setSmtpTesting(true);
    try {
      const res: any = await testSmtpFn({ data: { to } });
      if (res?.ok) toast.success(t("smtpTestSent"));
      else toast.error(res?.error ?? "Test failed");
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally {
      setSmtpTesting(false);
    }
  }
  const [prefsTarget, setPrefsTarget] = useState<string>("hr"); // "hr" | "manager:<id>"
  const currentPrefs = notifPrefsMap[prefsTarget] ?? getNotifPrefs(prefsTarget);
  const [prefsDraft, setPrefsDraft] = useState<NotifPrefs>(currentPrefs);
  const [draft, setDraft] = useState<Policy>(policy);
  const [newKpi, setNewKpi] = useState<Kpi>({ id: "", name: "", weight: 10, target: 0, unit: "" });
  const [editKpi, setEditKpi] = useState<Kpi | null>(null);
  const [newLT, setNewLT] = useState<LeaveTypeDef>({ id: "", name: "", annualDays: 0, paid: true, active: true });
  const [newHT, setNewHT] = useState<HolidayTypeDef>({ id: "", name: "", active: true });
  const [editLT, setEditLT] = useState<LeaveTypeDef | null>(null);
  const [editHT, setEditHT] = useState<HolidayTypeDef | null>(null);
  const [newDept, setNewDept] = useState<DepartmentDef>({ id: "", nameEn: "", nameAr: "", active: true });
  const [editDept, setEditDept] = useState<DepartmentDef | null>(null);
  const [newPos, setNewPos] = useState<PositionDef>({ id: "", nameEn: "", nameAr: "", active: true });
  const [editPos, setEditPos] = useState<PositionDef | null>(null);
  const [newCity, setNewCity] = useState<{ nameEn: string; nameAr: string }>({ nameEn: "", nameAr: "" });
  const [editCity, setEditCity] = useState<CityDef | null>(null);
  const [newDistrict, setNewDistrict] = useState<Record<string, { nameEn: string; nameAr: string }>>({});
  const [editDistrict, setEditDistrict] = useState<{ cityId: string; d: DistrictDef } | null>(null);
  const [newNet, setNewNet] = useState<Omit<Network, "id">>({ label: "", ssid: "", branch: "", ip: "", active: true });
  const [editNet, setEditNet] = useState<Network | null>(null);

  const upd = <K extends keyof Policy>(k: K, v: Policy[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    updatePolicy(draft);
    toast.success(t("settingsSaved"));
  }
  function reset() {
    resetPolicy();
    toast.message(t("resetToDefaults"));
  }
  function addKpi() {
    if (!newKpi.name.trim()) return toast.error(t("kpi"));
    const id = `k${Date.now().toString(36)}`;
    upsertKpi({ ...newKpi, id });
    setNewKpi({ id: "", name: "", weight: 10, target: 0, unit: "" });
    toast.success(t("add"));
  }
  function saveEditKpi() {
    if (!editKpi) return;
    if (!editKpi.name.trim()) return toast.error(t("kpi"));
    upsertKpi(editKpi);
    setEditKpi(null);
    toast.success(t("settingsSaved"));
  }
  function confirmRemoveKpi(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this KPI?")) return;
    removeKpi(id);
    toast.success(t("delete"));
  }
  function addLT() {
    if (!newLT.name.trim()) return toast.error(t("leaveTypeName"));
    const id = `lt${Date.now().toString(36)}`;
    upsertLeaveType({ ...newLT, id });
    setNewLT({ id: "", name: "", annualDays: 0, paid: true, active: true });
    toast.success(t("add"));
  }
  function addHT() {
    if (!newHT.name.trim()) return toast.error(t("holidayTypeName"));
    const id = `ht${Date.now().toString(36)}`;
    upsertHolidayType({ ...newHT, id });
    setNewHT({ id: "", name: "", active: true });
    toast.success(t("add"));
  }
  function saveEditLT() {
    if (!editLT) return;
    if (!editLT.name.trim()) return toast.error(t("leaveTypeName"));
    upsertLeaveType(editLT);
    setEditLT(null);
    toast.success(t("settingsSaved"));
  }
  function saveEditHT() {
    if (!editHT) return;
    if (!editHT.name.trim()) return toast.error(t("holidayTypeName"));
    upsertHolidayType(editHT);
    setEditHT(null);
    toast.success(t("settingsSaved"));
  }
  function toggleLTActive(l: LeaveTypeDef) {
    upsertLeaveType({ ...l, active: !l.active });
  }
  function toggleHTActive(h: HolidayTypeDef) {
    upsertHolidayType({ ...h, active: !h.active });
  }
  function confirmRemoveLT(id: string) {
    if (typeof window !== "undefined" && !window.confirm(t("confirmDeleteLeaveType"))) return;
    removeLeaveType(id);
    toast.success(t("delete"));
  }
  function confirmRemoveHT(id: string) {
    if (typeof window !== "undefined" && !window.confirm(t("confirmDeleteHolidayType"))) return;
    removeHolidayType(id);
    toast.success(t("delete"));
  }

  const tabs: { id: Section; label: string; icon: typeof Clock }[] = [
    { id: "smtp", label: t("tabSmtp"), icon: Mail },
    { id: "notifPrefs", label: t("tabNotifPrefs"), icon: Bell },
    { id: "push", label: "Push Notifications", icon: BellRing },
    { id: "autoExports", label: t("tabAutoExports"), icon: CalendarClock },
    { id: "security", label: "Security", icon: Shield },
  ];

  const configLinks = [
    { to: "/admin/shifts", label: "Shifts", icon: Timer, desc: "Work shift definitions" },
    { to: "/admin/late-penalties", label: "Late Penalties", icon: AlertTriangle, desc: "Lateness rule tiers" },
    { to: "/admin/allowances", label: "Allowances", icon: Coins, desc: "Pay allowance catalog" },
    { to: "/admin/targets-overtime", label: "Targets & Overtime", icon: Target, desc: "Hours targets and OT rules" },
    { to: "/admin/kpis", label: "KPIs", icon: Gauge, desc: "Performance indicators" },
    { to: "/admin/holiday-types", label: "Holiday Types", icon: Tag, desc: "Holiday category catalog" },
    { to: "/admin/networks", label: "Networks", icon: Wifi, desc: "Allowed Wi-Fi networks" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("settings") || "Settings"}</h1>
          <p className="text-sm text-muted-foreground">{t("settingsSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm">
            <RotateCcw className="h-4 w-4" /> {t("reset")}
          </button>
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand">
            <Save className="h-4 w-4" /> {t("save")}
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Configuration</h2>
          <p className="text-xs text-muted-foreground">Manage core HR rule sets in their dedicated pages.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {configLinks.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-brand/60 hover:shadow-brand"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-brand" />
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => {
          const active = section === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setSection(tb.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand text-brand-foreground shadow-brand"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              <tb.icon className="h-4 w-4" /> {tb.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        {section === "shift" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Shift Start">
              <input type="time" value={draft.shiftIn} onChange={(e) => upd("shiftIn", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Shift End">
              <input type="time" value={draft.shiftOut} onChange={(e) => upd("shiftOut", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Late Grace (minutes)" hint="No penalty within this window after shift start">
              <input type="number" min={0} value={draft.graceMinutes} onChange={(e) => upd("graceMinutes", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Early Checkout Grace (minutes)" hint="No penalty within this window before shift end">
              <input type="number" min={0} value={draft.earlyGraceMinutes} onChange={(e) => upd("earlyGraceMinutes", Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        )}

        {section === "penalties" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-sm font-semibold">Late Arrival Tiers (EGP)</h3>
              <p className="mb-3 text-xs text-muted-foreground">Penalty applied when late minutes exceed each threshold.</p>
              <div className="grid gap-4 md:grid-cols-3">
                <TierField label="Tier 1 ≥ min" minVal={draft.lateTier1Min} penalty={draft.lateTier1Penalty}
                  onMin={(v) => upd("lateTier1Min", v)} onPen={(v) => upd("lateTier1Penalty", v)} />
                <TierField label="Tier 2 ≥ min" minVal={draft.lateTier2Min} penalty={draft.lateTier2Penalty}
                  onMin={(v) => upd("lateTier2Min", v)} onPen={(v) => upd("lateTier2Penalty", v)} />
                <TierField label="Tier 3 ≥ min" minVal={draft.lateTier3Min} penalty={draft.lateTier3Penalty}
                  onMin={(v) => upd("lateTier3Min", v)} onPen={(v) => upd("lateTier3Penalty", v)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Early Checkout Penalty (EGP / hour)">
                <input type="number" min={0} value={draft.earlyPenaltyPerHour} onChange={(e) => upd("earlyPenaltyPerHour", Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Absence Penalty (EGP / day)">
                <input type="number" min={0} value={draft.absentPenaltyPerDay} onChange={(e) => upd("absentPenaltyPerDay", Number(e.target.value))} className={inputCls} />
              </Field>
            </div>
          </div>
        )}

        {section === "allowances" && (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Transport Allowance (EGP)">
              <input type="number" min={0} value={draft.transportAllowance} onChange={(e) => upd("transportAllowance", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Meal Allowance (EGP)">
              <input type="number" min={0} value={draft.mealAllowance} onChange={(e) => upd("mealAllowance", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Housing Allowance (EGP)">
              <input type="number" min={0} value={draft.housingAllowance} onChange={(e) => upd("housingAllowance", Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        )}

        {section === "targets" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Default Monthly Target (units)">
              <input type="number" min={0} value={draft.defaultMonthlyTarget} onChange={(e) => upd("defaultMonthlyTarget", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Target Bonus (EGP / unit over target)">
              <input type="number" min={0} value={draft.targetBonusPerUnit} onChange={(e) => upd("targetBonusPerUnit", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Overtime Pay (EGP / hour)">
              <input type="number" min={0} value={draft.overtimeRatePerHour} onChange={(e) => upd("overtimeRatePerHour", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Overtime After (minutes past shift end)">
              <input type="number" min={0} value={draft.overtimeAfterMinutes} onChange={(e) => upd("overtimeAfterMinutes", Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        )}

        {section === "kpis" && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">KPI</th>
                    <th className="px-3 py-2 text-start font-semibold">Weight (%)</th>
                    <th className="px-3 py-2 text-start font-semibold">Target</th>
                    <th className="px-3 py-2 text-start font-semibold">Unit</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {policy.kpis.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">No KPIs defined</td></tr>
                  ) : policy.kpis.map((k) => {
                    const isEditing = editKpi?.id === k.id;
                    const row = isEditing ? editKpi! : k;
                    return (
                      <tr key={k.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          {isEditing ? <input value={row.name} onChange={(e) => setEditKpi({ ...row, name: e.target.value })} className={inputCls} /> : k.name}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums">
                          {isEditing ? <input type="number" value={row.weight} onChange={(e) => setEditKpi({ ...row, weight: Number(e.target.value) })} className={inputCls} /> : `${k.weight}%`}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums">
                          {isEditing ? <input type="number" value={row.target} onChange={(e) => setEditKpi({ ...row, target: Number(e.target.value) })} className={inputCls} /> : k.target}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {isEditing ? <input value={row.unit} onChange={(e) => setEditKpi({ ...row, unit: e.target.value })} className={inputCls} /> : k.unit}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <div className="flex justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditKpi} className="rounded-lg p-1.5 text-success hover:bg-success/10" aria-label={t("save")}>
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditKpi(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("cancel")}>
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditKpi(k)} className="rounded-lg p-1.5 text-foreground hover:bg-muted" aria-label={t("edit")}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => confirmRemoveKpi(k.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label={t("delete")}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-dashed border-border p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add KPI</h4>
              <div className="grid gap-3 md:grid-cols-5">
                <input placeholder="Name" value={newKpi.name} onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })} className={`${inputCls} md:col-span-2`} />
                <input type="number" placeholder="Weight %" value={newKpi.weight} onChange={(e) => setNewKpi({ ...newKpi, weight: Number(e.target.value) })} className={inputCls} />
                <input type="number" placeholder="Target" value={newKpi.target} onChange={(e) => setNewKpi({ ...newKpi, target: Number(e.target.value) })} className={inputCls} />
                <input placeholder="Unit (e.g. %, deals)" value={newKpi.unit} onChange={(e) => setNewKpi({ ...newKpi, unit: e.target.value })} className={inputCls} />
              </div>
              <button onClick={addKpi} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
                <Plus className="h-4 w-4" /> Add KPI
              </button>
            </div>
          </div>
        )}

        {section === "holidayTypes" && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">{t("holidayTypeName")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("status")}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {policy.holidayTypes.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">{t("noHolidayTypes")}</td></tr>
                  ) : policy.holidayTypes.map((h) => {
                    const isEditing = editHT?.id === h.id;
                    return (
                      <tr key={h.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          {isEditing ? (
                            <input value={editHT.name} onChange={(e) => setEditHT({ ...editHT, name: e.target.value })} className={inputCls} />
                          ) : h.name}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => toggleHTActive(h)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${h.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                            {h.active ? t("active") : t("inactive")}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <div className="flex justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditHT} className="rounded-lg p-1.5 text-success hover:bg-success/10" aria-label={t("save")}>
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditHT(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("cancel")}>
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditHT(h)} className="rounded-lg p-1.5 text-foreground hover:bg-muted" aria-label={t("edit")}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => confirmRemoveHT(h.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label={t("delete")}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-dashed border-border p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addHolidayType")}</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <input placeholder={t("holidayTypeName")} value={newHT.name} onChange={(e) => setNewHT({ ...newHT, name: e.target.value })} className={`${inputCls} md:col-span-2`} />
              </div>
              <button onClick={addHT} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
                <Plus className="h-4 w-4" /> {t("addHolidayType")}
              </button>
            </div>
          </div>
        )}

        {section === "networks" && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">{t("networks")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("ssid")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("ipAddress")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("branch")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("status")}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {networks.map((n) => {
                    const isEditing = editNet?.id === n.id;
                    const row = isEditing ? editNet! : n;
                    return (
                      <tr key={n.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          {isEditing ? <input value={row.label} onChange={(e) => setEditNet({ ...row, label: e.target.value })} className={inputCls} /> : n.label}
                        </td>
                        <td className="px-3 py-2 font-mono" dir="ltr">
                          {isEditing ? <input value={row.ssid} onChange={(e) => setEditNet({ ...row, ssid: e.target.value })} className={inputCls} /> : n.ssid}
                        </td>
                        <td className="px-3 py-2 font-mono" dir="ltr">
                          {isEditing ? <input value={row.ip} onChange={(e) => setEditNet({ ...row, ip: e.target.value })} className={inputCls} /> : n.ip}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? <input value={row.branch} onChange={(e) => setEditNet({ ...row, branch: e.target.value })} className={inputCls} /> : n.branch}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => upsertNetwork({ ...n, active: !n.active })} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${n.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                            {n.active ? t("enabled") : t("disabled")}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <div className="flex justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={() => { upsertNetwork(editNet!); setEditNet(null); toast.success(t("settingsSaved")); }} className="rounded-lg p-1.5 text-success hover:bg-success/10"><Check className="h-4 w-4" /></button>
                                <button onClick={() => setEditNet(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditNet(n)} className="rounded-lg p-1.5 text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => { if (window.confirm(t("confirmDeleteNetwork"))) { removeNetwork(n.id); toast.success(t("delete")); } }} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-2xl border border-dashed border-border p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addNetwork")}</h4>
              <div className="grid gap-3 md:grid-cols-4">
                <input placeholder={t("networks")} value={newNet.label} onChange={(e) => setNewNet({ ...newNet, label: e.target.value })} className={inputCls} />
                <input placeholder={t("ssid")} value={newNet.ssid} onChange={(e) => setNewNet({ ...newNet, ssid: e.target.value })} className={inputCls} />
                <input placeholder={t("ipAddress")} value={newNet.ip} onChange={(e) => setNewNet({ ...newNet, ip: e.target.value })} className={inputCls} />
                <input placeholder={t("branch")} value={newNet.branch} onChange={(e) => setNewNet({ ...newNet, branch: e.target.value })} className={inputCls} />
              </div>
              <button
                onClick={() => {
                  if (!newNet.label.trim() || !newNet.ssid.trim()) return toast.error(t("addNetwork"));
                  const id = Math.max(0, ...networks.map((x) => x.id)) + 1;
                  upsertNetwork({ ...newNet, id });
                  setNewNet({ label: "", ssid: "", branch: "", ip: "", active: true });
                  toast.success(t("add"));
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                <Plus className="h-4 w-4" /> {t("addNetwork")}
              </button>
            </div>
          </div>
        )}

        {section === "smtp" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{t("smtpHint")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("smtpHost")}>
                <input value={smtpDraft.host} onChange={(e) => setSmtpDraft({ ...smtpDraft, host: e.target.value })} className={inputCls} dir="ltr" />
              </Field>
              <Field label={t("smtpPort")}>
                <input type="number" value={smtpDraft.port} onChange={(e) => setSmtpDraft({ ...smtpDraft, port: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label={t("smtpUsername")}>
                <input value={smtpDraft.username} onChange={(e) => setSmtpDraft({ ...smtpDraft, username: e.target.value })} className={inputCls} dir="ltr" />
              </Field>
              <Field label={t("smtpPassword")}>
                <div className="relative">
                  <input
                    type={showSmtpPassword ? "text" : "password"}
                    value={smtpDraft.password}
                    onChange={(e) => setSmtpDraft({ ...smtpDraft, password: e.target.value })}
                    className={`${inputCls} pr-10`}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-0 top-0 grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showSmtpPassword ? "Hide password" : "Show password"}
                  >
                    {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label={t("smtpFromName")}>
                <input value={smtpDraft.fromName} onChange={(e) => setSmtpDraft({ ...smtpDraft, fromName: e.target.value })} className={inputCls} />
              </Field>
              <Field label={t("smtpFromEmail")}>
                <input type="email" value={smtpDraft.fromEmail} onChange={(e) => setSmtpDraft({ ...smtpDraft, fromEmail: e.target.value })} className={inputCls} dir="ltr" />
              </Field>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={smtpDraft.secure} onChange={(e) => setSmtpDraft({ ...smtpDraft, secure: e.target.checked })} />
                {t("smtpSecure")}
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={smtpDraft.enabled} onChange={(e) => setSmtpDraft({ ...smtpDraft, enabled: e.target.checked })} />
                {t("smtpEnabled")}
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={persistSmtp}
                disabled={smtpSaving}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {smtpSaving ? "…" : t("save")}
              </button>
              <button
                onClick={testSmtp}
                disabled={smtpTesting}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                <Mail className="h-4 w-4" /> {smtpTesting ? "…" : t("smtpTest")}
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("recentDeliveries")}</h3>
              {deliveries.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noDeliveries")}</p>
              ) : (
                <ul className="max-h-64 space-y-1.5 overflow-auto text-xs">
                  {deliveries.filter((d) => d.channel === "email").slice(0, 30).map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-2 border-b border-border/50 pb-1 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{d.title}</p>
                        <p className="truncate text-muted-foreground">→ {d.recipientLabel} · {d.body}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.status === "sent" ? "bg-success/15 text-success" : d.status === "skipped_smtp" ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                        {d.status === "sent" ? t("deliveryStatusSent") : d.status === "skipped_smtp" ? t("deliveryStatusSkipped") : t("deliveryStatusSuppressed")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {section === "notifPrefs" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{t("notifPrefsSubtitle")}</p>
            <Field label={t("notifTarget")}>
              <select
                value={prefsTarget}
                onChange={(e) => {
                  const v = e.target.value;
                  setPrefsTarget(v);
                  setPrefsDraft(notifPrefsMap[v] ?? getNotifPrefs(v));
                }}
                className={inputCls}
              >
                <option value="hr">{t("hrAudience")}</option>
                {managers.map((m) => (
                  <option key={m.id} value={`manager:${m.id}`}>{m.name} — {m.dept}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-2 rounded-2xl border border-border bg-background/40 p-4 md:grid-cols-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prefsDraft.channels.push} onChange={(e) => setPrefsDraft({ ...prefsDraft, channels: { ...prefsDraft.channels, push: e.target.checked } })} />
                {t("channelPush")}
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prefsDraft.channels.email} onChange={(e) => setPrefsDraft({ ...prefsDraft, channels: { ...prefsDraft.channels, email: e.target.checked } })} />
                {t("channelEmail")}
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prefsDraft.channels.inApp} onChange={(e) => setPrefsDraft({ ...prefsDraft, channels: { ...prefsDraft.channels, inApp: e.target.checked } })} />
                {t("channelInApp")}
              </label>
            </div>
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <label className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={prefsDraft.quietHours.enabled} onChange={(e) => setPrefsDraft({ ...prefsDraft, quietHours: { ...prefsDraft.quietHours, enabled: e.target.checked } })} />
                {t("quietHoursEnabled")}
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("quietStart")}>
                  <input type="time" value={prefsDraft.quietHours.start} onChange={(e) => setPrefsDraft({ ...prefsDraft, quietHours: { ...prefsDraft.quietHours, start: e.target.value } })} className={inputCls} disabled={!prefsDraft.quietHours.enabled} />
                </Field>
                <Field label={t("quietEnd")}>
                  <input type="time" value={prefsDraft.quietHours.end} onChange={(e) => setPrefsDraft({ ...prefsDraft, quietHours: { ...prefsDraft.quietHours, end: e.target.value } })} className={inputCls} disabled={!prefsDraft.quietHours.enabled} />
                </Field>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{t("quietHint")}</p>
            </div>
            <button
              onClick={() => { updateNotifPrefs(prefsTarget, prefsDraft); toast.success(t("prefsSaved")); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand"
            >
              <Save className="h-4 w-4" /> {t("save")}
            </button>
          </div>
        )}

        {section === "push" && <PushNotificationsPanel />}

        {section === "autoExports" && (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">{t("autoExportsSubtitle")}</p>

            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">{t("scheduleName")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("scheduleRange")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("scheduleSendTime")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("scheduleFormat")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("scheduleRecipients")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("lastRun")}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {schedules.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">{t("noSchedules")}</td></tr>
                  ) : schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={s.enabled}
                            onChange={(e) => upsertExportSchedule({ ...s, enabled: e.target.checked })}
                          />
                          <span className="font-medium">{s.name}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {s.employeeIds.length === 0 ? t("all") : `${s.employeeIds.length} ${t("employees")}`}
                        </p>
                      </td>
                      <td className="px-3 py-2">{t(("range" + s.rangeKind.charAt(0).toUpperCase() + s.rangeKind.slice(1)) as any)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{s.sendTime}</td>
                      <td className="px-3 py-2 uppercase">{s.format}</td>
                      <td className="px-3 py-2 text-xs">{s.recipients.join(", ") || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.lastRunDate ? `${s.lastRunDate} (${s.lastRunStatus})` : "—"}
                      </td>
                      <td className="px-3 py-2 text-end">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => runSchedule(s, { manual: true })}
                            className="rounded-lg p-1.5 text-brand hover:bg-brand/10" title={t("runNow")}
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(t("delete"))) removeExportSchedule(s.id); }}
                            className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-dashed border-border p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addSchedule")}</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("scheduleName")}>
                  <input value={schDraft.name} onChange={(e) => setSchDraft({ ...schDraft, name: e.target.value })} className={inputCls} />
                </Field>
                <Field label={t("scheduleSendTime")}>
                  <input type="time" value={schDraft.sendTime} onChange={(e) => setSchDraft({ ...schDraft, sendTime: e.target.value })} className={inputCls} />
                </Field>
                <Field label={t("scheduleRange")}>
                  <select value={schDraft.rangeKind} onChange={(e) => setSchDraft({ ...schDraft, rangeKind: e.target.value as ExportSchedule["rangeKind"] })} className={inputCls}>
                    <option value="today">{t("rangeToday")}</option>
                    <option value="yesterday">{t("rangeYesterday")}</option>
                    <option value="last7">{t("rangeLast7")}</option>
                    <option value="last30">{t("rangeLast30")}</option>
                  </select>
                </Field>
                <Field label={t("scheduleFormat")}>
                  <select value={schDraft.format} onChange={(e) => setSchDraft({ ...schDraft, format: e.target.value as "csv" | "xlsx" })} className={inputCls}>
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel (XLSX)</option>
                  </select>
                </Field>
                <Field label={t("scheduleRecipients")}>
                  <input value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} placeholder="hr@company.com, ops@company.com" className={inputCls} dir="ltr" />
                </Field>
                <Field label={t("scheduleEmployees")}>
                  <select
                    multiple
                    value={schDraft.employeeIds}
                    onChange={(e) => setSchDraft({ ...schDraft, employeeIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                    className={`${inputCls} h-28`}
                  >
                    {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </Field>
              </div>
              <button
                onClick={() => {
                  if (!schDraft.name.trim()) return toast.error(t("scheduleName"));
                  const recipients = recipientsText.split(",").map((x) => x.trim()).filter(Boolean);
                  upsertExportSchedule({ ...schDraft, id: newExportScheduleId(), recipients });
                  setSchDraft(emptySchedule());
                  setRecipientsText("");
                  toast.success(t("add"));
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                <Plus className="h-4 w-4" /> {t("addSchedule")}
              </button>
            </div>
          </div>
        )}

        {section === "security" && (
          <Suspense fallback={<div className="h-40 rounded-2xl bg-muted/30" />}>
            <SecurityPanel />
          </Suspense>
        )}
      </div>
    </div>
  );
}

type BilItem = { id: string; nameEn: string; nameAr: string; active: boolean };
function BilingualList<T extends BilItem>({
  t, items, edit, setEdit, onSave, onRemove, onToggle, newItem, setNewItem, onAdd, addLabel,
}: {
  t: (k: any) => string;
  items: T[];
  edit: T | null;
  setEdit: (v: T | null) => void;
  onSave: (v: T) => void;
  onRemove: (id: string) => void;
  onToggle: (v: T) => void;
  newItem: T;
  setNewItem: (v: T) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-semibold">{t("nameEn")}</th>
              <th className="px-3 py-2 text-start font-semibold">{t("nameAr")}</th>
              <th className="px-3 py-2 text-start font-semibold">{t("status")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((it) => {
              const isEditing = edit?.id === it.id;
              const row = isEditing ? edit! : it;
              return (
                <tr key={it.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    {isEditing ? <input value={row.nameEn} onChange={(e) => setEdit({ ...row, nameEn: e.target.value })} className={inputCls} /> : it.nameEn}
                  </td>
                  <td className="px-3 py-2 font-medium" dir="rtl">
                    {isEditing ? <input value={row.nameAr} onChange={(e) => setEdit({ ...row, nameAr: e.target.value })} className={inputCls} dir="rtl" /> : it.nameAr}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => onToggle(it)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${it.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {it.active ? t("active") : t("inactive")}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={() => onSave(edit!)} className="rounded-lg p-1.5 text-success hover:bg-success/10"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEdit(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEdit(it)} className="rounded-lg p-1.5 text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => onRemove(it.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-dashed border-border p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{addLabel}</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder={t("nameEn")} value={newItem.nameEn} onChange={(e) => setNewItem({ ...newItem, nameEn: e.target.value })} className={inputCls} />
          <input placeholder={t("nameAr")} value={newItem.nameAr} onChange={(e) => setNewItem({ ...newItem, nameAr: e.target.value })} className={inputCls} dir="rtl" />
        </div>
        <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function TierField({
  label, minVal, penalty, onMin, onPen,
}: { label: string; minVal: number; penalty: number; onMin: (v: number) => void; onPen: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min={0} value={minVal} onChange={(e) => onMin(Number(e.target.value))} className={inputCls} />
        <input type="number" min={0} value={penalty} onChange={(e) => onPen(Number(e.target.value))} className={inputCls} placeholder="EGP" />
      </div>
    </div>
  );
}

function PushNotificationsPanel() {
  const getStatus = useServerFn(getVapidStatus);
  const [status, setStatus] = useState<{ publicKey: string; subject: string; configured: boolean; usingDevFallback: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const s = await getStatus();
      setStatus(s);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load VAPID status");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">Web Push (VAPID) configuration</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Push notifications use the Web Push protocol with a VAPID key pair. The public key is bundled in the client; the private key
          must be stored as a project secret named <code className="rounded bg-muted px-1">VAPID_PRIVATE_KEY</code>.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Status</span>
          </div>
          {loading ? (
            <span className="text-xs text-muted-foreground">Checking…</span>
          ) : status?.configured && !status.usingDevFallback ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Using dev fallback key
            </span>
          )}
        </div>

        {!loading && status && (
          <div className="mt-3 grid gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">VAPID public key</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]">{status.publicKey}</code>
                <button onClick={() => copy(status.publicKey)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-muted">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Subject</p>
              <code className="mt-1 block break-all rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]">{status.subject}</code>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <p className="text-sm font-semibold">Add the VAPID private key</p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-xs text-muted-foreground">
          <li>Generate a VAPID key pair (e.g. <code className="rounded bg-muted px-1">npx web-push generate-vapid-keys</code>) or reuse one you already own.</li>
          <li>Make sure the public key matches the one shown above. If not, update <code className="rounded bg-muted px-1">src/lib/vapid.ts</code> with the new public key and ask the agent to redeploy.</li>
          <li>Provide the private key as <code className="rounded bg-muted px-1">VAPID_PRIVATE_KEY</code> in your environment variables.</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={(e) => { e.preventDefault(); toast.info("Please set VAPID_PRIVATE_KEY in your server environment variables."); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand"
          >
            <KeyRound className="h-4 w-4" /> Add / update VAPID_PRIVATE_KEY
          </button>
          <button onClick={refresh} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
            <RotateCcw className="h-3.5 w-3.5" /> Refresh status
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Until a real key is stored, the server uses a development fallback so push works in preview — but production deployments should always have <code className="rounded bg-muted px-1">VAPID_PRIVATE_KEY</code> set.
        </p>
      </div>
    </div>
  );
}