import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, FileText, LayoutTemplate } from "lucide-react";
import {
  listContractTemplates,
  upsertContractTemplate,
  deleteContractTemplate,
} from "@/backend/functions/contractTemplates.functions";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  body: string;
  active: boolean;
  updated_at: string;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  body: string;
  active: boolean;
};

const emptyDraft: Draft = { name: "", description: "", body: "", active: true };

const TEMPLATE_STARTERS: { label: string; draft: Draft }[] = [
  {
    label: "Full-Time Employment",
    draft: {
      name: "Full-Time Employment Agreement",
      description: "Standard full-time employment contract with benefits.",
      body: `EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into between {{company_name}} ("Employer") and {{employee_name}} ("Employee").

1. POSITION & DUTIES
   The Employee is hired as {{position}} in the {{department}} department. The Employee agrees to perform all duties assigned by the Employer in a professional manner.

2. START DATE
   The employment shall commence on {{start_date}}.

3. COMPENSATION
   The Employee shall receive a gross monthly salary of {{salary}} payable in accordance with the Employer's payroll schedule.

4. BENEFITS
   The Employee is entitled to health insurance, annual leave, and other benefits as per company policy.

5. TERMINATION
   Either party may terminate this Agreement with {{notice_period}} written notice.

6. CONFIDENTIALITY
   The Employee agrees to keep all proprietary information confidential during and after employment.

Signed on behalf of the Employer: ___________________
Employee signature: ___________________`,
      active: true,
    },
  },
  {
    label: "Part-Time Employment",
    draft: {
      name: "Part-Time Employment Agreement",
      description: "Part-time contract with pro-rata benefits.",
      body: `PART-TIME EMPLOYMENT AGREEMENT

This Part-Time Employment Agreement is made between {{company_name}} ("Employer") and {{employee_name}} ("Employee").

1. POSITION & HOURS
   The Employee is engaged as {{position}} on a part-time basis, working {{working_hours}} hours per week.

2. START DATE
   Employment begins on {{start_date}}.

3. REMUNERATION
   The Employee shall be paid an hourly rate of {{hourly_rate}} or a pro-rata monthly salary of {{salary}}, as applicable.

4. LEAVE ENTITLEMENT
   Annual leave and other benefits shall be calculated on a pro-rata basis according to hours worked.

5. TERMINATION
   Either party may terminate this Agreement with {{notice_period}} written notice.

Signed by Employer: ___________________
Signed by Employee: ___________________`,
      active: true,
    },
  },
  {
    label: "Internship",
    draft: {
      name: "Internship Agreement",
      description: "Internship contract with learning objectives.",
      body: `INTERNSHIP AGREEMENT

This Internship Agreement ("Agreement") is entered into between {{company_name}} ("Organization") and {{employee_name}} ("Intern").

1. INTERNSHIP ROLE
   The Intern will serve in the {{department}} department as {{position}}.

2. DURATION
   The internship period shall commence on {{start_date}} and conclude on {{end_date}}.

3. STIPEND / COMPENSATION
   The Intern shall receive a monthly stipend of {{salary}} (or as mutually agreed).

4. SUPERVISION & LEARNING
   The Organization shall assign a supervisor to guide the Intern and provide relevant training.

5. CONFIDENTIALITY
   The Intern agrees not to disclose any confidential information obtained during the internship.

6. CERTIFICATE
   Upon successful completion, the Organization shall provide a certificate of internship.

Organization representative: ___________________
Intern: ___________________`,
      active: true,
    },
  },
  {
    label: "Freelance / Service",
    draft: {
      name: "Freelance Service Agreement",
      description: "Independent contractor / service agreement.",
      body: `SERVICE AGREEMENT (INDEPENDENT CONTRACTOR)

This Service Agreement ("Agreement") is made between {{company_name}} ("Client") and {{employee_name}} ("Contractor").

1. SERVICES
   The Contractor agrees to provide the following services: {{position}} / {{department}}.

2. TERM
   This Agreement is effective from {{start_date}} to {{end_date}} unless terminated earlier.

3. FEES
   The Client shall pay the Contractor {{salary}} as agreed for the services rendered.

4. INDEPENDENT CONTRACTOR
   The Contractor is an independent contractor and not an employee of the Client.

5. OWNERSHIP
   All deliverables created by the Contractor shall become the property of the Client upon full payment.

6. TERMINATION
   Either party may terminate with {{notice_period}} written notice.

Client signature: ___________________
Contractor signature: ___________________`,
      active: true,
    },
  },
  {
    label: "Probationary Employment",
    draft: {
      name: "Probationary Employment Agreement",
      description: "Employment with an initial probationary period.",
      body: `PROBATIONARY EMPLOYMENT AGREEMENT

This Probationary Employment Agreement is entered into between {{company_name}} ("Employer") and {{employee_name}} ("Employee").

1. POSITION
   The Employee is appointed as {{position}} in the {{department}} department.

2. PROBATION PERIOD
   The Employee shall serve a probationary period of {{probation_period}} months, commencing on {{start_date}}.

3. EVALUATION
   The Employer shall evaluate the Employee's performance during the probationary period.

4. CONFIRMATION
   Upon successful completion of the probationary period, the Employee shall be confirmed in the role with adjusted terms.

5. COMPENSATION (PROBATION)
   During probation, the Employee shall receive a gross monthly salary of {{salary}}.

6. TERMINATION DURING PROBATION
   Either party may terminate this Agreement during the probationary period with {{notice_period}} written notice.

Employer: ___________________
Employee: ___________________`,
      active: true,
    },
  },
];

