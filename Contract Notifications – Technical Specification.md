# Contract Notifications – Technical Specification

## 1. Feature Overview

Create a new tab under:

**Admin → Contracts → Contract Notifications**

The purpose of this feature is to automatically identify active employee contracts that will expire within the **next 65 days**.

The feature gives HR/Admin/Management enough time to decide whether the employee will:

- **Renew / Continue** with the company.
- **Resign / Non-Renewal** when the current contract expires.

The main objective is to inform the employee early enough so that:

- The employee knows whether the company intends to continue the employment.
- HR has sufficient time to prepare the renewal.
- If the contract will not be renewed, the employee has reasonable time to make future employment plans and look for another job.

---

# 2. Navigation

Add the following navigation structure:

```text
Admin
└── Contracts
    ├── Contracts
    ├── Contract Templates
    ├── Contract Types
    └── Contract Notifications
```

---

# 3. Contract Notifications Page

Create a dedicated page:

```text
/admin/contracts/notifications
```

Page title:

```text
Contract Notifications
```

Subtitle:

```text
Monitor and manage employee contracts approaching expiration.
```

---

# 4. Contract Notification Table

Display the following columns:

| Field             | Type            | Description                               |
| ----------------- | --------------- | ----------------------------------------- |
| Employee ID       | Text / Relation | Unique employee identifier                |
| Employee Name     | Relation        | Employee full name                        |
| Contract End Date | Date            | Contract expiration date                  |
| Days Remaining    | Integer         | Number of days remaining until expiration |
| Notification Type | Select          | Renew or Resign                           |
| Notes             | Long Text       | HR/Admin notes                            |
| Status            | Select          | Pending, Notified, Confirmed, Closed      |
| Created At        | DateTime        | Notification creation date                |
| Updated At        | DateTime        | Last update date                          |
| Actions           | Menu            | Available actions                         |

---

# 5. Automatic Contract Detection

The system must automatically detect active contracts approaching expiration.

A contract qualifies when:

```text
contract.status = ACTIVE
AND
contract.end_date >= CURRENT_DATE
AND
contract.end_date <= CURRENT_DATE + 65 DAYS
```

In simple terms:

```text
Today
  ↓
Next 65 Days
  ↓
Find all active contracts ending within this period
```

Example:

```text
Current Date: 15 September 2026

65-Day Notification Window:

15 September 2026
        ↓
19 November 2026
```

Any active contract ending between these dates should appear in **Contract Notifications**.

---

# 6. Days Remaining

Calculate the remaining contract days dynamically:

```text
days_remaining = contract_end_date - current_date
```

Example:

```text
Contract End Date: 20 October 2026
Current Date:      15 September 2026

Days Remaining:    35
```

The value must update automatically each day.

Do not permanently rely on a manually entered `days_remaining` value.

The backend should calculate the current value when retrieving the notification.

---

# 7. Expiration Priority

Use the following priority levels:

| Days Remaining | Priority |
| -------------: | -------- |
|      0–15 days | Critical |
|     16–30 days | High     |
|     31–65 days | Upcoming |

Recommended UI behavior:

```text
0–15 days
→ Critical / urgent

16–30 days
→ High priority

31–65 days
→ Upcoming
```

The UI should make contracts approaching expiration easy to identify.

---

# 8. Notification Type

The notification type represents the company's intended decision.

Available values:

```text
renew
resign
```

## 8.1 Renew

`Renew` means the company intends to continue the employee's employment, subject to completion of the official renewal process.

Example:

```text
Notification Type: Renew

Notes:
Employee contract will be renewed for another year.
```

## 8.2 Resign

`Resign` means the company does not currently intend to renew the employee's current contract.

Important:

**Selecting ****`Resign`**** must NOT automatically terminate the employee.**

It is an HR notification/decision only.

The normal contract-ending process must still be completed separately.

Example:

```text
Notification Type: Resign

Notes:
Current contract will not be renewed.
Employee should be informed in advance.
```

