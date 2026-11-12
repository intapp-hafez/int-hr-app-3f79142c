import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  Calendar,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Lock,
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
  Loader2,
  Send,
  ShieldCheck,
  Trash2,
  Clock,
  CheckCheck,
  X,
  ExternalLink,
  Plus,
  Pencil,
  RotateCcw,
  Copy,
  AlertTriangle,
  Upload,
  FileDown,
  FolderKanban,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  LIGHT_CURRENT_ENGINEER_KPIS,
  KPI_CATEGORIES,
  KPI_CATEGORIES_AR,
  DEFAULT_KPI_DISCIPLINES,
  KpiDiscipline,
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
import {
  exportKpiEvaluationToExcel,
  exportAllKpiEvaluationsToExcel,
  AllEvaluationsExportRow,
} from "@/lib/kpi/kpi-excel-export";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";
import { listEmployeesAdmin } from "@/backend/functions/employees.functions";
import { getMyTeam } from "@/lib/team.functions";
import {
  getKpiEvaluation,
  listKpiEvaluations,
  saveKpiEvaluation,
  updateKpiEvaluationStatus,
  deleteKpiEvaluation,
  listPendingApprovals,
  reviewQuarterlyEvaluation,
  listManagerReturnedEvaluations,
  listKpiCriteria,
  saveKpiCriterion,
  archiveKpiCriterion,
  batchImportKpiCriteria,
  listKpiTemplates,
  saveKpiTemplate,
  publishKpiTemplate,
  duplicateKpiTemplate,
  matchKpiTemplate,
  getQuarterlyEvaluation,
  saveQuarterlyEvaluation,
  seedDefaultKpiTemplates,
  getMyManagerEvaluationPeriods,
  KpiEvaluationRecord,
} from "@/backend/functions/kpi-evaluations.functions";
import {
  listDepartments,
  listPositions,
  listJobGrades,
} from "@/backend/functions/directory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobDescriptionsTab } from "@/components/kpi/JobDescriptionsTab";
import { KpisDefinitionTab } from "@/components/kpi/KpisDefinitionTab";
import { EvaluationPeriodsTab } from "@/components/kpi/EvaluationPeriodsTab";

export interface ScorecardItem {
  id: string;
  templateItemId?: string;
  criterionId?: string;
  numericIndex: number;
  code: string;
  name: string;
  name_ar: string;
  category: string;
  category_ar?: string;
  definition: string;
  definition_ar: string;
  weight: number;
  target: number;
  unit: string;
  direction: "higher_is_better" | "lower_is_better" | "rating_5";
  inputType: "percentage" | "rating_5" | "numeric";
  howMeasured?: string;
  howMeasured_ar?: string;
}

export function computeAchievement(
  actual: number | null,
  targetBenchmark: number,
  direction: string = "higher_is_better",
  unit: string = "%"
): number | null {
  if (actual === null || isNaN(actual)) return null;

  let normTarget = targetBenchmark;
  if (unit === "%" && normTarget > 1) {
    normTarget = normTarget / 100;
  } else if (unit === "scale" && normTarget > 1) {
    normTarget = normTarget / 5;
  } else if (normTarget > 1 && normTarget <= 100) {
    normTarget = normTarget / 100;
  }

  if (normTarget <= 0) return 1.0;

  if (direction === "lower_is_better") {
    if (actual <= 0) return 1.0;
    return Math.min(1.0, normTarget / actual);
  }

  return Math.min(1.0, actual / normTarget);
}

