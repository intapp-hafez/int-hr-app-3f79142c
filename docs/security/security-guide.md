# INT HR Security Remediation Guide

This guide explains what to fix, how to implement the fixes, and how to verify them. It is a plan, not evidence that the application is secure or that any migration has been deployed.

Scope: Supabase authentication, database authorization, attendance, face enrollment and matching, liveness, replay prevention, device verification, and supporting APIs in both `src/` and `int-hr-app/src/`.

The latest source review found improvements in `supabase/functions/biometric-auth/index.ts`: finite-number descriptor validation, disabled direct face login, and a challenge/proof pipeline. However, permissive database writes and an older active verification flow still bypass those protections. Production policies and deployed functions have not been inspected.

## 1. Establish the actual deployed state

Before implementation, inventory the deployed frontend version, Edge Function versions, applied migrations, table privileges, RLS policies, triggers, and callable SECURITY DEFINER functions. Compare them with the repository, including `deployments/` and both app copies.

Do not assume a migration is installed because its file exists. In particular, inspect the effective state associated with `supabase/migrations/20261028160000_secure_face_attendance_pipeline.sql` and any later migrations. Its name says secure, but it explicitly retains employee attendance writes, descriptor management, and legacy token management.

Use a separate staging project with synthetic employees and biometric data for verification. Define expected access for anonymous users, employees, managers, HR, and administrators before changing policies.

## 2. High priority: close direct attendance writes

### Problem

The attendance self-insert and self-update policies accept ownership as sufficient authorization. A caller can use the Supabase Data API directly without running face verification, liveness, device approval, geofence checks, or browser rate limits.

Relevant files:

- `supabase/migrations/20260607185929_8f0f060c-80c1-402f-91a9-ef35f811c9e5.sql`
- `supabase/migrations/20261028160000_secure_face_attendance_pipeline.sql`
- `src/backend/functions/attendance.functions.ts`
- `int-hr-app/src/backend/functions/attendance.functions.ts`
- Both copies of `src/lib/start-shim.ts` and `vite.config.ts`

### Implementation

1. Route employee check-in and check-out through one trusted backend shared by both app copies.
2. Authenticate the JWT on the backend and derive the employee ID from that verified identity. Never trust a submitted employee ID or browser role.
3. Remove employee direct INSERT and UPDATE access to attendance. Keep necessary SELECT access scoped by RLS.
4. Preserve administrative correction workflows through explicitly authorized operations. Record the actor, old and new values, reason, and timestamp.
5. In one database transaction, validate the account and device, lock and consume the proof, enforce attendance transitions, and write the punch using database time.
6. Enforce check-in/out ordering, duplicate protection, applicable work-day and leave rules, and location requirements in that trusted operation. Keep a clear policy for overnight shifts.
7. Review all existing policies: adding a stricter permissive policy does not cancel a broader permissive policy. Remove or replace obsolete allowances.

### Acceptance checks

- An employee JWT cannot directly insert attendance or modify timestamps, employee IDs, location results, or verification flags.
- Anonymous callers cannot write attendance.
- Legitimate backend attendance succeeds and scoped reports still work.
- A second check-in or check-out cannot silently overwrite an earlier punch.
- Manager reads remain limited to their authorized employee scope. Review the newer migration's broad `has_role(..., 'manager')` read condition.

## 3. High priority: retire the legacy biometric token path

### Problem

`src/routes/employee.check.tsx` still calls `verifyFace` in `src/backend/functions/biometrics.functions.ts`. That browser-executed handler compares a submitted descriptor and creates a legacy token. The database permits users to create and update their own `biometric_verification_tokens` rows, so those rows are not trusted proof.

### Implementation

1. Integrate the active screen with the trusted begin-verification, verify-face, and commit-attendance flow only after the server-side verification described below is implemented.
2. Remove browser issuance and mutation of verification tokens. Restrict challenge, proof, and idempotency tables to trusted operations.
3. Retire legacy token consumers and fallback routes in both app copies. Reject legacy tokens at every attendance entry point.
4. Generate proof secrets with a cryptographically secure random generator and store only their hashes.
5. Bind proofs to the authenticated user, device, exact action, issuing challenge, and server-defined expiration. Do not use an interchangeable generic attendance action.
6. Consume the proof atomically with the attendance write. A failed attendance transaction must not leave a successful punch without its corresponding proof state.
7. Implement idempotent retries: identical authorized requests return the original result; changed parameters or another user produce a conflict.

### Acceptance checks

