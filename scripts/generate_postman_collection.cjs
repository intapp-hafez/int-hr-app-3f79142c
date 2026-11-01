const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    _postman_id: "int-hr-platform-v2-full-api-collection",
    name: "INT HR Platform API - Complete Server Functions Collection",
    description: "Complete and exhaustive Postman collection for the INT HR Management System (TanStack Start server functions & Supabase Edge Functions). Includes full request schemas, input payloads, authentication tokens, and headers for Employees, Geofencing, Biometrics, Attendance, Leaves, Advances/Solaf, Permissions, Contracts, Custody, KPIs, Tasks, Trips, Payroll, and Security.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    {
      key: "base_url",
      value: "http://localhost:5173",
      type: "string",
      description: "Application host (local dev server or production deployment)"
    },
    {
      key: "supabase_url",
      value: "https://hydakxwzpfzwolencnmp.supabase.co",
      type: "string",
      description: "Supabase project REST and Auth base URL"
    },
    {
      key: "supabase_anon_key",
      value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZGFreHd6cGZ6d29sZW5jbm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNTI1NjcsImV4cCI6MjA2MTYyODU2N30.ZkHlX30H3N7_lF9rD6_V5PzW8xK7J3Y5t8Xb4p9o3",
      type: "string",
      description: "Supabase anonymous public API key"
    },
    {
      key: "jwt_token",
      value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      type: "string",
      description: "Authenticated user JWT access token passed in Authorization: Bearer header"
    },
    {
      key: "sample_employee_id",
      value: "00000000-0000-0000-0000-000000000001",
      type: "string",
      description: "Sample Employee Profile UUID"
    },
    {
      key: "sample_geofence_id",
      value: "00000000-0000-0000-0000-000000000002",
      type: "string",
      description: "Sample Geofence Location UUID"
    },
    {
      key: "sample_leave_id",
      value: "00000000-0000-0000-0000-000000000003",
      type: "string",
      description: "Sample Leave Request UUID"
    },
    {
      key: "sample_advance_id",
      value: "00000000-0000-0000-0000-000000000004",
      type: "string",
      description: "Sample Advance Request UUID"
    }
  ],
  item: []
};

function makeHeaders(auth = true) {
  const headers = [
    { key: "Content-Type", value: "application/json", type: "text" }
  ];
  if (auth) {
    headers.push({ key: "Authorization", value: "Bearer {{jwt_token}}", type: "text" });
  }
  return headers;
}

function makeFnRequest(name, fnEndpoint, payload, description, method = "POST") {
  return {
    name,
    request: {
      method,
      header: makeHeaders(true),
      body: {
        mode: "raw",
        raw: JSON.stringify({ data: payload }, null, 2),
        options: { raw: { language: "json" } }
      },
      url: {
        raw: `{{base_url}}/_server/${fnEndpoint}`,
        host: ["{{base_url}}"],
        path: ["_server", fnEndpoint]
      },
      description
    },
    response: []
  };
}

// 1. Authentication & RBAC
collection.item.push({
  name: "1. Authentication & RBAC",
  item: [
    {
      name: "Supabase Auth - Login (Password)",
      request: {
        method: "POST",
        header: [
          { key: "Content-Type", value: "application/json", type: "text" },
          { key: "apikey", value: "{{supabase_anon_key}}", type: "text" }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            email: "admin@inthr.com",
            password: "SecurePassword123!"
          }, null, 2),
          options: { raw: { language: "json" } }
        },
        url: {
          raw: "{{supabase_url}}/auth/v1/token?grant_type=password",
          host: ["{{supabase_url}}"],
          path: ["auth", "v1", "token"],
          query: [{ key: "grant_type", value: "password" }]
        },
        description: "Authenticate directly with Supabase Auth using email and password to receive access_token and refresh_token."
      },
      response: []
    },
    {
      name: "Supabase Auth - Refresh Token",
      request: {
        method: "POST",
        header: [
          { key: "Content-Type", value: "application/json", type: "text" },
          { key: "apikey", value: "{{supabase_anon_key}}", type: "text" }
        ],
        body: {
          mode: "raw",
          raw: JSON.stringify({
            refresh_token: "your-refresh-token-here"
          }, null, 2),
          options: { raw: { language: "json" } }
        },
        url: {
          raw: "{{supabase_url}}/auth/v1/token?grant_type=refresh_token",
          host: ["{{supabase_url}}"],
          path: ["auth", "v1", "token"],
          query: [{ key: "grant_type", value: "refresh_token" }]
        },
        description: "Refresh expired session JWT using refresh token."
      },
      response: []
    },
    makeFnRequest("Get Current User Profile (getMe)", "getMe", {}, "Fetches the current authenticated user profile, employee code, active status, and primary role."),
    makeFnRequest("Get My Profile Full Details (getMyProfileDetails)", "getMyProfileDetails", {}, "Fetches detailed employee profile, company department, job position, city, and settings."),
    makeFnRequest("Assign Role to User (assignRole)", "assignRole", {
      targetUserId: "{{sample_employee_id}}",
      role: "hr"
    }, "Assigns an administrative or functional role (admin, hr, manager, finance, employee) to a user."),
    makeFnRequest("Bulk Change Roles (bulkChangeRole)", "bulkChangeRole", {
      assignments: [
        { userId: "{{sample_employee_id}}", role: "manager" }
      ]
    }, "Updates roles in bulk for multiple staff members."),
    makeFnRequest("List Role Audit Log (listRoleAudit)", "listRoleAudit", {
      limit: 50
    }, "Retrieves the security audit log of all role elevation and assignment changes.")
  ]
});

