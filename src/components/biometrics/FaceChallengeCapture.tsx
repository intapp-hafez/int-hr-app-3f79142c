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

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Camera, Loader2, X, ShieldCheck, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
  const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const url = `${baseUrl}/models`;
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
  const { isAr } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const loopRef = useRef(false);

  const [stage, setStage] = useState<Stage>("loading");
  const [statusMsg, setStatusMsg] = useState(isAr ? "جاري طلب جلسة تحقق آمنة…" : "Requesting secure challenge…");
  const [faceDetected, setFaceDetected] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [keyframes, setKeyframes] = useState<VisualKeyframe[]>([]);
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

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
          throw new Error(isAr ? "الكاميرا غير متوفرة. يرجى فتح الصفحة في متصفح آمن يدعم الكاميرا." : "Camera not available. Open this page in a secure browser tab.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });

        // Anti-Spoofing: Check for virtual camera feeds (OBS, ManyCam, DroidCam, etc.)
        const videoTrack = stream.getVideoTracks()[0];
        const trackLabel = (videoTrack?.label || "").toLowerCase();
        const VIRTUAL_CAM_REGEX = /\b(obs|virtual|manycam|droidcam|v4l2|splitcam|fake|screen-capture|screen|xsplit)\b/i;
        if (VIRTUAL_CAM_REGEX.test(trackLabel)) {
          stream.getTracks().forEach((t) => t.stop());
          throw new BiometricApiError(
            "VIRTUAL_CAMERA_DETECTED",
            isAr
              ? "تم اكتشاف كاميرا وهمية أو برنامج بث. يرجى استخدام كاميرا الجهاز الحقيقية."
              : "Virtual or software camera detected. Please use a physical webcam or device camera."
          );
        }

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
        setStatusMsg(
          isAr
            ? `الخطوة 1 من ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[0], true)}`
            : `Step 1 of ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[0], false)}`
        );
        startDetectionLoop(faceapi, chal, 0, []);
      } catch (e: any) {
        if (!mountedRef.current || cancelled) return;
        const msg = e instanceof BiometricApiError
          ? e.message
          : (e?.message ?? (isAr ? "فشل بدء جلسة التحقق" : "Initialisation failed"));
        setStage("challenge_error");
        setErrorCode(e instanceof BiometricApiError ? e.code : "INIT_FAILED");
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
      setStatusMsg(
        isAr
          ? `الخطوة ${nextIdx + 1} من ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[nextIdx], true)}`
          : `Step ${nextIdx + 1} of ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[nextIdx], false)}`
      );
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
    setStatusMsg(isAr ? "جاري التحقق عبر الخادم الآمن ومطابقة البصمة…" : "Verifying with secure server & matching face…");

    try {
      // Extract descriptor from the current (final) frame
      const det = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det || !mountedRef.current) {
        setStage("error");
        setErrorCode("FACE_LOST");
        setErrorMsg(isAr ? "تم فقدان تتبع الوجه أثناء الالتقاط النهائي." : "Face lost during final capture.");
        return;
      }

      const descriptor = Array.from(det.descriptor);
      if (!validateDescriptor(descriptor)) {
        setStage("error");
        setErrorCode("INVALID_DESCRIPTOR");
        setErrorMsg(isAr ? "الملامح غير واضحة لاستخراج بصمة دقيقة." : "Invalid face descriptor.");
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
      setStatusMsg(isAr ? "تم التحقق من بصمة الوجه بنجاح!" : "Verification complete!");
      // Notify parent after brief success flash
      setTimeout(() => {
        if (mountedRef.current) onSuccess(result);
      }, 700);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setStage("error");
      const code = e instanceof BiometricApiError ? e.code : "VERIFICATION_FAILED";
      const rawMsg = e instanceof BiometricApiError
        ? e.message
        : (e?.message ?? (isAr ? "فشل التحقق من بصمة الوجه." : "Verification failed. Please try again."));
      setErrorCode(code);
      setErrorMsg(rawMsg);
    }
  }

  // ── Retry ────────────────────────────────────────────────────────────────────
  function retry() {
    setStage("loading");
    setErrorMsg(null);
    setErrorCode(null);
    setKeyframes([]);
    setPoseIndex(0);
    setFaceDetected(false);
    setChallenge(null);
    setStatusMsg(isAr ? "جاري طلب جلسة تحقق جديدة…" : "Requesting secure challenge…");
    loadFaceApi().then(async (faceapi) => {
      try {
        await ensureModels(faceapi);
        const chal = await beginVerification(action, deviceId);
        if (!mountedRef.current) return;
        setChallenge(chal);
        setPoseIndex(0);
        setStage("pose");
        setStatusMsg(
          isAr
            ? `الخطوة 1 من ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[0], true)}`
            : `Step 1 of ${chal.expected_sequence.length}: ${poseLabel(chal.expected_sequence[0], false)}`
        );
        startDetectionLoop(faceapi, chal, 0, []);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setStage("challenge_error");
        setErrorCode(e instanceof BiometricApiError ? e.code : "INIT_FAILED");
        setErrorMsg(e?.message ?? (isAr ? "فشل طلب جلسة التحقق" : "Failed to request challenge"));
      }
    });
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const seq = challenge?.expected_sequence ?? [];
  const totalPoses = seq.length;
  const currentPose = seq[poseIndex] ?? "";

  const isError = stage === "error" || stage === "challenge_error";

  const errorDetails = useMemo(() => {
    if (!isError) return null;
    const code = (errorCode || "").toUpperCase();
    const msg = (errorMsg || "").toLowerCase();

    if (code === "VIRTUAL_CAMERA_DETECTED" || msg.includes("virtual camera") || msg.includes("كاميرا وهمية")) {
      return {
        pill: isAr ? "كاميرا وهمية" : "Virtual Camera",
        title: isAr ? "تم اكتشاف كاميرا وهمية غير مصرح بها" : "Virtual Camera Detected",
        description: isAr
          ? "تم حظر التحقق لأن مصدر الفيديو برنامج وهمي (مثل OBS أو ManyCam). يرجى التبديل إلى كاميرا الجهاز الحقيقية وتحديث الصفحة."
          : "Verification was blocked because the video stream is provided by a virtual camera or broadcast tool. Please switch to a physical device webcam.",
        code: "VIRTUAL_CAMERA",
      };
    }

    if (code === "FACE_MISMATCH" || msg.includes("face did not match") || msg.includes("mismatch")) {
      return {
        pill: isAr ? "الوجه غير مطابق" : "Face Mismatch",
        title: isAr ? "بصمة الوجه غير مطابقة لصاحب الحساب" : "Face Does Not Match Account Holder",
        description: isAr
          ? "الوجه الظاهر أمام الكاميرا لا يتطابق مع بصمة الوجه المسجلة لصاحب هذا الحساب. يرجى التأكد من وقوف صاحب الحساب شخصياً أمام الكاميرا مباشرة دون كمامة أو نظارات شمسية."
          : "The face detected does not match the enrolled face template for this account. Please ensure the registered employee is directly facing the camera.",
        code: "FACE_MISMATCH",
      };
    }

    if (code === "MAX_ATTEMPTS_EXCEEDED" || msg.includes("maximum") || msg.includes("exceeded") || msg.includes("revoked")) {
      return {
        pill: isAr ? "تم تجاوز المحاولات" : "Attempts Exceeded",
        title: isAr ? "تم تجاوز الحد الأقصى للمحاولات المسموح بها" : "Maximum Verification Attempts Exceeded",
        description: isAr
          ? "تم إلغاء جلسة التحقق بشكل نهائي لحماية الحساب بعد تكرار محاولات المطابقة غير الصحيحة. يرجى إغلاق النافذة والمحاولة لاحقاً أو مراجعة إدارة الموارد البشرية."
          : "This challenge session has been revoked for security due to multiple failed matching attempts. Please close and try again or contact HR.",
        code: "MAX_ATTEMPTS_EXCEEDED",
      };
    }

    if (code === "LIVENESS_FAILED" || msg.includes("liveness")) {
      return {
        pill: isAr ? "فشل التحقق الحي" : "Liveness Failed",
        title: isAr ? "فشل التحقق من الحركة الحية" : "Liveness Verification Failed",
        description: isAr
          ? "تعذر التحقق من حركات الوجه ثلاثية الأبعاد المطلوبة. يرجى النظر مباشرة إلى الكاميرا وتنفيذ الحركات في مكان جيد الإضاءة وتجنب الصور الثابتة أو الشاشات."
          : "Could not verify natural 3D facial movements. Please face the camera directly in clear lighting and follow the requested poses without using photos or screens.",
        code: "LIVENESS_FAILED",
      };
    }

    if (code === "TEMPLATE_NOT_ENROLLED" || msg.includes("not enrolled")) {
      return {
        pill: isAr ? "البصمة غير مسجلة" : "Face Not Enrolled",
        title: isAr ? "لم يتم تسجيل بصمة الوجه بعد" : "Face Template Not Enrolled",
        description: isAr
          ? "لم يتم تسجيل قالب بصمة الوجه لهذا الحساب. يرجى التوجه لصفحة البصمة في ملفك الشخصي لتسجيل بصمة وجهك أولاً."
          : "No facial template is registered for this account. Please enroll your face first in your profile biometrics tab.",
        code: "TEMPLATE_NOT_ENROLLED",
      };
    }

    if (code === "FACE_LOST" || msg.includes("face lost")) {
      return {
        pill: isAr ? "تم فقدان الوجه" : "Face Lost",
        title: isAr ? "تم فقدان تتبع الوجه أثناء الالتقاط" : "Face Lost During Final Capture",
        description: isAr
          ? "يرجى الحفاظ على ثبات الرأس داخل الإطار البيضاوي طوال عملية الالتقاط وإعادة المحاولة."
          : "Please keep your head steady inside the oval frame during the capture and try again.",
        code: "FACE_LOST",
      };
    }

    if (code === "INVALID_DESCRIPTOR" || msg.includes("invalid face descriptor")) {
      return {
        pill: isAr ? "إضاءة غير كافية" : "Unclear Image",
        title: isAr ? "الملامح غير واضحة لاستخراج البصمة" : "Unclear Facial Features",
        description: isAr
          ? "تعذر استخراج معالم الوجه بدقة كافية. يرجى التواجد في مكان ذو إضاءة جيدة والنظر مباشرة إلى الكاميرا."
          : "Facial landmarks could not be clearly extracted. Please ensure adequate lighting and face the camera directly.",
        code: "INVALID_DESCRIPTOR",
      };
    }

    if (msg.includes("tensor") || msg.includes("shape")) {
      return {
        pill: isAr ? "خطأ بنموذج الوجه" : "Model Error",
        title: isAr ? "تعذر تحميل نموذج التعرف على الوجه" : "Model Loading Error",
        description: isAr
          ? "حدث خطأ أثناء تحميل ملفات النموذج. يرجى تحديث الصفحة والمحاولة مجدداً."
          : "An error occurred while loading the face recognition model. Please refresh the page and try again.",
        code: "MODEL_LOAD_ERROR",
      };
    }

    if (msg.includes("camera") || msg.includes("permission") || msg.includes("notallowederror")) {
      return {
        pill: isAr ? "الكاميرا محجوبة" : "Camera Blocked",
        title: isAr ? "إذن استخدام الكاميرا مطلوب" : "Camera Access Required",
        description: isAr
          ? "يرجى السماح للمتصفح بالوصول إلى الكاميرا من إعدادات المتصفح لإتمام تسجيل الحضور بالبصمة."
          : "Camera access was denied. Please allow camera permissions in your browser settings to verify attendance.",
        code: "CAMERA_DENIED",
      };
    }

    return {
      pill: isAr ? "فشل التحقق" : "Failed",
      title: isAr ? "تعذر إتمام التحقق من الوجه" : "Verification Failed",
      description: errorMsg || (isAr ? "حدث خطأ أثناء التحقق من بصمة الوجه. يرجى إعادة المحاولة." : "An error occurred during face verification. Please try again."),
      code: errorCode || "UNKNOWN_ERROR",
    };
  }, [isError, errorCode, errorMsg, isAr]);

  const ovalColor =
    stage === "success"
      ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)] bg-emerald-500/10"
      : isError
      ? "border-destructive shadow-[0_0_25px_rgba(239,68,68,0.5)] bg-destructive/10"
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
            <h2 className="font-display text-lg font-semibold">
              {isAr ? "التحقق من بصمة الوجه" : "Face verification"}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <ShieldCheck className="h-3 w-3" />
              <span>{isAr ? "تحقق خادم آمن" : "Server-verified"}</span>
            </span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress dots */}
        {totalPoses > 0 && !isError && (
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/75 backdrop-blur-md px-3.5 py-1.5 text-xs text-white shadow-lg">
              {stage === "success" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span className="font-semibold text-emerald-300">{isAr ? "تم التحقق بنجاح!" : "Verified!"}</span>
                </>
              ) : isError && errorDetails ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                  <span className="font-semibold text-rose-200">{errorDetails.pill}</span>
                </>
              ) : stage === "sending" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{isAr ? "جاري مطابقة البصمة على الخادم…" : "Verifying on server…"}</span>
                </>
              ) : stage === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{isAr ? "جاري التهيئة…" : "Loading…"}</span>
                </>
              ) : captureCountdown !== null ? (
                <>
                  <Camera className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                  <span className="font-semibold text-amber-200">{isAr ? "ابق ثابتاً…" : "Hold still…"}</span>
                </>
              ) : faceDetected ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary animate-pulse" />
                  <span>{poseLabel(currentPose, isAr)}</span>
                </>
              ) : (
                <span>{isAr ? "ضع وجهك داخل الإطار البيضاوي" : "Position face in the oval"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status text or Rich Error Card */}
        {isError && errorDetails ? (
          <div className="mt-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 p-3.5 text-start animate-in fade-in zoom-in-95 duration-150 shadow-xs">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-destructive/20 text-destructive grid place-items-center shrink-0 mt-0.5">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-destructive">
                    {errorDetails.title}
                  </h4>
                  {errorDetails.code && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-destructive/15 text-destructive shrink-0">
                      {errorDetails.code}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-foreground/80 mt-1 leading-relaxed">
                  {errorDetails.description}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 min-h-[2.2em] text-xs text-muted-foreground text-center flex items-center justify-center">
            <span>{statusMsg}</span>
          </p>
        )}

        {/* Action Button on Error */}
        {isError && (
          <div className="mt-3 flex gap-2">
            {errorCode === "MAX_ATTEMPTS_EXCEEDED" ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background hover:bg-muted py-2.5 text-xs font-semibold transition-colors"
              >
                <X className="h-4 w-4" />
                <span>{isAr ? "إغلاق" : "Close"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={retry}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition-all cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                <span>{isAr ? "إعادة المحاولة" : "Try again"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
