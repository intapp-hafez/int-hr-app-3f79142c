# Biometric authentication (face + fingerprint)

Add two on-device biometric methods used for both **employee check-in/out** and **login**:

- **Face recognition** — runs in the browser via `face-api.js` (TinyFaceDetector + face landmark + face recognition models). A 128-d descriptor is stored per employee in Supabase; verification compares Euclidean distance against the stored descriptor (threshold ≈ 0.5).
- **Fingerprint** — WebAuthn platform authenticator (Touch ID / Windows Hello / Android fingerprint) via `@simplewebauthn/server` + `@simplewebauthn/browser`. Stores credential public keys per user; verification is a signed challenge.

## Database (new migration)

```sql
-- Face: one descriptor per employee
create table public.face_descriptors (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  descriptor jsonb not null,            -- 128-number array
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- WebAuthn credentials: many per user
create table public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text unique not null,   -- base64url
  public_key text not null,             -- base64url COSE key
  counter bigint not null default 0,
  transports text[],
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Short-lived challenges (registration + authentication)
create table public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  challenge text not null,
  kind text not null check (kind in ('register','authenticate')),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);
```

Plus GRANTs + RLS (users read/write only their own rows; service role for admin ops). Attendance gets two flag columns: `verified_face boolean`, `verified_fp boolean`.

## Packages

```
bun add face-api.js @simplewebauthn/server @simplewebauthn/browser
```

`face-api.js` model weights (~2 MB) placed under `public/models/` (downloaded from the official `face-api.js` weights repo): `tiny_face_detector`, `face_landmark_68`, `face_recognition`.

## Server functions (`src/backend/functions/biometrics.functions.ts`)

All require `requireSupabaseAuth`:

- `enrollFace({ descriptor: number[128] })` — upsert into `face_descriptors`.
- `verifyFace({ descriptor })` — fetch stored descriptor, compute distance, return `{ match, distance }`. Used by check-in.
- `getFaceDescriptor()` — returns the user's descriptor so the browser can compare locally during login (acceptable since we still require the user's password OR session).
- `webauthnRegisterOptions({ label })` — generate registration options, persist challenge.
- `webauthnRegisterVerify(response)` — verify with `@simplewebauthn/server`, insert credential.
- `webauthnAuthOptions()` — list user's credentials, generate auth options, persist challenge.
- `webauthnAuthVerify(response)` — verify assertion, bump counter, return `{ ok }`.
- `listBiometrics()` / `deleteWebauthnCredential({ id })` / `deleteFace()` — management.

## UI

1. **Reusable components** (`src/components/biometrics/`):
   - `FaceCapture.tsx` — webcam + face-api.js, emits a 128-d descriptor.
   - `FingerprintButton.tsx` — wraps `startRegistration` / `startAuthentication`.
2. **Enrollment page** — new tab on `/employee/settings` ("Biometrics") with two cards:
   - Face: shows enrolled status, "Re-enroll" button opens capture modal.
   - Fingerprint: lists registered devices, "Add this device" button.
3. **Check-in (`/employee/check`)** — after location/network checks pass, require *either* face OR fingerprint when the employee has enrolled. Store `verified_face` / `verified_fp` on the attendance row. If neither is enrolled, fall back to current behavior with a soft warning.
4. **Login (`/auth`)** — add two extra buttons under the password form:
   - "Sign in with fingerprint" — uses WebAuthn (server returns a session via Supabase admin `generateLink` → `verifyOtp` flow keyed to the verified user).
   - "Sign in with face" — opens webcam, compares descriptor, then logs in the matched user. Email field is required to scope the lookup (so we don't search all faces).

## Security notes

- All challenges are single-use and expire in 5 minutes.
- WebAuthn `rpID` derived from request origin (`new URL(getRequest().url).hostname`).
- Face descriptors are biometric data — protected by RLS, never exposed to other users.
- Login-with-biometrics is gated by an email/identifier the user types so the server can scope the lookup; we do **not** allow blind 1:N face search.

## Out of scope (this round)

- Admin enrollment on behalf of another employee.
- Liveness/anti-spoofing for face (a future enhancement; current scope is convenience, not high-assurance).
- External USB fingerprint scanners.