// 2. Employees Management (Create, Edit, Transfer, Status)
collection.item.push({
  name: "2. Employees Management",
  item: [
    makeFnRequest("Create Employee Admin (createEmployeeAdmin)", "createEmployeeAdmin", {
      name: "Ahmed Hassan",
      nameAr: "أحمد حسن",
      email: "ahmed.hassan@company.com",
      phone: "+201012345678",
      password: "InitialPassword123!",
      dept: "Engineering",
      position: "Senior Network Engineer",
      role: "employee",
      status: "Active",
      gender: "male",
      city: "Cairo",
      district: "Nasr City",
      nationalId: "29501011234567",
      salaryMode: "net",
      salaryNet: 18500,
      salaryGross: 22000,
      annualAdvanceLimit: 50000
    }, "Admin endpoint to provision a new employee account, auth user, profile record, and initial payroll salary settings."),
    makeFnRequest("Update Employee Admin (updateEmployeeAdmin)", "updateEmployeeAdmin", {
      id: "{{sample_employee_id}}",
      full_name: "Ahmed Hassan Updated",
      full_name_ar: "أحمد حسن معدل",
      phone: "+201098765432",
      city: "Giza",
      district: "Dokki",
      status: "Active",
      salary_mode: "net",
      salary_net: 20000
    }, "Admin endpoint to update personal details, job assignment, contact info, and compensation parameters of an employee."),
    makeFnRequest("Get Employee Detail (getEmployeeDetail)", "getEmployeeDetail", {
      employeeId: "{{sample_employee_id}}"
    }, "Fetches complete employee detail including contract, documents, equipment custody, and salary info."),
    makeFnRequest("Delete / Terminate Employee (deleteEmployeeAdmin)", "deleteEmployeeAdmin", {
      id: "{{sample_employee_id}}"
    }, "Marks an employee as deleted/inactive and revokes active session credentials."),
    makeFnRequest("Bulk Set Employee Status (bulkSetEmployeeStatus)", "bulkSetEmployeeStatus", {
      ids: ["{{sample_employee_id}}"],
      status: "Active"
    }, "Changes the status (Active or Inactive) for multiple employees simultaneously."),
    makeFnRequest("Admin Transfer Employee Department (adminTransferEmployee)", "adminTransferEmployee", {
      employeeId: "{{sample_employee_id}}",
      newDepartmentId: "00000000-0000-0000-0000-000000000010",
      newPositionId: "00000000-0000-0000-0000-000000000020",
      effectiveDate: "2026-11-01"
    }, "Transfers an employee to a new department and job position with audit tracking."),
    makeFnRequest("List Employees for Attendance (listEmployeesForAttendance)", "listEmployeesForAttendance", {
      departmentId: null,
      status: "Active"
    }, "Lists active employees with their current geofence and attendance requirement settings.")
  ]
});

// 3. Geofencing & Locations
collection.item.push({
  name: "3. Geofencing & Locations",
  item: [
    makeFnRequest("List Geofences Admin (listGeofencesAdmin)", "listGeofencesAdmin", {}, "Lists all defined work sites and geofence perimeters."),
    makeFnRequest("Create Geofence Location (createGeofenceAdmin)", "createGeofenceAdmin", {
      name: "Main HQ - Cairo Campus",
      lat: 30.0444,
      lng: 31.2357,
      radius_m: 150,
      active: true
    }, "Creates an authorized geofence boundary location for employee attendance check-ins."),
    makeFnRequest("Update Geofence Location (updateGeofenceAdmin)", "updateGeofenceAdmin", {
      id: "{{sample_geofence_id}}",
      name: "Main HQ - Building B Expanded",
      radius_m: 200,
      active: true
    }, "Updates the name, coordinates, or radius buffer of a geofence site."),
    makeFnRequest("Delete Geofence Location (deleteGeofenceAdmin)", "deleteGeofenceAdmin", {
      id: "{{sample_geofence_id}}"
    }, "Soft deletes or removes a geofence location."),
    makeFnRequest("Bulk Assign Geofences to Employees (bulkAssignGeofences)", "bulkAssignGeofences", {
      geofenceId: "{{sample_geofence_id}}",
      employeeIds: ["{{sample_employee_id}}"]
    }, "Authorizes multiple employees to punch attendance within a specific geofence location.")
  ]
});