- Direct client token/proof creation, expiry extension, deletion, and resetting consumed state are denied.
- Wrong-user, wrong-device, wrong-action, expired, and already-consumed proofs fail.
- Parallel requests using one proof produce at most one punch.
- Identical retries return the same result without creating another punch.

## 4. High priority: verify identity and liveness from the same capture

### Problem

The new `verifyVisualKeyframesLiveness` implementation in `supabase/functions/biometric-auth/index.ts` checks headers, compressed-byte entropy, byte differences, and client-supplied step labels and timestamps. These checks do not establish that a face blinked or turned. The matching descriptor is submitted separately and is not derived by the server from the supplied images.

Different image bytes are not evidence of live facial motion. A fresh challenge does not make a reusable client descriptor trustworthy.

### Implementation

1. Use a trusted face-verification and presentation-attack-detection service, or implement equivalent inference in a trusted backend. Evaluate its actual replay and camera-injection resistance before relying on it.
2. Decode media with a real image/video decoder. Enforce request size, dimensions, frame count, duration, and processing limits before expensive inference. Reject malformed media rather than substituting default dimensions.
3. Detect faces and derive the matching embedding from that same validated capture on the trusted side. Do not accept an independent client descriptor as authoritative identity evidence.
4. Evaluate the requested facial actions from decoded frames, check temporal continuity and consistent identity, and reject multiple faces or identity changes.
5. Use unpredictable, short-lived server challenges. Generate selections with cryptographic randomness and provide enough challenge variation; four fixed sequences alone offer limited replay resistance.
6. Bind the verification result to the challenge, user, device, and exact attendance action before issuing proof.
7. Fail closed when media decoding, inference, or presentation-attack detection is unavailable. Provide a separately authorized, audited exception workflow.
8. Keep the current header/entropy checks only as input heuristics, not as a liveness verdict.

### Acceptance checks

- Missing media, fabricated action labels, unrelated images, and replayed descriptors do not produce proof.
- Test printed photos, screen-displayed photos, recorded blinking videos, replayed challenge clips, frame substitution, virtual-camera input, and face changes during capture.
- Measure false accept and false reject rates under representative devices, lighting, and user conditions. Document remaining limitations; a browser cannot guarantee a trustworthy physical camera source.

## 5. High priority: protect enrollment and biometric templates

### Problem

The face descriptor policy allows users to read, replace, and delete their own templates directly. This bypasses application re-enrollment approval and enables exact descriptor replay. Admin/HR template reads increase exposure of reusable biometric material.

Relevant files: `src/backend/functions/biometrics.functions.ts`, `docs/migrations/053-face-reenroll.sql`, and the descriptor policies in the biometric migrations.

### Implementation

1. Restrict template reads and writes to the trusted verifier/enrollment service. Return enrollment status and timestamps to the UI instead of raw descriptors.
2. Require recent authentication and an approved identity-binding process for enrollment. A face being present does not prove it belongs to the employee account.
3. Enforce re-enrollment approval server-side and consume one-time approval atomically with template replacement.
4. Prevent deleting a template from becoming an alternative route around re-enrollment approval.
5. Define encryption, access logging, retention, deletion, and incident-response procedures for templates and capture media. Avoid persisting capture media unless necessary; never put descriptors or image payloads in routine logs.
6. Treat disclosed templates as compromised. Assess whether re-enrollment and removal of descriptor-based login are required; biometric material is not a conveniently replaceable password.

### Acceptance checks

- Employees cannot retrieve raw templates or directly insert/update/delete them.
- HR cannot bulk-read templates unless an explicitly justified workflow requires it.
- Unapproved re-enrollment fails through the UI, Data API, and backend.
- An approved replacement consumes approval exactly once and produces an authoritative audit event.

## 6. Protect profile controls and device approval

### Implementation

- Replace table-wide employee profile UPDATE privileges with an explicit allowlist of editable contact/preferences fields. Protect `face_required`, `face_reenroll_allowed`, `device_check_required`, `approved_work_date`, role-related fields, reporting relationships, employment status, and compensation fields.
- Keep authorization based on authenticated `user_roles`, as required by `AGENTS.md`. A browser role check is only UI behavior.
- Require employee device inserts to start as pending with no approval metadata. Existing ownership-only INSERT policies permit a caller to choose an approved status.
- Make approvals, revocations, and device key replacement trusted, audited operations.
- Require proof of possession of the registered device key when device binding is enabled. The current Edge Function checks signatures only when `public_key` exists; define and enforce how keyless devices are rejected or explicitly exempted.
- Handle device-policy lookup errors by rejecting protected operations, rather than silently disabling the device requirement.

