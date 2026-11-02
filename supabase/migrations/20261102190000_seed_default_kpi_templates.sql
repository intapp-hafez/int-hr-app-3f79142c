-- ==============================================================================
-- Migration: Seed Standard Default Job Role Evaluation Templates
-- Populates default KPI Criteria & Published Evaluation Templates for:
--   1. Light Current / ELV Site Engineer (Junior & Mid)
--   2. Senior Site Engineer & Technical Team Leader
--   3. Software Engineer & Full Stack Developer
--   4. Human Resources (HR) Specialist
--   5. Financial Accountant
--   6. Sales Specialist & Account Executive
--   7. Customer Service & CRM Specialist
-- Timezone: Africa/Cairo
-- ==============================================================================

DO $$
DECLARE
  v_eng_dept_id UUID;
  v_it_dept_id UUID;
  v_hr_dept_id UUID;
  v_fin_dept_id UUID;
  v_sales_dept_id UUID;
  v_crm_dept_id UUID;

  v_site_eng_pos_id UUID;
  v_sr_eng_pos_id UUID;
  v_sw_dev_pos_id UUID;
  v_hr_spec_pos_id UUID;
  v_acct_pos_id UUID;
  v_sales_pos_id UUID;
  v_cs_pos_id UUID;

  v_junior_grade_id UUID;
  v_mid_grade_id UUID;
  v_senior_grade_id UUID;
  v_lead_grade_id UUID;

  v_tmpl_id UUID;
  v_crit_id UUID;