---

# 9. Notification Status

Use the following statuses:

```text
pending
notified
confirmed
closed
```

## Status Workflow

```text
Pending
   ↓
Notified
   ↓
Confirmed
   ↓
Closed
```

### Pending

Notification has been generated but the employee has not yet been officially notified.

### Notified

The employee has been informed.

### Confirmed

HR/Admin has confirmed the employee notification/decision.

### Closed

The contract notification process has been completed.

---

# 10. Automatic Notification Creation

A scheduled background process should check contracts automatically.

Recommended schedule:

```text
Every day at 08:00 AM
```

Process:

```text
START
  ↓
Get current date
  ↓
Find active contracts
  ↓
Find contracts ending within 65 days
  ↓
Check whether notification already exists
  ↓
Create missing notification
  ↓
Update notification information
  ↓
Trigger configured HR/Admin alerts
  ↓
END
```

---

# 11. Duplicate Prevention

The system must prevent duplicate contract notifications.

A notification should uniquely represent a specific contract.

Recommended uniqueness:

```text
employee_id
+
contract_id
+
contract_end_date
```

Recommended database constraint:

```text
UNIQUE (
    employee_id,
    contract_id,
    contract_end_date
)
```

If the scheduled job runs multiple times, it must not create duplicate notifications.

---

# 12. Renewed Contracts

When an employee's contract is renewed, the new contract should have its own `contract_id`.

Example:

```text
Employee: Ahmed Ali

Contract #101
Start: 01/01/2026
End:   31/12/2026

        ↓ Renewal

Contract #202
Start: 01/01/2027
End:   31/12/2027
```

The notification system must treat the new contract as a separate contract.

This is why `contract_id` must be stored in the notification table.

---

# 13. Dashboard Summary Cards

At the top of the page, display summary cards.

Recommended cards:

```text
┌─────────────────────┐
│ Total Expiring      │
│        24           │
└─────────────────────┘

┌─────────────────────┐
│ Within 15 Days      │
│         5           │
└─────────────────────┘

┌─────────────────────┐
│ Within 30 Days      │
│        11           │
└─────────────────────┘

┌─────────────────────┐
│ Renew               │
│        15           │
└─────────────────────┘

┌─────────────────────┐
│ Resign              │
│         9           │
└─────────────────────┘
```

All values must be calculated from the current database records.

---

# 14. Filters

Provide filters above the table.

## Quick Filters

```text
All
Within 15 Days
Within 30 Days
Within 65 Days
Renew
Resign
Pending
Notified
Confirmed
Closed
```

## Advanced Filters

Allow filtering by:

```text
Employee
Employee ID
Department
Location
Contract Type
Contract End Date
Notification Type
Status
Priority
```

---

# 15. Sorting

Default sorting:

```text
Contract End Date ASC
```

This ensures contracts ending soonest appear first.

Example:

| Employee       | Contract End | Days | Type    | Status   |
| -------------- | ------------ | ---: | ------- | -------- |
| Ahmed Ali      | 20 Sep 2026  |    5 | Renew   | Pending  |
| Mohamed Hassan | 01 Oct 2026  |   16 | Pending | Pending  |
| Omar Khaled    | 15 Oct 2026  |   30 | Resign  | Notified |
| Ali Mahmoud    | 15 Nov 2026  |   61 | Renew   | Pending  |

---

# 16. Search

Provide a global search field.

Search should support:

```text
Employee ID
Employee Name
Contract ID
Department
Notification Type
Notes
```

Example:

```text
Search employee...
```

---

# 17. Row Actions

Each notification should have an action menu:

```text
View
Edit
Add Note
Set as Renew
Set as Resign
Notify Employee
Confirm
Close
```

Actions must respect user permissions.

---

# 18. Renew Confirmation

When selecting `Renew`, show a confirmation dialog.

Example:

