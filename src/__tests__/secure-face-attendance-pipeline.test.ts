import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

// ── 1. Strict Vector & Anti-NaN Distance Math ──
function safeDistance(a: unknown, b: unknown): { valid: boolean; dist: number | null; error?: string } {
  if (!Array.isArray(a) || a.length !== 128 || !Array.isArray(b) || b.length !== 128) {
    return { valid: false, dist: null, error: "Vector must be an array of exactly 128 elements." };
  }

  let s = 0;
  for (let i = 0; i < 128; i++) {
    const valA = a[i];
    const valB = b[i];
    if (typeof valA !== "number" || !Number.isFinite(valA) || typeof valB !== "number" || !Number.isFinite(valB)) {
      return { valid: false, dist: null, error: "Vector contains non-finite or NaN values." };
    }
    const d = valA - valB;
    s += d * d;
  }

  const dist = Math.sqrt(s);
  if (!Number.isFinite(dist) || dist < 0) {
    return { valid: false, dist: null, error: "Computed distance is non-finite." };
  }

  return { valid: true, dist };
}

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ── 2. Ordered Sequence & Center Liveness Evaluator ──
function evaluateOrderedLiveness(
  telemetry: Array<{ t: number; yaw?: number; pitch?: number; ear?: number }>,
  expectedSequence: string[]
): { valid: boolean; reason?: string } {
  if (!Array.isArray(telemetry) || telemetry.length < 4) {
    return { valid: false, reason: "Insufficient telemetry frames (minimum 4 samples required)." };
  }

  for (let i = 1; i < telemetry.length; i++) {
    if (typeof telemetry[i].t !== "number" || typeof telemetry[i - 1].t !== "number" || telemetry[i].t <= telemetry[i - 1].t) {
      return { valid: false, reason: "Telemetry timestamps must be strictly ascending numbers." };
    }
  }

  const totalDuration = telemetry[telemetry.length - 1].t - telemetry[0].t;
  if (totalDuration < 800 || totalDuration > 8000) {
    return { valid: false, reason: `Invalid challenge duration (${totalDuration}ms). Expected between 800ms and 8000ms.` };
  }

  let currentStepIdx = 0;
  let lastStepTime = -1;

  for (let i = 0; i < telemetry.length && currentStepIdx < expectedSequence.length; i++) {
    const sample = telemetry[i];
    const targetStep = expectedSequence[currentStepIdx];
    const yaw = sample.yaw ?? 0;
    const ear = sample.ear ?? 0.28;

    let stepMatched = false;
    if (targetStep === "turn_left" && yaw < -12.0) {
      stepMatched = true;
    } else if (targetStep === "turn_right" && yaw > 12.0) {
      stepMatched = true;
    } else if (targetStep === "blink" && ear < 0.185) {
      stepMatched = true;
    } else if (targetStep === "center" && Math.abs(yaw) <= 6.0 && ear >= 0.22) {
      stepMatched = true;
    }

    if (stepMatched) {
      if (sample.t <= lastStepTime) {
        return { valid: false, reason: `Step ${targetStep} out of temporal sequence order.` };
      }
      lastStepTime = sample.t;
      currentStepIdx++;
    }
  }

  if (currentStepIdx < expectedSequence.length) {
    return {
      valid: false,
      reason: `Challenge sequence incomplete. Missing step: ${expectedSequence[currentStepIdx]} in required order.`,
    };
  }

  const yaws = telemetry.map((p) => p.yaw ?? 0);
  const ears = telemetry.map((p) => p.ear ?? 0.28);
  const meanYaw = yaws.reduce((acc, v) => acc + v, 0) / yaws.length;
  const yawVariance = yaws.reduce((acc, v) => acc + Math.pow(v - meanYaw, 2), 0) / yaws.length;
  const earRange = Math.max(...ears) - Math.min(...ears);

  if (yawVariance < 0.15 && earRange < 0.05) {
    return { valid: false, reason: "Static facial geometry detected. Presentation attack rejected." };
  }

  return { valid: true };
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000.0;
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── 3. High-Fidelity Simulation of Database Function ──
class HardenedAttendanceDatabaseMock {
  challenges = new Map<string, { id: string; user_id: string; device_id: string; action: string; used_at: string | null; expires_at: string }>();
  proofs = new Map<string, { id: string; user_id: string; device_id: string; action: string; proof_hash: string; expires_at: string; used_at: string | null }>();
  idempotency = new Map<string, { idempotency_key: string; user_id: string; action: string; request_hash: string; response_payload: any }>();
  attendance: any[] = [];
  devices = new Map<string, { id: string; user_id: string; status: string }>();
  geofences: Array<{ profile_id: string; name: string; lat: number; lng: number; radius_m: number; active: boolean }> = [];

  // Atomic Challenge Consumption & Proof Minting RPC
  mintBiometricProof(params: {
    userId: string;
    deviceId: string;
    challengeId: string;
    proofHash: string;
    expiresAt: string;
    serverNow: string;
  }) {
    const serverNowMs = new Date(params.serverNow).getTime();
    const challenge = this.challenges.get(params.challengeId);

    if (
      !challenge ||
      challenge.user_id !== params.userId ||
      challenge.device_id !== params.deviceId ||
      challenge.used_at !== null ||
      new Date(challenge.expires_at).getTime() <= serverNowMs
    ) {
      return {
        ok: false,
        code: "CHALLENGE_INVALID_OR_CONSUMED",
        message: "Challenge is invalid, expired, device mismatched, or already consumed.",
      };
    }

    // Atomically consume challenge AND create proof
    challenge.used_at = params.serverNow;
    this.proofs.set(params.proofHash, {
      id: "proof-" + Math.random().toString(36).slice(2, 9),
      user_id: params.userId,
      device_id: params.deviceId,
      action: challenge.action,
      proof_hash: params.proofHash,
      expires_at: params.expiresAt,
      used_at: null,
    });

    return { ok: true, action: challenge.action, consumed_at: params.serverNow };
  }

  commitBiometricAttendance(params: {
    userId: string;
    deviceId: string;
    action: "check_in" | "check_out";
    proofHash: string;
    idempotencyKey?: string | null;
    requestHash: string;
    lat: number;
    lng: number;
    accuracy: number;
    locationTime: string;
    serverNow: string;
    deviceCheckRequired?: boolean;
  }) {
    const serverNowMs = new Date(params.serverNow).getTime();
    const locationTimeMs = new Date(params.locationTime).getTime();

    // 1. Concurrency-safe Idempotency Check with Request Hash Binding
    if (params.idempotencyKey) {
      const existing = this.idempotency.get(params.idempotencyKey);
      if (existing) {
        if (existing.user_id !== params.userId || existing.action !== params.action || existing.request_hash !== params.requestHash) {
          return { ok: false, code: "IDEMPOTENCY_CONFLICT", message: "Idempotency key reused with different request payload." };
        }
        return { ok: true, cached: true, ...existing.response_payload };
      }
    }

    if (params.action !== "check_in" && params.action !== "check_out") {
      return { ok: false, code: "INVALID_ACTION", message: "Action must be check_in or check_out." };
    }

    // 2. Strict Coordinates Bounds Check
    if (params.lat == null || params.lng == null || params.lat < -90.0 || params.lat > 90.0 || params.lng < -180.0 || params.lng > 180.0) {
      return { ok: false, code: "INVALID_COORDINATES", message: "GPS coordinates are missing or out of physical bounds." };
    }

    // 3. Strict Non-negative Accuracy & Threshold Check
    if (params.accuracy == null || params.accuracy < 0.0 || params.accuracy > 50.0) {
      return { ok: false, code: "LOW_ACCURACY_LOCATION", message: "Location accuracy must be non-negative and <= 50m." };
    }

    const ageSec = (serverNowMs - locationTimeMs) / 1000;
    if (ageSec > 30 || ageSec < -10) {
      return { ok: false, code: "STALE_LOCATION", message: "Location timestamp is stale or desynchronized." };
    }

    // 4. Server-Side Device Policy
    if (params.deviceCheckRequired) {
      const dev = this.devices.get(params.deviceId);
      if (!dev || dev.user_id !== params.userId) {
        return { ok: false, code: "DEVICE_NOT_REGISTERED", message: "Device not registered for this employee." };
      }
      if (dev.status !== "approved") {
        return { ok: false, code: "DEVICE_NOT_APPROVED", message: `Device approval status: ${dev.status}` };
      }
    }

    // 5. Server-Side Geofence Enforcement (Strict Policy: Geofence Required)
    let matchedBranch = "HQ";
    const userGeos = this.geofences.filter((g) => g.profile_id === params.userId && g.active);
    if (userGeos.length === 0) {
      return { ok: false, code: "NO_ASSIGNED_GEOFENCE", message: "No active workplace geofence configured for this employee." };
    }

    let inside = false;
    for (const geo of userGeos) {
      const d = haversineDistanceMeters(params.lat, params.lng, geo.lat, geo.lng);
      if (d <= geo.radius_m) {
        inside = true;
        matchedBranch = geo.name;
        break;
      }
    }
    if (!inside) {
      return { ok: false, code: "GEOFENCE_VIOLATION", message: "Current GPS location is outside assigned workplace geofence." };
    }

    // 6. Atomic Proof Validation & Consumption
    const proof = this.proofs.get(params.proofHash);
    if (
      !proof ||
      proof.user_id !== params.userId ||
      proof.action !== params.action ||
      proof.device_id !== params.deviceId ||
      proof.used_at !== null ||
      new Date(proof.expires_at).getTime() <= serverNowMs
    ) {
      return { ok: false, code: "INVALID_OR_CONSUMED_PROOF", message: "Proof invalid, expired, or consumed." };
    }

    proof.used_at = params.serverNow;

    const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(params.serverNow));
    const attId = "att-" + Math.random().toString(36).slice(2, 9);

    if (params.action === "check_in") {
      const alreadyCheckedIn = this.attendance.some((a) => a.employee_id === params.userId && a.date === todayCairo);
      if (alreadyCheckedIn) {
        proof.used_at = null; // rollback
        return { ok: false, code: "ALREADY_CHECKED_IN_TODAY", message: "Already checked in today." };
      }

      this.attendance.push({
        id: attId,
        employee_id: params.userId,
        date: todayCairo,
        in_time: params.serverNow,
        out_time: null,
        branch: matchedBranch,
      });
    } else {
      const openShift = this.attendance
        .filter((a) => a.employee_id === params.userId && a.out_time === null)
        .sort((a, b) => new Date(b.in_time).getTime() - new Date(a.in_time).getTime())[0];

      if (!openShift) {
        proof.used_at = null; // rollback
        return { ok: false, code: "NO_OPEN_CHECKIN_FOUND", message: "No active check-in shift found." };
      }
      openShift.out_time = params.serverNow;
    }

    const response = {
      ok: true,
      attendance_id: attId,
      action: params.action,
      branch: matchedBranch,
      server_timestamp: params.serverNow,
      work_date: todayCairo,
    };

    if (params.idempotencyKey) {
      this.idempotency.set(params.idempotencyKey, {
        idempotency_key: params.idempotencyKey,
        user_id: params.userId,
        action: params.action,
        request_hash: params.requestHash,
        response_payload: response,
      });
    }

    return response;
  }
}

