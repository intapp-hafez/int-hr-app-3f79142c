/**
 * Anti-Spoofing Presence Evaluation Engine
 *
 * Implements the uncertainty-aware GPS geometry and impossible-travel checks
 * specified in PWA_ATTENDANCE_ANTI_SPOOFING.md §6.1 and §6.2.
 *
 * Returns a structured AttendanceDecision: ACCEPT | REVIEW | REJECT
 * with typed reason codes that drive the three-tier decision flow.
 *
 * SECURITY TRUTH (from spec §1):
 *   No single browser-reported signal proves physical presence.
 *   All signals are heuristics. Hard controls (biometric/device/rate-limit)
 *   still enforce REJECT independently. This engine adds uncertainty handling.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** GPS fix older than this is considered stale and triggers REVIEW. */
const GPS_MAX_AGE_MS = 30_000; // 30 seconds

/** Accuracy values worse than this cause boundary-uncertain handling. */
const GPS_ACCURACY_WARN_M = 80; // metres

/** Impossible: claimed accuracy ≤ this on a web GPS is highly suspicious. */
const GPS_ACCURACY_SUSPICIOUSLY_PERFECT_M = 2; // metres

/** Velocity above this triggers REVIEW for impossible travel. */
const IMPOSSIBLE_TRAVEL_KMPH = 120;

/** Policy version stamped on every attempt. Increment when rules change. */
export const POLICY_VERSION = 2;

// ── Types ────────────────────────────────────────────────────────────────────

export type DecisionOutcome = "accept" | "review" | "reject";

export type RiskSignal = {
  code: string;
  severity: "info" | "warn" | "hard";
  detail?: string;
};

export type FenceOutcome = "inside" | "outside" | "uncertain" | "no_fence";

export type AttendanceDecision = {
  outcome: DecisionOutcome;
  fenceOutcome: FenceOutcome;
  fenceDistanceM: number | null;
  fenceAllowedM: number | null;
  riskSignals: RiskSignal[];
  reasonCodes: string[];
  policyVersion: number;
};

export type GpsTelemetry = {
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  gps_age_ms?: number | null;
  gps_sample_count?: number | null;
  samples?: Array<{ lat: number; lng: number; accuracy_m?: number | null; timestamp?: number | null }> | null;
  altitude?: number | null;
  altitude_accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  snapshot_lat?: number | null;
  snapshot_lng?: number | null;
  snapshot_accuracy_m?: number | null;
};

export type Fence = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
};

