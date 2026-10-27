/**
 * FaceChallengeCapture.tsx
 *
 * Server-driven biometric verification UI.
 *
 * Flow:
 *   1. On mount → call beginVerification() → get challenge_id + expected_sequence
 *   2. Walk user through each pose step in order
 *   3. At each step: wait for face detected → capture JPEG keyframe → record timestamp
 *   4. After all poses → extract 128-d descriptor from final frame
 *   5. Call verifyFaceChallenge() → server validates liveness + face match
 *   6. Return verification_proof to parent
 *
 * What runs LOCALLY (client):
 *   - Camera rendering
 *   - Face detection gate (TinyFaceDetector, no descriptor yet)
 *   - JPEG keyframe capture
 *   - Descriptor extraction for the FINAL pose only (float32[128])
 *
 * What runs SERVER-SIDE (Edge Function):
 *   - Liveness validation (binary headers, entropy, optical delta)
 *   - Face matching against enrolled template
 *   - Proof minting
 *   - Rate limiting, challenge burning
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Loader2, X, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import {
  beginVerification,
  verifyFaceChallenge,
  captureKeyframe,
  validateDescriptor,
  poseLabel,
  makeIdempotencyKey,
  BiometricApiError,
  type AttendanceAction,
  type VisualKeyframe,
  type ChallengeResponse,
} from "@/lib/biometric-challenge";

// Lazy-load face-api.js (1MB+) only when camera opens
let faceApiPromise: Promise<typeof import("face-api.js")> | null = null;
function loadFaceApi() {
  if (!faceApiPromise) faceApiPromise = import("face-api.js");
  return faceApiPromise;
}

let modelsLoaded = false;
async function ensureModels(faceapi: typeof import("face-api.js")) {
  if (modelsLoaded) return;
  const url = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(url),
    faceapi.nets.faceLandmark68Net.loadFromUri(url),
    faceapi.nets.faceRecognitionNet.loadFromUri(url),
  ]);
  modelsLoaded = true;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage =
  | "loading"         // loading models + requesting challenge
  | "challenge_error" // beginVerification failed
  | "pose"            // waiting for user to perform current pose
  | "capturing"       // face detected, about to snap keyframe (1s hold)
  | "sending"         // submitting to Edge Function
  | "success"
  | "error";

export type FaceChallengeResult = {
  verification_proof: string;
  expires_at: string;
};

interface Props {
  action: AttendanceAction;
  deviceId: string;
  snapshotLat?: number | null;
  snapshotLng?: number | null;
  snapshotAccuracyM?: number | null;
  onSuccess: (result: FaceChallengeResult) => void;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FaceChallengeCapture({
  action,
  deviceId,
  snapshotLat,
  snapshotLng,
  snapshotAccuracyM,
  onSuccess,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const loopRef = useRef(false);

  const [stage, setStage] = useState<Stage>("loading");
  const [statusMsg, setStatusMsg] = useState("Requesting secure challenge…");
  const [faceDetected, setFaceDetected] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [keyframes, setKeyframes] = useState<VisualKeyframe[]>([]);
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Camera cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loopRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Initialise: load models + start camera + request challenge ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Start camera
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not available. Open this page in a secure browser tab.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // 2. Load face-api models in parallel with challenge request
        const faceapi = await loadFaceApi();
        const [_, chal] = await Promise.all([
          ensureModels(faceapi),
          beginVerification(action, deviceId),
        ]);

        if (!mountedRef.current || cancelled) return;
        setChallenge(chal);
        setPoseIndex(0);
        setKeyframes([]);
        setStage("pose");
        setStatusMsg(`Step 1 of ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[0])}`);
        startDetectionLoop(faceapi, chal, 0, []);
      } catch (e: any) {
        if (!mountedRef.current || cancelled) return;
        const msg = e instanceof BiometricApiError
          ? e.message
          : (e?.message ?? "Initialisation failed");
        setStage("challenge_error");
        setErrorMsg(msg);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detection loop — runs for each pose step ─────────────────────────────────
  function startDetectionLoop(
    faceapi: typeof import("face-api.js"),
    chal: ChallengeResponse,
    idx: number,
    collectedFrames: VisualKeyframe[],
  ) {
    loopRef.current = true;
    let holdStart: number | null = null;
    const HOLD_MS = 900; // ms face must stay detected before we snap

    async function tick(now: number) {
      if (!loopRef.current || !mountedRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused) {
        requestAnimationFrame(tick);
        return;
      }

      try {
        const det = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
          .withFaceLandmarks();

        if (!mountedRef.current || !loopRef.current) return;

        if (det) {
          setFaceDetected(true);
          if (holdStart === null) holdStart = now;
          const elapsed = now - holdStart;
          const remaining = Math.max(0, HOLD_MS - elapsed);
          setCaptureCountdown(Math.ceil(remaining / 1000) || null);

          if (elapsed >= HOLD_MS) {
            // Snap this pose
            loopRef.current = false;
            setCaptureCountdown(null);
            setStage("capturing");
            await snapPoseAndAdvance(faceapi, chal, idx, collectedFrames);
            return;
          }
        } else {
          setFaceDetected(false);
          holdStart = null;
          setCaptureCountdown(null);
        }
      } catch {
        // Non-fatal frame error — continue
      }

      if (loopRef.current && mountedRef.current) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  // ── Snap a keyframe for the current pose, then advance or submit ────────────
  async function snapPoseAndAdvance(
    faceapi: typeof import("face-api.js"),
    chal: ChallengeResponse,
    idx: number,
    collectedFrames: VisualKeyframe[],
  ) {
    if (!videoRef.current || !mountedRef.current) return;

    const step = chal.expected_sequence[idx];
    const image_b64 = captureKeyframe(videoRef.current);
    const frame: VisualKeyframe = { step, t: Date.now(), image_b64 };
    const newFrames = [...collectedFrames, frame];
    setKeyframes(newFrames);

    const nextIdx = idx + 1;
    const isLast = nextIdx >= chal.expected_sequence.length;

    if (!isLast) {
      // Move to next pose
      setPoseIndex(nextIdx);
      setFaceDetected(false);
      setStage("pose");
      setStatusMsg(`Step ${nextIdx + 1} of ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[nextIdx])}`);
      startDetectionLoop(faceapi, chal, nextIdx, newFrames);
    } else {
      // All poses captured — extract descriptor and submit
      await submitToServer(faceapi, chal, newFrames);
    }
  }

  // ── Final step: extract descriptor + call Edge Function ────────────────────
  async function submitToServer(
    faceapi: typeof import("face-api.js"),
    chal: ChallengeResponse,
    frames: VisualKeyframe[],
  ) {
    if (!videoRef.current || !mountedRef.current) return;

    setStage("sending");
    setStatusMsg("Verifying with secure server…");

    try {
      // Extract descriptor from the current (final) frame
      const det = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det || !mountedRef.current) {
        setStage("error");
        setErrorMsg("Face lost during final capture. Please try again.");
        return;
      }

      const descriptor = Array.from(det.descriptor);
      if (!validateDescriptor(descriptor)) {
        setStage("error");
        setErrorMsg("Invalid face descriptor. Please try again in better lighting.");
        return;
      }

      // Submit ALL evidence to Edge Function — server does liveness + matching
      const result = await verifyFaceChallenge({
        challenge_id: chal.challenge_id,
        device_id: deviceId,
        descriptor,
        visual_keyframes: frames,
        snapshot_lat: snapshotLat ?? null,
        snapshot_lng: snapshotLng ?? null,
        snapshot_accuracy_m: snapshotAccuracyM ?? null,
      });

      if (!mountedRef.current) return;
      setStage("success");
      setStatusMsg("Verification complete!");
      // Notify parent after brief success flash
      setTimeout(() => {
        if (mountedRef.current) onSuccess(result);
      }, 700);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setStage("error");
      setErrorMsg(
        e instanceof BiometricApiError
          ? e.message
          : (e?.message ?? "Verification failed. Please try again."),
      );
    }
  }

  // ── Retry ────────────────────────────────────────────────────────────────────
  function retry() {
    setStage("loading");
    setErrorMsg(null);
    setKeyframes([]);
    setPoseIndex(0);
    setFaceDetected(false);
    setChallenge(null);
    setStatusMsg("Requesting secure challenge…");
    // Re-run init effect by forcing a re-mount isn't clean — instead call init inline
    loadFaceApi().then(async (faceapi) => {
      try {
        await ensureModels(faceapi);
        const chal = await beginVerification(action, deviceId);
        if (!mountedRef.current) return;
        setChallenge(chal);
        setPoseIndex(0);
        setStage("pose");
        setStatusMsg(`Step 1 of ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[0])}`);
        startDetectionLoop(faceapi, chal, 0, []);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setStage("challenge_error");
        setErrorMsg(e?.message ?? "Failed to request challenge");
      }
    });
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const seq = challenge?.expected_sequence ?? [];
  const totalPoses = seq.length;
  const currentPose = seq[poseIndex] ?? "";

  const ovalColor =
    stage === "success"
      ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)] bg-emerald-500/10"
      : stage === "capturing"
      ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
      : faceDetected
      ? "border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]"
      : "border-white/30 border-dashed";

  return (
    <div
      translate="no"
      className="notranslate fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 px-4 pb-4 md:items-center backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl border border-border"
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Face verification</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <ShieldCheck className="h-3 w-3" /> Server-verified
            </span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress dots */}
        {totalPoses > 0 && (
          <div className="mb-3 flex justify-center gap-1.5">
            {seq.map((step, i) => (
              <div
                key={step}
                className={`h-1.5 w-6 rounded-full transition-all ${
                  i < poseIndex
                    ? "bg-emerald-500"
                    : i === poseIndex
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {/* Video + oval overlay */}
        <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3] flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover transform -scale-x-100"
          />

          {/* Oval face guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={`w-44 h-56 rounded-[50%] border-2 transition-all duration-300 ${ovalColor}`} />
          </div>

          {/* Status pill */}
          <div className="absolute bottom-3 inset-x-3 flex justify-center pointer-events-none">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md px-3 py-1.5 text-xs text-white shadow-lg">
              {stage === "success" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span className="font-semibold text-emerald-300">Verified!</span>
                </>
              ) : stage === "error" || stage === "challenge_error" ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="font-semibold text-red-300">Failed</span>
                </>
              ) : stage === "sending" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Verifying on server…</span>
                </>
              ) : stage === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading…</span>
                </>
              ) : captureCountdown !== null ? (
                <>
                  <Camera className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                  <span className="font-semibold text-amber-200">Hold still…</span>
                </>
              ) : faceDetected ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary animate-pulse" />
                  <span>{poseLabel(currentPose)}</span>
                </>
              ) : (
                <span>Position face in the oval</span>
              )}
            </div>
          </div>
        </div>

        {/* Status text */}
        <p className="mt-3 min-h-[2.2em] text-xs text-muted-foreground text-center">
          {errorMsg ?? statusMsg}
        </p>

        {/* Retry on error */}
        {(stage === "error" || stage === "challenge_error") && (
          <button
            onClick={retry}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand"
          >
            <Camera className="h-4 w-4" /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
