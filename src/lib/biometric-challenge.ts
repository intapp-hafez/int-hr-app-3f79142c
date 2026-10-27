/**
 * biometric-challenge.ts
 *
 * Client-side wrapper for the `biometric-auth` Supabase Edge Function.
 * ALL biometric decisions (liveness, face matching, proof minting) are
 * made server-side. This file only handles HTTP transport and error parsing.
 *
 * Flow:
 *   1. beginVerification()  → challenge_id + expected_sequence
 *   2. verifyFaceChallenge() → verification_proof  (TTL 2 min)
 *   3. commitAttendance()   → attendance_id + decision
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttendanceAction = "check_in" | "check_out";

export type ChallengeResponse = {
  ok: true;
  challenge_id: string;
  challenge_action: AttendanceAction;
  challenge_type: string;
  expected_sequence: string[];
  expires_at: string;
};

export type VisualKeyframe = {
  step: string;
  t: number;         // epoch ms — from Date.now() at moment of capture
  image_b64: string; // data:image/jpeg;base64,…
};

export type VerifyFacePayload = {
  challenge_id: string;
  device_id: string;
  descriptor: number[];       // 128 finite floats extracted by face-api.js locally
  visual_keyframes: VisualKeyframe[];
  snapshot_lat?: number | null;
  snapshot_lng?: number | null;
  snapshot_accuracy_m?: number | null;
};

export type VerifyFaceResponse = {
  ok: true;
  verification_proof: string;
  expires_at: string;
};

export type GpsSample = {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  timestamp?: number | null;
};

export type CommitAttendancePayload = {
  request_action: AttendanceAction;
  verification_proof: string;
  device_id: string;
  idempotency_key: string;
  location: {
    lat: number;
    lng: number;
    accuracy_meters?: number | null;
    captured_at: string; // ISO string from server-acknowledged fix time
  };
  samples?: GpsSample[];
  device_signature?: string | null;
};

export type CommitAttendanceResponse = {
  ok: true;
  attendance_id: string;
  action: AttendanceAction;
  work_date: string;
  in_time?: string | null;
  out_time?: string | null;
  decision: "accept" | "review";
  pending_review?: boolean;
};

// ─── Internal helper ─────────────────────────────────────────────────────────

export class BiometricApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BiometricApiError";
  }
}

async function invokeEdge<T>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("biometric-auth", {
    body: { action, ...body },
  });

  if (error) {
    let msg = error.message;
    let code = "EDGE_ERROR";

    try {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        const bodyJson = await ctx.json();
        if (bodyJson?.message) msg = bodyJson.message;
        else if (bodyJson?.error) msg = bodyJson.error;
        if (bodyJson?.code) code = bodyJson.code;
      }
    } catch {
      // ignore JSON parse error
    }

    throw new BiometricApiError(code, msg);
  }

  if (!data?.ok) {
    throw new BiometricApiError(
      data?.code ?? "UNKNOWN",
      data?.error ?? data?.message ?? "Unknown error from biometric service",
    );
  }

  return data as T;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Step 1 — Request a server-issued liveness challenge.
 * Server atomically checks: account Active, rate-limit (5 per 10 min), device approved.
 */
export async function beginVerification(
  request_action: AttendanceAction,
  device_id: string,
): Promise<ChallengeResponse> {
  return invokeEdge<ChallengeResponse>("begin-verification", {
    request_action,
    device_id,
  });
}

/**
 * Step 2 — Submit visual keyframes + face descriptor for server-side verification.
 * Server performs:
 *   - Binary image parsing (JPEG/WebP/PNG headers, ≥120×120)
 *   - Shannon entropy check (≥3.5) — rejects blank/synthetic frames
 *   - Cross-frame optical motion delta — rejects static photo replay
 *   - Euclidean distance against enrolled template (d ≤ 0.50)
 *   - Atomic proof minting (mint_biometric_proof)
 * Returns a single-use `verification_proof` token (TTL: 2 minutes).
 * The enrolled descriptor and match distance are NEVER returned to the client.
 */
export async function verifyFaceChallenge(
  payload: VerifyFacePayload,
): Promise<VerifyFaceResponse> {
  return invokeEdge<VerifyFaceResponse>("verify-face", payload);
}

/**
 * Step 3 — Atomically commit attendance.
 * Server performs:
 *   - Device signature verification (WebCrypto ECDSA/RSA-PSS)
 *   - Proof consumption (used_at = clock_timestamp())
 *   - Anti-spoofing evaluation (GPS jitter, face-location divergence, impossible travel)
 *   - Geofence check (Haversine + accuracy circle)
 *   - DB insert with server clock_timestamp()
 */
export async function commitAttendance(
  payload: CommitAttendancePayload,
): Promise<CommitAttendanceResponse> {
  return invokeEdge<CommitAttendanceResponse>("commit-attendance", payload);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Generate a collision-resistant idempotency key for a single operation. */
export function makeIdempotencyKey(action: AttendanceAction): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `idem_${action}_${today}_${rand}`;
}

/** Validate a face descriptor — must be exactly 128 finite floats. */
export function validateDescriptor(d: number[]): boolean {
  return (
    Array.isArray(d) &&
    d.length === 128 &&
    d.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

/**
 * Capture a JPEG keyframe from a live video element as a base64 data URI.
 * The canvas is NOT mirrored — server validates natural face orientation.
 * Resolution capped at 640px on the longest side.
 */
export function captureKeyframe(video: HTMLVideoElement): string {
  const MAX = 640;
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const scale = Math.min(1, MAX / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * Human-readable label for a pose step (shown to the user during challenge).
 */
export function poseLabel(step: string): string {
  const labels: Record<string, string> = {
    turn_left:  "Turn your head left",
    turn_right: "Turn your head right",
    blink:      "Blink naturally",
    center:     "Look straight ahead",
    nod:        "Nod slowly",
    smile:      "Smile",
  };
  return labels[step] ?? step.replace(/_/g, " ");
}
