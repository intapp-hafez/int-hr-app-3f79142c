import React, { useState, useMemo, useEffect } from "react";
import {
  Target,
  FileDown,
  FileSpreadsheet,
  Printer,
  Search,
  User,
  Building2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportKpiDefinitionPdf, KpiDefPdfRow } from "@/lib/kpi/kpi-definition-pdf-export";
import { ScorecardItem, formatCategoryName } from "./KpiEvaluationView";

export interface KpisDefinitionTabProps {
  employeesList: Array<{
    id: string;
    name: string;
    code: string;
    position: string;
    department: string;
  }>;
  selectedEmpId: string;
  onSelectEmployee: (empId: string) => void;
  activeScorecardItems: ScorecardItem[];
  matchedTemplateData?: any;
  kpiTemplates: any[];
  selectedYear: number;
}

interface EditableMetricRow {
  id: string;
  templateItemId?: string;
  criterionId?: string;
  numericIndex: number;
  code: string;
  category: string;
  name: string;
  definition: string;
  howMeasured: string;
  weightPct: number; // e.g. 15 for 15%
  target: string;
  unit: string;
  isNew?: boolean;
}

const STANDARD_CATEGORIES = [
  { value: "behavioral", labelEn: "Behavioral Competencies & Teamwork", labelAr: "الجدارات السلوكية والعمل الجماعي" },
  { value: "technical", labelEn: "Technical Execution & Architecture", labelAr: "التنفيذ الفني والهندسي" },
  { value: "productivity", labelEn: "Productivity", labelAr: "الإنتاجية" },
  { value: "quality", labelEn: "Quality, Standards & Review", labelAr: "الجودة والمعايير والمراجعة" },
  { value: "operational", labelEn: "Operational & Delivery", labelAr: "التشغيل والتسليم" },
  { value: "management", labelEn: "Leadership & Management", labelAr: "القيادة والإدارة" },
];

