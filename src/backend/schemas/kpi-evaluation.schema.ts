import { z } from "zod";

// ─── CRITERIA CATALOG SCHEMAS ───────────────────────────────────────────────

export const KpiCriterionTypeSchema = z.enum(["common", "position_specific", "custom"]);
export type KpiCriterionType = z.infer<typeof KpiCriterionTypeSchema>;

export const KpiCriterionCategorySchema = z.enum([
  "behavioral",
  "technical",
  "quality",
  "productivity",
  "safety",
  "coordination",
]);
export type KpiCriterionCategory = z.infer<typeof KpiCriterionCategorySchema>;

export const KpiScoringScaleSchema = z.enum(["rating_5", "percentage", "count", "boolean"]);
export type KpiScoringScale = z.infer<typeof KpiScoringScaleSchema>;

export const KpiScoringDirectionSchema = z.enum([
  "higher_is_better",
  "lower_is_better",
  "rating_5",
  "target_range",
]);
export type KpiScoringDirection = z.infer<typeof KpiScoringDirectionSchema>;

export const SaveKpiCriterionSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().max(50).optional(),
  name_en: z.string().min(2, "English name is required").max(200),
  name_ar: z.string().min(2, "Arabic name is required").max(200),
  category_en: z.string().max(200).optional(),
  category_ar: z.string().max(200).optional(),
  layer: z.enum(["common", "role", "custom"]).optional(),
  description_en: z.string().max(1000).optional().default(""),
  description_ar: z.string().max(1000).optional().default(""),
  criterion_type: KpiCriterionTypeSchema.default("position_specific"),
  category: KpiCriterionCategorySchema.default("technical"),
  scoring_scale: KpiScoringScaleSchema.default("percentage"),
  scoring_direction: KpiScoringDirectionSchema.default("higher_is_better"),
  unit: z.string().max(30).default("%"),
  min_value: z.number().default(0),
  max_value: z.number().default(100),
  default_target: z.number().optional(),
  how_measured_en: z.string().max(1000).optional().default(""),
  how_measured_ar: z.string().max(1000).optional().default(""),
  max_scale_value: z.number().positive().default(100),
  default_weight: z.number().positive().max(1.0).default(0.05),
  is_required: z.boolean().default(true),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
});
export type SaveKpiCriterionInput = z.infer<typeof SaveKpiCriterionSchema>;

export const ListKpiCriteriaSchema = z.object({
  type: KpiCriterionTypeSchema.optional(),
  category: KpiCriterionCategorySchema.optional(),
  includeInactive: z.boolean().default(false),
});
export type ListKpiCriteriaInput = z.infer<typeof ListKpiCriteriaSchema>;

export const ArchiveKpiCriterionSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean().default(false),
});
export type ArchiveKpiCriterionInput = z.infer<typeof ArchiveKpiCriterionSchema>;

// ─── TEMPLATE BUILDER SCHEMAS ───────────────────────────────────────────────

export const KpiTemplateItemInputSchema = z.object({
  criterion_id: z.string().uuid(),
  weight: z.number().positive().max(1.0),
  target_benchmark: z.number().default(1.0),
  scoring_direction: KpiScoringDirectionSchema.default("higher_is_better"),
  unit: z.string().max(30).default("%"),
  min_value: z.number().default(0),
  max_value: z.number().default(100),
  display_order: z.number().int().default(0),
});

export const SaveKpiTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().min(2).max(200),
  name_ar: z.string().min(2).max(200),
  description: z.string().max(1000).optional().default(""),
  department_id: z.string().uuid().nullable().optional(),
  position_id: z.string().uuid().nullable().optional(),
  job_grade_id: z.string().uuid().nullable().optional(),
  effective_year: z.number().int().min(2020).max(2100).default(2026),
  effective_quarter: z.enum(["all", "q1", "q2", "q3", "q4"]).default("all"),
  common_weight_pct: z.number().min(0).max(100).default(40),
  position_weight_pct: z.number().min(0).max(100).default(60),
  is_active: z.boolean().default(true),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  items: z.array(KpiTemplateItemInputSchema).min(1, "Template must include at least one criterion"),
});
export type SaveKpiTemplateInput = z.infer<typeof SaveKpiTemplateSchema>;

export const DuplicateKpiTemplateSchema = z.object({
  template_id: z.string().uuid(),
  new_name_en: z.string().min(2).max(200),
  new_name_ar: z.string().min(2).max(200),
  target_department_id: z.string().uuid().nullable().optional(),
  target_position_id: z.string().uuid().nullable().optional(),
  target_job_grade_id: z.string().uuid().nullable().optional(),
});
export type DuplicateKpiTemplateInput = z.infer<typeof DuplicateKpiTemplateSchema>;

