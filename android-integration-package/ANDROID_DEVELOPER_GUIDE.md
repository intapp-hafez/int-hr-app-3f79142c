# دليل مطور Android الشامل: التحقق الحيوي وتسجيل الحضور الموحّد

> **البيئة التقنية:** React + Capacitor 7 + `@supabase/supabase-js` + `face-api.js 0.22.2`  
> **نقطة النهاية الموحدة (Edge Function):** `POST /functions/v1/biometric-auth`  
> **مواصفة OpenAPI الرسمية:** راجع الملف `openapi.json` في نفس هذا المجلد.  
> **مبدأ الأمان:** **Zero-Trust Server-Side Authority** — لا يتم قبول أي بصمة أو قرار حيوية أو إحداثيات GPS صادرة من العميل كإثبات حضور نهائي. القرار يصدر حصرياً من السيرفر.

---

## 1. مخطط تدفق العمليات (Lifecycle Sequence Flow)

```
[تطبيق Android]                                [Supabase Edge: biometric-auth]         [PostgreSQL DB]
      │                                                         │                             │
1.    │─── POST (action: "begin-verification") ────────────────►│                             │
      │    { challenge_action, device_id }                      │── RPC request_biometric... ─►│ (فحص نشاط الحساب
      │◄── 200 OK { challenge_id, expected_sequence } ─────────│◄── challenge_id + sequence ──│  والجهاز ومعدل المحاولات)
      │                                                         │                             │
2.    │ [توجيه الموظف لتنفيذ 3 وضعيات: e.g. front, turn_right, smile]                           │
      │ [التقاط 3 صور JPEG Base64 + استخراج متجه 128-d للوجه]                                  │
      │                                                         │                             │
3.    │─── POST (action: "verify-face") ───────────────────────►│                             │
      │    { challenge_id, descriptor, visual_keyframes }       │── فحص تشفير الصور وترددها   │
      │                                                         │── مقارنة Euclidean <= 0.50 ─►│ (مقارنة بالقالب المحفوظ)
      │                                                         │── RPC mint_biometric_proof ─►│ (حرق التحدي وإصدار توكن)
      │◄── 200 OK { verification_proof } (صلاحية دقيقتين) ──────│◄── verification_proof ───────│
      │                                                         │                             │
4.    │ [جمع 3 عينات GPS حية للتحقق من الـ Jitter وعدم وجود Mock]                                │
      │                                                         │                             │
5.    │─── POST (action: "commit-attendance") ─────────────────►│                             │
      │    { request_action, verification_proof, location }     │── توثيق توقيع Keystore      │
      │                                                         │── RPC commit_attendance ────►│ (فحص Geofence واستهلاك
      │◄── 200 OK { attendance_id, decision: "APPROVED" } ──────│◄── attendance_id ───────────│  ذري للإثبات وحساب الوقت)
```

---

## 2. الخطوات البرمجية للتطبيق (Implementation Code)

### الخطوة 1: طلب التحدي الحيوي من السيرفر (`begin-verification`)
لا يجوز للتطبيق فتح الكاميرا وطلب حركات عشوائية من تلقاء نفسه؛ السيرفر هو من يحدد التحدي.

```typescript
import { supabase } from "./supabaseClient";

export interface ChallengeData {
  challenge_id: string;
  expected_sequence: string[]; // مثال: ["front", "turn_right", "smile"]
  expires_at: string;
}

export async function requestChallenge(action: "check_in" | "check_out", deviceId: string): Promise<ChallengeData> {
  const { data, error } = await supabase.functions.invoke("biometric-auth", {
    body: {
      action: "begin-verification",
      challenge_action: action,
      device_id: deviceId,
    },
  });

  if (error || !data?.ok) {
    throw new Error(data?.message || data?.error || "فشل بدء جلسة التحقق الحيوي");
  }

  return {
    challenge_id: data.challenge_id,
    expected_sequence: data.expected_sequence,
    expires_at: data.expires_at,
  };
}
```

---

### الخطوة 2: التقاط الوضعيات واستخراج المتجه محلياً (`face-api.js`)
- أثناء تنفيذ الموظف للوضعيات المحددة في `expected_sequence`، يلتقط التطبيق صورة JPEG لكل وضعية بدقة لا تتعدى 640px.
- عند الوضعية الأخيرة، يتم استخراج مصفوفة الـ 128 رقمًا محدودًا (`Float32Array`).

