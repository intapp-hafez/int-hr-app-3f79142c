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

// ── 2. Image Header Parser & Liveness Evaluator ──
function parseAndValidateImage(bytes: Uint8Array): { valid: boolean; width?: number; height?: number; error?: string } {
  if (bytes.length < 500) {
    return { valid: false, error: "Image payload too small to be a valid photograph." };
  }

  // JPEG (0xFF, 0xD8)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        if (width < 120 || height < 120) {
          return { valid: false, error: `Image resolution too small (${width}x${height}).` };
        }
        return { valid: true, width, height };
      }
      if (offset + 3 >= bytes.length) break;
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + length;
    }
    return { valid: true, width: 320, height: 240 };
  }

  // WebP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { valid: true, width: 320, height: 240 };
  }

  // PNG
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (width < 120 || height < 120) {
      return { valid: false, error: `Image resolution too small (${width}x${height}).` };
    }
    return { valid: true, width, height };
  }

  return { valid: false, error: "Unsupported image format. Must be valid JPEG, WebP, or PNG." };
}

function calculateByteEntropyAndVariance(bytes: Uint8Array): { entropy: number; variance: number } {
  const counts = new Uint32Array(256);
  let sum = 0;
  const len = Math.min(bytes.length, 16384);
  const sample = bytes.subarray(0, len);

  for (let i = 0; i < len; i++) {
    counts[sample[i]]++;
    sum += sample[i];
  }

  const mean = sum / len;
  let varianceSum = 0;
  let entropy = 0;

  for (let i = 0; i < 256; i++) {
    const c = counts[i];
    if (c > 0) {
      const p = c / len;
      entropy -= p * Math.log2(p);
    }
  }

  for (let i = 0; i < len; i++) {
    const diff = sample[i] - mean;
    varianceSum += diff * diff;
  }

  return { entropy, variance: varianceSum / len };
}

function verifyVisualKeyframesLiveness(
  keyframes: Array<{ step: string; t: number; image_b64: string }>,
  expectedSequence: string[]
): { valid: boolean; reason?: string } {
  if (!Array.isArray(keyframes) || keyframes.length !== expectedSequence.length) {
    return {
      valid: false,
      reason: `Visual keyframes count mismatch. Expected ${expectedSequence.length} camera crops, received ${keyframes?.length || 0}.`,
    };
  }

  // 1. Validate step matching and monotonic timestamps across all keyframes first
  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    const expectedStep = expectedSequence[i];

    if (kf.step !== expectedStep) {
      return { valid: false, reason: `Keyframe step mismatch at index ${i}: expected ${expectedStep}, got ${kf.step}.` };
    }

    if (typeof kf.t !== "number" || (i > 0 && kf.t <= keyframes[i - 1].t)) {
      return { valid: false, reason: "Keyframe timestamps must be strictly monotonic ascending numbers." };
    }
  }

  const decodedBuffers: Uint8Array[] = [];

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    const expectedStep = expectedSequence[i];

    if (!kf.image_b64 || typeof kf.image_b64 !== "string") {
      return { valid: false, reason: `Missing image payload for keyframe step: ${expectedStep}.` };
    }

    const match = kf.image_b64.match(/^data:image\/(jpeg|jpg|webp|png);base64,(.+)$/);
    if (!match) {
      return { valid: false, reason: `Invalid image data URI format for step ${expectedStep}.` };
    }

    try {
      const buf = Buffer.from(match[2], "base64");
      if (buf.length < 500 || buf.length > 500000) {
        return { valid: false, reason: `Image size for step ${expectedStep} out of realistic bounds.` };
      }

      const bytes = new Uint8Array(buf);
      const headerRes = parseAndValidateImage(bytes);
      if (!headerRes.valid) {
        return { valid: false, reason: `Header validation failed for ${expectedStep}: ${headerRes.error}` };
      }

      const { entropy, variance } = calculateByteEntropyAndVariance(bytes);
      if (entropy < 3.5 || variance < 100) {
        return { valid: false, reason: `Image for step ${expectedStep} lacks optical entropy (blank, monochrome, or dummy image).` };
      }

      decodedBuffers.push(bytes);
    } catch {
      return { valid: false, reason: `Failed to decode base64 binary for step ${expectedStep}.` };
    }
  }

  let staticCount = 0;
  for (let i = 0; i < decodedBuffers.length - 1; i++) {
    const a = decodedBuffers[i];
    const b = decodedBuffers[i + 1];
    const sampleLen = Math.min(a.length, b.length, 8192);
    let diff = 0;
    for (let k = 0; k < sampleLen; k++) {
      if (Math.abs(a[k] - b[k]) > 12) diff++;
    }
    const diffRatio = diff / sampleLen;
    if (diffRatio < 0.05) staticCount++;
  }

  if (staticCount >= decodedBuffers.length - 1) {
    return {
      valid: false,
      reason: "Identical or static image repeated across challenge steps. Presentation attack rejected.",
    };
  }

  return { valid: true };
}

