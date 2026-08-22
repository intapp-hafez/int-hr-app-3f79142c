# Employee Data API — Integration Guide

Read-only API for pulling employee master data into an external system.
**No salary, banking, insurance or payroll data is ever returned.**

---

## 1. Base URL

| Environment | Base URL |
|---|---|
| Production / Staging | `https://hr.company.com` |
| Local dev | `http://localhost:8080` |
| Self-hosted / IIS | your own domain or IP (e.g. `https://hr.company.com`) |

All endpoints below are appended to the base URL.

---

## 2. Authentication

Every request must carry the shared API key stored in the app secret
`EMPLOYEE_API_KEY`.

Send it in **one** of these ways (header preferred):

```
x-api-key: <EMPLOYEE_API_KEY>
Authorization: Bearer <EMPLOYEE_API_KEY>
?api_key=<EMPLOYEE_API_KEY>
```

Missing / wrong key → `401 {"error":"unauthorized"}`.
Keep the key server-side in your other system. Never call this API from a browser.

---

## 3. Endpoints

### `GET /api/public/employees`

Returns a paginated employee list. Use the same endpoint with `id=` or
`emp_code=` to fetch a single employee.

#### Query parameters

| Param | Type | Description |
|---|---|---|
| `id` | uuid | Fetch one employee by internal id |
| `emp_code` | string | Fetch one employee by employee code |
| `email` | string | Exact (case-insensitive) email match |
| `status` | `Active` \| `Inactive` | Filter by employment status |
| `department_id` | uuid | Filter by department |
| `search` | string | Partial match on name, email or emp_code |
| `updated_since` | ISO date/time | Only records changed after this timestamp (incremental sync) |
| `page` | int, default `1` | Page number |
| `page_size` | int, default `100`, max `500` | Rows per page |

#### Example requests

```bash
# All active employees, first page
curl -H "x-api-key: $EMPLOYEE_API_KEY" \
  "https://hr.company.com/api/public/employees?status=Active&page_size=200"

# Single employee by code
curl -H "x-api-key: $EMPLOYEE_API_KEY" \
  "$BASE/api/public/employees?emp_code=INT-1042"

# Incremental sync (only what changed since last run)
curl -H "x-api-key: $EMPLOYEE_API_KEY" \
  "$BASE/api/public/employees?updated_since=2026-08-01T00:00:00Z"
```

#### Response `200`

```json
{
  "ok": true,
  "page": 1,
  "page_size": 100,
  "total": 342,
  "employees": [
    {
      "id": "fa1db0dd-a308-45d0-8b91-5c0dc4eaa98b",
      "emp_code": "INT-1042",
      "full_name": "Ahmed Hassan",
      "status": "Active",
      "inactive_reason": null,
      "role": "employee",
      "gender": "male",
      "contact": {
        "email": "ahmed@company.com",
        "extra_email": null,
        "phone": "+201001234567"
      },
      "address": {
        "city": "Cairo",
        "district": "Nasr City"
      },
      "organization": {
        "department_id": "…",
        "department_name": "Operations",
        "section_id": "…",
        "section_name": "Field Ops",
        "position_id": "…",
        "position_title": "Field Supervisor",
        "job_grade": "G4",
        "manager": {
          "id": "…",
          "full_name": "Mona Adel",
          "email": "mona@company.com"
        }
      },
      "national_id": {
        "number": "29001011234567",
        "issue_date": "2020-01-15",
        "expiry_date": "2027-01-14"
      },
      "contract": {
        "type": "FullTime",
        "start_date": "2024-03-01",
        "end_date": "2027-02-28",
        "cancelled": false
      },
      "created_at": "2024-03-01T09:12:00Z",
      "updated_at": "2026-07-22T11:04:31Z"
    }
  ]
}
```

#### Status codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `401` | Missing or invalid API key |
| `500` | Server/database error — body contains `{"error": "..."}` |

---

## 4. Field reference

| JSON path | Source | Notes |
|---|---|---|
| `id` | `profiles.id` | Stable internal UUID — use as the join key |
| `emp_code` | `profiles.emp_code` | Human-readable employee code, unique |
| `full_name` | `profiles.full_name` | |
| `status` / `inactive_reason` | `profiles.status` / `inactive_reason` | `Resigned`, `Terminated`, … |
| `role` | `profiles.role` | `admin`, `hr`, `manager`, `employee`, `finance`, … |
| `contact.email` | `profiles.email` | Login email |
| `contact.phone` | `profiles.phone` | |
| `address.city` / `address.district` | `profiles.city` / `district` | |
| `organization.department_name` | `departments.name_en` | Resolved server-side |
| `organization.section_name` | `sections.name_en` | |
| `organization.position_title` | `positions.name_en` | |
| `organization.manager` | `profiles.manager_id` → profile | id, name, email |
| `national_id.*` | `national_id`, `id_issue_date`, `id_expiry_date` | |
| `contract.*` | `contract_type`, `contract_start_date`, `contract_end_date`, `contract_cancelled` | |
| `updated_at` | `profiles.updated_at` | Use for incremental sync |

**Deliberately excluded:** `salary_amount`, `salary_gross`, `salary_net`, `allowance`,
bank account fields, insurance and tax fields, advances and payroll data.

---

## 5. Recommended sync pattern

1. First run: page through `?page=1..N` with `page_size=500`, store `id` as the key.
2. Save the timestamp of the run.
3. Every later run: `?updated_since=<last run timestamp>` and upsert by `id`.
4. To detect leavers, also pull `?status=Inactive&updated_since=…`.

Node example:

```js
const BASE = process.env.HR_BASE_URL;
const KEY = process.env.EMPLOYEE_API_KEY;

async function fetchEmployees(params = {}) {
  const qs = new URLSearchParams({ page_size: "500", ...params });
  const out = [];
  for (let page = 1; ; page++) {
    qs.set("page", String(page));
    const res = await fetch(`${BASE}/api/public/employees?${qs}`, {
      headers: { "x-api-key": KEY },
    });
    if (!res.ok) throw new Error(`HR API ${res.status}`);
    const body = await res.json();
    out.push(...body.employees);
    if (out.length >= body.total || body.employees.length === 0) return out;
  }
}
```

---

## 6. Internal (in-app) alternative

Inside this app itself, employee data is read through TanStack server functions
(not this HTTP API) — see `.plans/employee.txt`, e.g. `listEmployeesAdmin`,
`getEmployeeDetail`. External systems should always use
`GET /api/public/employees`.

---

## 7. Setup checklist

- [ ] Set the `EMPLOYEE_API_KEY` secret in the project (Settings → Secrets).
- [ ] Store the same value in the consuming system's secret store.
- [ ] Whitelist / restrict callers at the network layer if possible.
- [ ] Rotate the key by updating the secret in both systems.
