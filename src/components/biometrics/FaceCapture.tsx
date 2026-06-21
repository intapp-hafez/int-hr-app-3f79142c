import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, ExternalLink } from "lucide-react";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          setStatus("Camera requires HTTPS. Open this page in a secure tab.");
          setNeedsNewTab(true);
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus("This browser/embed does not expose the camera. Open in a new tab.");
          setNeedsNewTab(true);
          return;
        }
        const faceapi = await loadFaceApi();
        await ensureModels(faceapi);
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Position your face inside the frame, then capture.");
      } catch (e: any) {
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture() {
    if (!videoRef.current) return;
    setBusy(true);
    setStatus("Detecting face…");
    try {
      const faceapi = await loadFaceApi();
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        setStatus("No face detected — try again with more light.");
        setBusy(false);
        return;
      }
      await onCapture(Array.from(detection.descriptor));
    } catch (e: any) {
      setStatus(e.message ?? "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 px-4 pb-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {mode === "enroll" ? "Enroll face" : "Verify face"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3]">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        </div>
        <p className="mt-3 min-h-[2.5em] text-xs text-muted-foreground">{status}</p>
        {needsNewTab && typeof window !== "undefined" && (
          <a
            href={window.location.href}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
          </a>
        )}
        <button
          onClick={capture}
          disabled={busy || needsNewTab}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {busy ? "Working…" : mode === "enroll" ? "Capture & save" : "Capture & verify"}
        </button>
      </div>
    </div>
  );
}