export function formatCategoryName(cat: string | undefined | null, isAr: boolean): string {
  if (!cat) return isAr ? "معايير الأداء الوظيفي" : "Job Role Criteria";
  const normalized = cat.toLowerCase().replace(/_/g, " ").trim();
  const dict: Record<string, { en: string; ar: string }> = {
    technical: { en: "Technical Execution & Architecture", ar: "الأداء والتنفيذ الفني والبرمجي" },
    quality: { en: "Quality, Standards & Review", ar: "الجودة والمعايير والتدقيق" },
    operational: { en: "Operational Excellence & Delivery", ar: "الكفاءة التشغيلية والتسليم" },
    behavioral: { en: "Behavioral Competencies & Teamwork", ar: "الجدارات السلوكية والعمل الجماعي" },
    compliance: { en: "Compliance, Safety & Governance", ar: "الالتزام والسلامة والحوكمة" },
    safety: { en: "Site Safety & PPE Compliance", ar: "السلامة المهنية ومهمات الوقاية" },
    hse: { en: "HSE & Environmental Health", ar: "السلامة والصحة المهنية والبيئة" },
    customer_service: { en: "Customer Service & Stakeholder Care", ar: "خدمة العملاء ورعاية المستفيدين" },
    financial: { en: "Financial Accuracy & Governance", ar: "الحوكمة والدقة المالية" },
    innovation: { en: "Innovation & Continuous Learning", ar: "الابتكار والتطوير المستمر" },
    sales: { en: "Sales & Business Development", ar: "المبيعات وتطوير الأعمال" },
    hr: { en: "HR & People Operations", ar: "الموارد البشرية والعمليات" },
    "installation & technical execution": { en: "Installation & Technical Execution", ar: "التركيب والتنفيذ الفني" },
    "commissioning & system programming": { en: "Commissioning & System Programming", ar: "التشغيل وبرمجة الأنظمة" },
    "system integration": { en: "System Integration", ar: "تكامل وترابط الأنظمة" },
    "troubleshooting & testing": { en: "Troubleshooting & Testing", ar: "استكشاف الأعطال والاختبارات" },
    "reporting & support": { en: "Reporting & Support", ar: "التقارير والدعم الفني" },
    "cross-discipline coordination": { en: "Cross-Discipline Coordination", ar: "التنسيق بين التخصصات" },
    "professional development": { en: "Professional Development", ar: "التطوير والتعلم المهني" },
    "soft skills / behavioral competencies": { en: "Soft Skills & Behavioral Competencies", ar: "المهارات الشخصية والسلوكية" },
  };

  if (dict[normalized]) {
    return isAr ? dict[normalized].ar : dict[normalized].en;
  }
  if (KPI_CATEGORIES_AR[cat]) {
    return isAr ? KPI_CATEGORIES_AR[cat] : cat;
  }
  return cat
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface KpiEvaluationViewProps {
  role?: "admin" | "hr" | "manager";
}

export function KpiEvaluationView({ role = "admin" }: KpiEvaluationViewProps) {
  const { t, isAr, dir } = useI18n();
  const session = useSession();
  const queryClient = useQueryClient();

  // Selected Evaluation Meta
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [empSelectorOpen, setEmpSelectorOpen] = useState(false);
  const [empSelectorSearch, setEmpSelectorSearch] = useState("");

  const [evaluatorName, setEvaluatorName] = useState<string>(
    session?.name || (role === "manager" ? (isAr ? "المدير المباشر" : "Direct Manager") : (isAr ? "مهندس الإشراف / HR" : "Engineering Lead / HR"))
  );
  const [status, setStatus] = useState<"Draft" | "Submitted" | "Reviewed" | "Approved" | "Returned">("Draft");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [mainTab, setMainTab] = useState<string>("all-employees");
  const [empSearch, setEmpSearch] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeQuarterFilter, setActiveQuarterFilter] = useState<"all" | "q1" | "q2" | "q3" | "q4">("all");
  const [notes, setNotes] = useState<{
    strengths: string;
    growthAreas: string;
    recommendations: string;
    returnReason?: string;
  }>({
    strengths: "",
    growthAreas: "",
    recommendations: "",
  });

  // State for all 17 KPIs
  const [kpiState, setKpiState] = useState<Record<string, KpiRowState>>({});
  const [infoModalKpi, setInfoModalKpi] = useState<any | null>(null);
  const [isEvaluationsListOpen, setIsEvaluationsListOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Per-metric return / notes dialog (Admin)
  const [metricReturnModalOpen, setMetricReturnModalOpen] = useState(false);
  const [selectedReturnKpi, setSelectedReturnKpi] = useState<any | null>(null);
  const [metricReturnNote, setMetricReturnNote] = useState("");
  const [metricIsReturned, setMetricIsReturned] = useState(false);
  const [managerRowReplies, setManagerRowReplies] = useState<Record<string, string>>({});

  // ── DYNAMIC ENGINEERING DISCIPLINES WITH LOCALSTORAGE PERSISTENCE ──
  const [disciplines, setDisciplines] = useState<KpiDiscipline[]>(() => {
    try {
      const saved = localStorage.getItem("kpi_evaluation_disciplines");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* fallback */
    }
    return DEFAULT_KPI_DISCIPLINES;
  });

  useEffect(() => {
    try {
      localStorage.setItem("kpi_evaluation_disciplines", JSON.stringify(disciplines));
    } catch {
      /* ignore */
    }
  }, [disciplines]);

  const [isDisciplineModalOpen, setIsDisciplineModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<KpiDiscipline | null>(null);
  const [disciplineForm, setDisciplineForm] = useState<{
    name: string;
    name_ar: string;
    weight: number;
  }>({ name: "", name_ar: "", weight: 10 });

  const totalDisciplinesWeight = useMemo(() => {
    return disciplines.reduce((acc, d) => acc + d.weight, 0);
  }, [disciplines]);

  const handleOpenAddDiscipline = () => {
    setEditingDiscipline(null);
    setDisciplineForm({ name: "", name_ar: "", weight: 10 });
    setIsDisciplineModalOpen(true);
  };

  const handleOpenEditDiscipline = (disc: KpiDiscipline) => {
    setEditingDiscipline(disc);
    setDisciplineForm({
      name: disc.name,
      name_ar: disc.name_ar,
      weight: Number((disc.weight * 100).toFixed(1)),
    });
    setIsDisciplineModalOpen(true);
  };

  const handleSaveDiscipline = () => {
    const name = disciplineForm.name.trim();
    const name_ar = disciplineForm.name_ar.trim();
    const weightNum = Number(disciplineForm.weight);

    if (!name) {
      toast.error(isAr ? "يرجى إدخال اسم التخصص باللغة الإنجليزية" : "Please enter discipline name in English");
      return;
    }
    if (!name_ar) {
      toast.error(isAr ? "يرجى إدخال اسم التخصص باللغة العربية" : "Please enter discipline name in Arabic");
      return;
    }
    if (isNaN(weightNum) || weightNum <= 0 || weightNum > 100) {
      toast.error(isAr ? "يرجى إدخال نسبة وزن صحيحة بين 1% و 100%" : "Please enter a valid weight percentage between 1% and 100%");
      return;
    }

    const weight = weightNum / 100;

    if (editingDiscipline) {
      setDisciplines((prev) =>
        prev.map((d) =>
          d.id === editingDiscipline.id
            ? { ...d, name, name_ar, weight }
            : d
        )
      );
      toast.success(isAr ? `تم تحديث تخصص "${name_ar}" بنجاح` : `Discipline "${name}" updated successfully`);
    } else {
      const newId = `disc_${Date.now()}`;
      const newDisc: KpiDiscipline = {
        id: newId,
        name,
        name_ar,
        weight,
        isDefault: false,
      };
      setDisciplines((prev) => [...prev, newDisc]);
      toast.success(isAr ? `تمت إضافة تخصص "${name_ar}" بنجاح` : `Added new discipline "${name}"`);
    }

    setIsDisciplineModalOpen(false);
  };

  const handleDeleteDiscipline = (id: string) => {
    const target = disciplines.find((d) => d.id === id);
    if (!target) return;
    setDisciplines((prev) => prev.filter((d) => d.id !== id));
    toast.success(isAr ? `تم حذف تخصص "${target.name_ar}"` : `Deleted discipline "${target.name}"`);
  };

  const handleResetDisciplines = () => {
    setDisciplines(DEFAULT_KPI_DISCIPLINES);
    try {
      localStorage.removeItem("kpi_evaluation_disciplines");
    } catch {
      /* ignore */
    }
    toast.success(isAr ? "تمت استعادة التخصصات الهندسية الافتراضية" : "Reset to default engineering disciplines");
  };

  // Load Employees based on Role (Manager sees team, Admin/HR sees all)
  const isManagerMode = role === "manager";
  const adminEmpFn = useServerFn(listEmployeesAdmin);
  const managerTeamFn = useServerFn(getMyTeam);

  const { data: adminEmpsData } = useQuery({
    queryKey: ["admin", "employees-for-kpi"],
    queryFn: () => adminEmpFn({ data: { page: 1, pageSize: 2000, status: "" } }),
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
        position: m.role || m.position || m.job_title || (isAr ? "عضو الفريق" : "Team Member"),
        department: m.dept || m.department || (isAr ? "الإدارة" : "Department"),
      }));
    }
    return (adminEmpsData?.rows || []).map((e: any) => ({
      id: e.id,
      name: e.full_name || e.name || (isAr ? "موظف" : "Employee"),
      code: e.emp_code || "",
      position: e.position || (isAr ? "مهندس تيار خفيف" : "Light Current Engineer"),
      department: e.department || (isAr ? "الإدارة الهندسية" : "Engineering"),
    }));
  }, [isManagerMode, managerTeamData, adminEmpsData, isAr]);

  const filteredSelectorEmployees = useMemo(() => {
    if (!empSelectorSearch.trim()) return employeesList;
    const term = empSelectorSearch.trim().toLowerCase();
    return employeesList.filter((e) =>
      (e.name || "").toLowerCase().includes(term) ||
      (e.code || "").toLowerCase().includes(term) ||
      (e.position || "").toLowerCase().includes(term) ||
      (e.department || "").toLowerCase().includes(term)
    );
  }, [employeesList, empSelectorSearch]);

  // Set default selected employee once employees load
  useEffect(() => {
    if (employeesList.length > 0 && !selectedEmpId) {
      setSelectedEmpId(employeesList[0].id);
    }
  }, [employeesList, selectedEmpId]);

  const currentEmployee = useMemo(() => {
    return employeesList.find((e) => e.id === selectedEmpId) || {
      id: selectedEmpId,
      name: isAr ? "غير محدد" : "Unspecified",
      code: "",
      position: isAr ? "مهندس موقع تيار خفيف" : "Junior ELV Site Engineer",
      department: isAr ? "الإدارة الهندسية" : "Engineering",
    };
  }, [employeesList, selectedEmpId, isAr]);

  // Server Functions for Backend Sync
  const getEvalFn = useServerFn(getKpiEvaluation);
  const listEvalsFn = useServerFn(listKpiEvaluations);
  const saveEvalFn = useServerFn(saveKpiEvaluation);
  const updateStatusFn = useServerFn(updateKpiEvaluationStatus);
  const deleteEvalFn = useServerFn(deleteKpiEvaluation);
  const listPendingFn = useServerFn(listPendingApprovals);
  const reviewQuarterlyFn = useServerFn(reviewQuarterlyEvaluation);
  const listCriteriaFn = useServerFn(listKpiCriteria);
  const saveCriterionFn = useServerFn(saveKpiCriterion);
  const archiveCriterionFn = useServerFn(archiveKpiCriterion);
  const batchImportCriteriaFn = useServerFn(batchImportKpiCriteria);
  const listTemplatesFn = useServerFn(listKpiTemplates);
  const saveTemplateFn = useServerFn(saveKpiTemplate);
  const publishTemplateFn = useServerFn(publishKpiTemplate);
  const duplicateTemplateFn = useServerFn(duplicateKpiTemplate);
  const matchTemplateFn = useServerFn(matchKpiTemplate);
  const listDepartmentsFn = useServerFn(listDepartments);
  const listPositionsFn = useServerFn(listPositions);
  const listJobGradesFn = useServerFn(listJobGrades);
  const getQuarterlyFn = useServerFn(getQuarterlyEvaluation);
  const saveQuarterlyFn = useServerFn(saveQuarterlyEvaluation);
  const seedDefaultTemplatesFn = useServerFn(seedDefaultKpiTemplates);

  // ── PENDING APPROVALS QUERY ──
  const { data: pendingApprovals = [], refetch: refetchPending, isLoading: isLoadingPending } = useQuery({
    queryKey: ["kpi-pending-approvals", selectedYear],
    queryFn: () => listPendingFn({ data: { year: selectedYear } }),
    enabled: !!session && !isManagerMode,
  });

  // ── MANAGER RETURNED EVALUATIONS QUERY ──
  const listReturnedFn = useServerFn(listManagerReturnedEvaluations);
  const { data: returnedEvaluations = [], refetch: refetchReturned, isLoading: isLoadingReturned } = useQuery({
    queryKey: ["kpi-returned-evaluations", selectedYear],
    queryFn: () => listReturnedFn({ data: { year: selectedYear } }),
    enabled: !!session && isManagerMode,
  });
  const [returnedQuarterFilter, setReturnedQuarterFilter] = useState<"all" | "q1" | "q2" | "q3" | "q4">("all");
  const [selectedReturnQuarter, setSelectedReturnQuarter] = useState<string | null>(null);

  useEffect(() => {
    if (mainTab === "pending-returns" && !isLoadingReturned && returnedEvaluations.length === 0) {
      setMainTab("all-employees");
    }
  }, [mainTab, isLoadingReturned, returnedEvaluations.length]);

  // ── MANAGER EVALUATION PERIODS ACCESS CONTROL QUERY ──
  const getMyPeriodsFn = useServerFn(getMyManagerEvaluationPeriods);
  const { data: myManagerPeriods = [], isLoading: isLoadingMyPeriods } = useQuery({
    queryKey: ["kpi-my-manager-periods", selectedYear],
    queryFn: () => getMyPeriodsFn({ data: { year: selectedYear } }),
    enabled: !!session && isManagerMode,
  });

  const activeManagerQuarters = useMemo(() => {
    const set = new Set<"q1" | "q2" | "q3" | "q4">();
    for (const p of myManagerPeriods as any[]) {
      if (p.status === "active") {
        set.add(p.quarter);
      }
    }
    return set;
  }, [myManagerPeriods]);

  const hasAnyActiveManagerPeriod = !isManagerMode || activeManagerQuarters.size > 0;

  // ── CRITERIA CATALOG QUERY ──
  const { data: kpiCriteria = [], refetch: refetchCriteria, isLoading: isLoadingCriteria } = useQuery({
    queryKey: ["kpi-criteria-catalog"],
    queryFn: () => listCriteriaFn({ data: { layer: "all" } }),
    enabled: !!session && !isManagerMode,
  });

  // ── TEMPLATES QUERY ──
  const { data: kpiTemplates = [], refetch: refetchTemplates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["kpi-templates"],
    queryFn: () => listTemplatesFn({ data: {} }),
    enabled: !!session && !isManagerMode,
  });

  // ── DIRECTORY DATA QUERIES (DEPARTMENTS, POSITIONS, GRADES) ──
  const { data: departmentsData = [] } = useQuery({
    queryKey: ["kpi-departments-list"],
    queryFn: () => listDepartmentsFn(),
    enabled: !!session,
  });

  const { data: positionsData = [] } = useQuery({
    queryKey: ["kpi-positions-list"],
    queryFn: () => listPositionsFn(),
    enabled: !!session,
  });

  const { data: jobGradesData = [] } = useQuery({
    queryKey: ["kpi-job-grades-list"],
    queryFn: () => listJobGradesFn(),
    enabled: !!session,
  });

  // ── EMPLOYEE TEMPLATE MATCH QUERY (MISSING TEMPLATE GUARD) ──
  const { data: matchedTemplateData, isLoading: isLoadingMatchedTemplate } = useQuery({
    queryKey: ["kpi-matched-template", selectedEmpId],
    queryFn: () => matchTemplateFn({ data: { employeeId: selectedEmpId } }),
    enabled: !!selectedEmpId,
  });

  // ── DYNAMIC SCORECARD ITEMS FROM MATCHED ROLE TEMPLATE ──
  const activeScorecardItems = useMemo<ScorecardItem[]>(() => {
    const rawItems =
      matchedTemplateData?.matched &&
        matchedTemplateData.template?.items &&
        matchedTemplateData.template.items.length > 0
        ? matchedTemplateData.template.items
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
        const keyId = String(it.criterion_id || it.id || idx + 1);

        return {
          id: keyId,
          templateItemId: it.id,
          criterionId: it.criterion_id || crit.id,
          numericIndex: idx + 1,
          code: crit.code || `KPI-${idx + 1}`,
          name: crit.name_en || `Metric ${idx + 1}`,
          name_ar: crit.name_ar || `مؤشر ${idx + 1}`,
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

    // Default fallback to LIGHT_CURRENT_ENGINEER_KPIS
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
      inputType: k.inputType as "percentage" | "rating_5" | "numeric",
      howMeasured: k.howMeasured,
      howMeasured_ar: k.howMeasured_ar,
    }));
  }, [matchedTemplateData]);

  // Group active scorecard items by category
  const activeCategories = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        category_ar?: string;
        items: ScorecardItem[];
        totalWeight: number;
      }
    >();

    for (const item of activeScorecardItems) {
      const cat = item.category || "operational";
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          category_ar: item.category_ar,
          items: [],
          totalWeight: 0,
        });
      }
      const entry = map.get(cat)!;
      entry.items.push(item);
      entry.totalWeight += item.weight;
    }

    return Array.from(map.values());
  }, [activeScorecardItems]);

  const totalTemplateWeight = useMemo(() => {
    return activeScorecardItems.reduce((acc, it) => acc + (it.weight || 0), 0);
  }, [activeScorecardItems]);

  // ── TEMPLATE BUILDER & DUPLICATION STATE ──
  const [templateSubTab, setTemplateSubTab] = useState<"templates" | "criteria" | "job-descriptions" | "kpis-definition">("templates");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateDeptFilter, setTemplateDeptFilter] = useState("all");
  const [templateStatusFilter, setTemplateStatusFilter] = useState("all");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateForm, setTemplateForm] = useState<{
    name_en: string;
    name_ar: string;
    description: string;
    department_id: string;
    position_id: string;
    job_grade_id: string;
    effective_year: number;
    items: Array<{
      criterion_id: string;
      weight: number;
      target_benchmark: number;
      scoring_direction: "higher_is_better" | "lower_is_better" | "rating_5" | "target_range";
      unit: string;
      display_order: number;
    }>;
  }>({
    name_en: "",
    name_ar: "",
    description: "",
    department_id: "",
    position_id: "",
    job_grade_id: "",
    effective_year: currentYear,
    items: [],
  });

  const [templateCriterionSearch, setTemplateCriterionSearch] = useState("");
  const [templateCriterionPopoverOpen, setTemplateCriterionPopoverOpen] = useState(false);
  const [templateCriterionLayerFilter, setTemplateCriterionLayerFilter] = useState<"all" | "common" | "role" | "custom">("all");

  const availableTemplateCriteria = useMemo(() => {
    const existingIds = new Set(templateForm.items.map((it: any) => it.criterion_id));
    const term = templateCriterionSearch.trim().toLowerCase();
    return kpiCriteria.filter((c: any) => {
      if (existingIds.has(c.id)) return false;
      if (templateCriterionLayerFilter !== "all" && c.layer !== templateCriterionLayerFilter) return false;
      if (!term) return true;
      return (
        (c.name_en || "").toLowerCase().includes(term) ||
        (c.name_ar || "").toLowerCase().includes(term) ||
        (c.code || "").toLowerCase().includes(term) ||
        (c.category_en || c.category || "").toLowerCase().includes(term) ||
        (c.category_ar || "").toLowerCase().includes(term)
      );
    });
  }, [kpiCriteria, templateForm.items, templateCriterionSearch, templateCriterionLayerFilter]);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceTemplate, setDuplicateSourceTemplate] = useState<any | null>(null);
  const [duplicateForm, setDuplicateForm] = useState({
    new_name_en: "",
    new_name_ar: "",
    target_department_id: "",
    target_position_id: "",
    target_job_grade_id: "",
  });

  // State for Pending Approvals & Reviews
  const [pendingQuarterFilter, setPendingQuarterFilter] = useState<"all" | "q1" | "q2" | "q3" | "q4">("all");
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedPendingItem, setSelectedPendingItem] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // State for Criteria Management
  const [criteriaLayerFilter, setCriteriaLayerFilter] = useState<"all" | "common" | "role" | "custom">("all");
  const [criteriaCategoryFilter, setCriteriaCategoryFilter] = useState<string>("all");
  const [groupByCategory, setGroupByCategory] = useState<boolean>(true);
  const [criterionModalOpen, setCriterionModalOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<any | null>(null);

  // Unique categories in Criteria Catalog for filtering
  const criteriaCategoriesList = useMemo(() => {
    const map = new Map<string, { key: string; labelEn: string; labelAr: string; label: string }>();
    kpiCriteria.forEach((c: any) => {
      const k = c.category_en || c.category || "operational";
      if (!map.has(k)) {
        const titleEn = c.category_en || formatCategoryName(c.category, false);
        const titleAr = c.category_ar || formatCategoryName(c.category, true);
        map.set(k, {
          key: k,
          labelEn: titleEn,
          labelAr: titleAr,
          label: isAr ? titleAr : titleEn,
        });
      }
    });
    return Array.from(map.values());
  }, [kpiCriteria, isAr]);

  // Grouped criteria by Category
  const groupedCriteriaByCategory = useMemo(() => {
    const filtered = kpiCriteria.filter((crit: any) => {
      const matchLayer = criteriaLayerFilter === "all" || crit.layer === criteriaLayerFilter;
      const critCat = crit.category_en || crit.category || "operational";
      const matchCat =
        criteriaCategoryFilter === "all" ||
        critCat === criteriaCategoryFilter ||
        crit.category === criteriaCategoryFilter;
      return matchLayer && matchCat;
    });

    const groups = new Map<
      string,
      {
        categoryKey: string;
        categoryTitleEn: string;
        categoryTitleAr: string;
        categoryTitle: string;
        items: any[];
        totalWeight: number;
      }
    >();

    filtered.forEach((crit: any) => {
      const catKey = crit.category_en || crit.category || "operational";
      const titleEn = crit.category_en || formatCategoryName(crit.category, false);
      const titleAr = crit.category_ar || formatCategoryName(crit.category, true);
      const title = isAr ? titleAr : titleEn;

      if (!groups.has(catKey)) {
        groups.set(catKey, {
          categoryKey: catKey,
          categoryTitleEn: titleEn,
          categoryTitleAr: titleAr,
          categoryTitle: title,
          items: [],
          totalWeight: 0,
        });
      }

      const g = groups.get(catKey)!;
      g.items.push(crit);
      g.totalWeight += Number(crit.default_weight || 0);
    });

    return Array.from(groups.values());
  }, [kpiCriteria, criteriaLayerFilter, criteriaCategoryFilter, isAr]);
  const [criterionForm, setCriterionForm] = useState({
    code: "",
    name_en: "",
    name_ar: "",
    category_en: "Installation & Technical Execution",
    category_ar: "التنفيذ الفني والتركيبات",
    layer: "role" as "common" | "role" | "custom",
    weight: 5,
    target: 95,
    unit: "%",
    how_measured_en: "",
    how_measured_ar: "",
  });

  // Quarterly Evaluation Scorecard State
  const [activeQuarterStep, setActiveQuarterStep] = useState<"q1" | "q2" | "q3" | "q4">("q1");
  const [activeScorecardQuarter, setActiveScorecardQuarter] = useState<"q1" | "q2" | "q3" | "q4">("q1");
  const [quarterStatuses, setQuarterStatuses] = useState<Record<string, { status: string; returnReason?: string; score?: number; approved_at?: string; return_reason?: string }>>({
    q1: { status: "draft" },
    q2: { status: "draft" },
    q3: { status: "draft" },
    q4: { status: "draft" },
  });

  // ── QUARTERLY APPROVAL & RETURN HANDLERS ──
  const handleNavigateToScorecard = (item: any) => {
    if (item.employee_id) {
      setSelectedEmpId(item.employee_id);
    }
    if (item.evaluation_year) {
      setSelectedYear(item.evaluation_year);
    }
    const q = (item.quarter || "").toLowerCase();
    if (q && ["q1", "q2", "q3", "q4"].includes(q)) {
      setActiveScorecardQuarter(q as any);
      setActiveQuarterFilter(q as any);
    } else if (Array.isArray(item.quarters) && item.quarters.length > 0) {
      const firstQ = item.quarters[0].toLowerCase();
      if (["q1", "q2", "q3", "q4"].includes(firstQ)) {
        setActiveScorecardQuarter(firstQ as any);
      }
      setActiveQuarterFilter("all");
    } else {
      setActiveQuarterFilter("all");
    }
    setMainTab("scorecard");
    if (item.employee_id) {
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation", item.employee_id] });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleQuarterCardClick = (quarterKey: "q1" | "q2" | "q3" | "q4") => {
    setMainTab("scorecard");
    setActiveScorecardQuarter(quarterKey);
    setActiveQuarterFilter(quarterKey);

    const qLabel = quarterKey.toUpperCase();
    toast.info(
      isAr
        ? `تم الانتقال لسجلات وبنود تقييم ${qLabel}`
        : `Viewing ${qLabel} scorecard records & evaluation items`,
      { duration: 2500 }
    );

    setTimeout(() => {
      const el = document.getElementById("kpi-scorecard-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleApproveQuarter = async (item: any, quarter?: string) => {
    try {
      setIsSubmittingReview(true);
      await reviewQuarterlyFn({
        data: {
          id: item.id || item.evaluation_id,
          evaluation_id: item.id || item.evaluation_id,
          quarter: (quarter as any) || undefined,
          action: "approve",
        },
      });
      const qName = quarter ? quarter.toUpperCase() + " " : "";
      toast.success(
        isAr
          ? `تم اعتماد تقييم ${qName}بنجاح. باقي الأرباع متاحة للتقييم.`
          : `KPI evaluation ${qName}approved successfully. Remaining quarters remain open for evaluation.`
      );
      refetchPending();
      if (refetchReturned) refetchReturned();
      queryClient.invalidateQueries({ queryKey: ["kpi-pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluations-list"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-returned-evaluations"] });
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل اعتماد التقييم" : "Failed to approve evaluation"));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleApprovePending = async (item: any) => {
    await handleApproveQuarter(item);
  };

  const handleApproveQuarterDirect = async (quarter: string) => {
    if (!serverRecord?.id) {
      toast.error(isAr ? "يرجى حفظ التقييم أولاً" : "Please save the evaluation first");
      return;
    }
    await handleApproveQuarter(serverRecord, quarter);
  };

  const handleOpenReturnModal = (item: any, quarter?: string) => {
    setSelectedPendingItem(item);
    setSelectedReturnQuarter(quarter || item.quarter || null);
    setReturnReason("");
    setReturnModalOpen(true);
  };

  const handleReturnQuarterDirect = (quarter: string) => {
    if (!serverRecord?.id) {
      toast.error(isAr ? "يرجى حفظ التقييم أولاً" : "Please save the evaluation first");
      return;
    }
    handleOpenReturnModal(serverRecord, quarter);
  };

  const handleConfirmReturn = async () => {
    if (!selectedPendingItem) return;
    if (returnReason.trim().length < 5) {
      toast.error(isAr ? "يرجى كتابة سبب الإعادة بالتفصيل (5 أحرف على الأقل)" : "Please specify a detailed return reason (at least 5 characters)");
      return;
    }
    try {
      setIsSubmittingReview(true);
      await reviewQuarterlyFn({
        data: {
          id: selectedPendingItem.id || selectedPendingItem.evaluation_id,
          evaluation_id: selectedPendingItem.id || selectedPendingItem.evaluation_id,
          quarter: (selectedReturnQuarter as any) || undefined,
          action: "return",
          reason: returnReason.trim(),
          return_reason: returnReason.trim(),
        },
      });
      toast.warning(
        isAr
          ? "تمت إعادة التقييم إلى المُقيّم للمراجعة مع تدوين الملاحظة"
          : "Evaluation returned for revision with return notes"
      );
      setReturnModalOpen(false);
      setSelectedPendingItem(null);
      setSelectedReturnQuarter(null);
      setReturnReason("");
      refetchPending();
      if (refetchReturned) refetchReturned();
      queryClient.invalidateQueries({ queryKey: ["kpi-pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluations-list"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-returned-evaluations"] });
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل إعادة التقييم" : "Failed to return evaluation"));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenReturnedEvaluation = (item: any) => {
    setSelectedEmpId(item.employee_id);
    if (item.quarter && ["q1", "q2", "q3", "q4"].includes(String(item.quarter).toLowerCase())) {
      setActiveQuarterFilter(String(item.quarter).toLowerCase() as any);
    } else {
      setActiveQuarterFilter("all");
    }
    setMainTab("scorecard");
    toast.info(
      isAr
        ? `تم فتح التقييم لتعديله. ملاحظة الإدارة: ${item.return_reason}`
        : `Opened evaluation for revision. Return note: ${item.return_reason}`,
      { duration: 7000 }
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenMetricReturnModal = (kpi: any) => {
    setSelectedReturnKpi(kpi);
    const row = kpiState[kpi.id] as any;
    setMetricReturnNote(row?.adminNotes || row?.notes || "");
    setMetricIsReturned(row?.isReturned ?? true);
    setMetricReturnModalOpen(true);
  };

  const handleSaveMetricReturnNote = async (returnEvaluation = false) => {
    if (!selectedReturnKpi) return;
    const kpiId = String(selectedReturnKpi.id);
    const updatedRow = {
      ...(kpiState[kpiId] || {}),
      id: selectedReturnKpi.id,
      targetAnnual: selectedReturnKpi.target,
      adminNotes: metricReturnNote.trim(),
      notes: metricReturnNote.trim(),
      isReturned: metricIsReturned,
    };
    const updatedState = {
      ...kpiState,
      [kpiId]: updatedRow,
    };
    setKpiState(updatedState as any);
    setHasUnsavedChanges(true);

    const targetStatus = returnEvaluation ? "returned" : (status.toLowerCase() as any);
    const metricLabel = isAr ? (selectedReturnKpi.name_ar || selectedReturnKpi.name) : selectedReturnKpi.name;
    const updatedNotes = {
      ...notes,
      quarterStatuses,
      ...(returnEvaluation
        ? {
            returnReason: metricReturnNote.trim()
              ? `[${metricLabel}]: ${metricReturnNote.trim()}`
              : serverRecord?.notes?.returnReason || `Returned for revision on metric: ${metricLabel}`,
          }
        : serverRecord?.notes?.returnReason
          ? { returnReason: serverRecord.notes.returnReason }
          : {}),
    };

    if (returnEvaluation) {
      setStatus("Returned");
      toast.warning(
        isAr
          ? `تمت إعادة التقييم للمراجعة مع حفظ ملاحظة: ${metricLabel}`
          : `Evaluation returned for revision with notes on: ${metricLabel}`
      );
    } else {
      toast.success(
        isAr ? "تم حفظ ملاحظة المؤشر بنجاح" : "Metric note saved successfully"
      );
    }

    if (selectedEmpId && selectedYear) {
      await saveMutation.mutateAsync({
        targetStatus,
        overrideKpiState: updatedState as any,
        overrideNotes: updatedNotes,
      });
      queryClient.invalidateQueries({ queryKey: ["kpi-returned-evaluations"] });
      if (refetchReturned) refetchReturned();
    }

    setMetricReturnModalOpen(false);
    setSelectedReturnKpi(null);
  };

  const handleResolveRowReturn = async (kpi: any) => {
    const kpiId = String(kpi.id);
    const reply = (managerRowReplies[kpiId] || "").trim();
    const currentRow = (kpiState[kpiId] || {}) as any;

    const updatedRow = {
      ...currentRow,
      id: kpi.id,
      targetAnnual: kpi.target,
      adminNotes: "",
      notes: reply
        ? `${currentRow.notes ? currentRow.notes + "\n" : ""}[Manager Reply]: ${reply}`
        : currentRow.notes || "",
      isReturned: false,
    };

    const updatedState = {
      ...kpiState,
      [kpiId]: updatedRow,
    };

    setKpiState(updatedState as any);
    setManagerRowReplies((prev) => {
      const next = { ...prev };
      delete next[kpiId];
      return next;
    });

    const hasRemainingReturnedRows = Object.values(updatedState).some(
      (r: any) => Boolean(r?.isReturned || r?.adminNotes)
    );

    const targetStatus: "draft" | "submitted" =
      !hasRemainingReturnedRows && status === "Returned" ? "submitted" : (status.toLowerCase() as any);

    const updatedQuarterStatuses = { ...quarterStatuses };
    if (targetStatus === "submitted") {
      Object.keys(updatedQuarterStatuses).forEach((qKey) => {
        if (updatedQuarterStatuses[qKey]?.status === "returned") {
          updatedQuarterStatuses[qKey] = {
            ...updatedQuarterStatuses[qKey],
            status: "submitted",
            return_reason: undefined,
            returnReason: undefined,
          };
        }
      });
      setQuarterStatuses(updatedQuarterStatuses);
    }

    const updatedNotes = {
      ...notes,
      quarterStatuses: updatedQuarterStatuses,
      ...(targetStatus === "submitted"
        ? {
            returnReason: undefined,
            growthAreas:
              typeof notes.growthAreas === "string"
                ? notes.growthAreas.replace(/\[HR Return Note.*?\]:[^\n]*\n?/gi, "").trim()
                : notes.growthAreas,
          }
        : {}),
    };

    if (selectedEmpId && selectedYear) {
      await saveMutation.mutateAsync({
        targetStatus: targetStatus === "returned" ? "draft" : targetStatus,
        overrideKpiState: updatedState as any,
        overrideNotes: updatedNotes,
      });
      queryClient.invalidateQueries({ queryKey: ["kpi-returned-evaluations"] });
      if (refetchReturned) refetchReturned();
    }

    toast.success(
      isAr
        ? "تم الرد على الملاحظة وإغلاق التنبيه بنجاح"
        : "Response saved and return notice resolved"
    );
  };

  // ── CRITERIA CATALOG HANDLERS ──
  const handleOpenAddCriterion = () => {
    setEditingCriterion(null);
    setCriterionForm({
      code: `KPI-${Math.floor(100 + Math.random() * 900)}`,
      name_en: "",
      name_ar: "",
      category_en: "Installation & Technical Execution",
      category_ar: "التنفيذ الفني والتركيبات",
      layer: "role",
      weight: 5,
      target: 95,
      unit: "%",
      how_measured_en: "",
      how_measured_ar: "",
    });
    setCriterionModalOpen(true);
  };

  const handleOpenEditCriterion = (crit: any) => {
    setEditingCriterion(crit);
    setCriterionForm({
      code: crit.code || "",
      name_en: crit.name_en || "",
      name_ar: crit.name_ar || "",
      category_en: crit.category_en || "",
      category_ar: crit.category_ar || "",
      layer: crit.layer || "role",
      weight: crit.default_weight ? Math.round(crit.default_weight * 100) : 5,
      target: crit.default_target ? Math.round(crit.default_target * 100) : 90,
      unit: crit.unit || "%",
      how_measured_en: crit.how_measured_en || "",
      how_measured_ar: crit.how_measured_ar || "",
    });
    setCriterionModalOpen(true);
  };

  const handleSaveCriterion = async () => {
    if (!criterionForm.name_en.trim() || !criterionForm.name_ar.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم المعيار باللغتين" : "Please provide criterion name in both languages");
      return;
    }
    try {
      await saveCriterionFn({
        data: {
          id: editingCriterion?.id,
          code: criterionForm.code,
          name_en: criterionForm.name_en.trim(),
          name_ar: criterionForm.name_ar.trim(),
          category_en: criterionForm.category_en,
          category_ar: criterionForm.category_ar,
          layer: criterionForm.layer,
          default_weight: criterionForm.weight / 100,
          default_target: criterionForm.target / 100,
          unit: criterionForm.unit,
          how_measured_en: criterionForm.how_measured_en.trim() || undefined,
          how_measured_ar: criterionForm.how_measured_ar.trim() || undefined,
        },
      });
      toast.success(isAr ? "تم حفظ المعيار بنجاح" : "Criterion saved successfully");
      setCriterionModalOpen(false);
      refetchCriteria();
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل حفظ المعيار" : "Failed to save criterion"));
    }
  };

  const handleArchiveCriterion = async (id: string) => {
    try {
      await archiveCriterionFn({ data: { id } });
      toast.info(isAr ? "تمت أرشفة المعيار" : "Criterion archived");
      refetchCriteria();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive criterion");
    }
  };

  const criteriaFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImportingCriteria, setIsImportingCriteria] = useState(false);

  // 1. Download ready-made Excel template with exact modal columns
  const handleDownloadCriteriaTemplate = async () => {
    try {
      await downloadTemplate(
        "kpi_criteria_import_template.xlsx",
        [
          "Code",
          "Criterion Layer",
          "Name (English)",
          "Name (Arabic)",
          "Category (English)",
          "Category (Arabic)",
          "Weight (%)",
          "Target (%)",
          "Unit",
        ],
        [
          {
            "Code": "KPI-507",
            "Criterion Layer": "Position / Role Layer (60%)",
            "Name (English)": "On-Time Cable Pulling & Termination",
            "Name (Arabic)": "دقة تمديد وإنهاء الكابلات في المواعيد المحددة",
            "Category (English)": "Installation & Technical Execution",
            "Category (Arabic)": "التنفيذ الفني والتركيبات",
            "Weight (%)": 5,
            "Target (%)": 95,
            "Unit": "%",
          },
          {
            "Code": "KPI-101",
            "Criterion Layer": "Common Company Layer (40%)",
            "Name (English)": "Attendance & Punctuality",
            "Name (Arabic)": "الانضباط ومواعيد الحضور",
            "Category (English)": "Behavioral & Compliance",
            "Category (Arabic)": "السلوك والانضباط",
            "Weight (%)": 10,
            "Target (%)": 98,
            "Unit": "%",
          },
          {
            "Code": "KPI-502",
            "Criterion Layer": "Position / Role Layer (60%)",
            "Name (English)": "First-Time Compliance with Approved Drawings",
            "Name (Arabic)": "المطابقة الأولى للمخططات الهندسية المعتمدة",
            "Category (English)": "Quality & Engineering Standards",
            "Category (Arabic)": "الجودة والمعايير الهندسية",
            "Weight (%)": 15,
            "Target (%)": 90,
            "Unit": "%",
          },
          {
            "Code": "KPI-503",
            "Criterion Layer": "Position / Role Layer (60%)",
            "Name (English)": "Site Safety & PPE Adherence",
            "Name (Arabic)": "الالتزام بإجراءات السلامة وارتداء مهمات الوقاية",
            "Category (English)": "Occupational Safety & Health",
            "Category (Arabic)": "السلامة والصحة المهنية",
            "Weight (%)": 10,
            "Target (%)": 100,
            "Unit": "%",
          },
          {
            "Code": "KPI-504",
            "Criterion Layer": "Position / Role Layer (60%)",
            "Name (English)": "Client & Consultant Satisfaction Rating",
            "Name (Arabic)": "تقييم رضا العميل والاستشاري",
            "Category (English)": "Customer Satisfaction",
            "Category (Arabic)": "خدمة ورضا العملاء",
            "Weight (%)": 10,
            "Target (%)": 95,
            "Unit": "%",
          },
          {
            "Code": "KPI-505",
            "Criterion Layer": "Position / Role Layer (60%)",
            "Name (English)": "Project Milestone Execution Rate",
            "Name (Arabic)": "معدل إنجاز مراحل المشروع حسب الجدول",
            "Category (English)": "Productivity & Delivery",
            "Category (Arabic)": "الإنتاجية والتسليم",
            "Weight (%)": 10,
            "Target (%)": 95,
            "Unit": "%",
          },
        ]
      );
      toast.success(isAr ? "تم تحميل نموذج إكسيل المجهز بنجاح" : "KPI Criteria template downloaded successfully");
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "فشل تحميل النموذج" : "Failed to download template"));
    }
  };

  // 2. Import KPI criteria from uploaded Excel/CSV file matching the 9 modal columns
  const handleImportCriteriaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setIsImportingCriteria(true);
      const rawRows = await parseExcelFile<Record<string, any>>(file);
      if (!rawRows || rawRows.length === 0) {
        toast.error(isAr ? "الملف فارغ ولا يحتوي على أي بيانات" : "The selected file is empty or has no data rows.");
        return;
      }

      const getVal = (row: Record<string, any>, ...keys: string[]) => {
        const clean = (s: string) => s.toLowerCase().replace(/[\s_\-():/%]/g, "");
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== "") return row[k];
          const target = clean(k);
          for (const rowKey of Object.keys(row)) {
            if (clean(rowKey) === target && row[rowKey] !== undefined && row[rowKey] !== "") {
              return row[rowKey];
            }
          }
        }
        return undefined;
      };

      const parsedItems: any[] = [];
      for (const [idx, r] of rawRows.entries()) {
        const code = String(getVal(r, "Code", "code", "kpi_code", "كود", "رمز") || "").trim();
        const nameEn = String(
          getVal(r, "Name (English)", "name_en", "name", "English Name", "اسم المعيار بالانجليزي", "الاسم بالانجليزية") || ""
        ).trim();
        const nameAr = String(
          getVal(r, "Name (Arabic)", "name_ar", "Arabic Name", "اسم المعيار بالعربي", "الاسم بالعربية", "اسم المعيار") || ""
        ).trim();

        if (!nameEn && !nameAr) continue;

        const rawType = String(
          getVal(r, "Criterion Layer", "criterion_layer", "layer", "criterion_type", "type", "نوع المعيار", "النوع", "طبقة المعيار") || ""
        ).toLowerCase();
        let criterionType: "common" | "position_specific" | "custom" = "position_specific";
        if (rawType.includes("common") || rawType.includes("عام") || rawType.includes("40")) {
          criterionType = "common";
        } else if (rawType.includes("custom") || rawType.includes("مخصص")) {
          criterionType = "custom";
        }

        const rawCatEn = String(
          getVal(
            r,
            "Category (English)",
            "category_en",
            "Category",
            "category",
            "English Category",
            "التصنيف بالانجليزي",
            "التصنيف بالانجليزية",
            "الفئة بالانجليزي"
          ) || ""
        ).trim();
        const rawCatAr = String(
          getVal(
            r,
            "Category (Arabic)",
            "category_ar",
            "Arabic Category",
            "التصنيف بالعربي",
            "التصنيف بالعربية",
            "الفئة",
            "التصنيف",
            "الفئة بالعربي"
          ) || ""
        ).trim();

        const catEn = rawCatEn || rawCatAr || "Technical Execution & Architecture";
        const catAr = rawCatAr || rawCatEn || "الأداء والتنفيذ الفني والبرمجي";

        const rawCat = (catEn + " " + catAr).toLowerCase();
        let category: "behavioral" | "technical" | "quality" | "productivity" | "safety" | "coordination" = "technical";
        if (rawCat.includes("behav") || rawCat.includes("سلوك") || rawCat.includes("انضباط")) category = "behavioral";
        else if (rawCat.includes("qual") || rawCat.includes("جود")) category = "quality";
        else if (rawCat.includes("prod") || rawCat.includes("انتاج") || rawCat.includes("إنجاز") || rawCat.includes("delivery"))
          category = "productivity";
        else if (rawCat.includes("safe") || rawCat.includes("سلام")) category = "safety";
        else if (rawCat.includes("coord") || rawCat.includes("تنسيق")) category = "coordination";

        const rawWeight = getVal(r, "Weight (%)", "weight", "default_weight", "الوزن", "النسبة");
        let weight = 0.05;
        if (rawWeight !== undefined && rawWeight !== "") {
          const num = typeof rawWeight === "number" ? rawWeight : parseFloat(String(rawWeight).replace("%", ""));
          if (!isNaN(num) && num > 0) {
            weight = num > 1 ? Math.min(num / 100, 1.0) : num;
          }
        }

        const rawTarget = getVal(r, "Target (%)", "target", "default_target", "target_benchmark", "max_value", "المستهدف", "الهدف");
        let targetNum = 95;
        if (rawTarget !== undefined && rawTarget !== "") {
          const num = typeof rawTarget === "number" ? rawTarget : parseFloat(String(rawTarget).replace("%", ""));
          if (!isNaN(num) && num > 0) {
            targetNum = num;
          }
        }

        const unit = String(getVal(r, "Unit", "unit", "الوحدة", "وحدة القياس") || "%").trim();
        const isRating5 = unit.toLowerCase() === "scale" || targetNum <= 5;
        const scale: "rating_5" | "percentage" | "count" | "boolean" = isRating5
          ? "rating_5"
          : unit === "%"
            ? "percentage"
            : "count";
        const direction: "higher_is_better" | "lower_is_better" | "rating_5" | "target_range" = isRating5
          ? "rating_5"
          : "higher_is_better";

        parsedItems.push({
          code: code || undefined,
          name_en: nameEn || nameAr,
          name_ar: nameAr || nameEn,
          category_en: catEn,
          category_ar: catAr,
          layer: criterionType === "common" ? "common" : criterionType === "custom" ? "custom" : "role",
          description_en: code ? `[${code}] ${catEn}` : catEn,
          description_ar: catAr,
          criterion_type: criterionType,
          category,
          scoring_scale: scale,
          scoring_direction: direction,
          unit: unit || "%",
          min_value: isRating5 ? 1 : 0,
          max_value: targetNum,
          how_measured_en: catEn,
          how_measured_ar: catAr,
          default_weight: weight,
          is_required: true,
          is_active: true,
          display_order: idx + 1,
        });
      }

      if (parsedItems.length === 0) {
        toast.error(isAr ? "لم يتم العثور على معايير صالحة في الملف المرفوع" : "No valid criteria rows found in the file.");
        return;
      }

      const res = await batchImportCriteriaFn({
        data: {
          items: parsedItems,
        },
      });

      toast.success(
        isAr
          ? `تم استيراد ${res.totalCount} معياراً بنجاح (${res.insertedCount} جديد، ${res.updatedCount} تم تحديثه)`
          : `Successfully imported ${res.totalCount} criteria (${res.insertedCount} new, ${res.updatedCount} updated)`
      );

      refetchCriteria();
      queryClient.invalidateQueries({ queryKey: ["kpi-criteria-catalog"] });
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "فشل استيراد المعايير من إكسيل" : "Failed to import criteria from Excel"));
    } finally {
      setIsImportingCriteria(false);
    }
  };

  // ── TEMPLATE BUILDER & DUPLICATION HANDLERS ──
  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name_en: "",
      name_ar: "",
      description: "",
      department_id: "",
      position_id: "",
      job_grade_id: "",
      effective_year: currentYear,
      items: [],
    });
    setTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tmpl: any) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      name_en: tmpl.name_en || "",
      name_ar: tmpl.name_ar || "",
      description: tmpl.description || "",
      department_id: tmpl.department_id || "",
      position_id: tmpl.position_id || "",
      job_grade_id: tmpl.job_grade_id || "",
      effective_year: tmpl.effective_year || currentYear,
      items: (tmpl.items || []).map((it: any, idx: number) => ({
        criterion_id: it.criterion_id,
        weight: Math.round(Number(it.weight) * 100),
        target_benchmark: it.target_benchmark ?? 100,
        scoring_direction: it.scoring_direction || "higher_is_better",
        unit: it.unit || "%",
        display_order: it.display_order ?? idx + 1,
      })),
    });
    setTemplateModalOpen(true);
  };

  const handleAddCriterionToTemplate = (crit: any) => {
    if (templateForm.items.some((i) => i.criterion_id === crit.id)) {
      toast.warning(isAr ? "المعيار مضاف بالفعل للقالب" : "Criterion is already added to this template");
      return;
    }
    const currentSum = templateForm.items.reduce((acc, it) => acc + Number(it.weight), 0);
    const suggestedWeight = Math.max(5, Math.min(25, 100 - currentSum));

    setTemplateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          criterion_id: crit.id,
          weight: suggestedWeight > 0 ? suggestedWeight : 5,
          target_benchmark: crit.default_target ? Math.round(crit.default_target * 100) : 90,
          scoring_direction: crit.scoring_direction || "higher_is_better",
          unit: crit.unit || "%",
          display_order: prev.items.length + 1,
        },
      ],
    }));
  };

  const handleRemoveCriterionFromTemplate = (critId: string) => {
    setTemplateForm((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.criterion_id !== critId),
    }));
  };

  const handleSaveTemplate = async (publishImmediate = false) => {
    if (!templateForm.name_en.trim() || !templateForm.name_ar.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم القالب باللغتين" : "Please provide template name in both languages");
      return;
    }
    if (templateForm.items.length === 0) {
      toast.error(isAr ? "يجب إضافة معيار واحد على الأقل للقالب" : "Template must include at least one criterion");
      return;
    }

    const totalWeight = templateForm.items.reduce((acc, it) => acc + Number(it.weight), 0);
    if (publishImmediate && Math.abs(totalWeight - 100) > 0.5) {
      toast.error(
        isAr
          ? `لا يمكن نشر القالب: يجب أن يكون مجموع الأوزان 100% تماماً (الحالي: ${totalWeight}%)`
          : `Cannot publish: Total criteria weight must equal exactly 100% (Current: ${totalWeight}%)`
      );
      return;
    }

    try {
      await saveTemplateFn({
        data: {
          id: editingTemplate?.id,
          name_en: templateForm.name_en.trim(),
          name_ar: templateForm.name_ar.trim(),
          description: templateForm.description.trim(),
          department_id: templateForm.department_id || null,
          position_id: templateForm.position_id || null,
          job_grade_id: templateForm.job_grade_id || null,
          effective_year: templateForm.effective_year,
          effective_quarter: "all",
          common_weight_pct: 40,
          position_weight_pct: 60,
          is_active: true,
          status: publishImmediate ? "published" : "draft",
          items: templateForm.items.map((it) => ({
            criterion_id: it.criterion_id,
            weight: it.weight / 100,
            target_benchmark: it.target_benchmark,
            scoring_direction: it.scoring_direction,
            unit: it.unit,
            display_order: it.display_order,
          })),
        },
      });

      toast.success(
        publishImmediate
          ? isAr ? "تم نشر واعتماد القالب رسمياً بنجاح" : "Template successfully published!"
          : isAr ? "تم حفظ مسودة القالب بنجاح" : "Template draft saved successfully"
      );
      setTemplateModalOpen(false);
      refetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    }
  };

  const handlePublishTemplateDirectly = async (templateId: string) => {
    try {
      await publishTemplateFn({ data: { id: templateId } });
      toast.success(isAr ? "تم نشر القالب بنجاح" : "Template published successfully");
      refetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish template");
    }
  };

  const handleOpenDuplicateTemplate = (tmpl: any) => {
    setDuplicateSourceTemplate(tmpl);
    setDuplicateForm({
      new_name_en: `${tmpl.name_en} (Copy)`,
      new_name_ar: `${tmpl.name_ar} (نسخة)`,
      target_department_id: tmpl.department_id || "",
      target_position_id: tmpl.position_id || "",
      target_job_grade_id: tmpl.job_grade_id || "",
    });
    setDuplicateModalOpen(true);
  };

  const handleSaveDuplicateTemplate = async () => {
    if (!duplicateSourceTemplate || !duplicateForm.new_name_en.trim()) return;
    try {
      await duplicateTemplateFn({
        data: {
          template_id: duplicateSourceTemplate.id,
          new_name_en: duplicateForm.new_name_en.trim(),
          new_name_ar: duplicateForm.new_name_ar.trim(),
          target_department_id: duplicateForm.target_department_id || null,
          target_position_id: duplicateForm.target_position_id || null,
          target_job_grade_id: duplicateForm.target_job_grade_id || null,
        },
      });
      toast.success(isAr ? "تم استنساخ القالب كمسودة جديدة بنجاح" : "Template duplicated successfully as a new draft");
      setDuplicateModalOpen(false);
      refetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate template");
    }
  };

  const [isSeedingTemplates, setIsSeedingTemplates] = useState(false);
  const handleSeedDefaultTemplates = async () => {
    try {
      setIsSeedingTemplates(true);
      const res = await seedDefaultTemplatesFn({ data: { overwrite: false } });
      toast.success(
        isAr
          ? `تم إدراج ${res.seededCount} قوالب تقييم نموذجية بنجاح`
          : `Successfully seeded ${res.seededCount} default evaluation templates!`
      );
      refetchTemplates();
      refetchCriteria();
    } catch (err: any) {
      toast.error(err.message || "Failed to seed default templates");
    } finally {
      setIsSeedingTemplates(false);
    }
  };

  // Load Existing Evaluation from Supabase
  const { data: serverRecord, isLoading: isFetchingEval } = useQuery({
    queryKey: ["kpi-evaluation", selectedEmpId, selectedYear],
    queryFn: () => getEvalFn({ data: { employeeId: selectedEmpId, year: selectedYear } }),
    enabled: !!selectedEmpId && !!selectedYear,
  });

  // Load all evaluations for this year to populate the evaluations list
  const { data: annualEvaluations = [] } = useQuery({
    queryKey: ["kpi-evaluations-list", selectedYear],
    queryFn: () => listEvalsFn({ data: { year: selectedYear } }),
    enabled: !!selectedYear,
  });

  // Sync state when serverRecord arrives
  useEffect(() => {
    if (serverRecord && serverRecord.scores) {
      const incomingState: Record<string, KpiRowState> = {};
      // 1. Initialize template items with defaults
      for (const it of activeScorecardItems) {
        incomingState[it.id] = {
          id: it.id as any,
          targetAnnual: it.target,
          q1: { actual: null, achievement: null, score: null },
          q2: { actual: null, achievement: null, score: null },
          q3: { actual: null, achievement: null, score: null },
          q4: { actual: null, achievement: null, score: null },
          annualScore: null,
        };
      }
      // 2. Overlay saved scores
      Object.entries(serverRecord.scores).forEach(([key, val]: [string, any]) => {
        incomingState[key] = {
          id: key as any,
          targetAnnual: val.targetAnnual ?? incomingState[key]?.targetAnnual ?? null,
          q1: val.q1 ?? { actual: null, achievement: null, score: null },
          q2: val.q2 ?? { actual: null, achievement: null, score: null },
          q3: val.q3 ?? { actual: null, achievement: null, score: null },
          q4: val.q4 ?? { actual: null, achievement: null, score: null },
          annualScore: val.annualScore ?? null,
          adminNotes: val.adminNotes ?? "",
          notes: val.notes ?? "",
          isReturned: val.isReturned ?? false,
        };
      });
      setKpiState(incomingState);
      if (serverRecord.notes) {
        setNotes({
          strengths: serverRecord.notes.strengths || "",
          growthAreas: (serverRecord.notes.growthAreas || "").replace(/\[HR Return Note.*?\]:[^\n]*\n?/gi, "").trim(),
          recommendations: serverRecord.notes.recommendations || "",
          returnReason: serverRecord.notes.returnReason || "",
        });
        if (serverRecord.notes.quarterStatuses) {
          setQuarterStatuses(serverRecord.notes.quarterStatuses);
        } else {
          setQuarterStatuses({});
        }
      } else {
        setQuarterStatuses({});
      }
      if (serverRecord.evaluator_name) {
        setEvaluatorName(serverRecord.evaluator_name);
      }
      if (serverRecord.status) {
        const capStatus = (serverRecord.status.charAt(0).toUpperCase() + serverRecord.status.slice(1)) as any;
        setStatus(capStatus);
      }
      setHasUnsavedChanges(false);
    } else if (serverRecord === null && selectedEmpId) {
      const emptyState: Record<string, KpiRowState> = {};
      for (const it of activeScorecardItems) {
        emptyState[it.id] = {
          id: it.id as any,
          targetAnnual: it.target,
          q1: { actual: null, achievement: null, score: null },
          q2: { actual: null, achievement: null, score: null },
          q3: { actual: null, achievement: null, score: null },
          q4: { actual: null, achievement: null, score: null },
          annualScore: null,
        };
      }
      setKpiState(emptyState);
      setNotes({ strengths: "", growthAreas: "", recommendations: "" });
      setStatus("Draft");
      setHasUnsavedChanges(false);
    }
  }, [serverRecord, selectedEmpId, activeScorecardItems]);

  // Calculate live summary totals
  const summaryTotals = useMemo(() => {
    let q1Sum = 0;
    let q2Sum = 0;
    let q3Sum = 0;
    let q4Sum = 0;
    let annualWeightedSum = 0;

    let q1Count = 0;
    let q2Count = 0;
    let q3Count = 0;
    let q4Count = 0;

    for (const item of activeScorecardItems) {
      const row = kpiState[item.id];
      if (!row) continue;

      if (typeof row.q1.score === "number") {
        q1Sum += row.q1.score;
        q1Count++;
      }
      if (typeof row.q2.score === "number") {
        q2Sum += row.q2.score;
        q2Count++;
      }
      if (typeof row.q3.score === "number") {
        q3Sum += row.q3.score;
        q3Count++;
      }
      if (typeof row.q4.score === "number") {
        q4Sum += row.q4.score;
        q4Count++;
      }
      if (typeof row.annualScore === "number") {
        annualWeightedSum += row.annualScore;
      }
    }

    return {
      q1Sum,
      q2Sum,
      q3Sum,
      q4Sum,
      annualWeightedSum,
      hasData: q1Count > 0 || q2Count > 0 || q3Count > 0 || q4Count > 0,
    };
  }, [activeScorecardItems, kpiState]);

  const ratingTier = useMemo(() => {
    return getRatingFromScore(summaryTotals.annualWeightedSum, summaryTotals.hasData);
  }, [summaryTotals.annualWeightedSum, summaryTotals.hasData]);

  // Dynamic Category stats using activeCategories
  const categoryStats = useMemo(() => {
    return activeCategories.map((cat) => {
      const catItems = cat.items;
      const totalWeight = cat.totalWeight;

      let earnedScore = 0;
      let hasData = false;

      for (const it of catItems) {
        const row = kpiState[it.id];
        if (row && typeof row.annualScore === "number") {
          earnedScore += row.annualScore;
          hasData = true;
        }
      }

      const percentage = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;

      return {
        id: cat.category,
        name: formatCategoryName(cat.category, false),
        name_ar: cat.category_ar || formatCategoryName(cat.category, true),
        totalWeight,
        earnedScore,
        percentage: hasData ? percentage : 0,
        kpiCount: catItems.length,
      };
    });
  }, [activeCategories, kpiState]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      targetStatus: "draft" | "submitted" | "reviewed" | "approved" | "returned";
      overrideKpiState?: Record<string, KpiRowState>;
      overrideNotes?: any;
    }) => {
      const isResubmitting = payload.targetStatus === "submitted" && !payload.overrideKpiState;
      const stateToUse = payload.overrideKpiState || kpiState;
      const serializedScores: Record<string, any> = {};
      Object.entries(stateToUse).forEach(([key, val]: [string, any]) => {
        serializedScores[String(key)] = {
          targetAnnual: val.targetAnnual,
          q1: val.q1,
          q2: val.q2,
          q3: val.q3,
          q4: val.q4,
          annualScore: val.annualScore,
          adminNotes: isResubmitting ? "" : (val.adminNotes || ""),
          notes: val.notes || "",
          isReturned: isResubmitting ? false : (val.isReturned || false),
        };
      });

      const summaryPayload = {
        totalScore: Number(((summaryTotals.annualWeightedSum || 0) * 100).toFixed(2)),
        rating: (ratingTier.tier as any) || "N/A",
        categories: categoryStats.map((c) => ({
          category: c.name,
          weight: c.totalWeight,
          maxScore: c.totalWeight * 100,
          actualScore: c.earnedScore * 100,
          percentage: c.percentage,
        })),
      };

      const cleanedQuarterStatuses = { ...quarterStatuses };
      if (payload.targetStatus === "submitted") {
        Object.keys(cleanedQuarterStatuses).forEach((qKey) => {
          if (cleanedQuarterStatuses[qKey]?.status === "returned") {
            cleanedQuarterStatuses[qKey] = {
              ...cleanedQuarterStatuses[qKey],
              status: "submitted",
              return_reason: undefined,
              returnReason: undefined,
            };
          }
        });
      }

      const notesPayload = payload.overrideNotes || {
        ...notes,
        quarterStatuses: cleanedQuarterStatuses,
        ...(payload.targetStatus === "submitted"
          ? {
              returnReason: undefined,
              growthAreas:
                typeof notes.growthAreas === "string"
                  ? notes.growthAreas.replace(/\[HR Return Note.*?\]:[^\n]*\n?/gi, "").trim()
                  : notes.growthAreas,
            }
          : serverRecord?.notes?.returnReason
            ? { returnReason: serverRecord.notes.returnReason }
            : {}),
      };

      return saveEvalFn({
        data: {
          employeeId: selectedEmpId,
          year: selectedYear,
          templateType: matchedTemplateData?.template?.id || matchedTemplateData?.template?.name_en || "role_template",
          evaluatorName,
          status: payload.targetStatus,
          scores: serializedScores,
          summary: summaryPayload,
          notes: notesPayload,
        },
      });
    },
    onSuccess: (res, vars) => {
      setHasUnsavedChanges(false);
      const capStatus = (vars.targetStatus.charAt(0).toUpperCase() + vars.targetStatus.slice(1)) as any;
      setStatus(capStatus);

      if (vars.targetStatus === "submitted") {
        setKpiState((prev) => {
          const next: Record<string, any> = {};
          Object.entries(prev).forEach(([k, v]: [string, any]) => {
            next[k] = { ...v, isReturned: false, adminNotes: "" };
          });
          return next;
        });
        setQuarterStatuses((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((qKey) => {
            if (next[qKey]?.status === "returned") {
              next[qKey] = { ...next[qKey], status: "submitted", return_reason: undefined, returnReason: undefined };
            }
          });
          return next;
        });
      }

      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation", selectedEmpId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluations-list", selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["kpi-returned-evaluations"] });

      if (vars.targetStatus === "draft") {
        toast.success(isAr ? "تم حفظ مسودة التقييم في السحابة بنجاح" : "Evaluation draft saved to cloud");
      } else if (vars.targetStatus === "submitted") {
        toast.success(isAr ? "تم إرسال التقييم بنجاح لمراجعة الموارد البشرية" : "Evaluation submitted for HR review");
      } else if (vars.targetStatus === "approved") {
        toast.success(isAr ? "تم اعتماد التقييم السنوي رسمياً" : "KPI Evaluation officially approved");
      } else if (vars.targetStatus === "returned") {
        toast.warning(isAr ? "تمت إعادة التقييم إلى المُقيّم للمراجعة" : "Evaluation returned for revision");
      } else {
        toast.success(isAr ? "تم تحديث حالة التقييم بنجاح" : "Evaluation status updated successfully");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "تعذر حفظ التقييم على الخادم" : "Failed to save evaluation to server"));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (targetStatus: "draft" | "submitted" | "reviewed" | "approved") => {
      if (!serverRecord?.id) throw new Error("Please save the evaluation first");
      return updateStatusFn({
        data: {
          id: serverRecord.id,
          status: targetStatus,
        },
      });
    },
    onSuccess: (_, targetStatus) => {
      const capStatus = (targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1)) as any;
      setStatus(capStatus);
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation", selectedEmpId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluations-list", selectedYear] });
      toast.success(
        targetStatus === "approved"
          ? isAr ? "تم اعتماد التقييم السنوي رسمياً" : "Evaluation finalized and approved"
          : isAr ? "تم تحديث حالة التقييم" : "Evaluation status updated"
      );
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "تعذر تحديث الحالة" : "Failed to update status"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!serverRecord?.id) return;
      return deleteEvalFn({ data: { id: serverRecord.id } });
    },
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluation", selectedEmpId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["kpi-evaluations-list", selectedYear] });
      resetForm();
      toast.success(isAr ? "تم حذف التقييم بنجاح" : "Evaluation deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err?.message || (isAr ? "تعذر حذف التقييم" : "Failed to delete evaluation"));
    },
  });

  const isOverallApproved = status === "Approved";
  const isQ1Approved = quarterStatuses.q1?.status === "approved" || (isOverallApproved && Object.keys(quarterStatuses).length === 0);
  const isQ2Approved = quarterStatuses.q2?.status === "approved" || (isOverallApproved && Object.keys(quarterStatuses).length === 0);
  const isQ3Approved = quarterStatuses.q3?.status === "approved" || (isOverallApproved && Object.keys(quarterStatuses).length === 0);
  const isQ4Approved = quarterStatuses.q4?.status === "approved" || (isOverallApproved && Object.keys(quarterStatuses).length === 0);

  const isQ1Disabled = isQ1Approved || (isManagerMode && !activeManagerQuarters.has("q1"));
  const isQ2Disabled = isQ2Approved || (isManagerMode && !activeManagerQuarters.has("q2"));
  const isQ3Disabled = isQ3Approved || (isManagerMode && !activeManagerQuarters.has("q3"));
  const isQ4Disabled = isQ4Approved || (isManagerMode && !activeManagerQuarters.has("q4"));

  const isQuarterDisabled = (q: "q1" | "q2" | "q3" | "q4") => {
    if (q === "q1") return isQ1Disabled;
    if (q === "q2") return isQ2Disabled;
    if (q === "q3") return isQ3Disabled;
    if (q === "q4") return isQ4Disabled;
    return false;
  };

  const allQuartersApproved = isQ1Approved && isQ2Approved && isQ3Approved && isQ4Approved;
  const isLocked = allQuartersApproved || (isOverallApproved && Object.keys(quarterStatuses).length === 0);

  // Cell Value Updates
  const handleActualChange = (
    kpiId: string | number,
    quarter: "q1" | "q2" | "q3" | "q4",
    rawValue: string
  ) => {
    if (isQuarterDisabled(quarter)) {
      toast.warning(
        isAr
          ? `الربع (${quarter.toUpperCase()}) معتمد ومقفل رسمياً ولا يمكن تعديله. يمكنك تقييم باقي الأرباع المتاحة للمدير.`
          : `Quarter (${quarter.toUpperCase()}) is approved and locked. You can evaluate the remaining available quarters.`
      );
      return;
    }

    const kpi = activeScorecardItems.find((k) => String(k.id) === String(kpiId));
    if (!kpi) return;

    let parsedActual: number | null = null;
    const trimmed = rawValue.trim();

    if (trimmed !== "") {
      const numeric = parseFloat(trimmed.replace("%", ""));
      if (!isNaN(numeric)) {
        if (kpi.inputType === "rating_5" || kpi.unit === "scale") {
          parsedActual = numeric <= 5 ? numeric / 5 : numeric / 100;
        } else if (kpi.unit === "%") {
          parsedActual = numeric > 1 ? numeric / 100 : numeric;
        } else {
          parsedActual = numeric;
        }
      }
    }

    setKpiState((prev) => {
      const row = prev[String(kpiId)] || {
        id: kpiId as any,
        targetAnnual: kpi.target,
        q1: { actual: null, achievement: null, score: null },
        q2: { actual: null, achievement: null, score: null },
        q3: { actual: null, achievement: null, score: null },
        q4: { actual: null, achievement: null, score: null },
        annualScore: null,
      };

      let achv: number | null = null;
      if (parsedActual !== null && kpi.target > 0) {
        if (kpi.direction === "lower_is_better") {
          achv = parsedActual <= 0 ? 1 : Math.min(1.5, Math.max(0, kpi.target / parsedActual));
        } else if (kpi.direction === "rating_5" || kpi.unit === "scale") {
          const targetNormalized = kpi.target > 1 ? kpi.target / 5 : kpi.target;
          achv = targetNormalized > 0 ? Math.min(1.5, parsedActual / targetNormalized) : parsedActual;
        } else {
          const targetNormalized = kpi.unit === "%" && kpi.target > 1 ? kpi.target / 100 : kpi.target;
          achv = targetNormalized > 0 ? Math.min(1.5, parsedActual / targetNormalized) : parsedActual;
        }
      }

      const score = achv !== null ? achv * kpi.weight : null;

      const updatedQuarter = { actual: parsedActual, achievement: achv, score };
      const updatedRow = { ...row, [quarter]: updatedQuarter };

      const allScores = [
        quarter === "q1" ? score : row.q1.score,
        quarter === "q2" ? score : row.q2.score,
        quarter === "q3" ? score : row.q3.score,
        quarter === "q4" ? score : row.q4.score,
      ];
      updatedRow.annualScore = calculateAnnualScore(allScores);

      return { ...prev, [String(kpiId)]: updatedRow };
    });

    setHasUnsavedChanges(true);
  };

  const loadSampleData = () => {
    if (isLocked) {
      toast.warning(isAr ? "التقييم معتمد ومقفل رسمياً" : "This evaluation is locked");
      return;
    }
    const mockState: Record<string, KpiRowState> = {};
    activeScorecardItems.forEach((kpi, idx) => {
      const q1Achv = 0.90 + ((idx % 3) * 0.05);
      const q2Achv = 0.92 + ((idx % 4) * 0.02);
      const q3Achv = 0.95 + ((idx % 2) * 0.03);
      const q4Achv = 0.94 + ((idx % 3) * 0.02);

      const targetVal = kpi.target;
      const calcQuarter = (achv: number) => {
        let actual: number;
        if (kpi.inputType === "rating_5" || kpi.unit === "scale") {
          actual = Math.min(1.0, achv * (targetVal > 1 ? targetVal / 5 : targetVal));
        } else if (kpi.unit === "%") {
          actual = achv * (targetVal > 1 ? targetVal / 100 : targetVal);
        } else {
          actual = Math.round(achv * targetVal);
        }
        const score = achv * kpi.weight;
        return { actual, achievement: achv, score };
      };

      const q1 = calcQuarter(q1Achv);
      const q2 = calcQuarter(q2Achv);
      const q3 = calcQuarter(q3Achv);
      const q4 = calcQuarter(q4Achv);

      const annualScore = calculateAnnualScore([q1.score, q2.score, q3.score, q4.score]);

      mockState[kpi.id] = {
        id: kpi.id as any,
        targetAnnual: kpi.target,
        q1,
        q2,
        q3,
        q4,
        annualScore,
      };
    });

    setKpiState(mockState);
    setNotes({
      strengths: isAr
        ? ("تفانٍ كبير في العمل وإنجاز متميز للمهام والأهداف وفقاً لمتطلبات " + currentEmployee.position + ".")
        : ("High dedication and consistent achievement across core competencies for " + currentEmployee.position + "."),
      growthAreas: isAr
        ? "مواصلة تعزيز المهارات التخصصية وسرعة التنسيق وإغلاق المهام المتقدمة."
        : "Continue strengthening specialized workflow velocity and advanced task handoffs.",
      recommendations: isAr
        ? "يوصى بالمشاركة في برامج التطوير المهني المستمر والشهادات التخصصية المعتمدة."
        : "Recommend advanced certifications and ongoing professional development workshops.",
    });
    setHasUnsavedChanges(true);
    toast.success(isAr ? "تم تحميل بيانات تجريبية واقعية لمعاينة الحسابات" : "Loaded realistic evaluation data for preview");
  };

  const resetForm = () => {
    if (isLocked) {
      toast.warning(isAr ? "التقييم معتمد ومقفل رسمياً" : "This evaluation is locked");
      return;
    }
    const emptyState: Record<string, KpiRowState> = {};
    for (const it of activeScorecardItems) {
      emptyState[it.id] = {
        id: it.id as any,
        targetAnnual: it.target,
        q1: { actual: null, achievement: null, score: null },
        q2: { actual: null, achievement: null, score: null },
        q3: { actual: null, achievement: null, score: null },
        q4: { actual: null, achievement: null, score: null },
        annualScore: null,
      };
    }
    setKpiState(emptyState);
    setNotes({ strengths: "", growthAreas: "", recommendations: "" });
    setStatus("Draft");
    setHasUnsavedChanges(true);
    toast.info(isAr ? "تمت إعادة تعيين بطاقة التقييم إلى نموذج فارغ" : "Scorecard reset to blank state");
  };

  // Format Helpers
  const fmtPercent = (val: number | null | undefined, decimals = 1): string => {
    if (val === null || val === undefined) return "—";
    return `${(val * 100).toFixed(decimals)}%`;
  };

  const fmtRawScore = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "—";
    return `${(val * 100).toFixed(2)}%`;
  };

  // ── ALL EMPLOYEES DIRECTORY WITH EVALUATIONS ──
  const employeesWithEvaluations = useMemo(() => {
    return employeesList.map((emp, index) => {
      const ev = annualEvaluations.find(
        (e: any) => e.employee_id === emp.id && Number(e.evaluation_year) === Number(selectedYear)
      );

      let q1Sum: number | null = null;
      let q2Sum: number | null = null;
      let q3Sum: number | null = null;
      let q4Sum: number | null = null;
      let hasQ1 = false, hasQ2 = false, hasQ3 = false, hasQ4 = false;

      if (ev?.scores) {
        let scoresObj: any = ev.scores;
        if (typeof scoresObj === "string") {
          try { scoresObj = JSON.parse(scoresObj); } catch {}
        }
        if (scoresObj && typeof scoresObj === "object") {
          let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
          Object.values(scoresObj).forEach((item: any) => {
            if (item?.q1?.score != null) { q1 += Number(item.q1.score); hasQ1 = true; }
            if (item?.q2?.score != null) { q2 += Number(item.q2.score); hasQ2 = true; }
            if (item?.q3?.score != null) { q3 += Number(item.q3.score); hasQ3 = true; }
            if (item?.q4?.score != null) { q4 += Number(item.q4.score); hasQ4 = true; }
          });
          if (hasQ1) q1Sum = q1;
          if (hasQ2) q2Sum = q2;
          if (hasQ3) q3Sum = q3;
          if (hasQ4) q4Sum = q4;
        }
      }

      const totalScore = ev?.summary?.totalScore != null
        ? Number(ev.summary.totalScore)
        : (hasQ1 || hasQ2 || hasQ3 || hasQ4
          ? Math.round(((q1Sum || 0) + (q2Sum || 0) + (q3Sum || 0) + (q4Sum || 0)) * 1000) / 10
          : null);

      const ratingObj = totalScore != null ? getRatingFromScore(totalScore / 100, true) : null;
      const rating = ev?.summary?.rating || (ratingObj ? (isAr ? ratingObj.tier_ar : ratingObj.tier) : null);
      const evStatus = ev ? (ev.status || "draft").toLowerCase() : "not_started";
      const evaluator = ev?.evaluator_name || null;
      const approvedAt = ev?.approved_at || null;

      return {
        index: index + 1,
        id: emp.id,
        name: emp.name,
        code: emp.code,
        department: emp.department,
        position: emp.position,
        evaluationId: ev?.id || null,
        hasEvaluation: !!ev,
        q1Score: q1Sum,
        q2Score: q2Sum,
        q3Score: q3Sum,
        q4Score: q4Sum,
        totalScore,
        rating,
        ratingTier: ratingObj,
        status: evStatus,
        evaluator,
        approvedAt,
      };
    });
  }, [employeesList, annualEvaluations, selectedYear, isAr]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    employeesList.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employeesList]);

  const filteredEmployeesWithEvaluations = useMemo(() => {
    return employeesWithEvaluations.filter((item) => {
      if (empSearch.trim()) {
        const query = empSearch.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCode = item.code.toLowerCase().includes(query);
        const matchPos = item.position.toLowerCase().includes(query);
        const matchDept = item.department.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchPos && !matchDept) return false;
      }

      if (deptFilter !== "all" && item.department !== deptFilter) {
        return false;
      }

      if (statusFilter !== "all") {
        if (statusFilter === "not_started" && item.status !== "not_started") return false;
        if (statusFilter !== "not_started" && item.status !== statusFilter) return false;
      }

      if (tierFilter !== "all" && item.ratingTier?.tier !== tierFilter) {
        return false;
      }

      return true;
    });
  }, [employeesWithEvaluations, empSearch, deptFilter, statusFilter, tierFilter]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [empSearch, deptFilter, statusFilter, tierFilter, selectedYear, pageSize]);

  const totalEmployeesCount = filteredEmployeesWithEvaluations.length;
  const totalPages = Math.max(1, Math.ceil(totalEmployeesCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedEmployees = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredEmployeesWithEvaluations.slice(start, start + pageSize);
  }, [filteredEmployeesWithEvaluations, safeCurrentPage, pageSize]);

  const startIndex = totalEmployeesCount > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalEmployeesCount);

  const evaluationsStats = useMemo(() => {
    const total = employeesWithEvaluations.length;
    const evaluated = employeesWithEvaluations.filter((e) => e.hasEvaluation).length;
    const approved = employeesWithEvaluations.filter((e) => e.status === "approved").length;
    const submitted = employeesWithEvaluations.filter((e) => e.status === "submitted").length;
    const draft = employeesWithEvaluations.filter((e) => e.status === "draft").length;

    const evaluatedScores = employeesWithEvaluations
      .map((e) => e.totalScore)
      .filter((s): s is number => s !== null && s > 0);

    const avgScore = evaluatedScores.length > 0
      ? (evaluatedScores.reduce((a, b) => a + b, 0) / evaluatedScores.length).toFixed(1)
      : null;

    return { total, evaluated, approved, submitted, draft, avgScore };
  }, [employeesWithEvaluations]);

  const filteredTemplates = useMemo(() => {
    return (kpiTemplates || []).filter((tmpl: any) => {
      if (templateSearch.trim()) {
        const q = templateSearch.toLowerCase().trim();
        const nameEn = (tmpl.name_en || "").toLowerCase();
        const nameAr = (tmpl.name_ar || "").toLowerCase();
        const posEn = (tmpl.position?.name_en || "").toLowerCase();
        const posAr = (tmpl.position?.name_ar || "").toLowerCase();
        const deptEn = (tmpl.department?.name_en || "").toLowerCase();
        const deptAr = (tmpl.department?.name_ar || "").toLowerCase();
        if (
          !nameEn.includes(q) &&
          !nameAr.includes(q) &&
          !posEn.includes(q) &&
          !posAr.includes(q) &&
          !deptEn.includes(q) &&
          !deptAr.includes(q)
        ) {
          return false;
        }
      }

      if (templateDeptFilter !== "all" && tmpl.department_id !== templateDeptFilter) {
        return false;
      }

      if (templateStatusFilter !== "all" && tmpl.status !== templateStatusFilter) {
        return false;
      }

      return true;
    });
  }, [kpiTemplates, templateSearch, templateDeptFilter, templateStatusFilter]);

  const handleExportAllToExcel = () => {
    const exportRows: AllEvaluationsExportRow[] = filteredEmployeesWithEvaluations.map((item, idx) => ({
      index: idx + 1,
      code: item.code || "—",
      name: item.name,
      department: item.department || "—",
      position: item.position || "—",
      q1: item.q1Score !== null ? (item.q1Score * 100).toFixed(1) + "%" : "—",
      q2: item.q2Score !== null ? (item.q2Score * 100).toFixed(1) + "%" : "—",
      q3: item.q3Score !== null ? (item.q3Score * 100).toFixed(1) + "%" : "—",
      q4: item.q4Score !== null ? (item.q4Score * 100).toFixed(1) + "%" : "—",
      total: item.totalScore !== null ? item.totalScore.toFixed(1) + "%" : "—",
      rating: item.rating || "—",
      status:
        item.status === "approved"
          ? isAr ? "معتمد" : "Approved"
          : item.status === "submitted"
            ? isAr ? "مقدم للمراجعة" : "Submitted"
            : item.status === "reviewed"
              ? isAr ? "تمت المراجعة" : "Reviewed"
              : item.status === "draft"
                ? isAr ? "مسودة" : "Draft"
                : isAr ? "لم يبدأ" : "Not Started",
      evaluator: item.evaluator || "—",
      approvedDate: item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : "—",
    }));

    exportAllKpiEvaluationsToExcel(exportRows, selectedYear, isAr);
    toast.success(isAr ? "تم تصدير سجل تقييمات الموظفين بنجاح" : "Exported all KPI evaluations to Excel");
  };

  const handleExportCurrent = async () => {
    await exportKpiEvaluationToExcel({
      employeeName: currentEmployee.name,
      employeeCode: currentEmployee.code || "",
      evaluatorName,
      evaluationState: kpiState,
      notes,
      year: selectedYear,
      department: currentEmployee.department,
      jobTitle: currentEmployee.position,
      items: activeScorecardItems.map((it) => ({
        id: it.id,
        category: formatCategoryName(it.category, isAr),
        name: isAr ? it.name_ar : it.name,
        definition: isAr ? it.definition_ar : it.definition,
        howMeasured: isAr ? it.howMeasured_ar : it.howMeasured,
        weight: it.weight,
        target: it.target,
        unit: it.unit,
      })),
    });
    toast.success(isAr ? "تم تصدير ملف الإكسيل بنجاح" : "KPI scorecard exported to Excel");
  };

  return (
    <div dir={dir} className="space-y-6 pb-16 print:p-0 print:space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/80 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
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
            <Badge
              variant="outline"
              className={`text-xs font-semibold gap-1.5 px-2.5 py-0.5 ${
                status === "Approved"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : status === "Returned"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                    : status === "Submitted"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              {status === "Approved" && <Check className="h-3 w-3" />}
              {status === "Returned" && <RotateCcw className="h-3 w-3" />}
              {status === "Submitted" && <Send className="h-3 w-3" />}
              {status === "Draft" && <Clock className="h-3 w-3" />}
              {status === "Approved"
                ? isAr ? "معتمد كلياً" : "Fully Approved"
                : status === "Returned"
                  ? isAr ? "معاد للمراجعة" : "Returned for Revision"
                  : status === "Submitted"
                    ? isAr ? "مقدم للمراجعة" : "Submitted"
                    : isAr ? "مسودة" : "Draft"}
            </Badge>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {isAr ? "التقييم السنوي لمؤشرات الأداء" : "KPI Evaluation"}
            {isFetchingEval && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentEmployee.position} — {matchedTemplateData?.matched && matchedTemplateData.template
              ? (isAr ? matchedTemplateData.template.name_ar : matchedTemplateData.template.name_en)
              : (isAr ? "بطاقة التقييم ومصفوفة الأداء الربع سنوية" : "Quarterly Scorecard & Rating Matrix")}
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary Operations Group */}
          <div className="flex items-center gap-2">
            {/* Evaluations Directory Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEvaluationsListOpen(true)}
              className="rounded-xl gap-1.5 cursor-pointer relative h-9 px-3"
            >
              <Layers className="h-4 w-4 text-brand" />
              <span>{isAr ? "سجل التقييمات" : "Evaluations Directory"}</span>
              {annualEvaluations.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                  {annualEvaluations.length}
                </Badge>
              )}
            </Button>

            {/* Save Draft Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate({ targetStatus: "draft" })}
              disabled={saveMutation.isPending || isLocked || (isManagerMode && !hasAnyActiveManagerPeriod)}
              className="rounded-xl gap-1.5 cursor-pointer h-9 px-3 font-medium"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isAr ? "حفظ كمسودة" : "Save Draft"}</span>
            </Button>

            {/* Submit / Approve Workflow Buttons */}
            {(status === "Draft" || status === "Returned") && (
              <Button
                size="sm"
                onClick={() => saveMutation.mutate({ targetStatus: "submitted" })}
                disabled={saveMutation.isPending || (isManagerMode && !hasAnyActiveManagerPeriod)}
                className="rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs h-9 px-3 font-medium"
              >
                <Send className="h-4 w-4" />
                <span>
                  {status === "Returned"
                    ? (isAr ? "إعادة الإرسال للمراجعة" : "Resubmit Review")
                    : (isAr ? "إرسال للمراجعة" : "Submit Review")}
                </span>
              </Button>
            )}

            {status === "Submitted" && (role === "admin" || role === "hr") && (
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate("approved")}
                disabled={updateStatusMutation.isPending}
                className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs h-9 px-3 font-medium"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{isAr ? "اعتماد كلي نهائي" : "Final Approve All"}</span>
              </Button>
            )}

            {status === "Approved" && (role === "admin" || role === "hr") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatusMutation.mutate("draft")}
                disabled={updateStatusMutation.isPending}
                className="rounded-xl gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer h-9 px-3 font-medium"
              >
                <Clock className="h-4 w-4" />
                <span>{isAr ? "إلغاء القفل للتعديل" : "Unlock for Edit"}</span>
              </Button>
            )}
          </div>

          {/* Secondary Utilities Group */}
          <div className="flex items-center gap-1.5 border-s border-border/80 ps-2">
            {/* Excel Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCurrent}
              className="rounded-xl gap-1.5 cursor-pointer h-9 px-3 text-xs"
              title={isAr ? "تصدير بطاقة التقييم إلى إكسيل" : "Export Scorecard to Excel"}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">{isAr ? "تصدير إكسيل" : "Export Excel"}</span>
            </Button>

            {/* Print Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl h-9 w-9 p-0 cursor-pointer print:hidden flex items-center justify-center text-muted-foreground hover:text-foreground"
              title={isAr ? "طباعة" : "Print"}
            >
              <Printer className="h-4 w-4" />
            </Button>

            {/* Delete Button (admin only) */}
            {role === "admin" && serverRecord?.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="rounded-xl h-9 w-9 p-0 text-destructive hover:bg-destructive/10 cursor-pointer flex items-center justify-center"
                title={isAr ? "حذف التقييم" : "Delete Evaluation"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <TabsList className="h-auto w-full sm:w-auto bg-transparent p-0 flex overflow-x-auto no-scrollbar gap-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {!isManagerMode && (
              <TabsTrigger
                value="evaluation-periods"
                className="group rounded-full px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <span>{isAr ? "فترات التقييم" : "Evaluation Periods"}</span>
              </TabsTrigger>
            )}
            <TabsTrigger
              value="all-employees"
              className="group rounded-full px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <span>{isManagerMode ? (isAr ? "تقييمات فريق العمل" : "Team Evaluations") : (isAr ? "سجل جميع الموظفين" : "All Employees Evaluations")}</span>
              {employeesWithEvaluations.length > 0 && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] font-mono transition-colors group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:border-transparent"
                >
                  {employeesWithEvaluations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="scorecard"
              className="group rounded-full px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <span>{isAr ? "بطاقة التقييم" : "Evaluation Scorecard"}</span>
            </TabsTrigger>
            {isManagerMode && returnedEvaluations.length > 0 && (
              <TabsTrigger
                value="pending-returns"
                className="group rounded-full px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <span>{isAr ? "التقييمات المعادة" : "Pending Returns"}</span>
                {returnedEvaluations.length > 0 && (
                  <Badge className="bg-rose-500 text-white px-1.5 py-0 text-[10px] font-mono transition-colors group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:border-transparent">
                    {returnedEvaluations.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {!isManagerMode && (
              <TabsTrigger
                value="pending-approvals"
                className="group rounded-full px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <span>{isAr ? "المعاملات المعلقة" : "Pending Approvals"}</span>
                {pendingApprovals.length > 0 && (
                  <Badge className="bg-amber-500 text-white px-1.5 py-0 text-[10px] font-mono transition-colors group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:border-transparent">
                    {pendingApprovals.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {!isManagerMode && (
              <TabsTrigger
                value="templates-criteria"
                className="group rounded-full px-4 py-2 text-xs font-semibold gap-1.5 cursor-pointer transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <span>{isAr ? "القوالب والمعايير" : "Templates & Criteria"}</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Quick Quarter Filter on Scorecard view */}
          {mainTab === "scorecard" && (
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border text-xs print:hidden">
              <span className="px-2 font-medium text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> {isAr ? "عرض:" : "View:"}
              </span>
              {(["all", "q1", "q2", "q3", "q4"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setActiveQuarterFilter(q)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${activeQuarterFilter === q
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {q === "all" ? (isAr ? "الكل" : "ALL") : q.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

      {/* Manager Evaluation Period Access Banner */}
      {isManagerMode && !isLoadingMyPeriods && (
        <div
          className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
            hasAnyActiveManagerPeriod
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {hasAnyActiveManagerPeriod ? (
              <CalendarClock className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <div>
              <span className="font-bold block">
                {hasAnyActiveManagerPeriod
                  ? isAr
                    ? "فترة التقييم مفتوحة حالياً"
                    : "Evaluation Window Active"
                  : isAr
                    ? "الوصول لتعديل التقييمات مغلق حالياً"
                    : "Evaluation Access Locked"}
              </span>
              <span className="text-[11px] opacity-90">
                {hasAnyActiveManagerPeriod
                  ? isAr
                    ? "يمكنك تقييم موظفي فريقك في الأرباع المفتوحة أدناه. التقييمات السابقة محفوظة بأمان."
                    : "You can evaluate your assigned team for the open quarters below. Previously submitted evaluations remain preserved."
                  : isAr
                    ? `لا توجد فترة تقييم نشطة لك لعام ${selectedYear}. التقييمات المرسلة سابقاً محفوظة للعرض فقط. يرجى التواصل مع الموارد البشرية لإعادة الفتح.`
                    : `No active evaluation period is open for you in ${selectedYear}. Previously submitted evaluations are preserved in read-only mode. Contact HR Admin to reopen.`}
              </span>
            </div>
          </div>

          {(myManagerPeriods as any[]).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {(myManagerPeriods as any[]).map((p: any) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className={`text-[10px] font-mono px-2 py-0.5 ${
                    p.status === "active"
                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {String(p.quarter).toUpperCase()}: {p.start_date} → {p.end_date} (
                  {p.status === "active"
                    ? isAr
                      ? "مفتوح"
                      : "Open"
                    : p.status === "scheduled"
                      ? isAr
                        ? "مجدول"
                        : "Scheduled"
                      : isAr
                        ? "مغلق"
                        : "Locked"}
                  )
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

        {/* ── TAB 0: ALL EMPLOYEES EVALUATIONS DIRECTORY ── */}
        <TabsContent value="all-employees" className="space-y-4">
          {/* Top Metric Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {isAr ? "إجمالي الكادر" : "Total Employees"}
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-foreground">
                  {evaluationsStats.total}
                </span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {isAr ? "تم تقييمهم" : "Evaluated"}
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {evaluationsStats.evaluated}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {evaluationsStats.total > 0
                    ? Math.round((evaluationsStats.evaluated / evaluationsStats.total) * 100)
                    : 0}%
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {isAr ? "معتمد رسمياً" : "Officially Approved"}
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {evaluationsStats.approved}
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {isAr ? "متوسط الدرجة السنوية" : "Average Score"}
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-brand">
                  {evaluationsStats.avgScore ? `${evaluationsStats.avgScore}%` : "—"}
                </span>
                <Award className="h-4 w-4 text-brand" />
              </div>
            </div>
          </div>

          {/* Filters & Export Bar */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  {isManagerMode
                    ? (isAr ? ("سجل تقييمات فريق العمل لعام " + selectedYear) : ("Team Performance Scorecards — Year " + selectedYear))
                    : (isAr ? ("سجل تقييمات الموظفين لعام " + selectedYear) : ("Staff KPI Scorecards Directory — Year " + selectedYear))}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isManagerMode
                    ? (isAr
                      ? "قائمة أعضاء فريقك لتقييم أدائهم ومتابعة النتائج الربع سنوية والاعتمادات."
                      : "Direct team members directory for performance evaluations and quarterly review tracking.")
                    : (isAr
                      ? "قائمة شاملة بنتائج الأرباع الأربعة والدرجة الإجمالية وحالة التقييم لكل موظف."
                      : "Complete quarterly scorecards, annual percentages, and sign-off statuses.")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold shadow-2xs focus:ring-1 focus:ring-brand cursor-pointer"
                >
                  <option value={currentYear}>{currentYear}</option>
                  <option value={currentYear - 1}>{currentYear - 1}</option>
                  <option value={currentYear + 1}>{currentYear + 1}</option>
                </select>

                <Button
                  size="sm"
                  onClick={handleExportAllToExcel}
                  className="rounded-xl gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>{isAr ? "تصدير إكسيل" : "Export Excel"}</span>
                </Button>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-border/60">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder={isAr ? "بحث بالاسم، الكود، الوظيفة..." : "Search name, code, position..."}
                  className="rounded-xl ps-9 text-xs h-9"
                />
              </div>

              {/* Department filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-2xs focus:ring-1 focus:ring-brand h-9 cursor-pointer"
              >
                <option value="all">{isAr ? "جميع الأقسام" : "All Departments"}</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-2xs focus:ring-1 focus:ring-brand h-9 cursor-pointer"
              >
                <option value="all">{isAr ? "جميع الحالات" : "All Statuses"}</option>
                <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
                <option value="submitted">{isAr ? "مقدم للمراجعة" : "Submitted"}</option>
                <option value="draft">{isAr ? "مسودة" : "Draft"}</option>
                <option value="not_started">{isAr ? "لم يبدأ بعد" : "Not Started"}</option>
              </select>

              {/* Tier filter */}
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-2xs focus:ring-1 focus:ring-brand h-9 cursor-pointer"
              >
                <option value="all">{isAr ? "جميع مستويات التقييم" : "All Rating Tiers"}</option>
                {RATING_SCALE.map((r) => (
                  <option key={r.tier} value={r.tier}>
                    {isAr ? r.tier_ar : r.tier} (≥ {(r.minScore * 100).toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Evaluations Master Table */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="px-3 py-3 text-start w-8">#</th>
                    <th className="px-3 py-3 text-start min-w-[200px]">{isAr ? "الموظف" : "Employee"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "القسم والمسمى" : "Position & Dept"}</th>
                    <th className="px-3 py-3 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-16">Q1</th>
                    <th className="px-3 py-3 text-center bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 w-16">Q2</th>
                    <th className="px-3 py-3 text-center bg-amber-500/5 text-amber-700 dark:text-amber-300 w-16">Q3</th>
                    <th className="px-3 py-3 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-16">Q4</th>
                    <th className="px-3 py-3 text-center bg-muted/80 font-bold w-20">{isAr ? "المجموع" : "Total"}</th>
                    <th className="px-3 py-3 text-center w-28">{isAr ? "التقدير" : "Rating"}</th>
                    <th className="px-3 py-3 text-center w-24">{isAr ? "الحالة" : "Status"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "المُقيّم" : "Evaluator"}</th>
                    <th className="px-3 py-3 text-center w-20">{isAr ? "الإجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        {isAr ? "لا يوجد موظفون مطابقون لشروط البحث المحددة" : "No employees match current filter criteria"}
                      </td>
                    </tr>
                  ) : (
                    paginatedEmployees.map((item) => {
                      const isCurrent = item.id === selectedEmpId;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-muted/30 transition-colors ${isCurrent ? "bg-brand/5 font-medium" : ""
                            }`}
                        >
                          <td className="px-3 py-3 text-muted-foreground font-mono">{item.index}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-[11px] shrink-0">
                                {item.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground truncate block">{item.name}</span>
                                {item.code && (
                                  <span className="font-mono text-[10px] text-muted-foreground">{item.code}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            <span className="text-foreground font-medium block">{item.position}</span>
                            <span className="text-[10px]">{item.department}</span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono bg-blue-500/5 text-blue-700 dark:text-blue-300">
                            {item.q1Score !== null ? `${(item.q1Score * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-mono bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                            {item.q2Score !== null ? `${(item.q2Score * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-mono bg-amber-500/5 text-amber-700 dark:text-amber-300">
                            {item.q3Score !== null ? `${(item.q3Score * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-mono bg-purple-500/5 text-purple-700 dark:text-purple-300">
                            {item.q4Score !== null ? `${(item.q4Score * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold bg-muted/60 text-foreground">
                            {item.totalScore !== null ? `${item.totalScore.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {item.ratingTier ? (
                              <Badge className={`text-[10px] px-2 py-0.5 font-semibold ${item.ratingTier.badgeClass}`}>
                                {isAr ? item.ratingTier.tier_ar : item.ratingTier.tier}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground font-mono">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {item.status === "approved" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-semibold">
                                {isAr ? "معتمد" : "Approved"}
                              </Badge>
                            ) : item.status === "submitted" ? (
                              <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5 font-semibold">
                                {isAr ? "مقدم" : "Submitted"}
                              </Badge>
                            ) : item.status === "draft" ? (
                              <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                                {isAr ? "مسودة" : "Draft"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                                {isAr ? "لم يبدأ" : "Not Started"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-[11px]">
                            {item.evaluator || "—"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Button
                              variant={item.hasEvaluation ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setSelectedEmpId(item.id);
                                setMainTab("scorecard");
                              }}
                              className={`h-7 text-xs rounded-xl px-2.5 cursor-pointer ${item.hasEvaluation ? "bg-brand text-brand-foreground hover:bg-brand/90" : ""
                                }`}
                            >
                              {item.hasEvaluation ? (isAr ? "فتح" : "Open") : (isAr ? "تقييم" : "Evaluate")}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>



            {/* Pagination Controls Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/70 p-3.5 bg-muted/20 text-xs">
              {/* Range summary */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  {isAr
                    ? `عرض ${startIndex} إلى ${endIndex} من أصل ${totalEmployeesCount} موظف`
                    : `Showing ${startIndex} to ${endIndex} of ${totalEmployeesCount} employees`}
                </span>
                <span className="text-border">|</span>
                <div className="flex items-center gap-1.5">
                  <span>{isAr ? "لكل صفحة:" : "Rows:"}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-xl border border-input bg-background px-2.5 py-1 text-xs font-semibold shadow-2xs focus:ring-1 focus:ring-brand cursor-pointer"
                  >
                    {[15, 25, 50, 100].map((sz) => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Navigation pagination pills */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="h-8 rounded-xl px-2.5 text-xs cursor-pointer"
                >
                  {isAr ? "السابق" : "Previous"}
                </Button>

                <div className="flex items-center gap-1 font-mono font-semibold">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    let pageNum = idx + 1;
                    if (totalPages > 5 && safeCurrentPage > 3) {
                      pageNum = safeCurrentPage - 2 + idx;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
                    }
                    const isCur = pageNum === safeCurrentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 w-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${isCur
                          ? "bg-brand text-white shadow-xs"
                          : "border border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && safeCurrentPage < totalPages - 2 && (
                    <span className="px-1 text-muted-foreground">...</span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="h-8 rounded-xl px-2.5 text-xs cursor-pointer"
                >
                  {isAr ? "التالي" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 1: FULL SCORECARD TABLE ── */}
        <TabsContent value="scorecard" className="space-y-4" id="kpi-scorecard-section">
      {/* Dedicated Quarter Governance & Approvals Bar */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {isAr ? "حوكمة واعتمادات الأرباع السنوية" : "Quarterly Evaluation Governance & Approvals"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "اعتماد كل ربع بصورة مستقلة يُمكّن المدير من إكمال تقييم الأرباع التالية بمرونة."
                  : "Approving evaluated quarters locks historical data while keeping upcoming quarters open for managers."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] text-muted-foreground font-medium">
              {isAr ? "الأرباع المعتمدة:" : "Approved Quarters:"}
            </span>
            <Badge variant="secondary" className="px-2 py-0.5 text-xs font-mono font-bold">
              {(["q1", "q2", "q3", "q4"] as const).filter((q) => {
                return (
                  quarterStatuses[q]?.status === "approved" ||
                  (isOverallApproved && Object.keys(quarterStatuses).length === 0)
                );
              }).length}{" "}
              / 4
            </Badge>
          </div>
        </div>

        {/* 4 Quarters Segmented Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              { key: "q1", label: "Q1", rangeEn: "Jan – Mar", rangeAr: "يناير – مارس", sum: summaryTotals.q1Sum },
              { key: "q2", label: "Q2", rangeEn: "Apr – Jun", rangeAr: "أبريل – يونيو", sum: summaryTotals.q2Sum },
              { key: "q3", label: "Q3", rangeEn: "Jul – Sep", rangeAr: "يوليو – سبتمبر", sum: summaryTotals.q3Sum },
              { key: "q4", label: "Q4", rangeEn: "Oct – Dec", rangeAr: "أكتوبر – ديسمبر", sum: summaryTotals.q4Sum },
            ] as const
          ).map((q) => {
            const isApproved =
              quarterStatuses[q.key]?.status === "approved" ||
              (isOverallApproved && Object.keys(quarterStatuses).length === 0);
            const isReturned = quarterStatuses[q.key]?.status === "returned";
            const hasActuals = Object.values(kpiState).some((k: any) => k[q.key]?.actual != null);
            const returnReasonText = quarterStatuses[q.key]?.return_reason || quarterStatuses[q.key]?.returnReason;
            const isCurrentScorecardQuarter =
              mainTab === "scorecard" &&
              (activeQuarterFilter === q.key || (activeQuarterFilter === "all" && activeScorecardQuarter === q.key));

            return (
              <div
                key={q.key}
                role="button"
                tabIndex={0}
                onClick={() => handleQuarterCardClick(q.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleQuarterCardClick(q.key);
                  }
                }}
                className={`relative rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-all shadow-2xs cursor-pointer group hover:border-brand/70 hover:shadow-md select-none ${
                  isCurrentScorecardQuarter ? "ring-2 ring-brand/80 border-brand shadow-sm" : ""
                } ${
                  isApproved
                    ? "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/20"
                    : isReturned
                      ? "bg-rose-500/5 border-rose-500/30 dark:bg-rose-950/20"
                      : hasActuals
                        ? "bg-blue-500/5 border-blue-500/30 dark:bg-blue-950/15"
                        : "bg-muted/30 border-border/60 opacity-80"
                }`}
                title={
                  isAr
                    ? `انقر لعرض سجلات وبنود تقييم ${q.label}`
                    : `Click to view ${q.label} scorecard records`
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm tracking-tight text-foreground group-hover:text-brand transition-colors">
                        {q.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        ({isAr ? q.rangeAr : q.rangeEn})
                      </span>
                      <ExternalLink className="h-3 w-3 text-brand opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {hasActuals && q.sum > 0 && (
                      <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block">
                        {isAr ? "الدرجة:" : "Score:"} <strong className="text-foreground">{(q.sum * 100).toFixed(1)}%</strong>
                      </span>
                    )}
                  </div>

                  {/* Quarter Status Badge */}
                  {isApproved ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1 px-2 py-0.5 shadow-2xs">
                      <Check className="h-3 w-3" /> {isAr ? "معتمد" : "Approved"}
                    </Badge>
                  ) : isReturned ? (
                    <Badge
                      variant="outline"
                      className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/40 text-[10px] font-bold gap-1 px-2 py-0.5"
                    >
                      <RotateCcw className="h-3 w-3" /> {isAr ? "معاد للمراجعة" : "Returned"}
                    </Badge>
                  ) : hasActuals ? (
                    <Badge
                      variant="outline"
                      className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-semibold gap-1 px-2 py-0.5"
                    >
                      <Clock className="h-3 w-3" /> {isAr ? "جاهز للاعتماد" : "Ready"}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/70 font-medium">
                      {isAr ? "لم يبدأ" : "Upcoming"}
                    </span>
                  )}
                </div>

                {/* Bottom Action / Indicator Area */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                  {isApproved ? (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isAr ? "معتمد ومقفل" : "Approved & Locked"}
                      </span>
                      <span className="text-[10px] text-brand font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAr ? "عرض السجلات ←" : "View records →"}
                      </span>
                    </div>
                  ) : isReturned ? (
                    <div className="w-full flex items-center justify-between gap-1">
                      <span
                        className="text-[10px] text-rose-600 truncate font-medium flex items-center gap-1"
                        title={returnReasonText || undefined}
                      >
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {returnReasonText ? returnReasonText : (isAr ? "مطلوب مراجعة" : "Revision needed")}
                        </span>
                      </span>
                      {(role === "admin" || role === "hr") && serverRecord?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveQuarterDirect(q.key);
                          }}
                          disabled={isSubmittingReview}
                          className="h-6 px-1.5 text-[10px] text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer shrink-0 font-semibold"
                        >
                          {isAr ? "اعتماد" : "Approve"}
                        </Button>
                      )}
                    </div>
                  ) : hasActuals ? (
                    (role === "admin" || role === "hr") && serverRecord?.id ? (
                      <div className="w-full flex items-center justify-between gap-1.5">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveQuarterDirect(q.key);
                          }}
                          disabled={isSubmittingReview}
                          className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs flex-1 justify-center gap-1"
                        >
                          <Check className="h-3 w-3" /> {isAr ? `اعتماد ${q.label}` : `Approve ${q.label}`}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReturnQuarterDirect(q.key);
                          }}
                          disabled={isSubmittingReview}
                          className="h-7 px-2 text-[11px] rounded-lg border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer gap-1"
                          title={`Return ${q.label} for revision`}
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span className="hidden sm:inline">{isAr ? "إعادة" : "Return"}</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {isAr ? "بانتظار مراجعة الإدارة" : "Pending review"}
                        </span>
                        <span className="text-[10px] text-brand font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAr ? "عرض السجلات ←" : "View records →"}
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 italic">
                        {isAr ? "لا توجد نتائج مسجلة" : "No actuals recorded"}
                      </span>
                      <span className="text-[10px] text-brand font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAr ? "إدخال السجلات ←" : "Enter records →"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Employee Selector & Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-3xl border border-border bg-card/60 shadow-xs print:border-none print:p-0">
        {/* Employee Selector with Search Box */}
        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {isAr ? "الموظف المُراد تقييمه" : "Target Employee"}
            </Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {employeesList.length} {isAr ? "موظف" : "users"}
            </span>
          </div>

          <Popover open={empSelectorOpen} onOpenChange={setEmpSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={empSelectorOpen}
                disabled={isLocked}
                className="w-full justify-between rounded-xl px-3 py-2 text-sm font-medium shadow-2xs border-input bg-background h-10 hover:bg-muted/30 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate text-start">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-[10px] shrink-0">
                    {currentEmployee.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate font-semibold text-foreground">
                    {currentEmployee.name}
                    {currentEmployee.code ? ` (${currentEmployee.code})` : ""}
                    <span className="text-muted-foreground font-normal"> — {currentEmployee.position}</span>
                  </span>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ms-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(540px,94vw)] p-2 rounded-2xl shadow-xl border-border bg-card z-50"
              align="start"
            >
              <div className="space-y-2">
                {/* Search Box */}
                <div className="relative">
                  <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={empSelectorSearch}
                    onChange={(e) => setEmpSelectorSearch(e.target.value)}
                    placeholder={
                      isAr
                        ? "ابحث بالاسم، كود الموظف، المسمى الوظيفي، أو القسم..."
                        : "Search by name, employee code, job title, or department..."
                    }
                    className="rounded-xl ps-9 text-xs h-9"
                  />
                  {empSelectorSearch && (
                    <button
                      type="button"
                      onClick={() => setEmpSelectorSearch("")}
                      className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground font-medium">
                  <span>
                    {isAr
                      ? `النتائج (${filteredSelectorEmployees.length} من ${employeesList.length})`
                      : `Results (${filteredSelectorEmployees.length} of ${employeesList.length})`}
                  </span>
                  {isManagerMode ? (
                    <span className="text-brand font-semibold text-[10px]">
                      {isAr ? "فريق عملك المباشر" : "Your Direct Team"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">
                      {isAr ? "كافة موظفي الشركة" : "All Company Staff"}
                    </span>
                  )}
                </div>

                {/* Filtered Scrollable List */}
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {filteredSelectorEmployees.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      {isAr ? "لا يوجد موظف مطابق للبحث" : "No employees match your search"}
                    </div>
                  ) : (
                    filteredSelectorEmployees.map((emp) => {
                      const isSelected = emp.id === selectedEmpId;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmpId(emp.id);
                            setEmpSelectorOpen(false);
                            setEmpSelectorSearch("");
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer text-start ${isSelected
                            ? "bg-brand/10 text-brand font-semibold"
                            : "hover:bg-muted/60 text-foreground"
                            }`}
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-[11px] shrink-0">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <div className="truncate flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">{emp.name}</span>
                                {emp.code && (
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                    {emp.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {emp.position} {emp.department ? `• ${emp.department}` : ""}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-brand shrink-0 ms-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Year Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {isAr ? "سنة التقييم" : "Evaluation Year"}
          </Label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value={currentYear}>{currentYear} {isAr ? "(السنة الحالية)" : "(Current Year)"}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear + 1}>{currentYear + 1}</option>
          </select>
        </div>

        {/* Evaluator Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            {isAr ? "المُقيِّم" : "Evaluator Name"}
          </Label>
          <Input
            value={evaluatorName}
            onChange={(e) => setEvaluatorName(e.target.value)}
            disabled={isLocked}
            className="rounded-xl text-sm"
          />
        </div>
      </div>

          {/* Missing Template Guard Alert */}
          {matchedTemplateData && !matchedTemplateData.matched && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/20 p-4 flex items-start gap-3.5 shadow-xs">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {isAr ? "تنبيه: لا يوجد قالب تقييم معتمد لهذا المنصب" : "Missing Published Evaluation Template"}
                </h4>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  {isAr
                    ? `لم يتم العثور على قالب تقييم معتمد ومحدد لقسم (${matchedTemplateData.employee?.department_name || "غير محدد"}) والمسمى الوظيفي (${matchedTemplateData.employee?.position_name || "غير محدد"}). وفقاً للسياسات الإدارية، لا يجوز تقييم الموظف بقالب غير مخصص لوظيفته. يرجى من مسؤول الموارد البشرية إنشاء ونشر قالب مخصص لهذا المنصب.`
                    : `No published evaluation template was found for department (${matchedTemplateData.employee?.department_name || "Unassigned"}) and position (${matchedTemplateData.employee?.position_name || "Unassigned"}). Per company policy, evaluations cannot use mismatched templates. Please publish a template for this role in HR Admin.`}
                </p>
              </div>
            </div>
          )}

          {/* Quarter Workflow Switcher & Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-bold text-muted-foreground me-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-brand" />
                {isAr ? "الربع الجاري:" : "Active Quarter:"}
              </span>
              {(["q1", "q2", "q3", "q4"] as const).map((q) => {
                const qLabel = q.toUpperCase();
                const qPeriod = q === "q1" ? (isAr ? "يناير - مارس" : "Jan - Mar")
                  : q === "q2" ? (isAr ? "أبريل - يونيو" : "Apr - Jun")
                    : q === "q3" ? (isAr ? "يوليو - سبتمبر" : "Jul - Sep")
                      : (isAr ? "أكتوبر - ديسمبر" : "Oct - Dec");
                const isSelected = activeScorecardQuarter === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setActiveScorecardQuarter(q);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isSelected
                      ? "bg-brand text-white shadow-xs"
                      : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                  >
                    <span>{qLabel}</span>
                    <span className="text-[10px] font-normal opacity-80">({qPeriod})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {matchedTemplateData?.matched && matchedTemplateData.template && (
                <Badge variant="secondary" className="gap-1.5 text-xs font-semibold bg-brand/10 text-brand border border-brand/20 py-1">
                  <Layers className="h-3.5 w-3.5" />
                  <span>{isAr ? matchedTemplateData.template.name_ar : matchedTemplateData.template.name_en}</span>
                  {matchedTemplateData.template.version && (
                    <span className="text-[10px] opacity-75 font-mono">v{matchedTemplateData.template.version}</span>
                  )}
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-xs">
                {isAr ? "إجمالي الوزن:" : "Total Weight:"} {(totalTemplateWeight * 100).toFixed(1)}%
              </Badge>
              {activeQuarterFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setActiveQuarterFilter("all")}
                  className="text-xs text-brand font-semibold hover:underline cursor-pointer"
                >
                  {isAr ? "عرض جميع الأرباع" : "Show All Quarters"}
                </button>
              )}
            </div>
          </div>

          {/* Returned for Revision Notice Banner */}
          {(status.toLowerCase() === "returned" ||
            serverRecord?.notes?.returnReason ||
            notes.returnReason ||
            Object.values(quarterStatuses).some((qs: any) => qs.status === "returned") ||
            Object.values(kpiState).some((r: any) => r.isReturned || r.adminNotes)) && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <RotateCcw className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-1.5 w-full">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-xs flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>{isAr ? "ملاحظات الإعادة من إدارة الموارد البشرية" : "Return Notes from Admin / HR"}</span>
                  </h4>
                  <Badge variant="outline" className="border-rose-400/50 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[10px]">
                    {isAr ? "مطلوب المراجعة والتعديل" : "Revision Required"}
                  </Badge>
                </div>
                <div className="rounded-xl bg-background/80 p-3 border border-rose-200 dark:border-rose-900/40 text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed shadow-xs">
                  {serverRecord?.notes?.returnReason ||
                    notes.returnReason ||
                    Object.entries(kpiState)
                      .filter(([_, r]: any) => (r.isReturned || r.adminNotes) && r.adminNotes)
                      .map(([id, r]: any) => {
                        const it = activeScorecardItems.find((k) => String(k.id) === String(id));
                        const name = isAr ? (it?.name_ar || it?.name) : (it?.name || id);
                        return `[${name}]: ${r.adminNotes}`;
                      })
                      .join("\n") ||
                    Object.entries(quarterStatuses)
                      .filter(([_, qs]: any) => qs.status === "returned" && qs.return_reason)
                      .map(([q, qs]: any) => `[${q.toUpperCase()}]: ${qs.return_reason}`)
                      .join("\n") ||
                    notes.growthAreas ||
                    (isAr ? "يرجى مراجعة وتدقيق نسب الإنجاز وإعادة تقديم التقييم للاعتماد." : "Please re-verify achievement rates and re-submit for approval.")}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "يمكنك تعديل الأرقام وملاحظات الأداء في الجدول أدناه ثم الضغط على 'إرسال للمراجعة' بعد الانتهاء."
                    : "You can update the actual metrics in the table below and click 'Submit Review' once done."}
                </p>
              </div>
            </div>
          )}
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
                        <th className="px-2 py-2 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-20">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span>{isAr ? "Q1 الفعلي" : "Q1 Actual"}</span>
                            {isQ1Approved ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                {isAr ? "معتمد" : "Approved"}
                              </span>
                            ) : quarterStatuses.q1?.status === "returned" ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                {isAr ? "مُعاد" : "Returned"}
                              </span>
                            ) : null}
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-16">
                          {isAr ? "Q1 نسبة التحقيق" : "Q1 Achv%"}
                        </th>
                        <th className="px-2 py-2 text-center bg-blue-500/5 text-blue-700 dark:text-blue-300 w-16">
                          {isAr ? "Q1 الدرجة" : "Q1 Score"}
                        </th>
                      </>
                    )}

                    {/* Q2 Columns */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q2") && (
                      <>
                        <th className="px-2 py-2 text-center bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 w-20">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span>{isAr ? "Q2 الفعلي" : "Q2 Actual"}</span>
                            {isQ2Approved ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                {isAr ? "معتمد" : "Approved"}
                              </span>
                            ) : quarterStatuses.q2?.status === "returned" ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                {isAr ? "مُعاد" : "Returned"}
                              </span>
                            ) : null}
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 w-16">
                          {isAr ? "Q2 نسبة التحقيق" : "Q2 Achv%"}
                        </th>
                        <th className="px-2 py-2 text-center bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 w-16">
                          {isAr ? "Q2 الدرجة" : "Q2 Score"}
                        </th>
                      </>
                    )}

                    {/* Q3 Columns */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q3") && (
                      <>
                        <th className="px-2 py-2 text-center bg-amber-500/5 text-amber-700 dark:text-amber-300 w-20">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span>{isAr ? "Q3 الفعلي" : "Q3 Actual"}</span>
                            {isQ3Approved ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                {isAr ? "معتمد" : "Approved"}
                              </span>
                            ) : quarterStatuses.q3?.status === "returned" ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                {isAr ? "مُعاد" : "Returned"}
                              </span>
                            ) : null}
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center bg-amber-500/5 text-amber-700 dark:text-amber-300 w-16">
                          {isAr ? "Q3 نسبة التحقيق" : "Q3 Achv%"}
                        </th>
                        <th className="px-2 py-2 text-center bg-amber-500/5 text-amber-700 dark:text-amber-300 w-16">
                          {isAr ? "Q3 الدرجة" : "Q3 Score"}
                        </th>
                      </>
                    )}

                    {/* Q4 Columns */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q4") && (
                      <>
                        <th className="px-2 py-2 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-20">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span>{isAr ? "Q4 الفعلي" : "Q4 Actual"}</span>
                            {isQ4Approved ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                {isAr ? "معتمد" : "Approved"}
                              </span>
                            ) : quarterStatuses.q4?.status === "returned" ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                {isAr ? "مُعاد" : "Returned"}
                              </span>
                            ) : null}
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-16">
                          {isAr ? "Q4 نسبة التحقيق" : "Q4 Achv%"}
                        </th>
                        <th className="px-2 py-2 text-center bg-purple-500/5 text-purple-700 dark:text-purple-300 w-16">
                          {isAr ? "Q4 الدرجة" : "Q4 Score"}
                        </th>
                      </>
                    )}

                    {/* Annual Summary Columns */}
                    <th className="px-3 py-3 text-center bg-muted/80 font-bold w-20">
                      {isAr ? "المتوسط السنوي" : "Annual Avg"}
                    </th>
                    <th className="px-2 py-3 text-center w-14 print:hidden"></th>
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

                        {cat.items.length === 0 && (
                          <tr>
                            <td colSpan={19} className="px-4 py-3 text-center text-xs text-muted-foreground italic bg-muted/10">
                              {isAr ? "لا توجد معايير مقترنة بهذه الفئة حالياً" : "No criteria currently assigned to this category"}
                            </td>
                          </tr>
                        )}

                        {/* KPI / Criteria Rows */}
                        {cat.items.map((kpi) => {
                          const row = kpiState[kpi.id] || {
                            id: kpi.id as any,
                            targetAnnual: kpi.target,
                            q1: { actual: null, achievement: null, score: null },
                            q2: { actual: null, achievement: null, score: null },
                            q3: { actual: null, achievement: null, score: null },
                            q4: { actual: null, achievement: null, score: null },
                            annualScore: null,
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

                          const formatActualDisplay = (val: number | null, inputType: string, unit: string) => {
                            if (val === null) return "";
                            if (inputType === "rating_5" || unit === "scale") {
                              return (val * 5).toFixed(1);
                            }
                            if (unit === "%") {
                              return `${(val * 100).toFixed(0)}%`;
                            }
                            return String(val);
                          };

                          const placeholderText = kpi.inputType === "rating_5" || kpi.unit === "scale" ? "1-5" : kpi.unit || "%";

                          const hasRowReturn = Boolean((row as any).isReturned || (row as any).adminNotes);

                          return (
                            <tr
                              key={kpi.id}
                              className={`transition-colors ${
                                hasRowReturn
                                  ? "bg-amber-500/10 dark:bg-amber-950/25 border-s-4 border-s-amber-500"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <td className="px-3 py-2 text-muted-foreground font-mono font-medium text-center">
                                {kpi.numericIndex}
                              </td>
                              <td className="px-3 py-2">
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-foreground leading-snug flex items-center flex-wrap gap-1.5">
                                    <span>{isAr ? kpi.name_ar : kpi.name}</span>
                                    {kpi.direction === "lower_is_better" && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-normal">
                                        {isAr ? "الأقل أفضل" : "Lower is better"}
                                      </span>
                                    )}
                                    {hasRowReturn && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30">
                                        <AlertTriangle className="h-3 w-3 text-amber-600 animate-pulse" />
                                        <span>{isAr ? "مطلوب مراجعة المؤشر" : "Revision Needed"}</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    {isAr ? kpi.definition_ar : kpi.definition}
                                  </p>
                                  {(row as any).adminNotes && (
                                    <div className="mt-1 p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-1.5 font-medium leading-relaxed shadow-xs">
                                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-bold text-amber-800 dark:text-amber-300">{isAr ? "ملاحظة الإدارة:" : "Admin Return Note:"} </span>
                                        <span className="whitespace-pre-wrap">{(row as any).adminNotes}</span>
                                      </div>
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

                              {/* Q1 Inputs & Scores */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q1") && (
                                <>
                                  <td className="px-1 py-1 text-center bg-blue-500/5">
                                    <Input
                                      type="text"
                                      disabled={isQ1Disabled}
                                      value={formatActualDisplay(row.q1.actual, kpi.inputType, kpi.unit)}
                                      onChange={(e) => handleActualChange(kpi.id, "q1", e.target.value)}
                                      placeholder={placeholderText}
                                      className={`h-7 w-16 text-center font-mono text-xs mx-auto p-1 rounded-lg ${
                                        isQ1Approved ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold" : ""
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono bg-blue-500/5">
                                    {fmtPercent(row.q1.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono font-bold bg-blue-500/5 text-blue-700 dark:text-blue-300">
                                    {fmtRawScore(row.q1.score)}
                                  </td>
                                </>
                              )}

                              {/* Q2 Inputs & Scores */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q2") && (
                                <>
                                  <td className="px-1 py-1 text-center bg-emerald-500/5">
                                    <Input
                                      type="text"
                                      disabled={isQ2Disabled}
                                      value={formatActualDisplay(row.q2.actual, kpi.inputType, kpi.unit)}
                                      onChange={(e) => handleActualChange(kpi.id, "q2", e.target.value)}
                                      placeholder={placeholderText}
                                      className={`h-7 w-16 text-center font-mono text-xs mx-auto p-1 rounded-lg ${
                                        isQ2Approved ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold" : ""
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono bg-emerald-500/5">
                                    {fmtPercent(row.q2.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono font-bold bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                                    {fmtRawScore(row.q2.score)}
                                  </td>
                                </>
                              )}

                              {/* Q3 Inputs & Scores */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q3") && (
                                <>
                                  <td className="px-1 py-1 text-center bg-amber-500/5">
                                    <Input
                                      type="text"
                                      disabled={isQ3Disabled}
                                      value={formatActualDisplay(row.q3.actual, kpi.inputType, kpi.unit)}
                                      onChange={(e) => handleActualChange(kpi.id, "q3", e.target.value)}
                                      placeholder={placeholderText}
                                      className={`h-7 w-16 text-center font-mono text-xs mx-auto p-1 rounded-lg ${
                                        isQ3Approved ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold" : ""
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono bg-amber-500/5">
                                    {fmtPercent(row.q3.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono font-bold bg-amber-500/5 text-amber-700 dark:text-amber-300">
                                    {fmtRawScore(row.q3.score)}
                                  </td>
                                </>
                              )}

                              {/* Q4 Inputs & Scores */}
                              {(activeQuarterFilter === "all" || activeQuarterFilter === "q4") && (
                                <>
                                  <td className="px-1 py-1 text-center bg-purple-500/5">
                                    <Input
                                      type="text"
                                      disabled={isQ4Disabled}
                                      value={formatActualDisplay(row.q4.actual, kpi.inputType, kpi.unit)}
                                      onChange={(e) => handleActualChange(kpi.id, "q4", e.target.value)}
                                      placeholder={placeholderText}
                                      className={`h-7 w-16 text-center font-mono text-xs mx-auto p-1 rounded-lg ${
                                        isQ4Approved ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold" : ""
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono bg-purple-500/5">
                                    {fmtPercent(row.q4.achievement, 0)}
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono font-bold bg-purple-500/5 text-purple-700 dark:text-purple-300">
                                    {fmtRawScore(row.q4.score)}
                                  </td>
                                </>
                              )}

                              {/* Annual Score Column */}
                              <td className="px-3 py-2 text-center font-mono font-extrabold bg-muted/60 text-foreground">
                                {fmtRawScore(row.annualScore)}
                              </td>

                              {/* Actions: Return / Add Notes (for admin) & Alert Popover (for manager) & Info Dialog */}
                              <td className="px-2 py-2 text-center print:hidden">
                                <div className="flex items-center justify-center gap-1">
                                  {(role === "admin" || role === "hr") && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenMetricReturnModal(kpi)}
                                      className={`h-6 w-6 rounded-lg cursor-pointer transition-colors ${(row as any).adminNotes || (row as any).isReturned
                                        ? "text-amber-600 bg-amber-500/15 hover:bg-amber-500/25 ring-1 ring-amber-500/40"
                                        : "text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                                        }`}
                                      title={
                                        (row as any).adminNotes
                                          ? (isAr ? `ملاحظة الإعادة: ${(row as any).adminNotes}` : `Return note: ${(row as any).adminNotes}`)
                                          : (isAr ? "إعادة المؤشر وإضافة ملاحظات" : "Return metric & add notes")
                                      }
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                  )}

                                  {role === "manager" && hasRowReturn && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 rounded-lg text-amber-600 bg-amber-500/20 hover:bg-amber-500/30 ring-1 ring-amber-500/50 cursor-pointer animate-pulse"
                                          title={isAr ? `تنبيه مراجعة: ${(row as any).adminNotes || "المؤشر مطلوب مراجعته"}` : `Review Needed: ${(row as any).adminNotes || "This metric requires revision"}`}
                                        >
                                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80 p-3.5 text-xs space-y-2.5 border-amber-300 bg-amber-50/95 dark:bg-amber-950/95 dark:border-amber-800 text-foreground shadow-lg" align="end">
                                        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-xs">
                                          <AlertCircle className="h-4 w-4 text-amber-600" />
                                          <span>{isAr ? "ملاحظة الإعادة من الإدارة" : "Admin Return Instructions"}</span>
                                        </div>
                                        <p className="text-[11px] text-foreground whitespace-pre-wrap leading-relaxed bg-background/70 p-2 rounded-lg border border-amber-200 dark:border-amber-800/60">
                                          {(row as any).adminNotes || (isAr ? "يرجى مراجعة وتعديل هذا المؤشر وإعادة تقديمه." : "Please review and revise this metric before resubmitting.")}
                                        </p>
                                        <div className="space-y-1.5 pt-1 border-t border-amber-200/70 dark:border-amber-800/60">
                                          <Label className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                                            {isAr ? "الرد على الملاحظة:" : "Your Response / Action Taken:"}
                                          </Label>
                                          <textarea
                                            rows={2}
                                            value={managerRowReplies[String(kpi.id)] || ""}
                                            onChange={(e) =>
                                              setManagerRowReplies((prev) => ({
                                                ...prev,
                                                [String(kpi.id)]: e.target.value,
                                              }))
                                            }
                                            placeholder={isAr ? "اكتب ردك أو التعديل الذي تم..." : "Enter your reply or revision note..."}
                                            className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-background px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                                          />
                                          <Button
                                            type="button"
                                            size="sm"
                                            disabled={saveMutation.isPending}
                                            onClick={() => handleResolveRowReturn(kpi)}
                                            className="w-full h-7 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5"
                                          >
                                            {saveMutation.isPending ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Check className="h-3 w-3" />
                                            )}
                                            <span>{isAr ? "إرسال الرد وإغلاق الملاحظة" : "Answer & Resolve"}</span>
                                          </Button>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  )}

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setInfoModalKpi(kpi as any)}
                                    className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                                    title={isAr ? "معلومات وطريقة قياس المؤشر" : "Metric Measurement & Definition"}
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* Summary Footer Row */}
                  <tr className="bg-muted font-bold text-foreground border-t-2 border-border">
                    <td colSpan={4} className="px-4 py-3 text-end uppercase tracking-wider text-xs">
                      {isAr ? "المجموع الموزون والنتيجة السنوية العامة:" : "Total Weighted Annual Performance Score:"}
                    </td>

                    {/* Q1 Total */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q1") && (
                      <td colSpan={3} className="px-3 py-3 text-center font-mono text-sm bg-blue-500/10 text-blue-700 dark:text-blue-300">
                        {fmtPercent(summaryTotals.q1Sum, 2)}
                      </td>
                    )}

                    {/* Q2 Total */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q2") && (
                      <td colSpan={3} className="px-3 py-3 text-center font-mono text-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        {fmtPercent(summaryTotals.q2Sum, 2)}
                      </td>
                    )}

                    {/* Q3 Total */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q3") && (
                      <td colSpan={3} className="px-3 py-3 text-center font-mono text-sm bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        {fmtPercent(summaryTotals.q3Sum, 2)}
                      </td>
                    )}

                    {/* Q4 Total */}
                    {(activeQuarterFilter === "all" || activeQuarterFilter === "q4") && (
                      <td colSpan={3} className="px-3 py-3 text-center font-mono text-sm bg-purple-500/10 text-purple-700 dark:text-purple-300">
                        {fmtPercent(summaryTotals.q4Sum, 2)}
                      </td>
                    )}

                    {/* Annual Weighted Total */}
                    <td className="px-3 py-3 text-center font-mono text-base font-extrabold bg-brand text-white shadow-xs">
                      {summaryTotals.hasData ? fmtPercent(summaryTotals.annualWeightedSum, 2) : "—"}
                    </td>

                    <td className="print:hidden"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>



          {/* Qualitative Assessment & Formal Sign-off (Integrated into Scorecard) */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-6">
            <div>
              <h2 className="font-display text-base font-bold text-foreground">
                {isAr ? "التقييم النوعي والاعتمادات الرسمية" : "Qualitative Assessment & Formal Sign-off"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "توثيق نقاط القوة، مجالات التحسين المستمر، والتوصيات التدريبية والاعتمادات الرسمية."
                  : "Document strengths, coaching development areas, and official sign-offs."}
              </p>
            </div>

            <div className="space-y-4">
              {/* Strengths */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {isAr ? "أبرز نقاط القوة والإنجازات:" : "Major Strengths & Key Achievements:"}
                </Label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  value={notes.strengths}
                  onChange={(e) => {
                    setNotes((prev) => ({ ...prev, strengths: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={isAr ? "اكتب تفاصيل إنجازات الموظف..." : "Detail specific achievements..."}
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Growth Areas */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  {isAr ? "مجالات التحسين والتطوير المستمر:" : "Priority Growth & Improvement Areas:"}
                </Label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  value={notes.growthAreas}
                  onChange={(e) => {
                    setNotes((prev) => ({ ...prev, growthAreas: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={isAr ? "حدد مجالات العمل التي تتطلب تطوير..." : "Identify tasks requiring development..."}
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Recommendations */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-brand" />
                  {isAr ? "التوصيات التدريبية والشهادات المهنية المعتمدة:" : "Recommended Training, Certifications & Milestones:"}
                </Label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  value={notes.recommendations}
                  onChange={(e) => {
                    setNotes((prev) => ({ ...prev, recommendations: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={isAr ? "الدورات والشهادات المهنية الموصى بها..." : "Specific training milestones..."}
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

        {/* ── TAB: PENDING RETURNS (MANAGER PANEL) ── */}
        {isManagerMode && returnedEvaluations.length > 0 && (
          <TabsContent value="pending-returns" className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
                      <RotateCcw className="h-3.5 w-3.5" />
                      {isAr ? "معاملات معادة للمراجعة" : "Returned Submissions"}
                    </span>
                    <Badge className="bg-rose-500 text-white text-[10px] font-mono px-2 py-0.5">
                      {returnedEvaluations.length} {isAr ? "معاملة" : "Items"}
                    </Badge>
                  </div>
                  <h2 className="font-display text-lg font-bold text-foreground mt-1">
                    {isAr ? "التقييمات المعادة من الإدارة مع ملاحظات التدقيق" : "Pending Returns from Admin & HR Revision Notes"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "قائمة التقييمات التي تمت إعادتها من قبل إدارة الموارد البشرية للتعديل والمراجعة. يرجى الاطلاع على ملاحظات الإدارة وإجراء التعديلات المطلوبة وإعادة تقديمها."
                      : "Evaluations returned by HR Admin requiring revision. Review the return notes, update evaluation scores in the scorecard, and resubmit for approval."}
                  </p>
                </div>

                {/* Quarter Filter Chips */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border text-xs shrink-0">
                  {(["all", "q1", "q2", "q3", "q4"] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setReturnedQuarterFilter(q)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        returnedQuarterFilter === q
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {q === "all" ? (isAr ? "الكل" : "All") : q.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingReturned ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                  <span>{isAr ? "جارٍ تحميل التقييمات المعادة..." : "Loading returned evaluations..."}</span>
                </div>
              ) : returnedEvaluations.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <h3 className="font-semibold text-sm text-foreground">
                    {isAr ? "لا توجد أي تقييمات معادة بانتظار المراجعة" : "No Pending Returns"}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {isAr
                      ? "كافة التقييمات المقدمة لفريقك مقبولة ومعتمدة أو قيد التدقيق لدى الإدارة."
                      : "All evaluations for your team are accepted, under review, or approved."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-card">
                  {returnedEvaluations
                    .filter((item: any) => {
                      if (returnedQuarterFilter === "all") return true;
                      const q = String(item.quarter || "").toLowerCase();
                      return q === returnedQuarterFilter || q === "annual";
                    })
                    .map((item: any) => {
                      const empName = item.employee?.full_name || (isAr ? "موظف" : "Employee");
                      const empCode = item.employee?.emp_code;
                      const position = item.employee?.position?.name_en || (isAr ? "مهندس موقع" : "Site Engineer");
                      const dept = item.employee?.department?.name_en || (isAr ? "الهندسة" : "Engineering");
                      const quarterUpper = String(item.quarter || "q1").toUpperCase();
                      const score = Number(item.score ?? 0);
                      const rating = getRatingFromScore(score / 100, true);

                      return (
                        <div
                          key={item.id}
                          className="p-5 flex flex-col gap-3.5 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                                {empName.slice(0, 2)}
                              </div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-foreground">{empName}</span>
                                  {empCode && (
                                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                      {empCode}
                                    </Badge>
                                  )}
                                  <Badge className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0">
                                    {quarterUpper === "ANNUAL" ? (isAr ? "تقييم سنوي" : "Annual") : `${quarterUpper} ${item.evaluation_year}`}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] text-rose-700 bg-rose-100 dark:bg-rose-950/40">
                                    {isAr ? "معاد للمراجعة" : "Returned for Revision"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {position} • {dept}
                                </p>
                                {item.returned_at && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {isAr ? "تاريخ الإعادة: " : "Returned at: "}
                                    <span className="font-mono text-[10px]">
                                      {new Date(item.returned_at).toLocaleString()}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-end">
                                <div className="font-mono font-extrabold text-sm text-foreground">
                                  {score.toFixed(1)}%
                                </div>
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {isAr ? rating.tier_ar : rating.tier}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleOpenReturnedEvaluation(item)}
                                className="h-8 rounded-xl text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white cursor-pointer shadow-xs"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>{isAr ? "تعديل في بطاقة التقييم" : "Revise in Scorecard"}</span>
                              </Button>
                            </div>
                          </div>

                          {/* Prominent Admin Return Note Box */}
                          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20 p-3.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <span>{isAr ? "ملاحظة الإدارة وسبب الإعادة:" : "Admin Return Reason & Guidance:"}</span>
                            </div>
                            <p className="text-xs text-rose-950 dark:text-rose-200 leading-relaxed font-medium whitespace-pre-wrap">
                              {item.return_reason}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ── TAB: PENDING APPROVALS (HR ADMIN) ── */}
        {!isManagerMode && (
          <TabsContent value="pending-approvals" className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                      <Clock className="h-3.5 w-3.5" />
                      {isAr ? "معاملات الاعتماد والتدقيق" : "Quarterly Review Queue"}
                    </span>
                    <Badge className="bg-amber-500 text-white text-[10px] font-mono px-2 py-0.5">
                      {pendingApprovals.length} {isAr ? "بانتظار الإجراء" : "Pending Action"}
                    </Badge>
                  </div>
                  <h2 className="font-display text-lg font-bold text-foreground mt-1">
                    {isAr ? "طلبات اعتماد تقييمات الأداء الربع سنوية" : "Quarterly Evaluation Approval Requests"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "مراجعة تقييمات الأداء الربع سنوية المقدمة من المشرفين والمديرين لاعتمادها رسمياً أو إعادتها للمراجعة مع ذكر السبب."
                      : "Review submitted quarterly evaluations from direct supervisors. Approve formally or return for revision with feedback."}
                  </p>
                </div>

                {/* Quarter Filter Chips */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border text-xs shrink-0">
                  {(["all", "q1", "q2", "q3", "q4"] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setPendingQuarterFilter(q)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${pendingQuarterFilter === q
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {q === "all" ? (isAr ? "الكل" : "All") : q.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* List / Table of Pending Approvals */}
              {isLoadingPending ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                  <span>{isAr ? "جارٍ تحميل المعاملات المعلقة..." : "Loading pending approvals..."}</span>
                </div>
              ) : pendingApprovals.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-2">
                  <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto" />
                  <h3 className="font-semibold text-sm text-foreground">
                    {isAr ? "لا توجد أي تقييمات معلقة بانتظار الاعتماد" : "No Pending Approvals"}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {isAr
                      ? "تمت مراجعة واعتماد كافة التقييمات المقدمة لعام " + selectedYear
                      : "All quarterly submissions for year " + selectedYear + " have been reviewed and approved."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-card">
                  {pendingApprovals
                    .filter((item: any) => {
                      if (pendingQuarterFilter === "all") return true;
                      const q = (item.quarter || "").toLowerCase();
                      if (q === pendingQuarterFilter || q === "annual") return true;
                      if (Array.isArray(item.quarters) && item.quarters.includes(pendingQuarterFilter)) return true;
                      return false;
                    })
                    .map((item: any) => {
                      const empName = item.employee?.full_name || (isAr ? "موظف" : "Employee");
                      const empCode = item.employee?.emp_code;
                      const position = item.employee?.position?.name_en || (isAr ? "مهندس موقع" : "Site Engineer");
                      const dept = item.employee?.department?.name_en || (isAr ? "الهندسة" : "Engineering");
                      const quarterUpper = (item.quarter || "q1").toUpperCase();
                      const score = Number(item.total_score ?? item.score ?? 0);
                      const rating = getRatingFromScore(score / 100, true);

                      return (
                        <div
                          key={item.id}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                        >
                          {/* Employee & Quarter Info */}
                          <div
                            className="flex items-start gap-3 cursor-pointer group"
                            onClick={() => handleNavigateToScorecard(item)}
                            title={isAr ? "عرض بطاقة تقييم الموظف" : "View Employee Scorecard"}
                          >
                            <div className="h-10 w-10 rounded-2xl bg-brand/10 text-brand font-bold text-xs flex items-center justify-center shrink-0 uppercase group-hover:scale-105 transition-transform">
                              {empName.slice(0, 2)}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground group-hover:text-brand transition-colors">{empName}</span>
                                {empCode && (
                                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                    {empCode}
                                  </Badge>
                                )}
                                <Badge className="bg-brand text-brand-foreground text-[10px] font-bold px-2 py-0">
                                  {quarterUpper === "ANNUAL" ? (isAr ? "تقييم سنوي وفصلي" : "Annual / Qs") : `${quarterUpper} ${item.evaluation_year}`}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {position} • {dept}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {isAr ? "المُقيّم: " : "Submitted by: "}
                                <strong className="text-foreground">{item.evaluator_name || "Manager"}</strong>
                                {item.submitted_at && (
                                  <span className="ms-2 font-mono text-[10px]">
                                    ({new Date(item.submitted_at).toLocaleDateString()})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Score & Actions */}
                          <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end">
                            <div className="text-start md:text-end pe-2">
                              <div className="font-mono font-extrabold text-sm text-foreground">
                                {score.toFixed(1)}%
                              </div>
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {isAr ? rating.tier_ar : rating.tier}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleNavigateToScorecard(item)}
                                className="h-8 rounded-xl text-xs gap-1 cursor-pointer"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{isAr ? "عرض التفاصيل" : "Scorecard"}</span>
                              </Button>

                              {/* Per-Quarter Approval Buttons */}
                              {Array.isArray(item.quarters) && item.quarters.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {item.quarters.map((q: string) => {
                                    const isQApproved = item.quarter_statuses?.[q]?.status === "approved";
                                    if (isQApproved) {
                                      return (
                                        <Badge
                                          key={q}
                                          variant="outline"
                                          className="h-8 border-emerald-500/40 text-emerald-600 bg-emerald-500/5 text-[10px] gap-1 px-2 py-0"
                                        >
                                          <Check className="h-3 w-3" /> {q.toUpperCase()} {isAr ? "معتمد" : "Approved"}
                                        </Badge>
                                      );
                                    }

                                    return (
                                      <div key={q} className="flex items-center gap-1">
                                        <Button
                                          size="sm"
                                          onClick={() => handleApproveQuarter(item, q)}
                                          disabled={isSubmittingReview}
                                          className="h-8 rounded-xl text-xs gap-1 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                                          title={`Approve ${q.toUpperCase()}`}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                          <span>{isAr ? `اعتماد ${q.toUpperCase()}` : `Approve ${q.toUpperCase()}`}</span>
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleOpenReturnModal(item, q)}
                                          disabled={isSubmittingReview}
                                          className="h-8 rounded-xl text-xs gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                                          title={`Return ${q.toUpperCase()}`}
                                        >
                                          <RotateCcw className="h-3.5 w-3.5" />
                                          <span>{isAr ? `إعادة ${q.toUpperCase()}` : `Return ${q.toUpperCase()}`}</span>
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenReturnModal(item)}
                                    disabled={isSubmittingReview}
                                    className="h-8 rounded-xl text-xs gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>{isAr ? "إعادة للتعديل" : "Return"}</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    onClick={() => handleApprovePending(item)}
                                    disabled={isSubmittingReview}
                                    className="h-8 rounded-xl text-xs gap-1 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>{isAr ? "اعتماد رسمي" : "Approve"}</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ── TAB: TEMPLATES & CRITERIA CATALOG (HR ADMIN) ── */}
        {!isManagerMode && (
          <TabsContent value="templates-criteria" className="space-y-4">
            {/* Sub-tab Navigation: Templates vs Criteria */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              <button
                type="button"
                onClick={() => setTemplateSubTab("templates")}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${templateSubTab === "templates"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Layers className="h-4 w-4" />
                <span>{isAr ? "قوالب التقييم الوظيفية" : "Job Role Templates"}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 font-mono ${templateSubTab === "templates" ? "border-brand-foreground/30 text-brand-foreground" : ""
                    }`}
                >
                  {kpiTemplates.length}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setTemplateSubTab("criteria")}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${templateSubTab === "criteria"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Award className="h-4 w-4" />
                <span>{isAr ? "دليل ومكتبة المعايير" : "Criteria Library"}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 font-mono ${templateSubTab === "criteria" ? "border-brand-foreground/30 text-brand-foreground" : ""
                    }`}
                >
                  {kpiCriteria.length}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setTemplateSubTab("job-descriptions")}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${templateSubTab === "job-descriptions"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <FileText className="h-4 w-4" />
                <span>{isAr ? "الأوصاف الوظيفية" : "Job Descriptions"}</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplateSubTab("kpis-definition")}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${templateSubTab === "kpis-definition"
                  ? "bg-brand text-brand-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Target className="h-4 w-4" />
                <span>{isAr ? "تعريف المؤشرات" : "KPIs Definition"}</span>
              </button>
            </div>

            {templateSubTab === "job-descriptions" && <JobDescriptionsTab />}
            {templateSubTab === "kpis-definition" && (
              <KpisDefinitionTab
                kpiTemplates={kpiTemplates}
                departmentsData={departmentsData}
                positionsData={positionsData}
                selectedYear={selectedYear}
              />
            )}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* VIEW A: TEMPLATES MANAGER                                         */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {templateSubTab === "job-descriptions" || templateSubTab === "kpis-definition" ? null : templateSubTab === "templates" ? (
              <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                        <Layers className="h-3.5 w-3.5" />
                        {isAr ? "محرك قوالب التقييم" : "Template Engine"}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {kpiTemplates.length} {isAr ? "قوالب" : "Templates"}
                      </Badge>
                    </div>
                    <h2 className="font-display text-lg font-bold text-foreground mt-1">
                      {isAr ? "قوالب تقييم الوظائف والمستويات المهنية" : "Job Role Evaluation Templates"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {isAr
                        ? "إدارة قوالب التقييم وفق الهيكل: الإدارة ← المسمى الوظيفي ← المستوى المهني (Junior, Mid, Senior, Lead). يجب أن يساوي مجموع الأوزان 100% بالضبط للنشر."
                        : "Configure templates tailored by Department → Position → Seniority Level. Sum of criteria weights must equal exactly 100% to publish."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Hidden as requested - code preserved */}
                    <Button
                      onClick={handleSeedDefaultTemplates}
                      variant="outline"
                      size="sm"
                      disabled={isSeedingTemplates}
                      className="hidden rounded-2xl gap-1.5 cursor-pointer text-xs border-brand/30 hover:bg-brand/5"
                      style={{ display: "none" }}
                      title={isAr ? "إدراج قوالب الوظائف الافتراضية (هندسة، برمجيات، موارد بشرية، محاسبة، مبيعات)" : "Seed standard templates for Engineering, IT, HR, Finance, Sales"}
                    >
                      {isSeedingTemplates ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : <Sparkles className="h-4 w-4 text-brand" />}
                      <span>{isAr ? "إدراج القوالب الافتراضية" : "Seed Default Templates"}</span>
                    </Button>
                    <Button
                      onClick={handleOpenCreateTemplate}
                      size="sm"
                      className="rounded-2xl gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer shadow-xs"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{isAr ? "إنشاء قالب جديد" : "Create New Template"}</span>
                    </Button>
                  </div>
                </div>

                {/* Filter bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Input
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder={isAr ? "بحث بالاسم أو المنصب أو القسم..." : "Search templates, roles, depts..."}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <select
                      value={templateDeptFilter}
                      onChange={(e) => setTemplateDeptFilter(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                    >
                      <option value="all">{isAr ? "جميع الأقسام" : "All Departments"}</option>
                      {(departmentsData || []).map((dept: any) => (
                        <option key={dept.id} value={dept.id}>
                          {isAr ? dept.name_ar || dept.name_en : dept.name_en || dept.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={templateStatusFilter}
                      onChange={(e) => setTemplateStatusFilter(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                    >
                      <option value="all">{isAr ? "جميع الحالات" : "All Statuses"}</option>
                      <option value="published">{isAr ? "معتمد ومنشور" : "Published"}</option>
                      <option value="draft">{isAr ? "مسودة" : "Draft"}</option>
                    </select>
                  </div>
                </div>

                {/* Templates Grid */}
                {isLoadingTemplates ? (
                  <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    <span>{isAr ? "جارٍ تحميل القوالب..." : "Loading templates..."}</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-3">
                    <Layers className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">
                      {isAr ? "لا توجد قوالب تطابق البحث" : "No templates found matching your criteria"}
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {/* Hidden as requested - code preserved */}
                      <Button
                        size="sm"
                        onClick={handleSeedDefaultTemplates}
                        disabled={isSeedingTemplates}
                        className="hidden rounded-xl text-xs gap-1.5 cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
                        style={{ display: "none" }}
                      >
                        {isSeedingTemplates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        <span>{isAr ? "إدراج القوالب الافتراضية الجاهزة" : "Seed Default Templates"}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenCreateTemplate}
                        className="rounded-xl text-xs gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isAr ? "إنشاء قالب مخصص" : "Create Custom Template"}</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((tmpl: any) => {
                      const totalWeight = Math.round(
                        (tmpl.items || []).reduce((acc: number, it: any) => acc + Number(it.weight || 0), 0) * 100
                      );
                      const is100 = totalWeight === 100;
                      const isPublished = tmpl.status === "published";
                      const version = tmpl.version || 1;

                      return (
                        <div
                          key={tmpl.id}
                          className="rounded-2xl border border-border bg-card p-4 shadow-xs hover:border-brand/40 transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <h3 className="font-bold text-sm text-foreground leading-tight">
                                  {isAr ? tmpl.name_ar || tmpl.name_en : tmpl.name_en}
                                </h3>
                                {tmpl.name_ar && !isAr && (
                                  <p className="text-[11px] text-muted-foreground font-arabic" dir="rtl">
                                    {tmpl.name_ar}
                                  </p>
                                )}
                                {tmpl.name_en && isAr && (
                                  <p className="text-[11px] text-muted-foreground font-mono">
                                    {tmpl.name_en}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-muted/40">
                                  v{version}
                                </Badge>
                                {isPublished ? (
                                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0">
                                    {isAr ? "معتمد" : "Published"}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-2 py-0">
                                    {isAr ? "مسودة" : "Draft"}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Role Badges */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium">
                                {tmpl.department ? (isAr ? tmpl.department.name_ar || tmpl.department.name_en : tmpl.department.name_en) : (isAr ? "كل الأقسام" : "All Departments")}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium bg-brand/10 text-brand">
                                {tmpl.position ? (isAr ? tmpl.position.name_ar || tmpl.position.name_en : tmpl.position.name_en) : (isAr ? "كل المناصب" : "All Positions")}
                              </Badge>
                              {tmpl.job_grade && (
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold text-purple-600 border-purple-300 dark:border-purple-800">
                                  {isAr ? tmpl.job_grade.name_ar || tmpl.job_grade.name_en : tmpl.job_grade.name_en}
                                </Badge>
                              )}
                            </div>

                            {/* Weight & Criteria Count Banner */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/60 text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Award className="h-3 w-3 text-brand" />
                                <span>{tmpl.items?.length || 0} {isAr ? "معايير" : "KPIs"}</span>
                              </span>
                              <span className={`font-mono font-bold text-xs ${is100 ? "text-emerald-600" : "text-amber-600"}`}>
                                {isAr ? `مجموع الأوزان: ${totalWeight}%` : `Weight: ${totalWeight}%`}
                              </span>
                            </div>

                            {/* Items Preview */}
                            <div className="space-y-1">
                              {(tmpl.items || []).slice(0, 3).map((it: any, iIdx: number) => {
                                const critName = isAr
                                  ? it.criterion?.name_ar || it.criterion?.name_en || `#${iIdx + 1}`
                                  : it.criterion?.name_en || it.criterion?.name_ar || `#${iIdx + 1}`;
                                const itWeight = Math.round(Number(it.weight || 0) * 100);
                                return (
                                  <div key={it.id || iIdx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="truncate max-w-[200px]">• {critName}</span>
                                    <span className="font-mono text-[10px] shrink-0 font-semibold">{itWeight}%</span>
                                  </div>
                                );
                              })}
                              {(tmpl.items || []).length > 3 && (
                                <p className="text-[10px] text-muted-foreground/80 italic text-end">
                                  + {(tmpl.items || []).length - 3} {isAr ? "معايير أخرى" : "more criteria"}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="pt-3 border-t border-border flex items-center justify-between gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditTemplate(tmpl)}
                              className="h-7 text-xs rounded-xl px-2.5 gap-1 cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>{isAr ? "تعديل" : "Edit"}</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDuplicateTemplate(tmpl)}
                              className="h-7 text-xs rounded-xl px-2.5 gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Copy className="h-3 w-3" />
                              <span>{isAr ? "استنساخ" : "Duplicate"}</span>
                            </Button>

                            {!isPublished && (
                              <Button
                                size="sm"
                                onClick={() => handlePublishTemplateDirectly(tmpl.id)}
                                disabled={!is100}
                                className={`h-7 text-xs rounded-xl px-2.5 gap-1 cursor-pointer ${is100 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "opacity-50 cursor-not-allowed"
                                  }`}
                                title={!is100 ? (isAr ? "يتطلب مجموع 100% للنشر" : "Requires 100% total weight") : ""}
                              >
                                <ShieldCheck className="h-3 w-3" />
                                <span>{isAr ? "نشر" : "Publish"}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ═════════════════════════════════════════════════════════════════ */
              /* VIEW B: CRITERIA LIBRARY                                         */
              /* ═════════════════════════════════════════════════════════════════ */
              <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                        <Award className="h-3.5 w-3.5" />
                        {isAr ? "دليل المعايير والمؤشرات" : "Criteria Catalog"}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {kpiCriteria.length} {isAr ? "معياراً مسجلاً" : "Criteria"}
                      </Badge>
                    </div>
                    <h2 className="font-display text-lg font-bold text-foreground mt-1">
                      {isAr ? "إدارة بنك معايير ومؤشرات الأداء" : "KPI Criteria Library & Measurement Definitions"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {isAr
                        ? "المعايير المعتمدة المتاحة لإدراجها في قوالب تقييم الوظائف المختلفة مع اتجاهات القياس والوحدات."
                        : "Approved metric definitions with scoring directions (Higher is better, Lower is better, 1-5 scale) and target benchmarks."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleDownloadCriteriaTemplate}
                      variant="outline"
                      size="sm"
                      className="rounded-2xl gap-1.5 border-border hover:bg-muted/60 cursor-pointer shadow-xs text-xs font-medium"
                      title={isAr ? "تحميل نموذج إكسيل مجهز بالمعايير والأمثلة" : "Download ready-made Excel template with sample criteria"}
                    >
                      <FileDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{isAr ? "تحميل نموذج مجهز" : "Download Template"}</span>
                    </Button>

                    <input
                      ref={criteriaFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportCriteriaFile}
                      className="hidden"
                    />
                    <Button
                      onClick={() => criteriaFileInputRef.current?.click()}
                      variant="outline"
                      size="sm"
                      disabled={isImportingCriteria}
                      className="rounded-2xl gap-1.5 border-border hover:bg-muted/60 cursor-pointer shadow-xs text-xs font-medium"
                      title={isAr ? "استيراد معايير من ملف إكسيل أو CSV" : "Import criteria from Excel or CSV"}
                    >
                      {isImportingCriteria ? (
                        <Loader2 className="h-4 w-4 animate-spin text-brand" />
                      ) : (
                        <Upload className="h-4 w-4 text-brand" />
                      )}
                      <span>{isImportingCriteria ? (isAr ? "جاري الاستيراد..." : "Importing...") : (isAr ? "استيراد من إكسيل" : "Import from Excel")}</span>
                    </Button>

                    <Button
                      onClick={handleOpenAddCriterion}
                      size="sm"
                      className="rounded-2xl gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer shadow-xs text-xs font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{isAr ? "إضافة معيار جديد" : "Add Criterion"}</span>
                    </Button>
                  </div>
                </div>

                {/* Architecture 3-Layer Weight Summary Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                        {isAr ? "1. المعايير العامة للشركة" : "1. Company Common Layer"}
                      </span>
                      <Badge className="bg-blue-600 text-white font-mono text-[10px]">40.0%</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isAr
                        ? "الانضباط والمواعيد، السلوك المهني والسياسات، العمل الجماعي، والمبادرة والمسؤولية."
                        : "Attendance & punctuality, code of conduct, teamwork, initiative & ownership."}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {isAr ? "2. معايير التخصص والمنصب" : "2. Position / Role Layer"}
                      </span>
                      <Badge className="bg-emerald-600 text-white font-mono text-[10px]">60.0%</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isAr
                        ? "الكفاءات الفنية الميدانية لكل مسمى وظيفي ومجال تخصص."
                        : "Field competencies tailored to job role and discipline."}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-brand/30 bg-brand/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand">
                        {isAr ? "3. مجموع الأوزان المستهدف" : "3. Target Weight Validation"}
                      </span>
                      <Badge className="bg-brand text-brand-foreground font-mono text-[10px]">100.0%</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isAr
                        ? "التحقق الصارم من توازن الأوزان المئوية لتساوي دائماً 100% بدقة قبل اعتماد القوالب."
                        : "Strict mathematical enforcement ensuring sum of all category weights equals exactly 100%."}
                    </p>
                  </div>
                </div>

                {/* Filter by Layer & Grouping Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-2xl border border-border text-xs">
                      {(["all", "common", "role", "custom"] as const).map((layer) => (
                        <button
                          key={layer}
                          type="button"
                          onClick={() => setCriteriaLayerFilter(layer)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${criteriaLayerFilter === layer
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          {layer === "all"
                            ? isAr ? "كل المعايير" : "All Layers"
                            : layer === "common"
                              ? isAr ? "عامة (40%)" : "Common (40%)"
                              : layer === "role"
                                ? isAr ? "تخصصية (60%)" : "Role Specific (60%)"
                                : isAr ? "مخصصة" : "Custom"}
                        </button>
                      ))}
                    </div>

                    {/* Category Filter Dropdown */}
                    <select
                      value={criteriaCategoryFilter}
                      onChange={(e) => setCriteriaCategoryFilter(e.target.value)}
                      className="rounded-2xl border border-input bg-background px-3 py-1.5 text-xs font-semibold cursor-pointer shadow-xs max-w-[220px]"
                    >
                      <option value="all">{isAr ? "جميع الفئات والتصنيفات" : "All Categories"}</option>
                      {criteriaCategoriesList.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group by Categories Toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={groupByCategory ? "default" : "outline"}
                      size="sm"
                      onClick={() => setGroupByCategory(!groupByCategory)}
                      className={`rounded-2xl text-xs gap-1.5 cursor-pointer shadow-xs ${groupByCategory
                        ? "bg-brand text-brand-foreground hover:bg-brand/90"
                        : "border-border hover:bg-muted/60"
                        }`}
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      <span>{isAr ? "تجميع حسب الفئات" : "Group by Categories"}</span>
                    </Button>
                  </div>
                </div>

                {/* Criteria Catalog Content */}
                {isLoadingCriteria ? (
                  <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    <span>{isAr ? "جارٍ تحميل دليل المعايير..." : "Loading criteria..."}</span>
                  </div>
                ) : groupByCategory ? (
                  /* Grouped by Category View */
                  <div className="space-y-4">
                    {groupedCriteriaByCategory.length === 0 ? (
                      <div className="p-12 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border bg-card">
                        {isAr ? "لا توجد معايير مطابقة للفلاتر المحددة" : "No criteria match the selected filters."}
                      </div>
                    ) : (
                      groupedCriteriaByCategory.map((group) => {
                        const groupWeightPct = (group.totalWeight * 100).toFixed(1);
                        return (
                          <div
                            key={group.categoryKey}
                            className="rounded-2xl border border-border overflow-hidden bg-card shadow-xs"
                          >
                            {/* Category Header */}
                            <div className="px-4 py-3 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="h-7 w-7 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                                  <FolderKanban className="h-4 w-4" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-xs text-foreground">
                                    {group.categoryTitle}
                                  </h3>
                                  {isAr && group.categoryTitleEn !== group.categoryTitle && (
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      ({group.categoryTitleEn})
                                    </span>
                                  )}
                                  {!isAr && group.categoryTitleAr && (
                                    <span className="text-[10px] text-muted-foreground font-normal" dir="rtl">
                                      ({group.categoryTitleAr})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                                  {group.items.length} {isAr ? "معايير" : "Criteria"}
                                </Badge>
                                <Badge className="bg-brand/10 text-brand border border-brand/20 font-mono text-[10px]">
                                  {isAr ? "الوزن:" : "Weight:"} {groupWeightPct}%
                                </Badge>
                              </div>
                            </div>

                            {/* Category Criteria Rows */}
                            <div className="divide-y divide-border">
                              {group.items.map((crit) => {
                                const weightPct = crit.default_weight ? (crit.default_weight * 100).toFixed(1) : "—";
                                const targetPct =
                                  crit.default_target !== undefined && crit.default_target !== null
                                    ? (crit.default_target <= 1
                                      ? (crit.default_target * 100).toFixed(0)
                                      : crit.default_target)
                                    : crit.max_value !== undefined && crit.max_value !== null
                                      ? crit.max_value
                                      : "—";

                                return (
                                  <div
                                    key={crit.id}
                                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                                          {crit.code}
                                        </Badge>
                                        <span className="font-bold text-xs text-foreground">
                                          {isAr ? crit.name_ar : crit.name_en}
                                        </span>
                                        <Badge
                                          className={`text-[10px] px-2 py-0 ${crit.layer === "common"
                                            ? "bg-blue-600 text-white"
                                            : crit.layer === "role"
                                              ? "bg-emerald-600 text-white"
                                              : "bg-purple-600 text-white"
                                            }`}
                                        >
                                          {crit.layer === "common"
                                            ? isAr ? "معيار عام" : "Common"
                                            : crit.layer === "role"
                                              ? isAr ? "معيار تخصصي" : "Role"
                                              : isAr ? "مخصص" : "Custom"}
                                        </Badge>

                                        {crit.scoring_direction && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">
                                            {crit.scoring_direction === "higher_is_better"
                                              ? isAr ? "الأعلى أفضل ↑" : "Higher ↑"
                                              : crit.scoring_direction === "lower_is_better"
                                                ? isAr ? "الأقل أفضل ↓" : "Lower ↓"
                                                : crit.scoring_direction === "rating_5"
                                                  ? isAr ? "مقياس 1-5 ★" : "Scale 1-5"
                                                  : crit.scoring_direction}
                                          </Badge>
                                        )}
                                        {crit.unit && (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">
                                            {crit.unit}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground">
                                        {isAr ? crit.category_ar : crit.category_en}
                                        {crit.how_measured_en && crit.how_measured_en !== crit.category_en && (
                                          <span className="ms-2 text-muted-foreground/80">
                                            • {isAr ? crit.how_measured_ar : crit.how_measured_en}
                                          </span>
                                        )}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <div className="text-end font-mono text-xs">
                                        <span className="text-muted-foreground">{isAr ? "الوزن:" : "Weight:"} </span>
                                        <strong className="text-foreground">{weightPct}%</strong>
                                        <span className="ms-2 text-muted-foreground">{isAr ? "الهدف:" : "Target:"} </span>
                                        <strong className="text-emerald-600">{targetPct}%</strong>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleOpenEditCriterion(crit)}
                                          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-brand cursor-pointer"
                                          title={isAr ? "تعديل" : "Edit"}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleArchiveCriterion(crit.id)}
                                          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-rose-600 cursor-pointer"
                                          title={isAr ? "أرشفة" : "Archive"}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* Flat List View */
                  <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-card">
                    {kpiCriteria
                      .filter((crit: any) => {
                        const matchLayer = criteriaLayerFilter === "all" || crit.layer === criteriaLayerFilter;
                        const critCat = crit.category_en || crit.category || "operational";
                        const matchCat =
                          criteriaCategoryFilter === "all" ||
                          critCat === criteriaCategoryFilter ||
                          crit.category === criteriaCategoryFilter;
                        return matchLayer && matchCat;
                      })
                      .map((crit: any) => {
                        const weightPct = crit.default_weight ? (crit.default_weight * 100).toFixed(1) : "—";
                        const targetPct =
                          crit.default_target !== undefined && crit.default_target !== null
                            ? (crit.default_target <= 1
                              ? (crit.default_target * 100).toFixed(0)
                              : crit.default_target)
                            : crit.max_value !== undefined && crit.max_value !== null
                              ? crit.max_value
                              : "—";

                        return (
                          <div
                            key={crit.id}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                                  {crit.code}
                                </Badge>
                                <span className="font-bold text-xs text-foreground">
                                  {isAr ? crit.name_ar : crit.name_en}
                                </span>
                                <Badge
                                  className={`text-[10px] px-2 py-0 ${crit.layer === "common"
                                    ? "bg-blue-600 text-white"
                                    : crit.layer === "role"
                                      ? "bg-emerald-600 text-white"
                                      : "bg-purple-600 text-white"
                                    }`}
                                >
                                  {crit.layer === "common"
                                    ? isAr ? "معيار عام" : "Common"
                                    : crit.layer === "role"
                                      ? isAr ? "معيار تخصصي" : "Role"
                                      : isAr ? "مخصص" : "Custom"}
                                </Badge>

                                {crit.scoring_direction && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">
                                    {crit.scoring_direction === "higher_is_better"
                                      ? isAr ? "الأعلى أفضل ↑" : "Higher ↑"
                                      : crit.scoring_direction === "lower_is_better"
                                        ? isAr ? "الأقل أفضل ↓" : "Lower ↓"
                                        : crit.scoring_direction === "rating_5"
                                          ? isAr ? "مقياس 1-5 ★" : "Scale 1-5"
                                          : crit.scoring_direction}
                                  </Badge>
                                )}
                                {crit.unit && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">
                                    {crit.unit}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {isAr ? crit.category_ar : crit.category_en}
                                {crit.how_measured_en && crit.how_measured_en !== crit.category_en && (
                                  <span className="ms-2 text-muted-foreground/80">
                                    • {isAr ? crit.how_measured_ar : crit.how_measured_en}
                                  </span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-end font-mono text-xs">
                                <span className="text-muted-foreground">{isAr ? "الوزن:" : "Weight:"} </span>
                                <strong className="text-foreground">{weightPct}%</strong>
                                <span className="ms-2 text-muted-foreground">{isAr ? "الهدف:" : "Target:"} </span>
                                <strong className="text-emerald-600">{targetPct}%</strong>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditCriterion(crit)}
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-brand cursor-pointer"
                                  title={isAr ? "تعديل" : "Edit"}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleArchiveCriterion(crit.id)}
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-rose-600 cursor-pointer"
                                  title={isAr ? "أرشفة" : "Archive"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        )}

        {/* ── TAB: EVALUATION PERIODS (HR ADMIN) ── */}
        {!isManagerMode && (
          <TabsContent value="evaluation-periods" className="space-y-4">
            <EvaluationPeriodsTab
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              isAr={isAr}
              dir={dir}
            />
          </TabsContent>
        )}
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

      {/* Metric Return & Notes Dialog (Admin) */}
      <Dialog open={metricReturnModalOpen} onOpenChange={setMetricReturnModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="h-5 w-5" />
              <DialogTitle className="text-base font-bold font-display">
                {isAr ? "إعادة المؤشر وإضافة ملاحظات" : "Return Metric & Add Revision Notes"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              #{selectedReturnKpi?.numericIndex}. {isAr ? (selectedReturnKpi?.name_ar || selectedReturnKpi?.name) : selectedReturnKpi?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px]">
                {isAr ? `الوزن: ${fmtPercent(selectedReturnKpi?.weight, 1)}` : `Weight: ${fmtPercent(selectedReturnKpi?.weight, 1)}`}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {isAr
                  ? `المستهدف: ${selectedReturnKpi?.target ? (selectedReturnKpi.unit === "%" ? `${(selectedReturnKpi.target > 1 ? selectedReturnKpi.target : selectedReturnKpi.target * 100).toFixed(0)}%` : selectedReturnKpi.target) : "—"}`
                  : `Target: ${selectedReturnKpi?.target ? (selectedReturnKpi.unit === "%" ? `${(selectedReturnKpi.target > 1 ? selectedReturnKpi.target : selectedReturnKpi.target * 100).toFixed(0)}%` : selectedReturnKpi.target) : "—"}`}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                {isAr ? "ملاحظات وتوجيهات التعديل (سبب الإعادة):" : "Revision Notes & Return Reason:"}
              </label>
              <textarea
                rows={4}
                value={metricReturnNote}
                onChange={(e) => setMetricReturnNote(e.target.value)}
                placeholder={
                  isAr
                    ? "اكتب هنا سبب الإعادة، أو المستندات الناقصة، أو التوجيهات للمُقيّم..."
                    : "Specify what requires revision, missing evidence, or instructions for the evaluator..."
                }
                className="w-full text-xs rounded-2xl border border-input bg-background p-3 focus:outline-none focus:ring-1 focus:ring-brand resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <input
                type="checkbox"
                id="markMetricReturned"
                checked={metricIsReturned}
                onChange={(e) => setMetricIsReturned(e.target.checked)}
                className="h-4 w-4 rounded text-amber-600 cursor-pointer"
              />
              <label htmlFor="markMetricReturned" className="text-xs text-foreground cursor-pointer select-none">
                {isAr ? "تحديد هذا المؤشر كمُعاد للمراجعة" : "Mark this metric as returned for revision"}
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMetricReturnModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSaveMetricReturnNote(false)}
                className="rounded-xl gap-1.5 cursor-pointer text-foreground"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isAr ? "حفظ الملاحظة فقط" : "Save Notes"}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => handleSaveMetricReturnNote(true)}
                className="rounded-xl gap-1.5 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isAr ? "إعادة التقييم للمراجعة" : "Return Evaluation"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Evaluations Directory Dialog */}
      <Dialog open={isEvaluationsListOpen} onOpenChange={setIsEvaluationsListOpen}>
        <DialogContent className="sm:max-w-2xl rounded-3xl max-h-[85vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-brand">
              <Layers className="h-5 w-5" />
              <DialogTitle className="font-display text-lg font-bold">
                {isAr ? `سجل تقييمات الأداء السنوية — عام ${selectedYear}` : `KPI Evaluations Directory — Year ${selectedYear}`}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
              {annualEvaluations.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {isAr ? `لم يتم تسجيل أي تقييمات لعام ${selectedYear} حتى الآن` : `No evaluations saved for year ${selectedYear} yet.`}
                </div>
              ) : (
                annualEvaluations.map((ev: any) => {
                  const empName = ev.employee?.full_name || ev.employee?.name || (isAr ? "موظف" : "Employee");
                  const empCode = ev.employee?.emp_code;
                  const dept = ev.employee?.department?.name_en || ev.employee?.department?.name_ar;
                  const score = Number(ev.summary?.totalScore ?? 0);
                  const rating = ev.summary?.rating || "—";
                  const evStatus = (ev.status || "draft").toLowerCase();
                  const isSelected = ev.employee_id === selectedEmpId;

                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center justify-between p-3.5 transition-colors ${isSelected ? "bg-brand/5 font-medium" : "hover:bg-muted/40"
                        }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">{empName}</span>
                          {empCode && (
                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                              {empCode}
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge className="bg-brand text-brand-foreground text-[10px] px-1.5 py-0">
                              {isAr ? "المعروض حالياً" : "Current"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {dept || (isAr ? "الإدارة الهندسية" : "Engineering")}
                          {ev.evaluator_name && ` • ${isAr ? "المُقيّم:" : "By:"} ${ev.evaluator_name}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <div className="font-mono font-bold text-xs text-foreground">
                            {score.toFixed(1)}%
                          </div>
                          <span className="text-[10px] text-muted-foreground">{rating}</span>
                        </div>

                        {evStatus === "approved" ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                            {isAr ? "معتمد" : "Approved"}
                          </Badge>
                        ) : evStatus === "submitted" ? (
                          <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5">
                            {isAr ? "مقدم" : "Submitted"}
                          </Badge>
                        ) : evStatus === "reviewed" ? (
                          <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5">
                            {isAr ? "تمت المراجعة" : "Reviewed"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                            {isAr ? "مسودة" : "Draft"}
                          </Badge>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEmpId(ev.employee_id);
                            setIsEvaluationsListOpen(false);
                          }}
                          className="h-7 text-xs rounded-lg px-2 text-brand hover:text-brand cursor-pointer"
                        >
                          {isAr ? "فتح" : "Open"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {isAr ? "تأكيد حذف التقييم" : "Confirm Delete Evaluation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs pt-2">
            <p className="text-muted-foreground">
              {isAr
                ? `هل أنت متأكد من رغبتك في حذف بطاقة تقييم ${currentEmployee.name} لعام ${selectedYear} نهائياً من قاعدة البيانات؟`
                : `Are you sure you want to permanently delete the evaluation for ${currentEmployee.name} (${selectedYear})?`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-xl gap-1.5 cursor-pointer"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAr ? "نعم، حذف نهائي" : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Engineering Discipline Modal */}
      <Dialog open={isDisciplineModalOpen} onOpenChange={setIsDisciplineModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              {editingDiscipline ? <Pencil className="h-4 w-4 text-brand" /> : <Plus className="h-4 w-4 text-brand" />}
              {isAr
                ? editingDiscipline
                  ? "تعديل التخصص الهندسي ومجال الكفاءة"
                  : "إضافة تخصص هندسي / مجال كفاءة جديد"
                : editingDiscipline
                  ? "Edit Engineering Discipline"
                  : "Add New Engineering Discipline"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* Discipline Name (English) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                {isAr ? "اسم التخصص (بالإنجليزية)" : "Discipline Name (English)"}
              </Label>
              <Input
                value={disciplineForm.name}
                onChange={(e) => setDisciplineForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Cybersecurity & IoT Solutions"
                className="rounded-xl text-xs"
              />
            </div>

            {/* Discipline Name (Arabic) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                {isAr ? "اسم التخصص (بالعربية)" : "Discipline Name (Arabic)"}
              </Label>
              <Input
                value={disciplineForm.name_ar}
                onChange={(e) => setDisciplineForm((prev) => ({ ...prev, name_ar: e.target.value }))}
                placeholder="مثال: حلول الأمن السيبراني وإنترنت الأشياء"
                dir="rtl"
                className="rounded-xl text-xs text-right"
              />
            </div>

            {/* Category Target Weight (%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  {isAr ? "وزن التخصص من الإجمالي (%)" : "Category Weight (%)"}
                </Label>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {isAr ? "الوزن الحالي: " : "Current: "}{disciplineForm.weight}%
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="100"
                  value={disciplineForm.weight}
                  onChange={(e) => setDisciplineForm((prev) => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                  className="rounded-xl text-xs pe-8"
                />
                <span className="absolute end-3 top-2.5 text-xs font-bold text-muted-foreground">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "الوزن المئوي المسند لهذا التخصص الهندسي في تقييم الأداء السنوي العام (المجموع الإجمالي المستهدف 100%)."
                  : "Assigned weight % of this discipline toward total annual evaluation score (target 100%)."}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDisciplineModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDiscipline}
                className="rounded-xl bg-brand text-white hover:bg-brand/90 cursor-pointer shadow-xs"
              >
                {editingDiscipline
                  ? isAr ? "حفظ التعديلات" : "Save Changes"
                  : isAr ? "إضافة التخصص" : "Add Discipline"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Return for Revision Modal Dialog (Mandatory Reason) */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="h-5 w-5" />
              <DialogTitle className="text-base font-bold font-display">
                {isAr ? "إعادة التقييم للمراجعة والتعديل" : "Return Evaluation for Revision"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-semibold">
                {isAr ? "تنبيه مسار الاعتماد الإداري:" : "Evaluation Workflow Notice:"}
              </p>
              <p className="leading-relaxed">
                {isAr
                  ? "سيتم رفض الاعتماد مؤقتاً وإعادة بطاقة التقييم إلى المُقيّم مع تدوين السبب لإجراء التصحيحات اللازمة وإعادة تقديمها."
                  : "This will temporarily reject the submission and return the evaluation to the evaluator with your notes so they can correct and resubmit."}
              </p>
            </div>

            {selectedPendingItem && (
              <div className="p-2.5 rounded-xl border border-border bg-muted/30 text-xs">
                <strong>{isAr ? "الموظف:" : "Employee:"}</strong> {selectedPendingItem.employee?.full_name || "Employee"} •{" "}
                <span className="font-mono uppercase font-bold text-brand">
                  {(selectedPendingItem.quarter || "q1").toUpperCase()} {selectedPendingItem.evaluation_year}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>{isAr ? "سبب الإعادة وملاحظات المراجعة (إلزامي):" : "Mandatory Return Reason & Guidance:"}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {returnReason.length} / 5 {isAr ? "أحرف على الأقل" : "chars min"}
                </span>
              </Label>
              <textarea
                rows={4}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={
                  isAr
                    ? "يرجى توضيح النقاط المطلوب تعديلها (مثال: يرجى مراجعة نسبة الإنجاز في بند السلامة وتوضيح مبررات التأخير في Q1)..."
                    : "Specify required adjustments (e.g., please re-verify testing pass rates and clarify the Q1 commissioning timeline)..."
                }
                className="w-full rounded-2xl border border-input bg-background p-3 text-xs leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReturnModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmReturn}
                disabled={returnReason.trim().length < 5 || isSubmittingReview}
                className="rounded-xl bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-xs gap-1.5"
              >
                {isSubmittingReview && <Loader2 className="h-4 w-4 animate-spin" />}
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isAr ? "تأكيد الإعادة للمُقيّم" : "Confirm Return"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Criterion Dialog */}
      <Dialog open={criterionModalOpen} onOpenChange={setCriterionModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-brand">
              <Award className="h-5 w-5" />
              <DialogTitle className="text-base font-bold font-display">
                {editingCriterion
                  ? isAr ? "تعديل معيار التقييم" : "Edit KPI Criterion"
                  : isAr ? "إضافة معيار تقييم جديد" : "Add New KPI Criterion"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "رمز المعيار" : "Code"}</Label>
                <Input
                  value={criterionForm.code}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. KPI-101"
                  className="rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "مستوى المعيار (الطبقة)" : "Criterion Layer"}</Label>
                <select
                  value={criterionForm.layer}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, layer: e.target.value as any }))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                >
                  <option value="common">{isAr ? "معيار عام للشركة (40%)" : "Common Company Layer (40%)"}</option>
                  <option value="role">{isAr ? "معيار تخصصي للمنصب (60%)" : "Position / Role Layer (60%)"}</option>
                  <option value="custom">{isAr ? "معيار إضافي مخصص" : "Custom Criterion"}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">{isAr ? "اسم المعيار (بالإنجليزية)" : "Name (English)"}</Label>
              <Input
                value={criterionForm.name_en}
                onChange={(e) => setCriterionForm((prev) => ({ ...prev, name_en: e.target.value }))}
                placeholder="e.g. On-Time Cable Pulling & Termination"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">{isAr ? "اسم المعيار (بالعربية)" : "Name (Arabic)"}</Label>
              <Input
                value={criterionForm.name_ar}
                onChange={(e) => setCriterionForm((prev) => ({ ...prev, name_ar: e.target.value }))}
                placeholder="مثال: دقة تمديد وإنهاء الكابلات في المواعيد المحددة"
                dir="rtl"
                className="rounded-xl text-xs text-right"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "التصنيف (بالإنجليزية)" : "Category (English)"}</Label>
                <Input
                  value={criterionForm.category_en}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, category_en: e.target.value }))}
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "التصنيف (بالعربية)" : "Category (Arabic)"}</Label>
                <Input
                  value={criterionForm.category_ar}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, category_ar: e.target.value }))}
                  dir="rtl"
                  className="rounded-xl text-xs text-right"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "الوزن الافتراضي (%)" : "Weight (%)"}</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="100"
                  value={criterionForm.weight}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "الهدف الافتراضي (%)" : "Target (%)"}</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={criterionForm.target}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, target: parseFloat(e.target.value) || 0 }))}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "وحدة القياس" : "Unit"}</Label>
                <Input
                  value={criterionForm.unit}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="%, count, scale"
                  className="rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCriterionModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCriterion}
                className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer shadow-xs"
              >
                {editingCriterion ? (isAr ? "حفظ التعديلات" : "Save Changes") : (isAr ? "إضافة المعيار" : "Add Criterion")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── TEMPLATE BUILDER & EDITOR DIALOG ── */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="sm:max-w-3xl rounded-3xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-brand">
              <Layers className="h-5 w-5" />
              <DialogTitle className="text-base font-bold font-display">
                {editingTemplate
                  ? isAr
                    ? `تعديل قالب التقييم (الإصدار v${editingTemplate.version || 1})`
                    : `Edit KPI Template (v${editingTemplate.version || 1})`
                  : isAr
                    ? "إنشاء قالب تقييم جديد للوظيفة"
                    : "Create New Job Evaluation Template"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* Version Branching Notice if editing an active template */}
            {editingTemplate && editingTemplate.status === "published" && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl border border-amber-300 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-xs">
                    {isAr ? "ميزة سلامة الإصدارات (Template Immutability):" : "Template Immutability Notice:"}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {isAr
                      ? "هذا القالب معتمد حالياً. في حال تم استخدامه في تقييمات موظفين، سيؤدي حفظ التعديلات إلى إنشاء إصدار جديد (v" +
                      ((editingTemplate.version || 1) + 1) +
                      ") كمسودة، لحماية التقييمات السابقة من التغيير."
                      : "This template is currently published. If evaluations already exist, saving will branch to a new version draft (v" +
                      ((editingTemplate.version || 1) + 1) +
                      ") ensuring historical evaluations remain intact."}
                  </p>
                </div>
              </div>
            )}

            {/* Template Identity Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "اسم القالب (بالإنجليزية)" : "Template Name (English)"} *</Label>
                <Input
                  value={templateForm.name_en}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, name_en: e.target.value }))}
                  placeholder="e.g. Junior ELV Site Engineer Evaluation"
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isAr ? "اسم القالب (بالعربية)" : "Template Name (Arabic)"} *</Label>
                <Input
                  value={templateForm.name_ar}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, name_ar: e.target.value }))}
                  placeholder="مثال: تقييم أداء مهندس موقع تيار خفيف مبتدئ"
                  dir="rtl"
                  className="rounded-xl text-xs text-right"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">{isAr ? "الوصف وملاحظات الاستخدام" : "Description & Scope"}</Label>
              <Input
                value={templateForm.description}
                onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={isAr ? "وصف مخصص للوظيفة ومجال التطبيق..." : "Target job family, roles and guidelines..."}
                className="rounded-xl text-xs"
              />
            </div>

            {/* Department -> Position -> Seniority Level Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-muted/40 border border-border">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "الإدارة / القسم" : "Department"}</Label>
                <select
                  value={templateForm.department_id}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, department_id: e.target.value }))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                >
                  <option value="">{isAr ? "عام لكل الأقسام" : "All Departments"}</option>
                  {(departmentsData || []).map((dept: any) => (
                    <option key={dept.id} value={dept.id}>
                      {isAr ? dept.name_ar || dept.name_en : dept.name_en || dept.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "المسمى الوظيفي" : "Position"}</Label>
                <select
                  value={templateForm.position_id}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, position_id: e.target.value }))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                >
                  <option value="">{isAr ? "عام لكل المناصب" : "All Positions"}</option>
                  {(positionsData || [])
                    .filter((pos: any) => !templateForm.department_id || pos.department_id === templateForm.department_id)
                    .map((pos: any) => (
                      <option key={pos.id} value={pos.id}>
                        {isAr ? pos.name_ar || pos.name_en : pos.name_en || pos.name_ar}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "المستوى المهني" : "Seniority Grade"}</Label>
                <select
                  value={templateForm.job_grade_id}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, job_grade_id: e.target.value }))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                >
                  <option value="">{isAr ? "كل المستويات (Junior/Mid/Sr/Lead)" : "All Seniority Levels"}</option>
                  {(jobGradesData || []).map((jg: any) => (
                    <option key={jg.id} value={jg.id}>
                      {isAr ? jg.name_ar || jg.name_en : jg.name_en || jg.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "سنة التطبيق" : "Effective Year"}</Label>
                <select
                  value={templateForm.effective_year}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, effective_year: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                >
                  <option value={currentYear}>{currentYear}</option>
                  <option value={currentYear + 1}>{currentYear + 1}</option>
                  <option value={currentYear - 1}>{currentYear - 1}</option>
                </select>
              </div>
            </div>

            {/* Criteria Assignment Section */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-brand" />
                  <span>{isAr ? "المعايير المحددة لهذا القالب" : "Assigned Evaluation Criteria"}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {templateForm.items.length}
                  </Badge>
                </Label>

                {/* Dynamic Searchable Combobox to add criterion from library */}
                <div className="flex items-center gap-2">
                  <Popover open={templateCriterionPopoverOpen} onOpenChange={setTemplateCriterionPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={templateCriterionPopoverOpen}
                        className="rounded-2xl border-input bg-background px-3 py-1.5 text-xs font-semibold cursor-pointer shadow-xs hover:bg-muted/60 gap-2 h-8 flex items-center justify-between min-w-[210px]"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Plus className="h-3.5 w-3.5 text-brand shrink-0" />
                          <span className="truncate">{isAr ? "إضافة معيار للقالب..." : "Add criterion to template..."}</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0 ms-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      sideOffset={6}
                      align={isAr ? "start" : "end"}
                      avoidCollisions={true}
                      collisionPadding={16}
                      className="w-[min(540px,calc(100vw-32px))] p-0 rounded-2xl shadow-2xl border border-border/80 bg-card z-[100] flex flex-col overflow-hidden max-h-[min(480px,calc(var(--radix-popover-content-available-height,480px)-16px))]"
                    >
                      {/* Search box & Filter controls - Fixed Header */}
                      <div className="p-3 pb-2 border-b border-border/50 bg-card/95 backdrop-blur-xs shrink-0 space-y-2">
                        <div className="relative">
                          <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            autoFocus
                            value={templateCriterionSearch}
                            onChange={(e) => setTemplateCriterionSearch(e.target.value)}
                            placeholder={isAr ? "ابحث بالاسم، الكود، أو الفئة..." : "Search criteria by name, code, or category..."}
                            className="rounded-xl ps-8 pe-8 text-xs h-8.5"
                          />
                          {templateCriterionSearch && (
                            <button
                              type="button"
                              onClick={() => setTemplateCriterionSearch("")}
                              className="absolute end-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Layer quick filters */}
                        <div className="flex items-center gap-1 text-[11px] overflow-x-auto no-scrollbar pb-0.5">
                          {(["all", "common", "role", "custom"] as const).map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setTemplateCriterionLayerFilter(l)}
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer shrink-0 ${templateCriterionLayerFilter === l
                                ? "bg-brand text-brand-foreground font-semibold shadow-xs"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                              {l === "all"
                                ? isAr ? "الكل" : "All"
                                : l === "common"
                                  ? isAr ? "عام (40%)" : "Common (40%)"
                                  : l === "role"
                                    ? isAr ? "تخصصي (60%)" : "Role Specific (60%)"
                                    : isAr ? "مخصص" : "Custom"}
                            </button>
                          ))}
                          <span className="ms-auto text-[10px] text-muted-foreground shrink-0 ps-1 font-mono">
                            {availableTemplateCriteria.length} {isAr ? "معيار" : "items"}
                          </span>
                        </div>
                      </div>

                      {/* Criteria list - Only this container scrolls */}
                      <div className="flex-1 min-h-[140px] max-h-[320px] overflow-y-auto p-2 space-y-1 overscroll-contain">
                        {availableTemplateCriteria.length === 0 ? (
                          <div className="p-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border bg-muted/20 my-2">
                            {templateCriterionSearch || templateCriterionLayerFilter !== "all"
                              ? (isAr ? "لا توجد معايير مطابقة للبحث أو الفلتر" : "No criteria match your search or filter")
                              : (isAr ? "تمت إضافة جميع المعايير المتاحة لهذا القالب" : "All available criteria have been added to this template")}
                          </div>
                        ) : (
                          availableTemplateCriteria.map((c: any) => (
                            <div
                              key={c.id}
                              onClick={() => {
                                handleAddCriterionToTemplate(c);
                              }}
                              className="p-2.5 rounded-xl border border-transparent hover:border-brand/30 hover:bg-brand/5 dark:hover:bg-brand/10 transition-all cursor-pointer flex items-center justify-between gap-2.5 group"
                            >
                              <div className="min-w-0 space-y-1 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {c.code && (
                                    <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 shrink-0">
                                      {c.code}
                                    </Badge>
                                  )}
                                  <span className="font-semibold text-xs text-foreground group-hover:text-brand transition-colors truncate">
                                    {isAr ? c.name_ar || c.name_en : c.name_en || c.name_ar}
                                  </span>
                                  <Badge
                                    className={`text-[9px] px-1.5 py-0 shrink-0 ${c.layer === "common"
                                      ? "bg-blue-600/90 text-white"
                                      : c.layer === "role"
                                        ? "bg-emerald-600/90 text-white"
                                        : "bg-purple-600/90 text-white"
                                      }`}
                                  >
                                    {c.layer === "common"
                                      ? (isAr ? "عام" : "Common")
                                      : c.layer === "role"
                                        ? (isAr ? "تخصصي" : "Role")
                                        : (isAr ? "مخصص" : "Custom")}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                  <span className="font-medium text-muted-foreground/90 truncate">
                                    {isAr ? c.category_ar || c.category_en : c.category_en || c.category_ar}
                                  </span>
                                  {c.unit && (
                                    <span className="text-muted-foreground/70 font-mono">
                                      • {c.unit}
                                    </span>
                                  )}
                                  {c.scoring_scale && (
                                    <span className="text-muted-foreground/70">
                                      • {c.scoring_scale === "rating_5" ? "1-5" : c.scoring_scale}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2.5 text-[11px] rounded-lg gap-1 bg-muted/60 text-foreground group-hover:bg-brand group-hover:text-brand-foreground transition-all shrink-0 cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>{isAr ? "إضافة" : "Add"}</span>
                              </Button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Footer bar with quick count & Done button */}
                      <div className="p-2 px-3 border-t border-border/50 bg-muted/30 shrink-0 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-muted-foreground">
                          {isAr
                            ? `المحدد بالقالب: ${templateForm.items.length} معيار`
                            : `Assigned: ${templateForm.items.length} criteria`}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTemplateCriterionPopoverOpen(false);
                            setTemplateCriterionSearch("");
                          }}
                          className="h-6 px-2.5 text-[11px] rounded-lg hover:bg-muted font-medium cursor-pointer"
                        >
                          {isAr ? "تم / إغلاق" : "Done"}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Items Table */}
              {templateForm.items.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/20 text-muted-foreground text-xs space-y-1">
                  <p>{isAr ? "لم يتم إضافة أي معايير بعد لهذا القالب." : "No criteria added to this template yet."}</p>
                  <p className="text-[11px] text-muted-foreground/80">
                    {isAr
                      ? "اختر المعايير من القائمة المنسدلة أعلاه وحدد أوزانها لتصل إلى 100% بالضبط."
                      : "Select criteria from the dropdown above and calibrate weights to equal exactly 100%."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-card">
                  <div className="grid grid-cols-12 gap-2 p-2.5 bg-muted/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="col-span-4">{isAr ? "المعيار" : "Criterion"}</span>
                    <span className="col-span-3">{isAr ? "اتجاه التقييم" : "Direction"}</span>
                    <span className="col-span-2 text-center">{isAr ? "الوحدة" : "Unit"}</span>
                    <span className="col-span-1 text-center">{isAr ? "الهدف" : "Target"}</span>
                    <span className="col-span-1 text-center">{isAr ? "الوزن %" : "Weight %"}</span>
                    <span className="col-span-1 text-end">{isAr ? "حذف" : "Del"}</span>
                  </div>

                  {templateForm.items.map((it, idx) => {
                    const critDef = kpiCriteria.find((c: any) => c.id === it.criterion_id);
                    const critName = critDef
                      ? isAr ? critDef.name_ar : critDef.name_en
                      : `Criterion #${idx + 1}`;

                    return (
                      <div key={it.criterion_id || idx} className="grid grid-cols-12 gap-2 p-2.5 items-center hover:bg-muted/20 text-xs">
                        {/* Criterion Name */}
                        <div className="col-span-4 space-y-0.5">
                          <p className="font-semibold text-foreground truncate">{critName}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {critDef?.code} • {critDef?.layer}
                          </span>
                        </div>

                        {/* Scoring Direction */}
                        <div className="col-span-3">
                          <select
                            value={it.scoring_direction}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setTemplateForm((prev) => ({
                                ...prev,
                                items: prev.items.map((item, i) => (i === idx ? { ...item, scoring_direction: val } : item)),
                              }));
                            }}
                            className="w-full rounded-lg border border-input bg-background px-2 py-1 text-[11px] font-semibold"
                          >
                            <option value="higher_is_better">{isAr ? "الأعلى أفضل (Actual/Target)" : "Higher is better (Actual/Target)"}</option>
                            <option value="lower_is_better">{isAr ? "الأقل أفضل (Target/Actual)" : "Lower is better (Target/Actual)"}</option>
                            <option value="rating_5">{isAr ? "مقياس 1-5 (Actual/5.0)" : "1-5 Rating Scale (Actual/5.0)"}</option>
                          </select>
                        </div>

                        {/* Unit */}
                        <div className="col-span-2">
                          <Input
                            value={it.unit}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTemplateForm((prev) => ({
                                ...prev,
                                items: prev.items.map((item, i) => (i === idx ? { ...item, unit: val } : item)),
                              }));
                            }}
                            placeholder="%, count"
                            className="rounded-lg text-[11px] font-mono h-7 px-2 text-center"
                          />
                        </div>

                        {/* Target Benchmark */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            value={it.target_benchmark}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setTemplateForm((prev) => ({
                                ...prev,
                                items: prev.items.map((item, i) => (i === idx ? { ...item, target_benchmark: val } : item)),
                              }));
                            }}
                            className="rounded-lg text-[11px] font-mono h-7 px-1 text-center"
                          />
                        </div>

                        {/* Weight % */}
                        <div className="col-span-1">
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={it.weight}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setTemplateForm((prev) => ({
                                ...prev,
                                items: prev.items.map((item, i) => (i === idx ? { ...item, weight: val } : item)),
                              }));
                            }}
                            className="rounded-lg text-[11px] font-mono font-bold h-7 px-1 text-center text-brand"
                          />
                        </div>

                        {/* Remove Action */}
                        <div className="col-span-1 text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveCriterionFromTemplate(it.criterion_id)}
                            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Strict 100% Total Weight Live Progress Indicator ── */}
              {(() => {
                const currentSum = templateForm.items.reduce((acc, it) => acc + Number(it.weight || 0), 0);
                const isExact100 = Math.abs(currentSum - 100) < 0.5;
                const isUnder = currentSum < 100;

                return (
                  <div
                    className={`p-3.5 rounded-2xl border transition-all space-y-2 ${isExact100
                      ? "border-emerald-300 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                      : isUnder
                        ? "border-amber-300 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                        : "border-rose-300 bg-rose-500/10 text-rose-900 dark:text-rose-200"
                      }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        {isExact100 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                        <span>{isAr ? "مجموع أوزان المعايير التراكمي:" : "Total Criteria Weight Sum:"}</span>
                      </span>
                      <span className="font-mono text-sm">
                        {currentSum}% / 100.0%
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${isExact100 ? "bg-emerald-600" : isUnder ? "bg-amber-500" : "bg-rose-600"
                          }`}
                        style={{ width: `${Math.min(100, Math.max(0, currentSum))}%` }}
                      />
                    </div>

                    <p className="text-[11px] leading-relaxed">
                      {isExact100
                        ? isAr
                          ? "✓ الأوزان متطابقة بنسبة 100% تماماً. القالب مؤهل للنشر والاعتماد الرسمي."
                          : "✓ Target weight achieved (100.0%). Template is fully eligible for publishing."
                        : isUnder
                          ? isAr
                            ? `• إجمالي الأوزان أقل من 100% بـ (${(100 - currentSum).toFixed(1)}%). يمكنك الحفظ كمسودة، لكن يلزم 100% بالضبط لنشر القالب.`
                            : `• Total weight is under 100% by ${(100 - currentSum).toFixed(1)}%. You may save as a Draft, but must reach exactly 100% to publish.`
                          : isAr
                            ? `• إجمالي الأوزان يتجاوز 100% بـ (${(currentSum - 100).toFixed(1)}%). يرجى خفض أوزان المعايير.`
                            : `• Total weight exceeds 100% by ${(currentSum - 100).toFixed(1)}%. Please reduce criteria weights.`}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplateModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSaveTemplate(false)}
                className="rounded-xl gap-1.5 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{isAr ? "حفظ كمسودة (Draft)" : "Save as Draft"}</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleSaveTemplate(true)}
                disabled={Math.abs(templateForm.items.reduce((acc, it) => acc + Number(it.weight || 0), 0) - 100) > 0.5}
                className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{isAr ? "نشر واعتماد القالب (Publish 100%)" : "Publish Template (100%)"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DUPLICATE TEMPLATE DIALOG ── */}
      <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={dir}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-brand">
              <Copy className="h-5 w-5" />
              <DialogTitle className="text-base font-bold font-display">
                {isAr ? "استنساخ قالب تقييم أداء" : "Duplicate KPI Template"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-xs">
            {/* Source Template Info */}
            <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                {isAr ? "القالب المصدر:" : "Source Template:"}
              </span>
              <p className="font-bold text-foreground">
                {duplicateSourceTemplate?.name_en}
                {duplicateSourceTemplate?.name_ar && ` (${duplicateSourceTemplate.name_ar})`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {duplicateSourceTemplate?.items?.length || 0} {isAr ? "معايير سيتم نسخها بالكامل" : "criteria will be cloned into a new draft"}
              </p>
            </div>

            {/* Target Names */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{isAr ? "اسم النسخة الجديدة (بالإنجليزية)" : "New Name (English)"} *</Label>
              <Input
                value={duplicateForm.new_name_en}
                onChange={(e) => setDuplicateForm((p) => ({ ...p, new_name_en: e.target.value }))}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">{isAr ? "اسم النسخة الجديدة (بالعربية)" : "New Name (Arabic)"}</Label>
              <Input
                value={duplicateForm.new_name_ar}
                onChange={(e) => setDuplicateForm((p) => ({ ...p, new_name_ar: e.target.value }))}
                dir="rtl"
                className="rounded-xl text-xs text-right"
              />
            </div>

            {/* Target Role Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "الإدارة المستهدفة" : "Target Dept"}</Label>
                <select
                  value={duplicateForm.target_department_id}
                  onChange={(e) => setDuplicateForm((p) => ({ ...p, target_department_id: e.target.value }))}
                  className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="">{isAr ? "عام" : "All"}</option>
                  {(departmentsData || []).map((dept: any) => (
                    <option key={dept.id} value={dept.id}>
                      {isAr ? dept.name_ar || dept.name_en : dept.name_en || dept.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "المنصب المستهدف" : "Target Position"}</Label>
                <select
                  value={duplicateForm.target_position_id}
                  onChange={(e) => setDuplicateForm((p) => ({ ...p, target_position_id: e.target.value }))}
                  className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="">{isAr ? "عام" : "All"}</option>
                  {(positionsData || []).map((pos: any) => (
                    <option key={pos.id} value={pos.id}>
                      {isAr ? pos.name_ar || pos.name_en : pos.name_en || pos.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{isAr ? "المستوى المهني" : "Target Seniority"}</Label>
                <select
                  value={duplicateForm.target_job_grade_id}
                  onChange={(e) => setDuplicateForm((p) => ({ ...p, target_job_grade_id: e.target.value }))}
                  className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="">{isAr ? "كل المستويات" : "All Levels"}</option>
                  {(jobGradesData || []).map((jg: any) => (
                    <option key={jg.id} value={jg.id}>
                      {isAr ? jg.name_ar || jg.name_en : jg.name_en || jg.name_ar}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDuplicateModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDuplicateTemplate}
                className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer shadow-xs gap-1.5"
              >
                <Copy className="h-4 w-4" />
                <span>{isAr ? "تأكيد الاستنساخ كمسودة" : "Clone as New Draft"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
