PROJECT: HR Task Time Management & Employee Daily Timeline

IMPORTANT:
This feature must be integrated into the EXISTING HR SYSTEM.
DO NOT create a new application.
DO NOT replace the existing database.
DO NOT remove or break any existing HR, attendance, employee, task, authentication, or permission functionality.

==================================================
PHASE 1 — FULL SYSTEM INSPECTION
==================================================

Before writing or changing any code:

1. Inspect the complete existing project.
2. Identify:
   - Frontend framework and structure
   - Backend framework and structure
   - Existing database and schema
   - Employees table/model
   - Users and roles
   - Existing HR module
   - Existing Attendance module
   - Existing Sign In / Sign Out
   - Existing Tasks
   - Existing permissions
   - Existing notifications
   - Existing APIs
3. Identify whether Task Management already exists.
4. Identify whether employees can already be assigned multiple tasks.
5. Identify existing relationships between:
   Employee → User → Task → Branch/Location.
6. Do not duplicate existing tables or functionality.

Create an inspection report before making major changes.

==================================================
PHASE 2 — BUSINESS CONCEPT
==================================================

The system must distinguish between:

A. ATTENDANCE
B. TASK TIME
C. TRAVEL TIME
D. BREAK / OTHER TIME

Attendance:
- Employee Sign In = start of working day.
- Employee Sign Out = end of working day.

Task Time:
- Employee starts a specific assigned task using CHECK IN.
- Employee finishes the task using CHECK OUT.

Travel Time:
When an employee must travel from one location/task to another,
the travel period must be recorded separately.

Example:

08:00 — Sign In
08:15 — Travel to Branch A
08:45 — Arrive Branch A
08:45 — Task 1 Check In
10:45 — Task 1 Check Out
10:45 — Travel to Branch B
11:30 — Arrive Branch B
11:30 — Task 2 Check In
13:30 — Task 2 Check Out
13:30 — Travel to Branch C
14:15 — Arrive Branch C
14:15 — Task 3 Check In
16:00 — Task 3 Check Out
16:00 — Sign Out

The system should understand that:

Working Time = Task Time
Travel Time = Travel Time
Attendance Time = Sign In → Sign Out

Do NOT treat travel time as missing working time.

==================================================
PHASE 3 — EMPLOYEE WORKFLOW
==================================================

Employee opens "My Workday".

Display:

- Today's Attendance
- Current Task
- Upcoming Tasks
- Completed Tasks
- Travel Activities
- Total Working Time
- Total Travel Time
- Total Attendance Time

For every task:

[START TASK]

When clicked:
- Record task start time
- Record employee
- Record task
- Record location
- Record date/time
- Change task status to IN PROGRESS

When completed:

[FINISH TASK]

Record:
- Task end time
- Duration
- Employee
- Location
- Completion status

After finishing a task, employee can:

[START TRAVEL]

Travel activity must contain:
- From location
- To location
- Start time
- End time
- Duration
- Employee
- Related task(s), if applicable
- Optional notes

==================================================
PHASE 4 — MULTIPLE TASKS PER DAY
==================================================

An employee can have unlimited assigned tasks in one working day.

Example:

Employee:
Technician

Tasks:

Task 1:
Repair CCTV Camera
Location: Branch A
Duration: 2 hours

Task 2:
Check Company Server
Location: Branch B
Duration: 2 hours

Task 3:
Network Issue
Location: Branch C
Duration: 1 hour

The system must allow all three tasks to appear in the employee's daily timeline.

The employee must NOT be required to sign out of Attendance between tasks.

Attendance Sign In / Sign Out remains independent from Task Check In / Check Out.

==================================================
PHASE 5 — DAILY TIMELINE
==================================================

Create a chronological Daily Timeline.

Example UI:

08:00  SIGN IN
08:15  TRAVEL
08:45  TASK — CCTV Repair
10:45  TASK COMPLETED
10:45  TRAVEL
11:30  TASK — Server Check
13:30  TASK COMPLETED
13:30  TRAVEL
14:15  TASK — Network Issue
16:00  TASK COMPLETED
16:10  SIGN OUT

Each activity should have:

- Activity Type
- Start
- End
- Duration
- Location
- Task
- Status

Activity types:

ATTENDANCE
TASK
TRAVEL
BREAK
OTHER

==================================================
PHASE 6 — MANAGER DASHBOARD
==================================================

Create a Manager Time Management Dashboard.

Manager can see:

