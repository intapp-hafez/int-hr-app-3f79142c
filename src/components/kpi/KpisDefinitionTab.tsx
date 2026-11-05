import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
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
  const [empSearch, setEmpSearch] = useState("");
  const [empPopoverOpen, setEmpPopoverOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Unique categories in the active items
  const categories = useMemo(() => {
    const set = new Set<string>();
    activeScorecardItems.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set);
  }, [activeScorecardItems]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return activeScorecardItems.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (item.name || "").toLowerCase().includes(q);
        const matchNameAr = (item.name_ar || "").toLowerCase().includes(q);
        const matchDef = (item.definition || "").toLowerCase().includes(q);
        const matchDefAr = (item.definition_ar || "").toLowerCase().includes(q);
        const matchCat = (item.category || "").toLowerCase().includes(q);
        if (!matchName && !matchNameAr && !matchDef && !matchDefAr && !matchCat) {
          return false;
        }
      }
      return true;
    });
  }, [activeScorecardItems, categoryFilter, searchQuery]);

  // Total weight
  const totalWeight = useMemo(() => {
    return Math.round(
      activeScorecardItems.reduce((acc, it) => acc + (it.weight || 0), 0) * 100
    );
  }, [activeScorecardItems]);

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
      const exportData = activeScorecardItems.map((it, idx) => ({
        "#": idx + 1,
        Category: formatCategoryName(it.category, false),
        "KPI / Metric Name": it.name,
        "Definition (What it measures)": it.definition,
        "How it's measured": it.howMeasured || (it.unit ? `Measured in ${it.unit}` : "—"),
        "Weight (%)": `${Math.round(it.weight * 100)}%`,
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
                {activeScorecardItems.length} {isAr ? "معيار" : "Metrics"}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  totalWeight === 100
                    ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                    : "border-amber-500/40 text-amber-600 bg-amber-500/5"
                }`}
              >
                {totalWeight}% {isAr ? "الوزن الكلي" : "Total Weight"}
              </Badge>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
              {isAr ? "مؤشرات الأداء ومعايير القياس الوظيفية" : "Role KPIs Definition & Target Benchmarks"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "دليل تفصيلي لجميع مؤشرات الأداء الخاصة بالوظيفة، أوزانها النسبية، طريقة الحساب، ومستهدفات الإنجاز."
                : "Complete metric formulas, measurement methodologies, relative weights, and targets for the role."}
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
      </div>

      {/* ── TABLE MATCHING USER COLUMNS ── */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-neutral-800 text-white divide-x divide-neutral-700/60 border-b border-neutral-700 text-[11px] uppercase tracking-wider font-bold">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-4 text-start w-48">{isAr ? "الفئة" : "Category"}</th>
                <th className="py-3 px-4 text-start min-w-[200px]">{isAr ? "اسم المؤشر / المعيار" : "KPI / Metric Name"}</th>
                <th className="py-3 px-4 text-start min-w-[260px]">{isAr ? "التعريف (ماذا يقيس)" : "Definition (What it measures)"}</th>
                <th className="py-3 px-4 text-start min-w-[220px]">{isAr ? "طريقة القياس" : "How it's measured"}</th>
                <th className="py-3 px-3 text-center w-24">{isAr ? "الوزن (%)" : "Weight (%)"}</th>
                <th className="py-3 px-3 text-center w-24">{isAr ? "المستهدف" : "Target"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                      <span>{isAr ? "لا توجد مؤشرات تطابق معايير البحث" : "No KPI metrics match your criteria"}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((it, idx) => {
                  const weightPct = Math.round(it.weight * 100);
                  const targetStr = `${it.target}${it.unit === "%" ? "%" : it.unit ? " " + it.unit : ""}`;
                  const categoryFormatted = formatCategoryName(it.category, isAr);
                  const howMeasured = isAr
                    ? it.howMeasured_ar || it.howMeasured || "—"
                    : it.howMeasured || (it.unit ? `Measured in ${it.unit}` : "—");
                  const definition = isAr ? it.definition_ar || it.definition : it.definition;

                  return (
                    <tr
                      key={it.id || idx}
                      className="hover:bg-muted/40 transition-colors divide-x divide-border/40"
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
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-muted/60 font-bold border-t border-border text-xs divide-x divide-border/40">
                  <td colSpan={5} className="py-3 px-4 text-end">
                    <span className="text-muted-foreground">
                      {isAr ? "إجمالي الأوزان النسبية لجميع المعايير:" : "Total Criteria Relative Weight:"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-sm text-brand font-extrabold">
                    {totalWeight}%
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-xs text-muted-foreground">
                    {filteredRows.length} {isAr ? "بند" : "items"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