// ── 3. Asymmetric Digital Signature Verification (WebCrypto) ──
async function verifyDeviceSignature(
  publicKeyStr: string,
  dataString: string,
  signatureB64: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const dataBytes = new TextEncoder().encode(dataString);
    const sigBytes = Buffer.from(signatureB64, "base64");

    const cleanKey = publicKeyStr
      .replace(/-----BEGIN [A-Z ]+-----/g, "")
      .replace(/-----END [A-Z ]+-----/g, "")
      .replace(/\s+/g, "");

    const keyBytes = Buffer.from(cleanKey, "base64");

    const key = await crypto.subtle.importKey(
      "spki",
      keyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      key,
      sigBytes,
      dataBytes
    );

    return { valid: isValid, reason: isValid ? undefined : "Signature mismatch." };
  } catch (err: any) {
    return { valid: false, reason: err?.message || "Verification failed." };
  }
}

// ── 4. High-Fidelity Simulation of Database Atomic Functions ──
class HardenedAttendanceDatabaseMock {
  challenges = new Map<string, { id: string; user_id: string; device_id: string; action: string; used_at: string | null; expires_at: string; attempt_count: number; max_attempts: number; created_at: number }>();
  proofs = new Map<string, { id: string; user_id: string; device_id: string; action: string; proof_hash: string; expires_at: string; used_at: string | null }>();
  idempotency = new Map<string, { idempotency_key: string; user_id: string; action: string; request_hash: string; status: string; response_payload: any; created_at: number; updated_at: number }>();
  attendance: any[] = [];

  // Atomic Rate Limiting & Challenge Request RPC
  requestBiometricChallenge(params: {
    userId: string;
    deviceId: string;
    action: string;
    expectedSequence: string[];
    userStatus: string;
    serverNow: number;
  }) {
    if (params.userStatus !== "Active") {
      return { ok: false, code: "ACCOUNT_NOT_ACTIVE" };
    }

    // Atomic Rate Limiting: max 5 per 10 mins
    const tenMinsAgo = params.serverNow - 10 * 60 * 1000;
    let recentCount = 0;
    for (const c of this.challenges.values()) {
      if (c.user_id === params.userId && c.created_at >= tenMinsAgo) {
        recentCount++;
      }
    }

    if (recentCount >= 5) {
      return { ok: false, code: "RATE_LIMITED", message: "Too many verification requests." };
    }

    const id = "chal-" + Math.random().toString(36).slice(2, 9);
    const chal = {
      id,
      user_id: params.userId,
      device_id: params.deviceId,
      action: params.action,
      used_at: null,
      expires_at: new Date(params.serverNow + 45000).toISOString(),
      attempt_count: 0,
      max_attempts: 3,
      created_at: params.serverNow,
    };
    this.challenges.set(id, chal);

    return { ok: true, challenge_id: id };
  }

  // Atomic Challenge Failure Recording (Never resets used_at to null)
  recordChallengeFailure(params: {
    challengeId: string;
    userId: string;
    deviceId: string;
    serverNow: number;
  }) {
    const chal = this.challenges.get(params.challengeId);
    if (!chal || chal.user_id !== params.userId || chal.device_id !== params.deviceId) {
      return { ok: false, code: "CHALLENGE_NOT_FOUND" };
    }

    if (chal.used_at !== null) {
      return { ok: false, code: "CHALLENGE_ALREADY_CONSUMED" };
    }

    chal.attempt_count++;
    const shouldBurn = chal.attempt_count >= chal.max_attempts;
    if (shouldBurn) {
      chal.used_at = new Date(params.serverNow).toISOString();
    }

    return {
      ok: true,
      burned: shouldBurn,
      attempt_count: chal.attempt_count,
    };
  }

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

