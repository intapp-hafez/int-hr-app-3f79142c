import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SaveKpiEvaluationSchema,
  GetKpiEvaluationSchema,
  ListKpiEvaluationsSchema,
  UpdateKpiStatusSchema,
  DeleteKpiEvaluationSchema,
  GetMyKpiEvaluationSchema,
  SaveKpiCriterionSchema,
  ListKpiCriteriaSchema,
  ArchiveKpiCriterionSchema,
  SaveKpiTemplateSchema,
  DuplicateKpiTemplateSchema,
  PublishKpiTemplateSchema,
  ListKpiTemplatesSchema,
  MatchKpiTemplateSchema,
  SaveQuarterlyEvaluationSchema,
  GetQuarterlyEvaluationSchema,
  ReviewQuarterlyEvaluationSchema,
  ListPendingApprovalsSchema,
  GetQuarterlyHistorySchema,
  SeedKpiTemplatesSchema,
  BatchImportCriteriaSchema,
} from "../schemas/kpi-evaluation.schema";
import { resolveTeamMemberScope } from "@/lib/team.functions";
import { getRatingFromScore } from "@/lib/kpi/light-current-kpi.data";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface KpiEvaluationRecord {
  id: string;
  employee_id: string;
  evaluation_year: number;
  template_type: string;
  evaluator_id: string | null;
  evaluator_name: string | null;
  status: "draft" | "submitted" | "reviewed" | "approved";
  scores: Record<string, any>;
  summary: {
    totalScore: number;
    rating: string;
    categories?: any[];
  };
  notes: {
    strengths: string;
    growthAreas: string;
    recommendations: string;
  };
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string | null;
    emp_code: string | null;
    department?: { name_en: string } | null;
    position?: { name_en: string } | null;
  } | null;
}

export interface QuarterlyEvaluationRecord {
  id: string;
  employee_id: string;
  evaluator_id: string;
  evaluation_year: number;
  quarter: "q1" | "q2" | "q3" | "q4";
  template_id: string | null;
  template_version: number;
  status: "draft" | "submitted" | "returned" | "approved";
  score: number;
  common_score: number;
  position_score: number;
  custom_score: number;
  rating_tier: string;
  return_reason: string | null;
  notes: {
    strengths: string;
    growthAreas: string;
    recommendations: string;
  };
  submitted_at: string | null;
  returned_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  items?: QuarterlyItemRecord[];
  employee?: {
    id: string;
    full_name: string | null;
    emp_code: string | null;
    department?: { name_en: string } | null;
    position?: { name_en: string } | null;
  } | null;
  evaluator?: {
    id: string;
    full_name: string | null;
  } | null;
}

export interface QuarterlyItemRecord {
  id: string;
  evaluation_id: string;
  criterion_id: string | null;
  criterion_name_en: string;
  criterion_name_ar: string;
  criterion_type: "common" | "position_specific" | "custom";
  category: string;
  scoring_scale: string;
  weight: number;
  target_benchmark: number;
  actual_value: number | null;
  achievement_rate: number | null;
  weighted_score: number | null;
  comments: string;
  display_order: number;
}

// ─── AUTH & ACCESS HELPERS ───────────────────────────────────────────────────

const ALLOWED_EVAL_ROLES = ["admin", "hr", "manager"] as const;

async function assertKpiAccess(supabase: any, userId: string) {
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (userRoles ?? []).map((r: any) => String(r.role).toLowerCase());
  const hasAccess = roles.some((r: string) => ALLOWED_EVAL_ROLES.includes(r as any));
  if (!hasAccess) {
    throw new Error("Forbidden: KPI evaluation management requires Admin, HR, or Manager access");
  }
  return {
    roles,
    isAdmin: roles.includes("admin") || roles.includes("hr"),
    isManager: roles.includes("manager"),
  };
}

async function notifyKpiAction({
  userIds,
  title,
  body,
  severity = "info",
  url = "/admin/kpi-evaluations",
}: {
  userIds: string[];
  title: string;
  body: string;
  severity?: "info" | "success" | "warning" | "danger";
  url?: string;
}) {
  try {
    const { notifyUsers } = await import("@/backend/server/notify.server");
    await notifyUsers({
      userIds,
      title,
      body,
      url,
      severity,
      category: "kpi",
    });
  } catch (err) {
    console.warn("[KPI Notification] Non-critical notification failure:", err);
  }
}

// ─── CRITERIA CATALOG FUNCTIONS ─────────────────────────────────────────────

export const listKpiCriteria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListKpiCriteriaSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    await assertKpiAccess(supabase, userId);

    let query = (supabase as any)
      .from("kpi_criteria")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!input.includeInactive) {
      query = query.eq("is_active", true);
    }
    if (input.type) {
      query = query.eq("criterion_type", input.type);
    }
    if (input.category) {
      query = query.eq("category", input.category);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list criteria: ${error.message}`);

    const categoryNamesEn: Record<string, string> = {
      technical: "Technical Execution & Architecture",
      quality: "Quality, Standards & Review",
      operational: "Operational Excellence & Delivery",
      behavioral: "Behavioral Competencies & Teamwork",
      compliance: "Compliance, Safety & Governance",
      safety: "Site Safety & PPE Compliance",
      hse: "HSE & Environmental Health",
      customer_service: "Customer Service & Stakeholder Care",
      financial: "Financial Accuracy & Governance",
      productivity: "Productivity & Turnaround",
      coordination: "Cross-Discipline Coordination",
    };

    const categoryNamesAr: Record<string, string> = {
      technical: "الأداء والتنفيذ الفني والبرمجي",
      quality: "الجودة والمعايير والتدقيق",
      operational: "الكفاءة التشغيلية والتسليم",
      behavioral: "الجدارات السلوكية والعمل الجماعي",
      compliance: "الالتزام والسلامة والحوكمة",
      safety: "السلامة المهنية ومهمات الوقاية",
      hse: "السلامة والصحة المهنية والبيئة",
      customer_service: "خدمة العملاء ورعاية المستفيدين",
      financial: "الحوكمة والدقة المالية",
      productivity: "الإنتاجية ومعدلات الإنجاز",
      coordination: "التنسيق بين التخصصات",
    };

    return (data || []).map((r: any, idx: number) => {
      const rawType = r.criterion_type || "position_specific";
      const layer =
        r.layer ||
        (rawType === "common"
          ? "common"
          : rawType === "position_specific"
          ? "role"
          : "custom");
      const catKey = (r.category || "technical").toLowerCase();

      // Extract code if stored in description or r.code
      let code = r.code;
      if (!code && r.description_en && r.description_en.startsWith("[")) {
        const match = r.description_en.match(/^\[([^\]]+)\]/);
        if (match) code = match[1];
      }
      if (!code) {
        code = `KPI-${String(100 + idx + 1).padStart(3, "0")}`;
      }

      // Extract Category English:
      // Check how_measured_en (which holds imported category), or category_en, or clean description, or dictionary
      let catEn = (r.how_measured_en && r.how_measured_en.trim()) || r.category_en;
      if (!catEn && r.description_en) {
        const cleanedDesc = r.description_en.replace(/^\[[^\]]+\]\s*/, "").trim();
        if (cleanedDesc && cleanedDesc.length < 80 && !cleanedDesc.toLowerCase().includes("percentage") && !cleanedDesc.toLowerCase().includes("compliance")) {
          catEn = cleanedDesc;
        }
      }
      if (!catEn) {
        catEn = categoryNamesEn[catKey] || r.category || "Technical";
      }

      // Extract Category Arabic:
      let catAr = (r.how_measured_ar && r.how_measured_ar.trim()) || r.category_ar;
      if (!catAr && r.description_ar && r.description_ar.length < 80) {
        catAr = r.description_ar.trim();
      }
      if (!catAr) {
        catAr = categoryNamesAr[catKey] || catEn;
      }

      const targetNum = r.max_value !== undefined && r.max_value !== null ? Number(r.max_value) : 95;

      return {
        ...r,
        code,
        layer,
        criterion_type: rawType,
        category: r.category || "technical",
        category_en: catEn,
        category_ar: catAr,
        default_target: r.default_target ?? (targetNum <= 1 ? targetNum : targetNum / 100),
        max_value: targetNum,
      };
    });
  });

export const saveKpiCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveKpiCriterionSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can modify criteria catalog");
    }

    const now = new Date().toISOString();
    const code = input.code?.trim() || "";
    const catEn = input.category_en?.trim() || input.how_measured_en?.trim() || "";
    const catAr = input.category_ar?.trim() || input.how_measured_ar?.trim() || "";

    const descEn = code ? `[${code}] ${catEn || input.description_en}` : (catEn || input.description_en || "");
    const descAr = catAr || input.description_ar || "";
    const howEn = catEn || input.how_measured_en || "";
    const howAr = catAr || input.how_measured_ar || "";

    const payload = {
      name_en: input.name_en,
      name_ar: input.name_ar,
      description_en: descEn,
      description_ar: descAr,
      criterion_type: input.criterion_type || (input.layer === "common" ? "common" : input.layer === "custom" ? "custom" : "position_specific"),
      category: input.category || "technical",
      scoring_scale: input.scoring_scale || "percentage",
      scoring_direction: input.scoring_direction || "higher_is_better",
      unit: input.unit || "%",
      min_value: input.min_value ?? 0,
      max_value: input.max_value ?? (input.default_target ? Math.round(input.default_target * 100) : 100),
      how_measured_en: howEn,
      how_measured_ar: howAr,
      max_scale_value: input.max_scale_value ?? 100,
      default_weight: input.default_weight ?? 0.05,
      is_required: input.is_required ?? true,
      is_active: input.is_active ?? true,
      display_order: input.display_order ?? 0,
      updated_at: now,
    };

    if (input.id) {
      const { data, error } = await (supabase as any)
        .from("kpi_criteria")
        .update(payload)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update criterion: ${error.message}`);
      return data;
    } else {
      const { data, error } = await (supabase as any)
        .from("kpi_criteria")
        .insert({ ...payload, created_at: now })
        .select()
        .single();
      if (error) throw new Error(`Failed to create criterion: ${error.message}`);
      return data;
    }
  });

export const archiveKpiCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ArchiveKpiCriterionSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can archive criteria");
    }

    const { error } = await (supabase as any)
      .from("kpi_criteria")
      .update({ is_active: input.active, updated_at: new Date().toISOString() })
      .eq("id", input.id);

    if (error) throw new Error(`Failed to archive criterion: ${error.message}`);
    return { success: true, id: input.id, is_active: input.active };
  });