```typescript
// تحويل الإطار من عنصر الفيديو إلى Base64 JPEG مضغوط
export function captureFrameAsBase64(videoElement: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  const maxDim = 640;
  const scale = Math.min(1, maxDim / Math.max(videoElement.videoWidth, videoElement.videoHeight));
  canvas.width = Math.round(videoElement.videoWidth * scale);
  canvas.height = Math.round(videoElement.videoHeight * scale);
  
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

// استخراج متجه الـ 128 والتأكد من عدم احتوائه على NaN أو Infinity
export async function extractDescriptor(videoElement: HTMLVideoElement, faceapi: any): Promise<number[]> {
  const detection = await faceapi
    .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) throw new Error("لم يتم رصد وجه بوضوح أمام الكاميرا");

  const descriptor = Array.from(detection.descriptor) as number[];
  const isValid = descriptor.length === 128 && descriptor.every((v) => typeof v === "number" && Number.isFinite(v));
  if (!isValid) throw new Error("متجه الوجه غير صالح أو يحتوي على قيم غير معرّفة");

  return descriptor;
}
```

---

### الخطوة 3: التحقق الخادمي وإصدار توكن الإثبات (`verify-face`)
يرسل التطبيق الـ Keyframes والـ Descriptor للـ Edge Function لفحص الحيوية والتطابق:

```typescript
export interface VerifyFaceResult {
  verification_proof: string; // يبدأ بـ vp_ صالح لمدة دقيقتين فقط
  expires_at: string;
}

export async function verifyFaceOnServer(params: {
  challenge_id: string;
  device_id: string;
  descriptor: number[];
  keyframes: { step: string; t: number; image_b64: string }[];
  snapshotLat?: number;
  snapshotLng?: number;
}): Promise<VerifyFaceResult> {
  const { data, error } = await supabase.functions.invoke("biometric-auth", {
    body: {
      action: "verify-face",
      challenge_id: params.challenge_id,
      device_id: params.device_id,
      descriptor: params.descriptor,
      visual_keyframes: params.keyframes,
      snapshot_lat: params.snapshotLat,
      snapshot_lng: params.snapshotLng,
    },
  });

  if (error || !data?.ok) {
    // قراءة رسالة الخطأ الدقيقة من الخادم
    const errorMsg = data?.message || data?.error || error?.message || "فشل التحقق من مطابقة الوجه";
    throw new Error(errorMsg);
  }

  return {
    verification_proof: data.verification_proof,
    expires_at: data.expires_at,
  };
}
```

---

### الخطوة 4: جمع عينات الـ GPS ومكافحة التلاعب (Anti-Spoofing)
- يجب جمع **3 عينات GPS متتالية** على الأقل بفاصل زمني (1 ثانية) للتحقق من التغير الطبيعي (`micro-jitter`).
- التأكد من أن `accuracy <= 150m`.

```typescript
import { Geolocation } from "@capacitor/geolocation";

export interface GpsSample {
  lat: number;
  lng: number;
  accuracy_m: number;
  timestamp: number;
}

export async function collectFreshGpsSamples(sampleCount = 3): Promise<GpsSample[]> {
  const samples: GpsSample[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0, // عينة حديثة تماماً
    });

    samples.push({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
      timestamp: position.timestamp,
    });

    if (i < sampleCount - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // فحص الـ Micro-jitter: لا يمكن لجهاز حقيقي أن يعطي نفس الإحداثيات حتى الخانة التاسعة تماماً في 3 قراءات
  const allIdentical = samples.every(
    (s) => s.lat === samples[0].lat && s.lng === samples[0].lng
  );
  if (allIdentical && samples.length > 2) {
    console.warn("تحذير: ثبات الإحداثيات بدقة صفرية قد يشير لموقع اصطناعي (Mock GPS)");
  }

  return samples;
}
```

---

### الخطوة 5: تسجيل الحضور الذري النهائي (`commit-attendance`)
يتم إرسال توكن الإثبات المستلم من السيرفر وعينات الـ GPS:

