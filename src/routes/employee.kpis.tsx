import React, { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  Calendar,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Clock,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  FileText,
  Target,
  UserCog,
  Building2,
  Sparkles,
  CheckCheck,
  Check,
  FileCheck,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Users,
  Shield,
  TrendingUp,
  MapPin,
  FileDown,
  Eye,
  User,
  Search,
  Loader2,
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
import { exportJobDescriptionPdf } from "@/lib/kpi/jd-pdf-export";
import { exportKpiDefinitionPdf } from "@/lib/kpi/kpi-definition-pdf-export";
import {
  getMyKpiEvaluation,
  listMyKpiEvaluations,
  matchKpiTemplate,
  getQuarterlyEvaluation,
} from "@/backend/functions/kpi-evaluations.functions";
import { getMyProfileDetails } from "@/backend/functions/auth.functions";
import { buildDynamicJobDescription } from "@/lib/kpi/dynamic-job-description";
import { JD_SELECT_COLUMNS, type SavedJobDescription } from "@/lib/job-descriptions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type EmpKpiQuarter = { actual: number | null; achievement: number | null; score: number | null };

type EmpKpiRow = {
  kpi: {
    id: number;
    category: string;
    category_ar: string;
    name: string;
    name_ar: string;
    definition: string;
    definition_ar: string;
    weight: number;
    target: number;
    unit: string;
  };
  q1: EmpKpiQuarter;
  q2: EmpKpiQuarter;
  q3: EmpKpiQuarter;
  q4: EmpKpiQuarter;
  annualScore: number | null;
};

export const Route = createFileRoute("/employee/kpis")({
  component: EmployeeKpiPage,
});

export function EmployeeKpiPage() {
  const { isAr, dir } = useI18n();
  const session = useSession();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [mainTab, setMainTab] = useState<"job_description" | "kpis_records" | "kpis_definition">("job_description");
  const [kpiSubTab, setKpiSubTab] = useState<"quarters" | "scorecard" | "feedback" | "history">("quarters");
  const [collapsedPillars, setCollapsedPillars] = useState<Record<string, boolean>>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingKpiDefPdf, setIsExportingKpiDefPdf] = useState(false);

  const togglePillar = (num: string) => {
    setCollapsedPillars((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const getMyKpiFn = useServerFn(getMyKpiEvaluation);
  const listMyKpisFn = useServerFn(listMyKpiEvaluations);
  const getProfileFn = useServerFn(getMyProfileDetails);
  const matchTemplateFn = useServerFn(matchKpiTemplate);
  const getQuarterlyFn = useServerFn(getQuarterlyEvaluation);

  // Fetch current year evaluation
  const { data: evaluation } = useQuery({
    queryKey: ["my-kpi-evaluation", selectedYear],
    queryFn: () => getMyKpiFn({ data: { year: selectedYear } }),
    enabled: !!session,
  });

  // Fetch real quarterly evaluations (approved) from kpi_quarterly_evaluations
  const empId = session?.employeeId;
  const { data: q1Eval } = useQuery({
    queryKey: ["my-quarterly-eval", empId, selectedYear, "q1"],
    queryFn: () => getQuarterlyFn({ data: { employeeId: empId!, year: selectedYear, quarter: "q1" } }),
    enabled: !!empId,
  });
  const { data: q2Eval } = useQuery({
    queryKey: ["my-quarterly-eval", empId, selectedYear, "q2"],
    queryFn: () => getQuarterlyFn({ data: { employeeId: empId!, year: selectedYear, quarter: "q2" } }),
    enabled: !!empId,
  });
  const { data: q3Eval } = useQuery({
    queryKey: ["my-quarterly-eval", empId, selectedYear, "q3"],
    queryFn: () => getQuarterlyFn({ data: { employeeId: empId!, year: selectedYear, quarter: "q3" } }),
    enabled: !!empId,
  });
  const { data: q4Eval } = useQuery({
    queryKey: ["my-quarterly-eval", empId, selectedYear, "q4"],
    queryFn: () => getQuarterlyFn({ data: { employeeId: empId!, year: selectedYear, quarter: "q4" } }),
    enabled: !!empId,
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

  // Fetch template specified directly in the evaluation (if template_type is a UUID)
  const evalTemplateId =
    evaluation?.template_type && evaluation.template_type.length > 20
      ? evaluation.template_type
      : null;
  const { data: evalTemplate } = useQuery({
    queryKey: ["evaluation-linked-template", evalTemplateId],
    queryFn: async () => {
      if (!evalTemplateId) return null;
      try {
        const { data, error } = await supabase
          .from("kpi_templates" as any)
          .select(`
            *,
            items:kpi_template_items(
              id,
              criterion_id,
              weight,
              target_benchmark,
              scoring_direction,
              unit,
              display_order,
              criterion:kpi_criteria(*)
            )
          `)
          .eq("id", evalTemplateId)
          .maybeSingle();
        if (error) return null;
        return data;
      } catch {
        return null;
      }
    },
    enabled: !!evalTemplateId,
  });

  const effectiveTemplate = (matchedTemplate?.items?.length ? matchedTemplate : evalTemplate) || null;

  // Fetch official saved job description from position_job_descriptions if available
  const effectivePositionId =
    profileDetails?.position_id ||
    (effectiveTemplate as any)?.position_id ||
    (effectiveTemplate as any)?.position?.id;

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
      effectiveTemplate,
      isAr ? "المدير المباشر" : "Direct Manager",
      savedJobDescription
    );
  }, [profileDetails, effectiveTemplate, savedJobDescription, isAr]);

  // Compute scorecard values dynamically from matched template criteria or default KPI set.
  // Also merges per-criterion scores from quarterly evaluation items when kpi_evaluations.scores is empty.
  const kpiRows = useMemo<EmpKpiRow[]>(() => {
    const scores = (evaluation?.scores as Record<string, any>) || {};

    // Build a lookup of criterion scores from quarterly items (q1..q4)
    // keyed by criterion_id or display_order index (1-based)
    const qItemsMap: Record<string, { q1: EmpKpiQuarter; q2: EmpKpiQuarter; q3: EmpKpiQuarter; q4: EmpKpiQuarter }> = {};
    const mergeItems = (qEval: typeof q1Eval | typeof q2Eval | typeof q3Eval | typeof q4Eval, qKey: "q1" | "q2" | "q3" | "q4") => {
      if (!qEval || qEval.status === "draft") return;
      const items = (qEval as any).items as any[] | undefined;
      if (!items) return;
      items.forEach((item: any, idx: number) => {
        const key = item.criterion_id || String(idx + 1);
        if (!qItemsMap[key]) {
          qItemsMap[key] = {
            q1: { actual: null, achievement: null, score: null },
            q2: { actual: null, achievement: null, score: null },
            q3: { actual: null, achievement: null, score: null },
            q4: { actual: null, achievement: null, score: null },
          };
        }
        qItemsMap[key][qKey] = {
          actual: item.actual_value ?? null,
          achievement: item.achievement_rate ?? null,
          score: item.weighted_score ?? null,
        };
      });
    };
    mergeItems(q1Eval, "q1");
    mergeItems(q2Eval, "q2");
    mergeItems(q3Eval, "q3");
    mergeItems(q4Eval, "q4");

    const templateItems = effectiveTemplate?.items;
    if (templateItems && templateItems.length > 0) {
      return templateItems.map((it: any, index: number) => {
        const crit = it.criterion;
        const cid = crit?.id || it.criterion_id || String(index + 1);
        const saved = scores[String(cid)] || scores[cid] || scores[String(it.id)] || scores[String(index + 1)] || {};
        // Also try quarterly items fallback
        const qFallback = qItemsMap[cid] || qItemsMap[String(it.id)] || qItemsMap[String(index + 1)] || {};

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
          q1: saved?.q1 || qFallback?.q1 || { actual: null, achievement: null, score: null },
          q2: saved?.q2 || qFallback?.q2 || { actual: null, achievement: null, score: null },
          q3: saved?.q3 || qFallback?.q3 || { actual: null, achievement: null, score: null },
          q4: saved?.q4 || qFallback?.q4 || { actual: null, achievement: null, score: null },
          annualScore: saved?.annualScore ?? null,
        };
      });
    }

    return LIGHT_CURRENT_ENGINEER_KPIS.map((kpi, idx) => {
      let saved = scores[String(kpi.id)] || scores[kpi.id];
      if (!saved || (saved.q1?.score === null && saved.annualScore === null)) {
        const entries = Object.entries(scores);
        if (entries[idx]) {
          saved = entries[idx][1];
        }
      }
      const qFallback = qItemsMap[String(kpi.id)] || {};
      return {
        kpi,
        q1: saved?.q1 || qFallback?.q1 || { actual: null, achievement: null, score: null },
        q2: saved?.q2 || qFallback?.q2 || { actual: null, achievement: null, score: null },
        q3: saved?.q3 || qFallback?.q3 || { actual: null, achievement: null, score: null },
        q4: saved?.q4 || qFallback?.q4 || { actual: null, achievement: null, score: null },
        annualScore: saved?.annualScore ?? null,
      };
    });
  }, [evaluation, effectiveTemplate, q1Eval, q2Eval, q3Eval, q4Eval]);

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

    const savedTotalScore = evaluation?.summary?.totalScore != null ? Number(evaluation.summary.totalScore) : null;
    if (savedTotalScore !== null && savedTotalScore > 0) {
      hasData = true;
    }

    const completedQuarters = [q1Sum, q2Sum, q3Sum, q4Sum].filter((_, idx) =>
      kpiRows.some((r) => (idx === 0 ? r.q1 : idx === 1 ? r.q2 : idx === 2 ? r.q3 : r.q4).score !== null)
    );
    const completedQuartersCount = completedQuarters.length;

    let trueAnnualAvg = 0;
    if (completedQuartersCount > 0) {
      trueAnnualAvg = completedQuarters.reduce((a, b) => a + b, 0) / completedQuartersCount;
    } else if (annualSum > 0) {
      trueAnnualAvg = annualSum;
    } else if (savedTotalScore !== null) {
      trueAnnualAvg = savedTotalScore > 1 ? savedTotalScore / 100 : savedTotalScore;
    }

    return {
      q1Score: q1Sum,
      q2Score: q2Sum,
      q3Score: q3Sum,
      q4Score: q4Sum,
      annualWeightedSum: trueAnnualAvg,
      completedQuartersCount: completedQuartersCount > 0 ? completedQuartersCount : (savedTotalScore ? 1 : 0),
      hasData,
    };
  }, [kpiRows, evaluation]);

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

  const handleDownloadMyJdPdf = async () => {
    setIsExportingPdf(true);
    try {
      const responsibilities = savedJobDescription?.responsibilities?.length
        ? savedJobDescription.responsibilities
        : jobDescData.pillars.flatMap((p) => p.duties.map((d) => d.nameEn || d.nameAr));

      await exportJobDescriptionPdf(
        {
          jobTitle: jobDescData.positionTitleEn || "Job Role",
          jobCode: jobDescData.jobCode || "JD-001",
          department: jobDescData.departmentNameEn,
          jobCategory: jobDescData.jobCategory || "Non-managerial",
          positionType: jobDescData.positionType || "Full-time",
          locationType: jobDescData.locationType || "On-site",
          jobGrade: jobDescData.jobGrade,
          reportingTo: jobDescData.managerName,
          jobSummary: jobDescData.purposeEn || jobDescData.purposeAr,
          responsibilities,
          qualifications: jobDescData.qualifications || savedJobDescription?.qualifications,
          technicalCompetencies: jobDescData.technicalCompetencies.map((c) => c.en),
          behavioralCompetencies: jobDescData.behavioralCompetencies.map((c) => c.en),
          internalRelations: jobDescData.internalRelations,
          externalRelations: jobDescData.externalRelations,
          authority: jobDescData.authority,
          careerPath: jobDescData.careerPath,
          docVersion: jobDescData.docVersion || "v1.0",
          reviewedBy: jobDescData.reviewedBy,
          approvedBy: jobDescData.approvedBy,
          commonWeightPct: jobDescData.commonWeightPct,
          positionWeightPct: jobDescData.positionWeightPct,
        },
        {
          fullName: profileDetails?.full_name || session?.name || "Employee",
          empCode: jobDescData.employeeCode,
          department: jobDescData.departmentNameEn,
          managerName: jobDescData.managerName,
          date: new Date().toISOString().slice(0, 10),
        }
      );
      toast.success(isAr ? "تم تحميل ملف الوصف الوظيفي (PDF) بنجاح" : "Job description PDF downloaded successfully");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error(isAr ? "تعذر إنشاء ملف PDF" : "Failed to generate PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadKpiDefPdf = async () => {
    setIsExportingKpiDefPdf(true);
    try {
      const rows = kpiRows.map((row, i) => {
        // Try to get howMeasured from the matchedTemplate criterion
        let howMeasured = "";
        if (matchedTemplate?.items?.length) {
          const item = (matchedTemplate.items as any[])[i];
          howMeasured =
            item?.criterion?.how_measured_en ||
            item?.criterion?.description_en ||
            "";
        } else {
          // Fallback: use definition field (LIGHT_CURRENT_ENGINEER_KPIS already has howMeasured in definition)
          howMeasured = row.kpi.definition;
        }
        return {
          id: row.kpi.id,
          category: row.kpi.category,
          name: row.kpi.name,
          definition: row.kpi.definition,
          howMeasured,
          weight: row.kpi.weight,
          target: row.kpi.target,
          unit: row.kpi.unit,
        };
      });

      await exportKpiDefinitionPdf(
        rows,
        {
          fullName: profileDetails?.full_name || session?.name || "",
          position:
            profileDetails?.position ||
            (matchedTemplate as any)?.position?.name_en ||
            "",
          department:
            profileDetails?.department ||
            (matchedTemplate as any)?.department?.name_en ||
            "",
        },
        selectedYear
      );
      toast.success(isAr ? "تم تحميل ملف مؤشرات الأداء (PDF)" : "KPI Definition PDF downloaded");
    } catch (err) {
      console.error("KPI PDF export error:", err);
      toast.error(isAr ? "تعذر إنشاء ملف PDF" : "Failed to generate PDF");
    } finally {
      setIsExportingKpiDefPdf(false);
    }
  };

  const rawStatus = (evaluation?.status || "draft").toLowerCase();

  // Real quarterly scores from either quarterly evaluations OR annual evaluation scores
  const getQuarterData = (
    qEval: typeof q1Eval | typeof q2Eval | typeof q3Eval | typeof q4Eval,
    qScore: number
  ) => {
    if (qEval && qEval.status !== "draft" && qEval.score !== null) {
      return { score: qEval.score, status: qEval.status };
    }
    if (qScore > 0) {
      return { score: Number((qScore * 100).toFixed(1)), status: rawStatus };
    }
    return { score: null, status: qEval?.status ?? null };
  };

  const q1Data = getQuarterData(q1Eval, summaryTotals.q1Score);
  const q2Data = getQuarterData(q2Eval, summaryTotals.q2Score);
  const q3Data = getQuarterData(q3Eval, summaryTotals.q3Score);
  const q4Data = getQuarterData(q4Eval, summaryTotals.q4Score);

  const quartersList = [
    {
      q: "q1", label: "Q1", label_ar: "الربع الأول",
      date: isAr ? "يناير – مارس" : "Jan – Mar",
      score: q1Data.score,
      status: q1Data.status,
      target: 25,
    },
    {
      q: "q2", label: "Q2", label_ar: "الربع الثاني",
      date: isAr ? "أبريل – يونيو" : "Apr – Jun",
      score: q2Data.score,
      status: q2Data.status,
      target: 25,
    },
    {
      q: "q3", label: "Q3", label_ar: "الربع الثالث",
      date: isAr ? "يوليو – سبتمبر" : "Jul – Sep",
      score: q3Data.score,
      status: q3Data.status,
      target: 25,
    },
    {
      q: "q4", label: "Q4", label_ar: "الربع الرابع",
      date: isAr ? "أكتوبر – ديسمبر" : "Oct – Dec",
      score: q4Data.score,
      status: q4Data.status,
      target: 25,
    },
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

        {/* Year Selector */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-xl border border-input bg-background px-2.5 py-1 text-xs font-semibold shadow-2xs focus:ring-1 focus:ring-brand"
        >
          <option value={currentYear}>{currentYear}</option>
          <option value={currentYear - 1}>{currentYear - 1}</option>
          <option value={currentYear + 1}>{currentYear + 1}</option>
        </select>
      </div>

      {/* ── 2 MAIN TABS: JOB DESCRIPTION & KPIS RECORDS ── */}
      <Tabs
        value={mainTab}
        onValueChange={(val) => setMainTab(val as "job_description" | "kpis_records" | "kpis_definition")}
        className="space-y-4"
      >
        <TabsList className="flex w-full rounded-2xl p-1 h-auto bg-muted/50 border border-border/50 shadow-2xs gap-1">
          <TabsTrigger
            value="job_description"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold cursor-pointer transition-all data-[state=active]:bg-background data-[state=active]:text-brand data-[state=active]:shadow-sm"
          >
            <Briefcase className="h-4 w-4 shrink-0" />
            <span className="truncate">{isAr ? "الوصف الوظيفي" : "Job Description"}</span>
          </TabsTrigger>
          <TabsTrigger
            value="kpis_definition"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold cursor-pointer transition-all data-[state=active]:bg-background data-[state=active]:text-brand data-[state=active]:shadow-sm"
          >
            <Target className="h-4 w-4 shrink-0" />
            <span className="truncate">{isAr ? "تعريف المؤشرات" : "KPIs Definition"}</span>
          </TabsTrigger>
          <TabsTrigger
            value="kpis_records"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold cursor-pointer transition-all data-[state=active]:bg-background data-[state=active]:text-brand data-[state=active]:shadow-sm"
          >
            <Award className="h-4 w-4 shrink-0" />
            <span className="truncate">{isAr ? "سجلات الأداء" : "KPIs Records"}</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── TAB: KPIS DEFINITION ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="kpis_definition" className="flex flex-col items-center justify-center py-12 gap-4">
          <Button
            onClick={handleDownloadKpiDefPdf}
            disabled={isExportingKpiDefPdf || kpiRows.length === 0}
            size="lg"
            className="h-12 gap-2 rounded-2xl bg-brand text-brand-foreground font-semibold shadow hover:brightness-105 px-8 text-base"
          >
            {isExportingKpiDefPdf ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileDown className="h-5 w-5" />
            )}
            {isAr ? "تحميل مؤشرات الأداء (PDF)" : "Download KPIs Definition (PDF)"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {kpiRows.length > 0 ? (
              <>
                <span className="font-mono font-bold text-foreground">{kpiRows.length}</span>
                {" "}{isAr ? "مؤشر أداء — صفحة A4 أفقية" : "KPI indicators — Landscape A4"}
              </>
            ) : (
              isAr ? "لا توجد مؤشرات أداء معرّفة بعد" : "No KPIs defined for your position yet"
            )}
          </p>
        </TabsContent>

        {/* ── TAB 1: JOB DESCRIPTION ── */}
        <TabsContent value="job_description" className="flex flex-col items-center justify-center py-12 gap-4">
          <Button
            onClick={handleDownloadMyJdPdf}
            disabled={isExportingPdf}
            size="lg"
            className="h-12 gap-2 rounded-2xl bg-brand text-brand-foreground font-semibold shadow hover:brightness-105 px-8 text-base"
          >
            {isExportingPdf ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileDown className="h-5 w-5" />
            )}
            {isAr ? "تحميل بطاقة الوصف الوظيفي (PDF)" : "Download Official JD (PDF)"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {jobDescData.jobCode && <span className="font-mono font-bold text-foreground">{jobDescData.jobCode}</span>}
            {jobDescData.jobCode && " · "}
            {jobDescData.docVersion || "v1.0"}
          </p>
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
                  {isAr ? `تقرير الأداء السنوي لعام ${selectedYear}` : `KIPS Performance — Year ${selectedYear}`}
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
                  className={`text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5 ${summaryTotals.hasData
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
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${kpiSubTab === "quarters"
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
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${kpiSubTab === "scorecard"
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
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${kpiSubTab === "feedback"
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
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${kpiSubTab === "history"
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
                  // score is 0-100 (direct from kpi_quarterly_evaluations.score)
                  const isApproved = item.status === "approved";
                  const isSubmitted = item.status === "submitted";
                  const isReturned = item.status === "returned";
                  const hasScore = item.score !== null;
                  // progress: score / target * 100 (both are 0-100)
                  const progress = hasScore ? Math.min(100, Math.round((item.score! / item.target) * 100)) : 0;

                  const badgeClass = isApproved
                    ? "bg-emerald-600 text-white"
                    : isSubmitted
                      ? "bg-blue-600 text-white"
                      : isReturned
                        ? "bg-amber-500 text-white"
                        : "text-muted-foreground border-border";

                  const badgeLabel = isApproved
                    ? (isAr ? "معتمد" : "Approved")
                    : isSubmitted
                      ? (isAr ? "بانتظار المراجعة" : "Pending Review")
                      : isReturned
                        ? (isAr ? "مُعاد" : "Returned")
                        : (isAr ? "قيد التقييم" : "Not Started");

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
                          variant={isApproved ? "default" : "outline"}
                          className={`text-[10px] px-2 py-0.5 font-semibold ${badgeClass}`}
                        >
                          {badgeLabel}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/30 p-2.5 text-center border border-border/50">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            {isAr ? "الهدف" : "Target"}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">{item.target}.0%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            {isAr ? "الدرجة المحققة" : "Score"}
                          </span>
                          <span className="font-mono text-xs font-bold text-brand">
                            {hasScore ? `${item.score!.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            {isAr ? "نسبة الاستيفاء" : "Attainment"}
                          </span>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {hasScore ? `${progress}%` : "—"}
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
                            className={`h-full rounded-full transition-all duration-500 ${progress >= 90
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
                        className={`flex items-center justify-between p-3.5 transition-colors ${ev.evaluation_year === selectedYear ? "bg-brand/5 font-semibold" : "hover:bg-muted/30"
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