export const batchImportKpiCriteria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BatchImportCriteriaSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can import KPI criteria");
    }

    const now = new Date().toISOString();

    const { data: existingList, error: fetchErr } = await (supabase as any)
      .from("kpi_criteria")
      .select("id, name_en, name_ar");

    if (fetchErr) throw new Error(`Failed to load existing criteria: ${fetchErr.message}`);

    const existingMap = new Map<string, string>();
    for (const ex of existingList || []) {
      if (ex.name_en) existingMap.set(ex.name_en.trim().toLowerCase(), ex.id);
      if (ex.name_ar) existingMap.set(ex.name_ar.trim().toLowerCase(), ex.id);
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const [idx, item] of input.items.entries()) {
      const nameEnKey = item.name_en.trim().toLowerCase();
      const nameArKey = (item.name_ar || item.name_en).trim().toLowerCase();
      const existingId = existingMap.get(nameEnKey) || existingMap.get(nameArKey);

      const code = item.code?.trim() || "";
      const catEn = item.category_en?.trim() || item.how_measured_en?.trim() || "";
      const catAr = item.category_ar?.trim() || item.how_measured_ar?.trim() || "";

      const descEn = code ? `[${code}] ${catEn || item.description_en}` : (catEn || item.description_en || "");
      const descAr = catAr || item.description_ar || "";
      const howEn = catEn || item.how_measured_en || "";
      const howAr = catAr || item.how_measured_ar || "";

      const payload = {
        name_en: item.name_en.trim(),
        name_ar: item.name_ar?.trim() || item.name_en.trim(),
        description_en: descEn,
        description_ar: descAr,
        criterion_type: item.criterion_type || (item.layer === "common" ? "common" : item.layer === "custom" ? "custom" : "position_specific"),
        category: item.category || "technical",
        scoring_scale: item.scoring_scale || "percentage",
        scoring_direction: item.scoring_direction || "higher_is_better",
        unit: item.unit || "%",
        min_value: item.min_value ?? 0,
        max_value: item.max_value ?? 100,
        how_measured_en: howEn,
        how_measured_ar: howAr,
        default_weight: item.default_weight ?? 0.05,
        is_required: item.is_required ?? true,
        is_active: item.is_active ?? true,
        display_order: item.display_order ?? idx + 1,
        updated_at: now,
      };

      if (existingId) {
        const { error: updErr } = await (supabase as any)
          .from("kpi_criteria")
          .update(payload)
          .eq("id", existingId);
        if (updErr) throw new Error(`Failed to update criterion "${item.name_en}": ${updErr.message}`);
        updatedCount++;
      } else {
        const { data: newRow, error: insErr } = await (supabase as any)
          .from("kpi_criteria")
          .insert({ ...payload, created_at: now })
          .select("id")
          .single();
        if (insErr) throw new Error(`Failed to insert criterion "${item.name_en}": ${insErr.message}`);
        if (newRow?.id) {
          existingMap.set(nameEnKey, newRow.id);
          existingMap.set(nameArKey, newRow.id);
        }
        insertedCount++;
      }
    }

    return {
      success: true,
      totalCount: input.items.length,
      insertedCount,
      updatedCount,
    };
  });

// ─── TEMPLATE BUILDER FUNCTIONS ─────────────────────────────────────────────

export const listKpiTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListKpiTemplatesSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    await assertKpiAccess(supabase, userId);

    let query = (supabase as any)
      .from("kpi_templates")
      .select(`
        *,
        department:departments(id, name_en, name_ar),
        position:positions(id, name_en, name_ar),
        job_grade:job_grades(id, name_en, name_ar),
        items:kpi_template_items(
          id,
          criterion_id,
          weight,
          target_benchmark,
          scoring_direction,
          unit,
          min_value,
          max_value,
          display_order,
          criterion:kpi_criteria(*)
        )
      `)
      .order("updated_at", { ascending: false });

    if (input.status && input.status !== "all") {
      query = query.eq("status", input.status);
    }
    if (input.departmentId) {
      query = query.eq("department_id", input.departmentId);
    }
    if (input.positionId) {
      query = query.eq("position_id", input.positionId);
    }
    if (input.jobGradeId) {
      query = query.eq("job_grade_id", input.jobGradeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list templates: ${error.message}`);
    return data || [];
  });

export const saveKpiTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveKpiTemplateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can create or modify evaluation templates");
    }

    const sumWeight = input.items.reduce((acc, it) => acc + Number(it.weight), 0);

    // If publishing directly, strictly enforce 100% total weight
    if (input.status === "published" && Math.abs(sumWeight - 1.0) > 0.005) {
      throw new Error(`Cannot publish template: Total weight of criteria must equal exactly 100%. Current total: ${(sumWeight * 100).toFixed(1)}%`);
    }

    const now = new Date().toISOString();
    const templatePayload = {
      name_en: input.name_en,
      name_ar: input.name_ar,
      description: input.description || "",
      department_id: input.department_id || null,
      position_id: input.position_id || null,
      job_grade_id: input.job_grade_id || null,
      effective_year: input.effective_year || 2026,
      effective_quarter: input.effective_quarter || "all",
      common_weight_pct: input.common_weight_pct,
      position_weight_pct: input.position_weight_pct,
      is_active: input.is_active,
      status: input.status,
      updated_at: now,
    };

    let templateId = input.id;
    let targetVersion = 1;

    if (templateId) {
      // Versioning Check: Check if this template has already been used in quarterly evaluations
      const { data: usageCount } = await (supabase as any)
        .from("kpi_quarterly_evaluations")
        .select("id", { count: "exact", head: true })
        .eq("template_id", templateId);

      const hasExistingEvaluations = (usageCount as any) > 0;

      if (hasExistingEvaluations) {
        // Immutability Rule: Do not mutate active in-use template. Branch to a new version!
        const { data: currentTemplate } = await (supabase as any)
          .from("kpi_templates")
          .select("version")
          .eq("id", templateId)
          .single();

        targetVersion = (currentTemplate?.version || 1) + 1;

        const { data: branched, error: branchErr } = await (supabase as any)
          .from("kpi_templates")
          .insert({
            ...templatePayload,
            version: targetVersion,
            status: "draft",
            parent_template_id: templateId,
            created_at: now,
          })
          .select("id")
          .single();

        if (branchErr) throw new Error(`Failed to version template: ${branchErr.message}`);
        templateId = branched.id;
      } else {
        // Can safely update in place
        const { error: updErr } = await (supabase as any)
          .from("kpi_templates")
          .update(templatePayload)
          .eq("id", templateId);
        if (updErr) throw new Error(`Failed to update template: ${updErr.message}`);

        await (supabase as any)
          .from("kpi_template_items")
          .delete()
          .eq("template_id", templateId);
      }
    } else {
      const { data: inserted, error: insErr } = await (supabase as any)
        .from("kpi_templates")
        .insert({
          ...templatePayload,
          status: input.status || "draft",
          version: 1,
          created_at: now,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`Failed to create template: ${insErr.message}`);
      templateId = inserted.id;
    }

    // Insert template items
    const itemsPayload = input.items.map((it, idx) => ({
      template_id: templateId,
      criterion_id: it.criterion_id,
      weight: it.weight,
      target_benchmark: it.target_benchmark ?? 1.0,
      scoring_direction: it.scoring_direction || "higher_is_better",
      unit: it.unit || "%",
      min_value: it.min_value ?? 0,
      max_value: it.max_value ?? 100,
      display_order: it.display_order ?? idx + 1,
      created_at: now,
    }));

    const { error: itemsErr } = await (supabase as any)
      .from("kpi_template_items")
      .insert(itemsPayload);

    if (itemsErr) throw new Error(`Failed to save template items: ${itemsErr.message}`);

    return { success: true, id: templateId, version: targetVersion };
  });

export const duplicateKpiTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DuplicateKpiTemplateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can duplicate templates");
    }

    const { data: source, error: srcErr } = await (supabase as any)
      .from("kpi_templates")
      .select(`*, items:kpi_template_items(*)`)
      .eq("id", input.template_id)
      .single();

    if (srcErr || !source) throw new Error("Source template not found");

    const now = new Date().toISOString();
    const { data: created, error: crtErr } = await (supabase as any)
      .from("kpi_templates")
      .insert({
        name_en: input.new_name_en,
        name_ar: input.new_name_ar,
        description: source.description || "",
        department_id: input.target_department_id !== undefined ? input.target_department_id : source.department_id,
        position_id: input.target_position_id !== undefined ? input.target_position_id : source.position_id,
        job_grade_id: input.target_job_grade_id !== undefined ? input.target_job_grade_id : source.job_grade_id,
        version: 1,
        status: "draft",
        common_weight_pct: source.common_weight_pct,
        position_weight_pct: source.position_weight_pct,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (crtErr) throw new Error(`Failed to duplicate template: ${crtErr.message}`);

    if (source.items && source.items.length > 0) {
      const clonedItems = source.items.map((it: any, idx: number) => ({
        template_id: created.id,
        criterion_id: it.criterion_id,
        weight: it.weight,
        target_benchmark: it.target_benchmark,
        scoring_direction: it.scoring_direction || "higher_is_better",
        unit: it.unit || "%",
        min_value: it.min_value ?? 0,
        max_value: it.max_value ?? 100,
        display_order: it.display_order ?? idx + 1,
        created_at: now,
      }));

      await (supabase as any).from("kpi_template_items").insert(clonedItems);
    }

    return { success: true, id: created.id };
  });

export const publishKpiTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PublishKpiTemplateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can publish templates");
    }

    // Verify 100% total weight before allowing publish
    const { data: items } = await (supabase as any)
      .from("kpi_template_items")
      .select("weight")
      .eq("template_id", input.id);

    const sumWeight = (items || []).reduce((acc: number, it: any) => acc + Number(it.weight), 0);
    if (Math.abs(sumWeight - 1.0) > 0.005) {
      throw new Error(`Cannot publish template: Total weight of criteria must equal exactly 100%. Current: ${(sumWeight * 100).toFixed(1)}%`);
    }

    const now = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .from("kpi_templates")
      .update({
        status: "published",
        is_active: true,
        published_at: now,
        updated_at: now,
      })
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to publish template: ${error.message}`);
    return data;
  });