1. Employees currently working
2. Employees currently on task
3. Employees currently traveling
4. Employees who have no active activity
5. Completed tasks
6. Open tasks
7. Overdue tasks
8. Total task hours
9. Total travel hours
10. Total attendance hours

Manager can select:

- Employee
- Date
- Department
- Branch
- Task
- Activity Type

Manager can open an employee and see the complete Daily Timeline.

Example:

Employee: Ahmed

Attendance:
08:00 → 16:10 = 8h 10m

Task Time:
5h

Travel Time:
2h

Break/Other:
1h 10m

This allows the manager to understand where the employee's time went.

==================================================
PHASE 7 — ADMIN DASHBOARD
==================================================

System Admin should have broader visibility according to permissions.

Admin can view:

- All employees
- All attendance
- All tasks
- All task time
- All travel time
- Daily timelines
- Weekly reports
- Monthly reports
- Missing check-out records
- Unusual activity
- Overlapping activities
- Long inactive periods

Admin must NOT automatically receive unlimited access if the existing permission system supports granular permissions.

Integrate with the existing RBAC/permission system.

==================================================
PHASE 8 — PERMISSIONS
==================================================

Use the existing permission system whenever possible.

Recommended permissions:

attendance.view
attendance.manage

task.view
task.manage
task.time_tracking

travel.view
travel.manage

employee.time_view
manager.time_view
admin.time_view

reports.time_management

Managers should normally see their assigned employees.

Admins can see employees according to their assigned permissions.

Employees can see their own information.

Never expose another employee's private information unless the user's role allows it.

==================================================
PHASE 9 — DATA MODEL
==================================================

DO NOT create duplicate employee/user/task tables.

Reuse existing tables/models.

If additional data structures are required, create only the minimum necessary.

Recommended conceptual entities:

TaskTimeEntry:
- id
- employee_id
- task_id
- start_time
- end_time
- duration
- status
- location_id
- notes
- created_at
- updated_at

TravelTimeEntry:
- id
- employee_id
- related_task_id (nullable)
- from_location
- to_location
- start_time
- end_time
- duration
- status
- notes
- created_at
- updated_at

DailyActivity / Timeline:
If the existing architecture supports a unified activity model, use it.

Do not duplicate data unnecessarily.

==================================================
PHASE 10 — VALIDATION RULES
==================================================

Prevent:

1. Two active tasks at the same time.
2. Two active travel activities at the same time.
3. Travel overlapping with another travel activity.
4. Task time overlapping with another task.
5. Check-out before check-in.
6. Invalid dates/times.
7. Task check-in without a valid assigned task.
8. Unauthorized users modifying another employee's time.
9. Employee Sign Out while an active task exists.

If employee tries to Sign Out while a task is still active:

Show:

"You still have an active task. Please complete or close the task before signing out."

If business rules later allow automatic closing, make it configurable.

==================================================
PHASE 11 — LOCATION
==================================================

Each task should support a location when applicable.

Location may be:

- Company Branch
- Customer Location
- Bank
- Office
- Warehouse
- Other

The system should show the location in the task and timeline.

Do NOT implement GPS tracking unless explicitly required.

Travel should be manually started/stopped initially.

==================================================
PHASE 12 — REPORTING
==================================================

Create reports:

Daily Time Report
Weekly Time Report
Monthly Time Report
Employee Time Report
Department Time Report
Task Time Report
Travel Time Report

Important metrics:

Total Attendance Hours
Total Task Hours
Total Travel Hours
Total Break Hours
Number of Tasks
Completed Tasks
Incomplete Tasks
Overdue Tasks
Average Task Duration
Average Travel Duration

==================================================
PHASE 13 — REAL-TIME UPDATES
==================================================

If the existing application supports real-time updates:

When employee starts or finishes a task,
the manager dashboard should update automatically.

When employee starts or finishes travel,
the manager should see the updated status.

Example:

Ahmed:
🟢 Working on Task
CCTV Repair
Started: 08:45

Then after completion:

Ahmed:
🔵 Traveling
Branch A → Branch B
Started: 10:45

Then:

Ahmed:
🟢 Working on Task
Server Check
Started: 11:30

==================================================
PHASE 14 — NOTIFICATIONS
==================================================

Integrate with the existing notification system.

Possible notifications:

- New task assigned
- Task approaching deadline
- Task overdue
- Employee forgot task check-out
- Employee has been inactive
- Manager assigns new task
- Task completed
- Travel started
- Travel completed

Do not create a second notification system if one already exists.

==================================================
PHASE 15 — UI/UX
==================================================

Keep the existing application's design system.

Do not redesign the entire HR system.