// ── TEST SUITE ──
describe("Hardened Face Attendance Pipeline - Vulnerability & Acceptance Tests", () => {
  const USER_ID = "emp-uuid-101";
  const DEVICE_ID = "pixel-hw-8842";
  const SERVER_TIME = "2026-10-25T16:35:00.000Z";

  describe("Critical Fix: Anti-NaN & Finite Vector Validation", () => {
    it("strictly rejects vectors containing NaN values (preventing dist > 0.5 bypass)", () => {
      const validTemplate = new Array(128).fill(0.1);
      const malformedVector = new Array(128).fill(0.1);
      malformedVector[15] = NaN;

      const res = safeDistance(validTemplate, malformedVector);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/NaN/);
    });

    it("strictly rejects vectors containing Infinity or non-number types", () => {
      const validTemplate = new Array(128).fill(0.1);
      const infinityVector = new Array(128).fill(0.1);
      infinityVector[42] = Infinity;

      const res = safeDistance(validTemplate, infinityVector);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/non-finite/);
    });

    it("strictly rejects vectors of incorrect length (< 128 or > 128)", () => {
      const validTemplate = new Array(128).fill(0.1);
      const shortVector = new Array(127).fill(0.1);
      const res = safeDistance(validTemplate, shortVector);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/128 elements/);
    });
  });

  describe("Critical Fix: Ordered Sequence & Center Liveness Verification", () => {
    it("accepts strictly ordered sequence ending with center return", () => {
      const telemetry = [
        { t: 100, yaw: 0, pitch: 0, ear: 0.28 },
        { t: 400, yaw: -18, pitch: 2, ear: 0.27 }, // 1. turn_left
        { t: 750, yaw: -10, pitch: 1, ear: 0.12 }, // 2. blink down
        { t: 1100, yaw: 0.5, pitch: 0.2, ear: 0.28 }, // 3. center return with open eyes
      ];
      const res = evaluateOrderedLiveness(telemetry, ["turn_left", "blink", "center"]);
      expect(res.valid).toBe(true);
    });

    it("rejects out-of-order execution (e.g. blink occurred before turn_left)", () => {
      const telemetry = [
        { t: 100, yaw: 0, pitch: 0, ear: 0.28 },
        { t: 300, yaw: 0, pitch: 0, ear: 0.12 },   // blinked first
        { t: 600, yaw: -18, pitch: 2, ear: 0.27 }, // turned left second
        { t: 900, yaw: 0.5, pitch: 0.2, ear: 0.28 }, // center
      ];
      const res = evaluateOrderedLiveness(telemetry, ["turn_left", "blink", "center"]);
      expect(res.valid).toBe(false);
    });

    it("rejects missing center step (user turned head and never returned to center)", () => {
      const telemetry = [
        { t: 100, yaw: 0, pitch: 0, ear: 0.28 },
        { t: 400, yaw: -18, pitch: 2, ear: 0.27 }, // turn_left
        { t: 750, yaw: -18, pitch: 1, ear: 0.12 }, // blink down while still turned
        { t: 1100, yaw: -16, pitch: 0, ear: 0.28 }, // reopened while STILL turned (yaw = -16 != center)
      ];
      const res = evaluateOrderedLiveness(telemetry, ["turn_left", "blink", "center"]);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/Missing step: center/);
    });
  });

  describe("Atomic Challenge Consumption & Proof Minting (mintBiometricProof)", () => {
    it("atomically consumes challenge and mints proof in one step", () => {
      const db = new HardenedAttendanceDatabaseMock();
      const chalId = "chal-uuid-001";
      db.challenges.set(chalId, {
        id: chalId,
        user_id: USER_ID,
        device_id: DEVICE_ID,
        action: "check_in",
        used_at: null,
        expires_at: new Date(Date.now() + 45_000).toISOString(),
      });

      const proofSecret = "vp_secret_token_123456789";
      const proofHash = sha256Hex(proofSecret);
      const expiresAt = new Date(Date.now() + 120_000).toISOString();

      const res = db.mintBiometricProof({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        challengeId: chalId,
        proofHash,
        expiresAt,
        serverNow: SERVER_TIME,
      });

      expect(res.ok).toBe(true);
      expect(db.challenges.get(chalId)?.used_at).toBe(SERVER_TIME);
      expect(db.proofs.has(proofHash)).toBe(true);

      // Attempting to reuse the exact same challenge MUST fail
      const reuseRes = db.mintBiometricProof({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        challengeId: chalId,
        proofHash: "another-hash",
        expiresAt,
        serverNow: SERVER_TIME,
      });
      expect(reuseRes.ok).toBe(false);
      expect(reuseRes.code).toBe("CHALLENGE_INVALID_OR_CONSUMED");
    });
  });

  describe("GPS Bounds, Geofence Requirement, and Timezone Tests", () => {
    function setupDb() {
      const db = new HardenedAttendanceDatabaseMock();
      const secret = "vp_secret_token_123456789";
      const proofHash = sha256Hex(secret);

      db.proofs.set(proofHash, {
        id: "proof-1",
        user_id: USER_ID,
        device_id: DEVICE_ID,
        action: "check_in",
        proof_hash: proofHash,
        expires_at: new Date(new Date(SERVER_TIME).getTime() + 120_000).toISOString(),
        used_at: null,
      });

      // Assign to Cairo Branch geofence
      db.geofences.push({
        profile_id: USER_ID,
        name: "Cairo Branch",
        lat: 30.0444,
        lng: 31.2357,
        radius_m: 100,
        active: true,
      });

      return { db, secret, proofHash };
    }

    it("rejects out-of-bounds GPS coordinates (e.g. lat > 90 or lng > 180)", () => {
      const { db, proofHash } = setupDb();
      const reqHash = sha256Hex(`${USER_ID}:check_in:${DEVICE_ID}:${proofHash}:95.0:31.2357`);

      const res = db.commitBiometricAttendance({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        action: "check_in",
        proofHash,
        requestHash: reqHash,
        lat: 95.0, // Invalid latitude (> 90)!
        lng: 31.2357,
        accuracy: 10.0,
        locationTime: "2026-10-25T16:34:50.000Z",
        serverNow: SERVER_TIME,
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("INVALID_COORDINATES");
    });

    it("rejects negative GPS accuracy", () => {
      const { db, proofHash } = setupDb();
      const reqHash = sha256Hex(`${USER_ID}:check_in:${DEVICE_ID}:${proofHash}:30.0444:31.2357`);

      const res = db.commitBiometricAttendance({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        action: "check_in",
        proofHash,
        requestHash: reqHash,
        lat: 30.0444,
        lng: 31.2357,
        accuracy: -5.0, // Negative accuracy!
        locationTime: "2026-10-25T16:34:50.000Z",
        serverNow: SERVER_TIME,
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("LOW_ACCURACY_LOCATION");
    });

    it("strictly rejects employee when no active workplace geofence is configured", () => {
      const { db, proofHash } = setupDb();
      db.geofences = []; // Empty geofences

      const reqHash = sha256Hex(`${USER_ID}:check_in:${DEVICE_ID}:${proofHash}:30.0444:31.2357`);
      const res = db.commitBiometricAttendance({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        action: "check_in",
        proofHash,
        requestHash: reqHash,
        lat: 30.0444,
        lng: 31.2357,
        accuracy: 10.0,
        locationTime: "2026-10-25T16:34:50.000Z",
        serverNow: SERVER_TIME,
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("NO_ASSIGNED_GEOFENCE");
    });

    it("rejects idempotency key reuse when payload or action is modified (IDEMPOTENCY_CONFLICT)", () => {
      const { db, proofHash } = setupDb();
      const idempotencyKey = "idem-unique-key-1";

      const originalHash = sha256Hex(`${USER_ID}:check_in:${DEVICE_ID}:${proofHash}:30.0444:31.2357:12:2026-10-25T16:34:50.000Z`);

      // 1. First legitimate call
      const res1 = db.commitBiometricAttendance({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        action: "check_in",
        proofHash,
        idempotencyKey,
        requestHash: originalHash,
        lat: 30.0444,
        lng: 31.2357,
        accuracy: 12.0,
        locationTime: "2026-10-25T16:34:50.000Z",
        serverNow: SERVER_TIME,
      });
      expect(res1.ok).toBe(true);

      // 2. Attacker uses SAME idempotency key for check_out or altered coordinates!
      const alteredHash = sha256Hex(`${USER_ID}:check_out:${DEVICE_ID}:${proofHash}:30.0444:31.2357:12:2026-10-25T16:34:50.000Z`);
      const res2 = db.commitBiometricAttendance({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        action: "check_out",
        proofHash,
        idempotencyKey,
        requestHash: alteredHash,
        lat: 30.0444,
        lng: 31.2357,
        accuracy: 12.0,
        locationTime: "2026-10-25T16:34:50.000Z",
        serverNow: SERVER_TIME,
      });
      expect(res2.ok).toBe(false);
      expect(res2.code).toBe("IDEMPOTENCY_CONFLICT");
    });

    it("uses Africa/Cairo timezone for attendance work date calculation", () => {
      const { db, proofHash } = setupDb();
      db.proofs.get(proofHash)!.expires_at = "2026-10-25T22:32:00.000Z";
      const reqHash = sha256Hex(`${USER_ID}:check_in:${DEVICE_ID}:${proofHash}:30.0444:31.2357`);

      const res = db.commitBiometricAttendance({
        userId: USER_ID,
        deviceId: DEVICE_ID,
        action: "check_in",
        proofHash,
        requestHash: reqHash,
        lat: 30.0444,
        lng: 31.2357,
        accuracy: 10.0,
        locationTime: "2026-10-25T22:29:55.000Z",
        serverNow: "2026-10-25T22:30:00.000Z", // 22:30 UTC = 00:30 next day in Cairo! (UTC+2)
      });

      expect(res.ok).toBe(true);
      expect(res.work_date).toBe("2026-10-26");
    });
  });
});
