import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import { COMPANY_LOGO_BASE64 } from "./company-logo-base64";

export interface KpiDefPdfRow {
  id: number | string;
  category: string;
  name: string;
  definition: string;
  howMeasured: string;
  weight: number; // decimal 0–1 (e.g. 0.15 = 15%) or whole percentage (e.g. 15)
  target: number | string; // decimal 0–1 or benchmark number or formatted string
  unit?: string;
}

export interface KpiDefPdfMetadata {
  fullName?: string | null;
  empCode?: string | null;
  position?: string | null;
  department?: string | null;
  templateName?: string | null;
  version?: string | null;
}

export async function exportKpiDefinitionPdf(
  rows: KpiDefPdfRow[],
  meta?: KpiDefPdfMetadata,
  year?: number
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // ── Executive Brand Palette (Integrated Technics Corporate Identity) ──────
  const brandOrange: [number, number, number] = [234, 88, 12]; // #ea580c
  const darkNavy: [number, number, number] = [15, 23, 42]; // #0f172a
  const slateMuted: [number, number, number] = [100, 116, 139]; // #64748b
  const slateDark: [number, number, number] = [51, 65, 85]; // #334155
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc
  const borderGray: [number, number, number] = [226, 232, 240]; // #e2e8f0
  const emeraldGreen: [number, number, number] = [16, 185, 129]; // #10b981
  const catBg: [number, number, number] = [255, 247, 237]; // #fff7ed
  const catText: [number, number, number] = [154, 52, 18]; // #9a3412
  const white: [number, number, number] = [255, 255, 255];

  let currentY = margin - 6;

  // ── 1. Top Brand Header ───────────────────────────────────────────────────
  // Company Logo on Left (aspect ratio ~2.946: 118 x 40 pt)
  const logoWidth = 118;
  const logoHeight = 40;
  try {
    doc.addImage(COMPANY_LOGO_BASE64, "PNG", margin, currentY, logoWidth, logoHeight);
  } catch {
    // Fallback text if logo fails to render
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...darkNavy);
    doc.text("INTEGRATED TECHNICS", margin, currentY + 24);
  }

  // Header Title & Document Subtitle on Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...darkNavy);
  doc.text("INTEGRATED TECHNICS", pageWidth - margin, currentY + 13, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...brandOrange);
  doc.text(
    "OFFICIAL KPI DEFINITION & MEASUREMENT FRAMEWORK",
    pageWidth - margin,
    currentY + 26,
    { align: "right" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  doc.text(
    "Human Resources & Performance Management   |   Corporate Standards",
    pageWidth - margin,
    currentY + 37,
    { align: "right" }
  );

  currentY += logoHeight + 8;

  // Header Divider Rule
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.75);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // ── 2. Role & Metadata Summary Strip ──────────────────────────────────────
  const metaBoxHeight = 36;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderGray);
  doc.roundedRect(margin, currentY, contentWidth, metaBoxHeight, 4, 4, "FD");

  // Left accent pill border
  doc.setFillColor(...brandOrange);
  doc.roundedRect(margin, currentY, 4, metaBoxHeight, 2, 2, "F");

  // Role Title & Sub-metadata
  const effectivePosition = meta?.position || "Corporate Standard / General";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...darkNavy);
  doc.text(`POSITION: ${effectivePosition.toUpperCase()}`, margin + 14, currentY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);

  const subItems: string[] = [];
  if (meta?.department) subItems.push(`Department: ${meta.department}`);
  if (meta?.templateName) subItems.push(`Template: ${meta.templateName}`);
  if (meta?.fullName) {
    const codeStr = meta.empCode ? ` (${meta.empCode})` : "";
    subItems.push(`Employee: ${meta.fullName}${codeStr}`);
  }
  subItems.push(`Evaluation Cycle: ${year || new Date().getFullYear()}`);
  subItems.push(`Version: ${meta?.version || "v1.0"}`);

  doc.text(subItems.join("   |   "), margin + 14, currentY + 28);

  // Status Badge on Far Right
  const badgeWidth = 90;
  const badgeX = pageWidth - margin - badgeWidth - 10;
  doc.setFillColor(...emeraldGreen);
  doc.roundedRect(badgeX, currentY + 9, badgeWidth, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...white);
  doc.text("OFFICIAL & APPROVED", badgeX + badgeWidth / 2, currentY + 21, {
    align: "center",
  });

  currentY += metaBoxHeight + 10;

  // ── 3. Helper Formatter Functions ─────────────────────────────────────────
  const formatPct = (val: number | string): string => {
    const num = Number(val);
    if (isNaN(num)) return String(val || "0%");
    if (num <= 1 && num > 0) return `${Math.round(num * 100)}%`;
    return `${Math.round(num)}%`;
  };

  const formatTarget = (t: number | string, unit?: string): string => {
    if (t === undefined || t === null || t === "") return "100%";
    const num = Number(t);
    if (!isNaN(num)) {
      if (unit === "%") {
        return num <= 1 ? `${Math.round(num * 100)}%` : `${Math.round(num)}%`;
      }
      if (unit === "scale" || unit === "rating_5") {
        return `${num} (scale)`;
      }
      if (unit && unit !== "%") {
        return `${num} ${unit}`;
      }
      return num <= 1 ? `${Math.round(num * 100)}%` : `${num}%`;
    }
    return String(t);
  };

  // ── 4. Build Autotable Rows ───────────────────────────────────────────────
  const tableBody: string[][] = rows.map((r, i) => [
    String(i + 1),
    r.category || "General",
    r.name || `Metric ${i + 1}`,
    r.definition || "Standard role performance requirement.",
    r.howMeasured || (r.unit ? `Measured in ${r.unit}` : "Standard measurement benchmark"),
    formatPct(r.weight),
    formatTarget(r.target, r.unit),
  ]);

  // Compute total weight
  const totalWeightDec = rows.reduce((sum, r) => {
    const w = Number(r.weight || 0);
    return sum + (w > 1 ? w / 100 : w);
  }, 0);
  const totalWeightStr = `${Math.round(totalWeightDec * 100)}%`;

  // ── 5. Render Executive Table ─────────────────────────────────────────────
  autoTable(doc, {
    startY: currentY,
    head: [[
      "#",
      "Category",
      "KPI / Metric Name",
      "Definition (What it measures)",
      "How it's measured (Formula / Methodology)",
      "Weight\n(%)",
      "Target",
    ]],
    body: tableBody,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      lineColor: borderGray,
      lineWidth: 0.5,
      valign: "middle",
      overflow: "linebreak",
      textColor: darkNavy,
    },
    headStyles: {
      fillColor: darkNavy,
      textColor: white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
      lineWidth: 0.5,
      lineColor: darkNavy,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 24, fontStyle: "bold" },
      1: { cellWidth: 110, fontStyle: "bold" },
      2: { cellWidth: 135, fontStyle: "bold" },
      3: { cellWidth: "auto", textColor: slateDark },
      4: { cellWidth: 165, textColor: slateDark },
      5: { halign: "center", cellWidth: 46, fontStyle: "bold" },
      6: { halign: "center", cellWidth: 48, fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: lightBg,
    },
    rowPageBreak: "auto",
    didParseCell(data) {
      // Category Column: elegant tinted background pill style
      if (data.column.index === 1 && data.section === "body") {
        data.cell.styles.fillColor = catBg;
        data.cell.styles.textColor = catText;
        data.cell.styles.fontStyle = "bold";
      }
      // Weight Column: highlight with brand orange
      if (data.column.index === 5 && data.section === "body") {
        data.cell.styles.textColor = brandOrange;
        data.cell.styles.fontSize = 8.5;
      }
      // Target Column: bold dark slate
      if (data.column.index === 6 && data.section === "body") {
        data.cell.styles.textColor = darkNavy;
        data.cell.styles.fontSize = 8.5;
      }
    },
    didDrawPage(data) {
      // Running Footer on every page
      const footY = pageHeight - 16;
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.5);
      doc.line(margin, footY - 6, pageWidth - margin, footY - 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...slateMuted);
      doc.text(
        "INTEGRATED TECHNICS — Confidential Internal Human Resources Document",
        margin,
        footY + 4
      );

      const yrText = year ? ` ${year}` : "";
      doc.text(
        `KPI Performance Framework${yrText}   |   Page ${data.pageNumber}`,
        pageWidth - margin,
        footY + 4,
        { align: "right" }
      );
    },
  });

  // ── 6. Totals Footer Strip ────────────────────────────────────────────────
  let finalY: number = (doc as any).lastAutoTable?.finalY ?? currentY;
  const barHeight = 22;

  // Check if summary bar fits on current page, otherwise add page
  if (finalY + barHeight + 80 > pageHeight - margin) {
    doc.addPage();
    finalY = margin + 10;
  }

  doc.setFillColor(...darkNavy);
  doc.rect(margin, finalY, contentWidth, barHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...white);
  doc.text(
    `TOTAL WEIGHT: ${totalWeightStr}   |   ${rows.length} PERFORMANCE INDICATORS   |   STANDARD TARGET: 100%`,
    pageWidth / 2,
    finalY + 14,
    { align: "center" }
  );

  finalY += barHeight + 16;

  // ── 7. Sign-Off Approval Block ────────────────────────────────────────────
  // Check if sign-off block fits, otherwise push to next page
  const signBlockH = 68;
  if (finalY + signBlockH > pageHeight - margin - 20) {
    doc.addPage();
    finalY = margin + 15;
  }

  const colWidth = (contentWidth - 28) / 3;
  const signBoxes = [
    {
      title: "EMPLOYEE ACKNOWLEDGMENT",
      role: meta?.fullName ? `${meta.fullName}` : "Employee Signature",
      desc: "I acknowledge understanding these KPI definitions and targets.",
    },
    {
      title: "DIRECT LINE MANAGER",
      role: "Department Supervisor / Manager",
      desc: "Approved as the official quarterly performance baseline.",
    },
    {
      title: "HR & OD DEPARTMENT",
      role: "HR Director / OD Specialist",
      desc: "Verified against organizational standards & governance.",
    },
  ];

  signBoxes.forEach((box, idx) => {
    const boxX = margin + idx * (colWidth + 14);

    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderGray);
    doc.roundedRect(boxX, finalY, colWidth, signBlockH, 4, 4, "FD");

    // Header strip for sign box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...darkNavy);
    doc.text(box.title, boxX + 8, finalY + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...slateMuted);
    doc.text(box.desc, boxX + 8, finalY + 22, { maxWidth: colWidth - 16 });

    // Signature line
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.5);
    doc.line(boxX + 8, finalY + 48, boxX + colWidth - 8, finalY + 48);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...slateDark);
    doc.text(box.role, boxX + 8, finalY + 58);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...slateMuted);
    doc.text("Date: ____/____/2026", boxX + colWidth - 8, finalY + 58, {
      align: "right",
    });
  });

  // ── 8. File Save ──────────────────────────────────────────────────────────
  const posSlug = effectivePosition
    ? `_${effectivePosition.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}`
    : "";
  const yearStr = year ? `_${year}` : "";
  doc.save(`KPI-Definition${posSlug}${yearStr}.pdf`);
}
