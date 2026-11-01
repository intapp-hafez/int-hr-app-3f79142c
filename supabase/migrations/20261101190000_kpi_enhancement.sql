-- ==============================================================================
-- Migration: INT HR KPI & Performance Evaluation Enhancement
-- Tables:
--   1. kpi_criteria: Catalog of Common, Position-Specific, and Custom Criteria
--   2. kpi_templates: Templates mapped to Positions and/or Job Grades
--   3. kpi_template_items: Criteria linkages with weights and targets
--   4. kpi_quarterly_evaluations: Independent Q1-Q4 evaluation headers
--   5. kpi_quarterly_items: Snapshot line items with scores and comments
--   6. kpi_evaluation_transitions: Immutable audit log of all status changes
-- Timezone: Africa/Cairo
-- ==============================================================================

-- 1. Criteria Catalog
CREATE TABLE IF NOT EXISTS public.kpi_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text DEFAULT '',
  description_ar text DEFAULT '',
  criterion_type text NOT NULL CHECK (criterion_type IN ('common', 'position_specific', 'custom')),
  category text NOT NULL DEFAULT 'technical' CHECK (category IN ('behavioral', 'technical', 'quality', 'productivity', 'safety', 'coordination')),
  scoring_scale text NOT NULL DEFAULT 'percentage' CHECK (scoring_scale IN ('rating_5', 'percentage', 'count', 'boolean')),
  max_scale_value numeric NOT NULL DEFAULT 100,
  default_weight numeric NOT NULL DEFAULT 0.05 CHECK (default_weight > 0 AND default_weight <= 1.0),
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kpi_criteria_type_active ON public.kpi_criteria (criterion_type, is_active);
CREATE INDEX IF NOT EXISTS idx_kpi_criteria_category ON public.kpi_criteria (category);

-- 2. Performance Evaluation Templates
CREATE TABLE IF NOT EXISTS public.kpi_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  job_grade_id uuid REFERENCES public.job_grades(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  common_weight_pct numeric NOT NULL DEFAULT 40 CHECK (common_weight_pct >= 0 AND common_weight_pct <= 100),
  position_weight_pct numeric NOT NULL DEFAULT 60 CHECK (position_weight_pct >= 0 AND position_weight_pct <= 100),
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kpi_templates_pos_grade ON public.kpi_templates (position_id, job_grade_id, status);

-- 3. Template Items (Criteria Linkage)
CREATE TABLE IF NOT EXISTS public.kpi_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.kpi_templates(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.kpi_criteria(id) ON DELETE RESTRICT,
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 1.0),
  target_benchmark numeric NOT NULL DEFAULT 1.0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_template_criterion UNIQUE (template_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_template_items_tmpl ON public.kpi_template_items (template_id);

-- 4. Quarterly Evaluation Headers (Q1, Q2, Q3, Q4)
CREATE TABLE IF NOT EXISTS public.kpi_quarterly_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  evaluation_year integer NOT NULL CHECK (evaluation_year >= 2020 AND evaluation_year <= 2100),
  quarter text NOT NULL CHECK (quarter IN ('q1', 'q2', 'q3', 'q4')),
  template_id uuid REFERENCES public.kpi_templates(id) ON DELETE SET NULL,
  template_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'returned', 'approved')),
  score numeric NOT NULL DEFAULT 0.0 CHECK (score >= 0.0 AND score <= 100.0),
  common_score numeric DEFAULT 0.0,
  position_score numeric DEFAULT 0.0,
  custom_score numeric DEFAULT 0.0,
  rating_tier text DEFAULT 'Pending Evaluation',
  return_reason text,
  notes jsonb NOT NULL DEFAULT '{"strengths":"","growthAreas":"","recommendations":""}'::jsonb,
  submitted_at timestamptz,
  returned_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_emp_year_quarter UNIQUE (employee_id, evaluation_year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_kpi_quarterly_emp_year ON public.kpi_quarterly_evaluations (employee_id, evaluation_year);
CREATE INDEX IF NOT EXISTS idx_kpi_quarterly_status ON public.kpi_quarterly_evaluations (status);
CREATE INDEX IF NOT EXISTS idx_kpi_quarterly_evaluator ON public.kpi_quarterly_evaluations (evaluator_id);

-- 5. Quarterly Evaluation Snapshot Line Items
CREATE TABLE IF NOT EXISTS public.kpi_quarterly_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.kpi_quarterly_evaluations(id) ON DELETE CASCADE,
  criterion_id uuid REFERENCES public.kpi_criteria(id) ON DELETE SET NULL,
  criterion_name_en text NOT NULL,
  criterion_name_ar text NOT NULL,
  criterion_type text NOT NULL CHECK (criterion_type IN ('common', 'position_specific', 'custom')),
  category text NOT NULL DEFAULT 'technical',
  scoring_scale text NOT NULL DEFAULT 'percentage',
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 1.0),
  target_benchmark numeric NOT NULL DEFAULT 1.0,
  actual_value numeric,
  achievement_rate numeric,
  weighted_score numeric,
  comments text DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kpi_quarterly_items_eval ON public.kpi_quarterly_items (evaluation_id);

