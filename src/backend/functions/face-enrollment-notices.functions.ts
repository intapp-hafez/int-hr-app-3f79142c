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
        .eq("channel", "inapp")
        .contains("payload", { kind: "face_enrollment" })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastState = (last?.payload as any)?.state as string | undefined;
      if (lastState !== state) {
        const { error } = await supabase.from("notif_deliveries").insert({
          user_id: userId,
          channel: "inapp",
          status: "sent",
          subject: copy.title,
          payload: {
            kind: "face_enrollment",
            state,
            severity: copy.severity,
            title: copy.title,
            body: copy.body,
            url: "/employee/biometrics",
          },
        });
        notified = !error;
      }
    }

    return { state, required, notified, ...copy };
  });
