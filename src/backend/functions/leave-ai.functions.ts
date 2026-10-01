import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaveDraft = {
  leave_type_name: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  reason: string;
  requires_proof: boolean;
  policy_notes: string[];
  warnings: string[];
  error: string | null;
};

const empty = (error: string): LeaveDraft => ({
  leave_type_name: null, start_date: null, end_date: null, days: null, reason: "",
  requires_proof: false, policy_notes: [], warnings: [], error,
});

/** Streams a Responses call and returns the concatenated output text. */
async function streamResponse(key: string, system: string, user: string): Promise<{ text: string; status: number; body?: string }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning: { effort: "low" },
      store: false,
      stream: true,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok || !res.body) return { text: "", status: res.status, body: await res.text().catch(() => "") };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
      } catch { /* ignore partial */ }
    }
  }
  return { text, status: 200 };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const draftLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ description: z.string().trim().min(5).max(1000) }).parse(i))
  .handler(async ({ data, context }): Promise<LeaveDraft> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return empty("AI is not configured for this project.");
    const sb = context.supabase as any;
    const year = new Date().getFullYear();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: types }, { data: balances }, { data: recent }, { data: holidays }] = await Promise.all([
      sb.from("leave_types").select("id, name, paid, annual_days, requires_proof").eq("active", true).order("name"),
      sb.from("leave_balances").select("year, total_days, used_days, leave_types:leave_type_id(name)")
        .eq("employee_id", context.userId).eq("year", year),
      sb.from("leaves").select("leave_type_name, start_date, end_date, days, status")
        .eq("employee_id", context.userId).order("created_at", { ascending: false }).limit(15),
      sb.from("holidays").select("name, date").gte("date", today).order("date").limit(20),
    ]);
    const typeList = (types ?? []) as any[];
    if (typeList.length === 0) return empty("No leave types are set up yet. Please contact HR.");

    const ctx = {
      today,
      leave_types: typeList.map((t) => ({ name: t.name, paid: !!t.paid, annual_days: t.annual_days, requires_doctor_proof: !!t.requires_proof })),
      my_balances: ((balances ?? []) as any[]).map((b) => ({
        type: b.leave_types?.name, total: b.total_days, used: b.used_days,
        remaining: Math.max(0, (b.total_days ?? 0) - (b.used_days ?? 0)),
      })),
      my_recent_requests: recent ?? [],
      upcoming_public_holidays: holidays ?? [],
      workplace_rules: [
        "Pick exactly one leave type from leave_types (use its exact name).",
        "Requested days must not exceed the remaining balance for that type; if they do, warn and suggest unpaid leave for the extra days.",
        "Types requiring doctor proof need a PDF/PNG/JPEG attachment up to 1.5 MB.",
        "Dates must not be in the past and must not overlap pending or approved requests.",
        "Public holidays inside the range do not need to be requested; mention them.",
        "Requests are reviewed by the manager and HR before approval.",
      ],
    };

    const system =
      "You help employees draft a leave request that follows company policy. " +
      "Reply with ONLY a JSON object, no markdown, with keys: leave_type_name (string|null), start_date (YYYY-MM-DD|null), " +
      "end_date (YYYY-MM-DD|null), days (number|null, calendar days inclusive), reason (string, professional, under 300 characters, " +
      "same language as the employee), policy_notes (array of short strings explaining which rules apply), " +
      "warnings (array of short strings for problems like insufficient balance, overlap, past dates, missing info). " +
      "Resolve relative dates (e.g. 'next Sunday') from today. If dates are unclear, set them to null and add a warning.";
    const user = `Context:\n${JSON.stringify(ctx)}\n\nEmployee request:\n${data.description}`;

    let out;
    try {
      out = await streamResponse(key, system, user);
    } catch (e: any) {
      return empty("Couldn't reach the AI service. Please try again in a moment.");
    }
    if (out.status !== 200) {
      if (out.status === 402) return empty("AI credits are used up for this workspace.");
      if (out.status === 429) return empty("The AI is busy right now — please try again shortly.");
      if (out.status === 403) return empty("AI access is not available for this workspace.");
      return empty(`AI request failed (${out.status}).`);
    }
    const m = out.text.match(/\{[\s\S]*\}/);
    if (!m) return empty("The AI didn't return a draft. Please describe your need in more detail.");
    let j: any;
    try { j = JSON.parse(m[0]); } catch { return empty("The AI returned an unreadable draft. Please try again."); }

    const match = typeList.find((t) => String(t.name).toLowerCase() === String(j.leave_type_name ?? "").toLowerCase());
    const warnings: string[] = Array.isArray(j.warnings) ? j.warnings.map(String).slice(0, 8) : [];
    if (j.leave_type_name && !match) warnings.push(`"${j.leave_type_name}" is not an available leave type — pick one manually.`);
    const start = ISO.test(j.start_date ?? "") ? j.start_date : null;
    const end = ISO.test(j.end_date ?? "") ? j.end_date : null;
    return {
      leave_type_name: match?.name ?? null,
      start_date: start,
      end_date: end,
      days: typeof j.days === "number" ? j.days : null,
      reason: String(j.reason ?? "").slice(0, 500),
      requires_proof: !!match?.requires_proof,
      policy_notes: Array.isArray(j.policy_notes) ? j.policy_notes.map(String).slice(0, 8) : [],
      warnings,
      error: null,
    };
  });