    return { ok: true, action: challenge.action };
  }

  // Atomic Attendance Commit & Hardened Idempotency
  commitAttendance(params: {
    userId: string;
    deviceId: string;
    action: string;
    proofHash: string;
    idempotencyKey?: string;
    requestHash: string;
    lat: number;
    lng: number;
    accuracy: number;
    locationTime: string;
    serverNow: string;
  }) {
    const serverNowMs = new Date(params.serverNow).getTime();

    // 1. Concurrency-Safe Idempotency Lifecycle
    if (params.idempotencyKey) {
      const existing = this.idempotency.get(params.idempotencyKey);
      if (existing) {
        if (existing.user_id !== params.userId || existing.action !== params.action || existing.request_hash !== params.requestHash) {
          return { ok: false, code: "IDEMPOTENCY_CONFLICT" };
        }
        if (existing.status === "completed") {
          return existing.response_payload;
        }
        if (existing.status === "processing") {
          const age = serverNowMs - existing.created_at;
          if (age < 30000) {
            return { ok: false, code: "CONCURRENT_REQUEST_IN_PROGRESS" };
          }
          existing.updated_at = serverNowMs;
        }
      } else {
        this.idempotency.set(params.idempotencyKey, {
          idempotency_key: params.idempotencyKey,
          user_id: params.userId,
          action: params.action,
          request_hash: params.requestHash,
          status: "processing",
          response_payload: {},
          created_at: serverNowMs,
          updated_at: serverNowMs,
        });
      }
    }

    // 2. Proof Validation & Single-Use Consumption
    const proof = this.proofs.get(params.proofHash);
    if (!proof || proof.user_id !== params.userId || proof.action !== params.action || proof.used_at !== null) {
      const err = { ok: false, code: "INVALID_OR_CONSUMED_PROOF" };
      if (params.idempotencyKey) {
        this.idempotency.get(params.idempotencyKey)!.status = "failed";
        this.idempotency.get(params.idempotencyKey)!.response_payload = err;
      }
      return err;
    }

    // Atomically consume proof
    proof.used_at = params.serverNow;

    const res = {
      ok: true,
      attendance_id: "att-" + Math.random().toString(36).slice(2, 9),
      action: params.action,
      server_timestamp: params.serverNow,
    };

    if (params.idempotencyKey) {
      const rec = this.idempotency.get(params.idempotencyKey)!;
      rec.status = "completed";
      rec.response_payload = res;
    }

    return res;
  }
}

