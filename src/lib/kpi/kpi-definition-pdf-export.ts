import { COMPANY_LOGO_BASE64 } from "./company-logo-base64";

export interface KpiDefPdfRow {
  id: number;
  category: string;
  name: string;
  definition: string;
  howMeasured: string;
  weight: number;   // decimal, e.g. 0.15 for 15 %
  target: number;   // decimal, e.g. 0.90 for 90 %
  unit?: string;
}

export interface KpiDefPdfEmployee {
  fullName?: string | null;
  position?: string | null;
  department?: string | null;
  jobGrade?: string | null;
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
  const margin = 40;

  // ── Brand palette ────────────────────────────────────────────────────────
  const brandOrange: [number, number, number] = [234, 88, 12];   // #ea580c
  const darkNavy:   [number, number, number] = [15, 23, 42];     // #0f172a
  const slateMuted: [number, number, number] = [100, 116, 139];  // #64748b
  const lightBg:    [number, number, number] = [248, 250, 252];  // #f8fafc
  const borderGray: [number, number, number] = [226, 232, 240];  // #e2e8f0
  const headerBg:   [number, number, number] = [15, 23, 42];     // dark header

  let currentY = margin - 6;

  // ── 1. Header: Logo + Company name ───────────────────────────────────────
  const logoWidth  = 118;
  const logoHeight = 40;
  try {
    doc.addImage(COMPANY_LOGO_BASE64, "PNG", margin, currentY, logoWidth, logoHeight);
  } catch {
    // fallback: text only
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...darkNavy);
  doc.text("INTEGRATED TECHNICS", pageWidth - margin, currentY + 14, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...brandOrange);
  doc.text("KPI Performance Framework", pageWidth - margin, currentY + 28, { align: "right" });

  currentY += logoHeight + 10;

  // ── 2. Orange divider line ────────────────────────────────────────────────
  doc.setDrawColor(...brandOrange);
  doc.setLineWidth(2);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // ── 3. Document title ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...darkNavy);
  const titleYear = year ? ` – ${year}` : "";
  doc.text(`KPIs Definition & Measurement Framework${titleYear}`, margin, currentY + 12);
  currentY += 28;

  // ── 4. Employee identity block ────────────────────────────────────────────
  if (employee?.fullName || employee?.position) {
    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.5);
    const infoBoxH = 36;
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, infoBoxH, 4, 4, "FD");

    const col1 = margin + 12;
    const col2 = pageWidth * 0.42;
    const col3 = pageWidth * 0.68;
    const textY = currentY + 13;

    // Label+value helper
    const cell = (label: string, value: string, x: number, maxW: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...slateMuted);
      doc.text(label.toUpperCase(), x, textY - 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...darkNavy);
      const trimmed = doc.splitTextToSize(value || "—", maxW)[0];
      doc.text(trimmed, x, textY + 9);
    };

    cell("Employee", employee.fullName || "", col1, col2 - col1 - 8);
    cell("Position", employee.position || "", col2, col3 - col2 - 8);
    cell("Department", employee.department || "", col3, pageWidth - margin - col3 - 8);

    currentY += infoBoxH + 10;
  }

  // ── 5. KPI table ──────────────────────────────────────────────────────────
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // Group rows by category to build body with merged category cells
  type BodyRow = (string | { content: string; rowSpan?: number; styles?: object })[];
  const body: BodyRow[] = [];

  // Track category spans for rowSpan grouping
  let categoryGroups: { category: string; count: number; startIdx: number }[] = [];
  rows.forEach((r) => {
    const last = categoryGroups[categoryGroups.length - 1];
    if (last && last.category === r.category) {
      last.count++;
    } else {
      categoryGroups.push({ category: r.category, count: 1, startIdx: body.length });
    }
  });

  let cgIdx = 0;
  let cgRemaining = 0;

  rows.forEach((r, i) => {
    if (cgRemaining === 0) {
      cgRemaining = categoryGroups[cgIdx]?.count || 1;
      cgIdx++;
    }
    cgRemaining--;

    const categoryCell =
      cgRemaining === categoryGroups[cgIdx - 1]?.count - 1
        ? {
            content: r.category,
            rowSpan: categoryGroups[cgIdx - 1]?.count,
            styles: { valign: "middle", fontStyle: "bold", fillColor: lightBg },
          }
        : i === 0 || rows[i - 1]?.category !== r.category
        ? {
            content: r.category,
            rowSpan: (categoryGroups.find((g) => g.category === r.category)?.count) || 1,
            styles: { valign: "middle", fontStyle: "bold", fillColor: lightBg },
          }
        : null;

    const rowArr: BodyRow = [
      String(i + 1),
      categoryCell as any,
      r.name,
      r.definition || "—",
      r.howMeasured || "—",
      pct(r.weight),
      pct(r.target),
    ].filter((c) => c !== null) as BodyRow;

    // If category cell was null (continuation rows), insert placeholder at index 1
    if (categoryCell === null) {
      rowArr.splice(1, 0, "" as any);
    }

    body.push(rowArr);
  });

  // Simpler flat build (jspdf-autotable rowSpan is tricky; use flat rows with repeated category)
  const flatBody: string[][] = rows.map((r, i) => [
    String(i + 1),
    r.category,
    r.name,
    r.definition || "—",
    r.howMeasured || "—",
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
      "Weight (%)",
      "Target",
    ]],
    body: flatBody,
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - margin * 2,
    styles: {
      fontSize: 8,
      cellPadding: 5,
      lineColor: borderGray,
      lineWidth: 0.4,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: headerBg,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      cellPadding: 6,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: 90, fontStyle: "bold", fillColor: lightBg },
      2: { cellWidth: 110, fontStyle: "bold" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 120 },
      5: { halign: "center", cellWidth: 50, fontStyle: "bold", textColor: brandOrange },
      6: { halign: "center", cellWidth: 50, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    rowPageBreak: "auto",
    didParseCell(data) {
      // Category column: bold + light bg for all rows
      if (data.column.index === 1 && data.section === "body") {
        data.cell.styles.fillColor = lightBg;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = darkNavy;
      }
    },
    didDrawPage(data) {
      // ── Footer on each page ───────────────────────────────────────────────
      const footY = pageHeight - 22;
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.5);
      doc.line(margin, footY - 6, pageWidth - margin, footY - 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...slateMuted);
      doc.text("INTEGRATED TECHNICS — Confidential Internal Document", margin, footY + 2);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - margin,
        footY + 2,
        { align: "right" }
      );
    },
  });

  // ── 6. Totals row (weight sum) ────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY ?? currentY;
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);

  doc.setFillColor(...darkNavy);
  doc.rect(margin, finalY, pageWidth - margin * 2, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `TOTAL WEIGHT: ${pct(totalWeight)}    |    ${rows.length} KPI Indicators`,
    pageWidth / 2,
    finalY + 13,
    { align: "center" }
  );

  // ── 7. Save ───────────────────────────────────────────────────────────────
  const empSlug = employee?.fullName
    ? `_${employee.fullName.replace(/\s+/g, "-")}`
    : "";
  doc.save(`KPI-Definition${empSlug}${titleYear ? `_${year}` : ""}.pdf`);
}