export function KpisDefinitionTab({
  employeesList,
  selectedEmpId,
  onSelectEmployee,
  activeScorecardItems,
  matchedTemplateData,
  kpiTemplates,
  selectedYear,
}: KpisDefinitionTabProps) {
  const { t, isAr } = useI18n();
  const queryClient = useQueryClient();

  const [empSearch, setEmpSearch] = useState("");
  const [empPopoverOpen, setEmpPopoverOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableRows, setEditableRows] = useState<EditableMetricRow[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

  // Current employee
  const currentEmployee = useMemo(() => {
    return (
      employeesList.find((e) => e.id === selectedEmpId) ||
      employeesList[0] || {
        id: "",
        name: isAr ? "غير محدد" : "Unspecified",
        code: "",
        position: isAr ? "غير محدد" : "Unspecified",
        department: isAr ? "غير محدد" : "Unspecified",
      }
    );
  }, [employeesList, selectedEmpId, isAr]);

  // Synchronize editableRows whenever activeScorecardItems change (and not actively editing)
  useEffect(() => {
    if (!isEditing) {
      const initial: EditableMetricRow[] = activeScorecardItems.map((it, idx) => ({
        id: it.id,
        templateItemId: it.templateItemId,
        criterionId: it.criterionId,
        numericIndex: it.numericIndex || idx + 1,
        code: it.code || `KPI-${idx + 1}`,
        category: it.category || "operational",
        name: isAr ? it.name_ar || it.name : it.name,
        definition: isAr ? it.definition_ar || it.definition : it.definition,
        howMeasured: isAr
          ? it.howMeasured_ar || it.howMeasured || ""
          : it.howMeasured || (it.unit ? `Measured in ${it.unit}` : ""),
        weightPct: Math.round(Number(it.weight || 0) * 100),
        target: String(it.target ?? 100),
        unit: it.unit || "%",
      }));
      setEditableRows(initial);
      setDeletedItemIds([]);
    }
  }, [activeScorecardItems, isEditing, isAr]);

  // Filtered selector employees
  const filteredEmployees = useMemo(() => {
    if (!empSearch.trim()) return employeesList;
    const q = empSearch.toLowerCase().trim();
    return employeesList.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [employeesList, empSearch]);

  // Template name
  const templateName = useMemo(() => {
    if (matchedTemplateData?.template) {
      return isAr
        ? matchedTemplateData.template.name_ar || matchedTemplateData.template.name_en
        : matchedTemplateData.template.name_en;
    }
    return isAr ? "نموذج تقييم الوظيفة" : "Role Evaluation Template";
  }, [matchedTemplateData, isAr]);

  // Categories in items
  const categories = useMemo(() => {
    const set = new Set<string>();
    (isEditing ? editableRows : activeScorecardItems).forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set);
  }, [activeScorecardItems, editableRows, isEditing]);

  // Sum of weights in edit mode
  const currentTotalWeight = useMemo(() => {
    if (isEditing) {
      return editableRows.reduce((acc, it) => acc + (Number(it.weightPct) || 0), 0);
    }
    return Math.round(
      activeScorecardItems.reduce((acc, it) => acc + (Number(it.weight) || 0), 0) * 100
    );
  }, [isEditing, editableRows, activeScorecardItems]);

  // Filtered rows for display
  const displayedRows = useMemo(() => {
    const source = isEditing ? editableRows : activeScorecardItems;
    return source.filter((item: any) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (item.name || "").toLowerCase().includes(q);
        const matchDef = (item.definition || "").toLowerCase().includes(q);
        const matchCat = (item.category || "").toLowerCase().includes(q);
        if (!matchName && !matchDef && !matchCat) return false;
      }
      return true;
    });
  }, [isEditing, editableRows, activeScorecardItems, categoryFilter, searchQuery]);

  // ── ROW EDITING HANDLERS ──
  const handleUpdateRowField = (rowId: string, field: keyof EditableMetricRow, value: any) => {
    setEditableRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          return { ...r, [field]: value };
        }
        return r;
      })
    );
  };

  const handleAddNewRow = () => {
    const nextIdx = editableRows.length + 1;
    const newRow: EditableMetricRow = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      numericIndex: nextIdx,
      code: `KPI-${nextIdx}`,
      category: "technical",
      name: isAr ? `مؤشر أداء جديد ${nextIdx}` : `New KPI Metric ${nextIdx}`,
      definition: "",
      howMeasured: "Measured in %",
      weightPct: 10,
      target: "100",
      unit: "%",
      isNew: true,
    };
    setEditableRows((prev) => [...prev, newRow]);
  };

  const handleDeleteRow = (rowId: string) => {
    const rowToDelete = editableRows.find((r) => r.id === rowId);
    if (rowToDelete?.templateItemId) {
      setDeletedItemIds((prev) => [...prev, rowToDelete.templateItemId!]);
    }
    setEditableRows((prev) => {
      const remaining = prev.filter((r) => r.id !== rowId);
      return remaining.map((r, idx) => ({ ...r, numericIndex: idx + 1 }));
    });
  };

  const handleCancelEdit = () => {
    // Revert to activeScorecardItems
    const initial: EditableMetricRow[] = activeScorecardItems.map((it, idx) => ({
      id: it.id,
      templateItemId: it.templateItemId,
      criterionId: it.criterionId,
      numericIndex: it.numericIndex || idx + 1,
      code: it.code || `KPI-${idx + 1}`,
      category: it.category || "operational",
      name: isAr ? it.name_ar || it.name : it.name,
      definition: isAr ? it.definition_ar || it.definition : it.definition,
      howMeasured: isAr
        ? it.howMeasured_ar || it.howMeasured || ""
        : it.howMeasured || (it.unit ? `Measured in ${it.unit}` : ""),
      weightPct: Math.round(Number(it.weight || 0) * 100),
      target: String(it.target ?? 100),
      unit: it.unit || "%",
    }));
    setEditableRows(initial);
    setDeletedItemIds([]);
    setIsEditing(false);
  };

  // ── SAVE CHANGES TO DATABASE ──
  const handleSaveChanges = async () => {
    if (currentTotalWeight !== 100) {
      toast.error(
        isAr
          ? `مجموع الأوزان يجب أن يساوي 100%. الإجمالي الحالي: ${currentTotalWeight}%`
          : `Sum of criteria weights must equal exactly 100%. Current total: ${currentTotalWeight}%`
      );
      return;
    }

    const templateId = matchedTemplateData?.template?.id;
    setIsSaving(true);

    try {
      // 1. Process deletions
      if (deletedItemIds.length > 0) {
        await supabase
          .from("kpi_template_items")
          .delete()
          .in("id", deletedItemIds);
      }

      // 2. Process updates and new rows
      for (const row of editableRows) {
        const targetBenchmark = Number(row.target) || 100;
        const weightDecimal = Number(row.weightPct) / 100;

        if (row.isNew) {
          // A) Insert new criterion into kpi_criteria
          const { data: newCrit, error: critErr } = await supabase
            .from("kpi_criteria")
            .insert({
              name_en: row.name,
              name_ar: row.name,
              description_en: row.definition,
              description_ar: row.definition,
              category: row.category,
              how_measured_en: row.howMeasured,
              how_measured_ar: row.howMeasured,
              unit: row.unit || "%",
              default_weight: weightDecimal,
              scoring_direction: "higher_is_better",
              is_active: true,
              is_required: true,
            })
            .select("id")
            .single();

          if (critErr) throw critErr;

          // B) If we have a matched template, attach new criterion to kpi_template_items
          if (templateId && newCrit?.id) {
            const { error: itemErr } = await supabase
              .from("kpi_template_items")
              .insert({
                template_id: templateId,
                criterion_id: newCrit.id,
                weight: weightDecimal,
                target_benchmark: targetBenchmark,
                display_order: row.numericIndex,
                unit: row.unit || "%",
              });
            if (itemErr) throw itemErr;
          }
        } else {
          // Existing row: update criterion description, name, category, howMeasured
          if (row.criterionId) {
            const { error: critUpdErr } = await supabase
              .from("kpi_criteria")
              .update({
                name_en: row.name,
                description_en: row.definition,
                how_measured_en: row.howMeasured,
                category: row.category,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.criterionId);

            if (critUpdErr) {
              console.warn("Could not update kpi_criteria:", critUpdErr);
            }
          }

          // Update weight and target in template_items
          if (row.templateItemId) {
            const { error: itemUpdErr } = await supabase
              .from("kpi_template_items")
              .update({
                weight: weightDecimal,
                target_benchmark: targetBenchmark,
                display_order: row.numericIndex,
              })
              .eq("id", row.templateItemId);

            if (itemUpdErr) {
              console.warn("Could not update kpi_template_items:", itemUpdErr);
            }
          }
        }
      }

      // Invalidate relevant React Query caches to refresh data across all views
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kpi-matched-template"] }),
        queryClient.invalidateQueries({ queryKey: ["kpi-criteria"] }),
        queryClient.invalidateQueries({ queryKey: ["kpi-templates"] }),
        queryClient.invalidateQueries({ queryKey: ["kpi-evaluations-list"] }),
      ]);

      toast.success(
        isAr ? "تم حفظ وتحديث تعريفات المؤشرات بنجاح" : "KPI definitions saved successfully"
      );
      setIsEditing(false);
      setDeletedItemIds([]);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || (isAr ? "حدث خطأ أثناء الحفظ" : "Failed to save changes"));
    } finally {
      setIsSaving(false);
    }
  };

  // PDF Export
  const handleExportPdf = async () => {
    if (activeScorecardItems.length === 0) {
      toast.error(isAr ? "لا توجد مؤشرات للتصدير" : "No KPI metrics to export");
      return;
    }
    setIsExportingPdf(true);
    try {
      const pdfRows: KpiDefPdfRow[] = activeScorecardItems.map((it, idx) => ({
        id: idx + 1,
        category: formatCategoryName(it.category, isAr),
        name: isAr ? it.name_ar || it.name : it.name,
        definition: isAr ? it.definition_ar || it.definition : it.definition,
        howMeasured: isAr
          ? it.howMeasured_ar || it.howMeasured || "—"
          : it.howMeasured || (it.unit ? `Measured in ${it.unit}` : "—"),
        weight: it.weight,
        target: it.target > 1 ? it.target / 100 : it.target,
        unit: it.unit,
      }));

      await exportKpiDefinitionPdf(
        pdfRows,
        {
          fullName: currentEmployee.name,
          position: currentEmployee.position,
          department: currentEmployee.department,
        },
        selectedYear
      );
      toast.success(isAr ? "تم تحميل ملف مؤشرات الأداء (PDF)" : "KPIs Definition PDF downloaded");
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(err.message || (isAr ? "فشل تصدير ملف PDF" : "Failed to export PDF"));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const { utils, writeFile } = await import("xlsx");
      const exportData = (isEditing ? editableRows : activeScorecardItems).map((it: any, idx: number) => ({
        "#": idx + 1,
        Category: formatCategoryName(it.category, false),
        "KPI / Metric Name": it.name,
        "Definition (What it measures)": it.definition,
        "How it's measured": it.howMeasured || (it.unit ? `Measured in ${it.unit}` : "—"),
        "Weight (%)": `${isEditing ? it.weightPct : Math.round(it.weight * 100)}%`,
        Target: `${it.target}${it.unit === "%" ? "%" : it.unit ? " " + it.unit : ""}`,
      }));

      const wb = utils.book_new();
      const ws = utils.json_to_sheet(exportData);
      utils.book_append_sheet(wb, ws, "KPIs Definition");
      const filename = `KPIs_Definition_${(currentEmployee.name || "Employee").replace(/\s+/g, "_")}_${selectedYear}.xlsx`;
      writeFile(wb, filename);
      toast.success(isAr ? "تم تصدير ملف الإكسل" : "Excel file exported");
    } catch (err: any) {
      toast.error(err.message || "Failed to export Excel");
    }
  };

  return (
    <div className="space-y-5">
      {/* ── TOP CONTROLS CARD ── */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
                <Target className="h-3.5 w-3.5" />
                {isAr ? "دليل وبطاقة تعريف المؤشرات" : "KPIs Definition & Measurement Matrix"}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {isEditing ? editableRows.length : activeScorecardItems.length} {isAr ? "معيار" : "Metrics"}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono transition-colors ${
                  currentTotalWeight === 100
                    ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                    : "border-amber-500/60 text-amber-600 bg-amber-500/10 font-bold animate-pulse"
                }`}
              >
                {currentTotalWeight}% {isAr ? "الوزن الكلي" : "Total Weight"}
              </Badge>

              {isEditing && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {isAr ? "وضع التعديل مفعل" : "Edit Mode Active"}
                </span>
              )}
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
              {isAr ? "مؤشرات الأداء ومعايير القياس الوظيفية" : "Role KPIs Definition & Target Benchmarks"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "يمكنك تعديل أسماء المعايير، وطريقة القياس، والتعريف التفصيلي، والنسب المئوية للأوزان والمستهدفات."
                : "Edit metric names, definitions, formulas, targets, and percentage weights directly in the table."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Target Employee Dropdown */}
            <Popover open={empPopoverOpen} onOpenChange={setEmpPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isEditing}
                  className="rounded-2xl gap-2 text-xs font-medium cursor-pointer border-border h-9"
                >
                  <User className="h-3.5 w-3.5 text-brand" />
                  <span className="max-w-[140px] truncate">{currentEmployee.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 rounded-2xl shadow-xl" align="end">
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-foreground">
                    {isAr ? "اختر الموظف لعرض بطاقة مؤشراته" : "Select Target Employee"}
                  </div>
                  <div className="relative">
                    <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      placeholder={isAr ? "بحث بالاسم أو الكود..." : "Search name or code..."}
                      className="ps-8 h-8 text-xs rounded-xl"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-border/40 text-xs">
                    {filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          onSelectEmployee(emp.id);
                          setEmpPopoverOpen(false);
                          setEmpSearch("");
                        }}
                        className={`w-full text-start p-2 rounded-xl transition cursor-pointer flex flex-col gap-0.5 hover:bg-muted/60 ${
                          emp.id === currentEmployee.id ? "bg-brand/10 font-bold text-brand" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{emp.name}</span>
                          {emp.code && <span className="text-[10px] font-mono text-muted-foreground">{emp.code}</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {emp.position || "—"} • {emp.department || "—"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* ── EDIT MODE TOGGLE BUTTONS ── */}
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                size="sm"
                variant="outline"
                className="rounded-2xl gap-1.5 cursor-pointer h-9 text-xs border-brand/40 text-brand hover:bg-brand/10 font-semibold shadow-2xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{isAr ? "تعديل الجدول" : "Edit Table"}</span>
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  size="sm"
                  variant="outline"
                  className="rounded-2xl gap-1.5 cursor-pointer h-9 text-xs border-border hover:bg-muted text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{isAr ? "إلغاء" : "Cancel"}</span>
                </Button>

                <Button
                  onClick={handleAddNewRow}
                  disabled={isSaving}
                  size="sm"
                  variant="outline"
                  className="rounded-2xl gap-1.5 cursor-pointer h-9 text-xs border-dashed border-brand/50 text-brand hover:bg-brand/5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isAr ? "إضافة مؤشر" : "Add KPI"}</span>
                </Button>

                <Button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  size="sm"
                  className="rounded-2xl gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer h-9 text-xs font-bold shadow-xs"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>{isAr ? "حفظ التعديلات" : "Save Changes"}</span>
                </Button>
              </>
            )}

            {!isEditing && (
              <>
                <Button
                  onClick={handleExportPdf}
                  disabled={isExportingPdf || activeScorecardItems.length === 0}
                  size="sm"
                  className="rounded-2xl gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer h-9 text-xs shadow-xs"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  <span>{isAr ? "تحميل (PDF)" : "Download PDF"}</span>
                </Button>

                <Button
                  onClick={handleExportExcel}
                  disabled={activeScorecardItems.length === 0}
                  variant="outline"
                  size="sm"
                  className="rounded-2xl gap-1.5 cursor-pointer h-9 text-xs border-border hover:bg-muted"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{isAr ? "تصدير Excel" : "Export Excel"}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── HEADER SUBTITLE BANNER (Name | Job Title: | Department:) ── */}
        <div className="relative overflow-hidden rounded-2xl bg-neutral-900 text-white p-4 sm:p-5 shadow-sm border border-neutral-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-semibold">{isAr ? "الاسم:" : "Name:"}</span>
                <span className="font-bold text-sm text-white tracking-tight">{currentEmployee.name}</span>
                {currentEmployee.code && (
                  <Badge variant="outline" className="text-[10px] font-mono border-neutral-700 text-neutral-300">
                    {currentEmployee.code}
                  </Badge>
                )}
              </div>

              <span className="hidden md:inline text-neutral-600">|</span>

              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-semibold">{isAr ? "المسمى الوظيفي:" : "Job Title:"}</span>
                <span className="font-semibold text-orange-400">{currentEmployee.position || "—"}</span>
              </div>

              <span className="hidden md:inline text-neutral-600">|</span>

              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-semibold">{isAr ? "الإدارة / القسم:" : "Department:"}</span>
                <span className="text-neutral-200">{currentEmployee.department || "—"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span>{isAr ? "النموذج:" : "Template:"}</span>
              <span className="font-mono text-neutral-300">{templateName}</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        {!isEditing && (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? "تصفية بالمعيار أو طريقة القياس أو الفئة..." : "Filter by KPI name, definition, formula..."}
                className="ps-9 h-9 text-xs rounded-xl"
              />
            </div>

            {categories.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition ${
                    categoryFilter === "all"
                      ? "bg-brand text-brand-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {isAr ? "الكل" : "All"} ({activeScorecardItems.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition ${
                      categoryFilter === cat
                        ? "bg-brand text-brand-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {formatCategoryName(cat, isAr)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Total Weight Warning in Edit Mode */}
        {isEditing && currentTotalWeight !== 100 && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                {isAr
                  ? `مجموع الأوزان الحالية هو ${currentTotalWeight}%. يرجى تعديل النسب حتى يصبح الإجمالي 100% تماماً لتتمكن من الحفظ.`
                  : `Current total weight is ${currentTotalWeight}%. Sum of all criteria weights must equal exactly 100% before saving.`}
              </span>
            </div>
            <span className="font-mono font-bold text-sm">{currentTotalWeight}% / 100%</span>
          </div>
        )}
      </div>

      {/* ── TABLE MATCHING USER COLUMNS (EDITABLE) ── */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-neutral-800 text-white divide-x divide-neutral-700/60 border-b border-neutral-700 text-[11px] uppercase tracking-wider font-bold">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-4 text-start w-52">{isAr ? "الفئة" : "Category"}</th>
                <th className="py-3 px-4 text-start min-w-[200px]">{isAr ? "اسم المؤشر / المعيار" : "KPI / Metric Name"}</th>
                <th className="py-3 px-4 text-start min-w-[260px]">{isAr ? "التعريف (ماذا يقيس)" : "Definition (What it measures)"}</th>
                <th className="py-3 px-4 text-start min-w-[200px]">{isAr ? "طريقة القياس" : "How it's measured"}</th>
                <th className="py-3 px-3 text-center min-w-[110px] w-32">{isAr ? "الوزن (%)" : "Weight (%)"}</th>
                <th className="py-3 px-3 text-center min-w-[110px] w-32">{isAr ? "المستهدف" : "Target"}</th>
                {isEditing && <th className="py-3 px-2 text-center w-12">{isAr ? "إجراء" : "Action"}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={isEditing ? 8 : 7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                      <span>{isAr ? "لا توجد مؤشرات معروضة" : "No KPI metrics to display"}</span>
                    </div>
                  </td>
                </tr>
              ) : isEditing ? (
                // ── EDIT MODE ROWS ──
                editableRows.map((row, idx) => {
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/30 transition-colors divide-x divide-border/40 bg-card"
                    >
                      {/* # */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-muted-foreground align-top pt-4">
                        {row.numericIndex || idx + 1}
                      </td>

                      {/* Category Selector */}
                      <td className="py-2.5 px-3 align-top">
                        <Select
                          value={row.category}
                          onValueChange={(val) => handleUpdateRowField(row.id, "category", val)}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {STANDARD_CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value} className="text-xs">
                                {isAr ? c.labelAr : c.labelEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* KPI / Metric Name Input */}
                      <td className="py-2.5 px-3 align-top">
                        <Input
                          value={row.name}
                          onChange={(e) => handleUpdateRowField(row.id, "name", e.target.value)}
                          placeholder={isAr ? "اسم المؤشر..." : "Metric name..."}
                          className="h-9 text-xs font-semibold rounded-xl bg-background"
                        />
                        {row.code && (
                          <div className="font-mono text-[10px] text-muted-foreground mt-1 ps-1">
                            {row.code}
                          </div>
                        )}
                      </td>

                      {/* Definition (What it measures) Textarea */}
                      <td className="py-2.5 px-3 align-top">
                        <Textarea
                          value={row.definition}
                          onChange={(e) => handleUpdateRowField(row.id, "definition", e.target.value)}
                          placeholder={isAr ? "اكتب تعريف المؤشر وماذا يقيس بالتفصيل..." : "Describe what this metric measures..."}
                          className="min-h-[64px] text-xs rounded-xl bg-background resize-y leading-relaxed"
                          rows={2}
                        />
                      </td>

                      {/* How it's measured Input */}
                      <td className="py-2.5 px-3 align-top">
                        <Input
                          value={row.howMeasured}
                          onChange={(e) => handleUpdateRowField(row.id, "howMeasured", e.target.value)}
                          placeholder={isAr ? "طريقة الاحتساب والقياس..." : "e.g. Measured in %"}
                          className="h-9 text-xs rounded-xl bg-background"
                        />
                      </td>

                      {/* Weight (%) Input */}
                      <td className="py-2.5 px-3 align-top text-center">
                        <div className="relative inline-flex items-center justify-center w-24">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={row.weightPct === 0 ? "" : row.weightPct}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateRowField(
                                row.id,
                                "weightPct",
                                val === "" ? 0 : Math.min(100, Math.max(0, Number(val)))
                              );
                            }}
                            className="h-9 w-full text-center font-mono font-bold text-sm rounded-xl pe-7 ps-3 bg-background text-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 focus-visible:ring-brand shadow-none"
                          />
                          <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                            %
                          </span>
                        </div>
                      </td>

                      {/* Target Input */}
                      <td className="py-2.5 px-3 align-top text-center">
                        <div className="inline-flex items-center justify-center w-24">
                          <Input
                            value={row.target}
                            onChange={(e) => handleUpdateRowField(row.id, "target", e.target.value)}
                            placeholder="100%"
                            className="h-9 w-full text-center font-mono font-bold text-xs rounded-xl bg-background focus-visible:ring-1 focus-visible:ring-brand shadow-none"
                          />
                        </div>
                      </td>

                      {/* Delete action */}
                      <td className="py-2.5 px-2 text-center align-top pt-3.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition cursor-pointer mx-auto"
                          title={isAr ? "حذف المؤشر" : "Delete Metric"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                // ── READ-ONLY ROWS ──
                displayedRows.map((it: any, idx: number) => {
                  const weightPct = Math.round(Number(it.weight || 0) * 100);
                  const targetStr = `${it.target}${it.unit === "%" ? "%" : it.unit ? " " + it.unit : ""}`;
                  const categoryFormatted = formatCategoryName(it.category, isAr);
                  const howMeasured = isAr
                    ? it.howMeasured_ar || it.howMeasured || "—"
                    : it.howMeasured || (it.unit ? `Measured in ${it.unit}` : "—");
                  const definition = isAr ? it.definition_ar || it.definition : it.definition;

                  return (
                    <tr
                      key={it.id || idx}
                      className="hover:bg-muted/40 transition-colors divide-x divide-border/40 group"
                    >
                      {/* # */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-muted-foreground">
                        {it.numericIndex || idx + 1}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <span className="inline-flex items-center rounded-lg bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:text-orange-300">
                          {categoryFormatted}
                        </span>
                      </td>

                      {/* KPI / Metric Name */}
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        <div className="space-y-0.5">
                          <div className="text-xs">{isAr ? it.name_ar || it.name : it.name}</div>
                          {it.code && (
                            <div className="font-mono text-[10px] text-muted-foreground">{it.code}</div>
                          )}
                        </div>
                      </td>

                      {/* Definition (What it measures) */}
                      <td className="py-3.5 px-4 text-muted-foreground leading-relaxed">
                        {definition || "—"}
                      </td>

                      {/* How it's measured */}
                      <td className="py-3.5 px-4 text-foreground/90 leading-relaxed font-normal">
                        {howMeasured}
                      </td>

                      {/* Weight (%) */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-sm text-brand">
                        {weightPct}%
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-xs text-foreground">
                        <span className="inline-flex items-center justify-center rounded-lg bg-muted px-2 py-1">
                          {targetStr}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer */}
            <tfoot>
              <tr className="bg-muted/60 font-bold border-t border-border text-xs divide-x divide-border/40">
                <td colSpan={5} className="py-3.5 px-4 text-end">
                  <div className="flex items-center justify-between">
                    {isEditing ? (
                      <Button
                        type="button"
                        onClick={handleAddNewRow}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-brand hover:text-brand hover:bg-brand/10 gap-1 rounded-xl cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isAr ? "إضافة معيار جديد" : "Add New Criterion"}</span>
                      </Button>
                    ) : <span />}
                    <span className="text-muted-foreground">
                      {isAr ? "إجمالي الأوزان النسبية لجميع المعايير:" : "Total Criteria Relative Weight:"}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-3 text-center font-mono text-sm text-brand font-extrabold">
                  {currentTotalWeight}%
                </td>
                <td className="py-3.5 px-3 text-center font-mono text-xs text-muted-foreground">
                  {isEditing ? editableRows.length : displayedRows.length} {isAr ? "بند" : "items"}
                </td>
                {isEditing && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