export const matchKpiTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => MatchKpiTemplateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase } = context;

    // 1. Fetch employee's complete profile with department, position, and job grade
    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        position_id,
        department_id,
        section_id,
        job_grade,
        department:departments!profiles_department_id_fkey(id, name_en, name_ar),
        position:positions!profiles_position_id_fkey(id, name_en, name_ar)
      `)
      .eq("id", input.employeeId)
      .maybeSingle();

    if (!profile) throw new Error("Employee profile not found");

    // 2. Fetch published templates
    const { data: templates } = await (supabase as any)
      .from("kpi_templates")
      .select(`
        *,
        department:departments(id, name_en, name_ar),
        position:positions(id, name_en, name_ar),
        job_grade:job_grades(id, name_en, name_ar),
        items:kpi_template_items(
          id,
          criterion_id,
          weight,
          target_benchmark,
          scoring_direction,
          unit,
          min_value,
          max_value,
          display_order,
          criterion:kpi_criteria(*)
        )
      `)
      .eq("status", "published")
      .eq("is_active", true)
      .order("version", { ascending: false });

    const published = (templates || []) as any[];

    const deptName = (((profile as any).department?.name_en || "") as string).toLowerCase();
    const posName = (((profile as any).position?.name_en || "") as string).toLowerCase();

    // Priority matching rules:
    // Tier 1: Match by Position + Job Grade (Seniority Level)
    let matchedTemplate: any = null;
    if (profile.position_id && (profile as any).job_grade_id) {
      matchedTemplate = published.find(
        (t) => t.position_id === profile.position_id && t.job_grade_id === (profile as any).job_grade_id
      );
    }

    // Tier 2: Match by exact Position ID
    if (!matchedTemplate && profile.position_id) {
      matchedTemplate = published.find((t) => t.position_id === profile.position_id);
    }

    // Tier 3: Match by Position Title Keywords
    if (!matchedTemplate && posName) {
      if (
        posName.includes("account") ||
        posName.includes("financ") ||
        posName.includes("cfo") ||
        posName.includes("audit") ||
        posName.includes("cashier") ||
        posName.includes("billing")
      ) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("financial") ||
            t.name_en.toLowerCase().includes("account")
        );
      } else if (
        posName.includes("developer") ||
        posName.includes("software") ||
        posName.includes("programmer") ||
        posName.includes("frontend") ||
        posName.includes("backend") ||
        posName.includes("full stack")
      ) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("software") ||
            t.name_en.toLowerCase().includes("developer")
        );
      } else if (
        posName.includes("site engineer") ||
        posName.includes("light current") ||
        posName.includes("elv") ||
        posName.includes("network engineer") ||
        posName.includes("technician") ||
        posName.includes("transmission engineer") ||
        posName.includes("field engineer")
      ) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("site engineer") ||
            t.name_en.toLowerCase().includes("light current")
        );
      } else if (
        posName.includes("hr") ||
        posName.includes("human") ||
        posName.includes("personnel") ||
        posName.includes("recruit") ||
        posName.includes("payroll")
      ) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("human resources") ||
            t.name_en.toLowerCase().includes("hr")
        );
      } else if (
        posName.includes("sale") ||
        posName.includes("commercial") ||
        posName.includes("account exec") ||
        posName.includes("business dev") ||
        posName.includes("purchas") ||
        posName.includes("pre-sales")
      ) {
        matchedTemplate = published.find((t) =>
          t.name_en.toLowerCase().includes("sales")
        );
      } else if (
        posName.includes("customer") ||
        posName.includes("support") ||
        posName.includes("service") ||
        posName.includes("crm") ||
        posName.includes("call center") ||
        posName.includes("helpdesk")
      ) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("customer service") ||
            t.name_en.toLowerCase().includes("crm")
        );
      }
    }

    // Tier 4: Match by Department-level template (exact department_id)
    if (!matchedTemplate && profile.department_id) {
      matchedTemplate = published.find(
        (t) => t.department_id === profile.department_id
      );
    }

    // Tier 5: Match by Department Name Keywords
    if (!matchedTemplate && deptName) {
      if (deptName.includes("financ") || deptName.includes("account")) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("financial") ||
            t.name_en.toLowerCase().includes("account")
        );
      } else if (
        deptName.includes("it") ||
        deptName.includes("information") ||
        deptName.includes("software") ||
        deptName.includes("technol")
      ) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("software") ||
            t.name_en.toLowerCase().includes("developer")
        );
      } else if (deptName.includes("hr") || deptName.includes("human")) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("human resources") ||
            t.name_en.toLowerCase().includes("hr")
        );
      } else if (deptName.includes("sale") || deptName.includes("commercial")) {
        matchedTemplate = published.find((t) =>
          t.name_en.toLowerCase().includes("sales")
        );
      } else if (deptName.includes("crm") || deptName.includes("customer")) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("customer service") ||
            t.name_en.toLowerCase().includes("crm")
        );
      } else if (
        deptName.includes("engineer") ||
        deptName.includes("project") ||
        deptName.includes("operat") ||
        deptName.includes("mainten")
      ) {
        matchedTemplate = published.find(
          (t) =>
            t.name_en.toLowerCase().includes("site engineer") ||
            t.name_en.toLowerCase().includes("light current")
        );
      }
    }

    // Tier 6: Safe fallback template for unclassified positions (e.g. Driver, Warehouse, General Services)
    // Ensures every employee can be evaluated seamlessly with a complete 100% template!
    if (!matchedTemplate && published.length > 0) {
      matchedTemplate =
        published.find(
          (t) =>
            t.name_en.toLowerCase().includes("site engineer") ||
            t.name_en.toLowerCase().includes("light current")
        ) || published[0];
    }

    // If no published templates exist at all in the database:
    if (!matchedTemplate) {
      return {
        matched: false,
        template: null,
        items: [],
        reason: "missing_template",
        employee: {
          id: profile.id,
          name: profile.full_name,
          department_id: profile.department_id,
          department_name: (profile as any).department?.name_en || null,
          position_id: profile.position_id,
          position_name: (profile as any).position?.name_en || null,
          job_grade: (profile as any).job_grade || null,
        },
      };
    }

    return {
      matched: true,
      template: matchedTemplate,
      items: matchedTemplate.items || [],
    };
  });

export const seedDefaultKpiTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SeedKpiTemplatesSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can seed default evaluation templates");
    }

    // 1. Fetch available departments, positions, job_grades
    const [{ data: depts }, { data: positions }, { data: grades }] = await Promise.all([
      (supabase as any).from("departments").select("id, name_en, name_ar"),
      (supabase as any).from("positions").select("id, name_en, name_ar, department_id"),
      (supabase as any).from("job_grades").select("id, name_en, name_ar"),
    ]);

    const findDept = (term: string) =>
      depts?.find((d: any) => d.name_en?.toLowerCase().includes(term) || d.name_ar?.toLowerCase().includes(term))?.id || null;
    const findPos = (term: string) =>
      positions?.find((p: any) => p.name_en?.toLowerCase().includes(term) || p.name_ar?.toLowerCase().includes(term))?.id || null;
    const findGrade = (term: string) =>
      grades?.find((g: any) => g.name_en?.toLowerCase().includes(term) || g.name_ar?.toLowerCase().includes(term))?.id || null;

    const engDeptId = findDept("engineer") || findDept("technic") || null;
    const itDeptId = findDept("it") || findDept("information") || findDept("software") || null;
    const hrDeptId = findDept("hr") || findDept("human") || null;
    const finDeptId = findDept("finan") || findDept("account") || null;
    const salesDeptId = findDept("sale") || findDept("commercial") || null;
    const crmDeptId = findDept("crm") || findDept("customer") || null;

    const siteEngPosId = findPos("site") || findPos("engineer") || null;
    const swDevPosId = findPos("software") || findPos("developer") || null;
    const hrSpecPosId = findPos("hr") || null;
    const acctPosId = findPos("account") || null;
    const salesPosId = findPos("sale") || null;
    const csPosId = findPos("customer") || findPos("support") || null;

    const juniorGradeId = findGrade("junior") || findGrade("g02") || null;
    const midGradeId = findGrade("officer") || findGrade("g03") || null;
    const seniorGradeId = findGrade("senior") || findGrade("g04") || null;

    // 2. Standard criteria definitions
    const standardCriteria = [
      { name_en: "Attendance & Punctuality", name_ar: "الحضور والانضباط بمواعيد العمل", category: "behavioral", criterion_type: "common", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.10, default_target: 95 },
      { name_en: "Site Safety & PPE Compliance", name_ar: "الانضباط والالتزام بقواعد ومهمات السلامة", category: "safety", criterion_type: "common", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.10, default_target: 100 },
      { name_en: "Teamwork & Cross-functional Collaboration", name_ar: "العمل الجماعي والتعاون الفعال", category: "behavioral", criterion_type: "common", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.10, default_target: 90 },
      { name_en: "Reporting & Policy Compliance", name_ar: "الالتزام بالسياسات والتقارير الفنية", category: "quality", criterion_type: "common", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.10, default_target: 95 },
      { name_en: "On-Time Installation Completion", name_ar: "إنجاز أعمال التركيبات في الوقت المحدد", category: "technical", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 90 },
      { name_en: "Shop Drawing Execution Compliance", name_ar: "المطابقة للمخططات التنفيذية المعتمدة", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 95 },
      { name_en: "System Commissioning & Programming Accuracy", name_ar: "دقة تشغيل وبرمجة الأنظمة", category: "technical", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 90 },
      { name_en: "Troubleshooting & Issue Resolution", name_ar: "سرعة وكفاءة استكشاف الأعطال وحلها", category: "productivity", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 90 },
      { name_en: "Code Quality & Automated Test Coverage", name_ar: "جودة الكود وتغطية الاختبارات الآلية", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.20, default_target: 85 },
      { name_en: "Sprint Velocity & On-Time Story Delivery", name_ar: "سرعة الإنجاز والالتزام بمهام السبرنت", category: "productivity", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.20, default_target: 90 },
      { name_en: "Production Defect & Bug Escape Rate", name_ar: "معدل الأخطاء البرمجية في بيئة الإنتاج", category: "quality", criterion_type: "position_specific", scoring_scale: "count", scoring_direction: "lower_is_better", unit: "count", default_weight: 0.15, default_target: 2 },
      { name_en: "API Latency & System Performance SLA", name_ar: "كفاءة وسرعة استجابة واجهات الأنظمة", category: "technical", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 99 },
      { name_en: "Code Review & Team Knowledge Sharing", name_ar: "مراجعة الأكواد ومشاركة المعرفة", category: "behavioral", criterion_type: "position_specific", scoring_scale: "rating_5", scoring_direction: "rating_5", unit: "scale", default_weight: 0.10, default_target: 4.5 },
      { name_en: "Recruitment Milestone & Time-to-Hire", name_ar: "سرعة إغلاق الشواغر والتوظيف", category: "productivity", criterion_type: "position_specific", scoring_scale: "count", scoring_direction: "lower_is_better", unit: "days", default_weight: 0.20, default_target: 25 },
      { name_en: "Payroll Processing Timeliness & Accuracy", name_ar: "دقة ومواعيد إعداد الرواتب", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.20, default_target: 100 },
      { name_en: "Employee Grievance & Issue Resolution Rate", name_ar: "معالجة استفسارات وشكاوى الموظفين", category: "behavioral", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 90 },
      { name_en: "Onboarding Experience & Retention Rate", name_ar: "جودة برنامج التهيئة واستقرار الجدد", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 90 },
      { name_en: "Personnel Records & Labor Law Compliance", name_ar: "الامتثال لقانون العمل ودقة الملفات", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.10, default_target: 100 },
      { name_en: "Monthly Financial Closing Timeliness", name_ar: "الالتزام بمواعيد الإقفال المالي الشهري", category: "productivity", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.20, default_target: 95 },
      { name_en: "Accounts Payable & Invoice Accuracy", name_ar: "دقة مراجعة فواتير الموردين والمصروفات", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.20, default_target: 98 },
      { name_en: "Bank & Ledger Reconciliation Variance", name_ar: "نسبة الفروقات في مطابقات البنوك", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "lower_is_better", unit: "%", default_weight: 0.15, default_target: 1 },
      { name_en: "Accounts Receivable & Collection Follow-up", name_ar: "متابعة التحصيلات ومستحقات الشركة", category: "productivity", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 90 },
      { name_en: "Tax & Statutory Filing Compliance", name_ar: "الالتزام بتقديم الإقرارات الضريبية", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.10, default_target: 100 },
      { name_en: "Quarterly Sales Quota Achievement", name_ar: "تحقيق المستهدف البيعي الربع سنوي", category: "productivity", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.30, default_target: 100 },
      { name_en: "Opportunity Pipeline Conversion Velocity", name_ar: "معدل تحويل الفرص البيعية لصفقات", category: "productivity", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 25 },
      { name_en: "Client Retention & Contract Renewal Rate", name_ar: "الحفاظ على العملاء وتجديد العقود", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.15, default_target: 90 },
      { name_en: "CRM Pipeline Hygiene & Activity Logging", name_ar: "تسجيل الأنشطة وتحديث نظام الـ CRM", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.10, default_target: 95 },
      { name_en: "Commercial Proposal Turnaround Time", name_ar: "سرعة إعداد وتقديم العروض المالية", category: "productivity", criterion_type: "position_specific", scoring_scale: "count", scoring_direction: "lower_is_better", unit: "days", default_weight: 0.10, default_target: 2 },
      { name_en: "First Response Time (FRT) SLA", name_ar: "سرعة الرد الأولي على استفسارات العملاء", category: "productivity", criterion_type: "position_specific", scoring_scale: "count", scoring_direction: "lower_is_better", unit: "minutes", default_weight: 0.20, default_target: 15 },
      { name_en: "Customer Support Ticket Resolution SLA", name_ar: "نسبة إغلاق التذاكر الفنية في الوقت المحدد", category: "productivity", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "higher_is_better", unit: "%", default_weight: 0.20, default_target: 95 },
      { name_en: "Customer Satisfaction Rating (CSAT)", name_ar: "مؤشر رضا العملاء عن جودة الخدمة", category: "quality", criterion_type: "position_specific", scoring_scale: "rating_5", scoring_direction: "rating_5", unit: "scale", default_weight: 0.20, default_target: 4.5 },
      { name_en: "Support Ticket Reopen Rate", name_ar: "نسبة إعادة فتح التذاكر المغلقة", category: "quality", criterion_type: "position_specific", scoring_scale: "percentage", scoring_direction: "lower_is_better", unit: "%", default_weight: 0.10, default_target: 5 },
      { name_en: "Help Center Knowledge Base Contribution", name_ar: "المساهمة في بناء قاعدة المعرفة", category: "technical", criterion_type: "position_specific", scoring_scale: "count", scoring_direction: "higher_is_better", unit: "count", default_weight: 0.10, default_target: 5 },
    ];

    // Ensure criteria in database
    const { data: existingCriteria } = await (supabase as any).from("kpi_criteria").select("id, name_en");
    const criteriaMap = new Map<string, string>();
    (existingCriteria || []).forEach((c: any) => criteriaMap.set(c.name_en?.toLowerCase().trim(), c.id));

    const now = new Date().toISOString();
    for (const crit of standardCriteria) {
      const key = crit.name_en.toLowerCase().trim();
      if (!criteriaMap.has(key)) {
        const { data: inserted, error: critErr } = await (supabase as any)
          .from("kpi_criteria")
          .insert({
            name_en: crit.name_en,
            name_ar: crit.name_ar,
            criterion_type: crit.criterion_type,
            category: crit.category,
            scoring_scale: crit.scoring_scale,
            scoring_direction: crit.scoring_direction,
            unit: crit.unit,
            default_weight: crit.default_weight,
            max_scale_value: crit.scoring_scale === "rating_5" ? 5 : 100,
            is_required: true,
            is_active: true,
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();
        if (!critErr && inserted) {
          criteriaMap.set(key, inserted.id);
        }
      }
    }

    const getCritId = (term: string) => {
      const lower = term.toLowerCase();
      for (const [key, id] of criteriaMap.entries()) {
        if (key.includes(lower)) return id;
      }
      return null;
    };

    // 3. Define Standard Templates
    const defaultTemplates = [
      {
        name_en: "Light Current Site Engineer Evaluation",
        name_ar: "تقييم أداء مهندس موقع تيار خفيف (مبتدئ / متوسط)",
        description: "Standard technical and behavioral evaluation for field ELV site engineers.",
        department_id: engDeptId,
        position_id: siteEngPosId,
        job_grade_id: juniorGradeId,
        items: [
          { name: "attendance", weight: 0.10, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "safety", weight: 0.10, target: 100, dir: "higher_is_better", unit: "%" },
          { name: "teamwork", weight: 0.10, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "reporting", weight: 0.10, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "installation", weight: 0.15, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "shop drawing", weight: 0.15, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "commissioning", weight: 0.15, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "troubleshooting", weight: 0.15, target: 90, dir: "higher_is_better", unit: "%" },
        ],
      },
      {
        name_en: "Software Engineer & Full Stack Developer Evaluation",
        name_ar: "تقييم أداء مهندس برمجيات ومطور تطبيقات",
        description: "Performance evaluation framework for frontend, backend, and full-stack software engineers.",
        department_id: itDeptId,
        position_id: swDevPosId,
        job_grade_id: seniorGradeId,
        items: [
          { name: "attendance", weight: 0.10, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "teamwork", weight: 0.10, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "code quality", weight: 0.20, target: 85, dir: "higher_is_better", unit: "%" },
          { name: "sprint velocity", weight: 0.20, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "production defect", weight: 0.15, target: 2, dir: "lower_is_better", unit: "count" },
          { name: "api latency", weight: 0.15, target: 99, dir: "higher_is_better", unit: "%" },
          { name: "code review", weight: 0.10, target: 4.5, dir: "rating_5", unit: "scale" },
        ],
      },
      {
        name_en: "Human Resources Specialist Evaluation",
        name_ar: "تقييم أداء أخصائي الموارد البشرية والعمليات",
        description: "Key performance indicators for HR generalists, recruitment, and payroll officers.",
        department_id: hrDeptId,
        position_id: hrSpecPosId,
        job_grade_id: midGradeId,
        items: [
          { name: "attendance", weight: 0.10, target: 98, dir: "higher_is_better", unit: "%" },
          { name: "teamwork", weight: 0.10, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "recruitment", weight: 0.20, target: 25, dir: "lower_is_better", unit: "days" },
          { name: "payroll", weight: 0.20, target: 100, dir: "higher_is_better", unit: "%" },
          { name: "grievance", weight: 0.15, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "onboarding", weight: 0.15, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "personnel records", weight: 0.10, target: 100, dir: "higher_is_better", unit: "%" },
        ],
      },
      {
        name_en: "Financial Accountant Evaluation",
        name_ar: "تقييم أداء المحاسب المالي",
        description: "Evaluation metrics covering ledger accounting, financial closings, and reconciliations.",
        department_id: finDeptId,
        position_id: acctPosId,
        job_grade_id: midGradeId,
        items: [
          { name: "attendance", weight: 0.10, target: 98, dir: "higher_is_better", unit: "%" },
          { name: "teamwork", weight: 0.10, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "monthly financial closing", weight: 0.20, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "accounts payable", weight: 0.20, target: 98, dir: "higher_is_better", unit: "%" },
          { name: "bank & ledger", weight: 0.15, target: 1, dir: "lower_is_better", unit: "%" },
          { name: "accounts receivable", weight: 0.15, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "tax & statutory", weight: 0.10, target: 100, dir: "higher_is_better", unit: "%" },
        ],
      },
      {
        name_en: "Sales Specialist & Account Executive Evaluation",
        name_ar: "تقييم أداء أخصائي المبيعات وإدارة الحسابات",
        description: "Target-driven KPI framework evaluating revenue quota, conversion velocity, and client retention.",
        department_id: salesDeptId,
        position_id: salesPosId,
        job_grade_id: seniorGradeId,
        items: [
          { name: "attendance", weight: 0.10, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "teamwork", weight: 0.10, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "quarterly sales quota", weight: 0.30, target: 100, dir: "higher_is_better", unit: "%" },
          { name: "opportunity pipeline conversion", weight: 0.15, target: 25, dir: "higher_is_better", unit: "%" },
          { name: "client retention", weight: 0.15, target: 90, dir: "higher_is_better", unit: "%" },
          { name: "crm pipeline hygiene", weight: 0.10, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "proposal turnaround", weight: 0.10, target: 2, dir: "lower_is_better", unit: "days" },
        ],
      },
      {
        name_en: "Customer Service & CRM Specialist Evaluation",
        name_ar: "تقييم أداء أخصائي خدمة العملاء والدعم الفني",
        description: "Customer-centric performance framework focusing on SLA resolution, CSAT scores, and first response speed.",
        department_id: crmDeptId,
        position_id: csPosId,
        job_grade_id: juniorGradeId,
        items: [
          { name: "attendance", weight: 0.10, target: 98, dir: "higher_is_better", unit: "%" },
          { name: "teamwork", weight: 0.10, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "first response time", weight: 0.20, target: 15, dir: "lower_is_better", unit: "minutes" },
          { name: "ticket resolution sla", weight: 0.20, target: 95, dir: "higher_is_better", unit: "%" },
          { name: "customer satisfaction", weight: 0.20, target: 4.5, dir: "rating_5", unit: "scale" },
          { name: "ticket reopen rate", weight: 0.10, target: 5, dir: "lower_is_better", unit: "%" },
          { name: "knowledge base", weight: 0.10, target: 5, dir: "higher_is_better", unit: "count" },
        ],
      },
    ];

    const { data: existingTemplates } = await (supabase as any).from("kpi_templates").select("id, name_en");
    const existingNames = new Set((existingTemplates || []).map((t: any) => t.name_en?.toLowerCase().trim()));

    let seededCount = 0;
    for (const dt of defaultTemplates) {
      const exists = existingNames.has(dt.name_en.toLowerCase().trim());
      if (exists && !input.overwrite) continue;

      const templatePayload = {
        name_en: dt.name_en,
        name_ar: dt.name_ar,
        description: dt.description,
        department_id: dt.department_id,
        position_id: dt.position_id,
        job_grade_id: dt.job_grade_id,
        version: 1,
        status: "published",
        common_weight_pct: 40,
        position_weight_pct: 60,
        effective_year: 2026,
        effective_quarter: "all",
        is_active: true,
        updated_at: now,
      };

      const { data: newTemplate, error: tmplErr } = await (supabase as any)
        .from("kpi_templates")
        .insert({ ...templatePayload, created_at: now })
        .select("id")
        .single();

      if (tmplErr || !newTemplate) continue;

      // Insert template items
      const itemsPayload = dt.items
        .map((it, idx) => {
          const critId = getCritId(it.name);
          if (!critId) return null;
          return {
            template_id: newTemplate.id,
            criterion_id: critId,
            weight: it.weight,
            target_benchmark: it.target,
            scoring_direction: it.dir,
            unit: it.unit,
            display_order: idx + 1,
            created_at: now,
          };
        })
        .filter(Boolean);

      if (itemsPayload.length > 0) {
        await (supabase as any).from("kpi_template_items").insert(itemsPayload);
      }
      seededCount++;
    }

    return {
      success: true,
      seededCount,
      totalTemplates: defaultTemplates.length,
      message: `Successfully seeded ${seededCount} default evaluation templates.`,
    };
  });

// ─── QUARTERLY EVALUATIONS WORKFLOW ──────────────────────────────────────────

export const getQuarterlyEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GetQuarterlyEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const isSelf = input.employeeId === userId;
    let isAdmin = false;
    let isManager = false;

    if (!isSelf) {
      const access = await assertKpiAccess(supabase, userId);
      isAdmin = access.isAdmin;
      isManager = access.isManager;

      // Manager scoping verification
      if (!isAdmin && isManager) {
        const scope = await resolveTeamMemberScope(supabase, userId);
        if (!scope.isAdmin) {
          const { data: empProfile } = await supabase
            .from("profiles")
            .select("id, manager_id, department_id")
            .eq("id", input.employeeId)
            .maybeSingle();

          const isDirect = empProfile?.manager_id === userId;
          const isDeptManaged = empProfile?.department_id && scope.managedDeptIds?.includes(empProfile.department_id);

          if (!isDirect && !isDeptManaged) {
            throw new Error("Forbidden: You do not have permission to view this employee's quarterly evaluation");
          }
        }
      }
    }

    const { data: evalRecord, error } = await (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select(`
        *,
        items:kpi_quarterly_items(*),
        employee:profiles!kpi_quarterly_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en, name_ar)
        ),
        evaluator:profiles!kpi_quarterly_evaluations_evaluator_id_fkey(
          id,
          full_name
        )
      `)
      .eq("employee_id", input.employeeId)
      .eq("evaluation_year", input.year)
      .eq("quarter", input.quarter)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch quarterly evaluation: ${error.message}`);

    // Employee Privacy Boundary: Employees may view their own evaluations once submitted or approved.
    // Draft evaluations are hidden until the manager has formally submitted them.
    if (!isAdmin && input.employeeId === userId && evalRecord && evalRecord.status === "draft") {
      return null;
    }

    return (evalRecord as QuarterlyEvaluationRecord) || null;
  });