export type LastTrustedLocation = {
  lat: number;
  lng: number;
  at: Date;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine great-circle distance in metres. */
function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ── Core Engine ───────────────────────────────────────────────────────────────

/**
 * Evaluate attendance attempt telemetry against assigned geofences.
 * Returns structured decision — caller is responsible for acting on it.
 *
 * Rules (in priority order):
 *   REJECT  — coordinates clearly outside fence (distance - accuracy > radius)
 *             OR GPS unavailable when fences are assigned
 *   REVIEW  — coordinates at uncertain boundary (distance ± accuracy straddles radius)
 *             OR stale GPS fix (> GPS_MAX_AGE_MS)
 *             OR suspicious perfect accuracy
 *             OR impossible travel detected
 *   ACCEPT  — coordinates clearly inside fence (distance + accuracy ≤ radius)
 *             OR no fences assigned (free check)
 *
 * Note: REVIEW is NOT a soft accept — the caller must create a review case
 * and return a pending response to the client rather than silently accepting.
 */
export function evaluatePresence(
  gps: GpsTelemetry,
  fences: Fence[],
  lastTrusted: LastTrustedLocation | null,
): AttendanceDecision {
  const signals: RiskSignal[] = [];
  const reasonCodes: string[] = [];
  let outcome: DecisionOutcome = "accept";
  let fenceOutcome: FenceOutcome = "no_fence";
  let fenceDistanceM: number | null = null;
  let fenceAllowedM: number | null = null;

  const {
    lat,
    lng,
    accuracy_m,
    gps_age_ms,
    gps_sample_count,
    samples,
    altitude,
    snapshot_lat,
    snapshot_lng,
  } = gps;
  const hasCoords = lat != null && lng != null;

  // ── 1. Cryptographic Face-Location Divergence ───────────────────────────
  if (snapshot_lat != null && snapshot_lng != null && hasCoords) {
    const faceDivergenceM = Math.round(distM(snapshot_lat, snapshot_lng, lat!, lng!));
    if (faceDivergenceM > 150) {
      signals.push({
        code: "geo_face_discrepancy",
        severity: "hard",
        detail: `${faceDivergenceM}m divergence between face scan and attendance submission`,
      });
      reasonCodes.push("geo_face_discrepancy");
      outcome = "reject";
    }
  }

  // ── 2. Mock GPS Micro-Jitter & Coordinate Dispersion ───────────────────
  if (samples && samples.length >= 3) {
    const lats = samples.map((s) => s.lat);
    const lngs = samples.map((s) => s.lng);
    const latMean = lats.reduce((a, b) => a + b, 0) / lats.length;
    const lngMean = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    const latVariance = lats.reduce((a, b) => a + (b - latMean) ** 2, 0) / lats.length;
    const lngVariance = lngs.reduce((a, b) => a + (b - lngMean) ** 2, 0) / lngs.length;

    // Real satellite GPS has micro-drift across 3 readings; exact zero variance indicates software Mock GPS
    if (latVariance === 0 && lngVariance === 0) {
      signals.push({
        code: "mock_gps_zero_jitter",
        severity: "hard",
        detail: "Zero coordinate variance across 3+ samples indicates synthetic/mock provider",
      });
      reasonCodes.push("mock_gps_detected");
      outcome = "reject";
    }
  }

  // ── 3. Sensor Altitude Anomalies ─────────────────────────────────────────
  if (hasCoords && altitude === 0) {
    signals.push({
      code: "suspicious_zero_altitude",
      severity: "warn",
      detail: "Hardware GPS reported exact 0.0 altitude",
    });
    reasonCodes.push("suspicious_zero_altitude");
    if (outcome === "accept") outcome = "review";
  }

  // ── 4. Stale GPS Fix ─────────────────────────────────────────────────────
  if (gps_age_ms != null && gps_age_ms > GPS_MAX_AGE_MS) {
    signals.push({ code: "gps_stale", severity: "warn", detail: `${gps_age_ms}ms` });
    reasonCodes.push("gps_stale");
    if (outcome === "accept") outcome = "review";
  }

  // ── 5. Suspiciously perfect accuracy ─────────────────────────────────────
  if (accuracy_m != null && accuracy_m <= GPS_ACCURACY_SUSPICIOUSLY_PERFECT_M) {
    signals.push({ code: "gps_perfect_accuracy", severity: "warn", detail: `${accuracy_m}m` });
    reasonCodes.push("gps_perfect_accuracy");
    if (outcome === "accept") outcome = "review";
  }

  // ── 3. Fence Evaluation ───────────────────────────────────────────────────
  if (fences.length === 0) {
    fenceOutcome = "no_fence";
    // No fence → free check. No fence-related REJECT possible.
  } else if (!hasCoords) {
    // GPS unavailable with assigned fences → hard REJECT
    fenceOutcome = "outside";
    signals.push({ code: "gps_unavailable", severity: "hard" });
    reasonCodes.push("gps_unavailable");
    outcome = "reject";
  } else {
    // Find the nearest fence
    let nearest: { fence: Fence; dist: number } | null = null;
    for (const f of fences) {
      const d = distM(lat!, lng!, f.lat, f.lng);
      if (!nearest || d < nearest.dist) nearest = { fence: f, dist: d };
      if (d <= f.radius_m) break; // already inside, no need to keep looking
    }

    if (nearest) {
      const { fence, dist } = nearest;
      fenceDistanceM = Math.round(dist);
      fenceAllowedM = fence.radius_m;

      const acc = accuracy_m ?? 0; // treat no accuracy as 0 (pessimistic for inside, optimistic for outside)

      const clearlyInside = dist + acc <= fence.radius_m;
      const clearlyOutside = dist - acc > fence.radius_m;

      if (clearlyInside) {
        fenceOutcome = "inside";
        // Stay at current outcome (accept / review from earlier signals)
      } else if (clearlyOutside) {
        fenceOutcome = "outside";
        signals.push({
          code: "gps_outside_fence",
          severity: "hard",
          detail: `${fenceDistanceM}m away, allowed ${fenceAllowedM}m (fence: ${fence.name})`,
        });
        reasonCodes.push("gps_outside_fence");
        outcome = "reject"; // Hard control — override any prior outcome
      } else {
        // Boundary uncertain: accuracy circle straddles fence edge
        fenceOutcome = "uncertain";
        signals.push({
          code: "gps_boundary_uncertain",
          severity: "warn",
          detail: `dist=${fenceDistanceM}m acc=±${Math.round(acc)}m radius=${fenceAllowedM}m`,
        });
        reasonCodes.push("gps_boundary_uncertain");
        outcome = "review";
      }

      // Poor accuracy (indoor / weak signal) — informational
      if (acc > GPS_ACCURACY_WARN_M) {
        signals.push({ code: "gps_poor_accuracy", severity: "warn", detail: `±${Math.round(acc)}m` });
        if (!reasonCodes.includes("gps_poor_accuracy")) reasonCodes.push("gps_poor_accuracy");
      }

      // Low sample count — informational
      if (gps_sample_count != null && gps_sample_count < 2) {
        signals.push({ code: "gps_single_sample", severity: "info" });
      }
    }
  }

  // ── 4. Impossible Travel ─────────────────────────────────────────────────
  if (hasCoords && lastTrusted) {
    const elapsedMs = Date.now() - lastTrusted.at.getTime();
    if (elapsedMs > 0) {
      const travelM = distM(lastTrusted.lat, lastTrusted.lng, lat!, lng!);
      const speedKmph = (travelM / 1000) / (elapsedMs / 3_600_000);
      if (speedKmph > IMPOSSIBLE_TRAVEL_KMPH) {
        signals.push({
          code: "impossible_travel",
          severity: outcome === "accept" ? "warn" : "hard",
          detail: `${Math.round(speedKmph)} km/h`,
        });
        reasonCodes.push("impossible_travel");
        if (outcome === "accept") outcome = "review"; // Don't downgrade a hard REJECT
      }
    }
  }

  return {
    outcome,
    fenceOutcome,
    fenceDistanceM,
    fenceAllowedM,
    riskSignals: signals,
    reasonCodes,
    policyVersion: POLICY_VERSION,
  };
}

/**
 * Helper: fetch the employee's last trusted attendance event (check_in or check_out)
 * from the database to compare with the current attempt for velocity checks.
 */
export async function loadLastTrustedLocation(
  supabase: any,
  userId: string,
): Promise<LastTrustedLocation | null> {
  try {
    // Look up the last accepted check-in that recorded coordinates
    const { data } = await supabase
      .from("attendance")
      .select("lat, lng, in_time, out_time, decision")
      .eq("employee_id", userId)
      .not("lat", "is", null)
      .in("decision", ["accept"]) // only trust accepted records
      .order("date", { ascending: false })
      .limit(2);

    if (!data || data.length === 0) return null;
    const row = data[0];
    // Use out_time if available, otherwise in_time
    const at = new Date(row.out_time ?? row.in_time);
    if (isNaN(at.getTime())) return null;
    return { lat: Number(row.lat), lng: Number(row.lng), at };
  } catch {
    return null; // Fail open — never block attendance on infra errors
  }
}