```typescript
export async function commitAttendanceOnServer(params: {
  action: "check_in" | "check_out";
  verificationProof: string;
  deviceId: string;
  samples: GpsSample[];
  idempotencyKey: string; // يجب توليده مرة واحدة وإعادة استخدامه في حال إعادة المحاولة (Retry)
  deviceSignature?: string | null;
}) {
  const bestSample = params.samples[params.samples.length - 1];
  // استخدام وقت التقاط العينة من الحساس (وليس وقت الإرسال عبر الشبكة)
  const capturedAt = new Date(bestSample.timestamp).toISOString();

  const { data, error } = await supabase.functions.invoke("biometric-auth", {
    body: {
      action: "commit-attendance",
      request_action: params.action,
      verification_proof: params.verificationProof,
      device_id: params.deviceId,
      idempotency_key: params.idempotencyKey,
      location: {
        lat: bestSample.lat,
        lng: bestSample.lng,
        accuracy_meters: bestSample.accuracy_m,
        captured_at: capturedAt,
      },
      samples: params.samples,
      device_signature: params.deviceSignature || null,
    },
  });

  if (error || !data?.ok) {
    const errorMsg = data?.message || data?.error || error?.message || "فشل تسجيل الحضور";
    throw new Error(errorMsg);
  }

  return data; // { ok: true, attendance_id: "...", branch: "...", server_timestamp: "..." }
}
```

---

## 3. جدول معالجة الأخطاء (Error Handling Reference)

| كود الخطأ القادم من السيرفر | السبب | التصرف الصحيح في تطبيق Android |
| :--- | :--- | :--- |
| `CHALLENGE_INVALID_OR_CONSUMED` | التحدي انتهت صلاحيته أو تم استخدامه | بدء دورة تحدي جديدة فوراً من السيرفر. |
| `MAX_ATTEMPTS_EXCEEDED` | 3 محاولات مطابقة فاشلة لنفس التحدي | حرق التحدي نهائياً ومنع التكرار وطلب إعادة الفحص. |
| `LIVENESS_FAILED` | حركة الرأس غير متناسقة أو الصور ثابتة | تنبيه الموظف بتنفيذ الحركات المطلوبة أمام الكاميرا. |
| `FACE_MISMATCH` | مسافة المتجه الرياضي أكبر من 0.50 | توضيح أن الوجه غير مطابق لصاحب الحساب المسجل. |
| `INVALID_OR_CONSUMED_PROOF` | توكن الـ `verification_proof` مر عليه > دقيقتين | طلب إعادة مسح الوجه. |
| `GEOFENCE_VIOLATION` | الموظف خارج النطاق الجغرافي لفروع العمل | إظهار اسم الفرع والنطاق وبعد الموظف عنه. |
| `LOW_ACCURACY_LOCATION` | دقة الـ GPS ضعيفة جدًا (> 150m) | مطالبة الموظف بالخروج لمكان مفتوح أو تشغيل الـ High Accuracy. |
| `STALE_LOCATION` | فارق التوقيت بين الهاتف والسيرفر كبير | التأكد من ضبط ساعة الهاتف على التوقيت التلقائي للشبكة. |
| `DEVICE_NOT_APPROVED` | الجهاز قيد الانتظار أو محظور | توجيه الموظف لشاشة الإعدادات وطلب اعتماد الجهاز من الـ Admin. |

---

## 4. تحميل أوزان face-api.js داخل APK Android

لتجنب مشاكل توجيه المسارات إلى `index.html` في Capacitor WebView:
1. ضع ملفات النماذج داخل: `public/models/`.
2. تأكد من أن كل ملف وزن ينتهي بـ `.bin` (مثال: `tiny_face_detector_model-weights_manifest.json` و `tiny_face_detector_model-shard1.bin`).
3. عند التحميل في الكود استخدم مسار نسبي مباشر:
   ```typescript
   await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
   await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
   await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
   ```

---

## 5. مواصفات توقيع عتاد Android (Hardware Keystore Signature)

إذا كان الجهاز مسجلاً ولديه مفتاح عام مسجل في `employee_devices.public_key`:
1. **الخوارزمية:** `SHA256withECDSA` على منحنى `secp256r1` (NIST P-256).
2. **صيغة التوقيع:** **ASN.1 DER** المرمزة بـ **Base64** (الصيغة القياسية الافتراضية الصادرة من `java.security.Signature.getInstance("SHA256withECDSA")`).
3. **النص المعياري الموقّع (Canonical Payload):**
   ```
   {userId}:{requestAction}:{deviceId}:{verificationProof}:{lat}:{lng}:{capturedAt}
   ```
   - مثال:
     `a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d:check_in:dev_pixel8_001:vp_7f8a9b0c:30.0444:31.2357:2026-10-27T10:15:30.000Z`
4. يتم تمرير التوقيع الناتج في حقل `device_signature`. وفي حال كان التطبيق يعمل كـ PWA عبر المتصفح دون Keystore عتادي، يُرسل كـ `null`.
