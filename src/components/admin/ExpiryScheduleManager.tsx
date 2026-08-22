import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, GripVertical, Mail, Plus, Send, Trash2, X } from "lucide-react";
import {
  listSchedules,
  upsertSchedule,
  deleteSchedule,
  sendScheduleTestEmail,
} from "@/backend/functions/schedules.functions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = {
  name: string;
  report_kind: "id_expiry" | "contract_expiry";
  frequency: "daily" | "weekly";
  weekday: number;
  expiry_days: number;
  send_time: string;
  recipients: string[];
  format: "csv" | "xlsx";
  enabled: boolean;
};

const emptyDraft: Draft = {
  name: "National ID expiry — HR",
  report_kind: "id_expiry",
  frequency: "daily",
  weekday: 0,
  expiry_days: 30,
  send_time: "08:00",
  recipients: [],
  format: "xlsx",
  enabled: true,
};

export function ExpiryScheduleManager() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listSchedules);
  const save = useServerFn(upsertSchedule);
  const remove = useServerFn(deleteSchedule);
  const sendTest = useServerFn(sendScheduleTestEmail);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const nameRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLSelectElement>(null);
  const recipientsRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(() => {
    const nameError = !draft.name.trim() ? "Name is required" : undefined;
    let recipientsError: string | undefined;
    if (draft.recipients.length === 0) {
      recipientsError = "At least one recipient is required";
    } else {
      const bad = draft.recipients.filter((r) => !EMAIL_RE.test(r));
      const seen = new Set<string>();
      const dupes = new Set<string>();
      for (const r of draft.recipients) {
        const k = r.toLowerCase();
        if (seen.has(k)) dupes.add(k);
        seen.add(k);
      }
      if (bad.length) recipientsError = `Invalid email${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}`;
      else if (dupes.size) recipientsError = `Duplicate email${dupes.size > 1 ? "s" : ""}: ${[...dupes].join(", ")}`;
    }
    const expiryDaysError =
      !Number.isFinite(draft.expiry_days) || draft.expiry_days < 1 || draft.expiry_days > 365
        ? "Expiry window must be between 1 and 365 days"
        : undefined;
    return {
      ok: !nameError && !recipientsError && !expiryDaysError,
      nameError,
      recipientsError,
      expiryDaysError,
    };
  }, [draft]);


  function focusFirstInvalid() {
    const target = validation.nameError
      ? nameRef.current
      : validation.expiryDaysError
        ? expiryRef.current
        : validation.recipientsError
          ? recipientsRef.current
          : null;
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["export-schedules"],
    queryFn: () => fetchList({}),
  });

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          name: d.name,
          employee_ids: [],
          date_range_kind: "today" as const,
          format: d.format,
          recipients: d.recipients,
          send_time: d.send_time.length === 5 ? `${d.send_time}:00` : d.send_time,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          enabled: d.enabled,
          report_kind: d.report_kind,
          frequency: d.frequency,
          weekday: d.frequency === "weekly" ? d.weekday : null,
          expiry_days: d.expiry_days,
        },
      }),
    onSuccess: () => {
      toast.success("Schedule saved");
      setOpen(false);
      setDraft(emptyDraft);
      qc.invalidateQueries({ queryKey: ["export-schedules"] });
    },
    onError: (e: any) => toast.error("Could not save schedule", { description: e?.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Schedule deleted");
      qc.invalidateQueries({ queryKey: ["export-schedules"] });
    },
    onError: (e: any) => toast.error("Could not delete", { description: e?.message }),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => sendTest({ data: { id } }),
    onSuccess: (res: any) => {
      if (res?.status === "sent") {
        toast.success("Test email sent", { description: `${res.row_count} row(s) to ${res.recipients_sent.join(", ")}` });
      } else if (res?.status === "partial") {
        toast.warning("Partially sent", { description: `Failed: ${res.recipients_failed.join(", ")}` });
      } else {
        toast.error("Test email failed", { description: res?.reason || "Unknown error" });
      }
    },
    onError: (e: any) => toast.error("Test email failed", { description: e?.message }),
  });

  const expirySchedules = (schedules as any[]).filter(
    (s) => s.report_kind === "id_expiry" || s.report_kind === "contract_expiry",
  );

  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-brand-foreground">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold">Scheduled expiry emails</h2>
            <p className="text-xs text-muted-foreground">
              Email National ID / Contract expiry reports to HR daily or weekly
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-[11px] font-semibold text-brand-foreground hover:bg-brand/90"
        >
          <Plus className="h-3 w-3" /> {open ? "Close" : "New schedule"}
        </button>
      </div>

      {open && (
        <div className="mb-5 grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 md:grid-cols-3">
          <Field label="Name" error={validation.nameError}>
            <input
              ref={nameRef}
              className={inputClass(validation.nameError)}
              aria-invalid={!!validation.nameError}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Report">
            <select
              className={inputCls}
              value={draft.report_kind}
              onChange={(e) => setDraft({ ...draft, report_kind: e.target.value as Draft["report_kind"] })}
            >
              <option value="id_expiry">National ID Expiry</option>
              <option value="contract_expiry">Contract Expiry</option>
            </select>
          </Field>
          <Field label="Expiry window (days)" error={validation.expiryDaysError}>
            <select
              ref={expiryRef}
              className={inputClass(validation.expiryDaysError)}
              value={draft.expiry_days}
              aria-invalid={!!validation.expiryDaysError}
              onChange={(e) => setDraft({ ...draft, expiry_days: Number(e.target.value) })}
            >
              {[7, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </Field>
          <Field label="Frequency">
            <select
              className={inputCls}
              value={draft.frequency}
              onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Draft["frequency"] })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          {draft.frequency === "weekly" && (
            <Field label="Weekday">
              <select className={inputCls} value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}>
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
            </Field>
          )}
          <Field label="Send time">
            <input type="time" className={inputCls} value={draft.send_time} onChange={(e) => setDraft({ ...draft, send_time: e.target.value })} />
          </Field>
          <Field label="Format">
            <select className={inputCls} value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as Draft["format"] })}>
              <option value="xlsx">Excel (xlsx)</option>
              <option value="csv">CSV</option>
            </select>
          </Field>
          <div className="md:col-span-3">
            <Field label="Recipients" error={validation.recipientsError}>
              <EmailChipsInput
                inputRef={recipientsRef}
                value={draft.recipients}
                invalid={!!validation.recipientsError}
                onChange={(recipients) => setDraft({ ...draft, recipients })}
              />
            </Field>
          </div>
          <div className="flex items-end gap-2 md:col-span-3">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Enabled
            </label>
            <div className="flex-1" />
            <button
              disabled={saveMut.isPending}
              onClick={() => {
                if (!validation.ok) {
                  focusFirstInvalid();
                  toast.error("Please fix the highlighted fields");
                  return;
                }
                saveMut.mutate(draft);
              }}
              className="rounded-full bg-foreground px-4 py-1.5 text-[11px] font-semibold text-background disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "Save schedule"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-xs text-muted-foreground animate-pulse">Loading schedules…</p>
      ) : expirySchedules.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No expiry schedules yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {expirySchedules.map((s: any) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {s.name}
                  {!s.enabled && <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">paused</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {s.report_kind === "id_expiry" ? "National ID" : "Contract"} · next {s.expiry_days ?? 30} days ·{" "}
                  {s.frequency === "weekly" ? `Weekly (${WEEKDAYS[Number(s.weekday ?? 0)]})` : "Daily"} at {String(s.send_time).slice(0, 5)} {s.timezone}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Mail className="h-3 w-3" /> {(s.recipients ?? []).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={testMut.isPending}
                  onClick={() => testMut.mutate(s.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[11px] font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                >
                  <Send className="h-3 w-3" /> {testMut.isPending ? "Sending…" : "Send test email now"}
                </button>
                <button
                  onClick={() => deleteMut.mutate(s.id)}
                  className="rounded-full bg-muted p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete schedule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmailChipsInput({
  value,
  onChange,
  invalid,
  inputRef,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  invalid?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [text, setText] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function commit(raw: string) {
    const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setText("");
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div
      onClick={() => inputRef?.current?.focus()}
      className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2 py-1.5 focus-within:ring-1 ${
        invalid ? "border-destructive focus-within:ring-destructive" : "border-border focus-within:ring-ring"
      }`}
    >
      {value.map((email, i) => {
        const bad = !EMAIL_RE.test(email);
        return (
          <span
            key={`${email}-${i}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`inline-flex cursor-grab items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium active:cursor-grabbing ${
              bad ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
            } ${dragIndex === i ? "opacity-50" : ""}`}
          >
            <GripVertical className="h-3 w-3 opacity-50" />
            {email}
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((_, idx) => idx !== i));
              }}
              className="rounded-full p-0.5 hover:bg-foreground/10"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        className="min-w-[160px] flex-1 bg-transparent px-1 py-0.5 text-xs outline-none"
        placeholder={value.length ? "Add another…" : "hr@company.com, admin@company.com"}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,;]/.test(v)) commit(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab" || e.key === " ") {
            if (text.trim()) {
              e.preventDefault();
              commit(text);
            }
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (/[,;\s]/.test(pasted)) {
            e.preventDefault();
            commit(`${text} ${pasted}`);
          }
        }}
        onBlur={() => text.trim() && commit(text)}
      />
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

function inputClass(error?: string) {
  return error ? `${inputCls} border-destructive focus:ring-destructive` : inputCls;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-destructive">{error}</span>}
    </label>
  );
}
