import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AlertCategory =
  | "id_expiry"
  | "contract_expiry"
  | "insurance_expiry"
  | "military_expiry"
  | "probation_end"
  | "pending_leave"
  | "advance_payment"
  | "late"
  | "absent"
  | "checkin"
  | "checkout";

export type AlertCategoryGroup = "expirations" | "requests" | "attendance";

export type AlertChannel = "inapp" | "email" | "push";

export type CategoryPrefs = Record<AlertCategory, Record<AlertChannel, boolean>>;

export const CATEGORY_GROUPS: { id: AlertCategoryGroup; label: string; description: string }[] = [
  {
    id: "expirations",
    label: "Document & Status Expirations",
    description: "Alerts for expiring employee credentials, contracts, and compliance dates",
  },
  {
    id: "requests",
    label: "Requests & Approvals",
    description: "Employee requests requiring HR or administrative decision",
  },
  {
    id: "attendance",
    label: "Attendance & Clocking",
    description: "Daily workforce attendance events and shift anomalies",
  },
];

export const CATEGORY_META: {
  id: AlertCategory;
  label: string;
  description: string;
  group: AlertCategoryGroup;
}[] = [
  // Expirations
  {
    id: "id_expiry",
    label: "National ID expiration",
    description: "National IDs expiring within 30 days or already expired",
    group: "expirations",
  },
  {
    id: "contract_expiry",
    label: "Contract expiration",
    description: "Employment contracts expiring within 30 days or expired",
    group: "expirations",
  },
  {
    id: "insurance_expiry",
    label: "Insurance renewal",
    description: "Medical & social insurance renewal dates and cards",
    group: "expirations",
  },
  {
    id: "military_expiry",
    label: "Military status expiry",
    description: "Military exemption or service certificate expiration",
    group: "expirations",
  },
  {
    id: "probation_end",
    label: "Probation period ending",
    description: "Employees approaching completion of 3-month probation",
    group: "expirations",
  },

  // Requests
  {
    id: "pending_leave",
    label: "Leave requests",
    description: "New employee leave requests awaiting approval",
    group: "requests",
  },
  {
    id: "advance_payment",
    label: "Advance payment requests",
    description: "Salary advance & loan requests awaiting review",
    group: "requests",
  },

  // Attendance
  {
    id: "late",
    label: "Late check-ins",
    description: "Employees arriving after scheduled shift start",
    group: "attendance",
  },
  {
    id: "absent",
    label: "Absences",
    description: "Employees who have not checked in today",
    group: "attendance",
  },
  {
    id: "checkin",
    label: "Check-ins",
    description: "Employees clocking in at branch",
    group: "attendance",
  },
  {
    id: "checkout",
    label: "Check-outs",
    description: "Employees clocking out",
    group: "attendance",
  },
];

export const CHANNEL_META: { id: AlertChannel; label: string; description: string }[] = [
  { id: "inapp", label: "In-app", description: "Bell + notifications center" },
  { id: "email", label: "Email", description: "Sent to your account email" },
  { id: "push", label: "Push", description: "Browser push notifications" },
];

const DEFAULT: CategoryPrefs = {
  id_expiry:       { inapp: true, email: true,  push: true  },
  contract_expiry: { inapp: true, email: true,  push: true  },
  insurance_expiry:{ inapp: true, email: true,  push: false },
  military_expiry: { inapp: true, email: false, push: false },
  probation_end:   { inapp: true, email: true,  push: false },
  pending_leave:   { inapp: true, email: true,  push: false },
  advance_payment: { inapp: true, email: true,  push: false },
  late:            { inapp: true, email: true,  push: true  },
  absent:          { inapp: true, email: true,  push: false },
  checkin:         { inapp: true, email: false, push: false },
  checkout:        { inapp: true, email: false, push: false },
};

const KEY = "notification-prefs:v1";
const SYNCED_KEY = "notification-prefs:hydrated";

function load(): CategoryPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<CategoryPrefs>;
    // merge with defaults to be forward compatible
    const merged = { ...DEFAULT } as CategoryPrefs;
    for (const cat of Object.keys(DEFAULT) as AlertCategory[]) {
      merged[cat] = { ...DEFAULT[cat], ...(parsed?.[cat] ?? {}) };
    }
    return merged;
  } catch {
    return DEFAULT;
  }
}

function save(prefs: CategoryPrefs) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("notification-prefs:change"));
}

async function hydrateFromDb(): Promise<CategoryPrefs | null> {
  try {
    const sb = supabase as any;
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) return null;
    const { data } = await sb
      .from("notification_category_prefs")
      .select("category, channel, enabled")
      .eq("user_id", userData.user.id);
    const rows = (data ?? []) as any[];
    if (rows.length === 0) return null;
    const merged = load();
    for (const r of rows) {
      if (merged[r.category as AlertCategory] && (r.channel === "inapp" || r.channel === "email" || r.channel === "push")) {
        merged[r.category as AlertCategory][r.channel as AlertChannel] = !!r.enabled;
      }
    }
    return merged;
  } catch { return null; }
}

async function persistOne(category: AlertCategory, channel: AlertChannel, value: boolean) {
  try {
    const sb = supabase as any;
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) return;
    await sb.from("notification_category_prefs").upsert(
      { user_id: userData.user.id, category, channel, enabled: value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,category,channel" },
    );
  } catch { /* noop */ }
}

async function persistMany(prefs: CategoryPrefs) {
  try {
    const sb = supabase as any;
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) return;
    const rows: any[] = [];
    for (const cat of Object.keys(prefs) as AlertCategory[]) {
      for (const ch of ["inapp", "email", "push"] as AlertChannel[]) {
        rows.push({ user_id: userData.user.id, category: cat, channel: ch, enabled: prefs[cat][ch], updated_at: new Date().toISOString() });
      }
    }
    await sb.from("notification_category_prefs").upsert(rows, { onConflict: "user_id,category,channel" });
  } catch { /* noop */ }
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<CategoryPrefs>(() => load());

  useEffect(() => {
    const onChange = () => setPrefs(load());
    window.addEventListener("notification-prefs:change", onChange);
    window.addEventListener("storage", onChange);
    // One-shot hydration from DB so the matrix matches what the backend sees.
    if (!window.sessionStorage.getItem(SYNCED_KEY)) {
      hydrateFromDb().then((merged) => {
        if (merged) { save(merged); setPrefs(merged); }
        window.sessionStorage.setItem(SYNCED_KEY, "1");
      });
    }
    return () => {
      window.removeEventListener("notification-prefs:change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback((cat: AlertCategory, channel: AlertChannel, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [cat]: { ...prev[cat], [channel]: value } };
      save(next);
      persistOne(cat, channel, value);
      return next;
    });
  }, []);

  const setCategoryAll = useCallback((cat: AlertCategory, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [cat]: { inapp: value, email: value, push: value } };
      save(next);
      persistMany(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => { setPrefs(DEFAULT); save(DEFAULT); persistMany(DEFAULT); }, []);

  const isEnabled = useCallback(
    (cat: AlertCategory, channel: AlertChannel = "inapp") => prefs[cat]?.[channel] ?? false,
    [prefs],
  );

  return { prefs, update, setCategoryAll, reset, isEnabled };
}

/** Read-only snapshot (no subscription) — for non-reactive callers. */
export function getNotificationPrefs(): CategoryPrefs { return load(); }