import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSmtpConfig } from "./smtp-config.server";
import { sendEmail } from "./smtp-client.server";
import { rowsToCsv, rowsToXlsx, type ActivityRow } from "./csv-xlsx.server";
import { renderExportEmail } from "./email-render.server";

export type RunSummary = {
  schedule_id: string;
  status: "sent" | "failed" | "partial" | "skipped";
  reason?: string;
  recipients_sent: string[];
  recipients_failed: string[];
  row_count: number;
};

function nowHHMMIn(tz: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "UTC", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

function todayInTz(tz: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function computeRange(kind: string, todayLocal: string): { from: string; to: string; label: string } {
  const today = new Date(todayLocal + "T00:00:00Z");
  const shift = (d: Date, days: number) => {
    const x = new Date(d); x.setUTCDate(x.getUTCDate() + days); return x;
  };
  switch (kind) {
    case "today":
      return { from: todayLocal, to: todayLocal, label: "Today" };
    case "yesterday": {
      const y = shift(today, -1).toISOString().slice(0, 10);
      return { from: y, to: y, label: "Yesterday" };
    }
    case "last_7_days": {
      const f = shift(today, -7).toISOString().slice(0, 10);
      const t = shift(today, -1).toISOString().slice(0, 10);
      return { from: f, to: t, label: "Last 7 days" };
    }
    case "last_30_days": {
      const f = shift(today, -30).toISOString().slice(0, 10);
      const t = shift(today, -1).toISOString().slice(0, 10);
      return { from: f, to: t, label: "Last 30 days" };
    }
    default:
      return { from: todayLocal, to: todayLocal, label: kind };
  }
}

async function fetchActivityRows(
  employeeIds: string[],
  from: string,
  to: string,
): Promise<ActivityRow[]> {
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T23:59:59Z`;

  let q = supabaseAdmin
    .from("task_activity")
    .select("kind, task_name, occurred_at, city, district, note, employee_id")
    .gte("occurred_at", fromTs)
    .lte("occurred_at", toTs)
    .order("occurred_at", { ascending: true })
    .limit(10000);
  if (employeeIds.length > 0) q = q.in("employee_id", employeeIds);
  const { data: acts, error } = await q;
  if (error) throw new Error(`activity fetch: ${error.message}`);

  const empIds = Array.from(new Set((acts ?? []).map((a) => a.employee_id)));
  const profs = empIds.length
    ? (await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", empIds)).data ?? []
    : [];
  const map = new Map(profs.map((p) => [p.id, p]));

  return (acts ?? []).map((a) => {
    const p = map.get(a.employee_id);
    return {
      employee_name: p?.full_name || "Unknown",
      employee_email: p?.email || "",
      kind: a.kind,
      task_name: a.task_name || "",
      occurred_at: a.occurred_at,
      city: a.city || "",
      district: a.district || "",
      note: a.note || "",
    };
  });
}

/**
 * Process all due schedules. Idempotent — relies on UNIQUE(schedule_id, run_date)
 * to prevent duplicate runs across overlapping cron invocations.
 */
export async function runDueSchedules(now: Date = new Date()): Promise<RunSummary[]> {
  const { data: schedules, error } = await supabaseAdmin
    .from("export_schedules")
    .select("*")
    .eq("enabled", true);
  if (error) throw new Error(`schedules fetch: ${error.message}`);

  const summaries: RunSummary[] = [];
  const smtp = await loadSmtpConfig();

  for (const sch of schedules ?? []) {
    const tz = sch.timezone || "UTC";
    const todayLocal = todayInTz(tz, now);
    const nowHHMM = nowHHMMIn(tz, now);

    if (sch.last_run_date === todayLocal) {
      summaries.push({ schedule_id: sch.id, status: "skipped", reason: "already_ran_today",
        recipients_sent: [], recipients_failed: [], row_count: 0 });
      continue;
    }
    const sendHHMM = String(sch.send_time).slice(0, 5);
    if (nowHHMM < sendHHMM) {
      summaries.push({ schedule_id: sch.id, status: "skipped", reason: "not_due_yet",
        recipients_sent: [], recipients_failed: [], row_count: 0 });
      continue;
    }

    const { data: lockRow, error: lockErr } = await supabaseAdmin
      .from("export_runs")
      .insert({ schedule_id: sch.id, run_date: todayLocal, status: "running" })
      .select("id")
      .single();
    if (lockErr || !lockRow) {
      summaries.push({ schedule_id: sch.id, status: "skipped", reason: "lock_taken",
        recipients_sent: [], recipients_failed: [], row_count: 0 });
      continue;
    }
    const runId = lockRow.id;

    try {
      const { from, to, label } = computeRange(sch.date_range_kind, todayLocal);
      const rows = await fetchActivityRows(sch.employee_ids ?? [], from, to);
      const file = sch.format === "xlsx" ? rowsToXlsx(rows) : rowsToCsv(rows);
      const filename = `${sch.name.replace(/[^a-z0-9_-]+/gi, "_")}_${todayLocal}.${sch.format}`;
      const contentType = sch.format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv";

      const { subject, html, text } = renderExportEmail({
        scheduleName: sch.name, runDate: todayLocal, rangeLabel: label, rowCount: rows.length,
      });

      const sent: string[] = [];
      const failed: string[] = [];
      let lastError: string | undefined;

      if (!smtp || !smtp.host || !smtp.password) {
        lastError = "SMTP not configured";
        failed.push(...(sch.recipients ?? []));
      } else {
        for (const rcpt of sch.recipients ?? []) {
          const res = await sendEmail(
            { host: smtp.host, port: smtp.port, secure: smtp.secure, username: smtp.username, password: smtp.password },
            {
              from: smtp.from_name ? `${smtp.from_name} <${smtp.from_email}>` : smtp.from_email,
              fromEmail: smtp.from_email,
              to: [rcpt], subject, html, text,
              attachments: [{ filename, content: file, contentType }],
            },
          );
          if (res.ok) {
            sent.push(rcpt);
            await supabaseAdmin.from("notif_deliveries").insert({
              recipient: rcpt, channel: "email", status: "sent", subject,
              payload: { schedule_id: sch.id, run_id: runId },
            });
          } else {
            failed.push(rcpt);
            lastError = res.message;
            await supabaseAdmin.from("notif_deliveries").insert({
              recipient: rcpt, channel: "email", status: "failed", subject,
              error: res.message, payload: { schedule_id: sch.id, run_id: runId },
            });
          }
        }
      }

      const status: "sent" | "failed" | "partial" =
        failed.length === 0 ? "sent" : sent.length === 0 ? "failed" : "partial";
      await supabaseAdmin.from("export_runs").update({
        status, finished_at: new Date().toISOString(),
        recipients_sent: sent, recipients_failed: failed,
        file_size_bytes: file.length, row_count: rows.length,
        error: lastError ?? null,
      }).eq("id", runId);
      await supabaseAdmin.from("export_schedules").update({ last_run_date: todayLocal }).eq("id", sch.id);

      summaries.push({ schedule_id: sch.id, status, recipients_sent: sent, recipients_failed: failed, row_count: rows.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin.from("export_runs").update({
        status: "failed", finished_at: new Date().toISOString(), error: msg,
      }).eq("id", runId);
      summaries.push({ schedule_id: sch.id, status: "failed", reason: msg,
        recipients_sent: [], recipients_failed: sch.recipients ?? [], row_count: 0 });
    }
  }

  return summaries;
}