// 4. Directory & Organization Structure
collection.item.push({
  name: "4. Directory & Organization Structure",
  item: [
    makeFnRequest("List Departments (listDepartments)", "listDepartments", {}, "Retrieves all company departments and division counts."),
    makeFnRequest("Upsert Department (upsertDepartment)", "upsertDepartment", {
      name_en: "Information Technology",
      name_ar: "تكنولوجيا المعلومات",
      code: "IT"
    }, "Creates or updates an organizational department."),
    makeFnRequest("Delete Department (deleteDepartment)", "deleteDepartment", {
      id: "00000000-0000-0000-0000-000000000010"
    }, "Deletes a department if no active employees are assigned."),
    makeFnRequest("List Positions (listPositions)", "listPositions", {}, "Lists all job titles and job positions."),
    makeFnRequest("Upsert Position (upsertPosition)", "upsertPosition", {
      title_en: "Software Engineer",
      title_ar: "مهندس برمجيات",
      department_id: "00000000-0000-0000-0000-000000000010"
    }, "Creates or updates a job title within a department."),
    makeFnRequest("List Job Grades (listJobGrades)", "listJobGrades", {}, "Retrieves employee job grades and bands."),
    makeFnRequest("Upsert Job Grade (upsertJobGrade)", "upsertJobGrade", {
      code: "G5",
      name: "Senior Grade 5",
      min_salary: 15000,
      max_salary: 25000
    }, "Creates or modifies a salary and seniority job grade."),
    makeFnRequest("List Cost Centers (listCostCenters)", "listCostCenters", {}, "Lists all accounting cost centers."),
    makeFnRequest("Upsert Cost Center (upsertCostCenter)", "upsertCostCenter", {
      code: "CC-102",
      name: "Operations & Logistics"
    }, "Creates or updates a financial cost center."),
    makeFnRequest("List Cities with Districts (listCitiesWithDistricts)", "listCitiesWithDistricts", {}, "Fetches all governorates/cities and their sub-districts."),
    makeFnRequest("Upsert City (upsertCity)", "upsertCity", {
      name_en: "Alexandria",
      name_ar: "الإسكندرية"
    }, "Creates or updates a regional governorate/city."),
    makeFnRequest("Upsert District (upsertDistrict)", "upsertDistrict", {
      city_id: "00000000-0000-0000-0000-000000000030",
      name_en: "Sidi Gaber",
      name_ar: "سيدي جابر"
    }, "Adds a district or neighborhood under a city.")
  ]
});

// 5. Attendance & Punch Tracking
collection.item.push({
  name: "5. Attendance & Punch Tracking",
  item: [
    makeFnRequest("Employee Check-In (checkIn)", "checkIn", {
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 12.5,
      timestamp: new Date().toISOString(),
      method: "face",
      face_distance: 0.28,
      device_id: "uuid-mobile-device-fingerprint",
      wifi_ssid: "INT-CORP-WIFI"
    }, "Records employee check-in with client-side geofence validation, face match distance, and device verification."),
    makeFnRequest("Employee Check-Out (checkOut)", "checkOut", {
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 15.0,
      timestamp: new Date().toISOString(),
      method: "face",
      face_distance: 0.31
    }, "Records employee departure punch, closes the daily attendance record, and verifies active tasks."),
    makeFnRequest("List My Attendance History (listMyAttendance)", "listMyAttendance", {
      start_date: "2026-11-01",
      end_date: "2026-11-30"
    }, "Retrieves personal attendance log for the current employee."),
    makeFnRequest("Admin Upsert Attendance (adminUpsertAttendance)", "adminUpsertAttendance", {
      employee_id: "{{sample_employee_id}}",
      date: "2026-11-01",
      in_time: "09:00:00",
      out_time: "17:30:00",
      branch: "Main HQ",
      note: "Manual HR adjustment due to field assignment"
    }, "Allows HR admin to manually add or correct an attendance record."),
    makeFnRequest("Admin Delete Attendance (adminDeleteAttendance)", "adminDeleteAttendance", {
      id: "00000000-0000-0000-0000-000000000050"
    }, "Admin endpoint to delete an erroneous attendance entry."),
    makeFnRequest("Admin Attendance Report (adminAttendanceReport)", "adminAttendanceReport", {
      from: "2026-11-01",
      to: "2026-11-30",
      onlyApprovedLocations: false
    }, "Generates an aggregated attendance report for all employees across the given date range with worked hours."),
    makeFnRequest("List Attendance Review Cases (listAttendanceReviewCases)", "listAttendanceReviewCases", {
      status: "pending"
    }, "Lists flagged attendance punch attempts that failed geofence radius or face liveness and require manager review."),
    makeFnRequest("Resolve Attendance Review Case (resolveAttendanceReviewCase)", "resolveAttendanceReviewCase", {
      review_case_id: "00000000-0000-0000-0000-000000000060",
      decision: "approved",
      resolution_note: "Verified remote field presence by manager"
    }, "Approves or rejects a flagged attendance attempt.")
  ]
});

