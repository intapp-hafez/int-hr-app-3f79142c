import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Fingerprint, ScanFace, Trash2, Plus, CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";
import {
  listMyBiometrics, enrollFace, deleteFace, deleteWebauthnCredential,
  webauthnRegisterOptions, webauthnRegisterVerify,
} from "@/backend/functions/biometrics.functions";
import { FaceCapture } from "@/components/biometrics/FaceCapture";

export const Route = createFileRoute("/employee/biometrics")({ component: BiometricsPage });

function BiometricsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyBiometrics);
  const enrollFn = useServerFn(enrollFace);
  const delFaceFn = useServerFn(deleteFace);
  const delCredFn = useServerFn(deleteWebauthnCredential);
  const regOptsFn = useServerFn(webauthnRegisterOptions);
  const regVerifyFn = useServerFn(webauthnRegisterVerify);

  const q = useQuery({ queryKey: ["biometrics"], queryFn: () => listFn() });
  const [showCapture, setShowCapture] = useState(false);

  const enrollM = useMutation({
    mutationFn: (descriptor: number[]) => enrollFn({ data: { descriptor } }),
    onSuccess: () => {
      toast.success("Face enrolled");
      qc.invalidateQueries({ queryKey: ["biometrics"] });
      setShowCapture(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delFaceM = useMutation({
    mutationFn: () => delFaceFn(),
    onSuccess: () => { toast.success("Face removed"); qc.invalidateQueries({ queryKey: ["biometrics"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCredM = useMutation({
    mutationFn: (id: string) => delCredFn({ data: { id } }),
    onSuccess: () => { toast.success("Fingerprint removed"); qc.invalidateQueries({ queryKey: ["biometrics"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function addFingerprint() {
    try {
      if (typeof window !== "undefined" && window.top !== window.self) {
        toast.error("Fingerprint requires opening the app in a new tab.", {
          description: "The preview iframe blocks WebAuthn. Click 'Open in new tab' below.",
        });
        return;
      }
      if (typeof window !== "undefined" && !window.isSecureContext) {
        toast.error("Fingerprint requires HTTPS.");
        return;
      }
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        toast.error("This browser does not support fingerprint sign-in.");
        return;
      }
      const { startRegistration } = await import("@simplewebauthn/browser");
      const label = (typeof navigator !== "undefined" ? navigator.platform : "Device") || "Device";
      const options = await regOptsFn({ data: { label } });
      const attestation = await startRegistration({ optionsJSON: options as any });
      await regVerifyFn({ data: { response: attestation, label } });
      toast.success("Fingerprint registered");
      qc.invalidateQueries({ queryKey: ["biometrics"] });
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (msg.includes("publickey-credentials-create") || msg.includes("not enabled in this document")) {
        toast.error("Open the app in a new tab to register a fingerprint.", {
          description: "The preview iframe blocks WebAuthn for security.",
        });
        toast.error(msg || "Could not register fingerprint");
      }
    }
  }

  const inIframe = typeof window !== "undefined" && window.top !== window.self;

  const face = q.data?.face;
  const creds = q.data?.fingerprints ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Biometrics</h1>
        <p className="text-xs text-muted-foreground">
          Register your face and your device fingerprint to speed up sign-in and check-ins.
        </p>
      </header>

      {inIframe && (
        <aside className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-warning/20 p-2 text-warning-foreground">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-semibold text-warning-foreground">
                Biometrics are limited inside the preview
              </p>
              <p className="text-xs text-warning-foreground/90 leading-relaxed">
                Browsers block fingerprint (WebAuthn) and camera access in
                cross-origin iframes unless the parent page explicitly delegates
                the permission via an <code className="rounded bg-warning/20 px-1 py-0.5 font-mono text-[10px]">allow=</code> attribute.
                The preview iframe does not, so registration must be
                done from the app opened in its own tab (or after publishing).
              </p>
              <a
                href={typeof window !== "undefined" ? window.location.href : "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-warning/20 px-3 py-1.5 text-xs font-semibold text-warning-foreground hover:bg-warning/30"
              >
                <ExternalLink className="h-3 w-3" /> Open in new tab
              </a>
            </div>
          </div>
        </aside>
      )}

      {/* Face */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-brand/10 p-3 text-brand"><ScanFace className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 className="font-display text-sm font-semibold">Face recognition</h2>
            {face ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled · updated {new Date(face.updated_at!).toLocaleString()}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Not enrolled yet.</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowCapture(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-semibold text-brand-foreground shadow-brand"
          >
            <Plus className="h-3.5 w-3.5" /> {face ? "Re-enroll" : "Enroll face"}
          </button>
          {face && (
            <button
              onClick={() => delFaceM.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      </section>

      {/* Fingerprints */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-brand/10 p-3 text-brand"><Fingerprint className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 className="font-display text-sm font-semibold">Fingerprint / device unlock</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Uses your device's built-in sensor (Touch ID, Windows Hello, Android fingerprint).
            </p>
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {creds.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs">
              <div>
                <p className="font-semibold">{c.device_label ?? "Device"}</p>
                <p className="text-[10px] text-muted-foreground">
                  Added {new Date(c.created_at).toLocaleDateString()}
                  {c.last_used_at ? ` · last used ${new Date(c.last_used_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <button
                onClick={() => delCredM.mutate(c.id)}
                className="inline-flex items-center gap-1 text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </li>
          ))}
          {creds.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No devices registered yet.
            </li>
          )}
        </ul>
        {inIframe ? (
          <div className="mt-3 space-y-2">
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning-foreground">
              Fingerprint registration is blocked inside the preview iframe. Open the app in a new tab to continue.
            </p>
            <a
              href={typeof window !== "undefined" ? window.location.href : "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
            >
              Open in new tab
            </a>
          </div>
        ) : (
          <button
            onClick={addFingerprint}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-semibold text-brand-foreground shadow-brand"
          >
            <Plus className="h-3.5 w-3.5" /> Add this device
          </button>
        )}
      </section>

      {showCapture && (
        <FaceCapture
          mode="enroll"
          onCapture={async (d) => { await enrollM.mutateAsync(d); }}
          onClose={() => setShowCapture(false)}
        />
      )}
    </div>
  );
}