export const saveQuarterlyEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveQuarterlyEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, isManager } = await assertKpiAccess(supabase, userId);

    // Verify manager authority on employee
    if (!isAdmin && isManager) {
      const scope = await resolveTeamMemberScope(supabase, userId);
      if (!scope.isAdmin) {
        const { data: empProfile } = await supabase
          .from("profiles")
          .select("id, manager_id, department_id")
          .eq("id", input.employee_id)
          .maybeSingle();

        const isDirect = empProfile?.manager_id === userId;
        const isDeptManaged = empProfile?.department_id && scope.managedDeptIds?.includes(empProfile.department_id);
        if (!isDirect && !isDeptManaged) {
          throw new Error("Forbidden: You can only evaluate employees within your assigned team or department");
        }
      }
    }

    // Check existing evaluation
    const { data: existing } = await (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select("id, status")
      .eq("employee_id", input.employee_id)
      .eq("evaluation_year", input.evaluation_year)
      .eq("quarter", input.quarter)
      .maybeSingle();

    if (existing?.status === "approved" && !isAdmin) {
      throw new Error("Locked: Approved quarterly evaluations cannot be edited by managers");
    }

    // Server-side scoring validation
    let totalWeight = 0;
    let earnedSum = 0;
    let commonEarned = 0;
    let posEarned = 0;
    let customEarned = 0;

    const validatedItems = input.items.map((it, idx) => {
      const weight = Number(it.weight);
      totalWeight += weight;

      const direction = it.scoring_direction || "higher_is_better";
      let achievement: number | null = null;

      if (it.actual_value != null) {
        if (direction === "rating_5") {
          achievement = Math.min(1.0, Math.max(0, it.actual_value / 5.0));
        } else if (direction === "lower_is_better") {
          if (it.actual_value <= it.target_benchmark) {
            achievement = 1.0;
          } else if (it.actual_value > 0) {
            achievement = it.target_benchmark > 0 ? (it.target_benchmark / it.actual_value) : 0;
          } else {
            achievement = 1.0;
          }
        } else {
          // higher_is_better
          if (it.target_benchmark > 0) {
            achievement = it.actual_value / it.target_benchmark;
          } else {
            achievement = it.actual_value > 0 ? 1.0 : 0;
          }
        }
        // Cap achievement at 100% by default as specified in implementation brief
        achievement = Math.min(1.0, Math.max(0, achievement));
      }

      let weightedScore: number | null = null;
      if (achievement != null) {
        weightedScore = Number((achievement * weight * 100).toFixed(2));
        earnedSum += weightedScore;

        if (it.criterion_type === "common") commonEarned += weightedScore;
        else if (it.criterion_type === "position_specific") posEarned += weightedScore;
        else customEarned += weightedScore;
      }

      return {
        ...it,
        scoring_direction: direction,
        unit: it.unit || "%",
        achievement_rate: achievement != null ? Number(achievement.toFixed(4)) : null,
        weighted_score: weightedScore,
        display_order: it.display_order || idx + 1,
      };
    });

    // On submit, validate that weights total 100%
    if (input.status === "submitted") {
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error(`Cannot submit evaluation: Total weight must equal 100%. Current: ${(totalWeight * 100).toFixed(1)}%`);
      }
    }

    const finalScore = Number(earnedSum.toFixed(2));
    const ratingObj = getRatingFromScore(finalScore / 100, earnedSum > 0);
    const now = new Date().toISOString();

    const evalPayload = {
      employee_id: input.employee_id,
      evaluator_id: userId,
      evaluation_year: input.evaluation_year,
      quarter: input.quarter,
      template_id: input.template_id || null,
      template_version: input.template_version,
      status: input.status,
      score: finalScore,
      common_score: Number(commonEarned.toFixed(2)),
      position_score: Number(posEarned.toFixed(2)),
      custom_score: Number(customEarned.toFixed(2)),
      rating_tier: ratingObj.tier,
      notes: input.notes,
      updated_at: now,
      ...(input.status === "submitted" ? { submitted_at: now } : {}),
    };

    let evalId = existing?.id;

    if (existing?.id) {
      const { error: updErr } = await (supabase as any)
        .from("kpi_quarterly_evaluations")
        .update(evalPayload)
        .eq("id", existing.id);
      if (updErr) throw new Error(`Failed to update quarterly evaluation: ${updErr.message}`);

      // Replace snapshot items
      await (supabase as any)
        .from("kpi_quarterly_items")
        .delete()
        .eq("evaluation_id", existing.id);
    } else {
      const { data: ins, error: insErr } = await (supabase as any)
        .from("kpi_quarterly_evaluations")
        .insert({ ...evalPayload, created_at: now })
        .select("id")
        .single();
      if (insErr) throw new Error(`Failed to create quarterly evaluation: ${insErr.message}`);
      evalId = ins.id;
    }

    // Insert items snapshot
    const itemsToInsert = validatedItems.map((it) => ({
      evaluation_id: evalId,
      criterion_id: it.criterion_id || null,
      criterion_name_en: it.criterion_name_en,
      criterion_name_ar: it.criterion_name_ar,
      criterion_type: it.criterion_type,
      category: it.category,
      scoring_scale: it.scoring_scale,
      scoring_direction: it.scoring_direction,
      unit: it.unit,
      weight: it.weight,
      target_benchmark: it.target_benchmark,
      actual_value: it.actual_value,
      achievement_rate: it.achievement_rate,
      weighted_score: it.weighted_score,
      comments: it.comments || "",
      display_order: it.display_order,
      created_at: now,
    }));

    await (supabase as any).from("kpi_quarterly_items").insert(itemsToInsert);

    // Audit transition if status changed to submitted
    if (input.status === "submitted") {
      await (supabase as any).from("kpi_evaluation_transitions").insert({
        evaluation_id: evalId,
        actor_id: userId,
        from_status: existing?.status || "draft",
        to_status: "submitted",
        reason: "Manager submitted quarterly evaluation for HR approval",
        created_at: now,
      });

      // Notify HR Admins
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "hr"]);
      const adminIds = (adminRoles || []).map((r: any) => r.user_id);
      await notifyKpiAction({
        userIds: adminIds,
        title: `Quarterly KPI Submitted (${input.quarter.toUpperCase()} ${input.evaluation_year})`,
        body: `A performance evaluation has been submitted and is waiting for HR approval.`,
        url: "/admin/kpi-evaluations",
        severity: "info",
      });
    }

    return {
      success: true,
      id: evalId,
      status: input.status,
      score: finalScore,
      rating: ratingObj.tier,
    };
  });