```text
Confirm Contract Renewal

Are you sure you want to mark this contract as
"Renew / Continue"?

The company intends to continue the employee's
employment, subject to the official renewal process.

[Cancel] [Confirm Renew]
```

After confirmation:

```text
notification_type = renew
status = pending
```

The actual contract renewal must be handled through the contract-management workflow.

---

# 19. Resign Confirmation

When selecting `Resign`, show a confirmation dialog.

Example:

```text
Confirm Non-Renewal

Are you sure you want to mark this contract as
"Resign / Non-Renewal"?

The employee may need to be informed in advance
so they have sufficient time to make future
employment plans.

[Cancel] [Confirm Resign]
```

After confirmation:

```text
notification_type = resign
status = pending
```

Again:

**This must not automatically terminate the employee.**

---

# 20. Employee Notification

HR/Admin should have an option:

```text
Notify Employee
```

The system should allow notification through configured communication channels.

Supported channels can include:

```text
Internal Notification
Email
WhatsApp Integration
```

The system should only send the official employee notification after HR/Admin approval.

---

# 21. Renewal Notification Template

Suggested notification:

```text
Dear [Employee Name],

We would like to inform you that your current employment
contract is approaching its expiration date.

The company intends to continue your employment with us,
subject to completion of the contract renewal process.

Contract End Date: [Contract End Date]

HR Department
```

The template should support dynamic variables:

```text
[Employee Name]
[Employee ID]
[Contract Start Date]
[Contract End Date]
[Days Remaining]
[Company Name]
```

---

# 22. Non-Renewal Notification Template

Suggested notification:

```text
Dear [Employee Name],

We would like to inform you that your current employment
contract is approaching its expiration date.

The company does not currently intend to renew the contract.

Contract End Date: [Contract End Date]

This advance notification is intended to provide you with
sufficient time to make your future employment plans.

Regards,
HR Department
```

The final wording should be configurable by HR and should comply with the company's applicable employment policies and local legal requirements.

---

# 23. Notification Confirmation

After sending the employee notification, record:

```text
notified_at
notified_by
notification_channel
```

Example:

```text
Notified By: HR Manager
Notified At: 15/09/2026 10:35 AM
Channel: Email
```

---

# 24. Audit Trail

All important actions must be logged.

Track:

```text
Created By
Created At

Updated By
Updated At

Notification Type Changed By
Notification Type Changed At

Employee Notified By
Employee Notified At

Notification Channel

Confirmed By
Confirmed At

Closed By
Closed At
```

This provides a complete HR audit trail.

---

# 25. Database Design

Create a dedicated table:

```text
contract_notifications
```

Recommended structure:

| Field                 | Type          | Required | Description                             |
| --------------------- | ------------- | -------- | --------------------------------------- |
| id                    | UUID / BIGINT | Yes      | Primary key                             |
| employee\_id          | UUID / BIGINT | Yes      | Employee reference                      |
| contract\_id          | UUID / BIGINT | Yes      | Contract reference                      |
| contract\_end\_date   | DATE          | Yes      | Contract expiration date                |
| notification\_type    | ENUM          | Yes      | renew / resign                          |
| notes                 | TEXT          | No       | HR notes                                |
| status                | ENUM          | Yes      | pending / notified / confirmed / closed |
| notified\_at          | TIMESTAMP     | No       | Notification timestamp                  |
| notified\_by          | UUID / BIGINT | No       | User who notified employee              |
| notification\_channel | VARCHAR       | No       | Email / Internal / WhatsApp             |
| confirmed\_at         | TIMESTAMP     | No       | Confirmation timestamp                  |
| confirmed\_by         | UUID / BIGINT | No       | Confirming user                         |
| closed\_at            | TIMESTAMP     | No       | Closing timestamp                       |
| closed\_by            | UUID / BIGINT | No       | User who closed                         |
| created\_at           | TIMESTAMP     | Yes      | Creation timestamp                      |
| updated\_at           | TIMESTAMP     | Yes      | Last update timestamp                   |

