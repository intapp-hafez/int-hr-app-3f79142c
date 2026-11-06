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
  Info,
  Filter,
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
import { exportKpiDefinitionPdf, KpiDefPdfRow } from "@/lib/kpi/kpi-definition-pdf-export";
import {
  formatCategoryName,
  ScorecardItem,
} from "@/components/kpi/KpiEvaluationView";
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
  const [mainTab, setMainTab] = useState<"job_description" | "kpis_records" | "kpis_definition">("kpis_records");
  const [kpiSubTab, setKpiSubTab] = useState<"quarters" | "scorecard" | "feedback">("quarters");
  const [activeQuarterFilter, setActiveQuarterFilter] = useState<"all" | "q1" | "q2" | "q3" | "q4">("all");
  const [infoModalKpi, setInfoModalKpi] = useState<ScorecardItem | null>(null);
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

  // Priority 1: evaluation's linked template; Priority 2: matched position/role template
  const effectiveTemplate =
    evalTemplate ||
    (matchedTemplate as any)?.template ||
    (matchedTemplate as any)?.items?.length
      ? matchedTemplate
      : null;

  // Active scorecard items matching Admin/Manager KpiEvaluationView logic
  const activeScorecardItems = useMemo<ScorecardItem[]>(() => {
    const rawItems =
      (evalTemplate as any)?.items && (evalTemplate as any).items.length > 0
        ? (evalTemplate as any).items
        : (matchedTemplate as any)?.template?.items && (matchedTemplate as any).template.items.length > 0
        ? (matchedTemplate as any).template.items
        : (matchedTemplate as any)?.items && (matchedTemplate as any).items.length > 0
        ? (matchedTemplate as any).items
        : null;

    if (rawItems && rawItems.length > 0) {
      const sorted = [...rawItems].sort(
        (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );
      return sorted.map((it: any, idx: number) => {
        const crit = it.criterion || {};
        const weight =
          Number(it.weight) > 1 ? Number(it.weight) / 100 : Number(it.weight || 0);
        const target = Number(it.target_benchmark ?? crit.default_target ?? 100);
        const direction = (it.scoring_direction ||
          crit.scoring_direction ||
          "higher_is_better") as "higher_is_better" | "lower_is_better" | "rating_5";
        const unit = it.unit || crit.unit || "%";
        const inputType =
          direction === "rating_5" || unit === "scale"
            ? "rating_5"
            : unit === "%"
            ? "percentage"
            : "numeric";
        const keyId = String(it.criterion_id || crit.id || it.id || idx + 1);

        return {
          id: keyId,
          numericIndex: idx + 1,
          code: crit.code || `KPI-${idx + 1}`,
          name: crit.name_en || `Metric ${idx + 1}`,
          name_ar: crit.name_ar || crit.name_en || `معيار ${idx + 1}`,
          category: crit.category || "operational",
          category_ar: crit.category_ar,
          definition: crit.description_en || crit.how_measured_en || "",
          definition_ar: crit.description_ar || crit.how_measured_ar || "",
          weight,
          target,
          unit,
          direction,
          inputType,
          howMeasured: crit.how_measured_en || "",
          howMeasured_ar: crit.how_measured_ar || "",
        };
      });
    }

    return LIGHT_CURRENT_ENGINEER_KPIS.map((k) => ({
      id: String(k.id),
      numericIndex: k.id,
      code: `KPI-${k.id}`,
      name: k.name,
      name_ar: k.name_ar,
      category: k.category,
      category_ar: k.category_ar,
      definition: k.definition,
      definition_ar: k.definition_ar,
      weight: k.weight,
      target: k.target,
      unit: k.inputType === "rating_5" ? "scale" : "%",
      direction: (k.inputType === "rating_5"
        ? "rating_5"
        : "higher_is_better") as "higher_is_better" | "lower_is_better" | "rating_5",
      inputType: (k.inputType === "days" || k.inputType === "count" ? "numeric" : k.inputType) as "numeric" | "rating_5" | "percentage",
      howMeasured: k.definition,
      howMeasured_ar: k.definition_ar,
    }));
  }, [evalTemplate, matchedTemplate]);

  // Group items by category with total weights
  const activeCategories = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        category_ar?: string;
        totalWeight: number;
        items: ScorecardItem[];
      }
    >();

    for (const item of activeScorecardItems) {
      const cat = item.category || "operational";
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          category_ar: item.category_ar,
          totalWeight: 0,
          items: [],
        });
      }
      const entry = map.get(cat)!;
      entry.totalWeight += item.weight;
      entry.items.push(item);
    }

    return Array.from(map.values());
  }, [activeScorecardItems]);

  // Hydrate recorded scorecard state directly from evaluation.scores
  const kpiState = useMemo<Record<string, KpiRowState>>(() => {
    let scores: Record<string, any> = {};
    if (evaluation?.scores) {
      if (typeof evaluation.scores === "string") {
        try {
          scores = JSON.parse(evaluation.scores);
        } catch {
          scores = {};
        }
      } else {
        scores = evaluation.scores as Record<string, any>;
      }
    }
    const state: Record<string, KpiRowState> = {};

    activeScorecardItems.forEach((it, idx) => {
      // Lookup scores by criterion UUID, display index, or item id
      const saved =
        scores[it.id] ||
        scores[String(it.numericIndex)] ||
        scores[it.numericIndex] ||
        scores[String(idx + 1)] ||
        scores[idx + 1] ||
        {};

      state[it.id] = {
        id: it.id as any,
        targetAnnual: it.target,
        q1: saved.q1 ?? { actual: null, achievement: null, score: null },
        q2: saved.q2 ?? { actual: null, achievement: null, score: null },
        q3: saved.q3 ?? { actual: null, achievement: null, score: null },
        q4: saved.q4 ?? { actual: null, achievement: null, score: null },
        annualScore: saved.annualScore ?? null,
        adminNotes: saved.adminNotes || saved.notes || "",
        notes: saved.notes || "",
        isReturned: saved.isReturned ?? false,
      };
    });

    return state;
  }, [activeScorecardItems, evaluation]);

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

  // Backward-compatible kpiRows for exports and summary calculations
  const kpiRows = useMemo<EmpKpiRow[]>(() => {
    return activeScorecardItems.map((it) => {
      const st = kpiState[it.id] || {
        id: it.id as any,
        targetAnnual: it.target,
        q1: { actual: null, achievement: null, score: null },
        q2: { actual: null, achievement: null, score: null },
        q3: { actual: null, achievement: null, score: null },
        q4: { actual: null, achievement: null, score: null },
        annualScore: null,
      };

      return {
        kpi: {
          id: it.numericIndex,
          category: it.category,
          category_ar: it.category_ar || formatCategoryName(it.category, true),
          name: it.name,
          name_ar: it.name_ar,
          definition: it.definition,
          definition_ar: it.definition_ar,
          weight: it.weight,
          target: it.target > 1 ? it.target / 100 : it.target,
          unit: it.unit,
        },
        q1: st.q1,
        q2: st.q2,
        q3: st.q3,
        q4: st.q4,
        annualScore: st.annualScore,
        adminNotes: st.adminNotes,
        isReturned: st.isReturned,
      } as any;
    });
  }, [activeScorecardItems, kpiState]);

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

    let summaryObj: any = evaluation?.summary;
    if (typeof summaryObj === "string") {
      try {
        summaryObj = JSON.parse(summaryObj);
      } catch {
        summaryObj = null;
      }
    }
    const savedTotalScore = summaryObj?.totalScore != null ? Number(summaryObj.totalScore) : null;
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

  const fmtRawScore = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "—";
    return `${(val * 100).toFixed(2)}%`;
  };

  const formatTargetDisplay = (target: number, unit: string) => {
    if (unit === "%") {
      const pctVal = target > 1 ? target : target * 100;
      return `${pctVal.toFixed(0)}%`;
    }
    if (unit === "scale") {
      return `${target}/5`;
    }
    return `${target} ${unit || ""}`.trim();
  };

  const formatActualDisplay = (val: number | null | undefined, inputType: string, unit: string) => {
    if (val === null || val === undefined) return "";
    if (inputType === "rating_5" || unit === "scale") {
      return (val * 5).toFixed(1);
    }
    if (unit === "%") {
      const pctVal = val > 1 ? val : val * 100;
      return `${pctVal.toFixed(0)}%`;
    }
    return String(val);
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
      const rows: KpiDefPdfRow[] = activeScorecardItems.map((it, idx) => ({
        id: it.numericIndex || idx + 1,
        category: formatCategoryName(it.category, isAr),
        name: isAr ? it.name_ar || it.name : it.name,
        definition: (isAr ? it.definition_ar || it.definition : it.definition) || "—",
        howMeasured:
          (isAr ? it.howMeasured_ar || it.howMeasured : it.howMeasured) ||
          (it.unit ? `Measured in ${it.unit}` : "Standard measurement benchmark"),
        weight: Number(it.weight || 0),
        target: it.target,
        unit: it.unit || "%",
      }));

      const posName =
        profileDetails?.position ||
        (effectiveTemplate as any)?.position?.name_en ||
        (matchedTemplate as any)?.position_name ||
        (matchedTemplate as any)?.template?.position?.name_en ||
        "Position Benchmark";

      const deptName =
        profileDetails?.department ||
        (effectiveTemplate as any)?.department?.name_en ||
        (matchedTemplate as any)?.department_name ||
        (matchedTemplate as any)?.template?.department?.name_en ||
        "—";

      const tmplName =
        (effectiveTemplate as any)?.name_en ||
        (matchedTemplate as any)?.template?.name_en ||
        "Position KPI Framework";

      await exportKpiDefinitionPdf(
        rows,
        {
          fullName: profileDetails?.full_name || session?.name || "",
          empCode: profileDetails?.emp_code || (session as any)?.emp_code || "",
          position: posName,
          department: deptName,
          templateName: tmplName,
          version: `v${(effectiveTemplate as any)?.version || (matchedTemplate as any)?.template?.version || "1.0"}`,
        },
        selectedYear
      );
      toast.success(isAr ? "تم تحميل ملف مؤشرات الأداء (PDF)" : "KPI Definition PDF downloaded successfully");
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
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full bg-transparent p-0 h-auto border-0 shadow-none">
          <TabsTrigger
            value="job_description"
            className="relative flex flex-col items-center justify-center gap-2.5 w-full rounded-3xl border border-border bg-card p-4 sm:p-5 text-center cursor-pointer transition-all whitespace-normal hover:border-orange-500/40 hover:shadow-2xs data-[state=active]:border-orange-600 data-[state=active]:bg-orange-500/5 data-[state=active]:ring-2 data-[state=active]:ring-orange-600/20 data-[state=active]:shadow-xs group"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground transition-all group-data-[state=active]:bg-orange-600 group-data-[state=active]:text-white shadow-2xs">
              <Briefcase className="h-6 w-6" />
            </div>
            <span className="font-bold text-sm sm:text-base text-foreground group-data-[state=active]:text-orange-600 dark:group-data-[state=active]:text-orange-400">
              {isAr ? "الوصف الوظيفي" : "Job Description"}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="kpis_definition"
            className="relative flex flex-col items-center justify-center gap-2.5 w-full rounded-3xl border border-border bg-card p-4 sm:p-5 text-center cursor-pointer transition-all whitespace-normal hover:border-orange-500/40 hover:shadow-2xs data-[state=active]:border-orange-600 data-[state=active]:bg-orange-500/5 data-[state=active]:ring-2 data-[state=active]:ring-orange-600/20 data-[state=active]:shadow-xs group"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground transition-all group-data-[state=active]:bg-orange-600 group-data-[state=active]:text-white shadow-2xs">
              <Target className="h-6 w-6" />
            </div>
            <span className="font-bold text-sm sm:text-base text-foreground group-data-[state=active]:text-orange-600 dark:group-data-[state=active]:text-orange-400">
              {isAr ? "تعريف المؤشرات" : "KPIs Definition"}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="kpis_records"
            className="relative flex flex-col items-center justify-center gap-2.5 w-full rounded-3xl border border-border bg-card p-4 sm:p-5 text-center cursor-pointer transition-all whitespace-normal hover:border-orange-500/40 hover:shadow-2xs data-[state=active]:border-orange-600 data-[state=active]:bg-orange-500/5 data-[state=active]:ring-2 data-[state=active]:ring-orange-600/20 data-[state=active]:shadow-xs group"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground transition-all group-data-[state=active]:bg-orange-600 group-data-[state=active]:text-white shadow-2xs">
              <Award className="h-6 w-6" />
            </div>
            <span className="font-bold text-sm sm:text-base text-foreground group-data-[state=active]:text-orange-600 dark:group-data-[state=active]:text-orange-400">
              {isAr ? "سجل مؤشرات الأداء" : "KPIs Records"}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── TAB: KPIS DEFINITION ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="kpis_definition" className="space-y-6 pt-2">
          {/* Executive Top Banner Card */}
          <div className="rounded-2xl border bg-card p-5 md:p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand">
                    <Target className="h-3.5 w-3.5" />
                    {isAr ? "مصفوفة مؤشرات الأداء الوظيفية" : "Official Position KPIs Definition"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCheck className="h-3.5 w-3.5" />
                    {isAr ? "معتمد وموثق" : "Approved & Active"}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {selectedYear} Framework
                  </span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-brand" />
                  {profileDetails?.position || (effectiveTemplate as any)?.position?.name_en || (matchedTemplate as any)?.position_name || (isAr ? "المسمى الوظيفي" : "Position Performance Framework")}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    <strong className="text-foreground">{isAr ? "الإدارة:" : "Department:"}</strong>{" "}
                    {profileDetails?.department || (effectiveTemplate as any)?.department?.name_en || (matchedTemplate as any)?.department_name || "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    <strong className="text-foreground">{isAr ? "النموذج:" : "Template:"}</strong>{" "}
                    {(effectiveTemplate as any)?.name_en || (matchedTemplate as any)?.template?.name_en || "Standard KPI Matrix"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <strong className="text-foreground">{activeScorecardItems.length}</strong>{" "}
                    {isAr ? "مؤشرات أداء" : "KPI Indicators"}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  onClick={handleDownloadKpiDefPdf}
                  disabled={isExportingKpiDefPdf || activeScorecardItems.length === 0}
                  size="lg"
                  className="h-12 gap-2 rounded-2xl bg-brand text-brand-foreground font-semibold shadow hover:brightness-105 px-6 text-sm"
                >
                  {isExportingKpiDefPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {isAr ? "تحميل مؤشرات الأداء (PDF)" : "Download KPIs Definition (PDF)"}
                </Button>
              </div>
            </div>
          </div>

          {/* KPI Definition Preview Table */}
          {activeScorecardItems.length > 0 ? (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#202020] text-white">
                      <th className="py-3 px-3 w-10 text-center font-bold">#</th>
                      <th className="py-3 px-3 w-40 font-semibold">{isAr ? "التصنيف" : "CATEGORY"}</th>
                      <th className="py-3 px-3 w-52 font-semibold">{isAr ? "اسم المؤشر" : "KPI / METRIC NAME"}</th>
                      <th className="py-3 px-4 font-semibold">{isAr ? "التعريف (ماذا يقيس)" : "DEFINITION (WHAT IT MEASURES)"}</th>
                      <th className="py-3 px-4 font-semibold">{isAr ? "طريقة القياس (المعادلة)" : "HOW IT'S MEASURED"}</th>
                      <th className="py-3 px-3 w-20 text-center font-semibold">{isAr ? "الوزن" : "WEIGHT (%)"}</th>
                      <th className="py-3 px-3 w-20 text-center font-semibold">{isAr ? "المستهدف" : "TARGET"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {activeScorecardItems.map((item, idx) => {
                      const weightPct = Math.round((Number(item.weight) > 1 ? Number(item.weight) : Number(item.weight || 0) * 100));
                      const targetStr = item.unit === "scale" || item.unit === "rating_5"
                        ? `${item.target} scale`
                        : item.unit === "%"
                        ? `${Math.round(Number(item.target || 100))}%`
                        : `${item.target} ${item.unit || ""}`.trim();

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <td className="py-3 px-3 text-center font-mono font-medium text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              {formatCategoryName(item.category, isAr)}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-foreground text-[12px]">
                              {isAr ? item.name_ar || item.name : item.name}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.code || `KPI-${idx + 1}`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground leading-relaxed">
                            {(isAr ? item.definition_ar || item.definition : item.definition) || "—"}
                          </td>
                          <td className="py-3 px-4 text-foreground/80 leading-relaxed font-sans">
                            {(isAr ? item.howMeasured_ar || item.howMeasured : item.howMeasured) || (item.unit ? `Measured in ${item.unit}` : "Standard measurement")}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-brand text-sm">
                            {weightPct}%
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                            <span className="inline-block px-2 py-0.5 rounded bg-muted text-[11px]">
                              {targetStr}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 border-t-2 border-border font-bold text-xs">
                      <td colSpan={5} className="py-3 px-4 text-right">
                        {isAr ? "إجمالي الأوزان النسبية والمستهدف الكلي:" : "TOTAL WEIGHT & TARGET BENCHMARK:"}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-brand text-sm">
                        {Math.round(activeScorecardItems.reduce((acc, it) => acc + (Number(it.weight) > 1 ? Number(it.weight) : Number(it.weight || 0) * 100), 0))}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-12 text-center bg-card">
              <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-1">
                {isAr ? "لا توجد مؤشرات أداء معرّفة لهذا المسمى الوظيفي بعد" : "No KPIs defined for your position yet"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {isAr
                  ? "يرجى مراجعة إدارة الموارد البشرية لربط نموذج مؤشرات الأداء المعتمد بوظيفتك."
                  : "Please contact HR to assign the approved KPI definition template for your job title."}
              </p>
            </div>
          )}
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
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${kpiSubTab === "quarters"
                    ? "bg-orange-600 hover:bg-orange-700 text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{isAr ? "النتائج الفصلية" : "Q-Results"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKpiSubTab("scorecard")}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${kpiSubTab === "scorecard"
                    ? "bg-orange-600 hover:bg-orange-700 text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>{isAr ? "سجل المعايير والدرجات" : "Scorecard"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKpiSubTab("feedback")}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${kpiSubTab === "feedback"
                    ? "bg-orange-600 hover:bg-orange-700 text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isAr ? "ملاحظات المدير" : "Feedback"}</span>
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
                    ? "bg-emerald-600 text-white border-transparent"
                    : isSubmitted
                      ? "bg-blue-600 text-white border-transparent"
                      : isReturned
                        ? "bg-amber-500 text-white border-transparent"
                        : "";

                  const badgeLabel = isApproved
                    ? (isAr ? "معتمد" : "Approved")
                    : isSubmitted
                      ? (isAr ? "بانتظار المراجعة" : "Pending Review")
                      : isReturned
                        ? (isAr ? "مُعاد" : "Returned")
                        : null;

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
                        {badgeLabel && (
                          <Badge
                            variant="default"
                            className={`text-[10px] px-2 py-0.5 font-semibold whitespace-nowrap ${badgeClass}`}
                          >
                            {badgeLabel}
                          </Badge>
                        )}
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

            {/* Sub-view 2: Scorecard & Detailed Criteria Records (Matching Admin / Manager Layout) */}
            {kpiSubTab === "scorecard" && (
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-brand" />
                        <span>{isAr ? "سجل بطاقة الأداء والمعايير المعتمدة" : "Detailed Criteria Scorecard"}</span>
                      </h3>
                      <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 rounded-full border-border bg-muted/40 font-medium text-muted-foreground">
                        {activeScorecardItems.length} {isAr ? "معايير معتمدة" : "Metrics"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isAr
                        ? "جميع معايير التقييم وأوزانها والأهداف ودرجة الإنجاز الفعلية والمحققة"
                        : "All assigned evaluation metrics, weights, targets, and quarterly actuals"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <div className="inline-flex items-center p-1 rounded-2xl bg-muted/60 border border-border/60 gap-0.5 shrink-0 shadow-2xs">
                      {(["all", "q1", "q2", "q3", "q4"] as const).map((qKey) => {
                        const isActive = activeQuarterFilter === qKey;
                        return (
                          <button
                            key={qKey}
                            type="button"
                            onClick={() => setActiveQuarterFilter(qKey)}
                            className={`rounded-xl px-3 py-1 text-xs font-semibold cursor-pointer transition-all ${
                              isActive
                                ? "bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                            }`}
                          >
                            {qKey === "all" ? (isAr ? "الكل" : "All") : qKey.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Scorecard Table matching Admin/Manager Panel */}
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                        <th className="px-3 py-3 text-center w-10">#</th>
                        <th className="px-3 py-3 text-start min-w-[220px]">
                          {isAr ? "اسم المؤشر / المعيار" : "KPI / Metric Name"}
                        </th>
                        <th className="px-3 py-3 text-center w-16">{isAr ? "الوزن" : "Weight"}</th>
                        <th className="px-3 py-3 text-center w-20">{isAr ? "المستهدف" : "Target"}</th>

                        {/* Q1 Columns */}
                        {(activeQuarterFilter === "all" || activeQuarterFilter === "q1") && (
                          <>
                            <th className="px-2 py-3 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-20">
                              {isAr ? "Q1 الفعلي" : "Q1 Actual"}
                            </th>
                            <th className="px-2 py-3 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-16">
                              {isAr ? "Q1 التحقيق" : "Q1 Achv%"}
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
                              {isAr ? "Q2 التحقيق" : "Q2 Achv%"}
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
                              {isAr ? "Q3 التحقيق" : "Q3 Achv%"}
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
                              {isAr ? "Q4 التحقيق" : "Q4 Achv%"}
                            </th>
                            <th className="px-2 py-3 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-16">
                              {isAr ? "Q4 الدرجة" : "Q4 Score"}
                            </th>
                          </>
                        )}

                        {/* Annual Summary */}
                        <th className="px-3 py-3 text-center bg-muted/80 font-bold w-20">
                          {isAr ? "المتوسط السنوي" : "Annual Avg"}
                        </th>
                        <th className="px-2 py-3 text-center w-10"></th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {activeCategories.map((cat, catIdx) => {
                        const categoryWeight = cat.totalWeight;
                        return (
                          <React.Fragment key={cat.category || catIdx}>
                            {/* Category Header Row */}
                            <tr className="bg-muted/40 font-semibold text-foreground">
                              <td colSpan={19} className="px-4 py-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs uppercase tracking-wider text-brand font-bold">
                                      {formatCategoryName(cat.category, isAr)}
                                    </span>
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium text-muted-foreground border-border">
                                      {cat.items.length} {isAr ? "معايير" : "criteria"}
                                    </Badge>
                                  </div>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {isAr ? `وزن الفئة: ${fmtPercent(categoryWeight, 1)}` : `Category Weight: ${fmtPercent(categoryWeight, 1)}`}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {cat.items.map((kpi) => {
                              const row = kpiState[kpi.id] || {
                                id: kpi.id as any,
                                targetAnnual: kpi.target,
                                q1: { actual: null, achievement: null, score: null },
                                q2: { actual: null, achievement: null, score: null },
                                q3: { actual: null, achievement: null, score: null },
                                q4: { actual: null, achievement: null, score: null },
                                annualScore: null,
                                adminNotes: "",
                                notes: "",
                                isReturned: false,
                              };

                              const q1ActualStr = formatActualDisplay(row.q1.actual, kpi.inputType, kpi.unit);
                              const q2ActualStr = formatActualDisplay(row.q2.actual, kpi.inputType, kpi.unit);
                              const q3ActualStr = formatActualDisplay(row.q3.actual, kpi.inputType, kpi.unit);
                              const q4ActualStr = formatActualDisplay(row.q4.actual, kpi.inputType, kpi.unit);

                              return (
                                <tr key={kpi.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-3 py-2 text-muted-foreground font-mono font-medium text-center">
                                    {kpi.numericIndex}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="space-y-0.5">
                                      <div className="font-semibold text-foreground leading-snug flex items-center gap-1.5">
                                        <span>{isAr ? kpi.name_ar : kpi.name}</span>
                                        {kpi.direction === "lower_is_better" && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-normal">
                                            {isAr ? "الأقل أفضل" : "Lower is better"}
                                          </span>
                                        )}
                                        {row.isReturned && (
                                          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] px-1.5 py-0">
                                            {isAr ? "مُعاد" : "Returned"}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                                        {isAr ? kpi.definition_ar : kpi.definition}
                                      </p>
                                      {row.adminNotes && (
                                        <div className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 mt-1 inline-block">
                                          <strong>{isAr ? "ملاحظة: " : "Note: "}</strong>{row.adminNotes}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono font-medium">
                                    {fmtPercent(kpi.weight, 1)}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono font-semibold text-muted-foreground">
                                    {formatTargetDisplay(kpi.target, kpi.unit)}
                                  </td>

                                  {/* Q1 Columns */}
                                  {(activeQuarterFilter === "all" || activeQuarterFilter === "q1") && (
                                    <>
                                      <td className="px-2 py-2 text-center bg-blue-500/5 font-mono">
                                        {q1ActualStr ? (
                                          <span className="px-2 py-0.5 rounded-lg bg-background border border-blue-500/20 text-blue-900 dark:text-blue-200 font-medium">
                                            {q1ActualStr}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono bg-blue-500/5">
                                        {row.q1.achievement !== null ? `${Math.round(row.q1.achievement * 100)}%` : "—"}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono font-bold bg-blue-500/5 text-blue-700 dark:text-blue-300">
                                        {fmtRawScore(row.q1.score)}
                                      </td>
                                    </>
                                  )}

                                  {/* Q2 Columns */}
                                  {(activeQuarterFilter === "all" || activeQuarterFilter === "q2") && (
                                    <>
                                      <td className="px-2 py-2 text-center bg-emerald-500/5 font-mono">
                                        {q2ActualStr ? (
                                          <span className="px-2 py-0.5 rounded-lg bg-background border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-medium">
                                            {q2ActualStr}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono bg-emerald-500/5">
                                        {row.q2.achievement !== null ? `${Math.round(row.q2.achievement * 100)}%` : "—"}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono font-bold bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                                        {fmtRawScore(row.q2.score)}
                                      </td>
                                    </>
                                  )}

                                  {/* Q3 Columns */}
                                  {(activeQuarterFilter === "all" || activeQuarterFilter === "q3") && (
                                    <>
                                      <td className="px-2 py-2 text-center bg-amber-500/5 font-mono">
                                        {q3ActualStr ? (
                                          <span className="px-2 py-0.5 rounded-lg bg-background border border-amber-500/20 text-amber-900 dark:text-amber-200 font-medium">
                                            {q3ActualStr}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono bg-amber-500/5">
                                        {row.q3.achievement !== null ? `${Math.round(row.q3.achievement * 100)}%` : "—"}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono font-bold bg-amber-500/5 text-amber-700 dark:text-amber-300">
                                        {fmtRawScore(row.q3.score)}
                                      </td>
                                    </>
                                  )}

                                  {/* Q4 Columns */}
                                  {(activeQuarterFilter === "all" || activeQuarterFilter === "q4") && (
                                    <>
                                      <td className="px-2 py-2 text-center bg-purple-500/5 font-mono">
                                        {q4ActualStr ? (
                                          <span className="px-2 py-0.5 rounded-lg bg-background border border-purple-500/20 text-purple-900 dark:text-purple-200 font-medium">
                                            {q4ActualStr}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono bg-purple-500/5">
                                        {row.q4.achievement !== null ? `${Math.round(row.q4.achievement * 100)}%` : "—"}
                                      </td>
                                      <td className="px-2 py-2 text-center font-mono font-bold bg-purple-500/5 text-purple-700 dark:text-purple-300">
                                        {fmtRawScore(row.q4.score)}
                                      </td>
                                    </>
                                  )}

                                  {/* Annual Score */}
                                  <td className="px-3 py-2 text-center font-mono font-bold bg-muted/40 text-foreground">
                                    {fmtRawScore(row.annualScore)}
                                  </td>

                                  {/* Info Trigger */}
                                  <td className="px-2 py-2 text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setInfoModalKpi(kpi)}
                                      className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                                      title={isAr ? "معلومات وطريقة قياس المؤشر" : "Metric Measurement & Definition"}
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Scorecard Summary Footer Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeCategories.map((c) => (
                      <span key={c.category} className="text-[11px] text-muted-foreground font-mono">
                        <strong className="text-foreground">{formatCategoryName(c.category, isAr)}:</strong>{" "}
                        {fmtPercent(c.totalWeight, 0)}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-muted-foreground">
                      {isAr ? "المتوسط السنوي الإجمالي:" : "Total Annual Score:"}
                    </span>
                    <span className="font-mono text-sm font-extrabold text-brand">
                      {summaryTotals.hasData ? fmtPercent(summaryTotals.annualWeightedSum, 2) : "—"}
                    </span>
                    {summaryTotals.hasData && (
                      <Badge className={`${ratingTier.badgeClass} text-[10px] px-2 py-0.5`}>
                        {isAr ? ratingTier.tier_ar : ratingTier.tier}
                      </Badge>
                    )}
                  </div>
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
          </div>
        </TabsContent>
      </Tabs>

      {/* Metric Detail Info Dialog */}
      <Dialog open={!!infoModalKpi} onOpenChange={(open) => !open && setInfoModalKpi(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-brand">
              <Info className="h-5 w-5" />
              <DialogTitle className="text-base font-bold font-display">
                #{infoModalKpi?.numericIndex}. {isAr ? infoModalKpi?.name_ar : infoModalKpi?.name}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {infoModalKpi?.code} • {formatCategoryName(infoModalKpi?.category, isAr)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px]">
                {isAr ? `الوزن: ${fmtPercent(infoModalKpi?.weight, 1)}` : `Weight: ${fmtPercent(infoModalKpi?.weight, 1)}`}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {isAr
                  ? `الهدف: ${infoModalKpi ? formatTargetDisplay(infoModalKpi.target, infoModalKpi.unit) : "—"}`
                  : `Target: ${infoModalKpi ? formatTargetDisplay(infoModalKpi.target, infoModalKpi.unit) : "—"}`}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <strong className="text-foreground block">
                {isAr ? "التعريف (ما الذي يقيسه هذا المؤشر):" : "Definition (What it measures):"}
              </strong>
              <p className="text-muted-foreground leading-relaxed">
                {(isAr ? infoModalKpi?.definition_ar : infoModalKpi?.definition) || (isAr ? "لا يوجد تفصيل إضافي." : "No additional description.")}
              </p>
            </div>

            {infoModalKpi?.howMeasured && (
              <div className="space-y-1.5 bg-muted/40 p-3 rounded-2xl border border-border">
                <strong className="text-foreground block">
                  {isAr ? "طريقة القياس المعتمدة:" : "How it is measured:"}
                </strong>
                <p className="text-muted-foreground leading-relaxed">
                  {isAr ? (infoModalKpi.howMeasured_ar || infoModalKpi.howMeasured) : infoModalKpi.howMeasured}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