### Acceptance checks

- Employees cannot disable face/device requirements or grant themselves work-day exceptions.
- A client cannot register a device as approved, assign approval metadata, or replace an approved key.
- A copied device identifier without the corresponding private key fails protected attendance.
- Revoked devices and lookup failures cannot obtain a successful protected punch.

## 7. Authentication and privileged APIs

1. Keep direct passwordless face login disabled. Check `deployments/functions/biometric-auth/index.ts`, `scripts/biometrics-dev-api.ts`, legacy RPCs, and frontend fallback code for any remaining session-minting path based only on a descriptor. Do not expose the development API publicly.
2. Validate every descriptor element and calculated distance as finite numbers wherever legacy matching remains temporarily accessible. Reject malformed stored templates too.
3. Review `supabase/functions/create-employee-account/index.ts`: explicitly prevent HR callers from creating admin accounts unless that authority is intentionally granted. Use a server-enforced role-assignment matrix.
4. Preserve the existing password-change architecture: use the isolated `send-smtp-email` account-password action, verify the session and admin role before Auth Admin calls, and keep privileged keys out of browser code.
5. Add atomic server-side rate limits to verification, enrollment, and privileged operations. Keep external authentication errors generic and do not return matching distances to unauthenticated callers.
6. Move WebAuthn server operations into a real trusted runtime. The SPA shim cannot provide a server request or service-role challenge storage. Require `userVerification: 'required'` and `requireUserVerification: true` when local verification is a requirement. Describe the feature as passkey/authenticator verification, since WebAuthn does not prove that a fingerprint specifically was used.
7. Restrict SMTP outbound hosts/ports to approved configuration and require TLS before authentication. Avoid arbitrary caller-selected network destinations.

## 8. Location and audit integrity

- Validate location bounds, accuracy, freshness, and geofence membership on the trusted backend. Recognize that browser-supplied GPS, accuracy, timestamps, and SSIDs remain forgeable even when signed by a client-controlled device.
- Use trusted network observations or managed-device/onsite evidence when stronger physical-presence assurance is required. Do not describe an SSID string comparison as independent network verification.
- Derive stored verification outcomes from trusted checks, not supplied flags.
- Write authoritative security events from trusted services or database triggers. Bind the actor to verified identity, record success/failure and reason, and avoid client-controlled attribution.
- Restrict anonymous and authenticated direct insertion into authoritative biometric logs. Keep untrusted client telemetry separate and rate-limited.
- Record separate evidence for check-in and check-out so a check-in face flag cannot be mistaken for proof of checkout verification.

## 9. Rollout and regression verification

Prepare forward migrations rather than silently editing migration history. Inspect current deployed state first, and review the effective combination of grants, permissive policies, restrictive policies, and function execution privileges. Keep SECURITY DEFINER functions narrowly scoped, use a fixed safe search path, and revoke execution from public/client roles unless intentionally needed.

Deploy and verify in staging before production. Coordinate client integration with permission changes so the old browser flow does not become the only available route. Do not preserve a bypass as a compatibility fallback. Provide a separately authorized attendance correction process during transition.

Use integration tests against an isolated Supabase instance, not only copied validation logic and mocks. Include direct Data API calls, role/scope checks, malformed vectors/media, proof replay, concurrent consumption, device revocation, enrollment approval, and idempotent retries. Keep real employee biometric data out of test fixtures.

Verify both app copies and all deployment artifacts use the same trusted attendance boundary. Preserve matching grouped-attendance modules, paginated RLS-scoped reads, and pure timestamp aggregation as required by `AGENTS.md`.

After deployment, verify the actual database policies and function versions again. Monitor rejected verification attempts, repeated proof use, device changes, administrative overrides, and unexpected direct-write attempts. Tighten CSP by removing unnecessary `unsafe-inline` and `unsafe-eval` allowances as a separate defense-in-depth task.

## Completion criteria

- Every employee attendance write passes through the trusted verification/commit boundary.
- Clients cannot create or modify verification evidence or authoritative audit results.
- Face identity and liveness are established from the same fresh capture.
- Enrollment, profile controls, privileged roles, and device approvals have server-enforced authorization.
- Replay and concurrency tests pass against real database permissions in staging.
- Both frontend copies and deployed artifacts are verified, with any remaining biometric limitations documented.

Creating this guide does not apply any of these changes. Application changes, database migrations, and deployments require a separate implementation task.