---

# 26. Database Relationships

Recommended relationships:

```text
employees
    │
    ├── contracts
    │       │
    │       └── contract_notifications
    │
    └── users / HR records
```

Relationships:

```text
contract_notifications.employee_id
    → employees.id

contract_notifications.contract_id
    → contracts.id

contract_notifications.notified_by
    → users.id

contract_notifications.confirmed_by
    → users.id

contract_notifications.closed_by
    → users.id
```

Use foreign keys wherever supported.

---

# 27. Recommended Indexes

Create indexes for frequently queried fields:

```text
INDEX employee_id
INDEX contract_id
INDEX contract_end_date
INDEX status
INDEX notification_type
```

Recommended composite index:

```text
INDEX (
    contract_end_date,
    status
)
```

Unique constraint:

```text
UNIQUE (
    employee_id,
    contract_id,
    contract_end_date
)
```

---

# 28. Backend Logic

The backend should expose appropriate APIs.

Recommended endpoints:

```text
GET    /api/contracts/notifications
GET    /api/contracts/notifications/:id
POST   /api/contracts/notifications
PUT    /api/contracts/notifications/:id
DELETE /api/contracts/notifications/:id

POST   /api/contracts/notifications/:id/renew
POST   /api/contracts/notifications/:id/resign
POST   /api/contracts/notifications/:id/notify
POST   /api/contracts/notifications/:id/confirm
POST   /api/contracts/notifications/:id/close
```

If the project already has a different API convention, follow the existing project architecture.

---

# 29. Scheduled Job

Create a scheduled task for automatic contract scanning.

Pseudo-logic:

```text
function processContractNotifications():

    today = currentDate()

    notificationEndDate = today + 65 days

    contracts = getActiveContracts(
        startDate = today,
        endDate = notificationEndDate
    )

    for contract in contracts:

        existingNotification =
            findNotification(
                employee_id = contract.employee_id,
                contract_id = contract.id,
                contract_end_date = contract.end_date
            )

        if existingNotification does not exist:

            createNotification(
                employee_id = contract.employee_id,
                contract_id = contract.id,
                contract_end_date = contract.end_date,
                status = "pending"
            )
```

The process must be safe to run repeatedly.

---

# 30. Important Date Rules

The system must use the server/database timezone consistently.

Do not calculate contract expiration using different timezones between frontend and backend.

For date-only contract expiration:

```text
contract_end_date
```

should be treated as a calendar date, not a timestamp.

Example:

```text
2026-10-20
```

The UI can display:

```text
20 October 2026
```

---

# 31. Contracts Already Expired

Expired contracts should not be included in the normal 65-day upcoming notification list.

Condition:

```text
contract_end_date < today
```

These should be handled by the existing expired-contract process.

If the business requires overdue notifications, they should be displayed in a separate section/filter.

---

# 32. Contracts Outside the 65-Day Window

Contracts ending after 65 days should not appear in the active Contract Notifications list.

Example:

```text
Contract End Date: 30 December 2026
Today: 15 September 2026

Days Remaining: 106

Result:
Not included yet.
```

When the contract reaches the 65-day window, it should automatically appear.

---

# 33. Permission Rules

## Admin

Admin can:

```text
View
Create
Edit
Delete
Set Renew
Set Resign
Notify Employee
Confirm
Close
View Audit Trail
```

## HR / Manager

HR/Manager can:

```text
View
Edit
Add Notes
Set Renew
Set Resign
Notify Employee
Confirm
Close
View Audit Trail
```

## Employee

Employees must not have access to the administrative Contract Notifications table.

Employees should only receive the approved notification intended for them.

---

# 34. Security Requirements

All endpoints must verify authentication.

Authorization must be enforced on the backend.

Do not rely only on frontend permission checks.

Example:

```text
Frontend Permission Check
        +
Backend Authorization
        +
Database-Level Security
```

Users must only be able to access notifications permitted by their role.