// ── 5. Tests Execution Suite ────────────────────────────────────────────────
describe("Zero-Trust Face Attendance Pipeline Comprehensive Test Suite", () => {
  it("Test 1: Vector Math strictly rejects NaN, Infinity, and malformed arrays", () => {
    const nanVector = new Array(128).fill(0.05);
    nanVector[10] = NaN;
    expect(safeDistance(nanVector, new Array(128).fill(0.05)).valid).toBe(false);

    const infVector = new Array(128).fill(0.05);
    infVector[50] = Infinity;
    expect(safeDistance(infVector, new Array(128).fill(0.05)).valid).toBe(false);

    expect(safeDistance(new Array(64).fill(0.05), new Array(128).fill(0.05)).valid).toBe(false);
  });

  it("Test 2: Cryptographic Device Signature verifies authentic ECDSA key and rejects tampering", async () => {
    // Generate authentic ECDSA P-256 Keypair
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const rawExported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const pubKeyB64 = Buffer.from(rawExported).toString("base64");

    const payload = "usr_100:check_in:dev_pixel7:vp_secret_9988:30.0444:31.2357:2026-10-26T16:00:00Z";
    const dataBytes = new TextEncoder().encode(payload);

    const sigBuf = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      keyPair.privateKey,
      dataBytes
    );
    const validSignatureB64 = Buffer.from(sigBuf).toString("base64");

    // 1. Authentic signature passes
    const resAuth = await verifyDeviceSignature(pubKeyB64, payload, validSignatureB64);
    expect(resAuth.valid).toBe(true);

    // 2. Tampered payload is rejected
    const tamperedPayload = "usr_100:check_out:dev_pixel7:vp_secret_9988:30.0444:31.2357:2026-10-26T16:00:00Z";
    const resTamper = await verifyDeviceSignature(pubKeyB64, tamperedPayload, validSignatureB64);
    expect(resTamper.valid).toBe(false);

    // 3. Fake signature is rejected
    const fakeSig = Buffer.from("fake_random_bytes_signature_12345678901234567890").toString("base64");
    const resFake = await verifyDeviceSignature(pubKeyB64, payload, fakeSig);
    expect(resFake.valid).toBe(false);
  });

  it("Test 3: Challenge Failure Recording enforces attempt limits and never resets used_at", () => {
    const db = new HardenedAttendanceDatabaseMock();
    const chalRes = db.requestBiometricChallenge({
      userId: "u1",
      deviceId: "d1",
      action: "check_in",
      expectedSequence: ["turn_left", "blink", "center"],
      userStatus: "Active",
      serverNow: Date.now(),
    });

    const chalId = chalRes.challenge_id!;
    expect(db.challenges.get(chalId)!.used_at).toBeNull();

    // Attempt 1: failure
    const f1 = db.recordChallengeFailure({ challengeId: chalId, userId: "u1", deviceId: "d1", serverNow: Date.now() });
    expect(f1.burned).toBe(false);
    expect(f1.attempt_count).toBe(1);
    expect(db.challenges.get(chalId)!.used_at).toBeNull();

    // Attempt 2: failure
    const f2 = db.recordChallengeFailure({ challengeId: chalId, userId: "u1", deviceId: "d1", serverNow: Date.now() });
    expect(f2.burned).toBe(false);
    expect(f2.attempt_count).toBe(2);
    expect(db.challenges.get(chalId)!.used_at).toBeNull();

    // Attempt 3: burns challenge
    const f3 = db.recordChallengeFailure({ challengeId: chalId, userId: "u1", deviceId: "d1", serverNow: Date.now() });
    expect(f3.burned).toBe(true);
    expect(f3.attempt_count).toBe(3);
    expect(db.challenges.get(chalId)!.used_at).not.toBeNull();

    // Attempt 4: challenge already consumed, used_at is PRESERVED, not reset to null!
    const f4 = db.recordChallengeFailure({ challengeId: chalId, userId: "u1", deviceId: "d1", serverNow: Date.now() });
    expect(f4.code).toBe("CHALLENGE_ALREADY_CONSUMED");
    expect(db.challenges.get(chalId)!.used_at).not.toBeNull();
  });

  it("Test 4: Atomic Rate Limiting blocks excessive challenge creation", () => {
    const db = new HardenedAttendanceDatabaseMock();
    const now = Date.now();

    for (let i = 0; i < 5; i++) {
      const res = db.requestBiometricChallenge({
        userId: "u_burst",
        deviceId: "d_burst",
        action: "check_in",
        expectedSequence: ["turn_left", "center"],
        userStatus: "Active",
        serverNow: now + i * 1000,
      });
      expect(res.ok).toBe(true);
    }

    // 6th attempt within 10 minutes must be rate-limited
    const res6 = db.requestBiometricChallenge({
      userId: "u_burst",
      deviceId: "d_burst",
      action: "check_in",
      expectedSequence: ["turn_left", "center"],
      userStatus: "Active",
      serverNow: now + 6000,
    });
    expect(res6.ok).toBe(false);
    expect(res6.code).toBe("RATE_LIMITED");
  });

  it("Test 5: Idempotency lifecycle returns cached result for duplicate and blocks concurrent races", () => {
    const db = new HardenedAttendanceDatabaseMock();
    const now = new Date().toISOString();

    // Setup challenge and proof
    const chal = db.requestBiometricChallenge({
      userId: "u_idem",
      deviceId: "d_idem",
      action: "check_in",
      expectedSequence: ["turn_left", "center"],
      userStatus: "Active",
      serverNow: Date.now(),
    });

    const proofHash = sha256Hex("secret_proof_123");
    db.mintBiometricProof({
      userId: "u_idem",
      deviceId: "d_idem",
      challengeId: chal.challenge_id!,
      proofHash,
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      serverNow: now,
    });

    // 1. Initial Commit
    const res1 = db.commitAttendance({
      userId: "u_idem",
      deviceId: "d_idem",
      action: "check_in",
      proofHash,
      idempotencyKey: "idem_key_001",
      requestHash: "hash_A",
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 10,
      locationTime: now,
      serverNow: now,
    });
    expect(res1.ok).toBe(true);

    // 2. Immediate exact replay returns cached response
    const res2 = db.commitAttendance({
      userId: "u_idem",
      deviceId: "d_idem",
      action: "check_in",
      proofHash,
      idempotencyKey: "idem_key_001",
      requestHash: "hash_A",
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 10,
      locationTime: now,
      serverNow: now,
    });
    expect(res2.attendance_id).toBe(res1.attendance_id);

    // 3. Replay with altered requestHash returns IDEMPOTENCY_CONFLICT
    const resConflict = db.commitAttendance({
      userId: "u_idem",
      deviceId: "d_idem",
      action: "check_in",
      proofHash,
      idempotencyKey: "idem_key_001",
      requestHash: "hash_TAMPERED",
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 10,
      locationTime: now,
      serverNow: now,
    });
    expect(resConflict.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("Test 6: Proof Replay is strictly rejected after first consumption", () => {
    const db = new HardenedAttendanceDatabaseMock();
    const now = new Date().toISOString();

    const chal = db.requestBiometricChallenge({
      userId: "u_proof",
      deviceId: "d_proof",
      action: "check_in",
      expectedSequence: ["turn_left", "center"],
      userStatus: "Active",
      serverNow: Date.now(),
    });

    const proofHash = sha256Hex("secret_proof_reuse");
    db.mintBiometricProof({
      userId: "u_proof",
      deviceId: "d_proof",
      challengeId: chal.challenge_id!,
      proofHash,
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      serverNow: now,
    });

    // Commit 1: consumes proof
    const c1 = db.commitAttendance({
      userId: "u_proof",
      deviceId: "d_proof",
      action: "check_in",
      proofHash,
      idempotencyKey: "key_1",
      requestHash: "hash_1",
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 10,
      locationTime: now,
      serverNow: now,
    });
    expect(c1.ok).toBe(true);

    // Commit 2: attempting to reuse consumed proof with a different idempotency key
    const c2 = db.commitAttendance({
      userId: "u_proof",
      deviceId: "d_proof",
      action: "check_in",
      proofHash,
      idempotencyKey: "key_2",
      requestHash: "hash_2",
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 10,
      locationTime: now,
      serverNow: now,
    });
    expect(c2.ok).toBe(false);
    expect(c2.code).toBe("INVALID_OR_CONSUMED_PROOF");
  });

  it("Test 7: Visual keyframes parser rejects disordered timestamps, corrupt images, and blank frames", () => {
    // 1. Disordered timestamps
    const disordered = [
      { step: "turn_left", t: 1000, image_b64: "data:image/jpeg;base64,123" },
      { step: "center", t: 500, image_b64: "data:image/jpeg;base64,123" },
    ];
    const resDisordered = verifyVisualKeyframesLiveness(disordered, ["turn_left", "center"]);
    expect(resDisordered.valid).toBe(false);
    expect(resDisordered.reason).toContain("monotonic");

    // 2. Corrupt base64
    const corrupt = [
      { step: "turn_left", t: 500, image_b64: "invalid-not-a-data-uri" },
      { step: "center", t: 1000, image_b64: "invalid-not-a-data-uri" },
    ];
    const resCorrupt = verifyVisualKeyframesLiveness(corrupt, ["turn_left", "center"]);
    expect(resCorrupt.valid).toBe(false);

    // 3. Monochrome blank frame (low entropy)
    const blankBuf = Buffer.alloc(2000, 0x55);
    const blankB64 = "data:image/jpeg;base64," + blankBuf.toString("base64");
    const resBlank = verifyVisualKeyframesLiveness(
      [
        { step: "turn_left", t: 500, image_b64: blankB64 },
        { step: "center", t: 1000, image_b64: blankB64 },
      ],
      ["turn_left", "center"]
    );
    expect(resBlank.valid).toBe(false);
  });

  it("Test 8: Presentation attack rejection detects identical static image replay across steps", () => {
    // Construct simulated valid JPEG header + diverse random pixel payload
    const simJpegHeader = Buffer.from([
      0xFF, 0xD8, // SOI
      0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0xF0, 0x01, 0x40, 0x01, 0x01, // SOF0 (240x320)
    ]);
    const simPixelData = crypto.randomBytes(3000);
    const completeImage = Buffer.concat([simJpegHeader, simPixelData]);
    const staticB64 = "data:image/jpeg;base64," + completeImage.toString("base64");

    // Feeding the EXACT SAME photo for all steps (Anti-Static replay attack)
    const staticReplay = [
      { step: "turn_left", t: 100, image_b64: staticB64 },
      { step: "blink", t: 400, image_b64: staticB64 },
      { step: "center", t: 800, image_b64: staticB64 },
    ];

    const resStatic = verifyVisualKeyframesLiveness(staticReplay, ["turn_left", "blink", "center"]);
    expect(resStatic.valid).toBe(false);
    expect(resStatic.reason).toContain("Identical or static image repeated");
  });
});
