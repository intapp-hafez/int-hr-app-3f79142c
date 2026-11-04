import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FileText, Loader2, Pencil, Plus, Search, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { jobDescriptionSchema, parseJobTags } from "@/lib/job-descriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Position = { id: string; name_en: string; name_ar: string | null };
type Description = { id: string; position_id: string; job_description: string; tags: string[] };
// This SPA uses the authenticated browser client; database policies authorize every request.
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

export function JobDescriptionsTab() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Description | null>(null);
  const [positionId, setPositionId] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const positions = useQuery({ queryKey: ["job-description-positions"], queryFn: () => readAll<Position>("positions", "id,name_en,name_ar", "name_en") });
  const records = useQuery({ queryKey: ["position-job-descriptions"], queryFn: () => readAll<Description>("position_job_descriptions", "id,position_id,job_description,tags", "id"), retry: false });
  const name = (id: string) => {
    const position = positions.data?.find(p => p.id === id);
    return (isAr ? position?.name_ar || position?.name_en : position?.name_en) || (isAr ? "مسمى وظيفي غير متاح" : "Unavailable position");
  };
  const save = useMutation({
    mutationFn: async (payload: { position_id: string; job_description: string; tags: string[] }) => {
      const validated = jobDescriptionSchema.parse(payload);
      const request = editing
        ? db.from("position_job_descriptions").update(validated).eq("id", editing.id)
        : db.from("position_job_descriptions").insert(validated);
      const { data, error } = await request.select("id").single();
      if (error) throw new Error(error.code === "23505" ? "This position already has a job description. Edit its existing entry." : error.message);
      if (!data) throw new Error("Job description was not saved.");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["position-job-descriptions"] });
      setOpen(false);
      toast.success(isAr ? "تم حفظ الوصف الوظيفي" : "Job description saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const start = (record: Description | null) => {
    setEditing(record);
    setPositionId(record?.position_id ?? "");
    setDescription(record?.job_description ?? "");
    setTags(record?.tags.join(", ") ?? "");
    setErrors({});
    setOpen(true);
  };
  const rows = (records.data ?? []).filter(row => `${name(row.position_id)} ${row.job_description} ${row.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase().trim()));
  const loadError = records.error || positions.error;

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="size-5 text-brand" />{isAr ? "الوصف الوظيفي حسب المسمى" : "Job descriptions by position"}</h2>
      <Button onClick={() => start(null)} disabled={!!loadError || positions.isPending || records.isPending} className="gap-2"><Plus className="size-4" />{isAr ? "إضافة وصف وظيفي" : "Add job description"}</Button>
    </div>
    <div className="relative max-w-md"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="ps-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={isAr ? "بحث بالمسمى أو الوصف أو الوسوم" : "Search position, description or tags"} aria-label="Search job descriptions" /></div>
    {loadError ? <div role="alert" className="space-y-2 border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{isAr ? "تعذر تحميل الأوصاف الوظيفية. يرجى التحقق من إعداد التخزين والصلاحيات." : "Job descriptions could not be loaded. Storage setup and access permissions need to be checked."}</p><p className="text-muted-foreground">{loadError.message}</p><Button variant="outline" size="sm" onClick={() => { void records.refetch(); void positions.refetch(); }}> {isAr ? "إعادة المحاولة" : "Retry"}</Button></div>
      : records.isPending || positions.isPending ? <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" />{isAr ? "جار التحميل…" : "Loading…"}</div>
      : <div className="overflow-x-auto border border-border rounded-lg"><table className="w-full text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-3 text-start w-1/4">{isAr ? "المسمى الوظيفي" : "Position"}</th><th className="p-3 text-start">{isAr ? "الوصف الوظيفي" : "Job description"}</th><th className="p-3 text-start w-1/5">{isAr ? "الوسوم" : "Tags"}</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-border"><td className="p-3 align-top font-medium min-w-40">{name(row.position_id)}</td><td className="p-3 align-top min-w-64 whitespace-pre-wrap break-words">{row.job_description}</td><td className="p-3 align-top"><div className="flex flex-wrap gap-1">{row.tags.map(tag => <Badge key={tag} variant="secondary" className="break-all">{tag}</Badge>)}</div></td><td className="p-3 align-top"><Button size="icon" variant="ghost" onClick={() => start(row)} title={isAr ? "تعديل" : "Edit job description"} aria-label={`Edit ${name(row.position_id)}`}><Pencil className="size-4" /></Button></td></tr>)}{!rows.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{search ? (isAr ? "لا توجد نتائج" : "No matching job descriptions") : (isAr ? "لا توجد أوصاف وظيفية بعد" : "No job descriptions yet")}</td></tr>}</tbody></table></div>}
    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto max-w-2xl" onInteractOutside={e => e.preventDefault()}><DialogHeader><DialogTitle>{editing ? (isAr ? "تعديل الوصف الوظيفي" : "Edit job description") : (isAr ? "إضافة وصف وظيفي" : "Add job description")}</DialogTitle><DialogDescription>{isAr ? "المسمى الوظيفي والوصف والوسوم" : "Position, job description and tags"}</DialogDescription></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); const result = jobDescriptionSchema.safeParse({ position_id: positionId, job_description: description, tags: parseJobTags(tags) }); if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; } setErrors({}); save.mutate(result.data); }} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="jd-position">{isAr ? "المسمى الوظيفي" : "Position"} *</Label><Select value={positionId} onValueChange={setPositionId} disabled={save.isPending}><SelectTrigger id="jd-position" aria-invalid={!!errors.position_id}><SelectValue placeholder={isAr ? "اختر المسمى" : "Select position"} /></SelectTrigger><SelectContent>{(positions.data ?? []).filter(p => p.id === editing?.position_id || !(records.data ?? []).some(row => row.position_id === p.id)).map(p => <SelectItem value={p.id} key={p.id}>{name(p.id)}</SelectItem>)}</SelectContent></Select>{errors.position_id && <p className="text-sm text-destructive">{errors.position_id}</p>}</div>
        <div className="space-y-2"><Label htmlFor="jd-description">{isAr ? "الوصف الوظيفي" : "Job description"} *</Label><Textarea id="jd-description" rows={8} value={description} disabled={save.isPending} onChange={e => setDescription(e.target.value)} aria-invalid={!!errors.job_description} />{errors.job_description && <p className="text-sm text-destructive">{errors.job_description}</p>}</div>
        <div className="space-y-2"><Label htmlFor="jd-tags">{isAr ? "الوسوم" : "Tags"}</Label><Input id="jd-tags" value={tags} disabled={save.isPending} onChange={e => setTags(e.target.value)} placeholder={isAr ? "هندسة، صيانة، قيادة" : "Engineering, Maintenance, Leadership"} /><div className="flex flex-wrap gap-1">{parseJobTags(tags).map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></div>
        <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>{isAr ? "إلغاء" : "Cancel"}</Button><Button type="submit" disabled={save.isPending} className="gap-2">{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{isAr ? "حفظ" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </section>;
}