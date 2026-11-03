import React, { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Layers,
  Printer,
  Check,
  AlertCircle,
  Filter,
  ShieldCheck,
  Clock,
  ArrowLeft,
  ArrowRight,
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
  getRatingFromScore,
  RATING_SCALE,
} from "@/lib/kpi/light-current-kpi.data";
import { exportKpiEvaluationToExcel } from "@/lib/kpi/kpi-excel-export";
import {
  getMyKpiEvaluation,
  listMyKpiEvaluations,
} from "@/backend/functions/kpi-evaluations.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/employee/kpis")({
  component: EmployeeKpiPage,
});

export function EmployeeKpiPage() {
  const { t, isAr, dir } = useI18n();
  const session = useSession();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const getMyKpiFn = useServerFn(getMyKpiEvaluation);
  const listMyKpisFn = useServerFn(listMyKpiEvaluations);

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

  // Compute scorecard values
  const kpiRows = useMemo(() => {
    const scores = (evaluation?.scores as Record<string, any>) || {};
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
  }, [evaluation]);

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

  // Category breakdown
  const categoryStats = useMemo(() => {
    return KPI_CATEGORIES.map((cat) => {
      const catKpis = kpiRows.filter((r) => r.kpi.category === cat);
      const totalWeight = catKpis.reduce((acc, r) => acc + r.kpi.weight, 0);

      let earnedScore = 0;
      catKpis.forEach((r) => {
        if (r.annualScore !== null) {
          earnedScore += r.annualScore;
        }
      });

      const percentage = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;
      const catAr = KPI_CATEGORIES_AR[cat] || cat;

      return {
        name: cat,
        name_ar: catAr,
        totalWeight,
        earnedScore,
        percentage,
        kpiCount: catKpis.length,
      };
    });
  }, [kpiRows]);

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
      employeeName: session?.name || "Employee",
      employeeCode: session?.empCode || "",
      evaluatorName: evaluation.evaluator_name || "Manager",
      evaluationState: stateMap,
      notes: evaluation.notes || { strengths: "", growthAreas: "", recommendations: "" },
      year: selectedYear,
      department: (evaluation.employee as any)?.department?.name_en || "Engineering",
      jobTitle: (evaluation.employee as any)?.position?.name_en || "Site Engineer",
    });
    toast.success(isAr ? "تم تصدير ملف التقييم بنجاح" : "KPI scorecard exported to Excel");
  };

  const rawStatus = (evaluation?.status || "draft").toLowerCase();

  const quartersList = [
    { q: "q1", label: "Q1", label_ar: "الربع الأول", date: isAr ? "يناير – مارس" : "Jan – Mar", score: summaryTotals.q1Score, target: 0.25, color: "blue" },
    { q: "q2", label: "Q2", label_ar: "الربع الثاني", date: isAr ? "أبريل – يونيو" : "Apr – Jun", score: summaryTotals.q2Score, target: 0.25, color: "emerald" },
    { q: "q3", label: "Q3", label_ar: "الربع الثالث", date: isAr ? "يوليو – سبتمبر" : "Jul – Sep", score: summaryTotals.q3Score, target: 0.25, color: "amber" },
    { q: "q4", label: "Q4", label_ar: "الربع الرابع", date: isAr ? "أكتوبر – ديسمبر" : "Oct – Dec", score: summaryTotals.q4Score, target: 0.25, color: "purple" },
  ] as const;

  return (
    <div dir={dir} className="space-y-4 pb-16 print:p-0 print:space-y-3">
      {/* Back button and page actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <Link
          to="/employee"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          {dir === "rtl" ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> : <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />}
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
            <h1 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {isAr ? `تقرير الأداء السنوي لعام ${selectedYear}` : `Annual Performance — Year ${selectedYear}`}
            </h1>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {isAr
                ? "متابعة نتائج التقييم الفصلي والأداء السنوي"
                : "Quarterly and annual performance evaluation results"}
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
            {!summaryTotals.hasData && (
              <p className="text-[10px] text-muted-foreground">
                {isAr
                  ? "سيتم احتساب النتيجة فور اعتماد نتائج الأرباع السنوية."
                  : "Score activates once quarterly reviews are finalized."}
              </p>
            )}
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

      {/* Main Tabs Navigation (No scrollbar track, smooth swipeable) */}
      <Tabs defaultValue="quarters" className="space-y-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2 px-1 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-auto w-full justify-start rounded-2xl p-1 bg-muted/60 flex overflow-x-auto no-scrollbar scroll-smooth gap-1 max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="quarters" className="rounded-xl px-3.5 py-1.5 text-xs font-semibold gap-1.5 shrink-0 cursor-pointer">
              <Calendar className="h-3.5 w-3.5" />
              <span>{isAr ? "النتائج الفصلية (الأرباع)" : "Quarterly Results (Qs)"}</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-xl px-3.5 py-1.5 text-xs font-semibold gap-1.5 shrink-0 cursor-pointer">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isAr ? "ملاحظات المدير" : "Feedback"}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl px-3.5 py-1.5 text-xs font-semibold gap-1.5 shrink-0 cursor-pointer">
              <Layers className="h-3.5 w-3.5" />
              <span>{isAr ? "السجل" : "History"}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: THE QS (QUARTERLY PERFORMANCE RESULTS) ── */}
        <TabsContent value="quarters" className="space-y-3.5">
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
        </TabsContent>

        {/* ── TAB 3: SUPERVISOR FEEDBACK & DEVELOPMENT ── */}
        <TabsContent value="feedback" className="space-y-3">
          <div className="rounded-3xl border border-border bg-card p-4 shadow-2xs space-y-3">
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
              <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-1">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {isAr ? "1. نقاط القوة الفنية وأبرز الإنجازات الميدانية" : "1. Key Technical Strengths & Notable Site Deliveries"}
                </span>
                <p className="text-xs leading-relaxed text-foreground">
                  {evaluation?.notes?.strengths || (isAr ? "لم يتم تسجيل ملاحظات بعد." : "No strengths recorded yet.")}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-1">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {isAr ? "2. مجالات التطوير الفني وتحسين كفاءة التنفيذ" : "2. Areas for Technical Development & Optimization"}
                </span>
                <p className="text-xs leading-relaxed text-foreground">
                  {evaluation?.notes?.growthAreas || (isAr ? "لم يتم تسجيل مجالات تطوير بعد." : "No growth areas recorded yet.")}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-1">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  {isAr ? "3. الشهادات والدورات الموصى بها" : "3. Recommended Training & Next Milestones"}
                </span>
                <p className="text-xs leading-relaxed text-foreground">
                  {evaluation?.notes?.recommendations || (isAr ? "لم يتم تحديد دورات إضافية بعد." : "No recommended training recorded yet.")}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 4: EVALUATION HISTORY ── */}
        <TabsContent value="history" className="space-y-3">
          <div className="rounded-3xl border border-border bg-card p-4 shadow-2xs space-y-3">
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
                    className={`flex items-center justify-between p-3 transition-colors ${
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
                        className="rounded-xl text-xs h-7 px-2"
                      >
                        {isAr ? "فتح" : "View"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