Add:

Employee:
"My Workday"

Manager:
"Team Time Dashboard"

Admin:
"Time Management"

Use clear status indicators:

Attendance
Task
Travel
Break
Completed
In Progress
Overdue

Provide:

- Timeline view
- Table view
- Filters
- Date selector
- Employee selector
- Task selector
- Location selector
- Export/report functionality if supported by the existing system

The interface must be responsive.

==================================================
PHASE 16 — EDGE CASES
==================================================

Handle:

- Employee receives a new task while already working.
- Employee finishes task early.
- Employee spends longer than estimated.
- Employee travels between locations.
- Task is cancelled.
- Task is reassigned.
- Employee forgets to check out.
- Employee loses internet connection.
- Employee closes browser/application.
- Employee signs out while a task is active.
- Multiple tasks assigned to the same employee.
- Tasks scheduled for different locations.
- Employee works beyond normal working hours.

Never silently lose time records.

==================================================
PHASE 17 — AUDIT LOG
==================================================

Every important modification must be auditable.

Record:

- Who performed the action
- Employee
- Action
- Old value
- New value
- Date/time
- Source/device if already supported

Actions include:

- Task started
- Task stopped
- Travel started
- Travel stopped
- Time edited
- Task reassigned
- Time approved
- Time rejected

Employees should not be able to silently modify historical time records.

==================================================
PHASE 18 — APPROVAL
==================================================

If the existing HR system supports approval workflows:

Allow manager to review time entries.

Possible statuses:

DRAFT
ACTIVE
COMPLETED
SUBMITTED
APPROVED
REJECTED
CORRECTED

Do not force approval if the current HR workflow does not require it.
Make this configurable.

==================================================
PHASE 19 — OFFLINE SUPPORT
==================================================

If the existing system supports offline operation:

Task Check In / Check Out and Travel Start / Stop should be stored locally when offline.

When connection returns:

Synchronize with the backend.

Avoid duplicate records.

Use unique IDs / timestamps / synchronization status.

Never overwrite existing records blindly.

==================================================
PHASE 20 — API
==================================================

Follow the existing API architecture.

Required functionality conceptually:

Start Task
Stop Task
Start Travel
Stop Travel
Get Current Activity
Get Employee Daily Timeline
Get Employee Time Summary
Get Team Time Summary
Get Time Reports
Approve Time
Reject Time
Correct Time

Use the existing authentication and authorization middleware.

==================================================
PHASE 21 — TESTING
==================================================

Before deployment test:

Employee:
- Sign In
- Start Task
- Stop Task
- Start Travel
- Stop Travel
- Start another Task
- Sign Out

Manager:
- View employee activity
- View daily timeline
- Filter employees
- View task duration
- View travel duration

Admin:
- View authorized employees
- View reports
- Review audit logs

Security:
- Employee cannot access unauthorized employee data.
- Manager cannot access unauthorized departments.
- API permissions must be enforced server-side.

Edge cases:
- Duplicate clicks
- Refresh browser
- Internet disconnect
- Long-running task
- Missing check-out
- Multiple tasks
- Multiple locations
- Overlapping activities

==================================================
PHASE 22 — IMPLEMENTATION RULE
==================================================

IMPORTANT:

DO NOT immediately rewrite the application.

First:

1. Inspect.
2. Analyze.
3. Identify existing reusable components.
4. Identify database changes.
5. Identify API changes.
6. Identify UI changes.
7. Identify permission changes.
8. Identify risks.
9. Create an implementation plan.

Then implement incrementally.

Preserve all existing functionality.

Use migrations for database changes.

Do not delete existing production data.

Do not rename existing tables/fields unless absolutely necessary.

==================================================
FINAL GOAL
==================================================

The final system must provide a complete picture of an employee's workday.

Example:

Employee: Technician

08:00 — Sign In
08:15–08:45 — Travel
08:45–10:45 — CCTV Repair
10:45–11:30 — Travel
11:30–13:30 — Server Check
13:30–14:15 — Travel
14:15–16:00 — Network Issue
16:10 — Sign Out

Summary:

Attendance: 8h 10m
Task Time: 5h
Travel Time: 2h 00m
Other/Break: 1h 10m
Tasks Completed: 3

The Manager and authorized Admin must be able to see this complete timeline and understand exactly how the employee's working day was spent.

IMPORTANT:
Do not assume that "not working on a task" means "not working".
Travel between work locations is a legitimate work activity and must be recorded separately.

Start with PHASE 1 inspection and provide the inspection report before making major architectural changes.