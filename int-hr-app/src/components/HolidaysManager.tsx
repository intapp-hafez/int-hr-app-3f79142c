import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Plus, Loader2, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  listHolidays,
  upsertHoliday,
  deleteHoliday,
  checkHolidayConflicts,
  HolidayInputSchema,
  type HolidayRow,
  type HolidayConflict,
} from "@/backend/functions/holidays.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type FormState = {
  id?: string;
  name: string;
  date: string;
  type: "public" | "company" | "weekend";
  country: string;
  recurring: boolean;
  notes: string;
};

const blankForm: FormState = {
  name: "",
  date: "",
  type: "public",
  country: "",
  recurring: false,
  notes: "",
};

export function HolidaysManager() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listHolidays);
  const upsertFn = useServerFn(upsertHoliday);
  const deleteFn = useServerFn(deleteHoliday);
  const checkFn = useServerFn(checkHolidayConflicts);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<HolidayConflict[] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const weekdays = lang === "ar"
    ? ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayKeys = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const { data: liveCheck } = useQuery({
    queryKey: ["holiday-conflicts", form.date, form.id ?? null],
    queryFn: () => checkFn({ data: { date: form.date, excludeId: form.id ?? null } }),
    enabled: open && /^\d{4}-\d{2}-\d{2}$/.test(form.date),
    staleTime: 10_000,
  });
  const liveConflicts = conflicts ?? liveCheck?.conflicts ?? [];
  const duplicate = liveCheck?.duplicate ?? null;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "holidays"],
    queryFn: () => listFn(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => rows.filter((r) => r.date >= today), [rows, today]);
  const past = useMemo(() => rows.filter((r) => r.date < today), [rows, today]);
  const PAGE_SIZE = 8;
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const upcomingPageCount = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
  const pastPageCount = Math.max(1, Math.ceil(past.length / PAGE_SIZE));
  const upcomingSlice = upcoming.slice((Math.min(upcomingPage, upcomingPageCount) - 1) * PAGE_SIZE, Math.min(upcomingPage, upcomingPageCount) * PAGE_SIZE);
  const pastSlice = past.slice((Math.min(pastPage, pastPageCount) - 1) * PAGE_SIZE, Math.min(pastPage, pastPageCount) * PAGE_SIZE);

  const upsertMut = useMutation({
    mutationFn: (data: FormState) =>
      upsertFn({
        data: {
          id: data.id,
          name: data.name,
          date: data.date,
          type: data.type,
          country: data.country || null,
          recurring: data.recurring,
          notes: data.notes || null,
        },
      }),
    onSuccess: (res) => {
      toast.success(form.id ? "Holiday updated" : "Holiday added");
      qc.invalidateQueries({ queryKey: ["admin", "holidays"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setOpen(false);
      setConflicts(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Holiday deleted");
      qc.invalidateQueries({ queryKey: ["admin", "holidays"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function openCreate() {
    setForm(blankForm);
    setErrors({});
    setConflicts(null);
    setOpen(true);
  }

  function openEdit(h: HolidayRow) {
    setForm({
      id: h.id,
      name: h.name,
      date: h.date,
      type: (h.type as FormState["type"]) ?? "public",
      country: h.country ?? "",
      recurring: h.recurring,
      notes: h.notes ?? "",
    });
    setErrors({});
    setConflicts(null);
    setOpen(true);
  }

  function submit() {
    const parsed = HolidayInputSchema.safeParse({
      id: form.id,
      name: form.name,
      date: form.date,
      type: form.type,
      country: form.country || null,
      recurring: form.recurring,
      notes: form.notes || null,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    upsertMut.mutate(form);
  }

  const typeStyle: Record<string, string> = {
    public: "bg-brand/10 text-brand",
    company: "bg-accent text-accent-foreground",
    weekend: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t("holidays")}</h1>
          <p className="text-sm text-muted-foreground">{t("holidaysSubtitle")}</p>
        </div>
        <Button onClick={openCreate} className="rounded-full bg-gradient-brand text-brand-foreground shadow-brand hover:opacity-90">
          <Plus className="h-4 w-4" /> {t("addHoliday")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-3xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No holidays yet. Click "{t("addHoliday")}" to create one.
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {upcomingSlice.map((h) => (
                  <HolidayCard key={h.id} h={h} onEdit={() => openEdit(h)} onDelete={() => setDeleteId(h.id)} typeStyle={typeStyle} />
                ))}
              </div>
              <HolidayPagination page={Math.min(upcomingPage, upcomingPageCount)} pageCount={upcomingPageCount} onChange={setUpcomingPage} />
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {pastSlice.map((h) => (
                  <HolidayCard key={h.id} h={h} onEdit={() => openEdit(h)} onDelete={() => setDeleteId(h.id)} typeStyle={typeStyle} />
                ))}
              </div>
              <HolidayPagination page={Math.min(pastPage, pastPageCount)} pageCount={pastPageCount} onChange={setPastPage} />
            </section>
          )}
        </>
      )}

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-base font-semibold">{t("weekendConfig")}</h2>
        <p className="text-sm text-muted-foreground">{t("weekendHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {weekdayKeys.map((d, i) => {
            const off = d === "Fri" || d === "Sat";
            return (
              <button
                key={d}
                type="button"
                className={`rounded-full px-4 py-1.5 text-xs font-semibold ${off ? "bg-gradient-brand text-brand-foreground shadow-brand" : "bg-muted text-muted-foreground"}`}
              >
                {weekdays[i]}
              </button>
            );
          })}
        </div>
      </section>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConflicts(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit holiday" : "Add holiday"}</DialogTitle>
            <DialogDescription>Fill in holiday details. Conflicts with existing leaves are shown after saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="h-name">Name</Label>
              <Input id="h-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={255} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="h-date">Date</Label>
                <Input id="h-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-type">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as FormState["type"] })}>
                  <SelectTrigger id="h-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="weekend">Weekend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-country">Country (optional)</Label>
              <Input id="h-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength={80} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="h-recurring" className="text-sm">Recurring yearly</Label>
                <p className="text-xs text-muted-foreground">Repeats on the same date every year.</p>
              </div>
              <Switch id="h-recurring" checked={form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: v })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-notes">Notes (optional)</Label>
              <Textarea id="h-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} rows={2} />
            </div>

            {duplicate && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                A holiday already exists on this date: <span className="font-semibold">{duplicate.name}</span>
              </div>
            )}
            {liveConflicts.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-warning-foreground">
                  <AlertTriangle className="h-4 w-4" /> {liveConflicts.length} conflicting leave{liveConflicts.length === 1 ? "" : "s"} on this date
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {liveConflicts.map((c) => (
                    <li key={c.leave_id}>
                      <span className="font-medium text-foreground">{c.employee_name}</span> — {c.leave_type ?? "Leave"} ({c.start_date} → {c.end_date}, {c.status})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={submit} disabled={upsertMut.isPending}>
              {upsertMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? "Save changes" : "Add holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete holiday?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the holiday from the calendar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteId) deleteMut.mutate(deleteId); }}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HolidayPagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-2 text-sm">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-muted-foreground">Page {page} of {pageCount}</span>
      <button
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function HolidayCard({
  h,
  onEdit,
  onDelete,
  typeStyle,
}: {
  h: HolidayRow;
  onEdit: () => void;
  onDelete: () => void;
  typeStyle: Record<string, string>;
}) {
  return (
    <div className="group relative rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground" aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-4 font-display text-lg font-semibold">{h.name}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeStyle[h.type] ?? "bg-muted text-muted-foreground"}`}>
          {h.type}
        </span>
        {h.recurring && <span className="text-[10px] text-muted-foreground">Recurring</span>}
      </div>
      <p className="mt-3 font-mono text-sm font-semibold tabular-nums text-brand">{h.date}</p>
      {h.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{h.notes}</p>}
    </div>
  );
}
