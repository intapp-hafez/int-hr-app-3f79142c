import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import { COMPANY_LOGO_BASE64 } from "./company-logo-base64";

export interface JdPdfEmployeeInfo {
  fullName?: string | null;
  empCode?: string | null;
  department?: string | null;
  managerName?: string | null;
  date?: string | null;
}

export interface JdPdfData {
  jobTitle: string;
  jobCode?: string | null;
  department?: string | null;
  jobCategory?: string | null;
  positionType?: string | null;
  locationType?: string | null;
  jobGrade?: string | null;
  reportingTo?: string | null;
  jobSummary: string;
  responsibilities: string[];
  qualifications?: string | null;
  technicalCompetencies?: string[] | null;
  behavioralCompetencies?: string[] | null;
  internalRelations?: string | null;
  externalRelations?: string | null;
  authority?: string[] | null;
  careerPath?: string[] | null;
  docVersion?: string | null;
  reviewedBy?: string | null;
  approvedBy?: string | null;
  commonWeightPct?: number | null;
  positionWeightPct?: number | null;
}

export async function exportJobDescriptionPdf(
  jd: JdPdfData,
  employee?: JdPdfEmployeeInfo
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Primary brand palette (Integrated Technics Corporate Identity)
  const brandOrange = [234, 88, 12]; // #ea580c
  const darkNavy = [15, 23, 42];     // #0f172a
  const slateMuted = [100, 116, 139];// #64748b
  const lightBg = [248, 250, 252];   // #f8fafc
  const borderGray = [226, 232, 240];// #e2e8f0

  let currentY = margin - 6;

  // ── 1. Top Header: Company Logo & Brand Identity ────────────────────────
  // Logo on Left (439 x 149 px, aspect ratio ~2.946)
  const logoWidth = 118;
  const logoHeight = 40;
  try {
    doc.addImage(COMPANY_LOGO_BASE64, "PNG", margin, currentY, logoWidth, logoHeight);
  } catch (err) {
    console.warn("Could not render logo in PDF, fallback to text:", err);
  }

  // Company Name & Official Document Title on Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text("INTEGRATED TECHNICS", pageWidth - margin, currentY + 14, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(brandOrange[0], brandOrange[1], brandOrange[2]);
  doc.text("OFFICIAL JOB DESCRIPTION", pageWidth - margin, currentY + 27, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text("Human Resources & Organizational Development", pageWidth - margin, currentY + 38, { align: "right" });

  currentY += logoHeight + 10;

  // Crisp separator rule below the top brand header
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.75);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 12;

  // ── Role Stripe Banner ──────────────────────────────────────────────────
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, contentWidth, 34, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(`ROLE: ${jd.jobTitle.toUpperCase()}`, margin + 12, currentY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  const subInfo = [
    jd.department ? `Dept: ${jd.department}` : (employee?.department ? `Dept: ${employee.department}` : null),
    jd.jobCode ? `Code: ${jd.jobCode}` : null,
    jd.docVersion ? `Version: ${jd.docVersion}` : "v1.0",
  ].filter(Boolean).join("   |   ");
  doc.text(subInfo, margin + 12, currentY + 27);

  const activeBadgeX = pageWidth - margin - 85;
  doc.setFillColor(16, 185, 129); // emerald
  doc.roundedRect(activeBadgeX, currentY + 9, 75, 16, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("OFFICIAL ROLE", activeBadgeX + 37.5, currentY + 20, { align: "center" });

  currentY += 46;

  // ── Helper: Section Title with Clean Spacing ─────────────────────────────
  function printSectionTitle(num: string, title: string) {
    if (currentY > pageHeight - 130) {
      doc.addPage();
      currentY = margin + 25;
    }
    const badgeW = num.length > 1 ? 22 : 18;
    const badgeH = 14;

    doc.setFillColor(brandOrange[0], brandOrange[1], brandOrange[2]);
    doc.roundedRect(margin, currentY, badgeW, badgeH, 2.5, 2.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(num, margin + badgeW / 2, currentY + 10, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    doc.text(title.toUpperCase(), margin + badgeW + 8, currentY + 11);

    currentY += 22; // Clean breathing room so following tables/text never collide!
  }

  // ── 1. JOB IDENTIFICATION ────────────────────────────────────────────────
  printSectionTitle("1", "Job Identification");

  const todayStr = employee?.date || new Date().toISOString().slice(0, 10);
  const identRows = [
    [
      { content: "Job Title", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.jobTitle,
      { content: "Job Category", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.jobCategory || "Non-managerial",
    ],
    [
      { content: "Department", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.department || employee?.department || "Integrated Systems",
      { content: "Job Code / Req #", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.jobCode || "JD-CORP",
    ],
    [
      { content: "Grade / Salary Range", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.jobGrade || "Standard Grade",
      { content: "Position Type", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.positionType || "Full-time",
    ],
    [
      { content: "Location Type", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.locationType || "On-site",
      { content: "Reporting To", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.reportingTo || employee?.managerName || "Department Head",
    ],
    [
      { content: "Employee Name", styles: { fontStyle: "bold", fillColor: lightBg } },
      employee?.fullName || "Standard Role Profile (All Incumbents)",
      { content: "Document Version", styles: { fontStyle: "bold", fillColor: lightBg } },
      jd.docVersion || "v1.0",
    ],
    [
      { content: "Date Assigned / Reviewed", styles: { fontStyle: "bold", fillColor: lightBg } },
      todayStr,
      { content: "Authorization Status", styles: { fontStyle: "bold", fillColor: lightBg } },
      "Approved & Enacted",
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    body: identRows as any,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 4.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 152 },
      2: { cellWidth: 105 },
      3: { cellWidth: 153 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 16;

  // ── 2. JOB SUMMARY ───────────────────────────────────────────────────────
  printSectionTitle("2", "Job Summary & Purpose");

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    body: [
      [
        {
          content: jd.jobSummary || "Core professional responsibilities and deliverables for this operational position.",
          styles: { fontSize: 8.5, lineHeight: 1.25, cellPadding: 8, textColor: [51, 65, 85] },
        },
      ],
    ],
    theme: "grid",
    styles: { fillColor: [255, 255, 255] },
  });
  currentY = (doc as any).lastAutoTable.finalY + 16;

  // ── 3. RESPONSIBILITIES – DUTIES ─────────────────────────────────────────
  printSectionTitle("3", "Job Responsibilities & Core Duties");

  const respItems = jd.responsibilities?.length
    ? jd.responsibilities
    : ["Ensure timely and standard execution of all assigned operational deliverables."];

  const respTableRows = respItems.map((r, i) => [
    { content: String(i + 1).padStart(2, "0"), styles: { fontStyle: "bold", textColor: brandOrange, halign: "center", cellWidth: 24, fontSize: 8 } },
    { content: r, styles: { cellWidth: contentWidth - 24 } },
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    body: respTableRows as any,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 41, 59] },
  });
  currentY = (doc as any).lastAutoTable.finalY + 16;

  // ── 4. QUALIFICATIONS & COMPETENCIES ─────────────────────────────────────
  printSectionTitle("4", "Qualifications & Competencies");

  if (jd.qualifications) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [[{ content: "Education, Experience & Certifications", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } }]],
      body: [[{ content: jd.qualifications, styles: { cellPadding: 6 } }]],
      theme: "grid",
      styles: { fontSize: 8.5 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  const techComps = jd.technicalCompetencies?.length ? jd.technicalCompetencies : ["Technical proficiency in role domain"];
  const behComps = jd.behavioralCompetencies?.length ? jd.behavioralCompetencies : ["Communication, integrity and teamwork"];

  const maxLen = Math.max(techComps.length, behComps.length);
  const compRows: any[] = [];
  for (let i = 0; i < maxLen; i++) {
    compRows.push([
      techComps[i] ? `• ${techComps[i]}` : "",
      behComps[i] ? `• ${behComps[i]}` : "",
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        { content: "TECHNICAL COMPETENCIES", styles: { fillColor: [241, 245, 249], textColor: darkNavy, fontStyle: "bold" } },
        { content: "BEHAVIORAL COMPETENCIES", styles: { fillColor: [241, 245, 249], textColor: darkNavy, fontStyle: "bold" } },
      ],
    ],
    body: compRows,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: contentWidth / 2 },
      1: { cellWidth: contentWidth / 2 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 16;

  // ── 5. PERFORMANCE STANDARDS – KPIS ──────────────────────────────────────
  printSectionTitle("5", "Performance Standards – KPIs");

  const commonWeight = jd.commonWeightPct ?? 30;
  const positionWeight = jd.positionWeightPct ?? 70;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        { content: "Evaluation Pillar", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
        { content: "Focus Area & Criteria", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
        { content: "Weight", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold", halign: "center" } },
      ],
    ],
    body: [
      ["Role-Specific Technical Execution", "Deliverables, quality benchmarks, site/operational targets & milestones", `${positionWeight}%`],
      ["Common & Behavioral Competencies", "Discipline, safety compliance, attendance, team collaboration & communication", `${commonWeight}%`],
      ["Evaluation Frequency", "Quarterly Reviews (Q1, Q2, Q3, Q4) with annual weighted consolidation", "100% Total"],
    ],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 4.5 },
    columnStyles: {
      0: { cellWidth: 155, fontStyle: "bold" },
      1: { cellWidth: 290 },
      2: { cellWidth: 70, halign: "center" },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 16;

  // ── 6. RELATIONSHIPS ─────────────────────────────────────────────────────
  if (jd.internalRelations || jd.externalRelations) {
    printSectionTitle("6", "Workplace Relationships & Communications");

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [
          { content: "INTERNAL COMMUNICATIONS", styles: { fillColor: [241, 245, 249], textColor: darkNavy, fontStyle: "bold" } },
          { content: "EXTERNAL COMMUNICATIONS", styles: { fillColor: [241, 245, 249], textColor: darkNavy, fontStyle: "bold" } },
        ],
      ],
      body: [
        [
          jd.internalRelations || "Direct team, department colleagues, and cross-functional managers.",
          jd.externalRelations || "Clients, contractors, technology vendors, and authorized third parties.",
        ],
      ],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 6 },
      columnStyles: {
        0: { cellWidth: contentWidth / 2 },
        1: { cellWidth: contentWidth / 2 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 16;
  }

  // ── 7. AUTHORITY OF JOB HOLDER ───────────────────────────────────────────
  if (jd.authority && jd.authority.length > 0) {
    printSectionTitle("7", "Authority of Job Holder");

    const authRows = jd.authority.map((a, i) => [
      { content: String(i + 1).padStart(2, "0"), styles: { fontStyle: "bold", textColor: brandOrange, halign: "center", cellWidth: 24, fontSize: 8 } },
      { content: a, styles: { cellWidth: contentWidth - 24 } },
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      body: authRows as any,
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 3.5 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 16;
  }

  // ── 8. CAREER PATH ───────────────────────────────────────────────────────
  if (jd.careerPath && jd.careerPath.length > 0) {
    printSectionTitle("8", "Career Path Progression");

    const rawSteps = jd.careerPath.flatMap((item) =>
      item.split(/\s*(?:>>|->|→)\s*/).map((s) => s.trim()).filter(Boolean)
    );

    const stepRows = rawSteps.map((step, idx) => {
      const isCurrent =
        step.toLowerCase().trim() === (jd.jobTitle || "").toLowerCase().trim() ||
        (jd.jobTitle || "").toLowerCase().includes(step.toLowerCase()) ||
        step.toLowerCase().includes((jd.jobTitle || "").toLowerCase());
      const numStr = String(idx + 1).padStart(2, "0");
      const stageLabel =
        idx === 0
          ? "Entry / Foundation Level"
          : idx === rawSteps.length - 1
          ? "Executive / Leadership Horizon"
          : "Career Advancement Track";

      return [
        {
          content: numStr,
          styles: {
            halign: "center" as const,
            fontStyle: "bold" as const,
            textColor: isCurrent ? brandOrange : darkNavy,
            fillColor: isCurrent ? [255, 237, 213] : lightBg,
            cellWidth: 32,
          },
        },
        {
          content: isCurrent ? `${step}   (Current Target Position)` : step,
          styles: {
            fontStyle: isCurrent ? ("bold" as const) : ("normal" as const),
            textColor: isCurrent ? brandOrange : darkNavy,
            fillColor: isCurrent ? [255, 247, 237] : [255, 255, 255],
          },
        },
        {
          content: isCurrent ? "★ Current Role" : stageLabel,
          styles: {
            halign: "right" as const,
            fontStyle: isCurrent ? ("bold" as const) : ("normal" as const),
            textColor: isCurrent ? brandOrange : slateMuted,
            fontSize: 7.5,
            fillColor: isCurrent ? [255, 247, 237] : [255, 255, 255],
            cellWidth: 140,
          },
        },
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      body: stepRows as any,
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 4.5 },
      tableLineColor: borderGray,
      tableLineWidth: 0.5,
    });
    currentY = (doc as any).lastAutoTable.finalY + 16;
  }

  // ── 9. DOCUMENT CONTROL ──────────────────────────────────────────────────
  printSectionTitle("9", "Document Control & Approval");

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        { content: "Created By", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
        { content: "Reviewed By", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
        { content: "Approved By", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
        { content: "Version & Date", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
      ],
    ],
    body: [
      [
        "HR Operations & OD",
        jd.reviewedBy || "HR Director",
        jd.approvedBy || "Managing Director / Executive Board",
        `${jd.docVersion || "v1.0"}   ·   ${todayStr}`,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 5 },
  });
  currentY = (doc as any).lastAutoTable.finalY + 18;

  // ── 10. EMPLOYEE ACKNOWLEDGEMENT ─────────────────────────────────────────
  if (currentY > pageHeight - 170) {
    doc.addPage();
    currentY = margin + 25;
  }

  printSectionTitle("10", "Employee Acknowledgement & Signatures");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(
    "I confirm that I have read, understood, and received a copy of this official Job Description. I agree to perform the duties and adhere to the standards outlined herein.",
    margin,
    currentY,
    { maxWidth: contentWidth }
  );
  currentY += 18;

  // Signatures table
  const empName = employee?.fullName || "_________________________________";
  const mgrName = employee?.managerName || "_________________________________";

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        { content: "Employee Signature", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
        { content: "Direct Manager Signature", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
        { content: "HR Division Approval", styles: { fillColor: lightBg, textColor: darkNavy, fontStyle: "bold" } },
      ],
    ],
    body: [
      [
        `Name: ${empName}\nRole: ${jd.jobTitle}\n\nSignature: _______________________\nDate: ___________________________`,
        `Direct Manager: ${mgrName}\nTitle: Line Manager\n\nSignature: _______________________\nDate: ___________________________`,
        `HR Director: Human Resources\nIntegrated Technics Management\n\nSignature: _______________________\nDate: ___________________________`,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 7, textColor: [30, 41, 59] },
  });

  // ── Running Headers & Footers on All Pages ──────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running top header on page 2+
    if (i > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
      doc.text("INTEGRATED TECHNICS  ·  JOB DESCRIPTION", margin, 24);
      doc.setFont("helvetica", "normal");
      doc.text(jd.jobTitle.toUpperCase(), pageWidth - margin, 24, { align: "right" });
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, 28, pageWidth - margin, 28);
    }

    // Footer divider line
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 26, pageWidth - margin, pageHeight - 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);

    // Left: Company Name
    doc.text("Integrated Technics for Systems & Technology", margin, pageHeight - 14);

    // Center: Job Code & Doc Version
    const centerText = `${jd.jobCode || "JD-CORP"}   ·   ${jd.docVersion || "v1.0"}`;
    doc.text(centerText, pageWidth / 2, pageHeight - 14, { align: "center" });

    // Right: Page X of Y
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 14, { align: "right" });
  }

  // Save the PDF
  const safeTitle = jd.jobTitle.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`Job_Description_${safeTitle}.pdf`);
}
