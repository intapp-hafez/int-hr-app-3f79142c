import { COMPANY_LOGO_BASE64 } from "./company-logo-base64";

export interface KpiDefPdfRow {
  id: number;
  category: string;
  name: string;
  definition: string;
  howMeasured: string;
  weight: number;   // decimal 0–1  e.g. 0.15 = 15 %
  target: number;   // decimal 0–1  e.g. 0.90 = 90 %
  unit?: string;
}

export interface KpiDefPdfEmployee {
  fullName?: string | null;
  position?: string | null;
  department?: string | null;
}

export async function exportKpiDefinitionPdf(
  rows: KpiDefPdfRow[],
  employee?: KpiDefPdfEmployee,
  year?: number
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  // ── Brand palette ─────────────────────────────────────────────────────────
  const brandOrange: [number, number, number] = [234, 88, 12];    // #ea580c
  const headerBg:   [number, number, number] = [45, 50, 60];      // charcoal header bar
  const tableHead:  [number, number, number] = [45, 50, 60];      // same dark for table header
  const catBg:      [number, number, number] = [255, 245, 238];   // very light orange tint for category
  const borderGray: [number, number, number] = [220, 220, 220];
  const white:      [number, number, number] = [255, 255, 255];

  // ── 1. Full-width dark header bar ─────────────────────────────────────────
  const headerH = 60;
  doc.setFillColor(...headerBg);
  doc.rect(0, 0, pageWidth, headerH, "F");

  // Logo inside header on the left
  const logoSize = 48;
  try {
    doc.addImage(COMPANY_LOGO_BASE64, "PNG", margin - 4, 6, logoSize, logoSize);
  } catch {
    // fallback: skip logo
  }

  // Company name inside header
  const textX = margin + logoSize + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...white);
  doc.text("INTEGRATED TECHNICS", textX, 30);

  // Orange subtitle line: doc type | job title | department
  const parts: string[] = ["Quarterly KPI Evaluation"];
  if (employee?.position) parts.push(`Job Title:  ${employee.position}`);
  if (employee?.department) parts.push(`Department: ${employee.department}`);
  const subtitle = parts.join("   |   ");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...brandOrange);
  doc.text(subtitle, textX, 48);

  let currentY = headerH + 10;

  // ── 2. KPI table ──────────────────────────────────────────────────────────
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // Build flat body rows; track category spans to merge visually
  const body: string[][] = rows.map((r, i) => [
    String(i + 1),
    r.category,
    r.name,
    r.definition || "—",
    r.howMeasured || (r.unit ? `Measured in ${r.unit}` : "—"),
    pct(r.weight),
    pct(r.target),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [[
      "#",
      "Category",
      "KPI / Metric Name",
      "Definition (What it measures)",
      "How it's measured",
      "Weight\n(%)",
      "Target",
    ]],
    body,
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - margin * 2,
    styles: {
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
      lineColor: borderGray,
      lineWidth: 0.4,
      valign: "middle",
      overflow: "linebreak",
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: tableHead,
      textColor: white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 20, fontStyle: "bold" },
      1: { cellWidth: 95, fontStyle: "bold", fillColor: catBg },
      2: { cellWidth: 110 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 110 },
      5: { halign: "center", cellWidth: 42, fontStyle: "bold" },
      6: { halign: "center", cellWidth: 42, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    rowPageBreak: "auto",
    didParseCell(data) {
      // Category col: always light orange bg + dark bold text
      if (data.column.index === 1 && data.section === "body") {
        data.cell.styles.fillColor = catBg;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [80, 30, 0];
      }
      // Weight col: orange text
      if (data.column.index === 5 && data.section === "body") {
        data.cell.styles.textColor = brandOrange;
      }
    },
    didDrawPage(data) {
      // Footer on every page
      const footY = pageHeight - 16;
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.4);
      doc.line(margin, footY - 5, pageWidth - margin, footY - 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text("INTEGRATED TECHNICS — Confidential Internal HR Document", margin, footY + 2);
      const yearStr = year ? ` ${year}` : "";
      doc.text(
        `KPI Performance Framework${yearStr}   |   Page ${data.pageNumber}`,
        pageWidth - margin,
        footY + 2,
        { align: "right" }
      );
    },
  });

  // ── 3. Totals footer row ───────────────────────────────────────────────────
  const finalY: number = (doc as any).lastAutoTable?.finalY ?? currentY;
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);

  doc.setFillColor(...tableHead);
  doc.rect(margin, finalY, pageWidth - margin * 2, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...white);
  doc.text(
    `TOTAL WEIGHT: ${pct(totalWeight)}   |   ${rows.length} KPI Indicators`,
    pageWidth / 2,
    finalY + 13,
    { align: "center" }
  );

  // ── 4. Save ────────────────────────────────────────────────────────────────
  const posSlug = employee?.position
    ? `_${employee.position.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}`
    : "";
  const yearStr = year ? `_${year}` : "";
  doc.save(`KPI-Definition${posSlug}${yearStr}.pdf`);
}
