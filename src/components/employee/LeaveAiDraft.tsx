import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { draftLeaveRequest, type LeaveDraft } from "@/backend/functions/leave-ai.functions";

export function LeaveAiDraft({ onApply }: { onApply: (d: LeaveDraft) => void }) {
  const fn = useServerFn(draftLeaveRequest);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<LeaveDraft | null>(null);

  async function run() {
    if (text.trim().length < 5) return;
    setBusy(true);
    setDraft(null);
    try {
      const d = await fn({ data: { description: text.trim() } });
      setDraft(d);
      if (!d.error) onApply(d);
    } catch (e: any) {
      setDraft({ leave_type_name: null, start_date: null, end_date: null, days: null, reason: "", requires_proof: false, policy_notes: [], warnings: [], error: e?.message ?? "Failed to draft" });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/50 bg-brand/5 py-2 text-xs font-semibold text-brand">
        <Sparkles className="h-3.5 w-3.5" /> Describe your need — AI drafts it for you
      </button>
    );
  }
  return (
    <div className="mb-3 space-y-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="e.g. I need 3 days off next week from Sunday for a family wedding"
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
      />
      <button type="button" disabled={busy || text.trim().length < 5} onClick={run} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy ? "Checking your balance and policy…" : "Draft my request"}
      </button>
      {draft?.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{draft.error}</p>}
      {draft && !draft.error && (
        <div className="space-y-1.5 text-xs">
          <p className="font-medium text-success">Draft filled in below — review before submitting.</p>
          {draft.warnings.length > 0 && (
            <ul className="list-disc space-y-0.5 rounded-lg bg-destructive/10 py-2 pl-6 pr-2 text-destructive">
              {draft.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {draft.policy_notes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              {draft.policy_notes.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
