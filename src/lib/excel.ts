export async function downloadTemplate(filename: string, headers: string[], sample: Record<string, string | number | boolean>[] = []) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(sample.length ? sample : [headers.reduce((acc, h) => ({ ...acc, [h]: "" }), {})], { header: headers });
  ws["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length + 5, 20),
  }));
  const wb = XLSX.utils.book_new();
  const rawSheetName = filename.replace(/\.xlsx$/i, "").replace(/[_-]/g, " ") || "Template";
  const sheetName = (rawSheetName.charAt(0).toUpperCase() + rawSheetName.slice(1)).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export async function parseExcelFile<T = Record<string, unknown>>(file: File): Promise<T[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<T>(ws, { defval: "" });
}