// 6. Biometrics & Face Recognition
collection.item.push({
  name: "6. Biometrics & Face Recognition",
  item: [
    makeFnRequest("Enroll Face Descriptor (enrollFace)", "enrollFace", {
      descriptor: Array.from({ length: 128 }, () => Math.random() * 0.2 - 0.1),
      photo_preview_url: "https://storage.supabase.co/faces/preview.jpg"
    }, "Enrolls a 128-dimensional Float32 facial recognition embedding vector for the employee."),
    makeFnRequest("Verify Face (verifyFace)", "verifyFace", {
      descriptor: Array.from({ length: 128 }, () => Math.random() * 0.2 - 0.1),
      action: "verification"
    }, "Verifies a facial embedding against the registered face descriptor."),
    makeFnRequest("Face Login by Email (faceLogin)", "faceLogin", {
      email: "ahmed.hassan@company.com",
      descriptor: Array.from({ length: 128 }, () => Math.random() * 0.2 - 0.1)
    }, "Performs 1-to-1 face authentication and returns a session auth token without requiring a password."),
    makeFnRequest("Delete Face Biometrics (deleteFace)", "deleteFace", {}, "Removes enrolled facial descriptor vectors for the user."),
    makeFnRequest("WebAuthn - Get Register Options (webauthnRegisterOptions)", "webauthnRegisterOptions", {}, "Generates FIDO2 / Passkey registration challenge options for fingerprint or hardware key."),
    makeFnRequest("WebAuthn - Verify Registration (webauthnRegisterVerify)", "webauthnRegisterVerify", {
      credential: {
        id: "sample-credential-id",
        rawId: "sample-raw-id",
        response: {
          clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0=",
          attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViU..."
        },
        type: "public-key"
      }
    }, "Verifies and stores employee passkey credential in the database."),
    makeFnRequest("List My Biometrics (listMyBiometrics)", "listMyBiometrics", {}, "Returns registered biometric methods for the user (Face ID, Passkeys, WebAuthn)."),
    makeFnRequest("Get Biometric Health Status (getBiometricHealthStatus)", "getBiometricHealthStatus", {}, "Admin overview of biometric verification success rates, fraud attempts, and latency.")
  ]
});

// 7. Leaves & Vacations
collection.item.push({
  name: "7. Leaves & Vacations",
  item: [
    makeFnRequest("Submit Leave Request (submitLeave)", "submitLeave", {
      leave_type_id: "00000000-0000-0000-0000-000000000070",
      from: "2026-12-20",
      to: "2026-12-25",
      reason: "Annual vacation trip",
      proof_document_url: null
    }, "Submits an employee leave request for manager and HR approval."),
    makeFnRequest("Decide Leave Request (decideLeave)", "decideLeave", {
      id: "{{sample_leave_id}}",
      status: "approved",
      notify: true
    }, "Manager or HR approval or rejection of an employee leave request."),
    makeFnRequest("Bulk Decide Leaves (decideLeavesBulk)", "decideLeavesBulk", {
      ids: ["{{sample_leave_id}}"],
      status: "approved",
      notify: true
    }, "Approves or rejects multiple pending leave requests at once."),
    makeFnRequest("Cancel Leave Request (cancelLeave)", "cancelLeave", {
      id: "{{sample_leave_id}}"
    }, "Cancels a pending or approved future leave request."),
    makeFnRequest("List Leave Approval Queue (listLeaveQueue)", "listLeaveQueue", {
      status: "pending"
    }, "Lists leave requests requiring administrative or managerial review."),
    makeFnRequest("List My Leaves (listMyLeaves)", "listMyLeaves", {
      limit: 20
    }, "Lists past and upcoming leave requests for the logged in employee."),
    makeFnRequest("List Active Leave Types (listActiveLeaveTypes)", "listActiveLeaveTypes", {}, "Fetches all system leave types (Annual, Sick, Casual, Unpaid, Paternity)."),
    makeFnRequest("List Leave Balances Admin (listLeaveBalancesAdmin)", "listLeaveBalancesAdmin", {
      year: 2026
    }, "Retrieves employee annual leave balances, used days, and remaining quotas."),
    makeFnRequest("Update Leave Balance (updateLeaveBalance)", "updateLeaveBalance", {
      employee_id: "{{sample_employee_id}}",
      leave_type_id: "00000000-0000-0000-0000-000000000070",
      year: 2026,
      balance: 21,
      used: 5
    }, "Manually sets or corrects an employee leave balance quota.")
  ]
});

