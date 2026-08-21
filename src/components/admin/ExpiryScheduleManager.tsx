import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Mail, Plus, Send, Trash2 } from "lucide-react";
import {
  listSchedules,
  upsertSchedule,
  deleteSchedule,
  sendScheduleTestEmail,
} from "@/backend/functions/schedules.functions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Draft = {
  name: string;
  report_kind: "id_expiry" | "contract_expiry";
  frequency: "daily" | "weekly";
  weekday: number;
  expiry_days: number;
  send_time: string;
  recipients: string;
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
  recipients: "",
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

  const validation = useMemo(() => {
    const nameError = !draft.name.trim() ? "Name is required" : undefined;
    const recipientsList = draft.recipients.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    let recipientsError: string | undefined;
    if (recipientsList.length === 0) {
      recipientsError = "At least one recipient is required";
    } else if (recipientsList.some((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))) {
      recipientsError = "One or more email addresses are invalid";
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
          recipients: d.recipients.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean),
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
          <Field label="Name">
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
          <Field label="Expiry window (days)" error={validation.errors.find((e) => e.includes("Expiry window"))}>
            <select
              className={inputCls}
              value={draft.expiry_days}
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
          <Field label="Recipients (comma separated)">
            <input
              className={inputCls}
              placeholder="hr@company.com, admin@company.com"
              value={draft.recipients}
              onChange={(e) => setDraft({ ...draft, recipients: e.target.value })}
            />
          </Field>
          <div className="flex items-end gap-2 md:col-span-3">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Enabled
            </label>
            <div className="flex-1" />
            <button
              disabled={saveMut.isPending || !validation.ok}
              onClick={() => saveMut.mutate(draft)}
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

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-destructive">{error}</span>}
    </label>
  );
}