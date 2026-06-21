import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n, useTranslators } from "@/lib/i18n";
import { ChevronRight, Globe, Bell, MapPin, Wifi, Lock, LogOut, Smartphone, Check, ChevronDown, Shield, Signal, CircleDot, X, Eye, EyeOff, CalendarDays, MessageSquare, IdCard, User, Phone, Mail, Building2, UserCog, Wallet, FileSignature, CalendarClock } from "lucide-react";
import { InstallButton } from "@/components/InstallButton";
import {
  useStore,
  registerDevice,
  getCurrentDeviceId,
  deviceLabelGuess,
} from "@/lib/store";
import { changePassword } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, getMyProfileDetails } from "@/backend/functions/auth.functions";
import { AvatarUploader } from "@/components/AvatarUploader";

export const Route = createFileRoute("/employee/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { tBranch, tDept } = useTranslators();
  const me = useStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const meFn = useServerFn(getMe);
  const { data: realMe } = useQuery({ queryKey: ["me", "profile"], queryFn: () => meFn(), staleTime: 30_000 });
  const realProfile = realMe?.profile as { id?: string; full_name?: string | null; email?: string | null; avatar_url?: string | null; emp_code?: string | null } | undefined;
  const detailsFn = useServerFn(getMyProfileDetails);
  const { data: details } = useQuery({ queryKey: ["me", "details"], queryFn: () => detailsFn(), staleTime: 30_000 });
  const locations = useStore((s) => s.locations);
  const networks = useStore((s) => s.networks);
  const [deviceId, setDeviceId] = useState("");
  const myDevice = useStore((s) => s.devices.find((d) => d.id === deviceId && d.employeeId === me?.id));
  const [openProfile, setOpenProfile] = useState(false);
  const [openLoc, setOpenLoc] = useState(false);
  const [openNet, setOpenNet] = useState(false);
  const [openPwd, setOpenPwd] = useState(false);

  const myLocations = locations.filter((l) => l.name === me?.branch);
  const myNetworks = networks.filter((n) => n.branch === me?.branch);

  useEffect(() => { setDeviceId(getCurrentDeviceId()); }, []);

  function handleRegister() {
    if (!me) return;
    registerDevice({ employeeId: me.id, label: deviceLabelGuess() });
    toast.success(t("registerDevice"), { description: t("awaitingApproval") });
  }

  const status: "approved" | "pending" | "unregistered" =
    myDevice?.status === "approved" ? "approved" :
    myDevice?.status === "pending" ? "pending" : "unregistered";

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">More</h1>

      {/* Avatar + name card */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          {realProfile?.id ? (
            <AvatarUploader
              userId={realProfile.id}
              name={realProfile.full_name ?? realProfile.email ?? me?.name ?? "?"}
              url={realProfile.avatar_url}
              size="md"
              canEdit
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-brand text-brand-foreground font-display text-base font-semibold">
              {me?.name.split(" ").map((s) => s[0]).slice(0, 2).join("") ?? "??"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{realProfile?.full_name ?? me?.name ?? realProfile?.email}</p>
            <p className="truncate text-xs text-muted-foreground">{realProfile?.email ?? `${me?.id} • ${tDept(me?.dept)}`}</p>
            {realProfile?.emp_code && (
              <p className="mt-1 inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                {realProfile.emp_code}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* My Profile — read-only details */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <ExpandableRow
          icon={User}
          label="My Profile"
          hint="Read-only"
          open={openProfile}
          onToggle={() => setOpenProfile((v) => !v)}
        >
          <dl className="divide-y divide-border">
            <ProfileRow icon={IdCard} label="Employee code" value={details?.emp_code} mono />
            <ProfileRow icon={User} label="Full name" value={details?.full_name} />
            <ProfileRow icon={Phone} label="Phone" value={details?.phone} />
            <ProfileRow icon={Mail} label="Email" value={details?.email} />
            <ProfileRow icon={IdCard} label="National ID" value={details?.national_id} mono />
            <ProfileRow icon={Building2} label="Department" value={details?.department} />
            <ProfileRow icon={UserCog} label="Manager" value={details?.manager} />
            <ProfileRow
              icon={Wallet}
              label="Salary"
              value={
                details?.salary_amount != null
                  ? `${details.salary_amount.toLocaleString()} EGP${details.salary_mode ? ` (${details.salary_mode})` : ""}`
                  : null
              }
            />
            <ProfileRow icon={FileSignature} label="Contract" value={details?.contract_type} />
            <ProfileRow
              icon={CalendarClock}
              label="Contract remaining"
              value={
                details?.contract_remaining_days == null
                  ? null
                  : details.contract_remaining_days < 0
                    ? `Expired ${Math.abs(details.contract_remaining_days)} day(s) ago`
                    : `${details.contract_remaining_days} day(s)`
              }
            />
          </dl>
        </ExpandableRow>
      </section>

      {/* Quick links */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <Link to="/employee/leaves" className="block">
          <Row icon={CalendarDays} label={t("leaves")} right={<ChevronRight className="h-4 w-4 text-muted-foreground rtl-flip" />} />
        </Link>
        <Link to="/employee/messages" className="block">
          <Row icon={MessageSquare} label={t("messages")} right={<ChevronRight className="h-4 w-4 text-muted-foreground rtl-flip" />} />
        </Link>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <Row icon={Globe} label={t("language")} right={
          <div className="flex gap-1 rounded-full bg-muted p-0.5 text-xs font-medium">
            {(["en", "ar"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1 transition-colors ${lang === l ? "bg-background shadow-soft" : "text-muted-foreground"}`}
              >
                {l === "en" ? "EN" : "ع"}
              </button>
            ))}
          </div>
        } />
        <Row icon={Bell} label={t("pushNotifications")} right={<Toggle defaultOn />} />
        <button type="button" onClick={() => setOpenPwd(true)} className="block w-full text-start">
          <Row icon={Lock} label={t("changePassword")} />
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <ExpandableRow
          icon={MapPin}
          label={t("assignedLocations")}
          hint={`${myLocations.length} ${myLocations.length === 1 ? t("branch1") : t("branchN")}`}
          open={openLoc}
          onToggle={() => setOpenLoc((v) => !v)}
        >
          {myLocations.length === 0 ? (
            <EmptyHint text={t("noAssignedLocations")} />
          ) : (
            <ul className="space-y-2">
              {myLocations.map((l) => (
                <li key={l.id} className="rounded-xl bg-muted/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-background text-brand">
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{tBranch(l.name)}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {l.lat.toFixed(4)}, {l.lng.toFixed(4)}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      l.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      {l.active ? t("active") : t("off")}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CircleDot className="h-3 w-3" />{t("radius")}</span>
                    <span className="font-semibold tabular-nums text-foreground">{l.radius} m</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ExpandableRow>

        <ExpandableRow
          icon={Wifi}
          label={t("authorizedNetworks")}
          hint={`${myNetworks.length} ${myNetworks.length === 1 ? t("network1") : t("networkN")}`}
          open={openNet}
          onToggle={() => setOpenNet((v) => !v)}
        >
          {myNetworks.length === 0 ? (
            <EmptyHint text={t("noAuthorizedNetworks")} />
          ) : (
            <ul className="space-y-2">
              {myNetworks.map((n) => (
                <li key={n.id} className="rounded-xl bg-muted/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-background text-brand">
                        <Wifi className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{n.ssid}</p>
                        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Shield className="h-3 w-3" />{tBranch(n.branch)}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      n.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      <Signal className="h-3 w-3" />{n.active ? t("active") : t("off")}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>IP</span>
                    <span className="font-mono text-foreground">{n.ip}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ExpandableRow>
      </section>

      {/* Device */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground"><Smartphone className="h-4 w-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{t("registeredDevice")}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{deviceId || "…"}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            status === "approved" ? "bg-success/15 text-success" :
            status === "pending" ? "bg-warning/20 text-warning-foreground" :
            "bg-destructive/15 text-destructive"
          }`}>
            {status === "approved" ? t("approved") : status === "pending" ? t("pending") : t("deviceBlocked")}
          </span>
        </div>
        {status === "approved" ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-success"><Check className="h-3 w-3" /> {t("deviceApproved")}</p>
        ) : status === "pending" ? (
          <p className="text-xs text-muted-foreground">{t("awaitingApproval")}</p>
        ) : (
          <button onClick={handleRegister} className="w-full rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-brand">
            {t("registerDevice")}
          </button>
        )}
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-semibold">{t("appName")}</p>
          <p className="text-[11px] text-muted-foreground">PWA</p>
        </div>
        <InstallButton />
      </section>

      <Link to="/" className="flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
        <LogOut className="h-4 w-4 rtl-flip" /> {t("logout")}
      </Link>

      {openPwd && <ChangePasswordModal onClose={() => setOpenPwd(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== conf) { toast.error(t("passwordMismatch")); return; }
    if (next.length < 6) { toast.error(t("passwordTooShort")); return; }
    setBusy(true);
    const res = await changePassword(cur, next);
    setBusy(false);
    if (res === "ok") { toast.success(t("passwordChanged")); onClose(); }
    else if (res === "wrong-current") toast.error(t("wrongCurrentPassword"));
    else if (res === "too-short") toast.error(t("passwordTooShort"));
    else if (res === "no-session") toast.error("No session");
    else toast.error("Could not change password");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("changePasswordTitle")}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <PwdField label={t("currentPassword")} value={cur} onChange={setCur} show={show} />
        <PwdField label={t("newPassword")} value={next} onChange={setNext} show={show} />
        <PwdField label={t("confirmPassword")} value={conf} onChange={setConf} show={show} />

        <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {show ? t("hide") : t("reveal")}
        </button>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold">
            {t("cancel")}
          </button>
          <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
            {t("update")}
          </button>
        </div>
      </form>
    </div>
  );
}

function PwdField({ label, value, onChange, show }: { label: string; value: string; onChange: (v: string) => void; show: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        autoComplete="off"
      />
    </label>
  );
}

function Row({ icon: Icon, label, hint, right }: { icon: typeof Globe; label: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {right ?? <ChevronRight className="h-4 w-4 text-muted-foreground rtl-flip" />}
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Globe;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`max-w-[55%] truncate text-sm font-medium ${mono ? "font-mono" : ""} ${value ? "text-foreground" : "text-muted-foreground"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function Toggle({ defaultOn }: { defaultOn?: boolean }) {
  return (
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${defaultOn ? "bg-brand" : "bg-muted"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${defaultOn ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
  );
}

function ExpandableRow({
  icon: Icon, label, hint, open, onToggle, children,
}: {
  icon: typeof Globe; label: string; hint?: string; open: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-medium">{label}</p>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">{text}</p>;
}