-- 6. Evaluation Transition Audit Log
CREATE TABLE IF NOT EXISTS public.kpi_evaluation_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.kpi_quarterly_evaluations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_name text,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_kpi_transitions_eval ON public.kpi_evaluation_transitions (evaluation_id, created_at);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.kpi_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_quarterly_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_quarterly_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_evaluation_transitions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.kpi_criteria TO authenticated, service_role;
GRANT ALL ON public.kpi_templates TO authenticated, service_role;
GRANT ALL ON public.kpi_template_items TO authenticated, service_role;
GRANT ALL ON public.kpi_quarterly_evaluations TO authenticated, service_role;
GRANT ALL ON public.kpi_quarterly_items TO authenticated, service_role;
GRANT ALL ON public.kpi_evaluation_transitions TO authenticated, service_role;

-- ── RLS POLICIES ────────────────────────────────────────────────────────────

-- Criteria & Templates: Readable by all authenticated staff, writeable by Admin & HR
DROP POLICY IF EXISTS "kpi_criteria_read" ON public.kpi_criteria;
CREATE POLICY "kpi_criteria_read" ON public.kpi_criteria FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kpi_criteria_admin_write" ON public.kpi_criteria;
CREATE POLICY "kpi_criteria_admin_write" ON public.kpi_criteria FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "kpi_templates_read" ON public.kpi_templates;
CREATE POLICY "kpi_templates_read" ON public.kpi_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kpi_templates_admin_write" ON public.kpi_templates;
CREATE POLICY "kpi_templates_admin_write" ON public.kpi_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "kpi_template_items_read" ON public.kpi_template_items;
CREATE POLICY "kpi_template_items_read" ON public.kpi_template_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kpi_template_items_admin_write" ON public.kpi_template_items;
CREATE POLICY "kpi_template_items_admin_write" ON public.kpi_template_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Quarterly Evaluations RLS
-- 1. Admin & HR full access
DROP POLICY IF EXISTS "kpi_quarterly_admin_all" ON public.kpi_quarterly_evaluations;
CREATE POLICY "kpi_quarterly_admin_all" ON public.kpi_quarterly_evaluations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- 2. Manager Read Access (Evaluated by them or team members)
DROP POLICY IF EXISTS "kpi_quarterly_manager_read" ON public.kpi_quarterly_evaluations;
CREATE POLICY "kpi_quarterly_manager_read" ON public.kpi_quarterly_evaluations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND (
      evaluator_id = auth.uid()
      OR employee_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.manager_id = auth.uid()
           OR p.department_id IN (SELECT d.id FROM public.departments d WHERE d.responsible_person_id = auth.uid())
      )
    )
  );

-- 3. Manager Insert Access
DROP POLICY IF EXISTS "kpi_quarterly_manager_insert" ON public.kpi_quarterly_evaluations;
CREATE POLICY "kpi_quarterly_manager_insert" ON public.kpi_quarterly_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND evaluator_id = auth.uid()
    AND (
      employee_id IN (
        SELECT p.id FROM public.profiles p
        WHERE p.manager_id = auth.uid()
           OR p.department_id IN (SELECT d.id FROM public.departments d WHERE d.responsible_person_id = auth.uid())
      )
    )
  );

-- 4. Manager Update Access (only when draft or returned; locked when approved)
DROP POLICY IF EXISTS "kpi_quarterly_manager_update" ON public.kpi_quarterly_evaluations;
CREATE POLICY "kpi_quarterly_manager_update" ON public.kpi_quarterly_evaluations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND evaluator_id = auth.uid()
    AND status IN ('draft', 'returned')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager')
    AND evaluator_id = auth.uid()
  );

-- 5. Employee Self Read (only approved or submitted)
DROP POLICY IF EXISTS "kpi_quarterly_emp_read" ON public.kpi_quarterly_evaluations;
CREATE POLICY "kpi_quarterly_emp_read" ON public.kpi_quarterly_evaluations FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    AND status IN ('submitted', 'approved')
  );

-- Line Items RLS: Follows quarterly evaluation parent record
DROP POLICY IF EXISTS "kpi_qitems_read" ON public.kpi_quarterly_items;
CREATE POLICY "kpi_qitems_read" ON public.kpi_quarterly_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kpi_quarterly_evaluations e
      WHERE e.id = evaluation_id
    )
  );

DROP POLICY IF EXISTS "kpi_qitems_admin_write" ON public.kpi_quarterly_items;
CREATE POLICY "kpi_qitems_admin_write" ON public.kpi_quarterly_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "kpi_qitems_manager_write" ON public.kpi_quarterly_items;
CREATE POLICY "kpi_qitems_manager_write" ON public.kpi_quarterly_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kpi_quarterly_evaluations e
      WHERE e.id = evaluation_id
        AND e.evaluator_id = auth.uid()
        AND e.status IN ('draft', 'returned')
    )
  );

