import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FileText, Loader2, Pencil, Plus, Search, Save, Trash2,
  ChevronDown, ChevronUp, GraduationCap, Users, Shield,
  TrendingUp, FileCheck, MapPin, Briefcase, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  jobDescriptionSchema,
  parseJobTags,
  parseBulletList,
  joinBulletList,
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

// ── Collapsible section wrapper ──────────────────────────────────────────────
function FormSection({
  icon: Icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-3.5 text-start hover:bg-muted/20 transition-colors rounded-2xl focus:outline-none"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3.5 pb-4 space-y-3 border-t border-border/40 pt-3">{children}</div>}
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
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const add = () => onChange([...items, ""]);
  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button type="button" size="sm" variant="ghost" onClick={add} disabled={disabled} className="h-6 text-[11px] gap-1 px-2">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs shrink-0 w-5 text-end">{i + 1}.</span>
            <Input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="h-8 text-xs flex-1"
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} disabled={disabled} className="h-7 w-7 shrink-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic px-1">None added yet — click Add.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function JobDescriptionsTab() {
  const { lang } = useI18n();
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
        throw new Error("Validation failed");
      }
      setErrors({});

      const req = editing
        ? db.from("position_job_descriptions").update(result.data).eq("id", editing.id)
        : db.from("position_job_descriptions").insert(result.data);
      const { error } = await req;
      if (error) {
        throw new Error(
          error.code === "23505"
            ? "This position already has a job description. Edit its existing entry."
            : error.message
        );
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["position-job-descriptions"] });
      setOpen(false);
      toast.success(isAr ? "تم حفظ الوصف الوظيفي" : "Job description saved");
    },
    onError: (error: Error) => {
      if (error.message !== "Validation failed") toast.error(error.message);
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

  const loadError = records.error || positions.error;
  const rows = (records.data ?? []).filter((row) =>
    `${posName(row.position_id)} ${row.job_summary} ${row.tags?.join(" ")}`.toLowerCase()
      .includes(search.toLowerCase().trim())
  );

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="size-5 text-brand" />
          {isAr ? "الوصف الوظيفي حسب المسمى" : "Job Descriptions by Position"}
        </h2>
        <Button
          onClick={() => startEdit(null)}
          disabled={!!loadError || positions.isPending || records.isPending}
          className="gap-2"
        >
          <Plus className="size-4" />
          {isAr ? "إضافة وصف وظيفي" : "Add Job Description"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="ps-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isAr ? "بحث بالمسمى أو الوصف" : "Search position or summary…"}
          aria-label="Search job descriptions"
        />
      </div>

      {/* Content */}
      {loadError ? (
        <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p>{isAr ? "تعذر تحميل الأوصاف الوظيفية. يرجى التحقق من إعداد الصلاحيات." : "Job descriptions could not be loaded. Storage setup and access permissions need to be checked."}</p>
          <p className="text-muted-foreground">{loadError.message}</p>
          <Button variant="outline" size="sm" onClick={() => { void records.refetch(); void positions.refetch(); }}>
            {isAr ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      ) : records.isPending || positions.isPending ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {isAr ? "جار التحميل…" : "Loading…"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-start w-1/4">{isAr ? "المسمى الوظيفي" : "Position"}</th>
                <th className="p-3 text-start">{isAr ? "الملخص" : "Summary"}</th>
                <th className="p-3 text-start w-28">{isAr ? "النوع" : "Type"}</th>
                <th className="p-3 text-start w-24">{isAr ? "الدرجة" : "Grade"}</th>
                <th className="p-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="p-3 align-top font-medium min-w-40">{posName(row.position_id)}</td>
                  <td className="p-3 align-top text-muted-foreground min-w-64 max-w-xs truncate">
                    {row.job_summary || <span className="italic text-muted-foreground/60">—</span>}
                  </td>
                  <td className="p-3 align-top">
                    <Badge variant="secondary" className="text-[11px]">{row.position_type ?? "Full-time"}</Badge>
                  </td>
                  <td className="p-3 align-top text-xs font-mono">{row.job_grade || "—"}</td>
                  <td className="p-3 align-top">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(row)} title="Edit" aria-label={`Edit ${posName(row.position_id)}`}>
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {search ? (isAr ? "لا توجد نتائج" : "No matching job descriptions") : (isAr ? "لا توجد أوصاف وظيفية بعد" : "No job descriptions yet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Full-screen Dialog Form ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!save.isPending) setOpen(v); }}>
        <DialogContent
          className="max-h-[95dvh] overflow-y-auto w-full max-w-3xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand" />
              {editing
                ? (isAr ? "تعديل الوصف الوظيفي" : "Edit Job Description")
                : (isAr ? "إضافة وصف وظيفي" : "New Job Description")}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "أدخل تفاصيل الوصف الوظيفي وفقاً للنموذج الرسمي للشركة"
                : "Fill in the job description following the company's official JD template"}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
            className="space-y-3 mt-2"
          >
            {/* § 1  Job Identification */}
            <FormSection icon={Briefcase} title="§1 — Job Identification" defaultOpen>
              {/* Position select */}
              <div className="space-y-1">
                <Label htmlFor="jd-position" className="text-xs">Position *</Label>
                <Select value={positionId} onValueChange={setPositionId} disabled={save.isPending}>
                  <SelectTrigger id="jd-position" aria-invalid={!!errors.position_id} className="text-xs h-8">
                    <SelectValue placeholder="Select position…" />
                  </SelectTrigger>
                  <SelectContent>
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Job Code</Label>
                  <Input value={jobCode} onChange={(e) => setJobCode(e.target.value)} placeholder="JD-001" disabled={save.isPending} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grade / Salary Range</Label>
                  <Input value={jobGrade} onChange={(e) => setJobGrade(e.target.value)} placeholder="Jr / Mid / Sr" disabled={save.isPending} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={jobCategory} onValueChange={setJobCategory} disabled={save.isPending}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{JOB_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><Clock className="inline h-3 w-3 me-1" />Type</Label>
                  <Select value={positionType} onValueChange={setPositionType} disabled={save.isPending}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{POSITION_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs"><MapPin className="inline h-3 w-3 me-1" />Location</Label>
                  <Select value={locationType} onValueChange={setLocationType} disabled={save.isPending}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCATION_TYPES.map((l) => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            {/* § 2  Job Summary */}
            <FormSection icon={FileText} title="§2 — Job Summary" subtitle="Short paragraph describing the role's mission">
              <div className="space-y-1">
                <Label htmlFor="jd-summary" className="text-xs">Summary *</Label>
                <Textarea
                  id="jd-summary"
                  rows={4}
                  value={jobSummary}
                  onChange={(e) => setJobSummary(e.target.value)}
                  disabled={save.isPending}
                  placeholder="The [Role] is responsible for…"
                  className="text-xs resize-none"
                  aria-invalid={!!errors.job_summary}
                />
                {errors.job_summary && <p className="text-xs text-destructive">{errors.job_summary}</p>}
              </div>
            </FormSection>

            {/* § 3  Responsibilities */}
            <FormSection icon={FileCheck} title="§3 — Responsibilities & Duties" subtitle="Key duties and deliverables">
              <BulletListField
                label="Responsibilities *"
                items={responsibilities}
                onChange={setResponsibilities}
                placeholder="Manage end-to-end recruitment…"
                disabled={save.isPending}
              />
              {errors.responsibilities && <p className="text-xs text-destructive">{errors.responsibilities}</p>}
            </FormSection>

            {/* § 4  Qualifications & Competencies */}
            <FormSection icon={GraduationCap} title="§4 — Qualifications & Competencies" defaultOpen={false}>
              <div className="space-y-1">
                <Label className="text-xs">Education & Experience</Label>
                <Textarea
                  rows={3}
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  disabled={save.isPending}
                  placeholder="Bachelor's degree in…, 3+ years experience in…"
                  className="text-xs resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Technical Competencies</Label>
                  <Textarea
                    rows={3}
                    value={technicalComps}
                    onChange={(e) => setTechnicalComps(e.target.value)}
                    disabled={save.isPending}
                    placeholder="HRIS tools, ATS, LinkedIn Recruiter"
                    className="text-xs resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">Comma-separated</p>
                  <div className="flex flex-wrap gap-1">
                    {parseJobTags(technicalComps).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Behavioral Competencies</Label>
                  <Textarea
                    rows={3}
                    value={behavioralComps}
                    onChange={(e) => setBehavioralComps(e.target.value)}
                    disabled={save.isPending}
                    placeholder="Communication, Confidentiality, Agility"
                    className="text-xs resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">Comma-separated</p>
                  <div className="flex flex-wrap gap-1">
                    {parseJobTags(behavioralComps).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* § 6  Relationships */}
            <FormSection icon={Users} title="§6 — Relationships" defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Internal Communications</Label>
                  <Textarea rows={2} value={internalRelations} onChange={(e) => setInternalRelations(e.target.value)} disabled={save.isPending} placeholder="All departments, HR team…" className="text-xs resize-none" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">External Communications</Label>
                  <Textarea rows={2} value={externalRelations} onChange={(e) => setExternalRelations(e.target.value)} disabled={save.isPending} placeholder="Recruitment agencies, universities…" className="text-xs resize-none" />
                </div>
              </div>
            </FormSection>

            {/* § 7  Authority */}
            <FormSection icon={Shield} title="§7 — Authority" defaultOpen={false}>
              <BulletListField
                label="Authorities"
                items={authority}
                onChange={setAuthority}
                placeholder="Empowered to source and shortlist candidates…"
                disabled={save.isPending}
              />
            </FormSection>

            {/* § 8  Career Path */}
            <FormSection icon={TrendingUp} title="§8 — Career Path" defaultOpen={false}>
              <BulletListField
                label="Career Steps (in order)"
                items={careerPath}
                onChange={setCareerPath}
                placeholder="Junior Specialist"
                disabled={save.isPending}
              />
              {careerPath.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {careerPath.filter(Boolean).map((step, i) => (
                    <span key={i} className="flex items-center gap-1 text-[11px]">
                      <Badge variant="outline" className="text-[10px]">{step}</Badge>
                      {i < careerPath.filter(Boolean).length - 1 && <span className="text-muted-foreground">→</span>}
                    </span>
                  ))}
                </div>
              )}
            </FormSection>

            {/* § 9  Document Control */}
            <FormSection icon={FileCheck} title="§9 — Document Control" defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Version</Label>
                  <Input value={docVersion} onChange={(e) => setDocVersion(e.target.value)} placeholder="v1.0" disabled={save.isPending} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reviewed By</Label>
                  <Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder="Name / Title" disabled={save.isPending} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Approved By</Label>
                  <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Name / Title" disabled={save.isPending} className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Search Tags</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Engineering, Recruitment, HR" disabled={save.isPending} className="h-8 text-xs" />
                <div className="flex flex-wrap gap-1">
                  {parseJobTags(tags).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              </div>
            </FormSection>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={save.isPending} className="gap-2">
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isAr ? "حفظ" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