export const reviewQuarterlyEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ReviewQuarterlyEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);

    if (!isAdmin) {
      throw new Error("Forbidden: Only HR Admins can approve or return evaluations");
    }

    const targetId = input.id;
    const now = new Date().toISOString();
    const newStatus = input.action === "approve" ? "approved" : "returned";
    const selectedQ = input.quarter as "q1" | "q2" | "q3" | "q4" | undefined;

    // 1. Try finding in kpi_quarterly_evaluations
    const { data: record, error: fetchErr } = await (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select("id, employee_id, evaluator_id, evaluation_year, quarter, status, score")
      .eq("id", targetId)
      .maybeSingle();

    if (record) {
      const updatePayload: Record<string, any> = {
        status: newStatus,
        updated_at: now,
        ...(newStatus === "approved" ? { approved_at: now, return_reason: null } : {}),
        ...(newStatus === "returned" ? { returned_at: now, return_reason: input.reason } : {}),
      };

      const { error: updErr } = await (supabase as any)
        .from("kpi_quarterly_evaluations")
        .update(updatePayload)
        .eq("id", targetId);

      if (updErr) throw new Error(`Failed to update evaluation status: ${updErr.message}`);

      // Record audit transition
      await (supabase as any).from("kpi_evaluation_transitions").insert({
        evaluation_id: targetId,
        actor_id: userId,
        from_status: record.status,
        to_status: newStatus,
        reason: input.action === "return" ? input.reason : "Approved by HR Admin",
        created_at: now,
      });

      // Also sync to parent kpi_evaluations notes.quarterStatuses if parent exists
      try {
        const { data: parentRecord } = await (supabase as any)
          .from("kpi_evaluations")
          .select("id, notes, status")
          .eq("employee_id", record.employee_id)
          .eq("evaluation_year", record.evaluation_year)
          .maybeSingle();
        if (parentRecord) {
          const pNotes = typeof parentRecord.notes === "object" && parentRecord.notes ? { ...parentRecord.notes } : {};
          pNotes.quarterStatuses = pNotes.quarterStatuses || {};
          pNotes.quarterStatuses[record.quarter] = {
            status: newStatus,
            updated_at: now,
            ...(newStatus === "approved" ? { approved_at: now, approved_by: userId, return_reason: null } : {}),
            ...(newStatus === "returned" ? { returned_at: now, return_reason: input.reason } : {}),
          };
          if (input.action === "return") {
            pNotes.returnReason = `[${record.quarter.toUpperCase()}]: ${input.reason}`;
          }
          await (supabase as any)
            .from("kpi_evaluations")
            .update({ notes: pNotes, updated_at: now })
            .eq("id", parentRecord.id);
        }
      } catch (err) {
        console.error("Failed to sync quarter status to kpi_evaluations parent:", err);
      }

      // Notify Manager & Employee
      if (record.evaluator_id) {
        if (input.action === "approve") {
          await notifyKpiAction({
            userIds: [record.evaluator_id, record.employee_id],
            title: `KPI Evaluation Approved (${record.quarter.toUpperCase()} ${record.evaluation_year})`,
            body: `The ${record.quarter.toUpperCase()} evaluation has been officially approved with a score of ${record.score}%. Remaining quarters remain open for evaluation.`,
            url: "/admin/kpi-evaluations",
            severity: "success",
          });
        } else {
          await notifyKpiAction({
            userIds: [record.evaluator_id],
            title: `KPI Evaluation Returned for Revision (${record.quarter.toUpperCase()} ${record.evaluation_year})`,
            body: `HR requested revisions: ${input.reason}`,
            url: "/manager/kpi-evaluations",
            severity: "warning",
          });
        }
      }

      return { success: true, id: targetId, status: newStatus };
    }

    // 2. Try finding in kpi_evaluations (standard/annual evaluation records)
    const { data: oldRecord } = await (supabase as any)
      .from("kpi_evaluations")
      .select("id, employee_id, evaluator_id, evaluation_year, status, summary, notes, scores")
      .eq("id", targetId)
      .maybeSingle();

    if (oldRecord) {
      const notes = typeof oldRecord.notes === "object" && oldRecord.notes ? { ...oldRecord.notes } : {};
      let evalStatus = input.action === "approve" ? "approved" : "draft";

      if (selectedQ) {
        notes.quarterStatuses = notes.quarterStatuses || {};
        notes.quarterStatuses[selectedQ] = {
          status: newStatus,
          updated_at: now,
          ...(newStatus === "approved" ? { approved_at: now, approved_by: userId, return_reason: null } : {}),
          ...(newStatus === "returned" ? { returned_at: now, return_reason: input.reason } : {}),
        };

        if (input.action === "return" && input.reason) {
          notes.returnReason = `[${selectedQ.toUpperCase()}]: ${input.reason}`;
          notes.growthAreas = (notes.growthAreas ? notes.growthAreas + "\n" : "") + `[HR Return Note - ${selectedQ.toUpperCase()}]: ${input.reason}`;
          evalStatus = "returned";
        } else {
          // If individual Q approved, check if all 4 quarters are approved
          const allQs = ["q1", "q2", "q3", "q4"] as const;
          const allApproved = allQs.every((q) => notes.quarterStatuses?.[q]?.status === "approved");
          // If not all 4 are approved, remain in draft so manager can evaluate remaining Qs!
          evalStatus = allApproved ? "approved" : "draft";
        }

        // Also upsert individual quarterly record into kpi_quarterly_evaluations
        try {
          await (supabase as any)
            .from("kpi_quarterly_evaluations")
            .upsert(
              {
                employee_id: oldRecord.employee_id,
                evaluator_id: oldRecord.evaluator_id || userId,
                evaluation_year: oldRecord.evaluation_year,
                quarter: selectedQ,
                status: newStatus,
                score: Number(oldRecord.summary?.totalScore ?? 0),
                updated_at: now,
                ...(newStatus === "approved" ? { approved_at: now, return_reason: null } : {}),
                ...(newStatus === "returned" ? { returned_at: now, return_reason: input.reason } : {}),
              },
              { onConflict: "employee_id,evaluation_year,quarter" }
            );
        } catch (err) {
          console.error("Failed to upsert kpi_quarterly_evaluations row:", err);
        }
      } else {
        if (input.action === "return" && input.reason) {
          notes.returnReason = input.reason;
          notes.growthAreas = (notes.growthAreas ? notes.growthAreas + "\n" : "") + `[HR Return Note]: ${input.reason}`;
          evalStatus = "returned";
        }
      }

      const updatePayload: Record<string, any> = {
        status: evalStatus,
        notes,
        updated_at: now,
        ...(evalStatus === "approved" ? { approved_at: now } : {}),
      };

      const { error: updErr } = await (supabase as any)
        .from("kpi_evaluations")
        .update(updatePayload)
        .eq("id", targetId);

      if (updErr) throw new Error(`Failed to update evaluation status: ${updErr.message}`);

      // Notify Manager & Employee
      const evaluatorId = oldRecord.evaluator_id;
      if (evaluatorId) {
        const qLabel = selectedQ ? selectedQ.toUpperCase() : oldRecord.evaluation_year;
        if (input.action === "approve") {
          await notifyKpiAction({
            userIds: [evaluatorId, oldRecord.employee_id],
            title: `KPI Evaluation ${selectedQ ? selectedQ.toUpperCase() + " " : ""}Approved (${oldRecord.evaluation_year})`,
            body: selectedQ
              ? `The ${selectedQ.toUpperCase()} evaluation has been approved. Remaining quarters remain open for evaluation.`
              : `The evaluation has been officially approved with a score of ${oldRecord.summary?.totalScore ?? 0}%.`,
            url: "/admin/kpi-evaluations",
            severity: "success",
          });
        } else {
          await notifyKpiAction({
            userIds: [evaluatorId],
            title: `KPI Evaluation ${selectedQ ? selectedQ.toUpperCase() + " " : ""}Returned for Revision (${oldRecord.evaluation_year})`,
            body: `HR requested revisions${selectedQ ? ` for ${selectedQ.toUpperCase()}` : ""}: ${input.reason}`,
            url: "/manager/kpi-evaluations",
            severity: "warning",
          });
        }
      }

      return { success: true, id: targetId, status: evalStatus, quarter: selectedQ };
    }

    throw new Error("Evaluation record not found");
  });

