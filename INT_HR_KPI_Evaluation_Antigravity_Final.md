# INT HR — KPI Templates & Quarterly Performance Evaluations
## Antigravity Implementation Brief (v2)

**Scope:** Enhance existing `Admin / KPI Evaluations / Templates` and related manager, HR Admin, and employee pages. **Do not rebuild or replace existing HR, organization, attendance or evaluation systems.** First inspect the implementation, schema, permissions, formulas, and existing records, then apply the smallest safe changes.

## 1. Objective
Create a configurable, company-wide KPI evaluation process based on existing HR departments, positions and seniority levels. Direct managers evaluate their assigned employees **per KPI, each quarter**. HR Admin reviews and approves. Employees see only approved results. The system calculates KPI achievement, weighted quarterly score and final annual result.

The reference is the company's Junior ELV / Light Current Site Engineer evaluation spreadsheet: KPI Name, Weight, Target, and for Q1–Q4 Actual, Achievement %, Score, plus an annual weighted result. **Use its structure as a conceptual reference, not as a fixed engineering-only template or unquestioned calculation rule.**

## 2. Existing organizational data — reuse, do not duplicate
- Reuse the existing Department records (the requested “Group” means the existing Department).
- Reuse existing positions/jobs and reporting manager relationships. Introduce configurable levels (Junior/Mid/Senior/etc.) only if not already represented.
- The manager's employee list is based on **actual direct reporting assignment**, not everyone in the same department.
- If a manager changes mid-quarter, HR Admin must be able to explicitly assign an evaluation owner, with an audit trail.

## 3. Editable, reusable templates — critical requirement
The HR Admin can create, edit, duplicate, archive, preview and publish templates by **Department → Position → Level**. Support template names, descriptions, valid-from/valid-to or effective quarter, KPI lines and a clear active/draft/version status.

KPI lines must be **fully editable** before publishing:
- KPI name and description; category: Common / Position-Specific; optional KPI code.
- Measurement method: percentage, number, money (currency), time, rating scale or other supported unit.
- Weight (%), Target, measurement unit, optional minimum/maximum, scoring direction (higher-is-better / lower-is-better / target-range), and calculation/scoring method.
- Optional evidence/source, instructions and evaluator comments.
- Allow add/remove/reorder KPI lines, including future metrics such as **Cost Efficiency / Cost Reduction**, **Work Completion Speed**, attendance, teamwork, quality, error rate, first-time fix rate, etc.
- Common KPIs should be available in a reusable KPI library, but their *use, target and weight* are configurable per position-level template. Do not force every position to share all KPIs.
- Validate total active KPI line weights = **100%** before publishing; drafts may have incomplete weights. Flag missing/invalid targets, units, directions and ambiguous scoring methods.
- The admin must be able to replace or remove an irrelevant KPI for a given role without changing other role templates.

### Versioning and backward compatibility
**Never silently mutate an active template that has been used in a submitted or approved evaluation.** Editing such a template creates a **new draft version**, including changes to lines, targets, units, weights or formulas. HR Admin reviews and publishes the new version for a future designated quarter. Existing evaluation records keep a snapshot/reference of the exact published template version, KPI definitions, targets, weights, scoring rules and results used at evaluation time.

Only one default published template should apply for a given Department + Position + Level + effective period (unless a clear explicit override rule exists). Past quarterly/annual reports must remain reproducible after any template edits. Draft version changes must not retroactively alter an in-progress quarter without an explicit, logged admin migration procedure.

## 4. Quarterly workflow
1. HR Admin opens Q1/Q2/Q3/Q4 for the appropriate year and publishes applicable templates. Define quarter date ranges and submission/approval deadlines in admin settings.
2. Manager opens **My Team Evaluations** and sees ONLY employees they are authorized to evaluate, with quarter and status: Not Started, Draft, Submitted, Returned, Approved (and optionally Locked).
3. Selecting an employee loads their assigned template version from Department + Position + Level for that quarter. If no suitable template exists, show **Missing Template** and let HR Admin resolve; do not silently use an unrelated template.
4. Manager enters **Actual** for each KPI (and comments/evidence when required). Read-only fields calculate Achievement % and Weighted Score. Save Draft supports incomplete entries.
5. Manager reviews a read-only score summary and **Submits**. Submission validates required KPI fields and prevents duplicate submissions for the same employee/year/quarter unless formally returned.
6. HR Admin reviews individual KPI results, manager comments, evidence and calculated totals; **Approve** or **Return for Correction** with a required reason. All transitions are timestamped and attributed.
7. Approved quarter is immutable except for a permission-controlled, audited reopen/correction workflow. Employee sees that quarter's approved results; do not expose unapproved drafts.
8. End of year: show an annual summary once all four required quarters are approved; identify missing quarters instead of treating them as zero. Support an explicit HR-administered exception policy for employees joining/leaving during the year.

## 5. Precise calculation design
Distinguish between **Target**, **Actual**, **Achievement %**, **KPI Weight**, **Weighted KPI Score**, **Quarter Score** and **Annual Score**. These are not interchangeable.

For percentage KPIs where *higher is better*, a reasonable default is:
`achievement_ratio = actual / target` (when target > 0), `weighted_score_points = weight_percentage * achievement_ratio`.
Example: Attendance weight 20%, target 95%, actual 90% → achievement 94.7368%, weighted contribution 18.9474 points **out of 20**, before any cap.

