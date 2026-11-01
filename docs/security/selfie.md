PROJECT: Secure GPS + Geofence + Selfie Verification
FOR EXISTING HR WEB/PWA SYSTEM

OBJECTIVE
=========
Enhance the existing HR Attendance system so that Employee
Check-In and Check-Out are accepted only when the employee
passes multiple verification layers:

1. Valid authenticated employee account
2. Real GPS location
3. Geofence validation
4. Live selfie
5. Liveness detection
6. Face verification against the employee's registered face
7. Server-side validation
8. Complete audit trail

IMPORTANT:
This is an EXISTING HR SYSTEM.

DO NOT rebuild the application.
DO NOT replace the existing database.
DO NOT delete existing data.
DO NOT break existing Attendance, Employees, Users, Tasks,
Authentication, Roles, Permissions, or APIs.

First inspect the existing system and integrate with it.

==================================================
PHASE 1 — INSPECT EXISTING SYSTEM
==================================================

Before changing code:

Inspect:

- Frontend
- Backend
- Database
- Authentication
- Users
- Employees
- Attendance
- Check-In
- Check-Out
- Roles
- Permissions
- Existing locations/branches
- Existing tasks
- Existing APIs
- Existing notification system

Identify reusable components.

Do not create duplicate employee/user/attendance systems.

Provide an implementation report before making major
architectural changes.

==================================================
PHASE 2 — LOCATION / GEOFENCE
==================================================

Each allowed work location should have:

- Location ID
- Location name
- Latitude
- Longitude
- Allowed radius in meters
- Active/Inactive status

Example:

Branch A
Latitude: XX.XXXX
Longitude: XX.XXXX
Radius: 100 meters

When employee clicks CHECK-IN:

Request the device's current location.

Capture:

- Latitude
- Longitude
- Accuracy
- Timestamp
- Location ID
- Distance from target location

Calculate the distance between the employee and the
authorized location.

Example:

Distance = 42 meters
Allowed Radius = 100 meters

Result:
PASS

If:

Distance = 350 meters
Allowed Radius = 100 meters

Result:
FAIL

Show:

"Check-In unavailable.
You are outside the allowed location."

Do NOT rely only on frontend validation.

The backend must independently validate the coordinates.

==================================================
PHASE 3 — GPS QUALITY
==================================================

Do not accept obviously unreliable GPS data.

Check:

- GPS accuracy
- Timestamp
- Location age
- Coordinates validity
- Impossible coordinates
- Suspicious jumps

Example:

If GPS accuracy is extremely poor:

"Location accuracy is too low.
Please move to an open area and try again."

Make the acceptable accuracy configurable.

==================================================
PHASE 4 — SELFIE
==================================================

When the employee attempts Check-In:

After GPS passes:

Open the camera.

Require a LIVE selfie.

Do not allow simply selecting an old photo from
the device gallery.

The user interface should clearly guide the employee.

Example:

"Center your face inside the frame."

Capture the selfie only after the verification process
is ready.

==================================================
PHASE 5 — LIVENESS DETECTION
==================================================

The system must attempt to determine whether the camera
contains a real person rather than:

- Printed photograph
- Image displayed on another phone
- Screenshot
- Recorded video
- Static image

Use an appropriate liveness detection solution compatible
with the existing architecture.

Do NOT build an insecure fake liveness system based only
on detecting whether a face exists.

If liveness fails:

"Face verification failed.
Please try again."

Allow a configurable limited number of retries.

==================================================
PHASE 6 — FACE VERIFICATION
==================================================

Each employee must have a registered reference face.

IMPORTANT:

This is FACE VERIFICATION, not general face recognition.

Process:

Registered Employee Face
        ↓
Reference Face Representation
        ↓
Live Selfie
        ↓
Liveness Check
        ↓
Face Verification
        ↓
PASS / FAIL

The system should verify:

"Is this selfie the same person as the employee
who is currently authenticated?"

Do not search the entire employee database unnecessarily.

Verify the selfie against the authenticated employee's
registered reference.

Use a configurable similarity/confidence threshold.

Do not hard-code the threshold without documenting it.

==================================================
PHASE 7 — CHECK-IN DECISION ENGINE
==================================================

Check-In should pass only when all required conditions pass.

Example:

Authentication       PASS
GPS                  PASS
Geofence             PASS
GPS Accuracy         PASS
Liveness             PASS
Face Verification    PASS
Permission           PASS

FINAL RESULT:

CHECK-IN APPROVED