-- Transitions Audit Log RLS
DROP POLICY IF EXISTS "kpi_transitions_read" ON public.kpi_evaluation_transitions;
CREATE POLICY "kpi_transitions_read" ON public.kpi_evaluation_transitions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.kpi_quarterly_evaluations e
      WHERE e.id = evaluation_id AND (e.evaluator_id = auth.uid() OR e.employee_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "kpi_transitions_insert" ON public.kpi_evaluation_transitions;
CREATE POLICY "kpi_transitions_insert" ON public.kpi_evaluation_transitions FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── SEED INITIAL CRITERIA CATALOG ───────────────────────────────────────────

-- Layer 1: Common Company-Wide Criteria (40% Total Default)
INSERT INTO public.kpi_criteria (name_en, name_ar, description_en, description_ar, criterion_type, category, scoring_scale, default_weight, is_required, display_order)
VALUES
  ('Attendance & Punctuality', 'الحضور والانضباط بمواعيد العمل', 'Adherence to official site and office working hours, timely check-ins, and shift schedule compliance.', 'الالتزام بمواعيد العمل الرسمية في المواقع والمكاتب وتسجيل الحضور دون تأخير.', 'common', 'behavioral', 'percentage', 0.10, true, 1),
  ('Discipline & Site Safety Compliance', 'الانضباط والالتزام بقواعد السلامة المهنية', 'Strict adherence to company code of conduct, PPE standards, and project safety protocols.', 'الالتزام التام بقواعد السلوك المهني ومعايير السلامة والصحة المهنية وارتداء مهمات الوقاية.', 'common', 'safety', 'percentage', 0.08, true, 2),
  ('Teamwork & Collaboration', 'العمل الجماعي والتعاون مع الفريق', 'Active support to peers, cross-functional cooperation, and positive site atmosphere.', 'التعاون الفعال مع الزملاء وفرق العمل المختلفة وخلق بيئة إيجابية في الموقع.', 'common', 'behavioral', 'percentage', 0.08, true, 3),
  ('Communication & Professionalism', 'التواصل الفعال والاحترافية', 'Clear reporting, respectful verbal and written communication with clients and supervisors.', 'وضوح التقارير واللباقة في التعامل الشفهي والكتابي مع العملاء والمشرفين.', 'common', 'behavioral', 'percentage', 0.07, true, 4),
  ('Policy & Process Compliance', 'الالتزام بسياسات وإجراءات الشركة', 'Compliance with standard operating procedures, documentation submission, and HR guidelines.', 'الالتزام بإجراءات التشغيل القياسية وتقديم النماذج والمستندات وفق لوائح الموارد البشرية.', 'common', 'behavioral', 'percentage', 0.07, true, 5)
ON CONFLICT DO NOTHING;

-- Layer 2: Position-Specific Criteria (Light Current Engineer / ELV Site Engineer - 60% Total Default)
INSERT INTO public.kpi_criteria (name_en, name_ar, description_en, description_ar, criterion_type, category, scoring_scale, default_weight, is_required, display_order)
VALUES
  ('On-Time Installation Completion', 'إنجاز أعمال التركيبات في الوقت المحدد', 'Delivering scheduled installation milestones per project schedule baseline.', 'تسليم مراحل التركيبات المحددة وفق الجدول الزمني المعتمد للمشروع.', 'position_specific', 'technical', 'percentage', 0.10, true, 6),
  ('Compliance with Approved Shop Drawings', 'المطابقة للمخططات التنفيذية المعتمدة', 'First-time accuracy against drawings without recurring consultant defects.', 'التنفيذ الدقيق وفق المخططات دون تكرار ملاحظات الاستشاري.', 'position_specific', 'quality', 'percentage', 0.10, true, 7),
  ('System Commissioning & Programming Accuracy', 'دقة تشغيل وبرمجة الأنظمة', 'Accurate configuration of CCTV, Access Control, Fire Alarm, and BMS systems.', 'البرمجة الصحيحة لكاميرات المراقبة، التحكم بالدخول، إنذار الحريق، وأنظمة إدارة المباني.', 'position_specific', 'technical', 'percentage', 0.10, true, 8),
  ('Cross-System Integration Execution', 'تكامل الأنظمة والتنسيق الميداني', 'Successful integration testing (Fire Alarm trip interface with Access Control and HVAC).', 'إجراء اختبارات التكامل بنجاح بين أنظمة الإنذار والتحكم بالدخول والتكييف.', 'position_specific', 'technical', 'percentage', 0.10, true, 9),
  ('Troubleshooting & Technical Issue Resolution', 'سرعة وكفاءة استكشاف الأعطال وحلها', 'Mean time to resolve technical field snags and cabling faults.', 'سرعة تشخيص وحل المشكلات الفنية وأعطال الكابلات والأجهزة في الموقع.', 'position_specific', 'productivity', 'percentage', 0.10, true, 10),
  ('Daily & Weekly Site Reporting Quality', 'جودة ودقة التقارير الفنية اليومية والأسبوعية', 'Accurate progress reporting, material verification, and snag-list closure tracking.', 'دقة تقارير الإنجاز اليومية وحصر المواد ومتابعة إغلاق قوائم الملاحظات.', 'position_specific', 'quality', 'percentage', 0.10, true, 11)
ON CONFLICT DO NOTHING;