BEGIN
  -- 1. Resolve Department IDs (fallback to first department if specific not found)
  SELECT id INTO v_eng_dept_id FROM public.departments WHERE lower(name_en) LIKE '%engineer%' OR lower(name_en) LIKE '%technical%' LIMIT 1;
  SELECT id INTO v_it_dept_id FROM public.departments WHERE lower(name_en) LIKE '%it%' OR lower(name_en) LIKE '%information%' OR lower(name_en) LIKE '%software%' LIMIT 1;
  SELECT id INTO v_hr_dept_id FROM public.departments WHERE lower(name_en) LIKE '%hr%' OR lower(name_en) LIKE '%human%' LIMIT 1;
  SELECT id INTO v_fin_dept_id FROM public.departments WHERE lower(name_en) LIKE '%finan%' OR lower(name_en) LIKE '%account%' LIMIT 1;
  SELECT id INTO v_sales_dept_id FROM public.departments WHERE lower(name_en) LIKE '%sale%' OR lower(name_en) LIKE '%commercial%' LIMIT 1;
  SELECT id INTO v_crm_dept_id FROM public.departments WHERE lower(name_en) LIKE '%crm%' OR lower(name_en) LIKE '%customer%' LIMIT 1;

  -- 2. Resolve Position IDs
  SELECT id INTO v_site_eng_pos_id FROM public.positions WHERE lower(name_en) LIKE '%site%' OR lower(name_en) LIKE '%engineer%' LIMIT 1;
  SELECT id INTO v_sr_eng_pos_id FROM public.positions WHERE lower(name_en) LIKE '%senior%' AND lower(name_en) LIKE '%engineer%' LIMIT 1;
  SELECT id INTO v_sw_dev_pos_id FROM public.positions WHERE lower(name_en) LIKE '%software%' OR lower(name_en) LIKE '%developer%' LIMIT 1;
  SELECT id INTO v_hr_spec_pos_id FROM public.positions WHERE lower(name_en) LIKE '%hr%' LIMIT 1;
  SELECT id INTO v_acct_pos_id FROM public.positions WHERE lower(name_en) LIKE '%account%' LIMIT 1;
  SELECT id INTO v_sales_pos_id FROM public.positions WHERE lower(name_en) LIKE '%sale%' LIMIT 1;
  SELECT id INTO v_cs_pos_id FROM public.positions WHERE lower(name_en) LIKE '%customer%' OR lower(name_en) LIKE '%support%' LIMIT 1;

  -- 3. Resolve Job Grade IDs
  SELECT id INTO v_junior_grade_id FROM public.job_grades WHERE lower(name_en) LIKE '%junior%' OR lower(name_en) LIKE '%g02%' LIMIT 1;
  SELECT id INTO v_mid_grade_id FROM public.job_grades WHERE lower(name_en) LIKE '%officer%' OR lower(name_en) LIKE '%g03%' LIMIT 1;
  SELECT id INTO v_senior_grade_id FROM public.job_grades WHERE lower(name_en) LIKE '%senior%' OR lower(name_en) LIKE '%g04%' LIMIT 1;
  SELECT id INTO v_lead_grade_id FROM public.job_grades WHERE lower(name_en) LIKE '%leader%' OR lower(name_en) LIKE '%g07%' LIMIT 1;

  -- ─── HELPER TO UPSERT CRITERION ─────────────────────────────────────────────
  -- Ensure key criteria exist

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEMPLATE 1: ELV / Light Current Site Engineer (Junior & Mid)
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.kpi_templates WHERE name_en = 'Light Current Site Engineer Evaluation') THEN
    INSERT INTO public.kpi_templates (
      name_en, name_ar, description, department_id, position_id, job_grade_id,
      version, status, common_weight_pct, position_weight_pct, is_active, effective_year
    ) VALUES (
      'Light Current Site Engineer Evaluation',
      'تقييم أداء مهندس موقع تيار خفيف (مبتدئ / متوسط)',
      'Standard technical and behavioral evaluation for field ELV site engineers.',
      v_eng_dept_id, v_site_eng_pos_id, v_junior_grade_id,
      1, 'published', 40, 60, true, 2026
    ) RETURNING id INTO v_tmpl_id;

    -- Add Items (Total = 100%)
    -- Item 1: Attendance & Punctuality (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 95, 'higher_is_better', '%', 1 FROM public.kpi_criteria WHERE name_en ILIKE '%Attendance%' LIMIT 1;

    -- Item 2: Site Safety & PPE Compliance (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 100, 'higher_is_better', '%', 2 FROM public.kpi_criteria WHERE name_en ILIKE '%Safety%' LIMIT 1;

    -- Item 3: Teamwork & Site Collaboration (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 90, 'higher_is_better', '%', 3 FROM public.kpi_criteria WHERE name_en ILIKE '%Teamwork%' LIMIT 1;

    -- Item 4: Policy & Reporting Quality (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 95, 'higher_is_better', '%', 4 FROM public.kpi_criteria WHERE name_en ILIKE '%Reporting%' OR name_en ILIKE '%Policy%' LIMIT 1;

    -- Item 5: On-Time Installation Completion (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 90, 'higher_is_better', '%', 5 FROM public.kpi_criteria WHERE name_en ILIKE '%Installation%' LIMIT 1;

    -- Item 6: Shop Drawing Execution Compliance (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 95, 'higher_is_better', '%', 6 FROM public.kpi_criteria WHERE name_en ILIKE '%Shop Drawing%' LIMIT 1;

    -- Item 7: System Commissioning & Programming Accuracy (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 90, 'higher_is_better', '%', 7 FROM public.kpi_criteria WHERE name_en ILIKE '%Commissioning%' LIMIT 1;

    -- Item 8: Troubleshooting & Issue Resolution (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 90, 'higher_is_better', '%', 8 FROM public.kpi_criteria WHERE name_en ILIKE '%Troubleshooting%' LIMIT 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEMPLATE 2: Software Engineer & Full Stack Developer
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.kpi_templates WHERE name_en = 'Software Engineer & Full Stack Developer Evaluation') THEN
    -- Ensure SW criteria exist
    INSERT INTO public.kpi_criteria (name_en, name_ar, description_en, description_ar, criterion_type, category, scoring_scale, scoring_direction, unit, default_weight, is_required)
    VALUES
      ('Code Quality & Automated Test Coverage', 'جودة الكود البرمجي ونسبة تغطية الاختبارات الآلية', 'Writing maintainable, clean code with unit and integration test coverage.', 'كتابة شفرة برمجية نقية وموثوقة مع تغطية اختبارات آلية كافية.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.20, true),
      ('Sprint Velocity & On-Time Story Delivery', 'سرعة الإنجاز والالتزام بمواعيد تسليم مهام السبرنت', 'Delivering committed user stories within the planned sprint cycle.', 'إنجاز وتسليم مهام السبرنت الملتزم بها وفق الجدول الزمني.', 'position_specific', 'productivity', 'percentage', 'higher_is_better', '%', 0.20, true),
      ('Production Defect & Bug Escape Rate', 'معدل الأخطاء البرمجية المتسربة للإنتاج', 'Minimizing severe bugs and regressions reaching production environments.', 'تقليل العيوب البرمجية التي تظهر في بيئة الإنتاج الحية.', 'position_specific', 'quality', 'count', 'lower_is_better', 'count', 0.15, true),
      ('API Latency & System Performance SLA', 'كفاءة وسرعة استجابة واجهات الأنظمة (APIs)', 'Maintaining system response times below target SLAs and optimizing queries.', 'الحفاظ على سرعة استجابة الخوادم واستعلامات قواعد البيانات.', 'position_specific', 'technical', 'percentage', 'higher_is_better', '%', 0.15, true),
      ('Code Review & Team Knowledge Sharing', 'مراجعة الأكواد ومشاركة المعرفة التقنية', 'Constructive PR reviews, mentoring peers, and thorough technical documentation.', 'تقديم مراجعات دقيقة لأكواد الزملاء وتوثيق الحلول المعمارية.', 'position_specific', 'behavioral', 'rating_5', 'rating_5', 'scale', 0.10, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kpi_templates (
      name_en, name_ar, description, department_id, position_id, job_grade_id,
      version, status, common_weight_pct, position_weight_pct, is_active, effective_year
    ) VALUES (
      'Software Engineer & Full Stack Developer Evaluation',
      'تقييم أداء مهندس برمجيات ومطور تطبيقات',
      'Performance evaluation framework for frontend, backend, and full-stack software engineers.',
      v_it_dept_id, v_sw_dev_pos_id, v_senior_grade_id,
      1, 'published', 40, 60, true, 2026
    ) RETURNING id INTO v_tmpl_id;

    -- Items (Total = 100%)
    -- 1. Attendance & Sprint Punctuality (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 95, 'higher_is_better', '%', 1 FROM public.kpi_criteria WHERE name_en ILIKE '%Attendance%' LIMIT 1;

    -- 2. Teamwork & Cross-functional Collaboration (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 90, 'higher_is_better', '%', 2 FROM public.kpi_criteria WHERE name_en ILIKE '%Teamwork%' LIMIT 1;

    -- 3. Code Quality & Automated Test Coverage (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 85, 'higher_is_better', '%', 3 FROM public.kpi_criteria WHERE name_en ILIKE '%Code Quality%' LIMIT 1;

    -- 4. Sprint Velocity & On-Time Story Delivery (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 90, 'higher_is_better', '%', 4 FROM public.kpi_criteria WHERE name_en ILIKE '%Sprint Velocity%' LIMIT 1;

    -- 5. Production Defect Rate (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 2, 'lower_is_better', 'count', 5 FROM public.kpi_criteria WHERE name_en ILIKE '%Production Defect%' LIMIT 1;

    -- 6. API Latency & Performance SLA (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 99, 'higher_is_better', '%', 6 FROM public.kpi_criteria WHERE name_en ILIKE '%API Latency%' LIMIT 1;

    -- 7. Code Review & Team Collaboration (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 4.5, 'rating_5', 'scale', 7 FROM public.kpi_criteria WHERE name_en ILIKE '%Code Review%' LIMIT 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEMPLATE 3: Human Resources (HR) Specialist
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.kpi_templates WHERE name_en = 'Human Resources Specialist Evaluation') THEN
    -- Ensure HR criteria exist
    INSERT INTO public.kpi_criteria (name_en, name_ar, description_en, description_ar, criterion_type, category, scoring_scale, scoring_direction, unit, default_weight, is_required)
    VALUES
      ('Recruitment Milestone & Time-to-Hire', 'سرعة إغلاق الشواغر الوظيفية والتوظيف', 'Fulfilling staffing requirements within standard hiring timelines.', 'استقطاب وتعيين الكفاءات المؤهلة في الفترات الزمنية المستهدفة.', 'position_specific', 'productivity', 'count', 'lower_is_better', 'days', 0.20, true),
      ('Payroll Processing Timeliness & Accuracy', 'دقة ومواعيد إعداد ومراجعة الرواتب', 'Error-free payroll adjustments, overtime, and deductions delivery.', 'إعداد مسيرات الرواتب والبدلات والخصومات بدقة 100% دون تأخير.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.20, true),
      ('Employee Grievance & Issue Resolution Rate', 'نسبة وسرعة معالجة استفسارات وشكاوى الموظفين', 'Prompt, fair resolution of staff inquiries, requests, and conflicts.', 'سرعة الاستجابة لطلبات وشكاوى العاملين وفق اللوائح المعتمدة.', 'position_specific', 'behavioral', 'percentage', 'higher_is_better', '%', 0.15, true),
      ('Onboarding Experience & Retention Rate', 'جودة برنامج التهيئة واستقرار الموظفين الجدد', 'Effective new hire onboarding experience and 90-day retention.', 'تنفيذ خطة تهيئة الموظفين الجدد وقياس رضاهم واستقرارهم الوظيفي.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.15, true),
      ('Personnel Records & Labor Law Compliance', 'الامتثال لقانون العمل ودقة ملفات الموظفين', '100% completeness of insurance, labor documents, and contracts.', 'استيفاء المستندات القانونية والتأمينات وملفات العاملين دون مخالفات.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.10, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kpi_templates (
      name_en, name_ar, description, department_id, position_id, job_grade_id,
      version, status, common_weight_pct, position_weight_pct, is_active, effective_year
    ) VALUES (
      'Human Resources Specialist Evaluation',
      'تقييم أداء أخصائي الموارد البشرية والعمليات',
      'Key performance indicators for HR generalists, recruitment, and payroll officers.',
      v_hr_dept_id, v_hr_spec_pos_id, v_mid_grade_id,
      1, 'published', 40, 60, true, 2026
    ) RETURNING id INTO v_tmpl_id;

    -- Items (Total = 100%)
    -- 1. Attendance & Punctuality (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 98, 'higher_is_better', '%', 1 FROM public.kpi_criteria WHERE name_en ILIKE '%Attendance%' LIMIT 1;

    -- 2. Teamwork & Professional Conduct (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 95, 'higher_is_better', '%', 2 FROM public.kpi_criteria WHERE name_en ILIKE '%Teamwork%' LIMIT 1;

    -- 3. Recruitment & Time-to-Hire (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 25, 'lower_is_better', 'days', 3 FROM public.kpi_criteria WHERE name_en ILIKE '%Recruitment%' LIMIT 1;

    -- 4. Payroll Timeliness & Accuracy (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 100, 'higher_is_better', '%', 4 FROM public.kpi_criteria WHERE name_en ILIKE '%Payroll%' LIMIT 1;

    -- 5. Grievance & Issue Resolution (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 90, 'higher_is_better', '%', 5 FROM public.kpi_criteria WHERE name_en ILIKE '%Grievance%' LIMIT 1;

    -- 6. Onboarding & Retention (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 90, 'higher_is_better', '%', 6 FROM public.kpi_criteria WHERE name_en ILIKE '%Onboarding%' LIMIT 1;

    -- 7. Personnel Records Compliance (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 100, 'higher_is_better', '%', 7 FROM public.kpi_criteria WHERE name_en ILIKE '%Personnel Records%' LIMIT 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEMPLATE 4: Financial Accountant
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.kpi_templates WHERE name_en = 'Financial Accountant Evaluation') THEN
    -- Ensure Finance criteria exist
    INSERT INTO public.kpi_criteria (name_en, name_ar, description_en, description_ar, criterion_type, category, scoring_scale, scoring_direction, unit, default_weight, is_required)
    VALUES
      ('Monthly Financial Closing Timeliness', 'الالتزام بمواعيد الإقفال المالي الشهري', 'Delivering trial balance and closing entries on or before the 5th of each month.', 'إتمام قيود الإقفال وميزان المراجعة قبل الموعد المحدد شهرياً.', 'position_specific', 'productivity', 'percentage', 'higher_is_better', '%', 0.20, true),
      ('Accounts Payable & Invoice Verification Accuracy', 'دقة مراجعة فواتير الموردين والمصروفات', 'Zero errors in tax calculations, cost center allocations, and supporting vouchers.', 'صحة توجيه الفواتير لمراكز التكلفة وحسابات الضرائب بدقة.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.20, true),
      ('Bank & Ledger Reconciliation Variance', 'نسبة الفروقات في مطابقات البنوك والحسابات', 'Maintaining unresolved variances below acceptable thresholds.', 'مطابقة كشوف حسابات البنوك مع القيود المحاسبية وتسوية أي فروقات فوراً.', 'position_specific', 'quality', 'percentage', 'lower_is_better', '%', 0.15, true),
      ('Accounts Receivable & Collection Follow-up', 'متابعة التحصيلات ومستحقات الشركة', 'Active aging report tracking and timely collection of client receivables.', 'متابعة أعمار الديون وتحصيل مستحقات الشركة لدى العملاء في المواعيد.', 'position_specific', 'productivity', 'percentage', 'higher_is_better', '%', 0.15, true),
      ('Tax & Statutory Filing Compliance', 'الالتزام بتقديم الإقرارات الضريبية والتأمينات', 'On-time accurate filing of VAT, withholding tax, and social security payments.', 'تقديم إقرارات ضريبة القيمة المضافة وضرائب الخصم والتأمينات بلا غرامات.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.10, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kpi_templates (
      name_en, name_ar, description, department_id, position_id, job_grade_id,
      version, status, common_weight_pct, position_weight_pct, is_active, effective_year
    ) VALUES (
      'Financial Accountant Evaluation',
      'تقييم أداء المحاسب المالي',
      'Evaluation metrics covering ledger accounting, financial closings, and reconciliations.',
      v_fin_dept_id, v_acct_pos_id, v_mid_grade_id,
      1, 'published', 40, 60, true, 2026
    ) RETURNING id INTO v_tmpl_id;

    -- Items (Total = 100%)
    -- 1. Attendance & Punctuality (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 98, 'higher_is_better', '%', 1 FROM public.kpi_criteria WHERE name_en ILIKE '%Attendance%' LIMIT 1;

    -- 2. Teamwork & Communication (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 90, 'higher_is_better', '%', 2 FROM public.kpi_criteria WHERE name_en ILIKE '%Teamwork%' LIMIT 1;

    -- 3. Monthly Financial Closing (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 95, 'higher_is_better', '%', 3 FROM public.kpi_criteria WHERE name_en ILIKE '%Monthly Financial Closing%' LIMIT 1;

    -- 4. Accounts Payable & Invoices (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 98, 'higher_is_better', '%', 4 FROM public.kpi_criteria WHERE name_en ILIKE '%Accounts Payable%' LIMIT 1;

    -- 5. Bank Reconciliation (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 1, 'lower_is_better', '%', 5 FROM public.kpi_criteria WHERE name_en ILIKE '%Bank & Ledger%' LIMIT 1;

    -- 6. Collection Follow-up (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 90, 'higher_is_better', '%', 6 FROM public.kpi_criteria WHERE name_en ILIKE '%Accounts Receivable%' LIMIT 1;

    -- 7. Tax & Statutory Compliance (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 100, 'higher_is_better', '%', 7 FROM public.kpi_criteria WHERE name_en ILIKE '%Tax & Statutory%' LIMIT 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEMPLATE 5: Sales Specialist & Account Executive
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.kpi_templates WHERE name_en = 'Sales Specialist & Account Executive Evaluation') THEN
    -- Ensure Sales criteria exist
    INSERT INTO public.kpi_criteria (name_en, name_ar, description_en, description_ar, criterion_type, category, scoring_scale, scoring_direction, unit, default_weight, is_required)
    VALUES
      ('Quarterly Sales Quota Achievement', 'تحقيق المستهدف البيعي والمالي الربع سنوي', 'Percentage attainment of assigned quarterly revenue quota.', 'نسبة تحقيق مبيعات العقود والخدمات من المستهدف البيعي المحدد.', 'position_specific', 'productivity', 'percentage', 'higher_is_better', '%', 0.30, true),
      ('Opportunity Pipeline Conversion Velocity', 'معدل تحويل الفرص البيعية لصفقات مغلقة', 'Conversion rate from qualified leads into signed commercial contracts.', 'نسبة تحويل العملاء المحتملين إلى عقود تجارية ومشاريع معتمدة.', 'position_specific', 'productivity', 'percentage', 'higher_is_better', '%', 0.15, true),
      ('Client Retention & Contract Renewal Rate', 'الحفاظ على العملاء وتجديد العقود القائمة', 'Sustaining high renewal rates and preventing client churn.', 'تجديد عقود الصيانة والخدمات والحفاظ على استمرارية العملاء.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.15, true),
      ('CRM Pipeline Hygiene & Activity Logging', 'تحديث وتسجيل الأنشطة في نظام الـ CRM', 'Accurate, timely logging of customer calls, site visits, and proposal stages.', 'تسجيل وتحديث بيانات الزيارات والعروض بدقة في نظام إدارة العملاء.', 'position_specific', 'quality', 'percentage', 'higher_is_better', '%', 0.10, true),
      ('Commercial Proposal Turnaround Time', 'سرعة إعداد وتقديم العروض الفنية والمالية', 'Average days taken to deliver approved customer proposals.', 'الفترة الزمنية المستغرقة لإرسال العرض المالي والفني للعميل.', 'position_specific', 'productivity', 'count', 'lower_is_better', 'days', 0.10, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kpi_templates (
      name_en, name_ar, description, department_id, position_id, job_grade_id,
      version, status, common_weight_pct, position_weight_pct, is_active, effective_year
    ) VALUES (
      'Sales Specialist & Account Executive Evaluation',
      'تقييم أداء أخصائي المبيعات وإدارة الحسابات',
      'Target-driven KPI framework evaluating revenue quota, conversion velocity, and client retention.',
      v_sales_dept_id, v_sales_pos_id, v_senior_grade_id,
      1, 'published', 40, 60, true, 2026
    ) RETURNING id INTO v_tmpl_id;

    -- Items (Total = 100%)
    -- 1. Attendance & Punctuality (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 95, 'higher_is_better', '%', 1 FROM public.kpi_criteria WHERE name_en ILIKE '%Attendance%' LIMIT 1;

    -- 2. Communication & Professional Negotiation (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 90, 'higher_is_better', '%', 2 FROM public.kpi_criteria WHERE name_en ILIKE '%Communication%' OR name_en ILIKE '%Teamwork%' LIMIT 1;

    -- 3. Quarterly Sales Quota (30%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.30, 100, 'higher_is_better', '%', 3 FROM public.kpi_criteria WHERE name_en ILIKE '%Quarterly Sales Quota%' LIMIT 1;

    -- 4. Pipeline Conversion (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 25, 'higher_is_better', '%', 4 FROM public.kpi_criteria WHERE name_en ILIKE '%Opportunity Pipeline Conversion%' LIMIT 1;

    -- 5. Client Retention & Renewal (15%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.15, 90, 'higher_is_better', '%', 5 FROM public.kpi_criteria WHERE name_en ILIKE '%Client Retention%' LIMIT 1;

    -- 6. CRM Hygiene (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 95, 'higher_is_better', '%', 6 FROM public.kpi_criteria WHERE name_en ILIKE '%CRM Pipeline Hygiene%' LIMIT 1;

    -- 7. Proposal Turnaround Time (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 2, 'lower_is_better', 'days', 7 FROM public.kpi_criteria WHERE name_en ILIKE '%Proposal Turnaround%' LIMIT 1;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TEMPLATE 6: Customer Service & CRM Support Specialist
  -- ═══════════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.kpi_templates WHERE name_en = 'Customer Service & CRM Specialist Evaluation') THEN
    -- Ensure CS criteria exist
    INSERT INTO public.kpi_criteria (name_en, name_ar, description_en, description_ar, criterion_type, category, scoring_scale, scoring_direction, unit, default_weight, is_required)
    VALUES
      ('First Response Time (FRT) SLA', 'سرعة الرد الأولي على استفسارات العملاء', 'Achieving first response within the targeted minutes threshold.', 'الاستجابة لطلب العميل الأولي خلال الزمن المستهدف بالدقائق.', 'position_specific', 'productivity', 'count', 'lower_is_better', 'minutes', 0.20, true),
      ('Customer Support Ticket Resolution SLA', 'نسبة إغلاق التذاكر الفنية في الوقت المحدد', 'Resolving and closing client service tickets within committed SLA windows.', 'حل وإغلاق بلاغات وتذاكر الدعم الفني ضمن مستويات الخدمة المعتمدة.', 'position_specific', 'productivity', 'percentage', 'higher_is_better', '%', 0.20, true),
      ('Customer Satisfaction Rating (CSAT)', 'مؤشر رضا العملاء عن جودة الخدمة (CSAT)', 'Direct customer rating score received following ticket resolution.', 'التقييم المباشر لجودة الخدمة المقدمة من واقع استبيانات العملاء.', 'position_specific', 'quality', 'rating_5', 'rating_5', 'scale', 0.20, true),
      ('Support Ticket Reopen Rate', 'نسبة إعادة فتح التذاكر المغلقة', 'Minimizing recurring complaints and tickets reopened by dissatisfied clients.', 'تقليل التذاكر التي يعيد العميل فتحها نتيجة عدم اكتمال الحل الأول.', 'position_specific', 'quality', 'percentage', 'lower_is_better', '%', 0.10, true),
      ('Help Center Knowledge Base Contribution', 'المساهمة في بناء وتحديث قاعدة المعرفة', 'Documenting resolved issues and creating customer self-help articles.', 'كتابة وتوثيق حلول المشكلات في قاعدة المعرفة التقنية للشركة.', 'position_specific', 'technical', 'count', 'higher_is_better', 'count', 0.10, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.kpi_templates (
      name_en, name_ar, description, department_id, position_id, job_grade_id,
      version, status, common_weight_pct, position_weight_pct, is_active, effective_year
    ) VALUES (
      'Customer Service & CRM Specialist Evaluation',
      'تقييم أداء أخصائي خدمة العملاء والدعم الفني',
      'Customer-centric performance framework focusing on SLA resolution, CSAT scores, and first response speed.',
      v_crm_dept_id, v_cs_pos_id, v_junior_grade_id,
      1, 'published', 40, 60, true, 2026
    ) RETURNING id INTO v_tmpl_id;

    -- Items (Total = 100%)
    -- 1. Attendance & Shift Punctuality (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 98, 'higher_is_better', '%', 1 FROM public.kpi_criteria WHERE name_en ILIKE '%Attendance%' LIMIT 1;

    -- 2. Teamwork & Call Etiquette (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 95, 'higher_is_better', '%', 2 FROM public.kpi_criteria WHERE name_en ILIKE '%Teamwork%' LIMIT 1;

    -- 3. First Response Time SLA (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 15, 'lower_is_better', 'minutes', 3 FROM public.kpi_criteria WHERE name_en ILIKE '%First Response Time%' LIMIT 1;

    -- 4. Ticket Resolution SLA (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 95, 'higher_is_better', '%', 4 FROM public.kpi_criteria WHERE name_en ILIKE '%Ticket Resolution SLA%' LIMIT 1;

    -- 5. Customer Satisfaction Rating (20%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.20, 4.5, 'rating_5', 'scale', 5 FROM public.kpi_criteria WHERE name_en ILIKE '%Customer Satisfaction%' LIMIT 1;

    -- 6. Ticket Reopen Rate (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 5, 'lower_is_better', '%', 6 FROM public.kpi_criteria WHERE name_en ILIKE '%Ticket Reopen Rate%' LIMIT 1;

    -- 7. Knowledge Base Contribution (10%)
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, scoring_direction, unit, display_order)
    SELECT v_tmpl_id, id, 0.10, 5, 'higher_is_better', 'count', 7 FROM public.kpi_criteria WHERE name_en ILIKE '%Knowledge Base%' LIMIT 1;
  END IF;

END $$;

