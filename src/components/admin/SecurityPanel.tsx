import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  KeyRound,
  Globe,
  Network,
  Bug,
  FileWarning,
  Eye,
  ServerCog,
  CheckCircle2,
  AlertTriangle,
  Save,
  ScanSearch,
  Wrench,
  Loader2,
} from "lucide-react";
import {
  Camera,
  Mic,
  MapPin,
  Bell,
  Clipboard,
  Usb,
  Bluetooth,
  ScreenShare,
  Fingerprint,
  Compass,
} from "lucide-react";
import {
  getSecuritySettings,
  updateSecuritySettings,
  type SecuritySettingsInput,
} from "@/backend/functions/security-settings.functions";
import {
  runSecurityScan,
  applySecurityFix,
  type ScanFinding,
  type ScanResult,
} from "@/backend/functions/security-scan.functions";
import {
  listBlocklist,
  addBlocklistEntry,
  removeBlocklistEntry,
  listAuditEvents,
} from "@/backend/functions/security-blocklist.functions";
import { Trash2, Plus, ShieldAlert } from "lucide-react";

type SettingsRow = {
  enforce_2fa: boolean;
  session_timeout_minutes: number;
  ip_allowlist: string[];
  rate_limit_per_min: number;
  csp_enabled: boolean;
  hsts_enabled: boolean;
  x_frame_deny: boolean;
  referrer_policy: string;
  permissions_policy: string;
  block_sql_keywords: boolean;
  sanitize_html_inputs: boolean;
  cdn_subresource_integrity: boolean;
};

const DEFAULTS: SettingsRow = {
  enforce_2fa: false,
  session_timeout_minutes: 480,
  ip_allowlist: [],
  rate_limit_per_min: 120,
  csp_enabled: true,
  hsts_enabled: true,
  x_frame_deny: true,
  referrer_policy: "strict-origin-when-cross-origin",
  permissions_policy: "camera=(), microphone=(), geolocation=(self)",
  block_sql_keywords: true,
  sanitize_html_inputs: true,
  cdn_subresource_integrity: false,
};

const OWASP_2025 = [
  { id: "A01", name: "Broken Access Control", icon: Lock, mitigation: "Supabase RLS on every table + server-side requireAdminAccess / requireAdminRole guards on all admin server functions." },
  { id: "A02", name: "Cryptographic Failures", icon: KeyRound, mitigation: "TLS via HSTS, Supabase Auth password hashing, SMTP password stored via pgcrypto pgp_sym_encrypt." },
  { id: "A03", name: "Injection (SQL / XSS / Cmd)", icon: Bug, mitigation: "Parameterized PostgREST queries, Zod input validation, optional SQL-keyword block & HTML sanitization toggles below." },
  { id: "A04", name: "Insecure Design", icon: Shield, mitigation: "Roles separated in user_roles table, has_role/has_permission SECURITY DEFINER functions, least-privilege by default." },
  { id: "A05", name: "Security Misconfiguration", icon: ServerCog, mitigation: "Security headers middleware (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)." },
  { id: "A06", name: "Vulnerable / Outdated Components", icon: FileWarning, mitigation: "Dependency scanner + Subresource Integrity toggle for CDN assets." },
  { id: "A07", name: "Identification & Auth Failures", icon: KeyRound, mitigation: "Supabase Auth, optional 2FA enforcement, session timeout, bearer-token validation on every server fn." },
  { id: "A08", name: "Software & Data Integrity", icon: CheckCircle2, mitigation: "Signed webhooks under /api/public/*, SRI for external scripts, server-fn input validators." },
  { id: "A09", name: "Logging & Monitoring", icon: Eye, mitigation: "Audit log table + contract_audit_log; server errors funnel through errorMiddleware." },
  { id: "A10", name: "Server-Side Request Forgery", icon: Network, mitigation: "External fetch only from server fns; IP allowlist + rate limit configurable below." },
] as const;

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-background/40 p-3">
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-brand"
      />
    </label>
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

// ------- Device Permissions (Permissions-Policy directives) -------
type DeviceFeature = {
  key: string;
  label: string;
  hint: string;
  icon: typeof Camera;
};

