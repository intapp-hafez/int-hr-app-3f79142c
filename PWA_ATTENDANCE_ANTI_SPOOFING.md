# PWA Attendance Anti-Spoofing Hardening

**Project:** Existing employee attendance Progressive Web App (PWA)  
**Audience:** Antigravity coding agent / security reviewer  
**Status:** Ready for repository inspection and phased implementation  
**Non-negotiable:** Preserve existing functionality and data. Do not convert the PWA to a native Android/iOS app.

## 1. Mission

Audit and strengthen the existing employee attendance system against fake GPS, browser location overrides, fabricated requests, device impersonation, token replay, and remote check-ins. Employees may use either **corporate Wi-Fi or mobile data (4G/5G)**. Both must remain supported. Use a defense-in-depth, zero-trust architecture. No individual browser-reported signal proves physical presence.

**Security truth:** A PWA cannot reliably read OS-level mock-location flags or provide universal native device attestation. Multiple GPS samples, Haversine calculations, reverse geocoding, client-reported Wi-Fi SSIDs, IP geolocation, face verification, and WebAuthn do **not** independently prove workplace presence. Do not promise 100% spoofing prevention.

## 2. Operating Instructions for Antigravity

1. **Read the repository before editing.** Inspect application architecture, framework versions, API endpoints, database schema, authorization, existing tests, deployment settings, and relevant docs. Verify actual file paths; filenames below are hints, not proof they exist.
2. **Do not change any files during the first audit pass.** Produce an evidence-based security report with precise file/line references, confirmed vulnerabilities versus hypotheses, threat model, compatibility risks, and an incremental implementation plan.
3. **Do not rewrite or redesign the application.** Preserve current UI/UX, attendance semantics, existing workflows, working APIs, employee records, and data. Use additive changes and reversible migrations. Do not remove existing controls until a tested replacement is available.
4. **Before any migration, deployment, destructive operation, dependency replacement, or change to security policy, present the proposed diff and rollback plan for approval.** Do not run production migrations or deploy without explicit authorization.
5. Work in a dedicated branch; make small, reviewable changes; write tests before or alongside changes; keep secrets out of source control and logs.
6. If an external service, network controller, hardware, biometric vendor, or credential capability is unavailable, report the dependency and implement a safe, configurable fallback; never silently pretend a control is verified.
7. **Never mark an attendance event ACCEPTED solely because submitted coordinates are within the fence.** Where strong workplace-presence proof is unavailable, route according to the approved policy (for example, pending verification or manual review), not silent acceptance.
8. Preserve the ability to test privately on a local/self-hosted environment before a limited pilot and later production rollout.

## 3. Existing Components to Inspect

- `employee.check.tsx`: client location acquisition, preview distance, UI errors, retry and permission handling.
- `attendance.functions.ts`: `evaluateFence()`, `distMeters()`, server check-in/check-out decisions, `network_assignments`, device checks, request authentication, and logging.
- `FaceCapture.tsx`: face capture, liveness workflow, server verification, token issuance and consumption.
- `assertDeviceAllowed()`: registered-device identity and approval logic.
- `validateAndConsumeBioToken()`: single-use biometric token storage, atomicity, expiration and action binding.
- `reverseGeocodeCoords()`, `requestIp()`, `enforceAttendanceRateLimit()`.
- `selfie.md`, especially Phase 12.
- Related API routes, middleware, database tables, geofence settings, RBAC, audit events, service worker, offline queue, WebAuthn flows and security tests.

Treat the above as **claims requiring source-code verification**, not as guaranteed implemented behavior.

## 4. Threat Model

Protect against:

- Browser developer-tools geolocation overrides, extensions, scripted requests, proxy interception and forged JSON payloads.
- Emulators, modified browsers, stolen sessions, copied client device IDs and unauthorized devices.
- Remote biometric completion combined with spoofed GPS; reused, stolen, mismatched or concurrent-use biometric tokens.
- Fake or client-asserted SSIDs, malicious lookalike hotspots, spoofed public IP location and VPN/proxy effects.
- Shared, photographed or live-relayed workplace QR challenges; collusion among employees.
- Rapid geofence probing, replay, duplicate attendance, timestamp tampering and implausible travel.
- Legitimate users with indoor GPS drift, disabled permissions, mobile data, network outages, accessible-device needs, and multiple offices.

Document trust boundaries: **browser input is untrusted**; only server-side checks, verified cryptographic responses and independently authenticated infrastructure provide stronger evidence. Protect against insider misuse and administrator override abuse.

