// Client-side device identification.
//
// Browsers/mobile OSes intentionally block hardware serials (BIOS, IMEI, MAC…),
// so we combine three signals:
//   1. installation UUID  — persisted locally, stable per install
//   2. environment fingerprint — hashed platform/screen/tz/webgl/canvas signature
//   3. server-side registration + admin approval (the real security boundary)
//
// device_key = SHA256(installation_uuid + fingerprint)

const DEVICE_KEY_STORAGE = "int-device-id"; // legacy key, kept for continuity

export type DeviceProfile = {
  device_id: string;
  fingerprint: string;
  device_key: string;
  device_type: "PC" | "Android" | "iPhone" | "iPad" | "Mac" | "Unknown";
  os: string;
  browser: string;
  label: string;
  user_agent: string;
};

export function getInstallationUuid(): string {
  if (typeof window === "undefined") return "DEV-SSR";
  let id = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!id) {
    const uuid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
        : Math.random().toString(36).slice(2, 10).toUpperCase();
    id = `DEV-${uuid}`;
    localStorage.setItem(DEVICE_KEY_STORAGE, id);
  }
  return id;
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Non-secure context fallback (deterministic, non-cryptographic)
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
    return `fallback${(h >>> 0).toString(16)}`;
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function webglSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "no-webgl";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `${vendor}/${renderer}`;
  } catch {
    return "webgl-error";
  }
}

function canvasSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("int-hr-device", 2, 2);
    return canvas.toDataURL().slice(-64);
  } catch {
    return "canvas-error";
  }
}

export function detectDeviceMeta(): Pick<DeviceProfile, "device_type" | "os" | "browser" | "label" | "user_agent"> {
  if (typeof navigator === "undefined") {
    return { device_type: "Unknown", os: "Unknown", browser: "Unknown", label: "Device", user_agent: "" };
  }
  const ua = navigator.userAgent;
  const device_type: DeviceProfile["device_type"] =
    /iPhone/.test(ua) ? "iPhone" :
    /iPad/.test(ua) ? "iPad" :
    /Android/.test(ua) ? "Android" :
    /Mac/.test(ua) ? "Mac" :
    /Windows|Linux|CrOS/.test(ua) ? "PC" : "Unknown";
  const os =
    /Windows NT 10/.test(ua) ? "Windows 10/11" :
    /Windows/.test(ua) ? "Windows" :
    /Android (\d+)/.test(ua) ? `Android ${/Android (\d+)/.exec(ua)?.[1]}` :
    /iPhone OS (\d+)/.test(ua) ? `iOS ${/iPhone OS (\d+)/.exec(ua)?.[1]}` :
    /Mac OS X/.test(ua) ? "macOS" :
    /CrOS/.test(ua) ? "ChromeOS" :
    /Linux/.test(ua) ? "Linux" : "Unknown";
  const browserName =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\/(\d+)/.test(ua) ? "Chrome" :
    /Firefox\/(\d+)/.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Browser";
  const version = /(?:Edg|OPR|Chrome|Firefox|Version)\/(\d+)/.exec(ua)?.[1];
  const browser = version ? `${browserName} ${version}` : browserName;
  return { device_type, os, browser, label: `${browser} · ${os}`, user_agent: ua };
}

let cached: DeviceProfile | null = null;

export async function collectDeviceProfile(): Promise<DeviceProfile> {
  if (cached) return cached;
  const device_id = getInstallationUuid();
  const meta = detectDeviceMeta();
  const parts =
    typeof window === "undefined"
      ? ["ssr"]
      : [
          navigator.platform ?? "",
          meta.browser,
          meta.os,
          `${screen.width}x${screen.height}x${screen.colorDepth}`,
          Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
          navigator.language,
          String(navigator.hardwareConcurrency ?? 0),
          String((navigator as any).deviceMemory ?? 0),
          String(navigator.maxTouchPoints ?? 0),
          webglSignature(),
          canvasSignature(),
        ];
  const fingerprint = await sha256Hex(parts.join("|"));
  const device_key = await sha256Hex(`${device_id}|${fingerprint}`);
  cached = { device_id, fingerprint, device_key, ...meta };
  return cached;
}
