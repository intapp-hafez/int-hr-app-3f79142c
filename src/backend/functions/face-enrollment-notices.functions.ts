import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FaceEnrollmentState = "missing" | "invalid" | "ready" | "not_required";

export type FaceEnrollmentNotice = {
  state: FaceEnrollmentState;
  severity: "info" | "success" | "warning" | "danger";
  title: string;
  body: string;
  required: boolean;
  notified: boolean;
};

const FACE_DEFAULTS = {
  missing: { inapp: true, email: true, push: false },
  invalid: { inapp: true, email: true, push: false },
  ready: { inapp: true, email: false, push: false },
};

/** Admin/HR: every face-enrollment notice across all channels, with employee names. */
export const listFaceEnrollmentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: isAdmin }, { data: isHr }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "hr" }),
    ]);
    if (!isAdmin && !isHr) throw new Error("Forbidden");
    const { data, error } = await (supabase as any)
      .from("notif_deliveries")
      .select("id, user_id, channel, status, recipient, error, created_at, payload")
      .contains("payload", { kind: "face_enrollment" })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const names = new Map<string, { name: string; code: string | null }>();
    if (ids.length) {
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, emp_code")
        .in("id", ids);
      for (const p of profs ?? []) names.set(p.id, { name: p.full_name ?? "—", code: p.emp_code ?? null });
    }
    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      employee: names.get(r.user_id)?.name ?? "Unknown",
      empCode: names.get(r.user_id)?.code ?? null,
      channel: r.channel as string,
      status: r.status as string,
      recipient: (r.recipient ?? null) as string | null,
      error: (r.error ?? null) as string | null,
      createdAt: r.created_at as string,
      state: (r.payload?.state ?? "unknown") as string,
      title: (r.payload?.title ?? "") as string,
    }));
  });

function isValidDescriptor(d: unknown): boolean {
  return (
    Array.isArray(d) &&
    d.length === 128 &&
    d.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

const COPY: Record<
  FaceEnrollmentState,
  { severity: FaceEnrollmentNotice["severity"]; title: string; body: string }
> = {
  missing: {
    severity: "danger",
    title: "Face enrollment required",
    body: "Your face is not enrolled yet. You cannot check in or out until you complete face enrollment from the Biometrics page.",
  },
  invalid: {
    severity: "warning",
    title: "Face enrollment needs to be redone",
    body: "Your stored face data is incomplete or corrupted. Please re-enroll your face from the Biometrics page so check in and out keeps working.",
  },
  ready: {
    severity: "success",
    title: "Face enrollment ready",
    body: "Your face is enrolled and ready. You can now check in and out using face recognition.",
  },
  not_required: {
    severity: "info",
    title: "Face recognition not required",
    body: "Face recognition is currently not required for your check in and out.",
  },
};

/**
 * Evaluates the signed-in employee's face enrollment and writes an in-app
 * notification whenever the state changes (missing / invalid / ready).
 * Safe to call on every page load — repeated identical states are not re-notified.
 */
export const syncMyFaceEnrollmentNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FaceEnrollmentNotice> => {
    const { supabase, userId } = context;

    let required = true;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("face_required")
        .eq("id", userId)
        .maybeSingle();
      if (prof && typeof (prof as any).face_required === "boolean") {
        required = (prof as any).face_required;
      }
    } catch {
      /* column may not exist yet — fail closed (required) */
    }

    const { data: row } = await supabase
      .from("face_descriptors")
      .select("descriptor")
      .eq("user_id", userId)
      .maybeSingle();

    let state: FaceEnrollmentState;
    if (!row) state = required ? "missing" : "not_required";
    else if (!isValidDescriptor(row.descriptor as unknown)) state = "invalid";
    else state = "ready";

    const copy = COPY[state];
    let notified = false;

    // Only notify on actionable / changed states — never spam "not required".
    if (state !== "not_required") {
      const { data: last } = await supabase
        .from("notif_deliveries")
        .select("id, payload")
        .eq("user_id", userId)
        .contains("payload", { kind: "face_enrollment" })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastState = (last?.payload as any)?.state as string | undefined;
      if (lastState !== state) {
        // Employee's per-category channel preferences.
        const category = `face_${state}`;
        const chan = { ...FACE_DEFAULTS[state as "missing" | "invalid" | "ready"] };
        try {
          const { data: rows } = await (supabase as any)
            .from("notification_category_prefs")
            .select("channel, enabled")
            .eq("user_id", userId)
            .eq("category", category);
          for (const r of rows ?? []) {
            if (r.channel in chan) (chan as any)[r.channel] = !!r.enabled;
          }
        } catch {
          /* fall back to defaults */
        }

        const payload = {
          kind: "face_enrollment",
          state,
          severity: copy.severity,
          title: copy.title,
          body: copy.body,
          url: "/employee/biometrics",
        };
        const { error } = await supabase.from("notif_deliveries").insert({
          user_id: userId,
          channel: "inapp",
          status: chan.inapp ? "sent" : "suppressed",
          subject: copy.title,
          error: chan.inapp ? null : "disabled by employee",
          payload,
        } as any);
        notified = !error && chan.inapp;

        try {
          const { dispatchFaceEnrollmentExternal } = await import(
            "@/backend/server/face-enrollment-dispatch.server"
          );
          await dispatchFaceEnrollmentExternal({
            userId,
            state,
            title: copy.title,
            body: copy.body,
            severity: copy.severity,
            email: chan.email,
            push: chan.push,
          });
        } catch (e) {
          console.error("[face-enrollment] external dispatch failed:", (e as Error).message);
        }
      }
    }

    return { state, required, notified, ...copy };
  });
