import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type D = Record<string, any>;
const v = (x: any) => (x === null || x === undefined || x === "" ? "—" : String(x));
const num = (x: any) => (x === null || x === undefined || x === "" ? "—" : Number(x).toLocaleString());
const yn = (x: any) => (x ? "Yes" : "No");

const SECTIONS: { key: string; title: string; sensitive?: boolean; rows: (d: D) => [string, string][] }[] = [
  { key: "identity", title: "Identity & ID", rows: (d) => [
    ["Full name", v(d.full_name)], ["Employee code", v(d.emp_code)], ["Email", v(d.email)], ["Extra email", v(d.extra_email)],
    ["Phone", v(d.phone)], ["Gender", v(d.gender)], ["National ID / Passport", v(d.national_id)],
    ["ID issue date", v(d.id_issue_date)], ["ID expiry date", v(d.id_expiry_date)], ["5% quota", yn(d.is_five_percent)],
  ] },
  { key: "education", title: "Education", rows: (d) => [["Graduation", v(d.graduation)], ["Major", v(d.major)]] },
  { key: "work", title: "Work & reporting", rows: (d) => [
    ["Department", v(d.department)], ["Section", v(d.section_name)], ["Position", v(d.position)], ["Manager", v(d.manager_name)],
    ["Cost center", d.cost_center_code ? `#${d.cost_center_code} ${d.cost_center_name ?? ""}` : "—"], ["Shift", v(d.shift_name)],
    ["Job grade", v(d.job_grade)], ["Status", v(d.status)],
  ] },
  { key: "contract", title: "Contract", rows: (d) => [
    ["Contract type", v(d.contract_type)], ["Start", v(d.contract_start_date)], ["End", v(d.contract_end_date)], ["Cancelled", yn(d.contract_cancelled)],
  ] },
  { key: "location", title: "Location", rows: (d) => [["City", v(d.city)], ["District", v(d.district)]] },
  { key: "insurance", title: "Insurance", rows: (d) => [
    ["Insured", yn(d.is_insured)], ["Medical insurance type", v(d.medical_insurance_type)], ["Medical insurance no.", v(d.medical_insurance_number)],
    ["Medical insurance details", v(d.medical_insurance_details)], ["Social insurance date", v(d.social_insurance_date)], ["Military expire date", v(d.military_expire_date)],
  ] },
  { key: "compensation", title: "Compensation & bank (sensitive)", sensitive: true, rows: (d) => [
    ["Salary basis", v(d.salary_mode)], ["Gross salary", num(d.salary_gross)], ["Net salary", num(d.salary_net)], ["Allowance", num(d.allowance)],
    ["Insurance salary", num(d.insurance_salary)], ["Emergency relief fund", num(d.emergency_fund)], ["Target value", num(d.target_value)],
    ["Target duration", v(d.target_duration)], ["Bank name", v(d.bank_name)], ["Bank account", v(d.bank_account_number)],
  ] },
];

export function ExportProfilePdf({ detail }: { detail: D }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(SECTIONS.map((s) => [s.key, !s.sensitive])));

  const run = async () => {
    setBusy(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      doc.setFontSize(16);
      doc.text(`Employee profile: ${detail.full_name ?? ""}`, 40, 50);
      doc.setFontSize(9);
      doc.text(`Code ${detail.emp_code ?? "—"}  ·  Generated ${new Date().toLocaleString()}`, 40, 66);
      let y = 84;
      for (const s of SECTIONS.filter((s) => sel[s.key])) {
        autoTable(doc, {
          startY: y,
          head: [[s.title, ""]],
          body: s.rows(detail),
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 4 },
          columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" } },
        });
        y = (doc as any).lastAutoTable.finalY + 14;
      }
      doc.save(`employee-${detail.emp_code ?? detail.id}.pdf`);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="mr-1.5 h-4 w-4" /> Export PDF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export profile as PDF</DialogTitle>
            <DialogDescription>Choose the sections to include. Salary and bank details are off by default.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {SECTIONS.map((s) => (
              <label key={s.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!sel[s.key]} onCheckedChange={(c) => setSel((p) => ({ ...p, [s.key]: !!c }))} />
                <span>{s.title}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={run} disabled={busy || !Object.values(sel).some(Boolean)}>{busy ? "Exporting…" : "Download PDF"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
