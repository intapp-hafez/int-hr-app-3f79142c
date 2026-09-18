import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Camera,
  Fingerprint,
  ScanFace,
  Database,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Laptop,
  Check,
  X,
  Play,
  ArrowRight,
  Info,
  Layers,
} from "lucide-react";
import { getBiometricHealthStatus } from "@/backend/functions/biometrics-health.functions";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/biometrics-health")({
  component: BiometricsHealthPage,
});

type BrowserCheckResult = {
  camera: { status: "pass" | "warn" | "fail"; message: string; state?: string };
  webauthn: {
    status: "pass" | "warn" | "fail";
    message: string;
    hasHardware?: boolean;
    isSecureContext?: boolean;
  };
  mediaDevices: { status: "pass" | "warn" | "fail"; message: string };
  geolocation: { status: "pass" | "warn" | "fail"; message: string; state?: string };
};

export function BiometricsHealthPage() {
  const { t } = useI18n();
  const fetchHealth = useServerFn(getBiometricHealthStatus);

  const [testingCamera, setTestingCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [browserChecks, setBrowserChecks] = useState<BrowserCheckResult>({
    camera: { status: "warn", message: "Checking camera permission..." },
    webauthn: { status: "warn", message: "Checking WebAuthn capabilities..." },
    mediaDevices: { status: "warn", message: "Checking media devices..." },
    geolocation: { status: "warn", message: "Checking geolocation permission..." },
  });
  const [runningBrowserTests, setRunningBrowserTests] = useState(false);

  // Server health query
  const {
    data: serverReport,
    isLoading: isServerLoading,
    isFetching: isServerFetching,
    refetch: refetchServer,
  } = useQuery({
    queryKey: ["biometrics-health-status"],
    queryFn: () => fetchHealth(),
    refetchInterval: 30000,
  });

  // Client-side Browser Capability & Permission Checks
  async function runClientBrowserChecks() {
    setRunningBrowserTests(true);
    const result: BrowserCheckResult = {
      camera: { status: "warn", message: "Unknown" },
      webauthn: { status: "warn", message: "Unknown" },
      mediaDevices: { status: "warn", message: "Unknown" },
      geolocation: { status: "warn", message: "Unknown" },
    };

    // 1. Check MediaDevices API
    if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
      result.mediaDevices = {
        status: "pass",
        message: "MediaDevices & getUserMedia API supported in this browser",
      };
    } else {
      result.mediaDevices = {
        status: "fail",
        message: "navigator.mediaDevices not available (requires HTTPS or secure context)",
      };
    }

    // 2. Check Camera Permission
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      try {
        const p = await navigator.permissions.query({ name: "camera" as any });
        if (p.state === "granted") {
          result.camera = { status: "pass", message: "Camera permission granted", state: p.state };
        } else if (p.state === "prompt") {
          result.camera = {
            status: "warn",
            message: "Camera permission will be requested upon face capture",
            state: p.state,
          };
        } else {
          result.camera = {
            status: "fail",
            message: "Camera permission blocked or denied by browser",
            state: p.state,
          };
        }
      } catch {
        result.camera = {
          status: "warn",
          message: "Camera permission query unsupported; will prompt on active capture",
        };
      }
    } else {
      result.camera = {
        status: "warn",
        message: "Permissions API not available; will prompt on active capture",
      };
    }

    // 3. Check WebAuthn / Platform Authenticator Hardware
    const isSecure = typeof window !== "undefined" ? window.isSecureContext : false;
    const hasPubKey = typeof window !== "undefined" && !!window.PublicKeyCredential;

    if (!isSecure) {
      result.webauthn = {
        status: "fail",
        message: "Insecure Context: WebAuthn requires HTTPS or localhost",
        isSecureContext: false,
      };
    } else if (!hasPubKey) {
      result.webauthn = {
        status: "fail",
        message: "PublicKeyCredential not supported in this browser",
        isSecureContext: true,
        hasHardware: false,
      };
    } else {
      try {
        const available =
          await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          result.webauthn = {
            status: "pass",
            message:
              "Platform authenticator available (Touch ID / Windows Hello / Biometric Sensor)",
            hasHardware: true,
            isSecureContext: true,
          };
        } else {
          result.webauthn = {
            status: "warn",
            message:
              "WebAuthn supported, but no platform biometric sensor detected on current device",
            hasHardware: false,
            isSecureContext: true,
          };
        }
      } catch (e: any) {
        result.webauthn = {
          status: "warn",
          message: `WebAuthn capability probe: ${e?.message ?? "unknown"}`,
          isSecureContext: true,
        };
      }
    }

    // 4. Geolocation permission
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      try {
        const g = await navigator.permissions.query({ name: "geolocation" as any });
        if (g.state === "granted") {
          result.geolocation = {
            status: "pass",
            message: "Geolocation permission granted",
            state: g.state,
          };
        } else if (g.state === "prompt") {
          result.geolocation = {
            status: "warn",
            message: "Geolocation permission promptable",
            state: g.state,
          };
        } else {
          result.geolocation = {
            status: "fail",
            message: "Geolocation permission blocked",
            state: g.state,
          };
        }
      } catch {
        result.geolocation = { status: "warn", message: "Geolocation query not supported" };
      }
    }

    setBrowserChecks(result);
    setRunningBrowserTests(false);
  }

  useEffect(() => {
    runClientBrowserChecks();
  }, []);

  async function handleTestCamera() {
    setTestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      toast.success("Camera stream accessed successfully!");
      // Re-run browser checks to capture updated granted state
      runClientBrowserChecks();
    } catch (err: any) {
      toast.error(`Camera test failed: ${err.message}`);
      setTestingCamera(false);
    }
  }

  function stopCameraTest() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setTestingCamera(false);
  }

  // Combined checks
  const serverChecks = serverReport?.checks ?? [];
  const dbCheck = serverChecks.find((c) => c.category === "database");
  const faceCheck = serverChecks.find((c) => c.category === "face");
  const fpServerCheck = serverChecks.find((c) => c.category === "fingerprint");

  // Overall system verdict
  const hasFailures =
    serverReport?.overallStatus === "fail" ||
    browserChecks.mediaDevices.status === "fail" ||
    browserChecks.webauthn.status === "fail";
  const hasWarnings =
    serverReport?.overallStatus === "warn" ||
    browserChecks.camera.status === "warn" ||
    browserChecks.webauthn.status === "warn";

  const overallVerdict: "pass" | "warn" | "fail" = hasFailures
    ? "fail"
    : hasWarnings
      ? "warn"
      : "pass";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Biometric System Health
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                overallVerdict === "pass"
                  ? "bg-success/15 text-success border border-success/30"
                  : overallVerdict === "warn"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-destructive/15 text-destructive border border-destructive/30"
              }`}
            >
              {overallVerdict === "pass" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> All Checks Passed
                </>
              ) : overallVerdict === "warn" ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" /> Operational with Warnings
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" /> Issues Detected
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time diagnostics for face persistence, fingerprint registration, browser permissions, and database connectivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchServer();
              runClientBrowserChecks();
              toast.info("Diagnostics re-run initiated");
            }}
            disabled={isServerFetching || runningBrowserTests}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand text-brand-foreground px-4 py-2 text-xs font-semibold shadow-brand hover:opacity-95 transition disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                isServerFetching || runningBrowserTests ? "animate-spin" : ""
              }`}
            />
            <span>Run Diagnostics</span>
          </button>

          <Link
            to="/admin/audit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Audit Log</span>
          </Link>
        </div>
      </div>

      {/* Top Diagnostics Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Database Connectivity Card */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Database Connectivity</span>
            <Database className="h-4 w-4 text-brand" />
          </div>
          <div className="flex items-center gap-2">
            {dbCheck?.status === "pass" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : dbCheck?.status === "warn" ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            )}
            <span className="font-semibold text-sm capitalize text-foreground">
              {dbCheck?.status === "pass"
                ? "Connected (Pass)"
                : dbCheck?.status === "warn"
                  ? "Degraded (Warn)"
                  : "Unavailable (Fail)"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {dbCheck?.message || "Checking database connection latency..."}
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Ping Latency:</span>
            <span className="font-mono font-semibold text-foreground">
              {dbCheck?.latencyMs != null ? `${dbCheck.latencyMs} ms` : "—"}
            </span>
          </div>
        </div>

        {/* 2. Face Persistence Card */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Face Persistence</span>
            <ScanFace className="h-4 w-4 text-sky-500" />
          </div>
          <div className="flex items-center gap-2">
            {faceCheck?.status === "pass" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : faceCheck?.status === "warn" ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            )}
            <span className="font-semibold text-sm capitalize text-foreground">
              {faceCheck?.status === "pass"
                ? "Storage Valid (Pass)"
                : faceCheck?.status === "warn"
                  ? "Warning (Warn)"
                  : "Error (Fail)"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {faceCheck?.message || "Verifying face_descriptors table..."}
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Enrolled Faces:</span>
            <span className="font-mono font-semibold text-foreground">
              {serverReport?.stats.enrolledFaces ?? 0}
            </span>
          </div>
        </div>

        {/* 3. Fingerprint Registration Card */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Fingerprint (WebAuthn)</span>
            <Fingerprint className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-center gap-2">
            {fpServerCheck?.status === "pass" && browserChecks.webauthn.status !== "fail" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : fpServerCheck?.status === "fail" || browserChecks.webauthn.status === "fail" ? (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            )}
            <span className="font-semibold text-sm capitalize text-foreground">
              {fpServerCheck?.status === "pass"
                ? "Active (Pass)"
                : "Check Needed"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {fpServerCheck?.message || "Validating WebAuthn credentials..."}
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Registered Devices:</span>
            <span className="font-mono font-semibold text-foreground">
              {serverReport?.stats.registeredFingerprints ?? 0}
            </span>
          </div>
        </div>

        {/* 4. Browser Permissions Card */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Browser Permissions</span>
            <Camera className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            {browserChecks.camera.status === "pass" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : browserChecks.camera.status === "warn" ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            )}
            <span className="font-semibold text-sm capitalize text-foreground">
              {browserChecks.camera.status === "pass"
                ? "Granted (Pass)"
                : browserChecks.camera.status === "warn"
                  ? "Prompt Ready"
                  : "Blocked (Fail)"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {browserChecks.camera.message}
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Camera Testing:</span>
            <button
              onClick={handleTestCamera}
              className="font-semibold text-brand hover:underline"
            >
              Test Sensor
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Diagnostics Checklist */}
      <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Comprehensive Diagnostics Breakdown
            </h2>
            <p className="text-xs text-muted-foreground">
              Verification results across persistence layer, cryptographic authenticators, and browser sensors.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Last check: {serverReport?.checkedAt ? new Date(serverReport.checkedAt).toLocaleTimeString() : "Just now"}
          </span>
        </div>

        <div className="divide-y divide-border text-xs">
          {/* Item 1: Database Connectivity */}
          <div className="p-5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
            <div
              className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${
                dbCheck?.status === "pass"
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              <Database className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">
                  Database Table & Connectivity Test
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    dbCheck?.status === "pass"
                      ? "bg-success/20 text-success"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {dbCheck?.status || "PASS"}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{dbCheck?.message}</p>
              <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
                <span>
                  Query Latency:{" "}
                  <strong className="text-foreground font-mono">{dbCheck?.latencyMs ?? 0} ms</strong>
                </span>
                <span>•</span>
                <span>
                  Audit Log Entries:{" "}
                  <strong className="text-foreground font-mono">
                    {serverReport?.stats.totalAuditLogs ?? 0}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Item 2: Face Persistence & Descriptors */}
          <div className="p-5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
            <div
              className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${
                faceCheck?.status === "pass"
                  ? "bg-success/15 text-success"
                  : "bg-amber-500/15 text-amber-600"
              }`}
            >
              <ScanFace className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">
                  Face Descriptors & Vector Persistence
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    faceCheck?.status === "pass"
                      ? "bg-success/20 text-success"
                      : "bg-amber-500/20 text-amber-600"
                  }`}
                >
                  {faceCheck?.status || "PASS"}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{faceCheck?.message}</p>
              <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
                <span>
                  Vector Format:{" "}
                  <strong className="text-foreground">
                    {faceCheck?.details?.vectorIntegrity || "128-float Euclidean"}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Enrolled Profiles:{" "}
                  <strong className="text-foreground">
                    {serverReport?.stats.enrolledFaces ?? 0}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Item 3: WebAuthn Fingerprint Registration */}
          <div className="p-5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
            <div
              className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${
                fpServerCheck?.status === "pass"
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              <Fingerprint className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">
                  Fingerprint & WebAuthn Authenticator Pipeline
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    fpServerCheck?.status === "pass"
                      ? "bg-success/20 text-success"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {fpServerCheck?.status || "PASS"}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {fpServerCheck?.message} · {browserChecks.webauthn.message}
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
                <span>
                  Registered Credentials:{" "}
                  <strong className="text-foreground">
                    {serverReport?.stats.registeredFingerprints ?? 0}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Challenge Lifecycle:{" "}
                  <strong className="text-foreground">
                    {fpServerCheck?.details?.challengeCleanup || "Automated Cleanup Active"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Item 4: Browser Sensor & Camera Permissions */}
          <div className="p-5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
            <div
              className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${
                browserChecks.camera.status === "pass"
                  ? "bg-success/15 text-success"
                  : browserChecks.camera.status === "warn"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-destructive/15 text-destructive"
              }`}
            >
              <Camera className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">
                  Browser Camera & Device Permissions
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    browserChecks.camera.status === "pass"
                      ? "bg-success/20 text-success"
                      : browserChecks.camera.status === "warn"
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {browserChecks.camera.status.toUpperCase()}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {browserChecks.camera.message}
              </p>
              <div className="flex items-center gap-3 pt-1 text-[11px]">
                <button
                  onClick={handleTestCamera}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 font-semibold text-brand hover:bg-brand/20 transition"
                >
                  <Play className="h-3 w-3" />
                  <span>Test Camera Sensor</span>
                </button>
                <span className="text-muted-foreground">
                  MediaDevices:{" "}
                  <strong className="text-foreground">
                    {browserChecks.mediaDevices.status === "pass" ? "Available" : "Missing"}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Live Sensor Test Modal */}
      {testingCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-brand" />
                <h3 className="font-display font-semibold text-base text-foreground">
                  Camera Sensor Stream Test
                </h3>
              </div>
              <button
                onClick={stopCameraTest}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-border">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-2 start-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-mono text-white backdrop-blur">
                Live Sensor: 640x480
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              If your video feed is visible and moving smoothly above, browser camera permissions and device sensor access are fully operational.
            </p>

            <button
              onClick={stopCameraTest}
              className="w-full rounded-2xl bg-brand py-2.5 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95"
            >
              Done Testing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
