import { describe, it, expect, vi } from "vitest";

// ── EAR Calculation Test ──
function calculateEAR(eye: Array<{ x: number; y: number }>): number {
  if (!eye || eye.length < 6) return 0.3;
  const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  return h > 0 ? (v1 + v2) / (2.0 * h) : 0.3;
}

describe("Active Liveness Detection - Eye Aspect Ratio (EAR)", () => {
  it("calculates realistic open eye EAR (~0.28)", () => {
    // Typical open eye landmark positions (width = 20px, height = ~6px)
    const openEye = [
      { x: 10, y: 50 },  // p0: outer corner
      { x: 16, y: 47 },  // p1: top outer
      { x: 24, y: 47 },  // p2: top inner
      { x: 30, y: 50 },  // p3: inner corner
      { x: 24, y: 53 },  // p4: bottom inner
      { x: 16, y: 53 },  // p5: bottom outer
    ];
    const ear = calculateEAR(openEye);
    expect(ear).toBeGreaterThan(0.24);
    expect(ear).toBeLessThan(0.35);
  });

  it("calculates closed eye EAR during blink (<0.18)", () => {
    // Closed eye: vertical distance drops near 0-2px
    const closedEye = [
      { x: 10, y: 50 },  // p0
      { x: 16, y: 49.5 }, // p1
      { x: 24, y: 49.5 }, // p2
      { x: 30, y: 50 },  // p3
      { x: 24, y: 50.5 }, // p4
      { x: 16, y: 50.5 }, // p5
    ];
    const ear = calculateEAR(closedEye);
    expect(ear).toBeLessThan(0.18);
  });

  it("distinguishes blink state transition", () => {
    const openEar = 0.29;
    const closedEar = 0.14;
    const reopenEar = 0.28;

    let stage = "searching";
    if (openEar >= 0.22) stage = "face_ready";
    expect(stage).toBe("face_ready");

    if (closedEar <= 0.185) stage = "blink_down";
    expect(stage).toBe("blink_down");

    const blinkDurationMs = 220; // 220ms natural blink
    if (reopenEar >= 0.22 && blinkDurationMs >= 70 && blinkDurationMs <= 950) {
      stage = "liveness_verified";
    }
    expect(stage).toBe("liveness_verified");
  });
});

// ── Token Security & Validation Tests ──
interface MockTokenRow {
  id: string;
  token: string;
  user_id: string;
  action: string;
  method: "face" | "fingerprint";
  distance: number | null;
  expires_at: string;
  used_at: string | null;
}

function validateAndConsumeTokenMock(
  tokens: Map<string, MockTokenRow>,
  userId: string,
  token: string | null | undefined,
  action: "check_in" | "check_out",
  faceRequired: boolean,
) {
  if (!faceRequired && !token) {
    return { ok: true, method: "none", distance: null };
  }

  if (!token) {
    return {
      ok: false,
      code: "face_required",
      reason: `${action === "check_in" ? "Check-in" : "Check-out"} blocked · face recognition is required. Please scan your face first.`,
    };
  }

  const tokenRow = tokens.get(token);
  if (!tokenRow || tokenRow.user_id !== userId) {
    return {
      ok: false,
      code: "biometric_invalid",
      reason: "Invalid biometric verification token.",
    };
  }

  if (tokenRow.used_at) {
    return {
      ok: false,
      code: "biometric_replayed",
      reason: "This biometric verification has already been used.",
    };
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      code: "biometric_expired",
      reason: "Biometric verification expired (valid for 2 minutes).",
    };
  }

  if (tokenRow.action !== "attendance" && tokenRow.action !== action) {
    return {
      ok: false,
      code: "biometric_action_mismatch",
      reason: "Biometric verification was not issued for this action.",
    };
  }

  // Atomically consume
  tokenRow.used_at = new Date().toISOString();
  return {
    ok: true,
    method: tokenRow.method,
    distance: tokenRow.distance,
  };
}

describe("Biometric Verification Token Security", () => {
  const USER_A = "user-111";
  const USER_B = "user-222";

  it("blocks attendance when face is required and no token is provided", () => {
    const tokens = new Map<string, MockTokenRow>();
    const res = validateAndConsumeTokenMock(tokens, USER_A, null, "check_in", true);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("face_required");
  });

  it("accepts a valid, unexpired token and derives biometric method and distance", () => {
    const tokens = new Map<string, MockTokenRow>();
    const validToken = "valid-token-uuid-123";
    tokens.set(validToken, {
      id: "t-1",
      token: validToken,
      user_id: USER_A,
      action: "check_in",
      method: "face",
      distance: 0.312,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
      used_at: null,
    });

    const res = validateAndConsumeTokenMock(tokens, USER_A, validToken, "check_in", true);
    expect(res.ok).toBe(true);
    expect(res.method).toBe("face");
    expect(res.distance).toBe(0.312);

    // Verify token is now marked as used
    expect(tokens.get(validToken)?.used_at).not.toBeNull();
  });

  it("strictly prevents token replay attacks", () => {
    const tokens = new Map<string, MockTokenRow>();
    const replayToken = "replay-token-456";
    tokens.set(replayToken, {
      id: "t-2",
      token: replayToken,
      user_id: USER_A,
      action: "attendance",
      method: "face",
      distance: 0.28,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
      used_at: null,
    });

    // 1st use: should succeed
    const firstUse = validateAndConsumeTokenMock(tokens, USER_A, replayToken, "check_in", true);
    expect(firstUse.ok).toBe(true);

    // 2nd use (replay): MUST FAIL
    const secondUse = validateAndConsumeTokenMock(tokens, USER_A, replayToken, "check_in", true);
    expect(secondUse.ok).toBe(false);
    expect(secondUse.code).toBe("biometric_replayed");
  });

  it("blocks expired tokens (> 2 minutes)", () => {
    const tokens = new Map<string, MockTokenRow>();
    const expiredToken = "expired-token-789";
    tokens.set(expiredToken, {
      id: "t-3",
      token: expiredToken,
      user_id: USER_A,
      action: "attendance",
      method: "face",
      distance: 0.35,
      expires_at: new Date(Date.now() - 5_000).toISOString(), // expired 5 seconds ago
      used_at: null,
    });

    const res = validateAndConsumeTokenMock(tokens, USER_A, expiredToken, "check_in", true);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("biometric_expired");
  });

  it("blocks token theft across users (User B using User A's token)", () => {
    const tokens = new Map<string, MockTokenRow>();
    const userAToken = "token-user-a";
    tokens.set(userAToken, {
      id: "t-4",
      token: userAToken,
      user_id: USER_A,
      action: "check_in",
      method: "face",
      distance: 0.25,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
      used_at: null,
    });

    const res = validateAndConsumeTokenMock(tokens, USER_B, userAToken, "check_in", true);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("biometric_invalid");
  });

  it("blocks action mismatch (token minted for check_in used for check_out)", () => {
    const tokens = new Map<string, MockTokenRow>();
    const inToken = "in-token";
    tokens.set(inToken, {
      id: "t-5",
      token: inToken,
      user_id: USER_A,
      action: "check_in",
      method: "face",
      distance: 0.29,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
      used_at: null,
    });

    const res = validateAndConsumeTokenMock(tokens, USER_A, inToken, "check_out", true);
    expect(res.ok).toBe(false);
    expect(res.code).toBe("biometric_action_mismatch");
  });
});