Sensitive HR information must not be exposed through public APIs.

---

# 35. UI/UX Requirements

The interface should be simple and HR-focused.

Recommended layout:

```text
┌───────────────────────────────────────────────────────────┐
│ Contract Notifications                         [+ Add]    │
│ Monitor contracts approaching expiration                  │
├───────────────────────────────────────────────────────────┤
│ Total │ ≤15 Days │ ≤30 Days │ Renew │ Resign             │
├───────────────────────────────────────────────────────────┤
│ Search employee...    Filters ▼                           │
├───────────────────────────────────────────────────────────┤
│ Employee │ End Date │ Days │ Type │ Status │ Actions     │
│ Ahmed    │ 20 Sep   │  5   │Renew │Pending │ ...         │
│ Mohamed  │ 01 Oct   │ 16   │Resign│Pending │ ...         │
└───────────────────────────────────────────────────────────┘
```

Use clear visual indicators for urgency and status.

---

# 36. Empty State

If there are no contracts approaching expiration:

```text
No Contract Notifications

There are currently no active employee contracts
expiring within the next 65 days.
```

---

# 37. Error Handling

The system should handle:

- Missing employee
- Missing contract
- Deleted contract
- Invalid contract dates
- Duplicate notification
- Unauthorized access
- Failed employee notification
- Failed scheduled job

Example duplicate response:

```text
A contract notification already exists for this contract.
```

---

# 38. Notification Failure

If an employee notification fails to send:

```text
status = pending
```

or maintain a separate communication status.

Do not mark the notification as successfully sent if the communication provider returns an error.

Store the failure reason where appropriate:

```text
notification_error
```

Example:

```text
Email delivery failed:
Invalid employee email address.
```

---

# 39. Business Rules

The following rules are mandatory:

1. Only **active contracts** are included.
2. Only contracts expiring within the **next 65 days** are automatically added.
3. Expired contracts are not included in the upcoming notification list.
4. The system must prevent duplicate notifications.
5. `Renew` does not automatically renew the contract.
6. `Resign` does not automatically terminate the employee.
7. Employee notification must require an authorized HR/Admin action.
8. All important actions must be recorded in the audit trail.
9. `Days Remaining` must be calculated from the current date.
10. New contracts created after renewal must be treated as separate contracts.
11. Backend authorization is mandatory.
12. Scheduled processing must be idempotent.

---

# 40. Main Business Workflow

The complete workflow should be:

```text
                    ACTIVE CONTRACT
                          │
                          ↓
               Contract End Date Check
                          │
                          ↓
             Is expiration ≤ 65 days?
                    /             \
                  NO               YES
                  │                 │
                  ↓                 ↓
               Nothing       Create Notification
                                  │
                                  ↓
                              PENDING
                                  │
                     ┌────────────┴────────────┐
                     ↓                         ↓
                  RENEW                     RESIGN
                     │                         │
                     ↓                         ↓
             Continue Employee          Non-Renewal
                     │                         │
                     └────────────┬────────────┘
                                  ↓
                         Notify Employee
                                  │
                                  ↓
                              NOTIFIED
                                  │
                                  ↓
                              CONFIRMED
                                  │
                                  ↓
                               CLOSED
```

---

# 41. Final Objective

The **Contract Notifications** feature must provide a proactive contract-management system.

Instead of waiting until the contract expiration date, the system should automatically alert HR/Admin **65 days in advance**.

The intended business process is:

```text
65 Days Before Expiration
          ↓
HR/Admin Notification
          ↓
Management Decision
          ↓
     ┌────┴────┐
     ↓         ↓
   Renew     Resign
     ↓         ↓
Employee     Employee
Informed     Informed
     ↓         ↓
Renewal      Contract-End
Process      Process
     ↓         ↓
       CLOSED
```

The feature is primarily designed to ensure that **both the company and employee have sufficient time to prepare for the next step**, while keeping the actual contract renewal or termination process under the existing HR workflow.
