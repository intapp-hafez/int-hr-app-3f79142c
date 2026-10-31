import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Printer,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Check,
  AlertCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  LIGHT_CURRENT_ENGINEER_KPIS,
  KPI_CATEGORIES,
  KPI_CATEGORIES_AR,
  KpiMetricDefinition,
  KpiRowState,
  createEmptyEvaluationState,
  createMockEvaluationState,
  calculateAchievement,
  calculateScore,
  calculateAnnualScore,
  getRatingFromScore,
  RATING_SCALE,
} from "@/lib/kpi/light-current-kpi.data";
import { exportKpiEvaluationToExcel } from "@/lib/kpi/kpi-excel-export";
import { listEmployeesAdmin } from "@/backend/functions/employees.functions";
import { getMyTeam } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface KpiEvaluationViewProps {
  role?: "admin" | "hr" | "manager";
}

export function KpiEvaluationView({ role = "admin" }: KpiEvaluationViewProps) {
  const { t, isAr, dir } = useI18n();
  const session = useSession();

  // Selected Evaluation Meta
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [evaluatorName, setEvaluatorName] = useState<string>(
    session?.name || (role === "manager" ? (isAr ? "المدير المباشر" : "Direct Manager") : (isAr ? "مهندس الإشراف / HR" : "Engineering Lead / HR"))
  );
  const [status, setStatus] = useState<"Draft" | "Submitted" | "Reviewed" | "Approved">("Draft");
  const [activeQuarterFilter, setActiveQuarterFilter] = useState<"all" | "q1" | "q2" | "q3" | "q4">("all");
  const [notes, setNotes] = useState({
    strengths: "",
    growthAreas: "",
    recommendations: "",
  });

  // State for all 17 KPIs
  const [kpiState, setKpiState] = useState<Record<number, KpiRowState>>(createEmptyEvaluationState);
  const [infoModalKpi, setInfoModalKpi] = useState<KpiMetricDefinition | null>(null);

  // Load Employees based on Role (Manager sees team, Admin/HR sees all)
  const isManagerMode = role === "manager";
  const adminEmpFn = useServerFn(listEmployeesAdmin);
  const managerTeamFn = useServerFn(getMyTeam);

  const { data: adminEmpsData } = useQuery({
    queryKey: ["admin", "employees-for-kpi"],
    queryFn: () => adminEmpFn({ data: { page: 1, pageSize: 200 } }),
    enabled: !isManagerMode,
  });

  const { data: managerTeamData } = useQuery({
    queryKey: ["manager", "team-for-kpi"],
    queryFn: () => managerTeamFn({ data: { page: 1, pageSize: 100 } }),
    enabled: isManagerMode,
  });

  const employeesList = useMemo(() => {
    if (isManagerMode) {
      return (managerTeamData?.rows || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.full_name || (isAr ? "موظف" : "Employee"),
        code: m.code || m.emp_code || "",
        position: m.position || m.job_title || (isAr ? "مهندس موقع" : "Site Engineer"),
        department: m.department || (isAr ? "الإدارة الهندسية" : "Engineering"),
      }));
    }
    return (adminEmpsData?.rows || []).map((e: any) => ({
      id: e.id,
      name: e.full_name || e.name || (isAr ? "موظف" : "Employee"),
      code: e.emp_code || "",
      position: e.position || (isAr ? "مهندس تيار خفيف" : "Light Current Engineer"),
      department: e.department || (isAr ? "الإدارة الهندسية" : "Engineering"),
    }));
  }, [isManagerMode, adminEmpsData, managerTeamData, isAr]);

  // Set default selected employee
  useEffect(() => {
    if (employeesList.length > 0 && !selectedEmpId) {
      setSelectedEmpId(employeesList[0].id);
    }
  }, [employeesList, selectedEmpId]);

  const currentEmployee = useMemo(() => {
    return employeesList.find((e) => e.id === selectedEmpId) || {
      id: selectedEmpId,
      name: isAr ? "م. أحمد حسن" : "Eng. Ahmed Hassan",
      code: "ENG-042",
      position: isAr ? "مهندس موقع تيار خفيف" : "Junior ELV / Light Current Site Engineer",
      department: isAr ? "الإدارة الهندسية" : "Engineering",
    };
  }, [employeesList, selectedEmpId, isAr]);

  // LocalStorage Draft persistence
  const storageKey = `kpi_eval_${currentEmployee.id}_${selectedYear}`;

  useEffect(() => {
    if (!currentEmployee.id) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.state) setKpiState(parsed.state);
        if (parsed.status) setStatus(parsed.status);
        if (parsed.evaluatorName) setEvaluatorName(parsed.evaluatorName);
        if (parsed.notes) setNotes(parsed.notes);
      } else {
        setKpiState(createEmptyEvaluationState());
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, currentEmployee.id]);

  const saveDraft = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: kpiState,
          status,
          evaluatorName,
          notes,
          savedAt: new Date().toISOString(),
        })
      );
      toast.success(isAr ? "تم حفظ مسودة التقييم محلياً بنجاح" : "Evaluation draft saved locally");
    } catch {
      toast.error(isAr ? "تعذر حفظ المسودة" : "Failed to save draft");
    }
  };

  const loadSampleData = () => {
    const mock = createMockEvaluationState();
    setKpiState(mock);
    setNotes({
      strengths: isAr
        ? "تفانٍ كبير في العمل الميداني خلال اختبارات تكامل أنظمة التيار الخفيف بموقع المشروع. إتقان ممتاز لشبكات كاميرات المراقبة وبروتوكولات التحكم في الدخول."
        : "High dedication during ELV integration tests on Site A. Strong command of CCTV networking and Access Control protocols.",
      growthAreas: isAr
        ? "تعزيز سرعة التنسيق وإغلاق مشكلات مسارات الكابلات المشتركة مع فرق الأعمال الكهربائية."
        : "Further enhance cross-discipline closeout velocity with Electrical teams on cable tray coordination.",
      recommendations: isAr
        ? "يوصى بحضور دورات متقدمة في Honeywell EBI وشهادة شبكات Cisco CCNA خلال الربع القادم."
        : "Recommend advanced Honeywell/Cisco CCNA training for Q3.",
    });
    toast.success(isAr ? "تم تحميل بيانات تجريبية واقعية لمعاينة الحسابات" : "Loaded realistic evaluation data for preview");
  };

  const resetForm = () => {
    setKpiState(createEmptyEvaluationState());
    setNotes({ strengths: "", growthAreas: "", recommendations: "" });
    setStatus("Draft");
    toast.info(isAr ? "تمت إعادة تعيين بطاقة التقييم إلى نموذج فارغ" : "Scorecard reset to blank state");
  };

  // Cell Value Updates
  const handleActualChange = (
    kpiId: number,
    quarter: "q1" | "q2" | "q3" | "q4",
    rawValue: string
  ) => {
    const kpi = LIGHT_CURRENT_ENGINEER_KPIS.find((k) => k.id === kpiId);
    if (!kpi) return;

    let parsedActual: number | null = null;
    const trimmed = rawValue.trim();

    if (trimmed !== "") {
      const numeric = parseFloat(trimmed.replace("%", ""));
      if (!isNaN(numeric)) {
        if (kpi.inputType === "rating_5") {
          parsedActual = numeric <= 5 ? numeric / 5 : numeric / 100;
        } else {
          parsedActual = numeric > 1 ? numeric / 100 : numeric;
        }
      }
    }

    setKpiState((prev) => {
      const row = prev[kpiId] || {
        id: kpiId,
        q1: { actual: null, achievement: null, score: null },
        q2: { actual: null, achievement: null, score: null },
        q3: { actual: null, achievement: null, score: null },
        q4: { actual: null, achievement: null, score: null },
        annualScore: null,
      };

      const achv = calculateAchievement(parsedActual, kpi.target);
      const score = calculateScore(achv, kpi.weight);

      const updatedQuarter = { actual: parsedActual, achievement: achv, score };
      const updatedRow = { ...row, [quarter]: updatedQuarter };

      const allScores = [
        quarter === "q1" ? score : row.q1.score,
        quarter === "q2" ? score : row.q2.score,
        quarter === "q3" ? score : row.q3.score,
        quarter === "q4" ? score : row.q4.score,
      ];
      updatedRow.annualScore = calculateAnnualScore(allScores);

      return { ...prev, [kpiId]: updatedRow };
    });
  };

  // Calculations across the entire sheet
  const summaryTotals = useMemo(() => {
    let q1Score = 0;
    let q2Score = 0;
    let q3Score = 0;
    let q4Score = 0;
    let annualWeightedSum = 0;

    let q1Count = 0;
    let q2Count = 0;
    let q3Count = 0;
    let q4Count = 0;

    for (const kpi of LIGHT_CURRENT_ENGINEER_KPIS) {
      const row = kpiState[kpi.id];
      if (row) {
        if (typeof row.q1.score === "number") {
          q1Score += row.q1.score;
          q1Count++;
        }
        if (typeof row.q2.score === "number") {
          q2Score += row.q2.score;
          q2Count++;
        }
        if (typeof row.q3.score === "number") {
          q3Score += row.q3.score;
          q3Count++;
        }
        if (typeof row.q4.score === "number") {
          q4Score += row.q4.score;
          q4Count++;
        }
        if (typeof row.annualScore === "number") {
          annualWeightedSum += row.annualScore;
        }
      }
    }

    return {
      q1Score,
      q2Score,
      q3Score,
      q4Score,
      annualWeightedSum,
      hasData: q1Count > 0 || q2Count > 0 || q3Count > 0 || q4Count > 0,
    };
  }, [kpiState]);

  const ratingTier = useMemo(() => {
    return getRatingFromScore(summaryTotals.hasData ? summaryTotals.annualWeightedSum : null);
  }, [summaryTotals]);

  // Category Summaries for Progress Bars
  const categoryStats = useMemo(() => {
    return KPI_CATEGORIES.map((catName) => {
      const catKpis = LIGHT_CURRENT_ENGINEER_KPIS.filter((k) => k.category === catName);
      const totalWeight = catKpis.reduce((acc, k) => acc + k.weight, 0);
      let earnedScore = 0;

      for (const k of catKpis) {
        const row = kpiState[k.id];
        if (row && typeof row.annualScore === "number") {
          earnedScore += row.annualScore;
        }
      }

      const percentage = totalWeight > 0 ? (earnedScore / totalWeight) * 100 : 0;
      return {
        name: catName,
        name_ar: KPI_CATEGORIES_AR[catName] || catName,
        totalWeight,
        earnedScore,
        percentage: Math.min(100, Math.round(percentage)),
      };
    });
  }, [kpiState]);

  const fmtPercent = (val: number | null | undefined, decimals = 1) => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return `${(val * 100).toFixed(decimals)}%`;
  };

  const handleExport = () => {
    exportKpiEvaluationToExcel(kpiState, {
      employeeName: currentEmployee.name,
      evaluatorName,
      year: selectedYear,
      department: currentEmployee.department,
      jobTitle: currentEmployee.position,
    });
    toast.success(isAr ? "تم تصدير ملف الإكسيل بنجاح" : "Excel scorecard exported");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div dir={dir} className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
              <Award className="h-3.5 w-3.5" />
              {isAr ? "نموذج تقييم الأداء — إنترجريتد تكنيكس" : "Integrated Technics Performance Model"}
            </span>
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {role === "manager"
                ? isAr ? "بوابة المدير" : "Manager Portal"
                : role === "hr"
                ? isAr ? "بوابة الموارد البشرية" : "HR Portal"
                : isAr ? "بوابة الإدارة العامة" : "Admin Portal"}
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {isAr ? "التقييم السنوي لمؤشرات الأداء" : "Annual KPI Evaluation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "مهندس موقع تيار خفيف مبتدئ — بطاقة التقييم ومصفوفة الأداء الربع سنوية"
              : "Junior ELV / Light Current Site Engineer — Quarterly Scorecard & Rating Matrix"}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSampleData} className="rounded-xl gap-1.5 cursor-pointer">
            <Sparkles className="h-4 w-4 text-brand" /> {isAr ? "بيانات تجريبية" : "Sample Data"}
          </Button>
          <Button variant="outline" size="sm" onClick={saveDraft} className="rounded-xl gap-1.5 cursor-pointer">
            <Save className="h-4 w-4" /> {isAr ? "حفظ المسودة" : "Save Draft"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="rounded-xl gap-1.5 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> {isAr ? "تصدير إكسيل" : "Export Excel"}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl gap-1.5 cursor-pointer">
            <Printer className="h-4 w-4" /> {isAr ? "طباعة / PDF" : "Print / PDF"}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetForm} className="rounded-xl text-muted-foreground cursor-pointer" title={isAr ? "إعادة تعيين" : "Reset"}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Target Employee & Evaluation Context Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        {/* Employee Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> {isAr ? "الموظف المُراد تقييمه" : "Employee Being Evaluated"}
          </Label>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {employeesList.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} {emp.code ? `(${emp.code})` : ""} — {emp.position}
              </option>
            ))}
          </select>
        </div>

        {/* Year Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {isAr ? "سنة التقييم" : "Evaluation Year"}
          </Label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value={currentYear}>{currentYear} {isAr ? "(السنة الحالية)" : "(Current Year)"}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear + 1}>{currentYear + 1}</option>
          </select>
        </div>

        {/* Evaluator Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            {isAr ? "المُقيِّم (المهندس المسؤول / المدير / HR)" : "Evaluator (Lead / Manager / HR)"}
          </Label>
          <Input
            value={evaluatorName}
            onChange={(e) => setEvaluatorName(e.target.value)}
            placeholder={isAr ? "اسم المُقيِّم بالكامل" : "Evaluator Full Name"}
            className="rounded-xl h-9.5 text-sm"
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "حالة التقييم" : "Evaluation Status"}</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="Draft">{isAr ? "مسودة (قيد الإعداد)" : "Draft (In Progress)"}</option>
            <option value="Submitted">{isAr ? "تم الإرسال للمراجعة" : "Submitted for Review"}</option>
            <option value="Reviewed">{isAr ? "تمت المراجعة من الإدارة" : "Reviewed by Management"}</option>
            <option value="Approved">{isAr ? "معتمد ونهائي" : "Approved & Finalized"}</option>
          </select>
        </div>
      </div>

      {/* KPI Overview Summary Dashboard (Top Tier) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Final Score Card (4 Cols) */}
        <div className="lg:col-span-4 rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isAr ? "النتيجة السنوية الإجمالية" : "Overall Annual Score"}
              </span>
              <Badge className={`border text-xs px-2.5 py-0.5 font-semibold ${ratingTier.badgeClass}`}>
                {isAr ? ratingTier.tier_ar : ratingTier.tier}
              </Badge>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums text-foreground">
                {summaryTotals.hasData ? fmtPercent(summaryTotals.annualWeightedSum, 1) : "0.0%"}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">
                {isAr ? "/ 100% المستهدف" : "/ 100% Target"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {isAr ? ratingTier.description_ar : ratingTier.description}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{isAr ? "نسبة الإنجاز والتقدم الكلي" : "Overall Achievement Progress"}</span>
              <span className="font-mono font-medium text-foreground">
                {fmtPercent(summaryTotals.annualWeightedSum, 1)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, (summaryTotals.annualWeightedSum || 0) * 100)}%`,
                  backgroundColor: ratingTier.color,
                }}
              />
            </div>
          </div>
        </div>

        {/* Quarterly Progression Cards (4 Cols) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3">
          {[
            { q: "Q1", q_ar: "الربع 1", score: summaryTotals.q1Score, label: isAr ? "يناير – مارس" : "Jan – Mar" },
            { q: "Q2", q_ar: "الربع 2", score: summaryTotals.q2Score, label: isAr ? "أبريل – يونيو" : "Apr – Jun" },
            { q: "Q3", q_ar: "الربع 3", score: summaryTotals.q3Score, label: isAr ? "يوليو – سبتمبر" : "Jul – Sep" },
            { q: "Q4", q_ar: "الربع 4", score: summaryTotals.q4Score, label: isAr ? "أكتوبر – ديسمبر" : "Oct – Dec" },
          ].map((item) => (
            <div
              key={item.q}
              className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                activeQuarterFilter === item.q.toLowerCase()
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">{isAr ? item.q_ar : item.q}</span>
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold font-mono tabular-nums text-foreground">
                  {fmtPercent(item.score, 1)}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {isAr ? "الدرجة الموزونة للربع" : "Quarter Weighted"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Rating Scale Reference Guide (4 Cols) */}
        <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isAr ? "مستويات التقييم الرسمية" : "Official Performance Tiers"}
          </h3>
          <div className="space-y-1.5 text-xs">
            {RATING_SCALE.map((tier) => (
              <div
                key={tier.tier}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                  ratingTier.tier === tier.tier
                    ? "border-brand bg-brand/10 font-semibold"
                    : "border-transparent hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span>{isAr ? tier.tier_ar : tier.tier}</span>
                </div>
                <span className="font-mono text-muted-foreground text-[11px]">
                  {fmtPercent(tier.minScore, 0)}
                  {tier.minScore < 0.9 ? ` – ${fmtPercent(tier.minScore + 0.14, 0)}` : "+"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="scorecard" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <TabsList className="rounded-2xl p-1 bg-muted/60">
            <TabsTrigger value="scorecard" className="rounded-xl px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" /> {isAr ? "بطاقة التقييم" : "Evaluation Scorecard"}
            </TabsTrigger>
            <TabsTrigger value="guidelines" className="rounded-xl px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer">
              <HelpCircle className="h-4 w-4" /> {isAr ? "دليل مؤشرات الأداء والتعريفات" : "KPI Overview & Definitions"}
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-xl px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer">
              <Layers className="h-4 w-4" /> {isAr ? "توزيع الأداء حسب التخصص" : "Category Breakdown"}
            </TabsTrigger>
            <TabsTrigger value="signoff" className="rounded-xl px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer">
              <FileText className="h-4 w-4" /> {isAr ? "ملاحظات المشرف والاعتمادات" : "Supervisor Feedback & Sign-off"}
            </TabsTrigger>
          </TabsList>

          {/* Quick Quarter Filter on Scorecard view */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border text-xs print:hidden">
            <span className="px-2 font-medium text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> {isAr ? "عرض:" : "View:"}
            </span>
            {(["all", "q1", "q2", "q3", "q4"] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setActiveQuarterFilter(q)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  activeQuarterFilter === q
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {q === "all" ? (isAr ? "الكل" : "ALL") : q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB 1: FULL SCORECARD TABLE ── */}
        <TabsContent value="scorecard" className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="px-3 py-3 text-start w-8">#</th>
                    <th className="px-3 py-3 text-start min-w-[240px]">
                      {isAr ? "مؤشر الأداء / المقياس" : "KPI / Metric Name"}
                    </th>
                    <th className="px-3 py-3 text-center w-16">{isAr ? "الوزن" : "Weight"}</th>
                    <th className="px-3 py-3 text-center w-16">{isAr ? "الهدف" : "Target"}</th>

                    {/* Q1 Columns */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q1") && (
                      <>
                        <th className="px-2 py-3 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-20">
                          {isAr ? "Q1 الفعلي" : "Q1 Actual"}
                        </th>
                        <th className="px-2 py-3 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-16">
                          {isAr ? "Q1 نسبة التحقيق" : "Q1 Achv%"}
                        </th>
                        <th className="px-2 py-3 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-16">
                          {isAr ? "Q1 الدرجة" : "Q1 Score"}
                        </th>
                      </>
                    )}

                    {/* Q2 Columns */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q2") && (
                      <>
                        <th className="px-2 py-3 text-center bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 w-20">
                          {isAr ? "Q2 الفعلي" : "Q2 Actual"}
                        </th>
                        <th className="px-2 py-3 text-center bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 w-16">
                          {isAr ? "Q2 نسبة التحقيق" : "Q2 Achv%"}
                        </th>
                        <th className="px-2 py-3 text-center bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 w-16">
                          {isAr ? "Q2 الدرجة" : "Q2 Score"}
                        </th>
                      </>
                    )}

                    {/* Q3 Columns */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q3") && (
                      <>
                        <th className="px-2 py-3 text-center bg-amber-500/5 text-amber-700 dark:text-amber-300 w-20">
                          {isAr ? "Q3 الفعلي" : "Q3 Actual"}
                        </th>
                        <th className="px-2 py-3 text-center bg-amber-500/5 text-amber-700 dark:text-amber-300 w-16">
                          {isAr ? "Q3 نسبة التحقيق" : "Q3 Achv%"}
                        </th>
                        <th className="px-2 py-3 text-center bg-amber-500/5 text-amber-700 dark:text-amber-300 w-16">
                          {isAr ? "Q3 الدرجة" : "Q3 Score"}
                        </th>
                      </>
                    )}

                    {/* Q4 Columns */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q4") && (
                      <>
                        <th className="px-2 py-3 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-20">
                          {isAr ? "Q4 الفعلي" : "Q4 Actual"}
                        </th>
                        <th className="px-2 py-3 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-16">
                          {isAr ? "Q4 نسبة التحقيق" : "Q4 Achv%"}
                        </th>
                        <th className="px-2 py-3 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-16">
                          {isAr ? "Q4 الدرجة" : "Q4 Score"}
                        </th>
                      </>
                    )}

                    {/* Annual Score Column */}
                    <th className="px-3 py-3 text-center bg-muted/80 text-foreground w-24">
                      {isAr ? "الدرجة السنوية" : "Annual Score"}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {KPI_CATEGORIES.map((category) => {
                    const categoryKpis = LIGHT_CURRENT_ENGINEER_KPIS.filter(
                      (k) => k.category === category
                    );
                    const catWeight = categoryKpis.reduce((acc, k) => acc + k.weight, 0);

                    return (
                      <React.Fragment key={category}>
                        {/* Category Header Bar */}
                        <tr className="bg-muted/40 font-semibold text-foreground">
                          <td
                            colSpan={
                              4 +
                              (activeQuarterFilter === "all"
                                ? 12
                                : 3) +
                              1
                            }
                            className="px-4 py-2.5 text-start font-display text-[11px] tracking-wide"
                          >
                            <span className="text-brand font-bold me-2">●</span>
                            {isAr ? KPI_CATEGORIES_AR[category] || category : category}
                            <span className="ms-2 text-[10px] font-normal text-muted-foreground">
                              {isAr
                                ? `(وزن الفئة: ${(catWeight * 100).toFixed(1)}%)`
                                : `(Category Weight: ${(catWeight * 100).toFixed(1)}%)`}
                            </span>
                          </td>
                        </tr>

                        {/* KPI Metric Rows */}
                        {categoryKpis.map((kpi) => {
                          const row = kpiState[kpi.id] || {
                            id: kpi.id,
                            q1: { actual: null, achievement: null, score: null },
                            q2: { actual: null, achievement: null, score: null },
                            q3: { actual: null, achievement: null, score: null },
                            q4: { actual: null, achievement: null, score: null },
                            annualScore: null,
                          };

                          return (
                            <tr
                              key={kpi.id}
                              className="hover:bg-muted/20 transition-colors group"
                            >
                              <td className="px-3 py-2 text-muted-foreground font-mono text-center">
                                {kpi.id}
                              </td>

                              {/* KPI Name with Info Popover */}
                              <td className="px-3 py-2 font-medium text-foreground">
                                <div className="flex items-center gap-1.5">
                                  <span>{isAr ? kpi.name_ar : kpi.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setInfoModalKpi(kpi)}
                                    title={isAr ? "عرض تعريف المؤشر وطريقة قياسه" : "View metric definition & measurement method"}
                                    className="text-muted-foreground hover:text-brand transition-colors p-0.5 cursor-pointer"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <span className="text-[10px] text-muted-foreground block truncate max-w-xs">
                                  {isAr ? kpi.inputHint_ar : kpi.inputHint}
                                </span>
                              </td>

                              {/* Weight % */}
                              <td className="px-3 py-2 text-center font-mono tabular-nums text-muted-foreground">
                                {fmtPercent(kpi.weight, 1)}
                              </td>

                              {/* Target % */}
                              <td className="px-3 py-2 text-center font-mono tabular-nums font-semibold text-foreground">
                                {fmtPercent(kpi.target, 0)}
                              </td>

                              {/* Q1 */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q1") && (
                                <>
                                  <td className="px-2 py-1.5 text-center bg-blue-500/[0.02]">
                                    <input
                                      type="text"
                                      placeholder="—"
                                      value={
                                        row.q1.actual !== null
                                          ? kpi.inputType === "rating_5"
                                            ? `${(row.q1.actual * 5).toFixed(1)}/5`
                                            : `${Math.round(row.q1.actual * 100)}%`
                                          : ""
                                      }
                                      onChange={(e) =>
                                        handleActualChange(kpi.id, "q1", e.target.value)
                                      }
                                      className="w-16 mx-auto rounded-lg border border-input bg-background px-2 py-1 text-center font-mono text-xs tabular-nums focus:border-brand focus:ring-1 focus:ring-brand"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums text-[11px] bg-blue-500/[0.02] text-muted-foreground">
                                    {fmtPercent(row.q1.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums font-semibold bg-blue-500/[0.02] text-blue-600 dark:text-blue-400">
                                    {fmtPercent(row.q1.score, 2)}
                                  </td>
                                </>
                              )}

                              {/* Q2 */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q2") && (
                                <>
                                  <td className="px-2 py-1.5 text-center bg-emerald-500/[0.02]">
                                    <input
                                      type="text"
                                      placeholder="—"
                                      value={
                                        row.q2.actual !== null
                                          ? kpi.inputType === "rating_5"
                                            ? `${(row.q2.actual * 5).toFixed(1)}/5`
                                            : `${Math.round(row.q2.actual * 100)}%`
                                          : ""
                                      }
                                      onChange={(e) =>
                                        handleActualChange(kpi.id, "q2", e.target.value)
                                      }
                                      className="w-16 mx-auto rounded-lg border border-input bg-background px-2 py-1 text-center font-mono text-xs tabular-nums focus:border-brand focus:ring-1 focus:ring-brand"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums text-[11px] bg-emerald-500/[0.02] text-muted-foreground">
                                    {fmtPercent(row.q2.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums font-semibold bg-emerald-500/[0.02] text-emerald-600 dark:text-emerald-400">
                                    {fmtPercent(row.q2.score, 2)}
                                  </td>
                                </>
                              )}

                              {/* Q3 */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q3") && (
                                <>
                                  <td className="px-2 py-1.5 text-center bg-amber-500/[0.02]">
                                    <input
                                      type="text"
                                      placeholder="—"
                                      value={
                                        row.q3.actual !== null
                                          ? kpi.inputType === "rating_5"
                                            ? `${(row.q3.actual * 5).toFixed(1)}/5`
                                            : `${Math.round(row.q3.actual * 100)}%`
                                          : ""
                                      }
                                      onChange={(e) =>
                                        handleActualChange(kpi.id, "q3", e.target.value)
                                      }
                                      className="w-16 mx-auto rounded-lg border border-input bg-background px-2 py-1 text-center font-mono text-xs tabular-nums focus:border-brand focus:ring-1 focus:ring-brand"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums text-[11px] bg-amber-500/[0.02] text-muted-foreground">
                                    {fmtPercent(row.q3.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums font-semibold bg-amber-500/[0.02] text-amber-600 dark:text-amber-400">
                                    {fmtPercent(row.q3.score, 2)}
                                  </td>
                                </>
                              )}

                              {/* Q4 */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q4") && (
                                <>
                                  <td className="px-2 py-1.5 text-center bg-purple-500/[0.02]">
                                    <input
                                      type="text"
                                      placeholder="—"
                                      value={
                                        row.q4.actual !== null
                                          ? kpi.inputType === "rating_5"
                                            ? `${(row.q4.actual * 5).toFixed(1)}/5`
                                            : `${Math.round(row.q4.actual * 100)}%`
                                          : ""
                                      }
                                      onChange={(e) =>
                                        handleActualChange(kpi.id, "q4", e.target.value)
                                      }
                                      className="w-16 mx-auto rounded-lg border border-input bg-background px-2 py-1 text-center font-mono text-xs tabular-nums focus:border-brand focus:ring-1 focus:ring-brand"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums text-[11px] bg-purple-500/[0.02] text-muted-foreground">
                                    {fmtPercent(row.q4.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono tabular-nums font-semibold bg-purple-500/[0.02] text-purple-600 dark:text-purple-400">
                                    {fmtPercent(row.q4.score, 2)}
                                  </td>
                                </>
                              )}

                              {/* Annual Score */}
                              <td className="px-3 py-2 text-center font-mono tabular-nums font-bold bg-muted/30 text-foreground">
                                {fmtPercent(row.annualScore, 2)}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* Table Footer Total Row */}
                <tfoot className="border-t-2 border-border bg-muted/80 font-bold text-foreground">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-start uppercase tracking-wider text-xs">
                      {isAr ? "إجمالي الأوزان والنتائج السنوية" : "Total Annual Weights & Scores"}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-xs">100.0%</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">—</td>

                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q1") && (
                      <>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center font-mono text-xs text-blue-700 dark:text-blue-300">
                          {fmtPercent(summaryTotals.q1Score, 2)}
                        </td>
                      </>
                    )}

                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q2") && (
                      <>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center font-mono text-xs text-emerald-700 dark:text-emerald-300">
                          {fmtPercent(summaryTotals.q2Score, 2)}
                        </td>
                      </>
                    )}

                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q3") && (
                      <>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center font-mono text-xs text-amber-700 dark:text-amber-300">
                          {fmtPercent(summaryTotals.q3Score, 2)}
                        </td>
                      </>
                    )}

                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q4") && (
                      <>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-2 py-3 text-center font-mono text-xs text-purple-700 dark:text-purple-300">
                          {fmtPercent(summaryTotals.q4Score, 2)}
                        </td>
                      </>
                    )}

                    <td className="px-3 py-3 text-center font-mono text-sm font-extrabold text-foreground bg-muted">
                      {fmtPercent(summaryTotals.annualWeightedSum, 2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: METRIC GUIDELINES (KPI OVERVIEW) ── */}
        <TabsContent value="guidelines" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {isAr ? "دليل مؤشرات الأداء وطريقة القياس" : "KPI Overview & Measurement Directory"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "التعريفات الهندسية الرسمية، قواعد القياس، ومعايير الفحص من واقع المعيار المعتمد."
                  : "Complete engineering definitions, measurement rules, and evaluation criteria from the official standard."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LIGHT_CURRENT_ENGINEER_KPIS.map((kpi) => (
                <div
                  key={kpi.id}
                  className="rounded-2xl border border-border p-4 hover:border-brand/40 transition-colors bg-muted/10 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold text-brand uppercase tracking-wider">
                        {isAr ? kpi.category_ar : kpi.category}
                      </span>
                      <h4 className="font-semibold text-sm text-foreground">
                        #{kpi.id}. {isAr ? kpi.name_ar : kpi.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {isAr ? `الوزن: ${fmtPercent(kpi.weight, 1)}` : `Weight: ${fmtPercent(kpi.weight, 1)}`}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px] font-mono">
                        {isAr ? `الهدف: ${fmtPercent(kpi.target, 0)}` : `Target: ${fmtPercent(kpi.target, 0)}`}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5 text-muted-foreground">
                    <p>
                      <strong className="text-foreground font-medium">{isAr ? "التعريف:" : "Definition:"}</strong>{" "}
                      {isAr ? kpi.definition_ar : kpi.definition}
                    </p>
                    <p className="rounded-xl bg-card p-2.5 border border-border/60">
                      <strong className="text-foreground font-medium">{isAr ? "طريقة القياس:" : "How it is measured:"}</strong>{" "}
                      {isAr ? kpi.howMeasured_ar : kpi.howMeasured}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 3: CATEGORY BREAKDOWN ── */}
        <TabsContent value="categories" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {isAr ? "توزيع الأداء حسب التخصص الهندسي" : "Performance by Engineering Discipline"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "توزيع الدرجات الموزونة المحققة في كل مجال من مجالات كفاءة مهندس الموقع."
                  : "Distribution of weighted scores achieved across each core engineering competency area."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryStats.map((cat) => (
                <div
                  key={cat.name}
                  className="rounded-2xl border border-border bg-muted/10 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{isAr ? cat.name_ar : cat.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {isAr
                          ? `وزن الفئة: ${(cat.totalWeight * 100).toFixed(1)}%`
                          : `Category Weight: ${(cat.totalWeight * 100).toFixed(1)}%`}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold text-foreground">
                      {(cat.earnedScore * 100).toFixed(1)}% / {(cat.totalWeight * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{isAr ? "نسبة إنجاز الفئة" : "Category Attainment"}</span>
                      <span className="font-medium text-foreground">{cat.percentage}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cat.percentage >= 90
                            ? "bg-emerald-500"
                            : cat.percentage >= 75
                            ? "bg-blue-500"
                            : cat.percentage >= 60
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 4: SUPERVISOR FEEDBACK & SIGN-OFF ── */}
        <TabsContent value="signoff" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {isAr ? "التقييم النوعي والاعتمادات الرسمية" : "Qualitative Assessment & Formal Sign-off"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "توصيات المدير المباشر، مجالات التطوير، والاعتمادات."
                  : "Manager recommendations, development milestones, and approvals."}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "1. نقاط القوة الفنية وأبرز الإنجازات الميدانية بالموقع" : "1. Key Technical Strengths & Notable Site Deliveries"}
                </Label>
                <textarea
                  value={notes.strengths}
                  onChange={(e) => setNotes({ ...notes, strengths: e.target.value })}
                  rows={3}
                  placeholder={
                    isAr
                      ? "تفاصيل التشغيل الناجح للأنظمة، الربط والتكامل المتميز، أو الاستجابة السريعة لطوارئ الموقع..."
                      : "Detail successful system commissioning, flawless integrations, or emergency site response..."
                  }
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "2. مجالات التطوير الفني وتحسين الالتزام بالجدول الزمني" : "2. Areas for Technical Development & Schedule Optimization"}
                </Label>
                <textarea
                  value={notes.growthAreas}
                  onChange={(e) => setNotes({ ...notes, growthAreas: e.target.value })}
                  rows={3}
                  placeholder={
                    isAr
                      ? "تفاصيل المجالات المحتاجة لتوجيه: قراءة المخططات التنفيذية، سرعة معالجة الأعطال، التوثيق..."
                      : "Detail areas needing coaching: shop drawing reading, faster fault clearance, documentation..."
                  }
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "3. الشهادات والدورات الموصى بها وخطة النمو للدورة القادمة" : "3. Recommended Certifications & Growth Plan for Next Cycle"}
                </Label>
                <textarea
                  value={notes.recommendations}
                  onChange={(e) => setNotes({ ...notes, recommendations: e.target.value })}
                  rows={3}
                  placeholder={
                    isAr
                      ? "مثال: دورات متقدمة في أنظمة Honeywell EBI أو Genetec أو Cisco CCNA أو NFPA 72..."
                      : "E.g., Milestone courses on Honeywell EBI, Genetec Security Center, Cisco CCNA, NFPA 72..."
                  }
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            {/* Sign-off Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="rounded-2xl border border-border p-4 bg-muted/10 space-y-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {isAr ? "المُقيِّم" : "Evaluator"}
                </span>
                <p className="font-semibold text-sm text-foreground">{evaluatorName || "—"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? `الحالة: ${status === "Draft" ? "قيد الإعداد" : "تم التوقيع والإرسال"}`
                    : `Status: ${status === "Draft" ? "Drafting" : "Signed & Submitted"}`}
                </p>
              </div>

              <div className="rounded-2xl border border-border p-4 bg-muted/10 space-y-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {isAr ? "إقرار الموظف" : "Employee Acknowledgment"}
                </span>
                <p className="font-semibold text-sm text-foreground">{currentEmployee.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {status === "Approved"
                    ? isAr ? "تم الاطلاع والاعتماد" : "Acknowledged & Finalized"
                    : isAr ? "بانتظار استكمال التقييم" : "Pending completion"}
                </p>
              </div>

              <div className="rounded-2xl border border-border p-4 bg-muted/10 space-y-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {isAr ? "اعتماد الموارد البشرية" : "HR Verification"}
                </span>
                <p className="font-semibold text-sm text-foreground">
                  {isAr ? "الموارد البشرية — إنترجريتد تكنيكس" : "Integrated Technics HR"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {status === "Approved"
                    ? isAr ? "مؤرشف في ملف الموظف" : "Archived in Employee Record"
                    : isAr ? "بانتظار مراجعة الإدارة" : "Awaiting Manager Review"}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Metric Detail Info Dialog */}
      <Dialog open={!!infoModalKpi} onOpenChange={(open) => !open && setInfoModalKpi(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <span className="text-[10px] uppercase font-bold text-brand tracking-wider">
              {isAr ? infoModalKpi?.category_ar : infoModalKpi?.category}
            </span>
            <DialogTitle className="text-base font-bold font-display">
              #{infoModalKpi?.id}. {isAr ? infoModalKpi?.name_ar : infoModalKpi?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs pt-2">
            <div className="flex gap-2">
              <Badge variant="outline" className="font-mono">
                {isAr ? `الوزن: ${fmtPercent(infoModalKpi?.weight, 1)}` : `Weight: ${fmtPercent(infoModalKpi?.weight, 1)}`}
              </Badge>
              <Badge variant="secondary" className="font-mono">
                {isAr ? `الهدف: ${fmtPercent(infoModalKpi?.target, 0)}` : `Target: ${fmtPercent(infoModalKpi?.target, 0)}`}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <strong className="text-foreground block">
                {isAr ? "التعريف (ما الذي يقيسه هذا المؤشر):" : "Definition (What it measures):"}
              </strong>
              <p className="text-muted-foreground leading-relaxed">
                {isAr ? infoModalKpi?.definition_ar : infoModalKpi?.definition}
              </p>
            </div>
            <div className="space-y-1.5 bg-muted/40 p-3 rounded-2xl border border-border">
              <strong className="text-foreground block">
                {isAr ? "طريقة القياس المعتمدة:" : "How it is measured:"}
              </strong>
              <p className="text-muted-foreground leading-relaxed">
                {isAr ? infoModalKpi?.howMeasured_ar : infoModalKpi?.howMeasured}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