Important:
- Do not apply `actual / target` blindly to ratings, cost, time, error counts or zero targets.
- A **lower-is-better** KPI needs an appropriate agreed scoring policy (often `target / actual` with explicit zero-handling, or a threshold-based scoring table). A KPI like “Cost Reduction” must specify whether the measured item is savings achieved (higher better) or cost incurred (lower better).
- Rating scales need explicit mappings (e.g., 1–5), not arbitrary percentage conversions without definition.
- Configure whether Achievement is **capped at 100%** or may exceed 100%, and whether a score can be negative; use a conservative default of capping at 100% unless existing company rules specify otherwise. Show over-target actual separately.
- Quarterly score = sum of all weighted KPI point contributions for that quarter (maximum 100 points under a 100% cap).
- Annual score: by default average the four **approved quarterly scores** equally (25% each). Make quarter weighting a policy setting if required; **do not confuse manager-assigned quarterly scores with fixed quarter weights**. Annual score is not the sum of four scores each out of 100.
- Make precision/rounding rules explicit and perform final calculations server-side from immutable inputs.
- Display formula explanation and calculation breakdown to admins/managers to aid review.
- If the current application already has an established calculation policy, inspect and document it first; preserve it or propose any deviation for review rather than silently changing scores.

## 6. Example template (illustrative only)
**Department:** Engineering; **Position:** Light Current Site Engineer; **Level:** Junior.

| KPI | Category | Weight | Target | Unit | Direction |
|---|---|---:|---:|---|---|
| Attendance Compliance | Common | 15% | 95 | % | Higher |
| Work Quality / First-Time Pass | Role-specific | 25% | 90 | % | Higher |
| On-Time Task Completion | Role-specific | 25% | 90 | % | Higher |
| Teamwork & Conduct | Common | 15% | 4 | Rating / 5 | Rating mapping |
| Cost Efficiency | Role-specific | 10% | Defined by project | EGP or % | Depends on definition |
| Reporting Timeliness | Role-specific | 10% | 100 | % | Higher |
| **Total** | | **100%** | | | |

*This is an example, not company policy; HR Admin edits all KPI criteria, targets, and weights.* The same template can be duplicated for Senior and then independently modified. Tomorrow, an admin can add “Work Completion Speed” or replace “Cost Efficiency” and rebalance weights; publish a new version without affecting past results.

## 7. UI/UX requirements
Keep existing INT HR design and navigation patterns; responsive desktop/mobile; bilingual/RTL if supported by the current product.
- **Admin → KPI Evaluation → Templates:** searchable filter by Department, Position, Level, status, version, effective quarter; cascading selectors; editable KPI grid; add KPI from library/create new; visible weight-total counter; preview, save draft, duplicate, publish, archive, compare versions.
- **Manager → My Team Evaluations:** employee list, quarter selector, progress/status, missing-template alerts, KPI-level Actual inputs with targets/weights/calculated scores, comments, Save Draft, Submit.
- **HR Admin → Evaluation Approvals:** queue by department/manager/quarter, review KPI details, Approve, Return with reason, audit history, deadlines/overdue indicators.
- **Employee → My Performance:** approved Q1–Q4 results, KPI breakdown and allowed feedback, annual score when complete; no exposure of other employees' results.
- **Reports:** completion by quarter/department/manager, approved vs pending, historical performance by quarter, annual summary, export if an export system already exists.

## 8. Access control, integrity and edge cases
- Enforce authorization **server-side** and with existing database security/RLS where applicable. A manager may not evaluate unrelated employees by changing request IDs.
- HR Admin controls template publishing and final approvals; evaluator and approver actions must be tracked separately.
- Preserve current data and audit events; avoid destructive migrations. Consider employees with missing position/level/manager, transfers, leave, departures, mid-quarter role changes, missing quarter, returned evaluations and concurrent edits.
- Guard against double-submits, duplicate evaluations and conflicting published templates. Provide meaningful validation errors.
- If attendance is auto-imported from the existing HR attendance module, provide the date range, calculation rules, missing-data behavior and provenance; do not assume attendance scores are accurate without validation. Manual overrides need reasons and permissions.

## 9. Implementation approach and acceptance tests
1. Audit existing screens, source files, DB schema, relationships, scoring formulas and security. Summarize existing functionality and minimal change plan.
2. Reuse components and tables where appropriate. Create minimal additive migrations, preserving every existing evaluation/template. Implement version snapshots and quarter approval state handling.
3. Build template CRUD + versioning, manager evaluation, HR Admin approval, employee visibility, summary/reporting.
4. Test these scenarios: (a) manager with five direct reports sees exactly five; (b) different roles and levels load different published templates; (c) draft with 85% total weight saves but cannot publish; (d) adding Cost Efficiency in a new version preserves previously approved Q1; (e) user cannot view or edit unauthorized evaluations; (f) returned submission can be corrected and resubmitted; (g) employee sees approved Q1 but not unapproved Q2; (h) annual score awaits required approvals; (i) no double-counting or incorrect lower-is-better math; (j) quarterly results survive template changes.
5. Include concise notes on any product decisions requiring HR policy approval (scoring cap, rating conversion, lower-is-better mapping, annual weighting, partial-year eligibility).

**Engineering directive:** You have the green light to implement within this scope. Keep logic simple, accurate, safe and maintainable. Do not produce unnecessarily long code. Reuse existing architecture, avoid introducing duplicate master data, and do not break or replace current functionality.