export const listPendingApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListPendingApprovalsSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);

    if (!isAdmin) {
      throw new Error("Forbidden: Pending approvals workspace is restricted to HR and Admins");
    }

    // 1. Query kpi_quarterly_evaluations
    let qQuery = (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select(`
        *,
        employee:profiles!kpi_quarterly_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en)
        ),
        evaluator:profiles!kpi_quarterly_evaluations_evaluator_id_fkey(
          id,
          full_name
        )
      `)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false });

    if (input.year) qQuery = qQuery.eq("evaluation_year", input.year);
    if (input.quarter) qQuery = qQuery.eq("quarter", input.quarter);

    // 2. Query kpi_evaluations (evaluations submitted through the scorecard workflow)
    let aQuery = (supabase as any)
      .from("kpi_evaluations")
      .select(`
        *,
        employee:profiles!kpi_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en)
        ),
        evaluator:profiles!kpi_evaluations_evaluator_id_fkey(
          id,
          full_name
        )
      `)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false });

    if (input.year) aQuery = aQuery.eq("evaluation_year", input.year);

    const [qRes, aRes] = await Promise.all([qQuery, aQuery]);
    if (qRes.error) throw new Error(`Failed to list pending quarterly approvals: ${qRes.error.message}`);
    if (aRes.error) throw new Error(`Failed to list pending evaluation approvals: ${aRes.error.message}`);

    const mappedQ = (qRes.data || []).map((r: any) => ({
      ...r,
      score: Number(r.score ?? 0),
      total_score: Number(r.score ?? r.total_score ?? 0),
      evaluator_name: r.evaluator?.full_name || r.evaluator_name || "Manager",
      source: "kpi_quarterly_evaluations",
    }));

    const mappedA = (aRes.data || []).map((r: any) => {
      const quarters: string[] = [];
      if (r.scores && typeof r.scores === "object") {
        for (const crit of Object.values(r.scores) as any[]) {
          if (crit?.q1?.actual != null) quarters.push("q1");
          if (crit?.q2?.actual != null) quarters.push("q2");
          if (crit?.q3?.actual != null) quarters.push("q3");
          if (crit?.q4?.actual != null) quarters.push("q4");
        }
      }
      const uniqueQs = Array.from(new Set(quarters));
      return {
        id: r.id,
        employee_id: r.employee_id,
        evaluation_year: r.evaluation_year,
        quarter: uniqueQs.length === 1 ? uniqueQs[0] : "Annual",
        quarters: uniqueQs,
        status: r.status,
        score: Number(r.summary?.totalScore ?? 0),
        total_score: Number(r.summary?.totalScore ?? 0),
        evaluator_id: r.evaluator_id,
        evaluator_name: r.evaluator_name || r.evaluator?.full_name || "Manager",
        notes: r.notes || {},
        quarter_statuses: r.notes?.quarterStatuses || {},
        submitted_at: r.submitted_at || r.updated_at,
        employee: r.employee,
        evaluator: r.evaluator,
        template_type: r.template_type,
        source: "kpi_evaluations",
      };
    });

    let rows = [...mappedQ, ...mappedA];

    if (input.search && input.search.trim()) {
      const s = input.search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const empName = (r.employee?.full_name || "").toLowerCase();
        const empCode = (r.employee?.emp_code || "").toLowerCase();
        const evalName = (r.evaluator_name || r.evaluator?.full_name || "").toLowerCase();
        return empName.includes(s) || empCode.includes(s) || evalName.includes(s);
      });
    }

    return rows;
  });