const DEVICE_FEATURES: DeviceFeature[] = [
  { key: "camera", label: "Camera", hint: "Webcam access for face check-in & biometrics.", icon: Camera },
  { key: "microphone", label: "Microphone", hint: "Audio capture for voice notes or calls.", icon: Mic },
  { key: "geolocation", label: "Geolocation", hint: "GPS for geofenced attendance.", icon: MapPin },
  { key: "notifications", label: "Notifications", hint: "Browser push notifications.", icon: Bell },
  { key: "clipboard-read", label: "Clipboard read", hint: "Read clipboard contents.", icon: Clipboard },
  { key: "clipboard-write", label: "Clipboard write", hint: "Write to clipboard (copy buttons).", icon: Clipboard },
  { key: "usb", label: "USB devices", hint: "WebUSB peripherals (scanners, readers).", icon: Usb },
  { key: "bluetooth", label: "Bluetooth", hint: "Web Bluetooth devices.", icon: Bluetooth },
  { key: "display-capture", label: "Screen sharing", hint: "Screen capture / display recording.", icon: ScreenShare },
  { key: "publickey-credentials-get", label: "WebAuthn / Passkeys", hint: "Required for FIDO2 / fingerprint auth.", icon: Fingerprint },
  { key: "accelerometer", label: "Motion sensors", hint: "Accelerometer, gyroscope, magnetometer.", icon: Compass },
];

/**
 * Parse a Permissions-Policy header value like
 *   "camera=(), microphone=(self), geolocation=(self)"
 * into a map { camera: false, microphone: true, geolocation: true }.
 * Unknown / unlisted directives default to false (denied).
 */
function parsePermissionsPolicy(policy: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of DEVICE_FEATURES) out[f.key] = false;
  if (!policy) return out;
  for (const raw of policy.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    // allowed when value contains "self" or "*" — denied if () or empty list
    const allowed = /self|\*|https?:\/\//i.test(value);
    out[name] = allowed;
  }
  return out;
}

/** Rebuild the Permissions-Policy string from the toggle map, preserving any extra directives. */
function buildPermissionsPolicy(map: Record<string, boolean>, previous: string): string {
  const known = new Set(DEVICE_FEATURES.map((f) => f.key));
  const parts: string[] = [];
  // emit our known features in canonical order
  for (const f of DEVICE_FEATURES) {
    parts.push(`${f.key}=${map[f.key] ? "(self)" : "()"}`);
  }
  // preserve any unknown directives the user had
  for (const raw of (previous ?? "").split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim().toLowerCase();
    if (!known.has(name)) parts.push(part);
  }
  return parts.join(", ");
}

