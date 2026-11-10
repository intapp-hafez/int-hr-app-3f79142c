import React, { useState, useMemo, useEffect } from "react";
import {
  Target,
  FileDown,
  FileSpreadsheet,
  Search,
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
  Layers,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportKpiDefinitionPdf, KpiDefPdfRow } from "@/lib/kpi/kpi-definition-pdf-export";
import { ScorecardItem, formatCategoryName } from "./KpiEvaluationView";

export interface KpisDefinitionTabProps {
  kpiTemplates: any[];
  departmentsData?: any[];
  positionsData?: any[];
  selectedYear?: number;
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
  kpiTemplates = [],
  departmentsData = [],
  positionsData = [],
  selectedYear = 2026,
}: KpisDefinitionTabProps) {
  const { isAr } = useI18n();
  const queryClient = useQueryClient();

  // Template selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return kpiTemplates[0]?.id || "";
  });
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);

  // Auto-select first template if none selected or when templates list loads
  useEffect(() => {
    if (!selectedTemplateId && kpiTemplates.length > 0) {
      setSelectedTemplateId(kpiTemplates[0].id);
    }
  }, [kpiTemplates, selectedTemplateId]);

  const currentTemplate = useMemo(() => {
    return kpiTemplates.find((t) => t.id === selectedTemplateId) || kpiTemplates[0] || null;
  }, [kpiTemplates, selectedTemplateId]);

  const templateName = isAr
    ? currentTemplate?.name_ar || currentTemplate?.name_en || "قالب غير محدد"
    : currentTemplate?.name_en || currentTemplate?.name_ar || "Unspecified Template";

  const jobTitle = isAr
    ? currentTemplate?.position?.name_ar || currentTemplate?.position?.name_en || currentTemplate?.name_ar || currentTemplate?.name_en || "عام"
    : currentTemplate?.position?.name_en || currentTemplate?.name_en || "General";

  const departmentName = isAr
    ? currentTemplate?.department?.name_ar || currentTemplate?.department?.name_en || "كافة الإدارات"
    : currentTemplate?.department?.name_en || "Company-wide";

  // Derive scorecard items from currentTemplate.items
  const activeScorecardItems: ScorecardItem[] = useMemo(() => {
    if (!currentTemplate?.items || currentTemplate.items.length === 0) return [];
    const sorted = [...currentTemplate.items].sort(
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
  }, [currentTemplate]);

  // Export & Filter states
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableRows, setEditableRows] = useState<EditableMetricRow[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

  // Add New KPI Definition Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newDefForm, setNewDefForm] = useState({
    name_en: "",
    name_ar: "",
    category: "behavioral",
    definition_en: "",
    definition_ar: "",
    how_measured_en: "Measured in %",
    how_measured_ar: "يقاس بالنسبة المئوية %",
    weightPct: 10,
    target: "100%",
    unit: "%",
    templateId: "",
  });

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

  // Filtered templates list for the role template selector
  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return kpiTemplates;
    const q = templateSearch.toLowerCase().trim();
    return kpiTemplates.filter(
      (t) =>
        t.name_en?.toLowerCase().includes(q) ||
        t.name_ar?.toLowerCase().includes(q) ||
        t.position?.name_en?.toLowerCase().includes(q) ||
        t.department?.name_en?.toLowerCase().includes(q)
    );
  }, [kpiTemplates, templateSearch]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    activeScorecardItems.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set);
  }, [activeScorecardItems]);

  // Sum of weights in edit mode vs read-only
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
    let list = activeScorecardItems;
    if (categoryFilter !== "all") {
      list = list.filter((it) => it.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.name?.toLowerCase().includes(q) ||
          it.name_ar?.toLowerCase().includes(q) ||
          it.definition?.toLowerCase().includes(q) ||
          it.definition_ar?.toLowerCase().includes(q) ||
          it.howMeasured?.toLowerCase().includes(q) ||
          it.howMeasured_ar?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeScorecardItems, categoryFilter, searchQuery]);

  // ── INLINE EDIT HANDLERS ──
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

  // ── OPEN ADD NEW KPI DEFINITION MODAL ──
  const handleOpenAddModal = () => {
    const currentSum = Math.round(
      activeScorecardItems.reduce((acc, it) => acc + (Number(it.weight) || 0), 0) * 100
    );
    const suggestedWeight = Math.max(5, Math.min(100 - currentSum, 20)) || 10;

    setNewDefForm({
      name_en: "",
      name_ar: "",
      category: "behavioral",
      definition_en: "",
      definition_ar: "",
      how_measured_en: "Measured in %",
      how_measured_ar: "يقاس بالنسبة المئوية %",
      weightPct: suggestedWeight,
      target: "100%",
      unit: "%",
      templateId: currentTemplate?.id || "",
    });
    setAddModalOpen(true);
  };

  // ── SUBMIT NEW KPI DEFINITION ──
  const handleCreateNewDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefForm.name_en.trim() && !newDefForm.name_ar.trim()) {
      toast.error(isAr ? "يرجى إدخال اسم المؤشر" : "Please enter KPI Metric Name");
      return;
    }
    if (!newDefForm.definition_en.trim() && !newDefForm.definition_ar.trim()) {
      toast.error(isAr ? "يرجى إدخال تعريف المؤشر (ماذا يقيس)" : "Please enter KPI Definition");
      return;
    }

    const weightVal = Number(newDefForm.weightPct);
    if (isNaN(weightVal) || weightVal <= 0 || weightVal > 100) {
      toast.error(isAr ? "الوزن يجب أن يكون بين 1% و 100%" : "Weight must be between 1% and 100%");
      return;
    }

    setIsAddingNew(true);
    try {
      const nameEn = newDefForm.name_en.trim() || newDefForm.name_ar.trim();
      const nameAr = newDefForm.name_ar.trim() || nameEn;
      const defEn = newDefForm.definition_en.trim() || newDefForm.definition_ar.trim();
      const defAr = newDefForm.definition_ar.trim() || defEn;
      const howEn =
        newDefForm.how_measured_en.trim() ||
        (newDefForm.unit ? `Measured in ${newDefForm.unit}` : "Measured in %");
      const howAr = newDefForm.how_measured_ar.trim() || howEn;
      const weightDecimal = weightVal / 100;
      const targetNumeric = Number(newDefForm.target.replace(/[^0-9.]/g, "")) || 100;

      // 1. Insert into kpi_criteria
      const { data: newCrit, error: critErr } = await supabase
        .from("kpi_criteria")
        .insert({
          name_en: nameEn,
          name_ar: nameAr,
          criterion_type: "common",
          description_en: defEn,
          description_ar: defAr,
          category: newDefForm.category,
          how_measured_en: howEn,
          how_measured_ar: howAr,
          unit: newDefForm.unit || "%",
          default_weight: weightDecimal,
          scoring_direction: "higher_is_better",
          is_active: true,
          is_required: true,
        })
        .select("id")
        .single();

      if (critErr) throw critErr;

      // 2. Attach to target template
      const targetTmplId = newDefForm.templateId || currentTemplate?.id;
      if (targetTmplId && newCrit?.id) {
        const nextOrder = (activeScorecardItems?.length || 0) + 1;
        const { error: itemErr } = await supabase
          .from("kpi_template_items")
          .insert({
            template_id: targetTmplId,
            criterion_id: newCrit.id,
            weight: weightDecimal,
            target_benchmark: targetNumeric,
            display_order: nextOrder,
          });
        if (itemErr) throw itemErr;
      }

      // 3. Invalidate React Query caches
      await queryClient.invalidateQueries({ queryKey: ["kpi-templates"] });
      await queryClient.invalidateQueries({ queryKey: ["kpi-criteria"] });
      await queryClient.invalidateQueries({ queryKey: ["kpi-matched-template"] });

      toast.success(
        isAr
          ? "تمت إضافة تعريف المؤشر الجديد وحفظه في القالب بنجاح!"
          : "New KPI Definition created and attached to template successfully!"
      );
      setAddModalOpen(false);
    } catch (err: any) {
      console.error("Failed to add KPI definition:", err);
      toast.error(err.message || "Failed to create KPI definition");
    } finally {
      setIsAddingNew(false);
    }
  };

  // ── SAVE CHANGES TO DATABASE ──
  const handleSaveChanges = async () => {
    if (currentTotalWeight !== 100) {
      toast.error(
        isAr
          ? `مجموع الأوزان الحالية هو ${currentTotalWeight}%. يجب أن يكون المجموع 100% تماماً للحفظ.`
          : `Current total weight is ${currentTotalWeight}%. Total weight must equal exactly 100% to save.`
      );
      return;
    }

    const templateId = currentTemplate?.id;
    if (!templateId) {
      toast.error(isAr ? "لم يتم تحديد قالب لحفظ المؤشرات" : "No template selected to save metrics");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Delete rows marked for removal
      if (deletedItemIds.length > 0) {
        const { error: delErr } = await supabase
          .from("kpi_template_items")
          .delete()
          .in("id", deletedItemIds);
        if (delErr) throw delErr;
      }

      // 2. Process updates and new rows
      for (const row of editableRows) {
        const targetBenchmark = Number(row.target.replace(/[^0-9.]/g, "")) || 100;
        const weightDecimal = Number(row.weightPct) / 100;

        if (row.isNew) {
          // A) Insert new criterion into kpi_criteria
          const { data: newCrit, error: critErr } = await supabase
            .from("kpi_criteria")
            .insert({
              name_en: row.name,
              name_ar: row.name,
              criterion_type: "common",
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

          // B) Attach to current template
          if (newCrit?.id) {
            const { error: itemErr } = await supabase
              .from("kpi_template_items")
              .insert({
                template_id: templateId,
                criterion_id: newCrit.id,
                weight: weightDecimal,
                target_benchmark: targetBenchmark,
                display_order: row.numericIndex,
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

      // Invalidate queries to refresh view
      await queryClient.invalidateQueries({ queryKey: ["kpi-templates"] });
      await queryClient.invalidateQueries({ queryKey: ["kpi-criteria"] });
      await queryClient.invalidateQueries({ queryKey: ["kpi-matched-template"] });

      toast.success(
        isAr
          ? "تم حفظ تعديلات بطاقة تعريف المؤشرات بنجاح!"
          : "KPIs Definition matrix saved successfully!"
      );
      setIsEditing(false);
    } catch (err: any) {
      console.error("Failed to save KPI definitions:", err);
      toast.error(err.message || "Failed to save changes to database");
    } finally {
      setIsSaving(false);
    }
  };

  // ── EXPORT PDF ──
  const handleExportPdf = async () => {
    if (activeScorecardItems.length === 0) {
      toast.error(isAr ? "لا توجد مؤشرات للتصدير" : "No KPIs to export");
      return;
    }

    setIsExportingPdf(true);
    try {
      const pdfRows: KpiDefPdfRow[] = activeScorecardItems.map((it, idx) => ({
        id: it.numericIndex || idx + 1,
        category: formatCategoryName(it.category, isAr),
        name: isAr ? it.name_ar || it.name : it.name,
        definition: isAr ? it.definition_ar || it.definition : it.definition,
        howMeasured: isAr
          ? it.howMeasured_ar || it.howMeasured || "—"
          : it.howMeasured || (it.unit ? `Measured in ${it.unit}` : "—"),
        weight: Number(it.weight || 0),
        target: Number(it.target || 100) > 1 ? Number(it.target) / 100 : Number(it.target || 1),
        unit: it.unit || "%",
      }));

      await exportKpiDefinitionPdf(
        pdfRows,
        {
          position: jobTitle,
          department: departmentName,
          templateName: templateName,
          version: `v${currentTemplate?.version || 1}`,
        },
        selectedYear
      );

      toast.success(isAr ? "تم تصدير ملف PDF بنجاح" : "PDF exported successfully");
    } catch (err: any) {
      console.error("Failed to export PDF:", err);
      toast.error(err.message || "Failed to export PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ── EXPORT EXCEL ──
  const handleExportExcel = async () => {
    try {
      const { utils, writeFile } = await import("xlsx");
      const sourceList = isEditing ? editableRows : activeScorecardItems;
      const dataToExport = sourceList.map((it: any, idx: number) => ({
        "#": it.numericIndex || idx + 1,
        Category: formatCategoryName(it.category, false),
        "KPI / Metric Name": it.name,
        "Definition (What it measures)": it.definition,
        "How it's measured": it.howMeasured || (it.unit ? `Measured in ${it.unit}` : "—"),
        "Weight (%)": `${isEditing ? it.weightPct : Math.round(it.weight * 100)}%`,
        Target: `${it.target}${it.unit === "%" ? "%" : it.unit ? " " + it.unit : ""}`,
      }));

      const ws = utils.json_to_sheet(dataToExport);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "KPIs Definition");
      const filename = `KPIs_Definition_${templateName.replace(/\s+/g, "_")}_${selectedYear}.xlsx`;
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
                ? "دليل تعريفي لمعايير الأداء الوظيفية، صيغ الاحتساب، والمستهدفات والأوزان النسبية لكل منصب."
                : "Definitive matrix for role KPIs, measurement formulas, targets, and percentage weights by job position."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Job Role Template Selector Dropdown */}
            <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isEditing}
                  className="rounded-2xl gap-2 text-xs font-semibold cursor-pointer border-border h-9"
                >
                  <Briefcase className="h-3.5 w-3.5 text-brand" />
                  <span className="max-w-[180px] truncate">{templateName}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-88 p-3 rounded-2xl shadow-xl" align="end">
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>{isAr ? "اختر القالب الوظيفي" : "Select Job Role Template"}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {kpiTemplates.length} {isAr ? "قالب" : "Templates"}
                    </Badge>
                  </div>
                  <div className="relative">
                    <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder={isAr ? "بحث بالقالب أو الوظيفة..." : "Search template or position..."}
                      className="ps-8 h-8 text-xs rounded-xl"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/40 text-xs">
                    {filteredTemplates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(t.id);
                          setTemplatePopoverOpen(false);
                          setTemplateSearch("");
                        }}
                        className={`w-full text-start p-2.5 rounded-xl transition cursor-pointer flex flex-col gap-1 hover:bg-muted/60 ${
                          t.id === currentTemplate?.id ? "bg-brand/10 font-bold text-brand" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate font-bold">
                            {isAr ? t.name_ar || t.name_en : t.name_en || t.name_ar}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {t.items?.length || 0} {isAr ? "معايير" : "KPIs"}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5">
                          <span>{t.position?.name_en || isAr ? "كافة المناصب" : "All Roles"}</span>
                          <span>•</span>
                          <span>{t.department?.name_en || isAr ? "عام" : "General"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* ── ADD NEW KPI DEFINITION BUTTON (ALWAYS VISIBLE) ── */}
            <Button
              onClick={handleOpenAddModal}
              size="sm"
              className="rounded-2xl gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer h-9 text-xs font-bold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isAr ? "إضافة تعريف مؤشر جديد" : "Add KPI Definition"}</span>
            </Button>

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

        {/* ── HEADER SUBTITLE BANNER (Job Role Definition — NOT tied to employee) ── */}
        <div className="relative overflow-hidden rounded-2xl bg-neutral-900 text-white p-4 sm:p-5 shadow-sm border border-neutral-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-semibold">{isAr ? "النموذج:" : "Template:"}</span>
                <span className="font-bold text-sm text-white tracking-tight">{templateName}</span>
                {currentTemplate?.status && (
                  <Badge variant="outline" className="text-[10px] font-mono border-neutral-700 text-orange-400">
                    {currentTemplate.status.toUpperCase()}
                  </Badge>
                )}
              </div>

              <span className="hidden md:inline text-neutral-600">|</span>

              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-semibold">{isAr ? "المسمى الوظيفي:" : "Job Title:"}</span>
                <span className="font-semibold text-orange-400">{jobTitle}</span>
              </div>

              <span className="hidden md:inline text-neutral-600">|</span>

              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-semibold">{isAr ? "الإدارة / القسم:" : "Department:"}</span>
                <span className="text-neutral-200">{departmentName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span>{isAr ? "الإصدار:" : "Version:"}</span>
              <span className="font-mono text-neutral-300">v{currentTemplate?.version || 1}</span>
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

            {categories.length > 1 && (() => {
              const visibleCategories = categories.slice(0, 3);
              const overflowCategories = categories.slice(3);
              const isOverflowActive = overflowCategories.includes(categoryFilter);

              return (
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition ${
                      categoryFilter === "all"
                        ? "bg-brand text-brand-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {isAr ? "الكل" : "All"} ({activeScorecardItems.length})
                  </button>

                  {visibleCategories.map((cat) => (
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

                  {overflowCategories.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition ${
                            isOverflowActive
                              ? "bg-brand text-brand-foreground shadow-xs"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          <span>
                            {isOverflowActive
                              ? formatCategoryName(categoryFilter, isAr)
                              : (isAr ? "المزيد" : "More")}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto rounded-2xl p-1.5 shadow-lg border border-border bg-popover z-50">
                        {overflowCategories.map((cat) => (
                          <DropdownMenuItem
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs cursor-pointer font-medium transition ${
                              categoryFilter === cat
                                ? "bg-brand/10 text-brand font-bold"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <span className="truncate">{formatCategoryName(cat, isAr)}</span>
                            {categoryFilter === cat && (
                              <span className="h-2 w-2 rounded-full bg-brand shrink-0 ms-2" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })()}
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
                      <span>{isAr ? "لا توجد مؤشرات معروضة لهذا القالب" : "No KPI metrics defined for this template"}</span>
                      <Button
                        type="button"
                        onClick={handleOpenAddModal}
                        size="sm"
                        className="mt-2 rounded-2xl gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 font-bold text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isAr ? "إضافة تعريف مؤشر أداء جديد" : "Add KPI Definition"}</span>
                      </Button>
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

                      {/* Category Input (Directly Editable + Presets) */}
                      <td className="py-2.5 px-3 align-top min-w-[170px]">
                        <div className="space-y-1">
                          <Input
                            value={row.category}
                            onChange={(e) => handleUpdateRowField(row.id, "category", e.target.value)}
                            placeholder={isAr ? "اسم الفئة..." : "Category name..."}
                            className="h-9 text-xs rounded-xl bg-background font-medium"
                          />
                          <Select
                            value=""
                            onValueChange={(val) => {
                              if (val) handleUpdateRowField(row.id, "category", val);
                            }}
                          >
                            <SelectTrigger className="h-6 text-[10px] rounded-lg bg-muted/40 border-dashed text-muted-foreground">
                              <span>{isAr ? "اختر فئة شائعة..." : "Select preset..."}</span>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {STANDARD_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={isAr ? c.labelAr : c.labelEn} className="text-xs">
                                  {isAr ? c.labelAr : c.labelEn}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>

                      {/* KPI / Metric Name Input */}
                      <td className="py-2.5 px-3 align-top">
                        <Input
                          value={row.name}
                          onChange={(e) => handleUpdateRowField(row.id, "name", e.target.value)}
                          placeholder={isAr ? "اسم المؤشر..." : "Metric name..."}
                          className="h-9 text-xs font-semibold rounded-xl bg-background"
                        />
                      </td>

                      {/* Definition Input */}
                      <td className="py-2.5 px-3 align-top">
                        <Textarea
                          value={row.definition}
                          onChange={(e) => handleUpdateRowField(row.id, "definition", e.target.value)}
                          placeholder={isAr ? "ماذا يقيس هذا المؤشر..." : "What this metric measures..."}
                          className="min-h-[56px] text-xs resize-y rounded-xl bg-background"
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
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={row.weightPct === 0 ? "" : row.weightPct}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              const num = raw === "" ? 0 : Math.min(100, Math.max(0, parseInt(raw, 10)));
                              handleUpdateRowField(row.id, "weightPct", num);
                            }}
                            className="h-9 w-full text-center font-mono font-bold text-sm rounded-xl pe-7 ps-3 bg-background text-brand focus-visible:ring-1 focus-visible:ring-brand shadow-none"
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

      {/* ── ADD NEW KPI DEFINITION DIALOG (WIDER + EDITABLE CATEGORY) ── */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateNewDefinition} className="space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-2 text-brand">
                <Target className="h-5 w-5" />
                <DialogTitle className="text-lg font-bold font-display">
                  {isAr ? "إضافة تعريف مؤشر أداء جديد" : "Add New KPI Definition"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {isAr
                  ? "قم بتعريف المؤشر وتحديد طريقة قياسه وفئته ووزنه النسبي ومستهدفه ليتم ربطه بنموذج تقييم الأداء."
                  : "Define a new performance metric with its measurement formula, category, description, target benchmark, and percentage weight."}
              </DialogDescription>
            </DialogHeader>

            {/* Target Template & Role Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  {isAr ? "النموذج والوظيفة المستهدفة:" : "Target Template & Role:"}
                </span>
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="text-brand">{templateName}</span>
                  <span className="text-muted-foreground font-normal">
                    {jobTitle} • {departmentName}
                  </span>
                </div>
              </div>

              {kpiTemplates && kpiTemplates.length > 1 ? (
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    {isAr ? "ربط بقالب وظيفي:" : "Assign to Job Role Template:"}
                  </Label>
                  <select
                    value={newDefForm.templateId}
                    onChange={(e) => setNewDefForm((p) => ({ ...p, templateId: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-background px-2.5 py-1 text-xs font-semibold h-7"
                  >
                    {kpiTemplates.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {isAr ? t.name_ar || t.name_en : t.name_en || t.name_ar}
                        {t.position?.name_en ? ` (${t.position.name_en})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>{isAr ? "الإصدار الحالي:" : "Current Version:"}</span>
                  <span className="font-mono font-bold text-foreground">v{currentTemplate?.version || 1} • {currentTemplate?.status || "Published"}</span>
                </div>
              )}
            </div>

            {/* Category Section (Fully Editable Input + Quick Presets) */}
            <div className="space-y-2 p-4 rounded-2xl border border-border/80 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-brand" />
                  <span>{isAr ? "فئة المعيار / المؤشر (قابلة للتعديل والكتابة المباشرة)" : "KPI Category (Editable text + Presets)"}</span>
                  <span className="text-rose-500">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {isAr ? "اكتب أي فئة مخصصة أو انقر لاختيار فئة قياسية" : "Type custom category or select a standard preset below"}
                </span>
              </div>

              <Input
                value={newDefForm.category}
                onChange={(e) => setNewDefForm((p) => ({ ...p, category: e.target.value }))}
                placeholder={isAr ? "اكتب اسم الفئة (مثال: الجودة، الأداء التشغيلي، السلوكية...)" : "Enter category name (e.g. Technical, Behavioral, Quality, Operational...)"}
                className="rounded-xl text-xs h-9 bg-background font-semibold"
                required
              />

              {/* Clickable Preset Badges */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold me-1">
                  {isAr ? "فئات جاهزة:" : "Presets:"}
                </span>
                {STANDARD_CATEGORIES.map((c) => {
                  const label = isAr ? c.labelAr : c.labelEn;
                  const isSelected =
                    newDefForm.category.trim().toLowerCase() === c.value.toLowerCase() ||
                    newDefForm.category.trim().toLowerCase() === label.toLowerCase();
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewDefForm((p) => ({ ...p, category: label }))}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer font-medium ${
                        isSelected
                          ? "bg-brand/10 border-brand/50 text-brand font-bold shadow-2xs"
                          : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI Metric Names (English & Arabic) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "اسم المؤشر (بالإنجليزية)" : "KPI Name (English)"} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={newDefForm.name_en}
                  onChange={(e) => setNewDefForm((p) => ({ ...p, name_en: e.target.value }))}
                  placeholder="e.g. Code Review & Team Collaboration"
                  className="rounded-xl text-xs h-9 bg-background font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "اسم المؤشر (بالعربية)" : "KPI Name (Arabic)"}
                </Label>
                <Input
                  value={newDefForm.name_ar}
                  onChange={(e) => setNewDefForm((p) => ({ ...p, name_ar: e.target.value }))}
                  placeholder="مثال: مراجعة الأكواد والتعاون الجماعي"
                  dir="rtl"
                  className="rounded-xl text-xs h-9 text-right bg-background font-medium"
                />
              </div>
            </div>

            {/* Definition (What it measures) - 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "التعريف (ماذا يقيس - إنجليزي)" : "Definition (What it measures - English)"} <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  value={newDefForm.definition_en}
                  onChange={(e) => setNewDefForm((p) => ({ ...p, definition_en: e.target.value }))}
                  placeholder="Describe what this KPI measures, expected quality standards, and scope..."
                  rows={3}
                  className="rounded-xl text-xs resize-y bg-background leading-relaxed"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "التعريف (ماذا يقيس - عربي)" : "Definition (What it measures - Arabic)"}
                </Label>
                <Textarea
                  value={newDefForm.definition_ar}
                  onChange={(e) => setNewDefForm((p) => ({ ...p, definition_ar: e.target.value }))}
                  placeholder="اشرح بالتفصيل ما الذي يقيسه هذا المؤشر ومخرجات الأداء المتوقعة..."
                  rows={3}
                  dir="rtl"
                  className="rounded-xl text-xs resize-y bg-background text-right leading-relaxed"
                />
              </div>
            </div>

            {/* How it's measured (Measurement Methodology / Formula) - 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "طريقة القياس والاحتساب (بالإنجليزية)" : "How it's measured (Formula - English)"} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={newDefForm.how_measured_en}
                  onChange={(e) => setNewDefForm((p) => ({ ...p, how_measured_en: e.target.value }))}
                  placeholder="e.g. Measured in % compliance or quarterly review score"
                  className="rounded-xl text-xs h-9 bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "طريقة القياس والاحتساب (بالعربية)" : "How it's measured (Formula - Arabic)"}
                </Label>
                <Input
                  value={newDefForm.how_measured_ar}
                  onChange={(e) => setNewDefForm((p) => ({ ...p, how_measured_ar: e.target.value }))}
                  placeholder="مثال: يقاس كنسبة مئوية من المهام المنجزة في الوقت المحدد"
                  dir="rtl"
                  className="rounded-xl text-xs h-9 text-right bg-background"
                />
              </div>
            </div>

            {/* Weight, Target & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/80">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "الوزن النسبي (%)" : "Weight (%)"} <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newDefForm.weightPct === 0 ? "" : newDefForm.weightPct}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      const num = raw === "" ? 0 : Math.min(100, Math.max(0, parseInt(raw, 10)));
                      setNewDefForm((p) => ({ ...p, weightPct: num }));
                    }}
                    className="rounded-xl text-xs h-9 text-center font-mono font-bold pe-7 ps-3 bg-background"
                    required
                  />
                  <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                    %
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "المستهدف" : "Target Benchmark"} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={newDefForm.target}
                  onChange={(e) => setNewDefForm((p) => ({ ...p, target: e.target.value }))}
                  placeholder="100%"
                  className="rounded-xl text-xs h-9 text-center font-mono font-bold bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {isAr ? "وحدة القياس" : "Unit"}
                </Label>
                <Select
                  value={newDefForm.unit}
                  onValueChange={(val) => setNewDefForm((p) => ({ ...p, unit: val }))}
                >
                  <SelectTrigger className="rounded-xl text-xs h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="%" className="text-xs">% (Percentage)</SelectItem>
                    <SelectItem value="scale" className="text-xs">Scale (1 to 5)</SelectItem>
                    <SelectItem value="numeric" className="text-xs">Numeric</SelectItem>
                    <SelectItem value="count" className="text-xs">Count / Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <DialogFooter className="gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddModalOpen(false)}
                disabled={isAddingNew}
                className="rounded-2xl text-xs h-9 px-5"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isAddingNew}
                className="rounded-2xl text-xs h-9 px-5 bg-brand text-brand-foreground hover:bg-brand/90 font-bold gap-1.5 shadow-xs"
              >
                {isAddingNew ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>{isAr ? "حفظ وإضافة المؤشر" : "Save & Add Definition"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
