import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as en from "./en";
import * as ar from "./ar";
import type { UiKey } from "./en";

export type Lang = "en" | "ar";

const bundles = { en, ar } as const;

// Dev-only sanity check that every Arabic key exists.
if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
  const missing = (Object.keys(en.ui) as UiKey[]).filter((k) => !(k in ar.ui));
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn("[i18n] Missing Arabic keys:", missing);
  }
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: UiKey) => string;
  tf: (key: UiKey, params?: Record<string, string | number>) => string;
  formatBlocked: (blocked: { code?: string; params?: Record<string, any>; reason?: string }) => string;
  dir: "ltr" | "rtl";
};

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("int-lang") as Lang | null;
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("int-lang", l);
  };

  const t = (key: UiKey) => bundles[lang].ui[key] ?? en.ui[key] ?? String(key);
  const tf = (key: UiKey, params?: Record<string, string | number>) => {
    const tmpl = t(key);
    if (!params) return tmpl;
    return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      params[k] != null ? String(params[k]) : `{{${k}}}`,
    );
  };
  const formatBlocked: Ctx["formatBlocked"] = (blocked) => {
    const code = blocked?.code;
    const p = blocked?.params ?? {};
    const actionKey: UiKey = p.action === "check_out" ? "actionCheckOut" : "actionCheckIn";
    const action = t(actionKey);
    switch (code) {
      case "check_in_already": return t("blockedCheckInAlready");
      case "check_out_already": return t("blockedCheckOutAlready");
      case "check_out_not_in": return t("blockedCheckOutNotIn");
      case "leave":
        return tf("blockedLeave", { action, name: String(p.name ?? ""), range: String(p.range ?? "") });
      case "leave_noname":
        return p.range
          ? tf("blockedLeaveNoName", { action, range: String(p.range) })
          : tf("blockedLeaveNoNameNoRange", { action });
      case "holiday":
        return tf("blockedHoliday", { action, name: String(p.name ?? "") });
      case "weekend":
        return tf("blockedWeekend", { action });
      case "constraints": {
        const items: Array<{ code: string; params?: Record<string, any> }> = Array.isArray(p.reasons) ? p.reasons : [];
        const translated = items.map((r) => {
          switch (r.code) {
            case "gps_unavailable": return t("reasonGpsUnavailable");
            case "gps_outside_fence": return tf("reasonGpsOutsideFence", { dist: r.params?.dist ?? 0, allowed: r.params?.allowed ?? 0 });
            case "gps_outside_any": return t("reasonGpsOutsideAny");
            case "ssid_undetected": return t("reasonSsidUndetected");
            case "ssid_not_authorized": return tf("reasonSsidNotAuthorized", { ssid: String(r.params?.ssid ?? "") });
            default: return "";
          }
        }).filter(Boolean).join(" · ");
        return tf("blockedConstraints", { action, reasons: translated });
      }
      default:
        return blocked?.reason ?? "";
    }
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t, tf, formatBlocked, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </LangContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}

// Translators for dynamic / mock-data strings.
// Returns the Arabic equivalent when lang === "ar" and a mapping exists,
// otherwise returns the original English value.
export function useTranslators() {
  const { lang } = useI18n();
  const b = bundles[lang];
  const pick = (m: Record<string, string>, v: string | undefined) =>
    v && m[v] ? m[v] : v ?? "";
  return {
    tBranch: (v?: string) => pick(b.branch, v),
    tDept: (v?: string) => pick(b.dept, v),
    tRole: (v?: string) => pick(b.role, v),
    tName: (v?: string) => pick(b.name, v),
    tLeaveType: (v?: string) => pick(b.leaveType, v),
    tHoliday: (v?: string) => pick(b.holiday, v),
    tStatus: (v?: string) => pick(b.status, v),
    tNotification: (id: number, fallback: { title: string; body: string }) =>
      b.notification[id] ?? fallback,
    tMessage: (id: number, fallback: { preview: string; time: string }) =>
      b.message[id] ?? fallback,
  };
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent ${className}`}
      aria-label="Toggle language"
    >
      <span className="font-display">{lang === "en" ? "EN" : "ع"}</span>
      <span className="text-muted-foreground">/</span>
      <span className="text-muted-foreground">{lang === "en" ? "ع" : "EN"}</span>
    </button>
  );
}