export function SecurityPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSecuritySettings);
  const saveFn = useServerFn(updateSecuritySettings);
  const scanFn = useServerFn(runSecurityScan);
  const fixFn = useServerFn(applySecurityFix);
  const listBlockFn = useServerFn(listBlocklist);
  const addBlockFn = useServerFn(addBlocklistEntry);
  const removeBlockFn = useServerFn(removeBlocklistEntry);
  const listEventsFn = useServerFn(listAuditEvents);

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [bulkFixing, setBulkFixing] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");

  const blocklistQ = useQuery({
    queryKey: ["security-blocklist"],
    queryFn: () => listBlockFn(),
  });
  const eventsQ = useQuery({
    queryKey: ["security-audit-events"],
    queryFn: () => listEventsFn(),
    refetchInterval: 15_000,
  });

  const addBlockM = useMutation({
    mutationFn: (p: { ip: string; reason: string }) =>
      addBlockFn({ data: { ip: p.ip, reason: p.reason || "manual" } }),
    onSuccess: () => {
      toast.success("IP added to blocklist");
      setNewIp("");
      setNewReason("");
      qc.invalidateQueries({ queryKey: ["security-blocklist"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const removeBlockM = useMutation({
    mutationFn: (id: string) => removeBlockFn({ data: { id } }),
    onSuccess: () => {
      toast.success("IP removed from blocklist");
      qc.invalidateQueries({ queryKey: ["security-blocklist"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const scanM = useMutation({
    mutationFn: () => scanFn(),
    onSuccess: (r) => {
      setScan(r);
      toast.success(`Scan complete — ${r.findings.length} finding(s)`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Scan failed"),
  });

  async function fixOne(f: ScanFinding) {
    setFixingId(f.id);
    try {
      await fixFn({ data: { id: f.id, category: f.category, target: f.target } });
      toast.success(`Fixed: ${f.title}`);
      const next = await scanFn();
      setScan(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fix failed");
    } finally {
      setFixingId(null);
    }
  }

  async function fixAll() {
    if (!scan) return;
    const fixable = scan.findings.filter((f) => f.fixable);
    if (fixable.length === 0) return;
    setBulkFixing(true);
    let ok = 0, fail = 0;
    for (const f of fixable) {
      try {
        await fixFn({ data: { id: f.id, category: f.category, target: f.target } });
        ok++;
      } catch {
        fail++;
      }
    }
    try {
      const next = await scanFn();
      setScan(next);
    } catch { /* ignore */ }
    setBulkFixing(false);
    toast[fail ? "warning" : "success"](`Applied ${ok} fix(es)${fail ? `, ${fail} failed` : ""}`);
  }

  const q = useQuery({
    queryKey: ["security-settings"],
    queryFn: () => getFn(),
  });

  const [draft, setDraft] = useState<SettingsRow>(DEFAULTS);
  const [ipText, setIpText] = useState("");

  useEffect(() => {
    if (q.data) {
      const d = q.data as SettingsRow;
      setDraft(d);
      setIpText((d.ip_allowlist ?? []).join(", "));
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: (payload: SecuritySettingsInput) => saveFn({ data: payload }),
    onSuccess: () => {
      toast.success("Security settings saved");
      qc.invalidateQueries({ queryKey: ["security-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const isAdmin = !q.isError; // getSecuritySettings is admin-area gated; error implies forbidden
  const headerSnapshot = useMemo(() => {
    if (typeof document === "undefined") return [] as string[];
    return [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ];
  }, []);

  function save() {
    const ips = ipText.split(",").map((s) => s.trim()).filter(Boolean);
    m.mutate({ ...draft, ip_allowlist: ips });
  }

  if (q.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading security settings…</div>;
  }

  if (q.isError) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">Forbidden</p>
          <p className="text-muted-foreground">Only admins can view security settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Security &amp; Hardening</h1>
          <p className="text-sm text-muted-foreground">
            OWASP Top 10 (2025) posture, response headers, and active runtime controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scanM.mutate()}
            disabled={scanM.isPending || !isAdmin}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            {scanM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {scanM.isPending ? "Scanning…" : "Full Scan"}
          </button>
          <button
            onClick={save}
            disabled={m.isPending || !isAdmin}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {m.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Scan Results */}
      {scan && (
        <section className="space-y-3 rounded-2xl border border-border bg-background/40 p-4">
          {/* Posture score header */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-3">
              <div
                className={
                  "grid h-14 w-14 place-items-center rounded-full text-lg font-bold " +
                  (scan.posture.score >= 90
                    ? "bg-success/15 text-success"
                    : scan.posture.score >= 70
                    ? "bg-warning/15 text-warning"
                    : "bg-destructive/15 text-destructive")
                }
              >
                {scan.posture.score}
              </div>
              <div>
                <p className="text-sm font-semibold">Security posture score</p>
                <p className="text-[11px] text-muted-foreground">
                  {scan.posture.passed} / {scan.posture.total} checks passing
                  {" "}— covers headers, cookies, CSRF, session, middleware, RLS.
                </p>
              </div>
            </div>
          </div>
          <ul className="grid gap-1.5 md:grid-cols-2">
            {scan.posture.checks.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-2 text-[11px]"
              >
                {c.pass ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">
                    <span className="mr-1 rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {c.group}
                    </span>
                    {c.label}
                  </p>
                  <p className="text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">Scan Results</h4>
              <p className="text-[11px] text-muted-foreground">
                {scan.findings.length === 0
                  ? "No issues detected."
                  : `${scan.findings.length} finding(s) — ${scan.findings.filter((f) => f.fixable).length} auto-fixable.`}
                {" "}Last run {new Date(scan.ranAt).toLocaleTimeString()}.
              </p>
            </div>
            {scan.findings.some((f) => f.fixable) && (
              <button
                onClick={fixAll}
                disabled={bulkFixing}
                className="inline-flex items-center gap-1.5 rounded-full bg-success px-4 py-2 text-sm font-semibold text-success-foreground disabled:opacity-60"
              >
                {bulkFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                {bulkFixing ? "Fixing…" : "Fix All"}
              </button>
            )}
          </div>
          {scan.findings.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {scan.findings.map((f) => (
                <li key={f.id} className="flex items-start gap-3 p-3">
                  <span
                    className={
                      "mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
                      (f.severity === "high"
                        ? "bg-destructive/15 text-destructive"
                        : f.severity === "medium"
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {f.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-[11px] text-muted-foreground">{f.detail}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{f.target}</p>
                  </div>
                  {f.fixable ? (
                    <button
                      onClick={() => fixOne(f)}
                      disabled={fixingId === f.id || bulkFixing}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                    >
                      {fixingId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                      Fix
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] text-muted-foreground">manual</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Auto-Blocklist */}
      <section className="space-y-3 rounded-2xl border border-border bg-background/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <h4 className="text-sm font-semibold">IP Blocklist</h4>
              <p className="text-[11px] text-muted-foreground">
                Auto-added when a source IP probes critical paths (/wp-admin, /.env, SQLi/XSS payloads, etc.) or hits the rate limit. Remove an IP if it was caught by mistake.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-background p-3">
          <Field label="IP / CIDR">
            <input
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="203.0.113.4 or 10.0.0.0/8"
              className="w-56 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </Field>
          <Field label="Reason">
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="manual block"
              className="w-64 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </Field>
          <button
            onClick={() => newIp && addBlockM.mutate({ ip: newIp, reason: newReason })}
            disabled={!newIp || addBlockM.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Block IP
          </button>
        </div>

        {blocklistQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading blocklist…</p>
        ) : (blocklistQ.data?.entries ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No IPs currently blocked.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(blocklistQ.data?.entries ?? []).map((e: any) => (
              <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="font-mono text-xs">{e.ip}</span>
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
                    (e.manual
                      ? "bg-muted text-muted-foreground"
                      : "bg-destructive/15 text-destructive")
                  }
                >
                  {e.manual ? "manual" : "auto"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {e.reason}
                  {e.blocked_until ? ` · until ${new Date(e.blocked_until).toLocaleString()}` : " · permanent"}
                </span>
                <button
                  onClick={() => removeBlockM.mutate(e.id)}
                  disabled={removeBlockM.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                  title="Remove IP from blocklist"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {(eventsQ.data?.events ?? []).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent suspicious activity
            </p>
            <ul className="max-h-56 divide-y divide-border overflow-auto rounded-xl border border-border">
              {(eventsQ.data?.events ?? []).map((e: any) => (
                <li key={e.id} className="flex items-center gap-2 p-2 text-[11px]">
                  <span
                    className={
                      "rounded px-1.5 py-0.5 font-semibold uppercase " +
                      (e.severity === "high"
                        ? "bg-destructive/15 text-destructive"
                        : e.severity === "medium"
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {e.kind}
                  </span>
                  <span className="font-mono">{e.ip ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {e.path}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(e.created_at).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* OWASP Top 10 2025 */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OWASP Top 10 — 2025 Coverage</h4>
        <div className="grid gap-2 md:grid-cols-2">
          {OWASP_2025.map((o) => (
            <div key={o.id} className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <o.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  <span className="mr-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{o.id}</span>
                  {o.name}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{o.mitigation}</p>
              </div>
              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-success" />
            </div>
          ))}
        </div>
      </section>

      {/* Authentication */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Authentication</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            label="Enforce two-factor authentication"
            hint="Require all admin users to enroll a TOTP factor."
            checked={draft.enforce_2fa}
            onChange={(v) => setDraft({ ...draft, enforce_2fa: v })}
          />
          <Field label="Session timeout (minutes)" hint="Idle session is rotated after this many minutes.">
            <input
              type="number" min={5} max={10080}
              value={draft.session_timeout_minutes}
              onChange={(e) => setDraft({ ...draft, session_timeout_minutes: Number(e.target.value) })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </Field>
        </div>
      </section>

      {/* Device Permissions (Permissions-Policy) */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Device & Browser Permissions
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Allowed features can only be used by pages that actively request them (e.g. face check-in for Camera, geofencing for Location). Blocked features cannot be used by anyone on this site — the browser will silently reject the request.
            </p>
          </div>
          {(() => {
            const map = parsePermissionsPolicy(draft.permissions_policy);
            const on = DEVICE_FEATURES.filter((f) => map[f.key]).length;
            return (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {on} / {DEVICE_FEATURES.length} allowed
              </span>
            );
          })()}
        </div>
        {(() => {
          const map = parsePermissionsPolicy(draft.permissions_policy);
          return (
            <div className="grid gap-2 md:grid-cols-2">
              {DEVICE_FEATURES.map((f) => {
                const allowed = map[f.key];
                const Icon = f.icon;
                return (
                  <div
                    key={f.key}
                    className={
                      "flex items-start gap-3 rounded-xl border p-3 transition-colors " +
                      (allowed
                        ? "border-success/40 bg-success/5"
                        : "border-border bg-background/40")
                    }
                  >
                    <div
                      className={
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg " +
                        (allowed ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{f.label}</p>
                      <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {f.key}={allowed ? "(self)" : "()"}
                      </p>
                    </div>
                    <label className="ms-auto inline-flex shrink-0 cursor-pointer items-center gap-2">
                      <span
                        className={
                          "text-[10px] font-semibold uppercase " +
                          (allowed ? "text-success" : "text-muted-foreground")
                        }
                      >
                        {allowed ? "Allowed" : "Blocked"}
                      </span>
                      <input
                        type="checkbox"
                        checked={allowed}
                        onChange={(e) => {
                          const next = { ...map, [f.key]: e.target.checked };
                          setDraft({
                            ...draft,
                            permissions_policy: buildPermissionsPolicy(next, draft.permissions_policy),
                          });
                        }}
                        className="h-4 w-4 accent-brand"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <p className="text-[11px] text-muted-foreground">
          Tip: only allow features your app actually uses. Blocked features still appear here so you can re-enable them; they map to <code>feature=()</code> in the <code>Permissions-Policy</code> response header below.
        </p>
      </section>

      {/* Headers / XSS / Clickjacking */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Security Headers (XSS, Clickjacking, Transport)</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="Content-Security-Policy"   hint="Restricts script/style/connect origins. Mitigates XSS." checked={draft.csp_enabled} onChange={(v) => setDraft({ ...draft, csp_enabled: v })} />
          <Toggle label="HTTP Strict-Transport-Security" hint="Forces HTTPS for 2 years incl. subdomains." checked={draft.hsts_enabled} onChange={(v) => setDraft({ ...draft, hsts_enabled: v })} />
          <Toggle label="X-Frame-Options: DENY"     hint="Blocks the site from being embedded in iframes (clickjacking)." checked={draft.x_frame_deny} onChange={(v) => setDraft({ ...draft, x_frame_deny: v })} />
          <Field label="Referrer-Policy">
            <select
              value={draft.referrer_policy}
              onChange={(e) => setDraft({ ...draft, referrer_policy: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              {["no-referrer","strict-origin","strict-origin-when-cross-origin","same-origin","origin","origin-when-cross-origin"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Permissions-Policy" hint="Comma-separated feature directives.">
            <input
              value={draft.permissions_policy}
              onChange={(e) => setDraft({ ...draft, permissions_policy: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Headers actively applied by the server: {headerSnapshot.join(", ")}.
        </p>
      </section>

      {/* Input safety */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Input Safety (Injection / XSS)</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="Block suspicious SQL keywords in user input" hint="Rejects payloads containing UNION SELECT, ; DROP, etc." checked={draft.block_sql_keywords} onChange={(v) => setDraft({ ...draft, block_sql_keywords: v })} />
          <Toggle label="Sanitize rich-text / HTML inputs" hint="Strips <script>, on* attributes, javascript: URLs before persisting." checked={draft.sanitize_html_inputs} onChange={(v) => setDraft({ ...draft, sanitize_html_inputs: v })} />
          <Toggle label="Require Subresource Integrity (SRI) on CDN assets" hint="Adds integrity= hashes to third-party <script>/<link> tags loaded from CDNs." checked={draft.cdn_subresource_integrity} onChange={(v) => setDraft({ ...draft, cdn_subresource_integrity: v })} />
        </div>
      </section>

      {/* Network / abuse */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Network & Abuse (Black-box, DDoS)</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Rate limit (requests / minute / IP)" hint="Throttles brute-force, scraping, and credential stuffing.">
            <input
              type="number" min={10} max={10000}
              value={draft.rate_limit_per_min}
              onChange={(e) => setDraft({ ...draft, rate_limit_per_min: Number(e.target.value) })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </Field>
          <Field label="Admin IP allowlist" hint="Comma-separated. Empty = allow all. Recommended in production.">
            <input
              value={ipText}
              onChange={(e) => setIpText(e.target.value)}
              placeholder="10.0.0.0/8, 203.0.113.4"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </Field>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-[11px] text-muted-foreground">
          <Globe className="mt-0.5 h-4 w-4 text-warning" />
          <span>
            Route protection is enforced server-side: <code>requireSupabaseAuth</code> validates bearer tokens, <code>requireAdminAccess</code> gates the entire /admin surface, and <code>requireAdminRole</code> gates destructive admin actions. Even if the UI is bypassed, unauthorized clients receive 401 / "Forbidden".
          </span>
        </div>
      </section>
    </div>
  );
}