export const listManagerReturnedEvaluations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ year: z.number().int().min(2020).max(2100).optional() }).parse(input ?? {}))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, isManager } = await assertKpiAccess(supabase, userId);

    const year = (input as any)?.year ?? new Date().getFullYear();
    const scope = await resolveTeamMemberScope(supabase, userId);

    let teamIds: string[] = [];
    if (!isAdmin && isManager && !scope.isAdmin) {
      const { data: teamProfiles } = await supabase
        .from("profiles")
        .select("id")
        .or(`manager_id.eq.${userId}${scope.managedDeptIds?.length ? `,department_id.in.(${scope.managedDeptIds.join(",")})` : ""}`);
      teamIds = (teamProfiles || []).map((t: any) => t.id);
    }

    // 1. Query kpi_quarterly_evaluations where status = 'returned'
    let qQuery = (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select(`
        id,
        employee_id,
        evaluator_id,
        evaluation_year,
        quarter,
        status,
        score,
        return_reason,
        returned_at,
        updated_at,
        notes,
        employee:profiles!kpi_quarterly_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en, name_ar)
        )
      `)
      .eq("status", "returned")
      .eq("evaluation_year", year);

    if (!isAdmin && isManager && !scope.isAdmin) {
      if (teamIds.length > 0) {
        qQuery = qQuery.or(`evaluator_id.eq.${userId},employee_id.in.(${teamIds.join(",")})`);
      } else {
        qQuery = qQuery.eq("evaluator_id", userId);
      }
    }

    // 2. Query kpi_evaluations
    let aQuery = (supabase as any)
      .from("kpi_evaluations")
      .select(`
        id,
        employee_id,
        evaluator_id,
        evaluator_name,
        evaluation_year,
        template_type,
        status,
        scores,
        summary,
        notes,
        updated_at,
        employee:profiles!kpi_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en, name_ar)
        )
      `)
      .eq("evaluation_year", year);

    if (!isAdmin && isManager && !scope.isAdmin) {
      if (teamIds.length > 0) {
        aQuery = aQuery.or(`evaluator_id.eq.${userId},employee_id.in.(${teamIds.join(",")})`);
      } else {
        aQuery = aQuery.eq("evaluator_id", userId);
      }
    }

    const [qRes, aRes] = await Promise.all([qQuery, aQuery]);
    const items: any[] = [];
    const seenKeys = new Set<string>();

    if (qRes.data) {
      for (const r of qRes.data) {
        const key = `${r.employee_id}-${r.evaluation_year}-${r.quarter}`;
        seenKeys.add(key);
        items.push({
          id: r.id,
          employee_id: r.employee_id,
          evaluation_year: r.evaluation_year,
          quarter: r.quarter,
          status: "returned",
          score: Number(r.score ?? 0),
          return_reason: r.return_reason || r.notes?.returnReason || "Returned by HR Admin for revision",
          returned_at: r.returned_at || r.updated_at,
          employee: r.employee,
          source: "kpi_quarterly_evaluations",
        });
      }
    }

    if (aRes.data) {
      for (const r of aRes.data) {
        if (r.status === "submitted" || r.status === "approved") {
          continue;
        }
        const notes = typeof r.notes === "object" && r.notes ? r.notes : {};
        const qStatuses = notes.quarterStatuses || {};

        let foundQuarterReturn = false;
        for (const q of ["q1", "q2", "q3", "q4"] as const) {
          const key = `${r.employee_id}-${r.evaluation_year}-${q}`;
          const isQReturned = qStatuses[q]?.status === "returned";
          const hasQuarterNote = typeof notes.growthAreas === "string" && notes.growthAreas.toLowerCase().includes(`[hr return note - ${q}]`);
          if ((isQReturned || hasQuarterNote) && !seenKeys.has(key)) {
            foundQuarterReturn = true;
            seenKeys.add(key);
            const cleanQuarterReason = qStatuses[q]?.return_reason ||
              notes.returnReason ||
              (hasQuarterNote ? notes.growthAreas.replace(/.*\[HR Return Note.*?\]:\s*/i, "") : null) ||
              "Returned by HR Admin for revision";

            items.push({
              id: `${r.id}-${q}`,
              evaluation_id: r.id,
              employee_id: r.employee_id,
              evaluation_year: r.evaluation_year,
              quarter: q,
              status: "returned",
              score: Number(r.summary?.totalScore ?? 0),
              return_reason: cleanQuarterReason,
              returned_at: qStatuses[q]?.returned_at || r.updated_at,
              employee: r.employee,
              source: "kpi_evaluations",
            });
          }
        }

        const hasHrReturnNote = typeof notes.growthAreas === "string" && notes.growthAreas.includes("[HR Return Note]");
        if (!foundQuarterReturn && (r.status === "returned" || notes.returnReason || hasHrReturnNote)) {
          const key = `${r.employee_id}-${r.evaluation_year}-annual`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const cleanReason = notes.returnReason ||
              (hasHrReturnNote ? notes.growthAreas.replace(/.*\[HR Return Note.*?\]:\s*/i, "") : notes.growthAreas) ||
              "Returned by HR Admin for revision";

            items.push({
              id: r.id,
              evaluation_id: r.id,
              employee_id: r.employee_id,
              evaluation_year: r.evaluation_year,
              quarter: "annual",
              status: "returned",
              score: Number(r.summary?.totalScore ?? 0),
              return_reason: cleanReason,
              returned_at: r.updated_at,
              employee: r.employee,
              source: "kpi_evaluations",
            });
          }
        }
      }
    }

    items.sort((a, b) => new Date(b.returned_at || 0).getTime() - new Date(a.returned_at || 0).getTime());
    return items;
  });

export const getQuarterlyHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GetQuarterlyHistorySchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const targetYear = input.year || new Date().getFullYear();

    const { data, error } = await (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select(`
        *,
        items:kpi_quarterly_items(*),
        evaluator:profiles!kpi_quarterly_evaluations_evaluator_id_fkey(full_name)
      `)
      .eq("employee_id", input.employeeId)
      .eq("evaluation_year", targetYear)
      .order("quarter", { ascending: true });

    if (error) throw new Error(`Failed to fetch quarterly history: ${error.message}`);
    return (data || []) as QuarterlyEvaluationRecord[];
  });

// ─── LEGACY ANNUAL EVALUATION FUNCTIONS (KEPT FULLY COMPATIBLE) ──────────────

export const getKpiEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GetKpiEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, isManager } = await assertKpiAccess(supabase, userId);

    if (!isAdmin && isManager && input.employeeId) {
      const scope = await resolveTeamMemberScope(supabase, userId);
      if (!scope.isAdmin) {
        const { data: empProfile } = await supabase
          .from("profiles")
          .select("id, manager_id, department_id")
          .eq("id", input.employeeId)
          .maybeSingle();

        const isDirect = empProfile?.manager_id === userId;
        const isDeptManaged = empProfile?.department_id && scope.managedDeptIds?.includes(empProfile.department_id);
        const isSelf = input.employeeId === userId;

        if (!isDirect && !isDeptManaged && !isSelf) {
          throw new Error("Forbidden: You do not have permission to view this employee's evaluation");
        }
      }
    }

    let query = (supabase as any)
      .from("kpi_evaluations")
      .select(`
        id,
        employee_id,
        evaluation_year,
        template_type,
        evaluator_id,
        evaluator_name,
        status,
        scores,
        summary,
        notes,
        submitted_at,
        reviewed_at,
        approved_at,
        created_at,
        updated_at,
        employee:profiles!kpi_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en)
        )
      `);

    if (input.id) {
      query = query.eq("id", input.id);
    } else {
      if (input.employeeId) query = query.eq("employee_id", input.employeeId);
      if (input.year) query = query.eq("evaluation_year", input.year);
      if (input.templateType) {
        query = query.eq("template_type", input.templateType);
      }
      query = query.order("updated_at", { ascending: false }).limit(1);
    }

    const { data: records, error } = await query;
    if (error) throw new Error(`Failed to fetch KPI evaluation: ${error.message}`);
    const record = Array.isArray(records) ? records[0] : records;

    if (record) {
      return (record as KpiEvaluationRecord);
    }

    // Fallback: check kpi_quarterly_evaluations if not in kpi_evaluations
    if (input.id || (input.employeeId && input.year)) {
      let qQuery = (supabase as any)
        .from("kpi_quarterly_evaluations")
        .select(`
          id,
          employee_id,
          evaluator_id,
          evaluation_year,
          quarter,
          status,
          score,
          rating_tier,
          notes,
          submitted_at,
          returned_at,
          approved_at,
          created_at,
          updated_at,
          items:kpi_quarterly_items(*),
          employee:profiles!kpi_quarterly_evaluations_employee_id_fkey(
            id,
            full_name,
            emp_code,
            department:departments!profiles_department_id_fkey(name_en),
            position:positions!profiles_position_id_fkey(name_en)
          ),
          evaluator:profiles!kpi_quarterly_evaluations_evaluator_id_fkey(
            id,
            full_name
          )
        `);

      if (input.id) {
        qQuery = qQuery.eq("id", input.id);
      } else {
        if (input.employeeId) qQuery = qQuery.eq("employee_id", input.employeeId);
        if (input.year) qQuery = qQuery.eq("evaluation_year", input.year);
        qQuery = qQuery.order("updated_at", { ascending: false }).limit(1);
      }

      const { data: qRecords } = await qQuery;
      const qRec = Array.isArray(qRecords) ? qRecords[0] : qRecords;
      if (qRec) {
        const scores: Record<string, any> = {};
        for (const it of (qRec.items || [])) {
          const key = it.criterion_id || it.id;
          const qKey = (qRec.quarter || "q1").toLowerCase();
          scores[key] = {
            id: key,
            targetAnnual: it.target_benchmark,
            [qKey]: {
              actual: it.actual_value,
              achievement: it.achievement_rate,
              score: it.weighted_score,
            },
            annualScore: it.weighted_score,
          };
        }
        return {
          id: qRec.id,
          employee_id: qRec.employee_id,
          evaluation_year: qRec.evaluation_year,
          template_type: qRec.template_id || "quarterly_template",
          evaluator_id: qRec.evaluator_id,
          evaluator_name: qRec.evaluator?.full_name || "Manager",
          status: qRec.status,
          scores,
          summary: {
            totalScore: Number(qRec.score ?? 0),
            rating: qRec.rating_tier || "Pending Evaluation",
          },
          notes: qRec.notes || {},
          submitted_at: qRec.submitted_at,
          reviewed_at: qRec.returned_at,
          approved_at: qRec.approved_at,
          created_at: qRec.created_at,
          updated_at: qRec.updated_at,
          employee: qRec.employee,
        } as KpiEvaluationRecord;
      }
    }

    return null;
  });

