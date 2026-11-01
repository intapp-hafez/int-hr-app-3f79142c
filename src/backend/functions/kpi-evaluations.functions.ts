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
  PublishKpiTemplateSchema,
  ListKpiTemplatesSchema,
  MatchKpiTemplateSchema,
  SaveQuarterlyEvaluationSchema,
  GetQuarterlyEvaluationSchema,
  ReviewQuarterlyEvaluationSchema,
  ListPendingApprovalsSchema,
  GetQuarterlyHistorySchema,
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
    return data || [];
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
    const payload = {
      name_en: input.name_en,
      name_ar: input.name_ar,
      description_en: input.description_en || "",
      description_ar: input.description_ar || "",
      criterion_type: input.criterion_type,
      category: input.category,
      scoring_scale: input.scoring_scale,
      max_scale_value: input.max_scale_value,
      default_weight: input.default_weight,
      is_required: input.is_required,
      is_active: input.is_active,
      display_order: input.display_order,
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
        position:positions(id, name_en, name_ar),
        job_grade:job_grades(id, name_en, name_ar),
        items:kpi_template_items(
          id,
          criterion_id,
          weight,
          target_benchmark,
          display_order,
          criterion:kpi_criteria(*)
        )
      `)
      .order("updated_at", { ascending: false });

    if (input.status && input.status !== "all") {
      query = query.eq("status", input.status);
    }
    if (input.positionId) {
      query = query.eq("position_id", input.positionId);
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

    // Validate that sum of weights equals 1.0 (100%)
    const sumWeight = input.items.reduce((acc, it) => acc + Number(it.weight), 0);
    if (Math.abs(sumWeight - 1.0) > 0.005) {
      throw new Error(`Total template weight must equal exactly 100%. Current total: ${(sumWeight * 100).toFixed(1)}%`);
    }

    const now = new Date().toISOString();
    const templatePayload = {
      name_en: input.name_en,
      name_ar: input.name_ar,
      position_id: input.position_id || null,
      job_grade_id: input.job_grade_id || null,
      common_weight_pct: input.common_weight_pct,
      position_weight_pct: input.position_weight_pct,
      is_active: input.is_active,
      updated_at: now,
    };

    let templateId = input.id;

    if (templateId) {
      const { error: updErr } = await (supabase as any)
        .from("kpi_templates")
        .update(templatePayload)
        .eq("id", templateId);
      if (updErr) throw new Error(`Failed to update template: ${updErr.message}`);

      // Delete existing items to replace with updated list
      await (supabase as any)
        .from("kpi_template_items")
        .delete()
        .eq("template_id", templateId);
    } else {
      const { data: inserted, error: insErr } = await (supabase as any)
        .from("kpi_templates")
        .insert({
          ...templatePayload,
          status: "draft",
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
      display_order: it.display_order ?? idx + 1,
      created_at: now,
    }));

    const { error: itemsErr } = await (supabase as any)
      .from("kpi_template_items")
      .insert(itemsPayload);

    if (itemsErr) throw new Error(`Failed to save template items: ${itemsErr.message}`);

    return { success: true, id: templateId };
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

    // 1. Fetch employee's position and job grade
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, position_id, department_id, section_id")
      .eq("id", input.employeeId)
      .maybeSingle();

    if (!profile) throw new Error("Employee profile not found");

    // 2. Fetch published templates
    const { data: templates } = await (supabase as any)
      .from("kpi_templates")
      .select(`
        *,
        items:kpi_template_items(
          id,
          criterion_id,
          weight,
          target_benchmark,
          display_order,
          criterion:kpi_criteria(*)
        )
      `)
      .eq("status", "published")
      .eq("is_active", true);

    const published = (templates || []) as any[];

    // Priority matching:
    // A: Exact position match
    if (profile.position_id) {
      const posMatch = published.find((t) => t.position_id === profile.position_id);
      if (posMatch) return posMatch;
    }

    // B: Fallback template (no specific position or first active)
    const fallback = published.find((t) => !t.position_id) || published[0] || null;
    return fallback;
  });

// ─── QUARTERLY EVALUATIONS WORKFLOW ──────────────────────────────────────────

export const getQuarterlyEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GetQuarterlyEvaluationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const { isAdmin, isManager } = await assertKpiAccess(supabase, userId);

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
        const isSelf = input.employeeId === userId;

        if (!isDirect && !isDeptManaged && !isSelf) {
          throw new Error("Forbidden: You do not have permission to view this employee's quarterly evaluation");
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
          department:departments(name_en),
          position:positions(name_en, name_ar)
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

      let achievement = it.achievement_rate;
      if (it.actual_value != null && it.target_benchmark > 0) {
        achievement = Math.min(1.0, it.actual_value / it.target_benchmark);
      }

      let weightedScore = null;
      if (achievement != null) {
        weightedScore = achievement * weight * 100;
        earnedSum += weightedScore;

        if (it.criterion_type === "common") commonEarned += weightedScore;
        else if (it.criterion_type === "position_specific") posEarned += weightedScore;
        else customEarned += weightedScore;
      }

      return {
        ...it,
        achievement_rate: achievement,
        weighted_score: weightedScore != null ? Number(weightedScore.toFixed(2)) : null,
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

    const { data: record, error: fetchErr } = await (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select("id, employee_id, evaluator_id, evaluation_year, quarter, status, score")
      .eq("id", input.id)
      .single();

    if (fetchErr || !record) throw new Error("Quarterly evaluation record not found");

    const now = new Date().toISOString();
    const newStatus = input.action === "approve" ? "approved" : "returned";

    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: now,
      ...(newStatus === "approved" ? { approved_at: now, return_reason: null } : {}),
      ...(newStatus === "returned" ? { returned_at: now, return_reason: input.reason } : {}),
    };

    const { error: updErr } = await (supabase as any)
      .from("kpi_quarterly_evaluations")
      .update(updatePayload)
      .eq("id", input.id);

    if (updErr) throw new Error(`Failed to update evaluation status: ${updErr.message}`);

    // Record audit transition
    await (supabase as any).from("kpi_evaluation_transitions").insert({
      evaluation_id: input.id,
      actor_id: userId,
      from_status: record.status,
      to_status: newStatus,
      reason: input.action === "return" ? input.reason : "Approved by HR Admin",
      created_at: now,
    });

    // Notify Manager
    if (record.evaluator_id) {
      if (input.action === "approve") {
        await notifyKpiAction({
          userIds: [record.evaluator_id, record.employee_id],
          title: `KPI Evaluation Approved (${record.quarter.toUpperCase()} ${record.evaluation_year})`,
          body: `The evaluation has been officially approved with a score of ${record.score}%.`,
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

    return { success: true, id: input.id, status: newStatus };
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

    let query = (supabase as any)
      .from("kpi_quarterly_evaluations")
      .select(`
        *,
        employee:profiles!kpi_quarterly_evaluations_employee_id_fkey(
          id,
          full_name,
          emp_code,
          department:departments(name_en),
          position:positions(name_en)
        ),
        evaluator:profiles!kpi_quarterly_evaluations_evaluator_id_fkey(
          id,
          full_name
        )
      `)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false });

    if (input.year) query = query.eq("evaluation_year", input.year);
    if (input.quarter) query = query.eq("quarter", input.quarter);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list pending approvals: ${error.message}`);

    let rows = (data || []) as QuarterlyEvaluationRecord[];
    if (input.search && input.search.trim()) {
      const s = input.search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const empName = (r.employee?.full_name || "").toLowerCase();
        const empCode = (r.employee?.emp_code || "").toLowerCase();
        const evalName = (r.evaluator?.full_name || "").toLowerCase();
        return empName.includes(s) || empCode.includes(s) || evalName.includes(s);
      });
    }

    return rows;
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
        const isSelf = input.employeeId === userId;

        if (!isDirect && !isDeptManaged && !isSelf) {
          throw new Error("Forbidden: You do not have permission to view this employee's evaluation");
        }
      }
    }

    const { data: record, error } = await (supabase as any)
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
          department:departments(name_en),
          position:positions(name_en)
        )
      `)
      .eq("employee_id", input.employeeId)
      .eq("evaluation_year", input.year)
      .eq("template_type", input.templateType || "light_current_engineer")
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch KPI evaluation: ${error.message}`);
    return (record as KpiEvaluationRecord) || null;
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
          department:departments(name_en),
          position:positions(name_en)
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

    let rows = (data || []) as KpiEvaluationRecord[];
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

    const { data: record, error } = await (supabase as any)
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
          department:departments(name_en),
          position:positions(name_en)
        )
      `)
      .eq("employee_id", userId)
      .eq("evaluation_year", targetYear)
      .eq("template_type", input.templateType || "light_current_engineer")
      .in("status", ["submitted", "reviewed", "approved"])
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch your KPI evaluation: ${error.message}`);
    return (record as KpiEvaluationRecord) || null;
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
        summary,
        notes,
        submitted_at,
        reviewed_at,
        approved_at,
        created_at,
        updated_at
      `)
      .eq("employee_id", userId)
      .in("status", ["submitted", "reviewed", "approved"])
      .order("evaluation_year", { ascending: false });

    if (error) throw new Error(`Failed to list your KPI evaluations: ${error.message}`);
    return (data || []) as KpiEvaluationRecord[];
  });