## 5. Target Architecture

1. Authenticated employee initiates check-in/out.
2. Server issues a cryptographically random, short-lived, one-time attendance challenge bound to employee, session, intended action and, where feasible, approved device credential.
3. PWA collects fresh location readings with `navigator.geolocation.watchPosition` or appropriate browser API, requests high accuracy, records accuracy and timestamps, and reports measurement uncertainty. It must not claim that repeated readings prove authenticity.
4. Server independently validates location schema, freshness, uncertainty and assigned geofences.
5. Server verifies a fresh, challenge-bound WebAuthn assertion where supported and configured. WebAuthn authenticates credential possession/user verification, **not location**. Synced passkeys are not necessarily tied to a single physical device.
6. Server validates face/liveness evidence and atomically consumes a short-lived, action/session-bound biometric token. Face verification proves identity only to the strength of the provider; it does not prove location.
7. Server evaluates independently verified workplace presence: trusted network-controller association when available, a supervised kiosk, or a short-lived on-site challenge with explicit relay limitations. Both Wi-Fi and mobile-data paths must remain functional.
8. Server checks travel anomalies, replay, abuse, concurrency, policy exceptions and configurable risk signals.
9. Server records `ACCEPT`, `REVIEW`, or `REJECT` plus structured reason codes, policy version, evidence provenance and audit timestamps. Hard failures must not be overridden by a low risk score.

## 6. Detailed Requirements

### 6.1 Server-Side Geofencing

- Validate latitude in [-90, 90], longitude in [-180, 180], finite numeric values, allowed coordinate precision and request size.
- Reject absent, malformed, stale, non-finite or implausible measurements; use server receipt time as authoritative event time, not client timestamps.
- Retain correct Haversine great-circle distance (`distMeters()`), but **never** treat a small computed distance as authenticity proof.
- Apply uncertainty-aware geometry: `distance + reportedAccuracy <= radius` suggests the claimed accuracy circle fits inside; `distance - reportedAccuracy > radius` suggests it is outside; otherwise the boundary is uncertain. These are heuristics because the client supplies both coordinates and accuracy, and reported accuracy is not a guaranteed containment bound.
- Define configurable max age, accuracy limits, sample count and sampling duration; avoid rigid thresholds until field-tested. Distinguish stale location, weak accuracy, outside fence, and uncertain boundary.
- Support multiple authorized worksites, appropriate shift policies, geofence exceptions and clear retry/manual-review flows.
- Client distance previews are advisory only; server makes the decision.

### 6.2 GPS Telemetry and Anomalies

- Collect a small bounded set of fresh measurements, with cancellation, timeouts and battery-conscious operation.
- Evaluate staleness, jumps, identical repeated values, unrealistic movement and reported accuracy; do not automatically label static readings or `accuracy=0` as fraud without context.
- Compute impossible travel from recent **trusted** location events using elapsed server time, distance and plausible travel bounds; handle uncertain historical records and travel exceptions.
- Never use IP/GPS disagreement as a sole reject rule; VPNs, carrier NAT, proxies and inaccurate IP geolocation are common.

### 6.3 Corporate Wi-Fi and 4G/5G

- Do not rely on browser-accessible SSID/BSSID: standard PWAs cannot generally retrieve or securely attest these values.
- Do not trust a client-provided SSID, claimed connection type, Wi-Fi name, MAC address, or `network_assignments` assertion as proof of physical presence.
- If a corporate WLAN controller/RADIUS/NAC system is available, evaluate an authenticated, recent device-to-access-point association from that **trusted infrastructure**, including identity mapping, freshness, replay resistance, privacy and failure handling.
- An employee on mobile data must not be automatically rejected or penalized. Provide another independently verifiable presence route.
- If the enterprise network integration does not exist, document it as an optional infrastructure dependency rather than simulating success.

### 6.4 Workplace Presence: Hybrid Strategy

Implement a **pluggable presence-verification policy**, with at least these modes:

- **Trusted network association:** server-to-controller verified when available, not browser asserted.
- **Supervised kiosk:** authenticated on-site terminal or authorized supervisor confirms presence using a short-lived challenge and a logged approval action; protect supervisor accounts and audit overrides.
- **Rotating workplace QR:** server-issued nonce, short expiration, one-time use, site/action/session binding, atomic consumption, rate limiting and replay protection. **A QR can be photographed, shared or live-relayed; treat it as supplementary evidence, not conclusive physical-presence proof.** A QR-only flow should not be described as relay-proof.
- **Fallback/manual review:** when GPS or proximity cannot be established, create a pending case rather than fabricate verified presence. Make exceptions time-bound, role-restricted and auditable.

