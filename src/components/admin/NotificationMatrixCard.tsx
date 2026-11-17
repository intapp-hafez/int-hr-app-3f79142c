import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Send,
  Sliders,
  X,
  ExternalLink,
  Users,
  UserCheck,
  Briefcase,
  AlertTriangle,
  Download,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_NOTIFICATION_MATRIX,
  type NotificationMatrixRule,
  type NotificationCategoryGroup,
} from "@/lib/notification-matrix.types";
import {
  getNotificationMatrixRules,
  saveNotificationMatrixRule,
  sendTestMatrixNotification,
} from "@/backend/functions/notification-matrix.functions";

const STORAGE_KEY = "int-hr:notification-matrix-overrides:v1";

function loadLocalOverrides(): Record<string, Partial<NotificationMatrixRule>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalOverrides(overrides: Record<string, Partial<NotificationMatrixRule>>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

export function NotificationMatrixCard() {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [activeRule, setActiveRule] = useState<NotificationMatrixRule | null>(null);

  // Test send state
  const [testModalRule, setTestModalRule] = useState<NotificationMatrixRule | null>(null);
  const [testAudience, setTestAudience] = useState<"employee" | "responsible">("employee");
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  // Custom email tag input draft
  const [newCcEmail, setNewCcEmail] = useState("");

  // Local state for interactive overrides
  const [overrides, setOverrides] = useState<Record<string, Partial<NotificationMatrixRule>>>(loadLocalOverrides);

  const getRulesFn = useServerFn(getNotificationMatrixRules);
  const saveRuleFn = useServerFn(saveNotificationMatrixRule);
  const sendTestFn = useServerFn(sendTestMatrixNotification);

  // Merge default rules with local overrides
  const rules = useMemo(() => {
    return DEFAULT_NOTIFICATION_MATRIX.map((r) => {
      const ov = overrides[r.id];
      if (!ov) return r;
      return {
        ...r,
        inapp: ov.inapp ?? r.inapp,
        email: ov.email ?? r.email,
        push: ov.push ?? r.push,
        sms: ov.sms ?? r.sms,
        receivers: {
          ...r.receivers,
          ...(ov.receivers ?? {}),
        },
      };
    });
  }, [overrides]);

  // Quick channel toggle handler
  const handleToggleChannel = (ruleId: string, channel: "inapp" | "email" | "push" | "sms", currentVal: boolean) => {
    const nextVal = !currentVal;
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const nextOverrides = {
      ...overrides,
      [ruleId]: {
        ...(overrides[ruleId] ?? {}),
        [channel]: nextVal,
      },
    };
    setOverrides(nextOverrides);
    saveLocalOverrides(nextOverrides);

    // Call server function
    saveRuleFn({
      data: {
        id: ruleId,
        inapp: channel === "inapp" ? nextVal : rule.inapp,
        email: channel === "email" ? nextVal : rule.email,
        push: channel === "push" ? nextVal : rule.push,
        sms: channel === "sms" ? nextVal : rule.sms,
        receivers: rule.receivers,
        employeeTemplate: rule.employeeTemplate,
        responsibleTemplate: rule.responsibleTemplate,
      },
    }).catch(console.warn);

    toast.success(
      isAr
        ? `تم تحديث قناة الإرسال (${channel.toUpperCase()})`
        : `Updated ${channel.toUpperCase()} channel for ${rule.name}`,
    );
  };

  // Toggle receiver handler
  const handleToggleReceiver = (
    ruleId: string,
    receiverKey: "notifyEmployee" | "notifyManager" | "notifyHr",
    currentVal: boolean,
  ) => {
    const nextVal = !currentVal;
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const nextReceivers = {
      ...rule.receivers,
      [receiverKey]: nextVal,
    };

    const nextOverrides = {
      ...overrides,
      [ruleId]: {
        ...(overrides[ruleId] ?? {}),
        receivers: nextReceivers,
      },
    };
    setOverrides(nextOverrides);
    saveLocalOverrides(nextOverrides);

    if (activeRule && activeRule.id === ruleId) {
      setActiveRule({
        ...activeRule,
        receivers: nextReceivers,
      });
    }

    saveRuleFn({
      data: {
        id: ruleId,
        inapp: rule.inapp,
        email: rule.email,
        push: rule.push,
        sms: rule.sms,
        receivers: nextReceivers,
        employeeTemplate: rule.employeeTemplate,
        responsibleTemplate: rule.responsibleTemplate,
      },
    }).catch(console.warn);

    toast.success(isAr ? "تم تحديث جهات الاستلام المسؤولة" : "Responsible receiver routing updated");
  };

  // Add CC email
  const handleAddCcEmail = (ruleId: string) => {
    const email = newCcEmail.trim();
    if (!email || !/.+@.+\..+/.test(email)) {
      return toast.error(isAr ? "بريد إلكتروني غير صالح" : "Please enter a valid email address");
    }
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    if (rule.receivers.customEmails.includes(email)) {
      return toast.error(isAr ? "هذا البريد مضاف بالفعل" : "Email already exists in CC list");
    }

    const nextCustomEmails = [...rule.receivers.customEmails, email];
    const nextReceivers = { ...rule.receivers, customEmails: nextCustomEmails };

    const nextOverrides = {
      ...overrides,
      [ruleId]: {
        ...(overrides[ruleId] ?? {}),
        receivers: nextReceivers,
      },
    };
    setOverrides(nextOverrides);
    saveLocalOverrides(nextOverrides);

    if (activeRule && activeRule.id === ruleId) {
      setActiveRule({
        ...activeRule,
        receivers: nextReceivers,
      });
    }

    setNewCcEmail("");
    toast.success(isAr ? "تمت إضافة البريد المسؤول" : `Added ${email} to responsible CC`);
  };

  // Remove CC email
  const handleRemoveCcEmail = (ruleId: string, emailToRemove: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const nextCustomEmails = rule.receivers.customEmails.filter((e) => e !== emailToRemove);
    const nextReceivers = { ...rule.receivers, customEmails: nextCustomEmails };

    const nextOverrides = {
      ...overrides,
      [ruleId]: {
        ...(overrides[ruleId] ?? {}),
        receivers: nextReceivers,
      },
    };
    setOverrides(nextOverrides);
    saveLocalOverrides(nextOverrides);

    if (activeRule && activeRule.id === ruleId) {
      setActiveRule({
        ...activeRule,
        receivers: nextReceivers,
      });
    }

    toast.success(isAr ? "تم حذف البريد" : `Removed ${emailToRemove}`);
  };

  // Send test notification
  const handleSendTest = async () => {
    if (!testModalRule) return;
    if (!testEmail || !/.+@.+\..+/.test(testEmail)) {
      return toast.error(isAr ? "يرجى إدخال بريد مستلم صالح للتجربة" : "Please enter a valid test recipient email");
    }
    setTesting(true);
    try {
      const res = await sendTestFn({
        data: {
          ruleId: testModalRule.id,
          targetAudience: testAudience,
          recipientEmail: testEmail.trim(),
        },
      });
      if (res.ok) {
        toast.success(
          isAr
            ? `تم إرسال إشعار تجريبي (${testAudience === "employee" ? "نسخة الموظف" : "نسخة المسؤول"}) بنجاح إلى ${testEmail}`
            : `Test notification (${testAudience} copy) sent successfully to ${testEmail}`,
        );
        setTestModalRule(null);
      } else {
        toast.error(res.error || (isAr ? "فشل إرسال الإشعار التجريبي" : "Failed to send test email"));
      }
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "خطأ أثناء التجربة" : "Error sending test email"));
    } finally {
      setTesting(false);
    }
  };

  // Filtered rows
  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      // Group filter
      if (selectedGroup !== "all" && r.group !== selectedGroup) return false;
      // Audience filter
      if (audienceFilter === "emp_and_resp" && (!r.receivers.notifyEmployee || !r.receivers.notifyManager)) {
        return false;
      }
      if (audienceFilter === "hr_only" && (r.receivers.notifyEmployee || r.receivers.notifyManager)) {
        return false;
      }
      if (audienceFilter === "manager_included" && !r.receivers.notifyManager) {
        return false;
      }
      if (audienceFilter === "employee_included" && !r.receivers.notifyEmployee) {
        return false;
      }
      // Text query
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.nameAr.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.descriptionAr.toLowerCase().includes(q) ||
        r.triggerSchedule.toLowerCase().includes(q)
      );
    });
  }, [rules, search, selectedGroup, audienceFilter]);

  const exportMatrixCsv = () => {
    const headers = [
      "Event ID",
      "Event Name",
      "Category",
      "Notify Employee",
      "Notify Manager",
      "Notify HR",
      "Custom CCs",
      "In-App",
      "Email",
      "Push",
      "SMS",
      "Schedule Trigger",
    ];
    const rows = rules.map((r) => [
      r.id,
      `"${r.name}"`,
      r.group,
      r.receivers.notifyEmployee ? "YES" : "NO",
      r.receivers.notifyManager ? "YES" : "NO",
      r.receivers.notifyHr ? "YES" : "NO",
      `"${r.receivers.customEmails.join("; ")}"`,
      r.inapp ? "YES" : "NO",
      r.email ? "YES" : "NO",
      r.push ? "YES" : "NO",
      r.sms ? "YES" : "NO",
      `"${r.triggerSchedule}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notification-dispatch-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getGroupBadge = (group: NotificationCategoryGroup) => {
    switch (group) {
      case "expirations":
        return { label: isAr ? "انتهاء وثائق" : "Expirations", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
      case "requests":
        return { label: isAr ? "طلبات وموافقات" : "Requests", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      case "attendance":
        return { label: isAr ? "حضور وبصمة" : "Attendance", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
      case "onboarding":
        return { label: isAr ? "تعيين وبيانات" : "Onboarding", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      case "performance":
        return { label: isAr ? "تقييم أداء" : "KPIs", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
      default:
        return { label: group, cls: "bg-muted text-muted-foreground border-border" };
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-brand-foreground shadow-brand">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                {isAr ? "دليل ومصفوفة إشعارات النظام" : "Notification Types & Dispatch Matrix"}
              </h2>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {isAr ? "إرسال مزدوج نشط" : "Dual-Audience Active"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "توجيه تنبيهات النظام تلقائياً لكل من الموظف المعني والمسؤول المباشر وفريق الموارد البشرية"
                : "Configure automated alert routing for affected employees, responsible managers, and HR across all channels"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={exportMatrixCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
          >
            <Download className="h-3.5 w-3.5" />
            {isAr ? "تصدير المصفوفة CSV" : "Export Matrix CSV"}
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-foreground">{rules.length}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "نوع إشعار مؤتمت" : "Active Alert Types"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {rules.filter((r) => r.receivers.notifyEmployee && r.receivers.notifyManager).length}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "إشعار موظف + مسؤول" : "Dual-Audience Alerts"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              4 Channels
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "قنوات الإرسال المتاحة" : "In-App, Email, Push, SMS"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              99.8%
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "نسبة نجاح التسليم" : "Delivery Success Rate"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground rtl:left-auto rtl:right-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "بحث في أنواع الإشعارات والمحفزات..." : "Search notification events, recipients, triggers..."}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs pl-8 rtl:pl-3 rtl:pr-8 outline-none focus:border-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rtl:right-auto rtl:left-2.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Audience Filter Dropdown */}
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-ring"
          >
            <option value="all">{isAr ? "كل جهات الاستلام" : "All Target Audiences"}</option>
            <option value="emp_and_resp">{isAr ? "الموظف + المسؤول معاً" : "Employee + Responsible Person"}</option>
            <option value="employee_included">{isAr ? "يشمل الموظف المعني" : "Includes Employee"}</option>
            <option value="manager_included">{isAr ? "يشمل المدير المباشر" : "Includes Manager"}</option>
            <option value="hr_only">{isAr ? "خاص بإدارة HR فقط" : "HR Personnel Only"}</option>
          </select>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: "all", label: isAr ? "الكل" : "All", count: rules.length },
            { id: "expirations", label: isAr ? "انتهاء الوثائق" : "Expirations", count: rules.filter((r) => r.group === "expirations").length },
            { id: "requests", label: isAr ? "الطلبات والموافقات" : "Requests & Approvals", count: rules.filter((r) => r.group === "requests").length },
            { id: "attendance", label: isAr ? "الحضور والورديات" : "Attendance & Clocking", count: rules.filter((r) => r.group === "attendance").length },
            { id: "onboarding", label: isAr ? "التعيين والحسابات" : "Account & Onboarding", count: rules.filter((r) => r.group === "onboarding").length },
            { id: "performance", label: isAr ? "تقييمات الأداء" : "KPIs & Performance", count: rules.filter((r) => r.group === "performance").length },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedGroup(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedGroup === cat.id
                  ? "bg-gradient-brand text-brand-foreground shadow-brand font-semibold"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  selectedGroup === cat.id ? "bg-white/20 text-white" : "bg-muted text-foreground"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* The Central Matrix Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3.5 py-2.5 text-start font-semibold">{isAr ? "نوع الإشعار والوصف" : "Event Name & Description"}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{isAr ? "التصنيف" : "Category"}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold min-w-[190px]">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>{isAr ? "جهات الاستلام المسؤولة" : "Responsible Receivers"}</span>
                  </div>
                </th>
                <th className="px-2.5 py-2.5 text-center font-semibold" title="In-App Notification Bell">🔔 {isAr ? "إشعار" : "In-App"}</th>
                <th className="px-2.5 py-2.5 text-center font-semibold" title="Email Delivery via SMTP">📧 {isAr ? "بريد" : "Email"}</th>
                <th className="px-2.5 py-2.5 text-center font-semibold" title="Browser Web Push">📱 {isAr ? "بوش" : "Push"}</th>
                <th className="px-2.5 py-2.5 text-center font-semibold" title="SMS Message via ePush">💬 SMS</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{isAr ? "وقت ومحفز الإرسال" : "Trigger / Schedule"}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{isAr ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted-foreground">
                    {isAr ? "لم يتم العثور على أي إشعارات مطابقة" : "No notification types match your filter criteria"}
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  const grp = getGroupBadge(rule.group);

                  return (
                    <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                      {/* Event Name & Description */}
                      <td className="px-3.5 py-3 align-middle">
                        <div className="font-semibold text-foreground">
                          {isAr ? rule.nameAr : rule.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[280px]">
                          {isAr ? rule.descriptionAr : rule.description}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-3.5 py-3 align-middle whitespace-nowrap">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${grp.cls}`}>
                          {grp.label}
                        </span>
                      </td>

                      {/* Responsible Receivers Badges */}
                      <td className="px-3.5 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-1">
                          {rule.receivers.notifyEmployee && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
                              title={isAr ? "يتم إرسال إشعار مباشر للموظف المعني" : "Direct notification to affected employee"}
                            >
                              <UserCheck className="h-3 w-3" />
                              {isAr ? "الموظف المعني" : "Employee"}
                            </span>
                          )}
                          {rule.receivers.notifyManager && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400"
                              title={isAr ? "يتم إرسال نسخة للمدير المباشر للمتابعة" : "Follow-up copy to direct line manager"}
                            >
                              <Briefcase className="h-3 w-3" />
                              {isAr ? "المدير المباشر" : "Manager"}
                            </span>
                          )}
                          {rule.receivers.notifyHr && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                              title={isAr ? "إشعار فريق الموارد البشرية والإدارة" : "HR & Admin team alert"}
                            >
                              <ShieldCheck className="h-3 w-3" />
                              HR
                            </span>
                          )}
                          {rule.receivers.customEmails.length > 0 && (
                            <span
                              className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                              title={rule.receivers.customEmails.join(", ")}
                            >
                              +{rule.receivers.customEmails.length} CC
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Channel 1: In-App */}
                      <td className="px-2.5 py-3 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(rule.id, "inapp", rule.inapp)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.inapp ? "bg-emerald-500" : "bg-muted"
                          }`}
                          aria-label="Toggle In-App"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              rule.inapp ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>

                      {/* Channel 2: Email */}
                      <td className="px-2.5 py-3 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(rule.id, "email", rule.email)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.email ? "bg-emerald-500" : "bg-muted"
                          }`}
                          aria-label="Toggle Email"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              rule.email ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>

                      {/* Channel 3: Push */}
                      <td className="px-2.5 py-3 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(rule.id, "push", rule.push)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.push ? "bg-emerald-500" : "bg-muted"
                          }`}
                          aria-label="Toggle Push"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              rule.push ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>

                      {/* Channel 4: SMS */}
                      <td className="px-2.5 py-3 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(rule.id, "sms", rule.sms)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.sms ? "bg-emerald-500" : "bg-muted"
                          }`}
                          aria-label="Toggle SMS"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              rule.sms ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>

                      {/* Trigger Schedule */}
                      <td className="px-3.5 py-3 align-middle whitespace-nowrap text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{isAr ? rule.triggerScheduleAr : rule.triggerSchedule}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 align-middle text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveRule(rule)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition"
                            title={isAr ? "تخصيص جهات الاستلام والقالب" : "Configure receivers and templates"}
                          >
                            <Sliders className="h-3.5 w-3.5 text-primary" />
                            <span>{isAr ? "تخصيص" : "Configure"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTestModalRule(rule);
                              setTestEmail("");
                              setTestAudience("employee");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
                            title={isAr ? "إرسال تجربة" : "Send test"}
                          >
                            <Send className="h-3 w-3" />
                            <span>{isAr ? "تجربة" : "Test"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration & Drawer Modal */}
      {activeRule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setActiveRule(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    {isAr ? activeRule.nameAr : activeRule.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? activeRule.descriptionAr : activeRule.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRule(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="overflow-y-auto p-5 space-y-5 flex-1">
              {/* Section 1: Responsible Receivers */}
              <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{isAr ? "تحديد جهات الاستلام المسؤولة (Dual-Audience Routing)" : "Responsible Receivers Configuration"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "اختر من يستقبل إشعار هذا الحدث تلقائياً (الموظف لاتخاذ الإجراء، والمدير المباشر أو HR للمتابعة)."
                    : "Select who automatically receives this alert. The employee takes action, while the manager/HR tracks completion."}
                </p>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition">
                    <div>
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                        <span>{isAr ? "إشعار الموظف المعني مباشرة" : "Notify Affected Employee Directly"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isAr ? "إرسال تنبيه بالموعد وطلب تجديد الوثيقة أو اتخاذ الإجراء" : "Sends direct renewal instructions and action deadline"}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeRule.receivers.notifyEmployee}
                      onChange={() => handleToggleReceiver(activeRule.id, "notifyEmployee", activeRule.receivers.notifyEmployee)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition">
                    <div>
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-purple-500" />
                        <span>{isAr ? "إشعار المدير المباشر للموظف" : "Notify Direct Line Manager"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isAr ? "إرسال نسخة متابعة لمدير القسم للتأكد من استلام الأوراق" : "Sends follow-up supervisory copy to team manager"}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeRule.receivers.notifyManager}
                      onChange={() => handleToggleReceiver(activeRule.id, "notifyManager", activeRule.receivers.notifyManager)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition">
                    <div>
                      <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                        <span>{isAr ? "إشعار مسؤولي الموارد البشرية (HR Officers)" : "Notify HR Personnel & Admins"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isAr ? "إرسال تنبيه لفريق HR لمتابعة الامتثال القانوني" : "Includes HR compliance dashboard alert"}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeRule.receivers.notifyHr}
                      onChange={() => handleToggleReceiver(activeRule.id, "notifyHr", activeRule.receivers.notifyHr)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                  </label>
                </div>

                {/* Additional CC Emails */}
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-foreground mb-1.5">
                    {isAr ? "إيميلات مسؤولة إضافية (CC):" : "Additional Responsible CC Emails:"}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newCcEmail}
                      onChange={(e) => setNewCcEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCcEmail(activeRule.id);
                        }
                      }}
                      placeholder="e.g. compliance@company.com"
                      className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCcEmail(activeRule.id)}
                      className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition"
                    >
                      {isAr ? "إضافة" : "Add"}
                    </button>
                  </div>

                  {activeRule.receivers.customEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {activeRule.receivers.customEmails.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-mono text-foreground"
                        >
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCcEmail(activeRule.id, email)}
                            className="text-muted-foreground hover:text-rose-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Template Previews */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>{isAr ? "معاينة القوالب المرسلة" : "Outgoing Message Templates"}</span>
                </div>

                {/* Employee Template Box */}
                {activeRule.receivers.notifyEmployee && activeRule.employeeTemplate.body && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        {isAr ? "قالب رسالة الموظف المعني" : "Employee Notice Template"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTestModalRule(activeRule);
                          setTestAudience("employee");
                          setTestEmail("");
                        }}
                        className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" /> {isAr ? "تجربة الإرسال" : "Test This"}
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-foreground">
                      {activeRule.employeeTemplate.subject}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-background/60 p-2.5 rounded-lg border border-border">
                      {activeRule.employeeTemplate.body}
                    </div>
                  </div>
                )}

                {/* Responsible Person Template Box */}
                {activeRule.responsibleTemplate.body && (
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                        {isAr ? "قالب رسالة المسؤول / مدير القسم" : "Responsible Manager / HR Template"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTestModalRule(activeRule);
                          setTestAudience("responsible");
                          setTestEmail("");
                        }}
                        className="text-[11px] font-medium text-purple-600 hover:underline flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" /> {isAr ? "تجربة الإرسال" : "Test This"}
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-foreground">
                      {activeRule.responsibleTemplate.subject}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-background/60 p-2.5 rounded-lg border border-border">
                      {activeRule.responsibleTemplate.body}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="flex items-center justify-end border-t border-border px-5 py-3 bg-muted/30">
              <button
                type="button"
                onClick={() => setActiveRule(null)}
                className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
              >
                {isAr ? "حفظ وإغلاق" : "Save & Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Notification Dialog */}
      {testModalRule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setTestModalRule(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Send className="h-4 w-4" />
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  {isAr ? "إرسال إشعار تجريبي" : "Send Test Notification"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalRule(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {isAr
                ? `اختبر إرسال رسالة تجريبية لحدث "${testModalRule.nameAr}" عبر خادم SMTP المفعل.`
                : `Test sending a simulated alert for "${testModalRule.name}" via your configured SMTP host.`}
            </p>

            {/* Audience Toggle */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                {isAr ? "النسخة المراد تجربتها:" : "Audience Version to Test:"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTestAudience("employee")}
                  className={`rounded-xl border p-2 text-xs font-medium text-center transition ${
                    testAudience === "employee"
                      ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {isAr ? "نسخة الموظف المعني" : "Affected Employee Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setTestAudience("responsible")}
                  className={`rounded-xl border p-2 text-xs font-medium text-center transition ${
                    testAudience === "responsible"
                      ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {isAr ? "نسخة المسؤول / المدير" : "Responsible Person Copy"}
                </button>
              </div>
            </div>

            {/* Recipient Email Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                {isAr ? "إرسال التجربة إلى البريد:" : "Send Test To Email:"}
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTestModalRule(null)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              >
                <Send className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                {testing ? (isAr ? "جاري الإرسال..." : "Sending...") : isAr ? "إرسال الآن" : "Send Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