If any mandatory verification fails:

CHECK-IN REJECTED

Show the employee a clear reason.

Examples:

Outside allowed location
GPS accuracy too low
Camera permission denied
Liveness verification failed
Face verification failed
Employee not authorized
Location unavailable

==================================================
PHASE 8 — CHECK-OUT
==================================================

Apply the same security process to CHECK-OUT.

Employee:

CHECK-OUT
↓
GPS
↓
Geofence
↓
Selfie
↓
Liveness
↓
Face Verification
↓
Server Validation
↓
CHECK-OUT APPROVED

Do not assume that because Check-In was valid,
Check-Out is automatically valid.

==================================================
PHASE 9 — TASK CHECK-IN / CHECK-OUT
==================================================

IMPORTANT:

Do NOT confuse:

ATTENDANCE CHECK-IN / CHECK-OUT

with:

TASK CHECK-IN / CHECK-OUT

Attendance represents the employee's workday.

Task Check-In / Check-Out represents work on a specific task.

The employee can have multiple tasks during the same
attendance session.

Example:

08:00 Attendance Check-In

08:30 Task A Start
10:30 Task A End

10:30 Travel

11:15 Task B Start
13:00 Task B End

14:00 Task C Start
16:00 Task C End

16:10 Attendance Check-Out

Do not require Attendance Check-Out between tasks.

==================================================
PHASE 10 — DATABASE
==================================================

Reuse existing database structures wherever possible.

Only add fields/tables required for the new functionality.

Potential data:

AttendanceVerification:

- id
- employee_id
- attendance_id
- verification_type
- latitude
- longitude
- accuracy
- location_id
- distance_from_location
- selfie_reference
- liveness_result
- face_verification_result
- verification_score
- verification_timestamp
- status
- failure_reason
- created_at

Do not store unnecessary biometric information.

If face templates/embeddings are used,
store them securely and according to applicable privacy
and security requirements.

==================================================
PHASE 11 — SECURITY
==================================================

Never trust:

- Frontend GPS result
- Frontend face result
- Frontend verification status

The backend must make the final decision.

Client sends verification information.

Backend validates:

- Authenticated employee
- Employee permissions
- Location
- Geofence
- Timestamp
- Verification result
- Attendance state

Then backend creates the official Attendance record.

Prevent users from modifying the verification result
through browser developer tools or API manipulation.

==================================================
PHASE 12 — ANTI-SPOOFING
==================================================

Implement reasonable anti-spoofing controls.

Detect and flag suspicious situations such as:

- Mock location indicators where available
- Impossible location jumps
- Old location timestamps
- Repeated identical coordinates
- GPS accuracy anomalies
- Suspicious device/browser behavior
- Repeated failed face verification

IMPORTANT:

Do not claim that web/PWA GPS can provide 100% protection
against GPS spoofing.

Use a risk-based approach.

Suspicious verification should be:

PASS
FAIL
or
FLAGGED FOR REVIEW

depending on the severity.

==================================================
PHASE 13 — ADMIN DASHBOARD
==================================================

Create:

"Attendance Verification Dashboard"

Admin/authorized HR users can see:

Employee
Date
Check-In time
Check-Out time
Location
GPS accuracy
Distance from location
Liveness result
Face verification result
Verification score
Status
Failure reason

Statuses:

VERIFIED
REJECTED
FLAGGED
PENDING REVIEW

Add filters:

- Employee
- Department
- Branch
- Date
- Verification status
- Location
- Failure reason

==================================================
PHASE 14 — MANAGER VIEW
==================================================

Manager should see verification status for employees
they are authorized to manage.

Example:

Ahmed
Check-In: 08:12
Location: Branch A
Distance: 38m
GPS: Verified
Face: Verified
Liveness: Verified
Status: VERIFIED

Do not expose unnecessary biometric information.

Managers should see the verification result,
not raw biometric data.

==================================================
PHASE 15 — EMPLOYEE EXPERIENCE
==================================================

Employee workflow:

OPEN HR PWA
↓
LOGIN
↓
OPEN ATTENDANCE
↓
CHECK-IN
↓
REQUEST GPS
↓
VERIFY GEOFENCE
↓
OPEN CAMERA
↓
LIVE SELFIE
↓
LIVENESS
↓
FACE VERIFICATION
↓
SERVER VALIDATION
↓
SUCCESS

Success message:

"Check-In completed successfully."

Show:

Time
Location
Verification status

Do not expose technical security information
that could help someone bypass the system.