// 8. Permissions (Hourly Exits / الاستئذانات)
collection.item.push({
  name: "8. Permissions (Hourly Exits)",
  item: [
    makeFnRequest("Request Hourly Permission (requestPermission)", "requestPermission", {
      date: "2026-11-15",
      start_time: "13:00",
      end_time: "15:00",
      duration_hours: 2.0,
      reason: "Doctor appointment"
    }, "Submits an hourly exit permission request (max 2 hours per occurrence)."),
    makeFnRequest("Decide Permission Request (decidePermission)", "decidePermission", {
      id: "00000000-0000-0000-0000-000000000080",
      status: "approved",
      decision_note: "Approved by direct manager"
    }, "Approves or rejects an employee hourly exit permission."),
    makeFnRequest("Cancel Permission Request (cancelPermission)", "cancelPermission", {
      id: "00000000-0000-0000-0000-000000000080"
    }, "Cancels a submitted permission request."),
    makeFnRequest("List Permissions Admin (listPermissionsAdmin)", "listPermissionsAdmin", {
      status: "pending",
      limit: 50
    }, "Lists all permission requests across the organization for administration review."),
    makeFnRequest("List My Permissions (listMyPermissions)", "listMyPermissions", {}, "Retrieves personal monthly exit permissions and remaining quota.")
  ]
});

// 9. Loans & Advances (Solaf Workflow)
collection.item.push({
  name: "9. Loans & Advances (Solaf)",
  item: [
    makeFnRequest("Check Advance Eligibility (getAdvanceEligibility)", "getAdvanceEligibility", {}, "Checks whether employee is past probation, has outstanding loans, and is within the 15th-20th window."),
    makeFnRequest("Submit Advance Request (createAdvanceRequest)", "createAdvanceRequest", {
      amount: 5000,
      installments_count: 5,
      reason: "Emergency home maintenance"
    }, "Submits a salary advance (سلفة) request with monthly installments."),
    makeFnRequest("Cancel My Advance (cancelMyAdvance)", "cancelMyAdvance", {
      id: "{{sample_advance_id}}"
    }, "Cancels an advance request that is still pending."),
    makeFnRequest("List My Advances (listMyAdvances)", "listMyAdvances", {}, "Lists advance history and payment schedules for the authenticated employee."),
    makeFnRequest("List Team Advances for Manager (listTeamAdvances)", "listTeamAdvances", {
      status: "pending_manager"
    }, "Manager view of advance requests submitted by team members."),
    makeFnRequest("Manager Decide Advance (managerDecideAdvance)", "managerDecideAdvance", {
      id: "{{sample_advance_id}}",
      action: "approved",
      notes: "Approved based on performance and tenure"
    }, "Direct manager approval transitioning request to pending_hr."),
    makeFnRequest("List Advances for HR Queue (listAdvancesForHR)", "listAdvancesForHR", {
      status: "pending_hr"
    }, "HR queue of advance requests pending policy verification."),
    makeFnRequest("HR Decide Advance (hrDecideAdvance)", "hrDecideAdvance", {
      id: "{{sample_advance_id}}",
      action: "approved",
      notes: "Policy checks passed: tenure > 6 months, limit satisfied"
    }, "HR approval transitioning request to pending_finance."),
    makeFnRequest("List Advances for Finance (listAdvancesForFinance)", "listAdvancesForFinance", {
      status: "pending_finance"
    }, "Finance queue of advance requests awaiting disbursement and bank transfer."),
    makeFnRequest("Finance Approve Payment (financeApprovePayment)", "financeApprovePayment", {
      id: "{{sample_advance_id}}",
      payment_method: "bank_transfer",
      reference_number: "TRX-994821",
      notes: "Queued for bank payroll dispatch"
    }, "Finance approval of disbursement schedule."),
    makeFnRequest("Finance Mark Paid (financeMarkPaid)", "financeMarkPaid", {
      id: "{{sample_advance_id}}",
      disbursement_date: "2026-11-25"
    }, "Marks the advance loan as paid/disbursed and activates automatic monthly payroll deductions."),
    makeFnRequest("Finance Reject Advance (financeRejectAdvance)", "financeRejectAdvance", {
      id: "{{sample_advance_id}}",
      reason: "Exceeds monthly company advance liquidity cap"
    }, "Rejects the advance at finance stage."),
    makeFnRequest("List Advance Installments (listAdvanceInstallments)", "listAdvanceInstallments", {
      advance_id: "{{sample_advance_id}}"
    }, "Returns the schedule of monthly deduction installments and repayment status."),
    makeFnRequest("Update Annual Advance Limit (updateAnnualAdvanceLimit)", "updateAnnualAdvanceLimit", {
      employee_id: "{{sample_employee_id}}",
      limit: 60000
    }, "Admin endpoint to adjust the annual salary advance cap for an employee.")
  ]
});

