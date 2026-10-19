import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, ExternalLink, ShieldCheck, CheckCircle2, Eye } from "lucide-react";

type Mode = "enroll" | "verify";

// Lazy-loaded face-api.js so the 1MB+ lib only ships when needed.
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

// Calculate Eye Aspect Ratio (EAR) from 6 landmark points:
// p0: outer corner, p3: inner corner, p1,p5: top/bottom, p2,p4: top/bottom
function calculateEAR(eye: Array<{ x: number; y: number }>): number {
  if (!eye || eye.length < 6) return 0.3;
  const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  return h > 0 ? (v1 + v2) / (2.0 * h) : 0.3;
}

type LivenessStage = "searching" | "face_ready" | "blink_down" | "liveness_verified" | "processing";

export function FaceCapture({
  mode,
  onCapture,
  onClose,
}: {
  mode: Mode;
  onCapture: (descriptor: number[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<string>("Loading models…");
  const [busy, setBusy] = useState(false);
  const [needsNewTab, setNeedsNewTab] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const [livenessStage, setLivenessStage] = useState<LivenessStage>("searching");
  const [faceDetected, setFaceDetected] = useState(false);
  const [earValue, setEarValue] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const stageRef = useRef<LivenessStage>("searching");
  const closedTimestampRef = useRef<number>(0);
  const isLoopRunningRef = useRef(false);

  useEffect(() => {
    stageRef.current = livenessStage;
  }, [livenessStage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      isLoopRunningRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          if (mountedRef.current) {
            setStatus("Camera requires HTTPS. Open this page in a secure tab.");
            setNeedsNewTab(true);
          }
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          if (mountedRef.current) {
            setStatus("This browser/embed does not expose the camera. Open in a new tab.");
            setNeedsNewTab(true);
          }
          return;
        }
        const faceapi = await loadFaceApi();
        await ensureModels(faceapi);
        if (cancelled || !mountedRef.current) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (mountedRef.current) {
          setStatus(
            mode === "verify"
              ? "Position your face inside the frame and blink naturally."
              : "Position your face inside the frame, then capture.",
          );
          startLivenessTracking();
        }
      } catch (e: any) {
        if (!mountedRef.current) return;
        const name = e?.name ?? "";
        if (name === "NotAllowedError" || /permission/i.test(e?.message ?? "")) {
          setStatus(
            "Camera permission denied. The preview iframe blocks the camera — open this page in a new tab and allow camera access.",
          );
          setNeedsNewTab(true);
        } else if (name === "NotFoundError") {
          setStatus("No camera detected on this device.");
        } else if (name === "NotReadableError") {
          setStatus("Camera is in use by another app. Close it and try again.");
        } else {
          setStatus(`Camera error: ${e?.message ?? "unknown"}`);
        }
      }
    })();
    return () => {
      cancelled = true;
      isLoopRunningRef.current = false;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleVerifiedCapture(faceapi: typeof import("face-api.js")) {
    if (!videoRef.current || !mountedRef.current) return;
    setBusy(true);
    setLivenessStage("processing");
    setStatus("Liveness verified! Capturing high-quality biometric match…");

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        if (mountedRef.current) {
          setStatus("Face lost during capture — please align and try again.");
          setLivenessStage("searching");
          setBusy(false);
        }
        return;
      }

      await onCapture(Array.from(detection.descriptor));
    } catch (e: any) {
      if (mountedRef.current) {
        setStatus(e.message ?? "Capture failed");
        setLivenessStage("searching");
        setBusy(false);
      }
    }
  }

  function startLivenessTracking() {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    let lastFrameTime = 0;
    const FRAME_INTERVAL_MS = 140; // ~7 frames per second (low CPU, high responsive)

    async function tick(now: number) {
      if (!isLoopRunningRef.current || !mountedRef.current) return;

      if (now - lastFrameTime >= FRAME_INTERVAL_MS) {
        lastFrameTime = now;
        if (
          videoRef.current &&
          videoRef.current.readyState >= 2 &&
          !videoRef.current.paused &&
          !busy &&
          stageRef.current !== "processing"
        ) {
          try {
            const faceapi = await loadFaceApi();
            const detection = await faceapi
              .detectSingleFace(
                videoRef.current,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }),
              )
              .withFaceLandmarks();

            if (!mountedRef.current) return;

            if (detection) {
              setFaceDetected(true);
              const leftEye = detection.landmarks.getLeftEye();
              const rightEye = detection.landmarks.getRightEye();
              const earLeft = calculateEAR(leftEye);
              const earRight = calculateEAR(rightEye);
              const avgEar = (earLeft + earRight) / 2;
              setEarValue(avgEar);

              const currentStage = stageRef.current;

              if (mode === "verify") {
                // Active blink liveness detection state machine:
                // 1. Searching -> Face Ready (eyes open: avgEar >= 0.22)
                if (currentStage === "searching") {
                  if (avgEar >= 0.22) {
                    setLivenessStage("face_ready");
                    setStatus("Face detected. Please blink naturally to verify liveness…");
                  }
                } else if (currentStage === "face_ready") {
                  // 2. Eyes closed during blink (avgEar <= 0.185)
                  if (avgEar <= 0.185) {
                    closedTimestampRef.current = Date.now();
                    setLivenessStage("blink_down");
                  }
                } else if (currentStage === "blink_down") {
                  // 3. Eyes reopen (avgEar >= 0.22) within realistic human blink window (80ms to 900ms)
                  const closedDuration = Date.now() - closedTimestampRef.current;
                  if (avgEar >= 0.22 && closedDuration >= 70 && closedDuration <= 950) {
                    setLivenessStage("liveness_verified");
                    isLoopRunningRef.current = false;
                    await handleVerifiedCapture(faceapi);
                    return;
                  } else if (closedDuration > 1200) {
                    // Closed too long (eyes held shut or photo glitch), reset
                    setLivenessStage("face_ready");
                  }
                }
              } else {
                // In enroll mode, notify face is aligned
                if (currentStage === "searching") {
                  setLivenessStage("face_ready");
                  setStatus("Face aligned. Click Capture & Save when ready.");
                }
              }
            } else {
              setFaceDetected(false);
              setEarValue(null);
              if (stageRef.current !== "searching") {
                setLivenessStage("searching");
                setStatus("Align your face inside the guide frame…");
              }
            }
          } catch {
            // Non-critical frame error, continue to next frame
          }
        }
      }

      if (isLoopRunningRef.current && mountedRef.current) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  async function manualCapture() {
    if (!videoRef.current) return;
    setBusy(true);
    isLoopRunningRef.current = false;
    setStatus("Detecting face & analyzing biometric landmarks…");

    try {
      const faceapi = await loadFaceApi();
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        if (mountedRef.current) {
          setStatus("No face detected — try again with more light.");
          setBusy(false);
          startLivenessTracking();
        }
        return;
      }

      await onCapture(Array.from(detection.descriptor));
    } catch (e: any) {
      if (mountedRef.current) {
        setStatus(e.message ?? "Capture failed");
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }

  const isVerified = livenessStage === "liveness_verified" || livenessStage === "processing";

  return (
    <div
      translate="no"
      className="notranslate fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 px-4 pb-4 md:items-center backdrop-blur-xs"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl border border-border">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">
              <span>{mode === "enroll" ? "Enroll face" : "Face verification"}</span>
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <ShieldCheck className="h-3 w-3" /> Anti-Spoof
            </span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video container with face alignment guide overlay */}
        <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3] flex items-center justify-center">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover transform -scale-x-100" />

          {/* Oval face guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`w-44 h-56 rounded-[50%] border-2 transition-all duration-300 ${
                isVerified
                  ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)] bg-emerald-500/10"
                  : livenessStage === "blink_down"
                  ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
                  : faceDetected
                  ? "border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  : "border-white/30 border-dashed"
              }`}
            />
          </div>

          {/* Liveness prompt pill */}
          <div className="absolute bottom-3 inset-x-3 flex justify-center pointer-events-none">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md px-3 py-1.5 text-xs text-white shadow-lg">
              {isVerified ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span className="font-semibold text-emerald-300">Liveness Confirmed</span>
                </>
              ) : livenessStage === "blink_down" ? (
                <>
                  <Eye className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                  <span className="font-semibold text-amber-200">Blink detected… open eyes</span>
                </>
              ) : faceDetected ? (
                <>
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  <span>{mode === "verify" ? "Please blink naturally" : "Face detected"}</span>
                </>
              ) : (
                <span>Position face in the oval</span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-3 min-h-[2.2em] text-xs text-muted-foreground text-center">
          <span>{status}</span>
        </p>

        {needsNewTab && typeof window !== "undefined" && (
          <a
            href={window.location.href}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold"
          >
            <ExternalLink className="h-3.5 w-3.5" /> <span>Open in new tab</span>
          </a>
        )}

        <div className="mt-2 flex gap-2">
          <button
            onClick={manualCapture}
            disabled={busy || needsNewTab}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60 transition-all"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span>
              {busy
                ? "Processing…"
                : mode === "enroll"
                ? "Capture & save"
                : "Capture & verify manually"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}