Ensure both Wi-Fi and 4G/5G employees can complete a valid attendance workflow. Propose hardware/infrastructure costs separately; do not assume new equipment exists.

### 6.5 Device Registration and WebAuthn

- Audit `device_id` generation and server validation; assume arbitrary client-supplied IDs can be forged or copied.
- Introduce server-challenge verification using WebAuthn credentials on HTTPS origins where browser/platform support permits.
- Store credential IDs/public keys/counters and credential metadata securely; protect enrollment, re-enrollment, recovery and revocation.
- Do not claim WebAuthn proves GPS location or a unique physical handset; synced passkeys and platform behavior may limit device binding.
- Apply risk-aware fallback for unsupported browsers or lost devices with explicit administrative review.
- Do not add native Android/iOS APIs or require a native app.

### 6.6 Face/Liveness and Single-Use Tokens

- Audit the existing liveness provider and spoof resistance; a selfie or camera stream alone does not guarantee liveness.
- Bind biometric proof to employee, authenticated session, attendance action, challenge ID and expiration, and to credential where feasible.
- Validate and consume the token **atomically** on the server (transaction or equivalent); prevent parallel reuse and race conditions.
- Ensure no tokens, raw face images or sensitive biometric artifacts are logged; enforce retention, encryption, access control and applicable privacy obligations.
- Support a documented accessibility and non-biometric exception route where legally/operationally required.

### 6.7 Risk Engine and Decision Policy

- Separate **hard controls** (authentication failure, replay, invalid token, revoked credential, clear outside-fence event under approved policy) from **advisory signals** (poor GPS, IP mismatch, missing optional Wi-Fi, improbable travel).
- Make weights, thresholds and reason codes configurable and versioned. Any sample values are illustrative and must be calibrated using real data and false-positive review.
- Decisions: `ACCEPT` (all mandatory controls and required presence evidence pass), `REVIEW` (uncertain/incomplete evidence), `REJECT` (confirmed policy/security failure).
- Record each decision's policy version, evaluated evidence, source/provenance, decision time and reason codes. Prevent client control over the final decision.

### 6.8 Rate Limits, Abuse and API Security

- Apply rate limits per account, session, credential, IP and action with safe handling for shared carrier IPs.
- Add idempotency keys and database constraints to prevent duplicate concurrent check-ins.
- Validate authorization and site assignments on every server request; use CSRF protections if cookie-authenticated, origin checks where appropriate, secure cookies and HTTPS.
- Prevent geofence enumeration through generic public error detail; retain precise internal reason codes for authorized audits.
- Reject reused challenges, expired tokens, mismatched actions and cross-employee requests.

### 6.9 Audit, Privacy and Admin Dashboard

- Audit attempt ID, employee/site, trusted server time, coordinates and accuracy when justified, credential reference, network evidence provenance, biometric result (not raw biometric content), anomaly signals, policy version, decision and actor for overrides.
- Protect logs from unauthorized alteration; restrict access by role, encrypt sensitive data and define retention/deletion policies.
- Reverse geocoding is for human-readable audit display only; it does **not** verify authenticity.
- Build or specify an admin review view: pending cases, reasons, evidence, decisions, overrides, appeal path and metrics for false positives.

## 7. Suggested Data Model (Adapt to Existing Schema)

Do not create these tables blindly. First map the current schema and reuse existing entities where suitable.

- `attendance_challenges`: id, employee_id, session_id, action, credential_reference, site_id, issued_at, expires_at, consumed_at, status, nonce_hash.
- `attendance_attempts`: id, employee_id, site_id, action, server_received_at, claimed_lat, claimed_lng, accuracy_m, sample_metadata, presence_method, presence_verification_status, decision, reason_codes, policy_version.
- `device_credentials`: employee_id, credential_id, public_key, counter/metadata, status, enrolled_at, revoked_at.
- `presence_evidence`: attempt_id, evidence_type, trusted_source, challenge_id, verified_at, expires_at, verification_result, metadata.
- `attendance_risk_events`: attempt_id, signal_code, severity, score, evidence_summary.
- `attendance_review_cases`: attempt_id, reviewer_id, disposition, reason, created_at, resolved_at.

Use minimal data collection, retention limits, appropriate indexing and transactional uniqueness for one-time tokens/challenges.