// 10. Devices, Shifts & Working Days
collection.item.push({
  name: "10. Devices, Shifts & Schedules",
  item: [
    makeFnRequest("Register My Mobile Device (registerMyDevice)", "registerMyDevice", {
      device_id: "d9e8f7a6-b5c4-3d2e-1f0a-9b8c7d6e5f4a",
      device_model: "Samsung Galaxy S24 Ultra",
      os_version: "Android 15",
      app_version: "2.4.0"
    }, "Registers an employee smartphone hardware fingerprint for binding check-in security."),
    makeFnRequest("List All Devices Admin (listAllDevices)", "listAllDevices", {
      status: "pending"
    }, "Lists employee device binding requests requiring approval."),
    makeFnRequest("Decide Device Approval (decideDevice)", "decideDevice", {
      device_id: "d9e8f7a6-b5c4-3d2e-1f0a-9b8c7d6e5f4a",
      status: "approved",
      notes: "Company-issued corporate phone verified"
    }, "Approves or rejects a device for attendance use."),
    makeFnRequest("Set Device Binding Requirement (setDeviceRequirement)", "setDeviceRequirement", {
      employee_id: "{{sample_employee_id}}",
      required: true
    }, "Enforces that an employee can only punch attendance from their approved device."),
    makeFnRequest("Set Face Match Requirement (setFaceRequirement)", "setFaceRequirement", {
      employee_id: "{{sample_employee_id}}",
      required: true
    }, "Enforces facial biometric verification during attendance check-in for this employee."),
    makeFnRequest("List Shifts (listShifts)", "listShifts", {}, "Lists all working shifts and grace period settings."),
    makeFnRequest("Upsert Shift (upsertShift)", "upsertShift", {
      name_en: "Morning Shift (HQ)",
      name_ar: "الوردية الصباحية (المقر الرئيسي)",
      start_time: "09:00",
      end_time: "17:00",
      grace_period_minutes: 15,
      is_night_shift: false
    }, "Creates or updates a shift schedule."),
    makeFnRequest("Delete Shift (deleteShift)", "deleteShift", {
      id: "00000000-0000-0000-0000-000000000090"
    }, "Deletes a shift definition."),
    makeFnRequest("Get Employee Working Days (getEmployeeWorkingDays)", "getEmployeeWorkingDays", {
      employee_id: "{{sample_employee_id}}"
    }, "Fetches weekly active work days (Sunday-Thursday vs Saturday-Wednesday)."),
    makeFnRequest("Set Employee Weekly Working Days (setEmployeeWorkingDaysWeekly)", "setEmployeeWorkingDaysWeekly", {
      employee_id: "{{sample_employee_id}}",
      working_days: [0, 1, 2, 3, 4]
    }, "Configures weekly rest days and work days for an employee.")
  ]
});

// 11. Contracts & Custody
collection.item.push({
  name: "11. Contracts & Custody",
  item: [
    makeFnRequest("List Contracts Admin (listContractsAdmin)", "listContractsAdmin", {
      status: "active"
    }, "Retrieves all employee employment contracts, expiration dates, and renewal status."),
    makeFnRequest("Renew Contract Admin (renewContractAdmin)", "renewContractAdmin", {
      contract_id: "00000000-0000-0000-0000-000000000100",
      start_date: "2027-01-01",
      end_date: "2027-12-31",
      salary: 22000,
      notes: "Annual renewal with merit salary increase"
    }, "Renews an employment contract with new dates and compensation."),
    makeFnRequest("Cancel Contract Admin (cancelContractAdmin)", "cancelContractAdmin", {
      contract_id: "00000000-0000-0000-0000-000000000100",
      reason: "Mutual separation agreement"
    }, "Terminates an employment contract."),
    makeFnRequest("List Employee Custody (listEmployeeCustody)", "listEmployeeCustody", {
      employee_id: "{{sample_employee_id}}"
    }, "Lists company equipment assigned to an employee (Laptops, SIM cards, Vehicles)."),
    makeFnRequest("Add Employee Custody Asset (addEmployeeCustody)", "addEmployeeCustody", {
      employee_id: "{{sample_employee_id}}",
      item_name: "MacBook Pro 16 M3",
      serial_number: "C02XYZ12345",
      category: "IT Hardware",
      received_date: "2026-11-01"
    }, "Registers physical custody of an asset assigned to an employee."),
    makeFnRequest("Return Employee Custody Asset (returnEmployeeCustody)", "returnEmployeeCustody", {
      custody_id: "00000000-0000-0000-0000-000000000110",
      return_date: "2026-11-01",
      condition: "excellent"
    }, "Marks a custody item as returned to company inventory.")
  ]
});

