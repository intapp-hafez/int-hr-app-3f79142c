// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

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

const FACE_THRESHOLD = 0.5;

async function sha256Hex(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Image Header & Binary Parser ───────────────────────────────────────────
function parseAndValidateImage(bytes: Uint8Array): { valid: boolean; width?: number; height?: number; error?: string } {
  if (bytes.length < 500) {
    return { valid: false, error: "Image payload too small to be a valid photograph." };
  }

  // 1. JPEG (0xFF, 0xD8)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        if (width < 120 || height < 120) {
          return { valid: false, error: `Image resolution too small (${width}x${height}). Minimum 120x120 required.` };
        }
        return { valid: true, width, height };
      }
      if (offset + 3 >= bytes.length) break;
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + length;
    }
    return { valid: true, width: 320, height: 240 };
  }

  // 2. WebP (RIFF .... WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { valid: true, width: 320, height: 240 };
  }

  // 3. PNG (\x89PNG\r\n\x1a\n)
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

// ── Server-Side Visual Keyframe Liveness & Optical Variance ─────────────────
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
      return { valid: false, reason: `Keyframe timestamps must be strictly monotonic ascending numbers.` };
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
      const binaryString = atob(match[2]);
      if (binaryString.length < 1500 || binaryString.length > 500000) {
        return { valid: false, reason: `Image size for step ${expectedStep} out of realistic bounds (${binaryString.length} bytes).` };
      }

      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      // Check header validity
      const imgValidation = parseAndValidateImage(bytes);
      if (!imgValidation.valid) {
        return { valid: false, reason: `Image header validation failed for step ${expectedStep}: ${imgValidation.error}` };
      }

      // Check photographic entropy
      const { entropy, variance } = calculateByteEntropyAndVariance(bytes);
      if (entropy < 3.5 || variance < 100) {
        return { valid: false, reason: `Image for step ${expectedStep} lacks optical entropy (blank, monochrome, or dummy image).` };
      }

      decodedBuffers.push(bytes);
    } catch {
      return { valid: false, reason: `Failed to decode base64 binary for step ${expectedStep}.` };
    }
  }

  // Cross-frame motion variance check: reject static identical replay
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
    if (diffRatio < 0.05) {
      staticCount++;
    }
  }

  if (staticCount >= decodedBuffers.length - 1) {
    return {
      valid: false,
      reason: "Identical or static image repeated across challenge steps. Presentation attack rejected.",
    };
  }

  return { valid: true };
}