export const PublishKpiTemplateSchema = z.object({
  id: z.string().uuid(),
});
export type PublishKpiTemplateInput = z.infer<typeof PublishKpiTemplateSchema>;

export const ListKpiTemplatesSchema = z.object({
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  jobGradeId: z.string().uuid().optional(),
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
});
export type ListKpiTemplatesInput = z.infer<typeof ListKpiTemplatesSchema>;

export const MatchKpiTemplateSchema = z.object({
  employeeId: z.string().uuid(),
});
export type MatchKpiTemplateInput = z.infer<typeof MatchKpiTemplateSchema>;

// ─── QUARTERLY EVALUATIONS SCHEMAS ──────────────────────────────────────────

export const EvaluationQuarterSchema = z.enum(["q1", "q2", "q3", "q4"]);
export type EvaluationQuarter = z.infer<typeof EvaluationQuarterSchema>;

export const QuarterlyItemInputSchema = z.object({
  criterion_id: z.string().uuid().nullable().optional(),
  criterion_name_en: z.string().min(1),
  criterion_name_ar: z.string().min(1),
  criterion_type: KpiCriterionTypeSchema,
  category: z.string().default("technical"),
  scoring_scale: KpiScoringScaleSchema.default("percentage"),
  scoring_direction: KpiScoringDirectionSchema.default("higher_is_better"),
  unit: z.string().max(30).default("%"),
  weight: z.number().positive().max(1.0),
  target_benchmark: z.number().default(1.0),
  actual_value: z.number().nullable().optional(),
  achievement_rate: z.number().nullable().optional(),
  weighted_score: z.number().nullable().optional(),
  comments: z.string().max(1000).default(""),
  display_order: z.number().int().default(0),
});
export type QuarterlyItemInput = z.infer<typeof QuarterlyItemInputSchema>;

export const SaveQuarterlyEvaluationSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  evaluation_year: z.number().int().min(2020).max(2100),
  quarter: EvaluationQuarterSchema,
  template_id: z.string().uuid().nullable().optional(),
  template_version: z.number().int().default(1),
  status: z.enum(["draft", "submitted"]).default("draft"),
  items: z.array(QuarterlyItemInputSchema).min(1, "At least one evaluation item is required"),
  notes: z.object({
    strengths: z.string().max(2000).default(""),
    growthAreas: z.string().max(2000).default(""),
    recommendations: z.string().max(2000).default(""),
  }).default({ strengths: "", growthAreas: "", recommendations: "" }),
});
export type SaveQuarterlyEvaluationInput = z.infer<typeof SaveQuarterlyEvaluationSchema>;

export const GetQuarterlyEvaluationSchema = z.object({
  employeeId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  quarter: EvaluationQuarterSchema,
});
export type GetQuarterlyEvaluationInput = z.infer<typeof GetQuarterlyEvaluationSchema>;

export const ReviewQuarterlyEvaluationSchema = z.object({
  id: z.string().uuid().optional(),
  evaluation_id: z.string().uuid().optional(),
  quarter: EvaluationQuarterSchema.optional(),
  action: z.enum(["approve", "return"]),
  reason: z.string().max(1000).optional(),
  return_reason: z.string().max(1000).optional(),
}).transform((data) => ({
  id: (data.id || data.evaluation_id) as string,
  quarter: data.quarter,
  action: data.action,
  reason: data.reason || data.return_reason,
})).refine(
  (data) => !!data.id,
  { message: "Evaluation ID is required", path: ["id"] }
).refine(
  (data) => data.action !== "return" || (data.reason && data.reason.trim().length >= 5),
  { message: "A specific return reason (at least 5 characters) is required when returning an evaluation for revision.", path: ["reason"] }
);
export type ReviewQuarterlyEvaluationInput = z.infer<typeof ReviewQuarterlyEvaluationSchema>;

export const ListPendingApprovalsSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  quarter: EvaluationQuarterSchema.optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});
export type ListPendingApprovalsInput = z.infer<typeof ListPendingApprovalsSchema>;

export const GetQuarterlyHistorySchema = z.object({
  employeeId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100).optional(),
});
export type GetQuarterlyHistoryInput = z.infer<typeof GetQuarterlyHistorySchema>;

// ─── LEGACY ANNUAL RECORD SCHEMAS (KEPT FOR FULL BACKWARD COMPATIBILITY) ────

