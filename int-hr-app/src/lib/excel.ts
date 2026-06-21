import * as XLSX from "xlsx";

export function downloadTemplate(filename: string, headers: string[], sample: Record<string, string | number | boolean>[] = []) {
  const ws = XLSX.utils.json_to_sheet(sample.length ? sample : [headers.reduce((acc, h) => ({ ...acc, [h]: "" }), {})], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

export async function parseExcelFile<T = Record<string, unknown>>(file: File): Promise<T[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<T>(ws, { defval: "" });
}