// 12. Tasks & Trips (Field Work & Workdays)
collection.item.push({
  name: "12. Tasks & Trips",
  item: [
    makeFnRequest("List Tasks (listTasks)", "listTasks", {
      status: "all"
    }, "Lists operational tasks and assignments."),
    makeFnRequest("Create Task (createTask)", "createTask", {
      title: "Fiber Optic Installation - Zone 4",
      description: "Install external optical termination unit at customer premises",
      priority: "high",
      assignees: ["{{sample_employee_id}}"],
      due_date: "2026-11-20"
    }, "Dispatches a new operational task to staff."),
    makeFnRequest("Transition Task Status (transitionTask)", "transitionTask", {
      task_id: "00000000-0000-0000-0000-000000000120",
      status: "completed",
      comment: "All lines tested and operational"
    }, "Updates task lifecycle status (pending -> in_progress -> completed)."),
    makeFnRequest("List Trips (listTrips)", "listTrips", {
      month: "2026-11"
    }, "Lists travel trips and field deployments."),
    makeFnRequest("Create Trip Request (createTrip)", "createTrip", {
      destination: "Alexandria Branch",
      start_date: "2026-11-10",
      end_date: "2026-11-12",
      purpose: "Hardware installation and branch rollout",
      estimated_allowance: 1200
    }, "Requests a business trip with daily allowance calculation."),
    makeFnRequest("Approve Trip (approveTrip)", "approveTrip", {
      trip_id: "00000000-0000-0000-0000-000000000130",
      status: "approved"
    }, "Manager approval of business travel and allowances.")
  ]
});

// 13. KPI & Quarterly Performance Evaluations
collection.item.push({
  name: "13. KPI & Quarterly Evaluations",
  item: [
    makeFnRequest("List KPI Criteria Catalog (listKpiCriteria)", "listKpiCriteria", {}, "Retrieves all 42 KPI evaluation criteria across role-specific, corporate, and manager layers."),
    makeFnRequest("Save KPI Criterion (saveKpiCriterion)", "saveKpiCriterion", {
      code: "KPI-NEW-01",
      name_en: "Clean Code & Test Coverage",
      name_ar: "جودة الكود وتغطية الاختبارات",
      category_en: "Installation & Technical Execution",
      category_ar: "التنفيذ الفني والتركيبات",
      layer: "role",
      weight: 5,
      target: 95,
      unit: "%",
      how_measured_en: "Automated CI/CD test run coverage >= 95%",
      how_measured_ar: "تغطية الاختبارات الآلية بنسبة لا تقل عن 95%"
    }, "Creates or updates a benchmark evaluation criterion in the master catalog."),
    makeFnRequest("Get Quarterly Evaluation (getQuarterlyEvaluation)", "getQuarterlyEvaluation", {
      employee_id: "{{sample_employee_id}}",
      year: 2026,
      quarter: "Q1"
    }, "Loads the quarterly score card, criteria scores, composite percentage, and grade band."),
    makeFnRequest("Save Quarterly Evaluation (saveQuarterlyEvaluation)", "saveQuarterlyEvaluation", {
      employee_id: "{{sample_employee_id}}",
      year: 2026,
      quarter: "Q1",
      scores: {
        "KPI-001": 96.5,
        "KPI-002": 92.0,
        "KPI-003": 88.0
      },
      manager_feedback: "Exceptional performance in milestone deliveries this quarter.",
      is_draft: false
    }, "Saves employee quarterly scores, calculates weighted total, and submits for sign-off."),
    makeFnRequest("Review Quarterly Evaluation (reviewQuarterlyEvaluation)", "reviewQuarterlyEvaluation", {
      evaluation_id: "00000000-0000-0000-0000-000000000140",
      action: "approved",
      review_note: "Approved by Department Head and HR Director"
    }, "Official approval or return for revision of a quarterly evaluation."),
    makeFnRequest("List Pending KPI Approvals (listPendingApprovals)", "listPendingApprovals", {
      year: 2026,
      quarter: "Q1"
    }, "Lists all evaluations submitted for approval.")
  ]
});

