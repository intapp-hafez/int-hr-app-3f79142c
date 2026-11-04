import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FileText, Loader2, Pencil, Plus, Search, Save, Trash2,
  ChevronDown, ChevronUp, GraduationCap, Users, Shield,
  TrendingUp, FileCheck, MapPin, Briefcase, Clock, Sparkles,
  FileSpreadsheet, Upload, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { exportJobDescriptionPdf } from "@/lib/kpi/jd-pdf-export";
import {
  jobDescriptionSchema,
  parseJobTags,
  JOB_CATEGORIES,
  POSITION_TYPES,
  LOCATION_TYPES,
  JD_SELECT_COLUMNS,
  type SavedJobDescription,
} from "@/lib/job-descriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Position = { id: string; name_en: string; name_ar: string | null };

// SPA uses the authenticated browser client; database policies authorize every request.
const db: SupabaseClient = supabase;

async function readAll<T>(table: string, columns: string, order: string): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order(order).range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as T[];
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
}

// ── Collapsible section wrapper with clean step badge ────────────────────────
function FormSection({
  stepNumber,
  icon: Icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  stepNumber?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 shadow-2xs overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-3.5 text-start hover:bg-muted/30 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {stepNumber && (
                <span className="font-mono text-[10px] font-bold text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.2 rounded-md shrink-0">
                  {stepNumber}
                </span>
              )}
              <p className="text-xs sm:text-sm font-bold text-foreground leading-snug truncate">{title}</p>
            </div>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{subtitle}</p>}
          </div>
        </div>
        <div className="text-muted-foreground shrink-0 ms-2">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="px-3.5 pb-4 space-y-3.5 border-t border-border/50 pt-3.5 bg-background/50">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Bullet list field (dynamic add/remove rows) ──────────────────────────────
function BulletListField({
  label,
  items,
  onChange,
  placeholder,
  disabled,
  addLabel,
  emptyLabel,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  addLabel?: string;
  emptyLabel?: string;
}) {
  const add = () => onChange([...items, ""]);
  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          disabled={disabled}
          className="h-7 text-[11px] gap-1 px-2.5 rounded-lg border-border/70"
        >
          <Plus className="h-3 w-3 text-brand" /> {addLabel || "Add item"}
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/60 font-mono text-[11px] font-bold text-muted-foreground">
              {i + 1}
            </span>
            <Input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="h-8.5 text-xs flex-1 rounded-xl"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => remove(i)}
              disabled={disabled}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic px-1 py-1">
            {emptyLabel || "No items added yet. Click Add to insert one."}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function JobDescriptionsTab() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavedJobDescription | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Form state (all fields)
  const [positionId, setPositionId] = useState("");
  const [jobCode, setJobCode] = useState("");
  const [jobCategory, setJobCategory] = useState<string>("Non-managerial");
  const [positionType, setPositionType] = useState<string>("Full-time");
  const [locationType, setLocationType] = useState<string>("On-site");
  const [jobGrade, setJobGrade] = useState("");
  const [jobSummary, setJobSummary] = useState("");
  const [responsibilities, setResponsibilities] = useState<string[]>([""]);
  const [qualifications, setQualifications] = useState("");
  const [technicalComps, setTechnicalComps] = useState("");
  const [behavioralComps, setBehavioralComps] = useState("");
  const [internalRelations, setInternalRelations] = useState("");
  const [externalRelations, setExternalRelations] = useState("");
  const [authority, setAuthority] = useState<string[]>([]);
  const [careerPath, setCareerPath] = useState<string[]>([]);
  const [docVersion, setDocVersion] = useState("v1.0");
  const [reviewedBy, setReviewedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [tags, setTags] = useState("");

  // ── Queries
  const positions = useQuery({
    queryKey: ["job-description-positions"],
    queryFn: () => readAll<Position>("positions", "id,name_en,name_ar", "name_en"),
  });
  const records = useQuery({
    queryKey: ["position-job-descriptions"],
    queryFn: () => readAll<SavedJobDescription>("position_job_descriptions", JD_SELECT_COLUMNS, "id"),
    retry: false,
  });

  const posName = (id: string) => {
    const p = positions.data?.find((x) => x.id === id);
    return (isAr ? p?.name_ar || p?.name_en : p?.name_en) ?? (isAr ? "غير متاح" : "Unknown");
  };

  // ── Mutation
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        position_id: positionId,
        job_code: jobCode,
        job_category: jobCategory as typeof JOB_CATEGORIES[number],
        position_type: positionType as typeof POSITION_TYPES[number],
        location_type: locationType as typeof LOCATION_TYPES[number],
        job_grade: jobGrade,
        job_summary: jobSummary,
        responsibilities: responsibilities.filter(Boolean),
        qualifications,
        technical_competencies: parseJobTags(technicalComps),
        behavioral_competencies: parseJobTags(behavioralComps),
        internal_relations: internalRelations,
        external_relations: externalRelations,
        authority: authority.filter(Boolean),
        career_path: careerPath.filter(Boolean),
        doc_version: docVersion,
        reviewed_by: reviewedBy,
        approved_by: approvedBy,
        tags: parseJobTags(tags),
      };

      const result = jobDescriptionSchema.safeParse(payload);
      if (!result.success) {
        const errs: Record<string, string> = {};
        result.error.issues.forEach((issue) => { errs[String(issue.path[0])] = issue.message; });
        setErrors(errs);
        throw new Error(isAr ? "يرجى استكمال الحقول الإلزامية المطلوبة" : "Please fill in all required fields.");
      }
      setErrors({});

      const req = editing
        ? db.from("position_job_descriptions").update(result.data).eq("id", editing.id)
        : db.from("position_job_descriptions").insert(result.data);
      const { error } = await req;
      if (error) {
        throw new Error(
          error.code === "23505"
            ? (isAr ? "يوجد وصف وظيفي مسجل مسبقاً لهذا المسمى، يرجى تعديله." : "This position already has a job description. Edit its existing entry.")
            : error.message
        );
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["position-job-descriptions"] });
      setOpen(false);
      toast.success(isAr ? "تم حفظ الوصف الوظيفي بنجاح" : "Job description saved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Open / reset dialog
  const startEdit = (record: SavedJobDescription | null) => {
    setEditing(record);
    setErrors({});
    if (record) {
      setPositionId(record.position_id);
      setJobCode(record.job_code ?? "");
      setJobCategory(record.job_category ?? "Non-managerial");
      setPositionType(record.position_type ?? "Full-time");
      setLocationType(record.location_type ?? "On-site");
      setJobGrade(record.job_grade ?? "");
      setJobSummary(record.job_summary ?? "");
      setResponsibilities(record.responsibilities?.length ? record.responsibilities : [""]);
      setQualifications(record.qualifications ?? "");
      setTechnicalComps((record.technical_competencies ?? []).join(", "));
      setBehavioralComps((record.behavioral_competencies ?? []).join(", "));
      setInternalRelations(record.internal_relations ?? "");
      setExternalRelations(record.external_relations ?? "");
      setAuthority(record.authority?.length ? record.authority : []);
      setCareerPath(record.career_path?.length ? record.career_path : []);
      setDocVersion(record.doc_version ?? "v1.0");
      setReviewedBy(record.reviewed_by ?? "");
      setApprovedBy(record.approved_by ?? "");
      setTags((record.tags ?? []).join(", "));
    } else {
      setPositionId(""); setJobCode(""); setJobCategory("Non-managerial");
      setPositionType("Full-time"); setLocationType("On-site"); setJobGrade("");
      setJobSummary(""); setResponsibilities([""]); setQualifications("");
      setTechnicalComps(""); setBehavioralComps(""); setInternalRelations("");
      setExternalRelations(""); setAuthority([]); setCareerPath([]);
      setDocVersion("v1.0"); setReviewedBy(""); setApprovedBy(""); setTags("");
    }
    setOpen(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // ── Excel Export Handler
  const handleExportExcel = async () => {
    if (!records.data?.length) {
      toast.error(isAr ? "لا توجد أوصاف وظيفية للتصدير" : "No job descriptions to export");
      return;
    }
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const exportRows = records.data.map((r) => {
        const p = positions.data?.find((pos) => pos.id === r.position_id);
        return {
          "Job Code": r.job_code || "",
          "Position Name (EN)": p?.name_en || "",
          "Position Name (AR)": p?.name_ar || "",
          "Position ID": r.position_id,
          "Grade": r.job_grade || "",
          "Category": r.job_category || "Non-managerial",
          "Position Type": r.position_type || "Full-time",
          "Location Type": r.location_type || "On-site",
          "Job Summary": r.job_summary || "",
          "Responsibilities": (r.responsibilities || []).map((x, i) => `${i + 1}. ${x}`).join("\n"),
          "Qualifications & Experience": r.qualifications || "",
          "Technical Competencies": (r.technical_competencies || []).join("\n"),
          "Behavioral Competencies": (r.behavioral_competencies || []).join("\n"),
          "Internal Relations": r.internal_relations || "",
          "External Relations": r.external_relations || "",
          "Authority & Decision Making": (r.authority || []).map((x, i) => `${i + 1}. ${x}`).join("\n"),
          "Career Path": (r.career_path || []).map((x, i) => `${i + 1}. ${x}`).join("\n"),
          "Document Version": r.doc_version || "v1.0",
          "Reviewed By": r.reviewed_by || "",
          "Approved By": r.approved_by || "",
          "Tags": (r.tags || []).join(", "),
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 28 },
        { wch: 38 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 45 },
        { wch: 55 },
        { wch: 45 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
        { wch: 35 },
        { wch: 30 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 25 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Job Descriptions");
      XLSX.writeFile(wb, `Job_Descriptions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(isAr ? "تم تصدير ملف الإكسيل بنجاح" : "Excel file exported successfully");
    } catch (err: unknown) {
      console.error("Export error:", err);
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Excel Import Handler
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) throw new Error(isAr ? "ملف الإكسيل فارغ" : "Excel sheet is empty");
      const ws = wb.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (!rows.length) {
        toast.error(isAr ? "لم يتم العثور على أي صفوف في الملف" : "No rows found in file");
        return;
      }

      const availablePositions = positions.data ?? [];
      const splitList = (val: unknown): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
        const str = String(val);
        return str
          .split(/[\r\n;,]+/)
          .map((s) => s.replace(/^\s*(\d+[\.\)]|\*|•|-)\s*/, "").trim())
          .filter(Boolean);
      };

      const normalizeCategory = (cat: unknown): "Non-managerial" | "Managerial" => {
        const s = String(cat || "").toLowerCase();
        if (s.includes("manag") && !s.includes("non")) return "Managerial";
        if (s.includes("إداري") && !s.includes("غير")) return "Managerial";
        return "Non-managerial";
      };

      const normalizePosType = (pt: unknown): "Full-time" | "Part-time" | "Contract" => {
        const s = String(pt || "").toLowerCase();
        if (s.includes("part") || s.includes("جزئي")) return "Part-time";
        if (s.includes("contract") || s.includes("عقد")) return "Contract";
        return "Full-time";
      };

      const normalizeLocType = (lt: unknown): "On-site" | "Remote" | "Hybrid" => {
        const s = String(lt || "").toLowerCase();
        if (s.includes("remote") || s.includes("عن بعد")) return "Remote";
        if (s.includes("hybrid") || s.includes("هجين")) return "Hybrid";
        return "On-site";
      };

      let successCount = 0;
      let skippedCount = 0;

      for (const row of rows) {
        const rawPosId = String(
          row["Position ID"] ||
          row["position_id"] ||
          row["معرف الوظيفة"] ||
          ""
        ).trim();

        const titleEn = String(
          row["Position Name (EN)"] ||
          row["Position Title (EN)"] ||
          row["Position"] ||
          row["Job Title"] ||
          row["المسمى بالإنجليزية"] ||
          ""
        ).trim();

        const titleAr = String(
          row["Position Name (AR)"] ||
          row["Position Title (AR)"] ||
          row["المسمى بالعربية"] ||
          row["المسمى"] ||
          ""
        ).trim();

        let matchedPos = availablePositions.find((p) => p.id === rawPosId);
        if (!matchedPos && titleEn) {
          matchedPos = availablePositions.find(
            (p) => p.name_en?.toLowerCase().trim() === titleEn.toLowerCase()
          );
        }
        if (!matchedPos && titleAr) {
          matchedPos = availablePositions.find(
            (p) => p.name_ar?.trim() === titleAr
          );
        }

        if (!matchedPos) {
          skippedCount++;
          continue;
        }

        const jobCodeVal = String(
          row["Job Code"] || row["job_code"] || row["كود الوظيفة"] || row["Code"] || ""
        ).trim();

        const jobSummaryVal = String(
          row["Job Summary"] || row["job_summary"] || row["ملخص الوظيفة"] || row["Summary"] || ""
        ).trim();

        const responsibilitiesVal = splitList(
          row["Responsibilities"] || row["responsibilities"] || row["المسؤوليات"] || row["المهام والمسؤوليات"]
        );

        const qualificationsVal = String(
          row["Qualifications & Experience"] || row["qualifications"] || row["المؤهلات والخبرة"] || row["Qualifications"] || ""
        ).trim();

        const technicalCompsVal = splitList(
          row["Technical Competencies"] || row["technical_competencies"] || row["الكفاءات الفنية"]
        );

        const behavioralCompsVal = splitList(
          row["Behavioral Competencies"] || row["behavioral_competencies"] || row["الكفاءات السلوكية"]
        );

        const internalRelVal = String(
          row["Internal Relations"] || row["internal_relations"] || row["العلاقات الداخلية"] || ""
        ).trim();

        const externalRelVal = String(
          row["External Relations"] || row["external_relations"] || row["العلاقات الخارجية"] || ""
        ).trim();

        const authorityVal = splitList(
          row["Authority & Decision Making"] || row["authority"] || row["الصلاحيات"] || row["Authority"]
        );

        const careerPathVal = splitList(
          row["Career Path"] || row["career_path"] || row["المسار الوظيفي"]
        );

        const tagsVal = splitList(
          row["Tags"] || row["tags"] || row["الوسوم"]
        );

        const payload = {
          position_id: matchedPos.id,
          job_code: jobCodeVal || undefined,
          job_category: normalizeCategory(row["Category"] || row["job_category"] || row["الفئة"]),
          position_type: normalizePosType(row["Position Type"] || row["position_type"] || row["نوع التوظيف"]),
          location_type: normalizeLocType(row["Location Type"] || row["location_type"] || row["موقع العمل"]),
          job_grade: String(row["Grade"] || row["job_grade"] || row["الدرجة"] || "").trim() || undefined,
          job_summary: jobSummaryVal || `Official role description for ${matchedPos.name_en}`,
          responsibilities: responsibilitiesVal.length ? responsibilitiesVal : ["Core position responsibilities and duties."],
          qualifications: qualificationsVal || undefined,
          technical_competencies: technicalCompsVal,
          behavioral_competencies: behavioralCompsVal,
          internal_relations: internalRelVal || undefined,
          external_relations: externalRelVal || undefined,
          authority: authorityVal,
          career_path: careerPathVal,
          doc_version: String(row["Document Version"] || row["doc_version"] || row["إصدار الوثيقة"] || "v1.0").trim(),
          reviewed_by: String(row["Reviewed By"] || row["reviewed_by"] || row["مراجعة"] || "").trim() || undefined,
          approved_by: String(row["Approved By"] || row["approved_by"] || row["اعتماد"] || "").trim() || undefined,
          tags: tagsVal,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertErr } = await db
          .from("position_job_descriptions")
          .upsert(payload, { onConflict: "position_id" });

        if (upsertErr) {
          console.error("Upsert error for", matchedPos.name_en, upsertErr);
          skippedCount++;
        } else {
          successCount++;
        }
      }

      await qc.invalidateQueries({ queryKey: ["position-job-descriptions"] });
      if (successCount > 0) {
        toast.success(
          isAr
            ? `تم استيراد ${successCount} وصف وظيفي بنجاح${skippedCount ? ` (تم تخطي ${skippedCount})` : ""}`
            : `Successfully imported ${successCount} job description(s)${skippedCount ? ` (${skippedCount} skipped)` : ""}`
        );
      } else {
        toast.error(
          isAr
            ? `لم يتم استيراد أي وصف وظيفي. تأكد من تطابق المسميات أو معرف الوظيفة.`
            : `No job descriptions imported. Check position matching or file format.`
        );
      }
    } catch (err: unknown) {
      console.error("Import error:", err);
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportRowPdf = async (row: SavedJobDescription) => {
    try {
      const p = positions.data?.find((pos) => pos.id === row.position_id);
      const title = p?.name_en || row.job_code || "Job Role";
      await exportJobDescriptionPdf({
        jobTitle: title,
        jobCode: row.job_code,
        department: "Integrated Technics Operations",
        jobCategory: row.job_category || "Non-managerial",
        positionType: row.position_type || "Full-time",
        locationType: row.location_type || "On-site",
        jobGrade: row.job_grade,
        reportingTo: "Department Head",
        jobSummary: row.job_summary || "",
        responsibilities: row.responsibilities || [],
        qualifications: row.qualifications,
        technicalCompetencies: row.technical_competencies || [],
        behavioralCompetencies: row.behavioral_competencies || [],
        internalRelations: row.internal_relations,
        externalRelations: row.external_relations,
        authority: row.authority || [],
        careerPath: row.career_path || [],
        docVersion: row.doc_version || "v1.0",
        reviewedBy: row.reviewed_by,
        approvedBy: row.approved_by,
      });
      toast.success(isAr ? `تم تصدير PDF لـ ${title}` : `Exported PDF for ${title}`);
    } catch (err) {
      console.error(err);
      toast.error(isAr ? "تعذر إنشاء ملف PDF" : "Failed to generate PDF");
    }
  };

  const loadError = records.error || positions.error;
  const rows = (records.data ?? []).filter((row) =>
    `${posName(row.position_id)} ${row.job_summary} ${row.tags?.join(" ")}`.toLowerCase()
      .includes(search.toLowerCase().trim())
  );

  return (
    <section className="space-y-4" dir={dir}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <FileText className="size-5 text-brand" />
            {isAr ? "الوصف الوظيفي حسب المسمى" : "Job Descriptions by Position"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr ? "إدارة وتوثيق الأوصاف الوظيفية الرسمية لجميع الوظائف في المنظمة" : "Manage and maintain official role descriptions across all positions"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportExcel}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting || !records.data?.length}
            className="h-9 gap-1.5 rounded-xl border-border/70 text-xs font-semibold"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
            )}
            {isAr ? "تصدير إكسيل" : "Export Excel"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || positions.isPending}
            className="h-9 gap-1.5 rounded-xl border-border/70 text-xs font-semibold"
          >
            {isImporting ? (
              <Loader2 className="size-3.5 animate-spin text-brand" />
            ) : (
              <Upload className="size-3.5 text-brand" />
            )}
            {isAr ? "استيراد إكسيل" : "Import Excel"}
          </Button>

          <Button
            onClick={() => startEdit(null)}
            disabled={!!loadError || positions.isPending || records.isPending}
            className="h-9 gap-2 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            {isAr ? "إضافة وصف وظيفي" : "Add Job Description"}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="ps-9 rounded-xl"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isAr ? "بحث بالمسمى أو الوصف أو الكود…" : "Search position, summary, or code…"}
          aria-label="Search job descriptions"
        />
      </div>

      {/* Content Table / Error States */}
      {loadError ? (
        <div role="alert" className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">
            {isAr ? "تعذر تحميل الأوصاف الوظيفية. يرجى التحقق من إعداد الصلاحيات وتطبيق التحديث." : "Job descriptions could not be loaded. Storage setup and access permissions need to be checked."}
          </p>
          <p className="text-xs text-muted-foreground">{loadError.message}</p>
          <Button variant="outline" size="sm" onClick={() => { void records.refetch(); void positions.refetch(); }} className="rounded-xl">
            {isAr ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      ) : records.isPending || positions.isPending ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-brand" />
          {isAr ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-2xs">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-start w-1/4">{isAr ? "المسمى الوظيفي" : "Position"}</th>
                <th className="p-3 text-start">{isAr ? "ملخص الدور" : "Summary"}</th>
                <th className="p-3 text-start w-28">{isAr ? "النوع" : "Type"}</th>
                <th className="p-3 text-start w-24">{isAr ? "الدرجة" : "Grade"}</th>
                <th className="p-3 text-end"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="p-3 align-top font-semibold text-foreground min-w-40">
                    <div>{posName(row.position_id)}</div>
                    {row.job_code && (
                      <span className="font-mono text-[10px] text-muted-foreground">{row.job_code}</span>
                    )}
                  </td>
                  <td className="p-3 align-top text-muted-foreground min-w-64 max-w-xs truncate text-xs leading-relaxed">
                    {row.job_summary || <span className="italic text-muted-foreground/60">—</span>}
                  </td>
                  <td className="p-3 align-top">
                    <Badge variant="secondary" className="text-[11px] rounded-lg">
                      {row.position_type ?? "Full-time"}
                    </Badge>
                  </td>
                  <td className="p-3 align-top text-xs font-mono">{row.job_grade || "—"}</td>
                  <td className="p-3 align-top text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleExportRowPdf(row)}
                        title={isAr ? "تحميل PDF الرسمي" : "Download Official PDF"}
                        className="rounded-lg text-brand hover:text-brand"
                      >
                        <FileDown className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(row)}
                        title={isAr ? "تعديل" : "Edit"}
                        className="rounded-lg"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {search
                      ? (isAr ? "لا توجد نتائج مطابقة للبحث" : "No matching job descriptions found")
                      : (isAr ? "لا توجد أوصاف وظيفية مسجلة بعد. اضغط على 'إضافة وصف وظيفي' للبدء." : "No job descriptions registered yet. Click 'Add Job Description' to create one.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Dialog Form ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!save.isPending) setOpen(v); }}>
        <DialogContent
          className="max-h-[94dvh] overflow-y-auto w-full max-w-3xl rounded-3xl"
          onInteractOutside={(e) => e.preventDefault()}
          dir={dir}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/10 text-brand">
                <FileText className="h-4.5 w-4.5" />
              </span>
              <span>
                {editing
                  ? (isAr ? "تعديل بطاقة الوصف الوظيفي" : "Edit Job Description")
                  : (isAr ? "بطاقة وصف وظيفي جديدة" : "New Job Description")}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isAr
                ? "أدخل تفاصيل الوصف الوظيفي المعتمد وفقاً للهيكل النموذجي الموحد للشركة"
                : "Fill in the job description following the company's official organizational template"}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
            className="space-y-3 mt-1"
          >
            {/* 01  Role Identification */}
            <FormSection
              stepNumber="01"
              icon={Briefcase}
              title={isAr ? "بيانات وتصنيف الدور الوظيفي" : "Role Identification & Classification"}
              subtitle={isAr ? "المسمى الوظيفي، الكود، الدرجة، ونوع ومقر العمل" : "Position, code, grade, category, and work location"}
              defaultOpen
            >
              {/* Position select */}
              <div className="space-y-1">
                <Label htmlFor="jd-position" className="text-xs font-semibold">
                  {isAr ? "المسمى الوظيفي *" : "Position *"}
                </Label>
                <Select value={positionId} onValueChange={setPositionId} disabled={save.isPending}>
                  <SelectTrigger id="jd-position" aria-invalid={!!errors.position_id} className="text-xs h-9 rounded-xl">
                    <SelectValue placeholder={isAr ? "اختر المسمى الوظيفي…" : "Select position…"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(positions.data ?? [])
                      .filter((p) => p.id === editing?.position_id || !(records.data ?? []).some((r) => r.position_id === p.id))
                      .map((p) => (
                        <SelectItem value={p.id} key={p.id} className="text-xs">
                          {isAr ? p.name_ar || p.name_en : p.name_en}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.position_id && <p className="text-xs text-destructive">{errors.position_id}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? "كود الوظيفة" : "Job Code"}</Label>
                  <Input
                    value={jobCode}
                    onChange={(e) => setJobCode(e.target.value)}
                    placeholder="JD-TA-01"
                    disabled={save.isPending}
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? "الدرجة / النطاق" : "Grade / Range"}</Label>
                  <Input
                    value={jobGrade}
                    onChange={(e) => setJobGrade(e.target.value)}
                    placeholder={isAr ? "متوسط / أول / Jr / Sr" : "Jr / Mid / Sr"}
                    disabled={save.isPending}
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? "التصنيف" : "Category"}</Label>
                  <Select value={jobCategory} onValueChange={setJobCategory} disabled={save.isPending}>
                    <SelectTrigger className="h-8.5 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {JOB_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c === "Non-managerial" ? (isAr ? "غير إداري / تنفيذي" : "Non-managerial") : (isAr ? "إداري / إشرافي" : "Managerial")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <Clock className="inline h-3 w-3 me-1 text-brand" />
                    {isAr ? "نوع الدوام" : "Type"}
                  </Label>
                  <Select value={positionType} onValueChange={setPositionType} disabled={save.isPending}>
                    <SelectTrigger className="h-8.5 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {POSITION_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t === "Full-time" ? (isAr ? "دوام كامل" : "Full-time") : t === "Part-time" ? (isAr ? "دوام جزئي" : "Part-time") : (isAr ? "عقد مؤقت" : "Contract")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <MapPin className="inline h-3 w-3 me-1 text-brand" />
                    {isAr ? "مقر العمل" : "Location"}
                  </Label>
                  <Select value={locationType} onValueChange={setLocationType} disabled={save.isPending}>
                    <SelectTrigger className="h-8.5 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {LOCATION_TYPES.map((l) => (
                        <SelectItem key={l} value={l} className="text-xs">
                          {l === "On-site" ? (isAr ? "حضوري (مقر/موقع)" : "On-site") : l === "Remote" ? (isAr ? "عن بعد" : "Remote") : (isAr ? "هجين" : "Hybrid")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            {/* 02  Job Purpose & Summary */}
            <FormSection
              stepNumber="02"
              icon={FileText}
              title={isAr ? "الهدف العام ونطاق المسؤولية" : "Job Purpose & Scope"}
              subtitle={isAr ? "ملخص موجز لمهمة الدور ومسؤولياته الرئيسية" : "Concise overview of the role's mission and core scope"}
            >
              <div className="space-y-1">
                <Label htmlFor="jd-summary" className="text-xs font-semibold">
                  {isAr ? "ملخص الدور الوظيفي *" : "Job Summary *"}
                </Label>
                <Textarea
                  id="jd-summary"
                  rows={4}
                  value={jobSummary}
                  onChange={(e) => setJobSummary(e.target.value)}
                  disabled={save.isPending}
                  placeholder={isAr ? "المسؤولية التنفيذية والمهنية عن قيادة وإنجاز أعمال…" : "The specialist is responsible for driving end-to-end deliverables…"}
                  className="text-xs rounded-xl resize-none"
                  aria-invalid={!!errors.job_summary}
                />
                {errors.job_summary && <p className="text-xs text-destructive">{errors.job_summary}</p>}
              </div>
            </FormSection>

            {/* 03  Responsibilities */}
            <FormSection
              stepNumber="03"
              icon={FileCheck}
              title={isAr ? "المهام والمسؤوليات الرئيسية" : "Key Responsibilities & Deliverables"}
              subtitle={isAr ? "قائمة الواجبات والمخرجات التشغيلية المحددة للدور" : "Operational duties, day-to-day deliverables, and execution requirements"}
            >
              <BulletListField
                label={isAr ? "بنود المسؤوليات والمهام *" : "Responsibilities & Duties *"}
                items={responsibilities}
                onChange={setResponsibilities}
                placeholder={isAr ? "إدارة وتنفيذ عمليات الاستقطاب والتعيين الفني…" : "Manage end-to-end full-lifecycle deliverables…"}
                disabled={save.isPending}
                addLabel={isAr ? "إضافة مهمة جديدة" : "Add responsibility"}
                emptyLabel={isAr ? "لم تتم إضافة أي مهام بعد. اضغط على 'إضافة مهمة جديدة'." : "No responsibilities added yet."}
              />
              {errors.responsibilities && <p className="text-xs text-destructive">{errors.responsibilities}</p>}
            </FormSection>

            {/* 04  Qualifications & Competencies */}
            <FormSection
              stepNumber="04"
              icon={GraduationCap}
              title={isAr ? "المؤهلات والجدارات المطلوبة" : "Qualifications & Competencies"}
              subtitle={isAr ? "المؤهل الدراسي، سنوات الخبرة، والجدارات الفنية والسلوكية" : "Education, experience, technical skills, and behavioral competencies"}
              defaultOpen={false}
            >
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  {isAr ? "المؤهل العلمي وسنوات الخبرة" : "Education & Experience"}
                </Label>
                <Textarea
                  rows={3}
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  disabled={save.isPending}
                  placeholder={isAr ? "بكالوريوس في التخصص، خبرة من 1 إلى 3 سنوات في مجال المقاولات والأنظمة…" : "Bachelor's degree in relevant discipline, 1-3 years progressive experience…"}
                  className="text-xs rounded-xl resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {isAr ? "الجدارات والمهارات الفنية" : "Technical Competencies"}
                  </Label>
                  <Textarea
                    rows={3}
                    value={technicalComps}
                    onChange={(e) => setTechnicalComps(e.target.value)}
                    disabled={save.isPending}
                    placeholder={isAr ? "أدوات التوظيف، أنظمة ATS، برامج HRIS، شبكات التعاقد" : "HRIS tools, ATS platforms, LinkedIn Recruiter"}
                    className="text-xs rounded-xl resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">{isAr ? "افصل بين كل مهارة بفاصلة" : "Comma-separated items"}</p>
                  <div className="flex flex-wrap gap-1">
                    {parseJobTags(technicalComps).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] rounded-md">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {isAr ? "الجدارات السلوكية والقيادية" : "Behavioral Competencies"}
                  </Label>
                  <Textarea
                    rows={3}
                    value={behavioralComps}
                    onChange={(e) => setBehavioralComps(e.target.value)}
                    disabled={save.isPending}
                    placeholder={isAr ? "مهارات التواصل، إدارة الأطراف المعنية، حل المشكلات، السرية والانضباط" : "Communication, Stakeholder management, Agility, Confidentiality"}
                    className="text-xs rounded-xl resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">{isAr ? "افصل بين كل مهارة بفاصلة" : "Comma-separated items"}</p>
                  <div className="flex flex-wrap gap-1">
                    {parseJobTags(behavioralComps).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] rounded-md">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* 05  Reporting & Relationships */}
            <FormSection
              stepNumber="05"
              icon={Users}
              title={isAr ? "العلاقات وقنوات التواصل" : "Reporting & Communications"}
              subtitle={isAr ? "أطراف التواصل والتعامل الداخلي والخارجي" : "Internal cross-functional partners and external stakeholders"}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isAr ? "التواصل الداخلي" : "Internal Communications"}</Label>
                  <Textarea
                    rows={2}
                    value={internalRelations}
                    onChange={(e) => setInternalRelations(e.target.value)}
                    disabled={save.isPending}
                    placeholder={isAr ? "جميع الإدارات التشغيلية، فريق الموارد البشرية، مهندسو المشاريع…" : "All operational departments, HR leadership, Project leads…"}
                    className="text-xs rounded-xl resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isAr ? "التواصل الخارجي" : "External Communications"}</Label>
                  <Textarea
                    rows={2}
                    value={externalRelations}
                    onChange={(e) => setExternalRelations(e.target.value)}
                    disabled={save.isPending}
                    placeholder={isAr ? "وكالات التوظيف، الجامعات، مراكز التدريب، منصات التوظيف المهنية…" : "Recruitment agencies, Universities, Training providers…"}
                    className="text-xs rounded-xl resize-none"
                  />
                </div>
              </div>
            </FormSection>

            {/* 06  Authority */}
            <FormSection
              stepNumber="06"
              icon={Shield}
              title={isAr ? "الصلاحيات وحدود التفويض" : "Authority & Decision Mandates"}
              subtitle={isAr ? "الصلاحيات التنفيذية والقرارات المصرح بها لشاغل الوظيفة" : "Authorized operational decision-making mandates"}
              defaultOpen={false}
            >
              <BulletListField
                label={isAr ? "الصلاحيات المعتمدة" : "Authorized Mandates"}
                items={authority}
                onChange={setAuthority}
                placeholder={isAr ? "صلاحية فحص وتصفية المرشحين وتقديم العروض المبدئية…" : "Authority to screen, shortlist, and recommend offers…"}
                disabled={save.isPending}
                addLabel={isAr ? "إضافة صلاحية جديدة" : "Add mandate"}
                emptyLabel={isAr ? "لم تحدد صلاحيات خاصة بعد." : "No specific mandates listed."}
              />
            </FormSection>

            {/* 07  Career Path */}
            <FormSection
              stepNumber="07"
              icon={TrendingUp}
              title={isAr ? "المسار الوظيفي والترقي" : "Career Progression Path"}
              subtitle={isAr ? "خطوات التطور المهني والترقي المتوقعة للدور داخل الشركة" : "Sequential career progression milestones for this role"}
              defaultOpen={false}
            >
              <BulletListField
                label={isAr ? "مراحل المسار المهني (بالترتيب)" : "Career Progression Steps (in order)"}
                items={careerPath}
                onChange={setCareerPath}
                placeholder={isAr ? "منسق >> أخصائي >> أخصائي أول >> مدير قسم >> رئيس قطاع" : "Coordinator >> Specialist >> Lead >> Manager"}
                disabled={save.isPending}
                addLabel={isAr ? "إضافة مستوى ترقي" : "Add level"}
                emptyLabel={isAr ? "لم تحدد خطوات مسار مهني بعد." : "No progression steps added."}
              />
              {careerPath.filter(Boolean).length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {careerPath.filter(Boolean).map((step, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs">
                      <Badge variant="outline" className="text-[11px] rounded-lg font-medium bg-muted/20">
                        {step}
                      </Badge>
                      {i < careerPath.filter(Boolean).length - 1 && (
                        <span className="text-muted-foreground font-bold">→</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </FormSection>

            {/* 08  Document Control */}
            <FormSection
              stepNumber="08"
              icon={FileCheck}
              title={isAr ? "بيانات الاعتماد وضبط الوثيقة" : "Document Control & Approval"}
              subtitle={isAr ? "رقم الإصدار، المسؤول عن المراجعة، والاعتماد الرسمي" : "Document version, reviewer, and approving authority"}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? "رقم الإصدار" : "Version"}</Label>
                  <Input
                    value={docVersion}
                    onChange={(e) => setDocVersion(e.target.value)}
                    placeholder="v1.0"
                    disabled={save.isPending}
                    className="h-8.5 text-xs rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? "تمت المراجعة بواسطة" : "Reviewed By"}</Label>
                  <Input
                    value={reviewedBy}
                    onChange={(e) => setReviewedBy(e.target.value)}
                    placeholder={isAr ? "اسم المراجع / المسمى" : "Reviewer Name / Title"}
                    disabled={save.isPending}
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? "تم الاعتماد بواسطة" : "Approved By"}</Label>
                  <Input
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder={isAr ? "اسم المعتمد / مدير الموارد البشرية" : "Approver Name / HR Director"}
                    disabled={save.isPending}
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <Label className="text-xs">{isAr ? "الوسوم والكلمات الدلالية" : "Search Tags"}</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={isAr ? "توظيف، هندسة، تقييم، موارد بشرية" : "Engineering, Recruitment, HR, OD"}
                  disabled={save.isPending}
                  className="h-8.5 text-xs rounded-xl"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {parseJobTags(tags).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] rounded-md">{t}</Badge>
                  ))}
                </div>
              </div>
            </FormSection>

            {/* Footer Buttons */}
            <DialogFooter className="pt-3 gap-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => setOpen(false)}
                className="rounded-xl"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={save.isPending}
                className="gap-2 rounded-xl"
              >
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isAr ? "حفظ الوصف الوظيفي" : "Save Job Description"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
