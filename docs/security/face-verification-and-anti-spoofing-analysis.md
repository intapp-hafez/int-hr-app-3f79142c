# Face Verification, Liveness Detection & Anti-Spoofing Architecture Analysis

> **Target System:** INT HR Application  
> **Topic:** Comprehensive technical audit of Face Recognition, Face Verification, Liveness Detection, and Anti-Spoofing mechanisms in the codebase.  
> **Date:** October 2026  

---

## Executive Summary

In the INT HR codebase, Face Verification is implemented using **client-side feature extraction via `face-api.js` (TensorFlow.js)** and **server-side Euclidean distance matching** against stored 128-dimensional embedding vectors.

However, **Liveness Detection and Anti-Spoofing are currently not implemented**. While conceptual specifications for liveness detection exist in [`selfie.md`](file:///d:/int/int-hr-app2/selfie.md) (Phase 5), the production code executes a **single-frame, static 2D face detection**. Consequently, the system is unable to detect or prevent Presentation Attacks (such as printed color photos, digital screens, or virtual camera streams).

---

## 1. Libraries and ML Models Used

All facial ML processing is implemented in [`FaceCapture.tsx`](file:///d:/int/int-hr-app2/src/components/biometrics/FaceCapture.tsx).

| Component | Technology | Role / Purpose |
| :--- | :--- | :--- |
| **ML Framework** | [`face-api.js`](file:///d:/int/int-hr-app2/node_modules/face-api.js) | JavaScript wrapper around TensorFlow.js running in the browser. Lazily loaded dynamically (`import("face-api.js")`) on demand to avoid shipping the ~1.5MB library on initial page load. |
| **Detector Model** | `tinyFaceDetector` (`/models/tiny_face_detector_model*`) | A quantized, lightweight MobileNet-based detector configured with `inputSize: 320` to detect the bounding box of a face within the webcam feed. |
| **Landmark Model** | `faceLandmark68Net` (`/models/face_landmark_68_model*`) | Predicts 68 distinct 2D facial landmark points (eyes, eyebrows, nose bridge, nostrils, mouth contour, jawline). |
| **Recognition Model**| `faceRecognitionNet` (`/models/face_recognition_model*`) | A ResNet-34 architecture trained to compute a **128-dimensional floating point vector (`descriptor`)** representing facial features invariant to lighting and minor angle changes. |

The model weights and manifests are hosted locally under the public directory:
- `public/models/tiny_face_detector_model-shard1` & manifest
- `public/models/face_landmark_68_model-shard1` & manifest
- `public/models/face_recognition_model-shard1`, `shard2` & manifest

---

## 2. End-to-End Verification Workflows

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Browser (Webcam)                      │
│                                                                 │
│  videoRef ──► detectSingleFace()                                │
│                └──► withFaceLandmarks()                         │
│                      └──► withFaceDescriptor()                  │
│                             └──► 128-Float Array (descriptor)   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼────────────────────────┐
         │                       │                        │
         ▼                       ▼                        ▼
  1. Enrollment           2. Attendance Check      3. Auth Face Login
┌──────────────────┐    ┌────────────────────┐   ┌────────────────────┐
│ POST /enrollFace │    │  POST /verifyFace  │   │  POST /faceLogin   │
└────────┬─────────┘    └─────────┬──────────┘   └─────────┬──────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐    ┌────────────────────┐   ┌────────────────────┐
│  Check Admin Re- │    │ Calculate distance │   │ Match distance ≤0.5│
│  enroll Switch   │    │ d = sqrt(sum(a-b)²│   │ If OK, mint magic  │
│  Upsert DB row   │    │ Check d <= 0.5     │   │ link OTP session   │
└────────┬─────────┘    └─────────┬──────────┘   └─────────┬──────────┘
         │                        │                        │
         ▼                        ▼                        ▼
public.face_descriptors  public.biometric_audit  Supabase Auth Session
```

### A. Face Enrollment (`mode="enroll"`)
- **UI File:** [`src/routes/employee.biometrics.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.biometrics.tsx)
- **Backend Function:** `enrollFace` in [`src/backend/functions/biometrics.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/biometrics.functions.ts#L23)

1. The employee opens the Biometrics page and launches `<FaceCapture mode="enroll" />`.
2. The webcam stream is captured via `navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 } })`.
3. Clicking **"Capture & save"** executes:
   ```typescript
   const detection = await faceapi
     .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
     .withFaceLandmarks()
     .withFaceDescriptor();
   ```
4. The 128-element `Float32Array` is converted to a regular JavaScript array (`Array.from(detection.descriptor)`).
5. The client submits `enrollFace({ data: { descriptor } })`.
6. **Re-Enrollment Protection:** The server checks if `public.face_descriptors` already contains a row for `context.userId`. If a record exists, it checks `profiles.face_reenroll_allowed`. If false, enrollment is rejected with:
   > *"Re-enrolling your face needs approval. Please ask HR or your admin to allow it."*
7. If allowed, the descriptor is stored in `public.face_descriptors (user_id, descriptor, enrolled_at, updated_at)` and the one-time approval flag is reset to `false`.
8. The event is recorded in `public.biometric_audit_log`.

### B. Verification During Attendance Check-In (`mode="verify"`)
- **UI File:** [`src/routes/employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx)
- **Backend Function:** `verifyFace` in [`src/backend/functions/biometrics.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/biometrics.functions.ts#L66)
- **Attendance Function:** `checkIn` / `checkOut` in [`src/backend/functions/attendance.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/attendance.functions.ts#L47)

1. In `employee.check.tsx`, clicking the face button opens `<FaceCapture mode="verify" />`.
2. A single frame is captured and its 128-float descriptor is extracted.
3. The client calls `verifyFace({ data: { descriptor } })`.
4. The server loads the enrolled descriptor from `public.face_descriptors` for `context.userId`.
5. The Euclidean distance is computed:
   $$d = \sqrt{\sum_{i=0}^{127} (A_i - B_i)^2}$$
6. **Threshold Validation:**
   - Threshold constant: `FACE_THRESHOLD = 0.5`.
   - If $d \le 0.5$, it returns `{ match: true, enrolled: true, distance: d }`.
   - If $d > 0.5$, it returns `{ match: false, enrolled: true, distance: d }`.
7. The result is logged to `public.biometric_audit_log` with the exact distance.
8. On match, the client updates local React state:
   ```typescript
   setVerified((v) => ({ ...v, face: true }));
   setLastDistance(res.distance ?? null);
   ```
9. When the user clicks "Check In", the payload sent to `checkIn` includes:
   ```typescript
   {
     biometric_method: "face",
     biometric_distance: lastDistance,
     lat: coords.lat,
     lng: coords.lng,
     device_id: getCurrentDeviceId(),
     branch: branch
   }
   ```
10. The server validates that `biometric_method === "face"` if `face_required` is enabled on the employee profile.

### C. Face Sign-In (Passwordless Login)
- **UI File:** [`src/routes/auth.tsx`](file:///d:/int/int-hr-app2/src/routes/auth.tsx#L369)
- **Backend Function:** `faceLogin` in [`src/backend/functions/biometrics.functions.ts`](file:///d:/int/int-hr-app2/src/backend/functions/biometrics.functions.ts#L115)
- **Edge Function:** [`supabase/functions/biometric-auth/index.ts`](file:///d:/int/int-hr-app2/supabase/functions/biometric-auth/index.ts)

1. The user enters their email on the login page and selects "Scan face to sign in".
2. The browser captures the frame and extracts the 128-float descriptor.
3. The descriptor and email are submitted to `faceLogin`.
4. The system attempts verification via:
   - Local dev endpoint `/api/biometrics/face-login`.
   - Supabase Edge Function `biometric-auth`.
   - PostgreSQL RPC function `biometric_verify_face`.
5. If the Euclidean distance to the user's enrolled face is $\le 0.5$:
   - The server invokes the Supabase Auth Admin API:
     ```typescript
     const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
       type: "magiclink",
       email,
     });
     const otp = linkData.properties.email_otp;
     const { data: verifyData } = await supabaseAdmin.auth.verifyOtp({
       type: "magiclink",
       email,
       token: otp,
     });
     ```
   - An authenticated JWT session is returned directly to the browser.

---

## 3. Liveness Detection and Anti-Spoofing: Current Status

| Mechanism | Status | Current Implementation Reality |
| :--- | :---: | :--- |
| **Active Liveness (Interactive Challenges)** | ❌ **None** | No requirement for user actions (e.g. blinking, head turn, smile). Single static frame evaluation only. |
| **Passive Liveness (Texture & Depth)** | ❌ **None** | No frequency analysis, moiré pattern detection, or depth estimation. |
| **Multi-Frame Consistency** | ❌ **None** | The system captures exactly **one** video frame upon button press. No temporal tracking. |
| **Replay / Video Detection** | ❌ **None** | Playing a recorded video on a phone screen held in front of the lens produces valid facial landmarks and descriptor. |
| **Cryptographic Challenge-Response** | ❌ **None** | The server does not issue a signed one-time challenge nonce prior to capture. |

---

## 4. Existing Defensive Controls

The codebase contains several supporting defensive controls:

1. **Secure Context Requirement**:
   - `window.isSecureContext` check in `FaceCapture.tsx` blocks camera access over insecure HTTP connections.
2. **Re-Enrollment Authorization Gate**:
   - A one-time administrative flag (`profiles.face_reenroll_allowed`) prevents employees from silently overwriting their enrolled biometric descriptor.
3. **Audit Trail**:
   - Every verification, enrollment, unenrollment, and login attempt is logged into `public.biometric_audit_log` with the exact distance, IP address, user agent, and timestamp.
4. **Layered Attendance Gates**:
   - Face verification is not used in isolation for attendance; it operates alongside GPS geofencing (`computeNearest`), authorized Wi-Fi network checks, and device fingerprint registration (`checkDeviceAccess`).

---

## 5. Potential Spoofing Vulnerabilities & Attack Vectors

### 1. Presentation Attacks (Printed Photos & Digital Screens)
- **Vulnerability**: `tinyFaceDetector` and `faceLandmark68Net` detect facial geometry from 2D pixel matrices without assessing depth or vitality.
- **Risk**: An employee can hold up a printed high-resolution photograph or display an image/video of a colleague on a smartphone screen in front of the camera. The model will extract a valid 128-d descriptor and pass verification.

### 2. Virtual Camera & Feed Injection
- **Vulnerability**: Modern browsers accept video input from software media sources (e.g., OBS Virtual Camera, ManyCam, or custom browser extensions) that emulate a physical webcam.
- **Risk**: An attacker on a desktop or laptop can route any digital image or video directly into `getUserMedia` without using an actual physical camera.

### 3. Client-Side Descriptor Injection (API Replay)
- **Vulnerability**: Feature extraction runs entirely inside the client browser. The client sends the final numerical array (`descriptor: number[]`) to the server. The server never sees the raw image.
- **Risk**: An attacker who obtains their 128-float descriptor (e.g., from the browser's Network DevTools) can issue direct HTTP requests to `verifyFace` or `faceLogin` using `fetch()` or `curl`, bypassing the camera entirely.

### 4. Decoupled Check-In Verification State
- **Vulnerability**: In [`employee.check.tsx`](file:///d:/int/int-hr-app2/src/routes/employee.check.tsx):
  1. `handleFaceCapture` calls `verifyFaceFn`.
  2. If matched, client sets local React state: `setVerified((v) => ({ ...v, face: true }))`.
  3. When "Check In" is clicked, `checkIn` only checks `payload.biometric_method === "face"`.
- **Risk**: The check-in endpoint does not verify that a `verifyFace` event was recorded in the database within the preceding 60 seconds, nor does it require a server-issued one-time biometric token. A modified client script can send `{ biometric_method: "face" }` directly.

---

## 6. Recommended Architecture Roadmap for Anti-Spoofing

To meet enterprise anti-spoofing standards (ISO/IEC 30107-3), the following enhancements are recommended:

### Step 1: Active Liveness (Interactive Challenge-Response)
- Sample 15–30 continuous frames rather than a single frame.
- Calculate the **Eye Aspect Ratio (EAR)** using landmarks 36–47 to require natural blinking:
  $$\text{EAR} = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2 \|p_1 - p_4\|}$$
- Prompt the user with a randomized micro-challenge (e.g., *"Turn head left"*, *"Blink twice"*, *"Smile"*).
- Reject captures if head pose (yaw/pitch angles) remains completely stationary.

### Step 2: Server-Issued One-Time Verification Nonce
- Before opening the camera, the client requests a short-lived challenge token from the server: `POST /api/biometrics/challenge` (valid for 30–60 seconds).
- The `checkIn` server function must require and consume this single-use challenge token, verifying that a successful `verifyFace` event occurred under that token ID in the database.

### Step 3: Passive Texture & Frequency Analysis
- Perform high-frequency Fourier analysis or Local Binary Pattern (LBP) texture analysis on the detected face crop to detect screen pixel grids (moiré patterns) and flat paper reflections.

### Step 4: Encrypted Selfie Snapshot Audit Trail
- Capture a low-resolution compressed snapshot alongside the descriptor.
- Store the snapshot in a private, access-controlled Supabase Storage bucket (`attendance-selfies`) linked to the attendance log row so HR administrators can visually audit flagged or random check-ins.