export const KpiQuarterDataSchema = z.object({
  target: z.number().nullable().optional(),
  actual: z.number().nullable().optional(),
  achievement: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
});

export const KpiMetricStateSchema = z.object({
  targetAnnual: z.number().nullable().optional(),
  q1: KpiQuarterDataSchema.optional(),
  q2: KpiQuarterDataSchema.optional(),
  q3: KpiQuarterDataSchema.optional(),
  q4: KpiQuarterDataSchema.optional(),
  annualScore: z.number().nullable().optional(),
});

export const KpiCategorySummarySchema = z.object({
  category: z.string(),
  weight: z.number(),
  maxScore: z.number(),
  actualScore: z.number(),
  percentage: z.number(),
});

export const KpiOverallSummarySchema = z.object({
  totalScore: z.number(),
  rating: z.enum(["Exceeds Expectations", "Meets Expectations", "Needs Improvement", "Unsatisfactory", "N/A"]),
  categories: z.array(KpiCategorySummarySchema).optional(),
});

export const KpiEvaluationNotesSchema = z.object({
  strengths: z.string().max(2000).default(""),
  growthAreas: z.string().max(2000).default(""),
  recommendations: z.string().max(2000).default(""),
});

export const SaveKpiEvaluationSchema = z.object({
  id: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  templateType: z.string().default("light_current_engineer"),
  evaluatorName: z.string().max(200).optional(),
  status: z.enum(["draft", "submitted", "reviewed", "approved"]).default("draft"),
  scores: z.record(z.string(), KpiMetricStateSchema),
  summary: KpiOverallSummarySchema.optional().default({
    totalScore: 0,
    rating: "N/A",
  }),
  notes: KpiEvaluationNotesSchema.default({
    strengths: "",
    growthAreas: "",
    recommendations: "",
  }),
});
export type SaveKpiEvaluationInput = z.infer<typeof SaveKpiEvaluationSchema>;

export const GetKpiEvaluationSchema = z.object({
  id: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  templateType: z.string().optional(),
});
export type GetKpiEvaluationInput = z.infer<typeof GetKpiEvaluationSchema>;

export const ListKpiEvaluationsSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  status: z.enum(["draft", "submitted", "reviewed", "approved", "all"]).optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});
export type ListKpiEvaluationsInput = z.infer<typeof ListKpiEvaluationsSchema>;

export const UpdateKpiStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "submitted", "reviewed", "approved"]),
});
export type UpdateKpiStatusInput = z.infer<typeof UpdateKpiStatusSchema>;

export const DeleteKpiEvaluationSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteKpiEvaluationInput = z.infer<typeof DeleteKpiEvaluationSchema>;

export const GetMyKpiEvaluationSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  templateType: z.string().optional(),
});
export type GetMyKpiEvaluationInput = z.infer<typeof GetMyKpiEvaluationSchema>;

export const SeedKpiTemplatesSchema = z.object({
  overwrite: z.boolean().default(false).optional(),
});
export type SeedKpiTemplatesInput = z.infer<typeof SeedKpiTemplatesSchema>;

export const ImportKpiCriterionItemSchema = z.object({
  code: z.string().max(50).optional(),
  name_en: z.string().min(1, "English name is required").max(200),
  name_ar: z.string().max(200).optional().default(""),
  category_en: z.string().max(200).optional(),
  category_ar: z.string().max(200).optional(),
  layer: z.enum(["common", "role", "custom"]).optional(),
  description_en: z.string().max(1000).optional().default(""),
  description_ar: z.string().max(1000).optional().default(""),
  criterion_type: KpiCriterionTypeSchema.default("position_specific"),
  category: KpiCriterionCategorySchema.default("technical"),
  scoring_scale: KpiScoringScaleSchema.default("percentage"),
  scoring_direction: KpiScoringDirectionSchema.default("higher_is_better"),
  unit: z.string().max(30).default("%"),
  min_value: z.number().default(0),
  max_value: z.number().default(100),
  default_target: z.number().optional(),
  how_measured_en: z.string().max(1000).optional().default(""),
  how_measured_ar: z.string().max(1000).optional().default(""),
  default_weight: z.number().positive().max(1.0).default(0.05),
  is_required: z.boolean().default(true),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
});

export const BatchImportCriteriaSchema = z.object({
  items: z.array(ImportKpiCriterionItemSchema).min(1, "At least one criterion is required to import"),
});
export type BatchImportCriteriaInput = z.infer<typeof BatchImportCriteriaSchema>;