export const listKpiEvaluations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListKpiEvaluationsSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, isManager } = await assertKpiAccess(supabase, userId);

    let query = (supabase as any)
      .from("kpi_evaluations")
      .select(`
        id,
        employee_id,
        evaluation_year,
        template_type,
        evaluator_id,
        evaluator_name,
        status,
        scores,
        summary,
        notes,
        submitted_at,
        reviewed_at,
        approved_at,
        created_at,
        updated_at,
        employee:profiles!kpi_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en)
        )
      `)
      .order("updated_at", { ascending: false });

    if (input.year) query = query.eq("evaluation_year", input.year);
    if (input.status && input.status !== "all") query = query.eq("status", input.status);

    if (!isAdmin && isManager) {
      const scope = await resolveTeamMemberScope(supabase, userId);
      if (!scope.isAdmin) {
        const { data: teamProfiles } = await supabase
          .from("profiles")
          .select("id")
          .or(`manager_id.eq.${userId}${scope.managedDeptIds?.length ? `,department_id.in.(${scope.managedDeptIds.join(",")})` : ""}`);

        const teamIds = (teamProfiles || []).map((t: any) => t.id);
        if (teamIds.length > 0) {
          query = query.or(`evaluator_id.eq.${userId},employee_id.in.(${teamIds.join(",")})`);
        } else {
          query = query.eq("evaluator_id", userId);
        }
      }
    }

    const { data, error } = await query.limit(500);
    if (error) throw new Error(`Failed to list KPI evaluations: ${error.message}`);

    let rows = (data || []).map((r: any) => {
      let scores = r.scores;
      if (typeof scores === "string") {
        try { scores = JSON.parse(scores); } catch {}
      }
      let summary = r.summary;
      if (typeof summary === "string") {
        try { summary = JSON.parse(summary); } catch {}
      }
      let notes = r.notes;
      if (typeof notes === "string") {
        try { notes = JSON.parse(notes); } catch {}
      }
      return { ...r, scores, summary, notes };
    }) as KpiEvaluationRecord[];
    if (input.search && input.search.trim()) {
      const s = input.search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const name = (r.employee?.full_name || "").toLowerCase();
        const code = (r.employee?.emp_code || "").toLowerCase();
        return name.includes(s) || code.includes(s);
      });
    }

    return rows;
  });

export const saveKpiEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveKpiEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, isManager } = await assertKpiAccess(supabase, userId);

    if (!isAdmin && isManager) {
      const scope = await resolveTeamMemberScope(supabase, userId);
      if (!scope.isAdmin) {
        const { data: empProfile } = await supabase
          .from("profiles")
          .select("id, manager_id, department_id")
          .eq("id", input.employeeId)
          .maybeSingle();

        const isDirect = empProfile?.manager_id === userId;
        const isDeptManaged = empProfile?.department_id && scope.managedDeptIds?.includes(empProfile.department_id);

        if (!isDirect && !isDeptManaged) {
          throw new Error("Forbidden: You can only evaluate employees within your assigned team or department");
        }
      }
    }

    const { data: existing } = await (supabase as any)
      .from("kpi_evaluations")
      .select("id, status")
      .eq("employee_id", input.employeeId)
      .eq("evaluation_year", input.year)
      .eq("template_type", input.templateType || "light_current_engineer")
      .maybeSingle();

    if (existing?.status === "approved" && !isAdmin) {
      throw new Error("Locked: Approved evaluations cannot be edited by managers. Contact HR or an Admin.");
    }

    const now = new Date().toISOString();
    const payload = {
      employee_id: input.employeeId,
      evaluation_year: input.year,
      template_type: input.templateType || "light_current_engineer",
      evaluator_id: userId,
      evaluator_name: input.evaluatorName || null,
      status: input.status,
      scores: input.scores,
      summary: input.summary,
      notes: input.notes,
      updated_at: now,
      ...(input.status === "submitted" ? { submitted_at: now } : {}),
      ...(input.status === "approved" ? { approved_at: now } : {}),
    };

    let resultId = existing?.id;

    if (existing?.id) {
      const { error } = await (supabase as any)
        .from("kpi_evaluations")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(`Failed to update evaluation: ${error.message}`);
    } else {
      const { data: inserted, error } = await (supabase as any)
        .from("kpi_evaluations")
        .insert({ ...payload, created_at: now })
        .select("id")
        .single();
      if (error) throw new Error(`Failed to create evaluation: ${error.message}`);
      resultId = inserted.id;
    }

    if (input.status === "submitted" || input.status === "approved") {
      await (supabase as any)
        .from("kpi_quarterly_evaluations")
        .update({ status: input.status, updated_at: now })
        .eq("employee_id", input.employeeId)
        .eq("evaluation_year", input.year)
        .eq("status", "returned");
    }

    return {
      success: true,
      id: resultId,
      status: input.status,
      savedAt: now,
    };
  });

export const updateKpiEvaluationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateKpiStatusSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);

    const { data: existing, error: fetchErr } = await (supabase as any)
      .from("kpi_evaluations")
      .select("id, employee_id, evaluation_year, status, evaluator_id, summary")
      .eq("id", input.id)
      .single();

    if (fetchErr || !existing) throw new Error("Evaluation record not found");

    if (input.status === "approved" && !isAdmin) {
      throw new Error("Forbidden: Only HR or Admins can approve evaluations");
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: input.status,
      updated_at: now,
    };

    if (input.status === "submitted") updatePayload.submitted_at = now;
    else if (input.status === "reviewed") updatePayload.reviewed_at = now;
    else if (input.status === "approved") updatePayload.approved_at = now;

    const { error: updateErr } = await (supabase as any)
      .from("kpi_evaluations")
      .update(updatePayload)
      .eq("id", input.id);

    if (updateErr) throw new Error(`Failed to update status: ${updateErr.message}`);

    return { success: true, id: input.id, status: input.status, updatedAt: now };
  });

export const deleteKpiEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteKpiEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertKpiAccess(supabase, userId);
    if (!isAdmin) throw new Error("Forbidden: Only HR or Admins can delete KPI evaluations");

    const { error } = await (supabase as any)
      .from("kpi_evaluations")
      .delete()
      .eq("id", input.id);

    if (error) throw new Error(`Failed to delete evaluation: ${error.message}`);
    return { success: true, id: input.id };
  });

export const getMyKpiEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GetMyKpiEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const targetYear = input.year || new Date().getFullYear();

    let query = (supabase as any)
      .from("kpi_evaluations")
      .select(`
        id,
        employee_id,
        evaluation_year,
        template_type,
        evaluator_id,
        evaluator_name,
        status,
        scores,
        summary,
        notes,
        submitted_at,
        reviewed_at,
        approved_at,
        created_at,
        updated_at,
        employee:profiles!kpi_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments!profiles_department_id_fkey(name_en),
          position:positions!profiles_position_id_fkey(name_en)
        )
      `)
      .eq("employee_id", userId)
      .eq("evaluation_year", targetYear);

    if (input.templateType) {
      query = query.eq("template_type", input.templateType);
    }

    const { data: records, error } = await query;
    if (error) throw new Error(`Failed to fetch your KPI evaluation: ${error.message}`);
    if (!records || records.length === 0) return null;

    // Prioritize approved > reviewed > submitted > draft, breaking ties by updated_at desc
    const statusWeight: Record<string, number> = {
      approved: 4,
      reviewed: 3,
      submitted: 2,
      draft: 1,
    };
    const sorted = [...records].sort((a: any, b: any) => {
      const wa = statusWeight[a.status?.toLowerCase()] || 0;
      const wb = statusWeight[b.status?.toLowerCase()] || 0;
      if (wa !== wb) return wb - wa;
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

    return (sorted[0] as KpiEvaluationRecord) || null;
  });

export const listMyKpiEvaluations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await (supabase as any)
      .from("kpi_evaluations")
      .select(`
        id,
        employee_id,
        evaluation_year,
        template_type,
        evaluator_id,
        evaluator_name,
        status,
        scores,
        summary,
        notes,
        submitted_at,
        reviewed_at,
        approved_at,
        created_at,
        updated_at
      `)
      .eq("employee_id", userId)
      .order("evaluation_year", { ascending: false });

    if (error) throw new Error(`Failed to list your KPI evaluations: ${error.message}`);
    return (data || []) as KpiEvaluationRecord[];
  });
