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
  isAr: boolean;
  setLang: (l: Lang) => void;
  t: (key: UiKey | string) => string;
  tf: (key: UiKey | string, params?: Record<string, string | number>) => string;
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

  const isAr = lang === "ar";
  const t = (key: UiKey | string) => bundles[lang].ui[key as UiKey] ?? en.ui[key as UiKey] ?? String(key);
  const tf = (key: UiKey | string, params?: Record<string, string | number>) => {
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
    <LangContext.Provider value={{ lang, isAr, setLang, t, tf, formatBlocked, dir: lang === "ar" ? "rtl" : "ltr" }}>
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

export function LanguageToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLang } = useI18n();

  const compactToggle = (
    <div
      className={`inline-flex items-center rounded-full border border-border/70 bg-muted/40 p-0.5 backdrop-blur-sm shadow-xs shrink-0 ${className}`}
      role="group"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`flex items-center justify-center rounded-full min-w-[28px] h-6 px-1.5 text-[11px] font-bold transition-all duration-200 ${
          lang === "en"
            ? "bg-brand text-brand-foreground shadow-xs shadow-brand/30"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <span className="text-muted-foreground/40 text-[10px] select-none px-0.5">/</span>
      <button
        type="button"
        onClick={() => setLang("ar")}
        className={`flex items-center justify-center rounded-full min-w-[28px] h-6 px-1.5 text-[11px] font-bold transition-all duration-200 ${
          lang === "ar"
            ? "bg-brand text-brand-foreground shadow-xs shadow-brand/30 font-sans"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={lang === "ar"}
      >
        AR
      </button>
    </div>
  );

  if (compact) {
    return compactToggle;
  }

  return (
    <>
      {/* Mobile view: compact (EN/AR) */}
      <div className="sm:hidden inline-flex">
        {compactToggle}
      </div>

      {/* Desktop view: full segmented English / العربية */}
      <div
        className={`hidden sm:inline-flex items-center rounded-full border border-border/70 bg-muted/40 p-1 backdrop-blur-sm shadow-sm shrink-0 ${className}`}
        role="group"
        aria-label="Language selector"
      >
        <button
          type="button"
          onClick={() => setLang("en")}
          className={`flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
            lang === "en"
              ? "bg-brand text-brand-foreground shadow-sm shadow-brand/30 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
          aria-pressed={lang === "en"}
        >
          <span className="text-[11px] tracking-wide">English</span>
        </button>
        <button
          type="button"
          onClick={() => setLang("ar")}
          className={`flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
            lang === "ar"
              ? "bg-brand text-brand-foreground shadow-sm shadow-brand/30 font-bold font-sans"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
          aria-pressed={lang === "ar"}
        >
          <span className="text-[11px]">العربية</span>
        </button>
      </div>
    </>
  );
}