==================================================
PHASE 16 — FAILED ATTEMPTS
==================================================

If verification fails:

Do not create a valid attendance record.

Create a verification attempt log.

Example:

Employee: Ahmed
Time: 08:15
Location: 2.4 km from Branch A
Result: REJECTED
Reason: OUTSIDE_GEOFENCE

Another example:

Employee: Ahmed
Location: PASS
Liveness: FAIL
Face: NOT VERIFIED
Result: REJECTED

Allow authorized HR/Admin users to review failures.

==================================================
PHASE 17 — PRIVACY
==================================================

Treat selfies and face verification data as sensitive.

Follow applicable privacy/data-protection requirements.

Do not expose employee selfies publicly.

Restrict access using permissions.

Encrypt sensitive data where appropriate.

Define retention rules.

Do not keep more biometric information than necessary.

==================================================
PHASE 18 — AUDIT LOG
==================================================

Record every verification attempt.

Log:

- Employee
- Date/time
- Action
- GPS result
- Geofence result
- GPS accuracy
- Distance
- Liveness result
- Face verification result
- Final decision
- Failure reason
- IP/device metadata if already supported

Audit logs must not be editable by normal employees.

==================================================
PHASE 19 — PWA LIMITATIONS
==================================================

This system currently runs as a WEB/PWA.

IMPORTANT:

Do not assume the PWA has the same capabilities as a
native Android/iOS application.

For the current version:

Use browser Geolocation API.

Use browser camera permissions.

Do not promise continuous background GPS tracking
when the PWA is closed.

Background/live tracking can be implemented later
using a native mobile application if required.

The current objective is secure Check-In / Check-Out,
not continuous employee tracking.

==================================================
PHASE 20 — FUTURE MOBILE APP
==================================================

Design the architecture so a future mobile application
can reuse the same backend APIs.

Future mobile application may provide:

- Background location
- Live technician tracking
- Route history
- Better device integrity checks
- Native biometric capabilities
- Push notifications

Do NOT implement this now unless explicitly requested.

==================================================
PHASE 21 — TESTING
==================================================

Test at minimum:

1. Employee inside geofence
2. Employee outside geofence
3. GPS unavailable
4. Poor GPS accuracy
5. Mock location attempt
6. Correct employee selfie
7. Wrong employee selfie
8. Printed photo attempt
9. Photo displayed on another phone
10. Liveness failure
11. Camera permission denied
12. Multiple failed attempts
13. Check-In
14. Check-Out
15. Employee has multiple tasks
16. Employee travels between tasks
17. Employee loses internet
18. Browser refresh
19. Unauthorized API request
20. Manipulated frontend request

==================================================
PHASE 22 — IMPORTANT ARCHITECTURAL RULE
==================================================

The final attendance decision must be made by the backend.

Frontend:
Collects information and provides UX.

Backend:
Validates information and makes the final decision.

Database:
Stores official attendance and verification audit records.

Admin Dashboard:
Shows authorized verification results.

==================================================
IMPLEMENTATION ORDER
==================================================

STEP 1
Inspect existing application.

STEP 2
Identify existing Attendance/Employee/Location structures.

STEP 3
Design integration without breaking current functionality.

STEP 4
Implement Geofence validation.

STEP 5
Implement camera/selfie flow.

STEP 6
Integrate reliable liveness detection.

STEP 7
Implement face verification.

STEP 8
Implement backend verification decision engine.

STEP 9
Implement audit logs.

STEP 10
Implement Admin/HR verification dashboard.

STEP 11
Implement Manager view.

STEP 12
Perform security and edge-case testing.

STEP 13
Deploy only after testing.

==================================================
CRITICAL REQUIREMENT
==================================================

DO NOT start by rewriting the existing system.

First inspect the existing codebase and database.

Then provide:

1. Current architecture
2. Existing relevant tables/models
3. Existing Attendance workflow
4. Existing authentication/permissions
5. Required database changes
6. Required API changes
7. Required frontend changes
8. Required third-party services/libraries
9. Security risks
10. Implementation plan

WAIT FOR APPROVAL BEFORE MAKING LARGE OR DESTRUCTIVE CHANGES.

The goal is:

REAL LOCATION
+
GEOFENCE
+
LIVE SELFIE
+
LIVENESS
+
FACE VERIFICATION
+
SERVER-SIDE VALIDATION
+
AUDIT LOG

= SECURE ATTENDANCE CHECK-IN / CHECK-OUT