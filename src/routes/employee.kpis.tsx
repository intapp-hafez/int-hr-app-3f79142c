import React, { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Printer,
  ShieldCheck,
  Clock,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  FileText,
  Target,
  UserCog,
  Building2,
  IdCard,
  Sparkles,
  CheckCheck,
  Compass,
  Check,
  FileCheck,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Users,
  Shield,
  TrendingUp,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  LIGHT_CURRENT_ENGINEER_KPIS,
  KpiRowState,
  getRatingFromScore,
} from "@/lib/kpi/light-current-kpi.data";
import { exportKpiEvaluationToExcel } from "@/lib/kpi/kpi-excel-export";
import {
  getMyKpiEvaluation,
  listMyKpiEvaluations,
  matchKpiTemplate,
} from "@/backend/functions/kpi-evaluations.functions";
import { getMyProfileDetails } from "@/backend/functions/auth.functions";
import { buildDynamicJobDescription } from "@/lib/kpi/dynamic-job-description";
import { JD_SELECT_COLUMNS, type SavedJobDescription } from "@/lib/job-descriptions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/employee/kpis")({
  component: EmployeeKpiPage,
});

export function EmployeeKpiPage() {
  const { isAr, dir } = useI18n();
  const session = useSession();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [mainTab, setMainTab] = useState<"job_description" | "kpis_records">("job_description");
  const [kpiSubTab, setKpiSubTab] = useState<"quarters" | "scorecard" | "feedback" | "history">("quarters");
  const [collapsedPillars, setCollapsedPillars] = useState<Record<string, boolean>>({});

  const togglePillar = (num: string) => {
    setCollapsedPillars((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const getMyKpiFn = useServerFn(getMyKpiEvaluation);
  const listMyKpisFn = useServerFn(listMyKpiEvaluations);
  const getProfileFn = useServerFn(getMyProfileDetails);
  const matchTemplateFn = useServerFn(matchKpiTemplate);

  // Fetch current year evaluation
  const { data: evaluation } = useQuery({
    queryKey: ["my-kpi-evaluation", selectedYear],
    queryFn: () => getMyKpiFn({ data: { year: selectedYear } }),
    enabled: !!session,
  });

  // Fetch history list of evaluations
  const { data: allEvaluations = [] } = useQuery({
    queryKey: ["my-kpis-history"],
    queryFn: () => listMyKpisFn(),
    enabled: !!session,
  });

  // Fetch profile details for Job Description
  const { data: profileDetails } = useQuery({
    queryKey: ["my-profile-details"],
    queryFn: () => getProfileFn(),
    enabled: !!session,
  });

  // Fetch matched template for Job Description and criteria
  const { data: matchedTemplate } = useQuery({
    queryKey: ["my-matched-template", session?.employeeId],
    queryFn: () => matchTemplateFn({ data: { employeeId: session!.employeeId! } }),
    enabled: !!session?.employeeId,
  });

  // Fetch official saved job description from position_job_descriptions if available
  const effectivePositionId = profileDetails?.position_id || matchedTemplate?.position_id || (matchedTemplate as any)?.position?.id;

  const { data: savedJobDescription } = useQuery({
    queryKey: ["position-job-description", effectivePositionId],
    queryFn: async () => {
      if (!effectivePositionId) return null;
      try {
        const { data, error } = await supabase
          .from("position_job_descriptions" as any)
          .select(JD_SELECT_COLUMNS)
          .eq("position_id", effectivePositionId)
          .maybeSingle();
        if (error) return null;
        return data as SavedJobDescription | null;
      } catch {
        return null;
      }
    },
    enabled: !!effectivePositionId,
    staleTime: 60_000,
  });

  // Build fully dynamic job description from profile and matched template, overlaying official JD if saved
  const jobDescData = useMemo(() => {
    return buildDynamicJobDescription(
      profileDetails,
      matchedTemplate,
      isAr ? "المدير المباشر" : "Direct Manager",
      savedJobDescription
    );
  }, [profileDetails, matchedTemplate, savedJobDescription, isAr]);

  // Compute scorecard values dynamically from matched template criteria or default KPI set
  const kpiRows = useMemo(() => {
    const scores = (evaluation?.scores as Record<string, any>) || {};

    if (matchedTemplate?.items && matchedTemplate.items.length > 0) {
      return matchedTemplate.items.map((it: any, index: number) => {
        const crit = it.criterion;
        const cid = crit?.id || it.criterion_id || String(index + 1);
        const saved = scores[String(cid)] || scores[cid] || scores[String(index + 1)] || {};

        return {
          kpi: {
            id: index + 1,
            category: crit?.category || "technical",
            category_ar:
              crit?.category === "safety"
                ? "السلامة المهنية"
                : crit?.category === "quality"
                ? "الجودة والامتثال"
                : crit?.category === "productivity"
                ? "الإنتاجية والإنجاز"
                : crit?.category === "behavioral"
                ? "السلوك المهني"
                : "التنفيذ الفني والتخصصي",
            name: crit?.name_en || `Metric ${index + 1}`,
            name_ar: crit?.name_ar || crit?.name_en || `معيار ${index + 1}`,
            definition: crit?.description_en || crit?.how_measured_en || "",
            definition_ar: crit?.description_ar || crit?.how_measured_ar || "",
            weight: Number(it.weight || crit?.default_weight || 0.1),
            target: Number(it.target_benchmark ? it.target_benchmark / 100 : 1.0),
            unit: it.unit || crit?.unit || "%",
          },
          q1: saved?.q1 || { actual: null, achievement: null, score: null },
          q2: saved?.q2 || { actual: null, achievement: null, score: null },
          q3: saved?.q3 || { actual: null, achievement: null, score: null },
          q4: saved?.q4 || { actual: null, achievement: null, score: null },
          annualScore: saved?.annualScore ?? null,
        };
      });
    }

    return LIGHT_CURRENT_ENGINEER_KPIS.map((kpi) => {
      const saved = scores[String(kpi.id)] || scores[kpi.id];
      return {
        kpi,
        q1: saved?.q1 || { actual: null, achievement: null, score: null },
        q2: saved?.q2 || { actual: null, achievement: null, score: null },
        q3: saved?.q3 || { actual: null, achievement: null, score: null },
        q4: saved?.q4 || { actual: null, achievement: null, score: null },
        annualScore: saved?.annualScore ?? null,
      };
    });
  }, [evaluation, matchedTemplate]);

  // Quarterly summary totals
  const summaryTotals = useMemo(() => {
    let q1Sum = 0;
    let q2Sum = 0;
    let q3Sum = 0;
    let q4Sum = 0;
    let annualSum = 0;
    let hasData = false;

    kpiRows.forEach((row) => {
      if (row.q1.score !== null) { q1Sum += row.q1.score; hasData = true; }
      if (row.q2.score !== null) { q2Sum += row.q2.score; hasData = true; }
      if (row.q3.score !== null) { q3Sum += row.q3.score; hasData = true; }
      if (row.q4.score !== null) { q4Sum += row.q4.score; hasData = true; }
      if (row.annualScore !== null) { annualSum += row.annualScore; hasData = true; }
    });

    const completedQuarters = [q1Sum, q2Sum, q3Sum, q4Sum].filter((_, idx) =>
      kpiRows.some((r) => (idx === 0 ? r.q1 : idx === 1 ? r.q2 : idx === 2 ? r.q3 : r.q4).score !== null)
    );
    const completedQuartersCount = completedQuarters.length;
    const trueAnnualAvg = completedQuartersCount > 0
      ? completedQuarters.reduce((a, b) => a + b, 0) / completedQuartersCount
      : (annualSum > 0 ? annualSum : 0);

    return {
      q1Score: q1Sum,
      q2Score: q2Sum,
      q3Score: q3Sum,
      q4Score: q4Sum,
      annualWeightedSum: trueAnnualAvg,
      completedQuartersCount,
      hasData,
    };
  }, [kpiRows]);

  const ratingTier = useMemo(() => {
    return getRatingFromScore(summaryTotals.annualWeightedSum, summaryTotals.hasData);
  }, [summaryTotals.annualWeightedSum, summaryTotals.hasData]);

  const fmtPercent = (val: number | null | undefined, decimals = 1): string => {
    if (val === null || val === undefined) return "—";
    return `${(val * 100).toFixed(decimals)}%`;
  };

  const handleExport = async () => {
    if (!evaluation) {
      toast.info(isAr ? "لا يوجد تقييم معتمد للتصدير" : "No finalized evaluation to export");
      return;
    }

    const stateMap: Record<number, KpiRowState> = {};
    kpiRows.forEach((r) => {
      stateMap[r.kpi.id] = {
        id: r.kpi.id,
        targetAnnual: r.kpi.target,
        q1: r.q1,
        q2: r.q2,
        q3: r.q3,
        q4: r.q4,
        annualScore: r.annualScore,
      };
    });

    await exportKpiEvaluationToExcel({
      employeeName: session?.name || profileDetails?.full_name || "Employee",
      employeeCode: profileDetails?.emp_code || "",
      evaluatorName: evaluation.evaluator_name || profileDetails?.manager || "Manager",
      evaluationState: stateMap,
      notes: evaluation.notes || { strengths: "", growthAreas: "", recommendations: "" },
      year: selectedYear,
      department: profileDetails?.department || (evaluation.employee as any)?.department?.name_en || "Engineering",
      jobTitle: profileDetails?.position || (evaluation.employee as any)?.position?.name_en || "Site Engineer",
    });
    toast.success(isAr ? "تم تصدير ملف التقييم بنجاح" : "KPI scorecard exported to Excel");
  };

  const rawStatus = (evaluation?.status || "draft").toLowerCase();

  const quartersList = [
    { q: "q1", label: "Q1", label_ar: "الربع الأول", date: isAr ? "يناير – مارس" : "Jan – Mar", score: summaryTotals.q1Score, target: 0.25 },
    { q: "q2", label: "Q2", label_ar: "الربع الثاني", date: isAr ? "أبريل – يونيو" : "Apr – Jun", score: summaryTotals.q2Score, target: 0.25 },
    { q: "q3", label: "Q3", label_ar: "الربع الثالث", date: isAr ? "يوليو – سبتمبر" : "Jul – Sep", score: summaryTotals.q3Score, target: 0.25 },
    { q: "q4", label: "Q4", label_ar: "الربع الرابع", date: isAr ? "أكتوبر – ديسمبر" : "Oct – Dec", score: summaryTotals.q4Score, target: 0.25 },
  ] as const;

  return (
    <div dir={dir} className="space-y-4 pb-16 print:p-0 print:space-y-3">
      {/* Top Header / Back Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <Link
          to="/employee"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          {dir === "rtl" ? (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          ) : (
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          )}
          <span>{isAr ? "الرئيسية" : "Dashboard"}</span>
        </Link>

        {/* Year Selector & Export */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-input bg-background px-2.5 py-1 text-xs font-semibold shadow-2xs focus:ring-1 focus:ring-brand"
          >
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear + 1}>{currentYear + 1}</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-7.5 rounded-xl gap-1 text-xs px-2.5 cursor-pointer"
            title={isAr ? "تصدير إكسيل" : "Export Excel"}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{isAr ? "إكسيل" : "Excel"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-7.5 rounded-xl gap-1 text-xs px-2 cursor-pointer"
            title={isAr ? "طباعة" : "Print"}
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── 2 MAIN TABS: JOB DESCRIPTION & KPIS RECORDS ── */}
      <Tabs
        value={mainTab}
        onValueChange={(val) => setMainTab(val as "job_description" | "kpis_records")}
        className="space-y-4"
      >
        <div className="border-b border-border pb-2 px-1">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-muted/60 border border-border/50 shadow-2xs h-auto">
            <TabsTrigger
              value="job_description"
              className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
            >
              <Briefcase className="h-4 w-4 text-brand" />
              <span>{isAr ? "الوصف الوظيفي" : "Job Description"}</span>
            </TabsTrigger>
            <TabsTrigger
              value="kpis_records"
              className="rounded-xl py-2.5 text-xs sm:text-sm font-bold gap-2 cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
            >
              <Award className="h-4 w-4 text-brand" />
              <span>{isAr ? "سجلات مؤشرات الأداء" : "KPIs Records"}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 1: JOB DESCRIPTION (الوصف الوظيفي الديناميكي) ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="job_description" className="space-y-4">
          {/* Position Identity Card */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-brand/5 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand shadow-2xs">
                  <Briefcase className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-base sm:text-xl font-bold tracking-tight text-foreground">
                      {isAr ? jobDescData.positionTitleAr : jobDescData.positionTitleEn}
                    </h1>
                    <Badge variant="outline" className="text-[11px] font-semibold text-brand border-brand/30 bg-brand/5">
                      {jobDescData.jobGrade}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {isAr ? jobDescData.positionTitleEn : jobDescData.positionTitleAr}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white text-[10px] gap-1 px-2.5 py-0.5 font-semibold">
                  <ShieldCheck className="h-3 w-3" />
                  {isAr ? "وظيفة معتمدة" : "Active Role"}
                </Badge>
              </div>
            </div>

            {/* Role Attributes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-border/60">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-brand" />
                  <span>{isAr ? "القسم" : "Department"}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-foreground mt-1 truncate">
                  {isAr ? jobDescData.departmentNameAr : jobDescData.departmentNameEn}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <UserCog className="h-3.5 w-3.5 text-brand" />
                  <span>{isAr ? "المدير المباشر" : "Direct Manager"}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-foreground mt-1 truncate" title={jobDescData.managerName}>
                  {jobDescData.managerName}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <IdCard className="h-3.5 w-3.5 text-brand" />
                  <span>{isAr ? "كود الموظف" : "Employee Code"}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold font-mono text-foreground mt-1 truncate">
                  {jobDescData.employeeCode}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-brand" />
                  <span>{isAr ? "نوع التعاقد" : "Contract"}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-foreground mt-1 truncate">
                  {jobDescData.contractType}
                </p>
              </div>
            </div>
          </div>

          {/* Job Purpose & Summary */}
          <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                <Compass className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  {isAr ? "الهدف العام ونطاق الدور الوظيفي" : "Job Purpose & Operational Scope"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "المهام المحورية والمسؤولية التشغيلية في المنظمة" : "Primary mission, reporting framework, and core objectives"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed text-foreground">
              <p>{isAr ? jobDescData.purposeAr : jobDescData.purposeEn}</p>
            </div>
          </div>

          {/* Key Operational Duties & Responsibilities (Dynamic Pillars) */}
          <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
              <div className="flex items-start sm:items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <CheckCheck className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight">
                    {isAr ? "المهام والمسؤوليات الرئيسية" : "Core Duties & Key Result Areas"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    {isAr ? "المسؤوليات اليومية والتنفيذية المحددة لشاغل الوظيفة" : "Operational deliverables and day-to-day responsibilities"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <Badge variant="secondary" className="text-[11px] font-medium px-2.5 py-0.5">
                  {jobDescData.pillars.length} {isAr ? "محاور رئيسية" : "Pillars"}
                </Badge>
                <Badge variant="outline" className="text-[11px] font-medium px-2.5 py-0.5">
                  {jobDescData.totalMetricsCount} {isAr ? "مؤشرات عمل" : "Duties"}
                </Badge>
              </div>
            </div>

            {/* Stacked Pillars Flow */}
            <div className="space-y-3">
              {jobDescData.pillars.map((pillar) => {
                const isCollapsed = !!collapsedPillars[pillar.number];

                const themeStyles = {
                  emerald: {
                    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
                    border: "border-emerald-500/20 hover:border-emerald-500/40",
                    bg: "bg-emerald-500/[0.02]",
                    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  },
                  blue: {
                    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
                    border: "border-blue-500/20 hover:border-blue-500/40",
                    bg: "bg-blue-500/[0.02]",
                    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  },
                  purple: {
                    badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
                    border: "border-purple-500/20 hover:border-purple-500/40",
                    bg: "bg-purple-500/[0.02]",
                    iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                  },
                  amber: {
                    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
                    border: "border-amber-500/20 hover:border-amber-500/40",
                    bg: "bg-amber-500/[0.02]",
                    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  },
                  rose: {
                    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
                    border: "border-rose-500/20 hover:border-rose-500/40",
                    bg: "bg-rose-500/[0.02]",
                    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                  },
                  teal: {
                    badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
                    border: "border-teal-500/20 hover:border-teal-500/40",
                    bg: "bg-teal-500/[0.02]",
                    iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
                  },
                  indigo: {
                    badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
                    border: "border-indigo-500/20 hover:border-indigo-500/40",
                    bg: "bg-indigo-500/[0.02]",
                    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
                  },
                }[pillar.color] || {
                  badge: "bg-primary/10 text-primary border-primary/20",
                  border: "border-border hover:border-primary/30",
                  bg: "bg-muted/10",
                  iconBg: "bg-brand/10 text-brand",
                };

                return (
                  <div
                    key={pillar.number}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${themeStyles.border} ${themeStyles.bg}`}
                  >
                    {/* Pillar Card Header (Collapsible trigger) */}
                    <button
                      type="button"
                      onClick={() => togglePillar(pillar.number)}
                      className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-start hover:bg-muted/30 transition-colors focus:outline-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold border ${themeStyles.badge}`}
                        >
                          {pillar.number}
                        </span>
                        <h4 className="font-semibold text-xs sm:text-sm text-foreground leading-snug">
                          {isAr ? pillar.titleAr : pillar.titleEn}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-background/60">
                          {pillar.duties.length} {isAr ? "مهام" : "Duties"}
                        </Badge>
                        <div className="text-muted-foreground">
                          {isCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Duty Items List */}
                    {!isCollapsed && (
                      <div className="px-3 pb-3 sm:px-3.5 sm:pb-3.5 pt-1 space-y-2">
                        {pillar.duties.map((duty) => (
                          <div
                            key={duty.id}
                            className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full mt-0.5 ${themeStyles.iconBg}`}>
                                <Check className="h-3 w-3" />
                              </span>
                              <div className="space-y-1 min-w-0 flex-1">
                                <p className="font-semibold text-xs sm:text-sm text-foreground leading-snug">
                                  {isAr ? duty.nameAr : duty.nameEn}
                                </p>
                                {(isAr ? duty.descriptionAr : duty.descriptionEn) && (
                                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                                    {isAr ? duty.descriptionAr : duty.descriptionEn}
                                  </p>
                                )}
                                {duty.benchmark && (
                                  <div className="pt-0.5">
                                    <span className="inline-flex items-center gap-1 font-mono text-[10px] sm:text-[11px] font-medium text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md">
                                      <span className="opacity-70">{isAr ? "المستهدف:" : "Target:"}</span>
                                      <span className="font-semibold">{duty.benchmark}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Competencies Matrix & Performance Weighting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Competencies */}
            <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {isAr ? "مصفوفة الجدارات والمهارات" : "Competencies & Skills"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? "المعايير الفنية والسلوكية المطلوبة" : "Required technical and behavioral capabilities"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    {isAr ? "الجدارات الفنية التخصصية" : "Technical Skills"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {jobDescData.technicalCompetencies.map((comp, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[11px] font-medium">
                        {isAr ? comp.ar : comp.en}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    {isAr ? "الجدارات السلوكية والقيادية" : "Behavioral Competencies"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {jobDescData.behavioralCompetencies.map((comp, idx) => (
                      <Badge key={idx} variant="outline" className="text-[11px] font-medium">
                        {isAr ? comp.ar : comp.en}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Model Weighting */}
            <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {isAr ? "هيكل تقييم مؤشرات الأداء (KPIs)" : "KPI Evaluation Architecture"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? "توزيع أوزان التقييم المعتمدة للدور" : "Official evaluation weight distribution"}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {isAr ? "الجدارات المشتركة والسلوكية" : "Common & Behavioral Competencies"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isAr ? "الانضباط، السلامة، والتواصل" : "Discipline, safety, and teamwork"}
                    </p>
                  </div>
                  <Badge className="bg-brand text-brand-foreground font-mono text-xs px-2.5 py-0.5">
                    {jobDescData.commonWeightPct}%
                  </Badge>
                </div>

                <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {isAr ? "الأهداف التخصصية والتنفيذ الفني" : "Role-Specific Technical Execution"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isAr ? "مخرجات العمل، التسليم، والجودة" : "Site deliverables, milestones & quality"}
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-mono text-xs px-2.5 py-0.5">
                    {jobDescData.positionWeightPct}%
                  </Badge>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{isAr ? "دورة التقييم: ربع سنوية (Q1, Q2, Q3, Q4)" : "Cycle: Quarterly (Q1, Q2, Q3, Q4)"}</span>
                  <span className="font-bold text-foreground">
                    {isAr ? `إجمالي المعايير: ${jobDescData.totalMetricsCount}` : `Total Metrics: ${jobDescData.totalMetricsCount}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sections from Official JD: Relationships & Authority & Career Path */}
          {(jobDescData.internalRelations || jobDescData.externalRelations || (jobDescData.authority && jobDescData.authority.length > 0) || (jobDescData.careerPath && jobDescData.careerPath.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* § 6 Relationships & § 7 Authority */}
              {(jobDescData.internalRelations || jobDescData.externalRelations || (jobDescData.authority && jobDescData.authority.length > 0)) && (
                <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Shield className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {isAr ? "نطاق الصلاحيات والتواصل" : "Relationships & Authority"}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {isAr ? "حدود الصلاحيات الممنوحة وقنوات التواصل الرسمية" : "Internal/external comms & authorized mandate"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1 text-xs">
                    {jobDescData.internalRelations && (
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                          {isAr ? "التواصل الداخلي" : "Internal Communications"}
                        </span>
                        <p className="text-foreground">{jobDescData.internalRelations}</p>
                      </div>
                    )}
                    {jobDescData.externalRelations && (
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                          {isAr ? "التواصل الخارجي" : "External Communications"}
                        </span>
                        <p className="text-foreground">{jobDescData.externalRelations}</p>
                      </div>
                    )}
                    {jobDescData.authority && jobDescData.authority.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          {isAr ? "صلاحيات شاغل الوظيفة" : "Authority of Job Holder"}
                        </span>
                        <ul className="space-y-1 text-muted-foreground">
                          {jobDescData.authority.map((auth, aIdx) => (
                            <li key={aIdx} className="flex items-start gap-1.5">
                              <Check className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                              <span className="text-foreground">{auth}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* § 8 Career Path */}
              {jobDescData.careerPath && jobDescData.careerPath.length > 0 && (
                <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {isAr ? "المسار الوظيفي والترقي" : "Career Path"}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {isAr ? "التدرج والنمو المهني المتوقع للدور" : "Professional progression and development milestones"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex flex-col gap-1.5">
                      {jobDescData.careerPath.map((step, idx) => {
                        const isCurrent = step.toLowerCase().includes(jobDescData.positionTitleEn.toLowerCase()) || idx === 1;
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition-all ${
                              isCurrent
                                ? "border-brand/40 bg-brand/10 font-bold text-foreground"
                                : "border-border/60 bg-muted/15 text-muted-foreground"
                            }`}
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background font-mono text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="flex-1">{step}</span>
                            {isCurrent && (
                              <Badge className="bg-brand text-brand-foreground text-[9px] px-1.5 py-0">
                                {isAr ? "المستوى الحالي" : "Current"}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* § 9 Document Control Footer */}
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-foreground">
                {jobDescData.jobCode || "JD-001"} · {jobDescData.docVersion || "v1.0"}
              </span>
              {jobDescData.isOfficialSavedJd && (
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  {isAr ? "معتمد رسمياً" : "Official Approved JD"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {jobDescData.reviewedBy && <span>{isAr ? "مراجعة: " : "Reviewed by: "}<strong className="text-foreground">{jobDescData.reviewedBy}</strong></span>}
              {jobDescData.approvedBy && <span>{isAr ? "اعتماد: " : "Approved by: "}<strong className="text-foreground">{jobDescData.approvedBy}</strong></span>}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 2: KPIS RECORDS (سجلات مؤشرات الأداء) ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="kpis_records" className="space-y-4">
          {/* Hero Performance Card */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-brand/5 p-4 sm:p-5 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                    <Award className="h-3.5 w-3.5" />
                    {isAr ? "الأداء ومؤشرات الأداء" : "Performance and KPIs"}
                  </span>
                  {rawStatus === "approved" ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] gap-1 px-2 py-0.5">
                      <ShieldCheck className="h-3 w-3" />
                      {isAr ? "معتمد" : "Approved"}
                    </Badge>
                  ) : rawStatus === "submitted" ? (
                    <Badge className="bg-blue-600 text-white text-[10px] gap-1 px-2 py-0.5">
                      <Clock className="h-3 w-3" />
                      {isAr ? "بانتظار المراجعة" : "Pending HR"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1 px-2 py-0.5">
                      <Clock className="h-3 w-3" />
                      {isAr ? "مسودة" : "Draft"}
                    </Badge>
                  )}
                </div>
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {isAr ? `تقرير الأداء السنوي لعام ${selectedYear}` : `Annual Performance — Year ${selectedYear}`}
                </h2>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {isAr
                    ? "متابعة نتائج التقييم الفصلي والأداء السنوي وسجل المعايير"
                    : "Quarterly and annual performance evaluation results and records"}
                </p>
              </div>
            </div>

            {/* Score & Progress */}
            <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-foreground">
                    {summaryTotals.hasData ? fmtPercent(summaryTotals.annualWeightedSum, 1) : "—"}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground font-mono">
                    / 100%
                  </span>
                </div>

                <div className="h-6 w-px bg-border hidden xs:block" />

                <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-mono text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-brand" />
                  <span>
                    {summaryTotals.completedQuartersCount}/4 {isAr ? "أرباع معتمدة" : "Quarters Approved"}
                  </span>
                </Badge>

                <Badge
                  variant={summaryTotals.hasData ? "default" : "outline"}
                  className={`text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5 ${
                    summaryTotals.hasData
                      ? ratingTier.badgeClass
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {summaryTotals.hasData ? (
                    <>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: ratingTier.color }}
                      />
                      <span>{isAr ? ratingTier.tier_ar : ratingTier.tier}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      <span>
                        {rawStatus === "submitted"
                          ? isAr
                            ? "بانتظار الاعتماد"
                            : "Under Review"
                          : isAr
                          ? "بانتظار التقييم"
                          : "Pending Evaluation"}
                      </span>
                    </>
                  )}
                </Badge>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[190px] space-y-1.5">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span className="font-medium">{isAr ? "الإنجاز السنوي" : "Annual Progress"}</span>
                  <span className="font-mono font-bold text-foreground">
                    {summaryTotals.hasData ? fmtPercent(summaryTotals.annualWeightedSum, 1) : "0.0%"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, (summaryTotals.annualWeightedSum || 0) * 100))}%`,
                      backgroundColor: summaryTotals.hasData ? ratingTier.color : "transparent",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Evaluator Sign-off Footer */}
            {evaluation?.evaluator_name && (
              <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {isAr ? "المُقيّم: " : "Evaluator: "}
                  <strong className="text-foreground">{evaluation.evaluator_name}</strong>
                </span>
                {evaluation.approved_at && (
                  <span className="text-emerald-600 font-mono text-[10px]">
                    {isAr ? "معتمد في " : "Approved on "}
                    {new Date(evaluation.approved_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sub-Tabs Navigation for Records */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar border-b border-border/60 pb-2">
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setKpiSubTab("quarters")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    kpiSubTab === "quarters"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{isAr ? "النتائج الفصلية" : "Quarterly Results"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKpiSubTab("scorecard")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    kpiSubTab === "scorecard"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>{isAr ? "سجل المعايير والدرجات" : "Scorecard"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKpiSubTab("feedback")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    kpiSubTab === "feedback"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isAr ? "ملاحظات المدير" : "Feedback"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKpiSubTab("history")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    kpiSubTab === "history"
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{isAr ? "السجل" : "History"}</span>
                </button>
              </div>
            </div>

            {/* Sub-view 1: Quarters */}
            {kpiSubTab === "quarters" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {quartersList.map((item) => {
                  const isCompleted = item.score !== null;
                  const progress = item.score !== null ? Math.min(100, Math.round((item.score / item.target) * 100)) : 0;

                  return (
                    <div
                      key={item.q}
                      className="rounded-3xl border border-border bg-card p-4 shadow-2xs space-y-3 transition-all hover:border-border/80"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand/10 font-display font-extrabold text-sm text-brand">
                            {item.label}
                          </span>
                          <div>
                            <h4 className="font-bold text-xs text-foreground">
                              {isAr ? item.label_ar : `${item.label} Quarter`}
                            </h4>
                            <p className="text-[10px] text-muted-foreground">{item.date}</p>
                          </div>
                        </div>
                        <Badge
                          variant={isCompleted ? "default" : "outline"}
                          className={`text-[10px] px-2 py-0.5 font-semibold ${
                            isCompleted
                              ? "bg-emerald-600 text-white"
                              : "text-muted-foreground border-border"
                          }`}
                        >
                          {isCompleted ? (isAr ? "معتمد" : "Approved") : (isAr ? "قيد التقييم" : "Pending Review")}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/30 p-2.5 text-center border border-border/50">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            {isAr ? "الهدف" : "Target"}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">25.0%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            {isAr ? "الدرجة المحققة" : "Score"}
                          </span>
                          <span className="font-mono text-xs font-bold text-brand">
                            {item.score !== null ? fmtPercent(item.score, 1) : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            {isAr ? "نسبة الاستيفاء" : "Attainment"}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {item.score !== null ? `${progress}%` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 pt-0.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>{isAr ? "التقدم الفصلي" : "Quarterly Progress"}</span>
                          <span className="font-mono font-bold text-foreground">{progress}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress >= 90
                                ? "bg-emerald-500"
                                : progress >= 75
                                ? "bg-blue-500"
                                : progress >= 60
                                ? "bg-amber-500"
                                : progress > 0
                                ? "bg-rose-500"
                                : "bg-transparent"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-view 2: Scorecard & Detailed Criteria Records */}
            {kpiSubTab === "scorecard" && (
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {isAr ? "سجل بطاقة الأداء والمعايير المعتمدة" : "Detailed Criteria Scorecard"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isAr
                        ? "جميع معايير التقييم وأوزانها والأهداف ودرجة الإنجاز"
                        : "All assigned evaluation metrics, weights, targets, and quarterly actuals"}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {kpiRows.length} {isAr ? "معيار" : "Metrics"}
                  </Badge>
                </div>

                <div className="divide-y divide-border/60 rounded-2xl border border-border/80 overflow-hidden">
                  {kpiRows.map((row) => (
                    <div key={row.kpi.id} className="p-3 sm:p-4 hover:bg-muted/15 transition-colors space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-lg">
                              KPI-{String(row.kpi.id).padStart(2, "0")}
                            </span>
                            <h4 className="font-bold text-xs sm:text-sm text-foreground">
                              {isAr ? row.kpi.name_ar : row.kpi.name}
                            </h4>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {isAr ? row.kpi.definition_ar : row.kpi.definition}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {isAr ? "الوزن: " : "Weight: "} {(row.kpi.weight * 100).toFixed(0)}%
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {isAr ? "الهدف: " : "Target: "} {(row.kpi.target * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>

                      {/* Quarters mini scores row */}
                      <div className="grid grid-cols-5 gap-1.5 pt-1 text-center font-mono text-[10px]">
                        <div className="rounded-xl bg-muted/30 p-1.5">
                          <span className="text-muted-foreground block text-[9px]">Q1</span>
                          <span className="font-bold text-foreground">
                            {row.q1.score !== null ? fmtPercent(row.q1.score, 1) : "—"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-1.5">
                          <span className="text-muted-foreground block text-[9px]">Q2</span>
                          <span className="font-bold text-foreground">
                            {row.q2.score !== null ? fmtPercent(row.q2.score, 1) : "—"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-1.5">
                          <span className="text-muted-foreground block text-[9px]">Q3</span>
                          <span className="font-bold text-foreground">
                            {row.q3.score !== null ? fmtPercent(row.q3.score, 1) : "—"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-1.5">
                          <span className="text-muted-foreground block text-[9px]">Q4</span>
                          <span className="font-bold text-foreground">
                            {row.q4.score !== null ? fmtPercent(row.q4.score, 1) : "—"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-brand/10 p-1.5 text-brand">
                          <span className="block text-[9px] font-bold">{isAr ? "السنوي" : "Annual"}</span>
                          <span className="font-bold">
                            {row.annualScore !== null ? fmtPercent(row.annualScore, 1) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-view 3: Qualitative Feedback */}
            {kpiSubTab === "feedback" && (
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {isAr ? "ملاحظات وتوجيهات المدير المباشر" : "Supervisor Qualitative Feedback"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "نقاط القوة، مجالات التحسين، والدورات الموصى بها."
                      : "Documented site strengths, growth areas, and milestone training."}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {isAr ? "1. نقاط القوة الفنية وأبرز الإنجازات الميدانية" : "1. Key Technical Strengths & Notable Site Deliveries"}
                    </span>
                    <p className="text-xs leading-relaxed text-foreground">
                      {evaluation?.notes?.strengths || (isAr ? "لم يتم تسجيل ملاحظات بعد." : "No strengths recorded yet.")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      {isAr ? "2. مجالات التطوير الفني وتحسين كفاءة التنفيذ" : "2. Areas for Technical Development & Optimization"}
                    </span>
                    <p className="text-xs leading-relaxed text-foreground">
                      {evaluation?.notes?.growthAreas || (isAr ? "لم يتم تسجيل مجالات تطوير بعد." : "No growth areas recorded yet.")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                      {isAr ? "3. الشهادات والدورات الموصى بها" : "3. Recommended Training & Next Milestones"}
                    </span>
                    <p className="text-xs leading-relaxed text-foreground">
                      {evaluation?.notes?.recommendations || (isAr ? "لم يتم تحديد دورات إضافية بعد." : "No recommended training recorded yet.")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-view 4: Evaluation History */}
            {kpiSubTab === "history" && (
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {isAr ? "سجل تقييمات الأداء عبر السنوات" : "Performance Evaluations History"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "جميع بطاقات تقييم مؤشرات الأداء المعتمدة الخاصة بك."
                      : "All official performance reviews and historical archives."}
                  </p>
                </div>

                <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                  {allEvaluations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      {isAr ? "لا توجد تقييمات سابقة محفوظة في سجلك." : "No past evaluations found in your archive."}
                    </div>
                  ) : (
                    allEvaluations.map((ev) => (
                      <div
                        key={ev.id}
                        className={`flex items-center justify-between p-3.5 transition-colors ${
                          ev.evaluation_year === selectedYear ? "bg-brand/5 font-semibold" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">
                              {isAr ? `تقييم عام ${ev.evaluation_year}` : `Year ${ev.evaluation_year}`}
                            </span>
                            {ev.evaluation_year === selectedYear && (
                              <Badge className="bg-brand text-brand-foreground text-[9px] px-1.5 py-0">
                                {isAr ? "الحالي" : "Current"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {ev.evaluator_name ? `${isAr ? "المُقيّم: " : "By: "}${ev.evaluator_name}` : "—"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="text-end">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {ev.summary?.totalScore ? `${ev.summary.totalScore}%` : "—"}
                            </span>
                            <p className="text-[9px] text-muted-foreground">{ev.summary?.rating || "—"}</p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedYear(ev.evaluation_year)}
                            className="rounded-xl text-xs h-7 px-2 cursor-pointer"
                          >
                            {isAr ? "فتح" : "View"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
