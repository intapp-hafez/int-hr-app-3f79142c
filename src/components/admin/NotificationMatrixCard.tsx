import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Plus,
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
  createNotificationMatrixRule,
  bulkUpdateChannelMatrixRules,
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

  // Add Custom Notification Type Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRuleForm, setNewRuleForm] = useState({
    id: "",
    name: "",
    nameAr: "",
    description: "",
    descriptionAr: "",
    group: "requests" as NotificationCategoryGroup,
    inapp: true,
    email: true,
    push: false,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: false,
      customEmails: [] as string[],
    },
    triggerType: "on_action" as "daily_cron" | "realtime" | "on_action",
    triggerSchedule: "Real-time on action trigger",
    triggerScheduleAr: "فوري عند تنفيذ الإجراء",
    employeeTemplate: {
      subject: "Update Regarding {{request_type}}",
      body: "Dear {{employee_name}}, your request for {{request_type}} has been processed.",
    },
    responsibleTemplate: {
      subject: "[Action Notice] New {{request_type}} for {{employee_name}}",
      body: "Employee {{employee_name}} has submitted a {{request_type}}. Please review at your earliest convenience.",
    },
  });
  const [addModalTemplateTab, setAddModalTemplateTab] = useState<"employee" | "responsible">("employee");
  const [addModalCcDraft, setAddModalCcDraft] = useState("");
  const [isSubmittingNewRule, setIsSubmittingNewRule] = useState(false);

  // Local state for interactive overrides
  const [overrides, setOverrides] = useState<Record<string, Partial<NotificationMatrixRule>>>(loadLocalOverrides);

  const queryClient = useQueryClient();
  const getRulesFn = useServerFn(getNotificationMatrixRules);
  const saveRuleFn = useServerFn(saveNotificationMatrixRule);
  const createRuleFn = useServerFn(createNotificationMatrixRule);
  const bulkChannelFn = useServerFn(bulkUpdateChannelMatrixRules);
  const sendTestFn = useServerFn(sendTestMatrixNotification);

  const [isBulkUpdating, setIsBulkUpdating] = useState<string | null>(null);

  const { data: serverRulesData } = useQuery({
    queryKey: ["notification-matrix-rules"],
    queryFn: () => getRulesFn(),
    staleTime: 60_000,
  });

  const baseRules = serverRulesData?.rules || DEFAULT_NOTIFICATION_MATRIX;

  // Merge base rules with local overrides
  const rules = useMemo(() => {
    return baseRules.map((r) => {
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
  }, [baseRules, overrides]);

  // Bulk channel state calculations
  const allInAppOn = rules.length > 0 && rules.every((r) => r.inapp);
  const someInAppOn = rules.some((r) => r.inapp);

  const allEmailOn = rules.length > 0 && rules.every((r) => r.email);
  const someEmailOn = rules.some((r) => r.email);

  const allPushOn = rules.length > 0 && rules.every((r) => r.push);
  const somePushOn = rules.some((r) => r.push);

  const allSmsOn = rules.length > 0 && rules.every((r) => r.sms);
  const someSmsOn = rules.some((r) => r.sms);

  // Master channel toggle handler (turn all ON or all OFF for this channel across all rules)
  const handleToggleAllChannel = async (channel: "inapp" | "email" | "push" | "sms") => {
    const isAllOn = rules.length > 0 && rules.every((r) => r[channel]);
    const nextVal = !isAllOn;

    setIsBulkUpdating(channel);

    // Optimistically update local state & overrides
    const nextOverrides: Record<string, Partial<NotificationMatrixRule>> = { ...overrides };
    for (const r of rules) {
      nextOverrides[r.id] = {
        ...(nextOverrides[r.id] ?? {}),
        [channel]: nextVal,
      };
    }
    setOverrides(nextOverrides);
    saveLocalOverrides(nextOverrides);

    try {
      await bulkChannelFn({
        data: {
          channel,
          enabled: nextVal,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["notification-matrix-rules"] });
      toast.success(
        isAr
          ? `تم ${nextVal ? "تفعيل" : "تعطيل"} قناة (${channel.toUpperCase()}) لجميع الأحداث بنجاح`
          : `Successfully ${nextVal ? "enabled" : "disabled"} ${channel.toUpperCase()} for all events`,
      );
    } catch (err) {
      console.error(err);
      toast.error(
        isAr
          ? `تعذر تحديث قناة (${channel.toUpperCase()}) للجميع`
          : `Failed to update ${channel.toUpperCase()} for all events`,
      );
    } finally {
      setIsBulkUpdating(null);
    }
  };

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

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "_")
      .replace(/^-+|-+$/g, "");

  const handleAddCcInNewRule = () => {
    const email = addModalCcDraft.trim();
    if (!email || !/.+@.+\..+/.test(email)) {
      return toast.error(isAr ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address");
    }
    if (newRuleForm.receivers.customEmails.includes(email)) {
      return toast.error(isAr ? "البريد مضاف مسبقاً" : "Email already exists in CC list");
    }
    setNewRuleForm({
      ...newRuleForm,
      receivers: {
        ...newRuleForm.receivers,
        customEmails: [...newRuleForm.receivers.customEmails, email],
      },
    });
    setAddModalCcDraft("");
  };

  const handleRemoveCcInNewRule = (emailToRemove: string) => {
    setNewRuleForm({
      ...newRuleForm,
      receivers: {
        ...newRuleForm.receivers,
        customEmails: newRuleForm.receivers.customEmails.filter((e) => e !== emailToRemove),
      },
    });
  };

  const insertPlaceholderInNewRule = (token: string) => {
    const isEmp = addModalTemplateTab === "employee";
    const currentTpl = isEmp ? newRuleForm.employeeTemplate : newRuleForm.responsibleTemplate;
    const updatedTpl = {
      ...currentTpl,
      body: currentTpl.body ? `${currentTpl.body} ${token}` : token,
    };
    setNewRuleForm({
      ...newRuleForm,
      [isEmp ? "employeeTemplate" : "responsibleTemplate"]: updatedTpl,
    });
  };

  const handleCreateNewRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalId = (newRuleForm.id || slugify(newRuleForm.name)).trim();
    if (!finalId) {
      return toast.error(isAr ? "يرجى تحديد معرّف الإشعار (Slug ID)" : "Please provide a rule ID");
    }
    if (!/^[a-z0-9_-]+$/.test(finalId)) {
      return toast.error(
        isAr
          ? "المعرّف يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطات فقط"
          : "Rule ID must contain only lowercase alphanumeric characters, dashes, and underscores",
      );
    }
    if (!newRuleForm.name.trim() || !newRuleForm.nameAr.trim()) {
      return toast.error(isAr ? "يرجى إدخال اسم الإشعار بالإنجليزية والعربية" : "Please enter both English and Arabic names");
    }
    if (rules.some((r) => r.id === finalId)) {
      return toast.error(isAr ? "معرّف الإشعار موجود بالفعل" : "A rule with this ID already exists");
    }

    setIsSubmittingNewRule(true);
    try {
      const payload: NotificationMatrixRule = {
        id: finalId,
        name: newRuleForm.name.trim(),
        nameAr: newRuleForm.nameAr.trim(),
        description: newRuleForm.description.trim(),
        descriptionAr: newRuleForm.descriptionAr.trim(),
        group: newRuleForm.group,
        inapp: newRuleForm.inapp,
        email: newRuleForm.email,
        push: newRuleForm.push,
        sms: newRuleForm.sms,
        receivers: newRuleForm.receivers,
        triggerSchedule: newRuleForm.triggerSchedule.trim() || "Event-driven",
        triggerScheduleAr: newRuleForm.triggerScheduleAr.trim() || "عند وقوع الحدث",
        triggerType: newRuleForm.triggerType,
        employeeTemplate: newRuleForm.employeeTemplate,
        responsibleTemplate: newRuleForm.responsibleTemplate,
      };

      await createRuleFn({ data: payload });
      await queryClient.invalidateQueries({ queryKey: ["notification-matrix-rules"] });

      toast.success(
        isAr
          ? `تمت إضافة وتفعيل نوع الإشعار (${payload.nameAr}) بنجاح!`
          : `Custom notification type "${payload.name}" created and activated!`,
      );

      setIsAddModalOpen(false);
      setNewRuleForm({
        id: "",
        name: "",
        nameAr: "",
        description: "",
        descriptionAr: "",
        group: "requests",
        inapp: true,
        email: true,
        push: false,
        sms: false,
        receivers: {
          notifyEmployee: true,
          notifyManager: true,
          notifyHr: false,
          customEmails: [],
        },
        triggerType: "on_action",
        triggerSchedule: "Real-time on action trigger",
        triggerScheduleAr: "فوري عند تنفيذ الإجراء",
        employeeTemplate: {
          subject: "Update Regarding {{request_type}}",
          body: "Dear {{employee_name}}, your request for {{request_type}} has been processed.",
        },
        responsibleTemplate: {
          subject: "[Action Notice] New {{request_type}} for {{employee_name}}",
          body: "Employee {{employee_name}} has submitted a {{request_type}}. Please review at your earliest convenience.",
        },
      });
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "فشل إنشاء نوع الإشعار" : "Failed to create custom notification rule"));
    } finally {
      setIsSubmittingNewRule(false);
    }
  };

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
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-semibold hover:bg-primary/90 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {isAr ? "إضافة نوع إشعار جديد" : "+ Add Notification Type"}
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

      {/* Quick Master Bulk Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/20 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">
            {isAr ? "التحكم السريع في القنوات لجميع الأحداث:" : "Master Channel Controls (All Events):"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* In-App Toggle */}
          <button
            type="button"
            disabled={isBulkUpdating === "inapp"}
            onClick={() => handleToggleAllChannel("inapp")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              allInAppOn
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>🔔 {isAr ? "إشعار" : "In-App"}</span>
            <span className={`rounded px-1 text-[10px] ${allInAppOn ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
              {allInAppOn ? "ON" : "OFF"}
            </span>
          </button>

          {/* Email Toggle */}
          <button
            type="button"
            disabled={isBulkUpdating === "email"}
            onClick={() => handleToggleAllChannel("email")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              allEmailOn
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>✉️ {isAr ? "بريد" : "Email"}</span>
            <span className={`rounded px-1 text-[10px] ${allEmailOn ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
              {allEmailOn ? "ON" : "OFF"}
            </span>
          </button>

          {/* Push Toggle */}
          <button
            type="button"
            disabled={isBulkUpdating === "push"}
            onClick={() => handleToggleAllChannel("push")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              allPushOn
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>📱 {isAr ? "بوش" : "Push"}</span>
            <span className={`rounded px-1 text-[10px] ${allPushOn ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
              {allPushOn ? "ON" : "OFF"}
            </span>
          </button>

          {/* SMS Toggle */}
          <button
            type="button"
            disabled={isBulkUpdating === "sms"}
            onClick={() => handleToggleAllChannel("sms")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              allSmsOn
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>💬 SMS</span>
            <span className={`rounded px-1 text-[10px] ${allSmsOn ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
              {allSmsOn ? "ON" : "OFF"}
            </span>
          </button>
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
                {/* Channel 1: In-App with Master Column Toggle */}
                <th className="px-2.5 py-2 text-center font-semibold bg-muted/30" title={isAr ? "إشعار النظام (In-App)" : "In-App Notification Bell"}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="whitespace-nowrap flex items-center gap-1 text-[11px] font-bold">
                      🔔 {isAr ? "إشعار" : "IN-APP"}
                    </span>
                    <button
                      type="button"
                      disabled={isBulkUpdating === "inapp"}
                      onClick={() => handleToggleAllChannel("inapp")}
                      title={allInAppOn ? (isAr ? "تعطيل الكل" : "Turn all OFF") : (isAr ? "تفعيل الكل" : "Turn all ON")}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                        allInAppOn ? "bg-emerald-500" : someInAppOn ? "bg-emerald-500/50" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allInAppOn ? "translate-x-3 rtl:-translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[9px] font-medium text-muted-foreground">
                      {allInAppOn ? (isAr ? "الكل ON" : "All ON") : someInAppOn ? (isAr ? "جزئي" : "Mixed") : (isAr ? "الكل OFF" : "All OFF")}
                    </span>
                  </div>
                </th>

                {/* Channel 2: Email with Master Column Toggle */}
                <th className="px-2.5 py-2 text-center font-semibold bg-muted/30" title={isAr ? "البريد الإلكتروني عبر SMTP" : "Email Delivery via SMTP"}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="whitespace-nowrap flex items-center gap-1 text-[11px] font-bold">
                      ✉️ {isAr ? "بريد" : "EMAIL"}
                    </span>
                    <button
                      type="button"
                      disabled={isBulkUpdating === "email"}
                      onClick={() => handleToggleAllChannel("email")}
                      title={allEmailOn ? (isAr ? "تعطيل الكل" : "Turn all OFF") : (isAr ? "تفعيل الكل" : "Turn all ON")}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                        allEmailOn ? "bg-emerald-500" : someEmailOn ? "bg-emerald-500/50" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allEmailOn ? "translate-x-3 rtl:-translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[9px] font-medium text-muted-foreground">
                      {allEmailOn ? (isAr ? "الكل ON" : "All ON") : someEmailOn ? (isAr ? "جزئي" : "Mixed") : (isAr ? "الكل OFF" : "All OFF")}
                    </span>
                  </div>
                </th>

                {/* Channel 3: Push with Master Column Toggle */}
                <th className="px-2.5 py-2 text-center font-semibold bg-muted/30" title={isAr ? "إشعارات المتصفح (Web Push)" : "Browser Web Push"}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="whitespace-nowrap flex items-center gap-1 text-[11px] font-bold">
                      📱 {isAr ? "بوش" : "PUSH"}
                    </span>
                    <button
                      type="button"
                      disabled={isBulkUpdating === "push"}
                      onClick={() => handleToggleAllChannel("push")}
                      title={allPushOn ? (isAr ? "تعطيل الكل" : "Turn all OFF") : (isAr ? "تفعيل الكل" : "Turn all ON")}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                        allPushOn ? "bg-emerald-500" : somePushOn ? "bg-emerald-500/50" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allPushOn ? "translate-x-3 rtl:-translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[9px] font-medium text-muted-foreground">
                      {allPushOn ? (isAr ? "الكل ON" : "All ON") : somePushOn ? (isAr ? "جزئي" : "Mixed") : (isAr ? "الكل OFF" : "All OFF")}
                    </span>
                  </div>
                </th>

                {/* Channel 4: SMS with Master Column Toggle */}
                <th className="px-2.5 py-2 text-center font-semibold bg-muted/30" title={isAr ? "رسائل SMS القصيرة" : "SMS Message via ePush"}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="whitespace-nowrap flex items-center gap-1 text-[11px] font-bold">
                      💬 SMS
                    </span>
                    <button
                      type="button"
                      disabled={isBulkUpdating === "sms"}
                      onClick={() => handleToggleAllChannel("sms")}
                      title={allSmsOn ? (isAr ? "تعطيل الكل" : "Turn all OFF") : (isAr ? "تفعيل الكل" : "Turn all ON")}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                        allSmsOn ? "bg-emerald-500" : someSmsOn ? "bg-emerald-500/50" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          allSmsOn ? "translate-x-3 rtl:-translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-[9px] font-medium text-muted-foreground">
                      {allSmsOn ? (isAr ? "الكل ON" : "All ON") : someSmsOn ? (isAr ? "جزئي" : "Mixed") : (isAr ? "الكل OFF" : "All OFF")}
                    </span>
                  </div>
                </th>
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

      {/* Add Custom Notification Type Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-brand-foreground shadow-brand">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {isAr ? "إضافة نوع إشعار جديد إلى المصفوفة" : "Add Custom Notification Type"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "تعريف تنبيه مؤتمت جديد وتحديد القنوات والمستلمين المسؤولين وقوالب الرسائل"
                      : "Define automated routing, delivery channels, responsible receivers, and message copy"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewRule} className="space-y-4 text-xs">
              {/* Row: ID & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                    <span>{isAr ? "معرّف الإشعار (Slug ID) *" : "Rule Identifier (Slug ID) *"}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">e.g. medical_checkup</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newRuleForm.id}
                    onChange={(e) =>
                      setNewRuleForm({
                        ...newRuleForm,
                        id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                      })
                    }
                    placeholder="e.g. work_permit_renewal"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus:border-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    {isAr ? "مجموعة التصنيف *" : "Category Group *"}
                  </label>
                  <select
                    value={newRuleForm.group}
                    onChange={(e) =>
                      setNewRuleForm({
                        ...newRuleForm,
                        group: e.target.value as NotificationCategoryGroup,
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                  >
                    <option value="expirations">{isAr ? "انتهاء وثائق (Expirations)" : "Expirations"}</option>
                    <option value="requests">{isAr ? "طلبات وموافقات (Requests)" : "Requests & Approvals"}</option>
                    <option value="attendance">{isAr ? "حضور وانضباط (Attendance)" : "Attendance & Shifts"}</option>
                    <option value="onboarding">{isAr ? "تعيين وبيانات (Onboarding)" : "Onboarding & Records"}</option>
                    <option value="performance">{isAr ? "تقييم أداء (Performance)" : "Performance & KPIs"}</option>
                    <option value="security">{isAr ? "أمان وحسابات (Security)" : "Security & System"}</option>
                  </select>
                </div>
              </div>

              {/* Names: EN & AR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    {isAr ? "اسم الإشعار (بالإنجليزية) *" : "Notification Name (English) *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={newRuleForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRuleForm({
                        ...newRuleForm,
                        name: val,
                        id: newRuleForm.id || slugify(val),
                      });
                    }}
                    placeholder="e.g. Work Permit Expiration"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    {isAr ? "اسم الإشعار (بالعربية) *" : "Notification Name (Arabic) *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={newRuleForm.nameAr}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, nameAr: e.target.value })}
                    placeholder="مثال: انتهاء تصريح العمل"
                    dir="rtl"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                  />
                </div>
              </div>

              {/* Descriptions: EN & AR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    {isAr ? "الوصف (بالإنجليزية)" : "Description (English)"}
                  </label>
                  <input
                    type="text"
                    value={newRuleForm.description}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, description: e.target.value })}
                    placeholder="Brief description of when this notification fires"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    {isAr ? "الوصف (بالعربية)" : "Description (Arabic)"}
                  </label>
                  <input
                    type="text"
                    value={newRuleForm.descriptionAr}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, descriptionAr: e.target.value })}
                    placeholder="شرح موجز لظروف إرسال هذا التنبيه"
                    dir="rtl"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                  />
                </div>
              </div>

              {/* Delivery Channels */}
              <div className="space-y-2 rounded-xl border border-border bg-background/50 p-3">
                <div className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  {isAr ? "قنوات الإرسال الافتراضية" : "Default Delivery Channels"}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRuleForm({ ...newRuleForm, inapp: !newRuleForm.inapp })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                      newRuleForm.inapp
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    In-App {newRuleForm.inapp ? "✓" : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRuleForm({ ...newRuleForm, email: !newRuleForm.email })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                      newRuleForm.email
                        ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email {newRuleForm.email ? "✓" : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRuleForm({ ...newRuleForm, push: !newRuleForm.push })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                      newRuleForm.push
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Push {newRuleForm.push ? "✓" : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRuleForm({ ...newRuleForm, sms: !newRuleForm.sms })}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                      newRuleForm.sms
                        ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    SMS {newRuleForm.sms ? "✓" : ""}
                  </button>
                </div>
              </div>

              {/* Responsible Receivers */}
              <div className="space-y-3 rounded-xl border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    {isAr ? "جهات الاستلام المسؤولة (Dual-Audience)" : "Responsible Receiver Routing"}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {isAr ? "من يستلم هذا الإشعار؟" : "Who receives this alert?"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewRuleForm({
                        ...newRuleForm,
                        receivers: {
                          ...newRuleForm.receivers,
                          notifyEmployee: !newRuleForm.receivers.notifyEmployee,
                        },
                      })
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                      newRuleForm.receivers.notifyEmployee
                        ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    {isAr ? "الموظف المعني" : "Affected Employee"} {newRuleForm.receivers.notifyEmployee ? "✓" : ""}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewRuleForm({
                        ...newRuleForm,
                        receivers: {
                          ...newRuleForm.receivers,
                          notifyManager: !newRuleForm.receivers.notifyManager,
                        },
                      })
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                      newRuleForm.receivers.notifyManager
                        ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    {isAr ? "المدير المباشر" : "Direct Manager"} {newRuleForm.receivers.notifyManager ? "✓" : ""}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewRuleForm({
                        ...newRuleForm,
                        receivers: {
                          ...newRuleForm.receivers,
                          notifyHr: !newRuleForm.receivers.notifyHr,
                        },
                      })
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition ${
                      newRuleForm.receivers.notifyHr
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isAr ? "الموارد البشرية (HR)" : "HR Admins"} {newRuleForm.receivers.notifyHr ? "✓" : ""}
                  </button>
                </div>

                {/* Additional CC Emails */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">
                    {isAr ? "نسخ إلكترونية إضافية للمسؤولين (CC Emails):" : "Additional Responsible CC Emails:"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={addModalCcDraft}
                      onChange={(e) => setAddModalCcDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCcInNewRule();
                        }
                      }}
                      placeholder="e.g. compliance@integratedtechnics.com"
                      className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
                    />
                    <button
                      type="button"
                      onClick={handleAddCcInNewRule}
                      className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition"
                    >
                      {isAr ? "+ إضافة" : "+ Add CC"}
                    </button>
                  </div>
                  {newRuleForm.receivers.customEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {newRuleForm.receivers.customEmails.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-foreground"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => handleRemoveCcInNewRule(email)}
                            className="text-muted-foreground hover:text-destructive transition"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Trigger Schedule & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    {isAr ? "آلية التشغيل (Trigger Type)" : "Trigger Mechanism"}
                  </label>
                  <select
                    value={newRuleForm.triggerType}
                    onChange={(e) =>
                      setNewRuleForm({
                        ...newRuleForm,
                        triggerType: e.target.value as any,
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                  >
                    <option value="on_action">{isAr ? "فوري عند تنفيذ الإجراء (On Action)" : "Immediate On User Action"}</option>
                    <option value="realtime">{isAr ? "إشعار فوري لحظي (Realtime Dispatch)" : "Realtime Event Dispatch"}</option>
                    <option value="daily_cron">{isAr ? "فحص يومي مؤتمت (Daily Cron Scan)" : "Daily Scheduled Scan"}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    {isAr ? "وصف موعد الإرسال (Schedule)" : "Schedule Description"}
                  </label>
                  <input
                    type="text"
                    value={newRuleForm.triggerSchedule}
                    onChange={(e) => setNewRuleForm({ ...newRuleForm, triggerSchedule: e.target.value })}
                    placeholder="e.g. Daily at 08:00 AM (14d before)"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                  />
                </div>
              </div>

              {/* Dual-Audience Notification Templates */}
              <div className="space-y-2 rounded-xl border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    {isAr ? "قوالب الرسائل (Dual-Audience Copy)" : "Dual-Audience Notification Copy"}
                  </div>

                  {/* Template tabs */}
                  <div className="flex rounded-lg border border-border bg-background p-0.5">
                    <button
                      type="button"
                      onClick={() => setAddModalTemplateTab("employee")}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        addModalTemplateTab === "employee"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isAr ? "نسخة الموظف" : "Employee Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddModalTemplateTab("responsible")}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        addModalTemplateTab === "responsible"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isAr ? "نسخة المسؤول" : "Manager/HR Copy"}
                    </button>
                  </div>
                </div>

                {/* Tokens bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {isAr ? "انقر لإدراج متغير:" : "Insert token:"}
                  </span>
                  {[
                    "{{employee_name}}",
                    "{{expiry_date}}",
                    "{{days_left}}",
                    "{{department}}",
                    "{{request_type}}",
                    "{{manager_name}}",
                  ].map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => insertPlaceholderInNewRule(token)}
                      className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground hover:bg-primary/10 hover:text-primary transition"
                    >
                      {token}
                    </button>
                  ))}
                </div>

                {/* Active template inputs */}
                {addModalTemplateTab === "employee" ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newRuleForm.employeeTemplate.subject}
                      onChange={(e) =>
                        setNewRuleForm({
                          ...newRuleForm,
                          employeeTemplate: {
                            ...newRuleForm.employeeTemplate,
                            subject: e.target.value,
                          },
                        })
                      }
                      placeholder="Subject: [Action Required] Your {{request_type}} update"
                      className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
                    />
                    <textarea
                      rows={3}
                      value={newRuleForm.employeeTemplate.body}
                      onChange={(e) =>
                        setNewRuleForm({
                          ...newRuleForm,
                          employeeTemplate: {
                            ...newRuleForm.employeeTemplate,
                            body: e.target.value,
                          },
                        })
                      }
                      placeholder="Dear {{employee_name}}, please note that..."
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newRuleForm.responsibleTemplate.subject}
                      onChange={(e) =>
                        setNewRuleForm({
                          ...newRuleForm,
                          responsibleTemplate: {
                            ...newRuleForm.responsibleTemplate,
                            subject: e.target.value,
                          },
                        })
                      }
                      placeholder="Subject: [Follow-up Required] Notice for {{employee_name}}"
                      className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
                    />
                    <textarea
                      rows={3}
                      value={newRuleForm.responsibleTemplate.body}
                      onChange={(e) =>
                        setNewRuleForm({
                          ...newRuleForm,
                          responsibleTemplate: {
                            ...newRuleForm.responsibleTemplate,
                            body: e.target.value,
                          },
                        })
                      }
                      placeholder="Notice: Employee {{employee_name}} has an active event. Please review..."
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
                    />
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewRule}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
                >
                  <Plus className={`h-4 w-4 ${isSubmittingNewRule ? "animate-spin" : ""}`} />
                  {isSubmittingNewRule
                    ? isAr
                      ? "جاري الحفظ..."
                      : "Saving..."
                    : isAr
                    ? "حفظ وتفعيل نوع الإشعار"
                    : "Create & Activate Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
