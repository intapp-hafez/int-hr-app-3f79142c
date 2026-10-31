import * as XLSX from "xlsx";
import {
  LIGHT_CURRENT_ENGINEER_KPIS,
  KpiRowState,
  getRatingFromScore,
} from "./light-current-kpi.data";

export interface EvaluationExportMeta {
  employeeName: string;
  evaluatorName: string;
  year: number | string;
  department?: string;
  jobTitle?: string;
}

export function exportKpiEvaluationToExcel(
  state: Record<number, KpiRowState>,
  meta: EvaluationExportMeta
) {
  const wb = XLSX.utils.book_new();

  // 1. KPI Overview Sheet
  const overviewData: (string | number)[][] = [
    ["INTEGRATED TECHNICS"],
    [],
    [`Annul KPI Evaluation | Job Title: ${meta.jobTitle || "Junior ELV / Light Current Site Engineer"} | Department: ${meta.department || "Engineering"}`],
    [],
    [],
    ["#", "Category", "KPI / Metric Name", "Definition (What it measures)", "How it's measured", "Weight (%)", "Target"],
  ];

  for (const kpi of LIGHT_CURRENT_ENGINEER_KPIS) {
    overviewData.push([
      kpi.id,
      kpi.category,
      kpi.name,
      kpi.definition,
      kpi.howMeasured,
      kpi.weight,
      kpi.target,
    ]);
  }

  overviewData.push([]);
  overviewData.push(["", "", "", "", "Total Weight", 1.0]);

  const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, overviewWs, "KPI Overview");

  // 2. Annul Evaluation Sheet
  const evalData: (string | number)[][] = [
    ["INTEGRATED TECHNICS"],
    [],
    [`Annul KPI Evaluation — ${meta.jobTitle || "Junior ELV / Light Current Site Engineer"}`],
    [],
    [`Employee Name: ${meta.employeeName}`, "", "", "", "", `Evaluator: ${meta.evaluatorName}`, "", "", "", "", `Year: ${meta.year}`],
    ["Yellow cells = enter each quarter's Actual result as a % (e.g. 95% = 0.95); for rating KPIs enter rating ÷ 5 (4/5 = 80%); see 'How it's measured' on the KPI Overview sheet. Achievement % and Score calculate automatically. All KPIs are 'higher is better'."],
    [],
    [
      "#",
      "KPI / Metric Name",
      "Weight (%)",
      "Target",
      "Q1 Actual",
      "Q1 Achv %",
      "Q1 Score",
      "Q2 Actual",
      "Q2 Achv %",
      "Q2 Score",
      "Q3 Actual",
      "Q3 Achv %",
      "Q3 Score",
      "Q4 Actual",
      "Q4 Achv %",
      "Q4 Score",
      "Annual Weighted Score",
    ],
  ];

  let totalQ1Score = 0;
  let totalQ2Score = 0;
  let totalQ3Score = 0;
  let totalQ4Score = 0;
  let totalAnnualScore = 0;

  for (const kpi of LIGHT_CURRENT_ENGINEER_KPIS) {
    const row = state[kpi.id];
    const q1A = row?.q1.actual ?? "";
    const q1Ach = row?.q1.achievement ?? "";
    const q1Sc = row?.q1.score ?? "";

    const q2A = row?.q2.actual ?? "";
    const q2Ach = row?.q2.achievement ?? "";
    const q2Sc = row?.q2.score ?? "";

    const q3A = row?.q3.actual ?? "";
    const q3Ach = row?.q3.achievement ?? "";
    const q3Sc = row?.q3.score ?? "";

    const q4A = row?.q4.actual ?? "";
    const q4Ach = row?.q4.achievement ?? "";
    const q4Sc = row?.q4.score ?? "";

    const ann = row?.annualScore ?? "";

    if (typeof q1Sc === "number") totalQ1Score += q1Sc;
    if (typeof q2Sc === "number") totalQ2Score += q2Sc;
    if (typeof q3Sc === "number") totalQ3Score += q3Sc;
    if (typeof q4Sc === "number") totalQ4Score += q4Sc;
    if (typeof ann === "number") totalAnnualScore += ann;

    evalData.push([
      kpi.id,
      kpi.name,
      kpi.weight,
      kpi.target,
      q1A,
      q1Ach,
      q1Sc,
      q2A,
      q2Ach,
      q2Sc,
      q3A,
      q3Ach,
      q3Sc,
      q4A,
      q4Ach,
      q4Sc,
      ann,
    ]);
  }

  evalData.push([]);
  evalData.push([
    "",
    "TOTAL",
    1.0,
    "",
    "",
    "",
    Number(totalQ1Score.toFixed(4)),
    "",
    "",
    Number(totalQ2Score.toFixed(4)),
    "",
    "",
    Number(totalQ3Score.toFixed(4)),
    "",
    "",
    Number(totalQ4Score.toFixed(4)),
    Number(totalAnnualScore.toFixed(4)),
  ]);

  const rating = getRatingFromScore(totalAnnualScore);
  evalData.push([]);
  evalData.push([
    "Final Rating Tier:",
    rating.tier,
    `Overall Score: ${(totalAnnualScore * 100).toFixed(1)}%`,
  ]);
  evalData.push([
    "Rating Scale: 90-100% Outstanding | 75-89% Exceeds Expectations | 60-74% Meets Expectations | 40-59% Needs Improvement | <40% Unsatisfactory",
  ]);

  const evalWs = XLSX.utils.aoa_to_sheet(evalData);
  XLSX.utils.book_append_sheet(wb, evalWs, "Annul Evaluation");

  const cleanName = (meta.employeeName || "Employee").replace(/\s+/g, "_");
  const fileName = `KPI_Evaluation_${cleanName}_${meta.year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

