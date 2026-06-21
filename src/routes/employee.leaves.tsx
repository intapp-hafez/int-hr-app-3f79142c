import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Plus, X, Loader2, Trash2, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { useI18n, useTranslators } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { submitLeave, listMyLeaves, cancelLeave, listActiveLeaveTypes } from "@/backend/functions/leaves.functions";

const statusTone: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/employee/leaves")({
  component: LeavesPage,
});

function LeavesPage() {
  const { t } = useI18n();
  const { tLeaveType, tStatus } = useTranslators();
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listMyLeaves);
  const cancelFn = useServerFn(cancelLeave);
  const qc = useQueryClient();
  const { data: myLeaves = [], isLoading } = useQuery({
    queryKey: ["my-leaves"],
    queryFn: () => listFn(),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { toast.success("Leave cancelled"); qc.invalidateQueries({ queryKey: ["my-leaves"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = myLeaves.reduce(
    (acc, l: any) => {
      const type = String(l.leave_type_name ?? "Other").toLowerCase();
      const days = Number(l.days ?? 0);
      if (type.includes("annual")) acc.annual += days;
      else if (type.includes("sick")) acc.sick += days;
      else acc.other += days;
      return acc;
    },
    { annual: 0, sick: 0, other: 0 },
  );

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("leaves")}</h1>
          <p className="text-xs text-muted-foreground">{t("daysRemainingYear")}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground shadow-brand"
        >
          <Plus className="h-3.5 w-3.5" /> {t("request")}
        </button>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Tile label={t("annual")} value={String(counts.annual)} hint={t("used")} />
        <Tile label={t("sick")} value={String(counts.sick)} hint={t("used")} />
        <Tile label={t("otherLbl")} value={String(counts.other)} hint={t("used")} />
      </section>

      <ul className="space-y-2">
        {isLoading && (
          <li className="rounded-2xl border border-border bg-card p-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          </li>
        )}
        {!isLoading && myLeaves.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t("noLeavesYet")}
          </li>
        )}
        {myLeaves.map((l: any) => {
          const status = String(l.status ?? "pending");
          const titleStatus = status.charAt(0).toUpperCase() + status.slice(1);
          return (
            <li key={l.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{tLeaveType(l.leave_type_name ?? "Other")}</p>
                  <p className="text-xs text-muted-foreground">{l.start_date} → {l.end_date} • {l.days}d</p>
                  {l.reason && <p className="mt-1 text-[11px] text-muted-foreground">"{l.reason}"</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusTone[status] ?? "bg-muted"}`}>
                    {tStatus(titleStatus)}
                  </span>
                  {status === "pending" && (
                    <button
                      onClick={() => { if (window.confirm("Cancel this leave request?")) cancelMut.mutate(l.id); }}
                      disabled={cancelMut.isPending}
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                      title="Cancel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {open && <LeaveModal onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-leaves"] }); }} />}
    </div>
  );
}

function LeaveModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const typesFn = useServerFn(listActiveLeaveTypes);
  const { data: types = [] } = useQuery({ queryKey: ["active-leave-types"], queryFn: () => typesFn() });
  const [type, setType] = useState("Annual Leave");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ name: string; mime: string; dataUrl: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitFn = useServerFn(submitLeave);

  const selectedType = (types as any[]).find((tp) => tp.name === type);
  const requiresProof = !!selectedType?.requires_proof;
  const MAX_PROOF = 1.5 * 1024 * 1024;
  const ALLOWED_PROOF = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

  async function onProof(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_PROOF.includes(f.type)) { setErr("Only PDF, PNG, or JPEG files are allowed."); e.target.value = ""; return; }
    if (f.size > MAX_PROOF) { setErr("File must be 1.5 MB or smaller."); e.target.value = ""; return; }
    setErr(null);
    const reader = new FileReader();
    reader.onload = () => setProof({ name: f.name, mime: f.type, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start || !end) return setErr(t("errStartEnd"));
    if (new Date(end) < new Date(start)) return setErr(t("errEndBeforeStart"));
    if (reason.trim().length > 500) return setErr(t("errReasonLong"));
    if (requiresProof && !proof) return setErr("A doctor proof attachment is required for this leave type.");
    const days = daysBetween(start, end);
    setBusy(true);
    try {
      await submitFn({ data: {
        leave_type_id: selectedType?.id ?? null,
        leave_type_name: type,
        start_date: start,
        end_date: end,
        days,
        paid: selectedType ? !!selectedType.paid : !/unpaid/i.test(type),
        reason: reason.trim() || undefined,
        proof_url: proof?.dataUrl ?? null,
        proof_mime: proof?.mime ?? null,
        proof_name: proof?.name ?? null,
      } });
      toast.success(t("leaveSubmitted"), { description: `${type}: ${start} → ${end}. ${t("awaitingReview")}` });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 px-4 pb-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("newLeaveRequest")}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <Field label={t("type")}>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
              {(types as any[]).length === 0 && <option value={type}>{type}</option>}
              {(types as any[]).map((tp) => (
                <option key={tp.id} value={tp.name}>{tp.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("startDate")}><input required min={todayISO} value={start} onChange={(e) => setStart(e.target.value)} type="date" className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></Field>
            <Field label={t("endDate")}><input required min={start || todayISO} value={end} onChange={(e) => setEnd(e.target.value)} type="date" className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></Field>
          </div>
          {start && end && new Date(end) >= new Date(start) && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {t("requesting")} <span className="font-semibold text-foreground">{daysBetween(start, end)} {daysBetween(start, end) === 1 ? t("dayWord") : t("daysWord")}</span>
            </p>
          )}
          <Field label={t("reasonOptional")}>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" placeholder={t("briefReason")} />
          </Field>
          {requiresProof && (
            <Field label="Doctor proof (PDF / PNG / JPEG, max 1.5 MB)">
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/jpg" onChange={onProof} className="hidden" />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
                  <Paperclip className="h-3.5 w-3.5" /> {proof ? "Replace file" : "Attach file"}
                </button>
                {proof && (
                  <span className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> {proof.name}
                  </span>
                )}
              </div>
            </Field>
          )}
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
          <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("submitRequest")}
          </button>
        </form>
      </div>
    </div>
  );
}

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