export function ContractTemplatesManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(listContractTemplates);
  const upsertFn = useServerFn(upsertContractTemplate);
  const deleteFn = useServerFn(deleteContractTemplate);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contractTemplates"],
    queryFn: () => listFn() as Promise<TemplateRow[]>,
  });

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["contractTemplates"] });

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      upsertFn({
        data: {
          id: d.id,
          name: d.name,
          description: d.description || null,
          body: d.body,
          active: d.active,
        },
      }),
    onSuccess: () => {
      toast.success("Template saved");
      setDraft(emptyDraft);
      setEditing(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(row: TemplateRow) {
    setDraft({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      body: row.body ?? "",
      active: row.active,
    });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(emptyDraft);
    setEditing(false);
  }

  function submit() {
    if (!draft.name.trim()) return toast.error("Name is required");
    saveMut.mutate(draft);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {editing ? "Edit Contract Template" : "New Contract Template"}
          </h3>
          {editing && (
            <button
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          )}
        </div>
        {!editing && (
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <LayoutTemplate className="h-3.5 w-3.5" /> Load starter:
            </span>
            {TEMPLATE_STARTERS.map((t) => (
              <button
                key={t.label}
                onClick={() => setDraft({ ...t.draft })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  draft.name === t.draft.name
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
            placeholder="Template name (e.g. Standard Full-Time)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
            placeholder="Description (optional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <textarea
          className="mt-3 min-h-[220px] w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-xs leading-relaxed"
          placeholder={`Template body. You can use placeholders like {{employee_name}}, {{position}}, {{start_date}}, {{salary}}.`}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Active
          </label>
          <button
            onClick={submit}
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {editing ? "Save changes" : "Create template"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">Name</th>
              <th className="px-3 py-2 text-start">Description</th>
              <th className="px-3 py-2 text-start w-[90px]">Active</th>
              <th className="px-3 py-2 text-end w-[140px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-5 w-5 opacity-50" />
                  No templates yet — create your first above.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.active ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-2 text-end">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => startEdit(r)}
                      className="rounded-lg p-1.5 text-foreground hover:bg-muted"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete template "${r.name}"?`)) delMut.mutate(r.id);
                      }}
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}