// 14. Payroll, Allowances & Penalties
collection.item.push({
  name: "14. Payroll, Allowances & Penalties",
  item: [
    makeFnRequest("Get Payroll Period Summary (getPayrollPeriod)", "getPayrollPeriod", {
      month: 11,
      year: 2026
    }, "Calculates monthly gross, deductions, advance installments, penalties, allowances, and final net payout."),
    makeFnRequest("Lock Payroll Run (lockPayrollRun)", "lockPayrollRun", {
      month: 11,
      year: 2026
    }, "Freezes payroll records for the specified month to prevent further adjustments prior to bank release."),
    makeFnRequest("Unlock Payroll Run (unlockPayrollRun)", "unlockPayrollRun", {
      month: 11,
      year: 2026
    }, "Unlocks a payroll run with admin audit logging."),
    makeFnRequest("Get Advanced Payroll Settings (getAdvancedPayrollSettings)", "getAdvancedPayrollSettings", {}, "Retrieves Egyptian social insurance and tax bracket configurations."),
    makeFnRequest("Save Advanced Payroll Settings (saveAdvancedPayrollSettings)", "saveAdvancedPayrollSettings", {
      insurance_bracket_min: 2000,
      insurance_bracket_max: 12600,
      employee_insurance_rate: 0.11,
      employer_insurance_rate: 0.1875,
      tax_brackets: [
        { up_to: 40000, rate: 0.00 },
        { up_to: 55000, rate: 0.10 },
        { up_to: 70000, rate: 0.15 },
        { up_to: 200000, rate: 0.20 },
        { up_to: 400000, rate: 0.225 },
        { up_to: 1000000, rate: 0.25 }
      ]
    }, "Updates national tax and insurance rate formulas."),
    makeFnRequest("List Allowances (listAllowances)", "listAllowances", {}, "Lists regular recurring allowances (housing, transportation, mobile, food)."),
    makeFnRequest("Upsert Allowance (upsertAllowance)", "upsertAllowance", {
      name_en: "Remote Work Allowance",
      name_ar: "بدل العمل عن بعد",
      amount: 1500,
      taxable: true
    }, "Creates or modifies a monthly allowance rate."),
    makeFnRequest("List Employee Penalties (listEmployeePenalties)", "listEmployeePenalties", {
      employee_id: "{{sample_employee_id}}"
    }, "Lists salary deductions and disciplinary penalties."),
    makeFnRequest("Create Employee Penalty (createEmployeePenalty)", "createEmployeePenalty", {
      employee_id: "{{sample_employee_id}}",
      penalty_type: "lateness",
      deduction_days: 0.5,
      reason: "Repeated unexcused morning lateness exceeding grace period",
      date: "2026-11-01"
    }, "Applies a disciplinary deduction to be processed in the current payroll period.")
  ]
});

// 15. System Settings, Security & Audit
collection.item.push({
  name: "15. Security & System Settings",
  item: [
    makeFnRequest("Get Security Settings (getSecuritySettings)", "getSecuritySettings", {}, "Retrieves global platform security parameters: face recognition thresholds, geofence radius limits, and rate limits."),
    makeFnRequest("Update Security Settings (updateSecuritySettings)", "updateSecuritySettings", {
      face_threshold: 0.40,
      geofence_default_radius_m: 100,
      max_attendance_rate_limit_per_min: 5,
      enforce_device_binding: true,
      require_face_liveness: true
    }, "Updates system security thresholds and strictness toggles."),
    makeFnRequest("Reset Employee Attendance Rate Limit (resetEmployeeAttendanceRateLimit)", "resetEmployeeAttendanceRateLimit", {
      employeeId: "{{sample_employee_id}}"
    }, "Clears rate limiting blocks on an employee following multiple failed punches."),
    makeFnRequest("List Security Blocklist (listBlocklist)", "listBlocklist", {}, "Retrieves blocked IP addresses and blacklisted hardware device IDs."),
    makeFnRequest("Add Security Blocklist Entry (addBlocklistEntry)", "addBlocklistEntry", {
      type: "ip",
      value: "192.168.1.100",
      reason: "Detected suspicious mock location injection"
    }, "Blocks an IP address or device identifier from authenticating."),
    makeFnRequest("Get System Audit Events (getAuditEvents)", "getAuditEvents", {
      limit: 100,
      category: "all"
    }, "Retrieves comprehensive administrative audit logs with IP, user agent, actor ID, and changed payloads."),
    makeFnRequest("Run Security Scan (runSecurityScan)", "runSecurityScan", {}, "Executes automated system security scan for compromised credentials and rogue devices.")
  ]
});

// Write to .plans/INT_HR_Postman_Collection.json
const outputPath = path.resolve('.plans/INT_HR_Postman_Collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf8');

const totalRequests = collection.item.reduce((acc, folder) => acc + folder.item.length, 0);
console.log(`Successfully generated Postman Collection v2.1.0 at ${outputPath}`);
console.log(`Folders: ${collection.item.length}`);
console.log(`Total Requests: ${totalRequests}`);
