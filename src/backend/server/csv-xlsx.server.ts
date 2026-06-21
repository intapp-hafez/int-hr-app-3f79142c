import * as XLSX from "xlsx";

export type ActivityRow = {
  employee_name: string;
  employee_email: string;
  national_id?: string;
  id_issue_date?: string;
  id_expiry_date?: string;
  kind: string;
  task_name: string;
  occurred_at: string;
  city: string;
  district: string;
  note: string;
};

export function rowsToCsv(rows: ActivityRow[]): Uint8Array {
  const headers = ["Employee", "Email", "National ID", "ID Issue Date", "ID Expiry Date", "Type", "Task", "Time", "City", "District", "Note"];
  const esc = (v: string) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      esc(r.employee_name), esc(r.employee_email),
      esc(r.national_id ?? ""), esc(r.id_issue_date ?? ""), esc(r.id_expiry_date ?? ""),
      esc(r.kind), esc(r.task_name),
      esc(r.occurred_at), esc(r.city), esc(r.district), esc(r.note),
    ].join(","));
  }
  return new TextEncoder().encode("\uFEFF" + lines.join("\n"));
}

export function rowsToXlsx(rows: ActivityRow[]): Uint8Array {
  const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
    Employee: r.employee_name,
    Email: r.employee_email,
    "National ID": r.national_id ?? "",
    "ID Issue Date": r.id_issue_date ?? "",
    "ID Expiry Date": r.id_expiry_date ?? "",
    Type: r.kind,
    Task: r.task_name,
    Time: r.occurred_at,
    City: r.city,
    District: r.district,
    Note: r.note,
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activity");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(buf);
}