## 8. Implementation Phases

### Phase 0 — Read-only security audit

Map existing check-in and check-out paths, trust boundaries, authentication, device registration, biometrics, Wi-Fi assumptions, geofences, offline PWA behavior, database transactions, and current tests. Report findings with file/line evidence. **Stop for approval before editing.**

### Phase 1 — Safe server hardening

Input validation, authoritative timestamps, token/challenge atomicity, idempotency, server authorization, audit reason codes, rate limits, uncertainty handling and appropriate review fallback. Add tests and reversible migrations.

### Phase 2 — Risk and device credentials

Impossible-travel checks, configurable risk policy, WebAuthn enrollment/authentication and recovery, monitoring and fraud-review tooling. Preserve existing user access through approved transition flows.

### Phase 3 — Hybrid workplace verification

Design and integrate trusted network verification if infrastructure supports it; add rotating QR as **supplementary** evidence and supervised kiosk/approved manual fallback. Do not require corporate Wi-Fi for 4G/5G employees. Clearly state relay risks.

### Phase 4 — Local validation and limited pilot

Test locally/self-hosted first; exercise family/friend/colleague devices where appropriate for roughly 2–3 months of private reliability testing, then a limited company pilot, then controlled rollout with rollback and monitoring. Do not deploy automatically.

## 9. Required Security Test Matrix

Include unit, integration, API, concurrency and browser/PWA tests for:

1. Genuine employee on corporate Wi-Fi inside fence.
2. Genuine employee on 4G/5G inside fence.
3. Employee outside fence submitting honest GPS.
4. Developer-tools GPS override and forged request coordinates.
5. Low-accuracy indoor reading and fence-edge uncertainty.
6. Missing permission, stale cached position, timeout and offline behavior.
7. Forged SSID and lookalike Wi-Fi network; absence of Wi-Fi.
8. Unregistered, revoked, copied and pending device IDs/credentials.
9. Valid, expired, reused, wrong-user, wrong-action and parallel biometric tokens.
10. Replay and parallel consumption of workplace challenges and QR codes.
11. QR photograph/share/live relay threat (document residual exposure; do not falsely mark as solved).
12. Impossible travel, false-positive GPS jump and travel exception.
13. VPN, mobile carrier NAT, shared public IP and IP/GPS mismatch.
14. Repeated probes, rate-limit bypass attempts, duplicate check-ins and race conditions.
15. Multiple sites, changed assignments, unauthorized geofence and shift exceptions.
16. Lost credential, passkey synchronization, recovery and accessibility exceptions.
17. Admin review, override authorization, audit immutability and rollback.
18. Browser differences on Android Chrome and iOS Safari installed PWAs.

## 10. Acceptance Criteria

- A fabricated location within a geofence is **not by itself sufficient** for accepted attendance.
- Server recomputes every authoritative geofence decision and verifies mandatory session/action bindings.
- Forged `device_id` and client-submitted SSID are never accepted as independent proof.
- Token and challenge reuse fail, including concurrent replay.
- Both corporate Wi-Fi and 4G/5G employees have supported check-in paths.
- Uncertain evidence leads to review/approved exception, not false claims of verified presence.
- Security errors are auditable without exposing sensitive details to clients.
- Existing attendance functionality and historical data remain intact; migrations are reversible.
- Tests cover normal behavior, adversarial behavior and false positives.
- Residual limitations of PWA geolocation and QR relay are explicitly documented.

## 11. Expected Deliverables from Antigravity

1. **Read-only audit report** with exact repository paths, line references, severity and exploit preconditions.
2. **Threat model and trust-boundary diagram** reflecting actual code.
3. **Prioritized implementation plan** with dependencies, expected UX impact and security tradeoffs.
4. **Proposed changes and migration/rollback plan** for approval.
5. **Incremental implementation** only after approval, with small diffs and comments where necessary.
6. **Automated test suite and reproducible local test instructions**.
7. **Administrator operations guide**, monitoring and exception workflow.
8. **Final verification report** listing implemented, partially implemented, deferred and unsupported controls.

## 12. First Message / Immediate Agent Action

**Start with Phase 0 only.** Read the repository and determine how attendance actually works today. Identify the most serious verified spoofing and trust-boundary issues. Show me your findings, exact files/lines, a minimal-change phased fix plan, any questions or external infrastructure dependencies, and a rollback strategy. **Do not edit code, run migrations, install packages, change configuration or deploy until I explicitly approve the plan.**