// ── Cryptographic Asymmetric Device Signature Verification ─────────────────
async function verifyDeviceSignature(
  publicKeyStr: string,
  dataString: string,
  signatureB64: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const dataBytes = new TextEncoder().encode(dataString);
    const sigBinary = atob(signatureB64);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);

    let cleanKey = publicKeyStr
      .replace(/-----BEGIN [A-Z ]+-----/g, "")
      .replace(/-----END [A-Z ]+-----/g, "")
      .replace(/\s+/g, "");

    const keyBinary = atob(cleanKey);
    const keyBytes = new Uint8Array(keyBinary.length);
    for (let i = 0; i < keyBinary.length; i++) keyBytes[i] = keyBinary.charCodeAt(i);

    let key: CryptoKey | null = null;
    let hashAlgorithm: any = { name: "ECDSA", hash: { name: "SHA-256" } };

    // 1. Try ECDSA P-256 SPKI
    try {
      key = await crypto.subtle.importKey(
        "spki",
        keyBytes,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );
      hashAlgorithm = { name: "ECDSA", hash: { name: "SHA-256" } };
    } catch {
      // 2. Try RSA-PSS
      try {
        key = await crypto.subtle.importKey(
          "spki",
          keyBytes,
          { name: "RSA-PSS", hash: "SHA-256" },
          false,
          ["verify"]
        );
        hashAlgorithm = { name: "RSA-PSS", saltLength: 32 };
      } catch {
        // 3. Try RSASSA-PKCS1-v1_5
        key = await crypto.subtle.importKey(
          "spki",
          keyBytes,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"]
        );
        hashAlgorithm = "RSASSA-PKCS1-v1_5";
      }
    }

    if (!key) {
      return { valid: false, reason: "Unsupported or unparseable public key format." };
    }

    const isValid = await crypto.subtle.verify(
      hashAlgorithm,
      key,
      sigBytes,
      dataBytes
    );

    return { valid: isValid, reason: isValid ? undefined : "Signature mismatch." };
  } catch (err: any) {
    return { valid: false, reason: err?.message || "Cryptographic verification failure." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { ok: false, error: "Server missing Supabase service configuration" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const action = body.action;

    // Fail-Closed user authentication extraction
    async function getAuthenticatedUser() {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return { user: null, error: "MISSING_TOKEN" };
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !user) return { user: null, error: "INVALID_TOKEN" };

      return { user, error: null };
    }

    // ── 1. BEGIN-VERIFICATION ──────────────────────────────────────────────
    if (action === "begin-verification") {
      const authRes = await getAuthenticatedUser();
      if (authRes.error || !authRes.user) {
        return json(401, {
          ok: false,
          code: authRes.error || "UNAUTHORIZED",
          error: "Authentication failed or token invalid.",
        });
      }
      const user = authRes.user;

      const reqAction = body.request_action;
      const deviceId = String(body.device_id || "").trim();

      if (reqAction !== "check_in" && reqAction !== "check_out") {
        return json(400, { ok: false, code: "INVALID_ACTION", error: "Must specify check_in or check_out." });
      }
      if (!deviceId) {
        return json(400, { ok: false, code: "MISSING_DEVICE", error: "device_id is required." });
      }

      // Unpredictable active pose sequence
      const randomSequences = [
        ["turn_left", "blink", "center"],
        ["turn_right", "blink", "center"],
        ["blink", "turn_left", "center"],
        ["blink", "turn_right", "center"],
      ];
      const sequence = randomSequences[Math.floor(Math.random() * randomSequences.length)];

      // ATOMIC CHALLENGE REQUEST (Rate-limiting, Device Check & Account check in ONE transaction)
      const { data: chalRes, error: chalErr } = await supabaseAdmin.rpc("request_biometric_challenge", {
        p_user_id: user.id,
        p_device_id: deviceId,
        p_action: reqAction,
        p_expected_sequence: sequence,
        p_expires_in_seconds: 45,
      });

      if (chalErr) {
        return json(500, { ok: false, code: "DB_ERROR", error: chalErr.message });
      }

      if (!chalRes?.ok) {
        const statusCode = chalRes?.code === "RATE_LIMITED"
          ? 429
          : chalRes?.code === "ACCOUNT_NOT_ACTIVE"
          ? 401
          : chalRes?.code === "DEVICE_NOT_APPROVED" || chalRes?.code === "DEVICE_NOT_REGISTERED"
          ? 403
          : 400;
        return json(statusCode, chalRes);
      }

      return json(200, chalRes);
    }

    // ── 2. VERIFY-FACE ─────────────────────────────────────────────────────
    if (action === "verify-face") {
      const authRes = await getAuthenticatedUser();
      if (authRes.error || !authRes.user) {
        return json(401, {
          ok: false,
          code: authRes.error || "UNAUTHORIZED",
          error: "Authentication failed or token invalid.",
        });
      }
      const user = authRes.user;

      const challengeId = body.challenge_id;
      const deviceId = String(body.device_id || "").trim();
      const descriptor = body.descriptor;
      const visualKeyframes = body.visual_keyframes;

      // 1. Fetch active challenge
      const { data: challenge, error: chalErr } = await supabaseAdmin
        .from("biometric_challenges")
        .select("*")
        .eq("id", challengeId)
        .eq("user_id", user.id)
        .eq("device_id", deviceId)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (chalErr || !challenge) {
        return json(409, {
          ok: false,
          code: "CHALLENGE_INVALID_OR_CONSUMED",
          error: "Challenge is invalid, expired, device mismatched, or already consumed.",
        });
      }

      // Atomic helper to record failed attempt and never reset used_at
      async function recordFailureAndReturn(reason: string, code: string, status = 400) {
        const { data: failRes } = await supabaseAdmin.rpc("record_challenge_failure", {
          p_challenge_id: challenge.id,
          p_user_id: user.id,
          p_device_id: deviceId,
          p_reason: reason,
          p_code: code,
        });

        if (failRes?.burned) {
          return json(429, {
            ok: false,
            code: "MAX_ATTEMPTS_EXCEEDED",
            error: "Maximum matching attempts exceeded. Challenge permanently revoked.",
          });
        }
        return json(status, { ok: false, code, error: reason });
      }

      // 2. Evaluate Server-Side Visual Keyframe Liveness (Binary image inspection & Optical motion)
      const visualLiveness = verifyVisualKeyframesLiveness(visualKeyframes, challenge.expected_sequence);
      if (!visualLiveness.valid) {
        return await recordFailureAndReturn(`Visual Liveness Rejected: ${visualLiveness.reason}`, "LIVENESS_FAILED", 400);
      }

      // 3. Fetch Enrolled Face Template
      const { data: faceRow, error: faceErr } = await supabaseAdmin
        .from("face_descriptors")
        .select("descriptor")
        .eq("user_id", user.id)
        .maybeSingle();

      if (faceErr || !faceRow?.descriptor) {
        return json(404, { ok: false, code: "TEMPLATE_NOT_ENROLLED", error: "Face template not enrolled." });
      }

      // 4. Safe Vector Validation & Distance Calculation (Anti-NaN)
      const matchResult = safeDistance(faceRow.descriptor, descriptor);
      if (!matchResult.valid) {
        return await recordFailureAndReturn(matchResult.error || "Invalid descriptor", "INVALID_DESCRIPTOR", 400);
      }

      if (matchResult.dist > FACE_THRESHOLD) {
        return await recordFailureAndReturn("Face did not match enrolled template", "FACE_MISMATCH", 403);
      }

      // 5. ATOMIC CHALLENGE CONSUMPTION & PROOF MINTING
      const randomBytes = crypto.getRandomValues(new Uint8Array(24));
      const proofSecret = "vp_" + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const proofHash = await sha256Hex(proofSecret);
      const proofExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      const { data: mintRes, error: mintErr } = await supabaseAdmin.rpc("mint_biometric_proof", {
        p_user_id: user.id,
        p_device_id: deviceId,
        p_challenge_id: challenge.id,
        p_proof_hash: proofHash,
        p_expires_at: proofExpiresAt,
      });

      if (mintErr || !mintRes?.ok) {
        return json(409, {
          ok: false,
          code: mintRes?.code || "MINT_PROOF_FAILED",
          error: mintRes?.message || mintErr?.message || "Failed to atomically consume challenge and mint proof.",
        });
      }

      return json(200, {
        ok: true,
        verification_proof: proofSecret,
        expires_at: proofExpiresAt,
      });
    }

    // ── 3. COMMIT-ATTENDANCE ───────────────────────────────────────────────
    if (action === "commit-attendance") {
      const authRes = await getAuthenticatedUser();
      if (authRes.error || !authRes.user) {
        return json(401, {
          ok: false,
          code: authRes.error || "UNAUTHORIZED",
          error: "Authentication failed or token invalid.",
        });
      }
      const user = authRes.user;

      const reqAction = body.request_action;
      const proofSecret = String(body.verification_proof || "").trim();
      const deviceId = String(body.device_id || "").trim();
      const deviceSignature = body.device_signature;
      const idempotencyKey = String(body.idempotency_key || "").trim();
      const location = body.location;

      if (!proofSecret || !deviceId || !reqAction || !location) {
        return json(400, { ok: false, code: "INVALID_PAYLOAD", error: "Missing required attendance parameters." });
      }

      // 1. Cryptographic Device Possession Verification
      const { data: devRow, error: devErr } = await supabaseAdmin
        .from("employee_devices")
        .select("status, public_key")
        .eq("id", deviceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (devErr) {
        return json(500, { ok: false, code: "DB_ERROR_DEVICE", error: "Failed to evaluate device status." });
      }

      if (devRow?.public_key) {
        if (!deviceSignature) {
          return json(403, {
            ok: false,
            code: "DEVICE_SIGNATURE_REQUIRED",
            error: "Cryptographic device possession signature is required for this registered device.",
          });
        }

        // Canonical payload bound to user, action, device, proof, and location
        const canonicalPayload = `${user.id}:${reqAction}:${deviceId}:${proofSecret}:${location.lat}:${location.lng}:${location.captured_at}`;
        const sigVerify = await verifyDeviceSignature(devRow.public_key, canonicalPayload, String(deviceSignature));

        if (!sigVerify.valid) {
          return json(403, {
            ok: false,
            code: "DEVICE_SIGNATURE_INVALID",
            error: `Invalid cryptographic device signature: ${sigVerify.reason}`,
          });
        }
      }

      const proofHash = await sha256Hex(proofSecret);
      // Canonical request hash for idempotency integrity
      const requestHash = await sha256Hex(
        `${user.id}:${reqAction}:${deviceId}:${proofHash}:${location.lat}:${location.lng}:${location.accuracy_meters}:${location.captured_at}`
      );

      // Invoke Atomic Database Function (Pre-claims idempotency & commits attendance)
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("commit_biometric_attendance", {
        p_user_id: user.id,
        p_device_id: deviceId,
        p_action: reqAction,
        p_proof_hash: proofHash,
        p_idempotency_key: idempotencyKey || null,
        p_request_hash: requestHash,
        p_lat: location.lat,
        p_lng: location.lng,
        p_accuracy: location.accuracy_meters,
        p_location_time: location.captured_at,
      });

      if (rpcErr) {
        return json(500, { ok: false, code: "RPC_ERROR", error: rpcErr.message });
      }

      if (!rpcRes?.ok) {
        const statusCode = rpcRes?.code === "IDEMPOTENCY_CONFLICT" || rpcRes?.code === "CONCURRENT_REQUEST_IN_PROGRESS"
          ? 409
          : rpcRes?.code === "STALE_LOCATION" || rpcRes?.code === "LOW_ACCURACY_LOCATION" || rpcRes?.code === "INVALID_COORDINATES"
          ? 400
          : rpcRes?.code === "DEVICE_NOT_APPROVED" || rpcRes?.code === "GEOFENCE_VIOLATION" || rpcRes?.code === "NO_ASSIGNED_GEOFENCE"
          ? 403
          : rpcRes?.code === "INVALID_OR_CONSUMED_PROOF"
          ? 409
          : 400;
        return json(statusCode, rpcRes);
      }

      return json(200, rpcRes);
    }

    // ── 4. FACE-LOGIN (DISCONTINUED / STRICTLY DISABLED) ──────────────────
    if (action === "face-login") {
      return json(403, {
        ok: false,
        code: "PASSWORDLESS_FACE_LOGIN_DEPRECATED",
        error: "Direct passwordless face login is disabled. All face verification must proceed through server-driven challenge-response.",
      });
    }

    return json(400, { ok: false, error: "Unknown action" });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal server error" });
  }
});
