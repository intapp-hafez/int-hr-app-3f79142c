-- Seed 20 Default Corporate KPI Definitions & Core Template
DO $$
DECLARE
  v_template_id uuid;
  v_crit_id uuid;
BEGIN
  -- 1. Ensure the Core Corporate KPI Definitions template exists
  SELECT id INTO v_template_id
  FROM public.kpi_templates
  WHERE name_en = 'Core Corporate KPI Definitions (20 Core Metrics)'
  LIMIT 1;

  IF v_template_id IS NULL THEN
    INSERT INTO public.kpi_templates (
      name_en,
      name_ar,
      status,
      version,
      common_weight_pct,
      position_weight_pct,
      is_active
    ) VALUES (
      'Core Corporate KPI Definitions (20 Core Metrics)',
      'دليل مؤشرات الأداء الوظيفية الأساسية للشركة (20 مؤشراً)',
      'published',
      1,
      40,
      60,
      true
    )
    RETURNING id INTO v_template_id;
  END IF;

  -- 2. Define and Link 20 Core KPIs (Idempotent: insert if missing, update if existing)

  -- 1) Attendance & Punctuality
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Attendance & Punctuality' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Attendance & Punctuality', 'الانضباط والالتزام بساعات العمل', 'common', 'behavioral',
            'Adherence to official site and office working hours, timely check-ins, and shift schedule compliance without unapproved absenteeism.',
            'الالتزام التام بساعات العمل الرسمية وتسجيل الحضور والانصراف في المواعيد المحددة وعدم الغياب دون إذن مسبق.',
            'Measured in %: (Actual days attended on time / Scheduled work days) * 100 via biometric attendance records.',
            'يقاس بالنسبة المئوية: (أيام الحضور في الموعد / إجمالي أيام العمل المجدولة) * 100 عبر سجلات البصمة.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'الانضباط والالتزام بساعات العمل', criterion_type = 'common', category = 'behavioral',
        description_en = 'Adherence to official site and office working hours, timely check-ins, and shift schedule compliance without unapproved absenteeism.',
        description_ar = 'الالتزام التام بساعات العمل الرسمية وتسجيل الحضور والانصراف في المواعيد المحددة وعدم الغياب دون إذن مسبق.',
        how_measured_en = 'Measured in %: (Actual days attended on time / Scheduled work days) * 100 via biometric attendance records.',
        how_measured_ar = 'يقاس بالنسبة المئوية: (أيام الحضور في الموعد / إجمالي أيام العمل المجدولة) * 100 عبر سجلات البصمة.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 1, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 1;

  -- 2) Teamwork & Cross-functional Collaboration
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Teamwork & Cross-functional Collaboration' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Teamwork & Cross-functional Collaboration', 'العمل الجماعي والتعاون المشترك', 'common', 'behavioral',
            'Active support to peers, constructive cross-departmental cooperation, knowledge sharing, and maintaining a positive work atmosphere.',
            'التعاون الفعال مع الزملاء ومشاركة المعرفة والعمل بروح الفريق الواحد لدعم إنجاز المهام المشتركة بين الإدارات.',
            'Measured in %: Quarterly supervisor and peer rubric evaluation converted to percentage.',
            'يقاس بالنسبة المئوية بناءً على التقييم الربعي للإشراف والتعاون الجماعي.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'العمل الجماعي والتعاون المشترك', criterion_type = 'common', category = 'behavioral',
        description_en = 'Active support to peers, constructive cross-departmental cooperation, knowledge sharing, and maintaining a positive work atmosphere.',
        description_ar = 'التعاون الفعال مع الزملاء ومشاركة المعرفة والعمل بروح الفريق الواحد لدعم إنجاز المهام المشتركة بين الإدارات.',
        how_measured_en = 'Measured in %: Quarterly supervisor and peer rubric evaluation converted to percentage.',
        how_measured_ar = 'يقاس بالنسبة المئوية بناءً على التقييم الربعي للإشراف والتعاون الجماعي.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 2, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 2;

  -- 3) Professional Communication & Reporting
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Professional Communication & Reporting' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Professional Communication & Reporting', 'التواصل المهني ودقة التقارير', 'common', 'behavioral',
            'Delivering clear, timely, and structured verbal and written communication with clients, managers, and external partners.',
            'التواصل المهني الواضح ورفع التقارير الدورية في مواعيدها ومتابعة التعليمات بدقة عالية.',
            'Measured in %: Timeliness and accuracy rate of submitted periodic operational reports.',
            'يقاس بنسبة الالتزام بمواعيد تسليم التقارير وجودة الصياغة وخلوها من الأخطاء.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'التواصل المهني ودقة التقارير', criterion_type = 'common', category = 'behavioral',
        description_en = 'Delivering clear, timely, and structured verbal and written communication with clients, managers, and external partners.',
        description_ar = 'التواصل المهني الواضح ورفع التقارير الدورية في مواعيدها ومتابعة التعليمات بدقة عالية.',
        how_measured_en = 'Measured in %: Timeliness and accuracy rate of submitted periodic operational reports.',
        how_measured_ar = 'يقاس بنسبة الالتزام بمواعيد تسليم التقارير وجودة الصياغة وخلوها من الأخطاء.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 3, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 3;

  -- 4) On-Time Task & Project Delivery
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'On-Time Task & Project Delivery' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('On-Time Task & Project Delivery', 'تسليم المهام والمشاريع في الموعد المحدد', 'common', 'technical',
            'Completion of scheduled project milestones, sprint deliverables, and daily work orders within established timelines.',
            'إنجاز المهام المسندة والمراحل التنفيذية للمشاريع في التواريخ المتفق عليها دون تأخير غير مبرر.',
            'Measured in %: (Tasks completed on or before deadline / Total assigned tasks) * 100.',
            'يقاس بالنسبة المئوية: (المهام المنجزة في الموعد / إجمالي المهام المسندة) * 100.',
            '%', 0.10, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'تسليم المهام والمشاريع في الموعد المحدد', criterion_type = 'common', category = 'technical',
        description_en = 'Completion of scheduled project milestones, sprint deliverables, and daily work orders within established timelines.',
        description_ar = 'إنجاز المهام المسندة والمراحل التنفيذية للمشاريع في التواريخ المتفق عليها دون تأخير غير مبرر.',
        how_measured_en = 'Measured in %: (Tasks completed on or before deadline / Total assigned tasks) * 100.',
        how_measured_ar = 'يقاس بالنسبة المئوية: (المهام المنجزة في الموعد / إجمالي المهام المسندة) * 100.',
        unit = '%', default_weight = 0.10, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.10, 95, 4, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.10, target_benchmark = 95, display_order = 4;

  -- 5) Work Quality & First-Time Accuracy
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Work Quality & First-Time Accuracy' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Work Quality & First-Time Accuracy', 'جودة العمل والدقة من المرة الأولى', 'common', 'quality',
            'Delivering error-free outputs, reports, or deliverables that meet technical specifications without rework or client rejection.',
            'تقديم مخرجات وتقارير خالية من الأخطاء ومطابقة للمواصفات الفنية دون الحاجة لإعادة العمل أو تعديلات جوهرية.',
            'Measured in %: 100 - ((Reworked tasks / Total completed tasks) * 100).',
            'يقاس بالنسبة المئوية: 100 - ((المهام المعاد تنفيذها / إجمالي المهام المنجزة) * 100).',
            '%', 0.10, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'جودة العمل والدقة من المرة الأولى', criterion_type = 'common', category = 'quality',
        description_en = 'Delivering error-free outputs, reports, or deliverables that meet technical specifications without rework or client rejection.',
        description_ar = 'تقديم مخرجات وتقارير خالية من الأخطاء ومطابقة للمواصفات الفنية دون الحاجة لإعادة العمل أو تعديلات جوهرية.',
        how_measured_en = 'Measured in %: 100 - ((Reworked tasks / Total completed tasks) * 100).',
        how_measured_ar = 'يقاس بالنسبة المئوية: 100 - ((المهام المعاد تنفيذها / إجمالي المهام المنجزة) * 100).',
        unit = '%', default_weight = 0.10, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.10, 98, 5, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.10, target_benchmark = 98, display_order = 5;

  -- 6) Problem Solving & Root Cause Resolution
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Problem Solving & Root Cause Resolution' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Problem Solving & Root Cause Resolution', 'حل المشكلات ومعالجة الأسباب الجذرية', 'common', 'technical',
            'Identifying operational bottlenecks, diagnosing technical root causes, and applying lasting corrective and preventive solutions.',
            'القدرة على تشخيص الأعطال وتحديد أسباب المشكلات الجذرية وابتكار حلول جذرية تمنع تكرارها.',
            'Measured in %: (Incidents resolved within SLA / Total assigned incidents) * 100.',
            'يقاس بالنسبة المئوية: (المشكلات المعالجة بنجاح / إجمالي البلاغات) * 100.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'حل المشكلات ومعالجة الأسباب الجذرية', criterion_type = 'common', category = 'technical',
        description_en = 'Identifying operational bottlenecks, diagnosing technical root causes, and applying lasting corrective and preventive solutions.',
        description_ar = 'القدرة على تشخيص الأعطال وتحديد أسباب المشكلات الجذرية وابتكار حلول جذرية تمنع تكرارها.',
        how_measured_en = 'Measured in %: (Incidents resolved within SLA / Total assigned incidents) * 100.',
        how_measured_ar = 'يقاس بالنسبة المئوية: (المشكلات المعالجة بنجاح / إجمالي البلاغات) * 100.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 90, 6, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 90, display_order = 6;

  -- 7) Technical Competence & Standards Adherence
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Technical Competence & Standards Adherence' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Technical Competence & Standards Adherence', 'الكفاءة الفنية والالتزام بالمعايير', 'common', 'technical',
            'Applying specialized job-related technical knowledge and strictly complying with industry best practices and technical manuals.',
            'تطبيق المعرفة الفنية التخصصية بدقة والالتزام الصارم بالأدلة الإرشادية والمعايير المعتمدة.',
            'Measured in %: Quarterly technical supervisor review score based on standard skill matrix evaluation.',
            'يقاس بالنسبة المئوية عبر مصفوفة تقييم الكفاءة الفنية الدورية.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'الكفاءة الفنية والالتزام بالمعايير', criterion_type = 'common', category = 'technical',
        description_en = 'Applying specialized job-related technical knowledge and strictly complying with industry best practices and technical manuals.',
        description_ar = 'تطبيق المعرفة الفنية التخصصية بدقة والالتزام الصارم بالأدلة الإرشادية والمعايير المعتمدة.',
        how_measured_en = 'Measured in %: Quarterly technical supervisor review score based on standard skill matrix evaluation.',
        how_measured_ar = 'يقاس بالنسبة المئوية عبر مصفوفة تقييم الكفاءة الفنية الدورية.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 95, 7, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 95, display_order = 7;

  -- 8) Daily Output & Productivity Rate
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Daily Output & Productivity Rate' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Daily Output & Productivity Rate', 'معدل الإنتاجية والإنجاز اليومي', 'common', 'productivity',
            'Volume of approved deliverables or operational transactions processed relative to scheduled production quotas.',
            'حجم المخرجات المعتمدة أو المعاملات المنجزة مقارنة بالمستهدفات القياسية المحددة للوظيفة.',
            'Measured in %: (Actual completed units / Target benchmark units) * 100.',
            'يقاس بالنسبة المئوية: (الوحدات المنجزة فعلياً / المستهدف القياسي) * 100.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'معدل الإنتاجية والإنجاز اليومي', criterion_type = 'common', category = 'productivity',
        description_en = 'Volume of approved deliverables or operational transactions processed relative to scheduled production quotas.',
        description_ar = 'حجم المخرجات المعتمدة أو المعاملات المنجزة مقارنة بالمستهدفات القياسية المحددة للوظيفة.',
        how_measured_en = 'Measured in %: (Actual completed units / Target benchmark units) * 100.',
        how_measured_ar = 'يقاس بالنسبة المئوية: (الوحدات المنجزة فعلياً / المستهدف القياسي) * 100.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 8, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 8;

  -- 9) Process Optimization & Efficiency
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Process Optimization & Efficiency' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Process Optimization & Efficiency', 'تحسين وتطوير كفاءة العمليات', 'common', 'productivity',
            'Proactive efforts to reduce processing cycle times, eliminate manual redundancies, and streamline operational workflows.',
            'المبادرة إلى تقليص زمن إنجاز العمليات والقضاء على التكرار وتبسيط الإجراءات اليومية.',
            'Measured in %: Documented reduction in cycle time or verified process improvement milestones.',
            'يقاس بنسبة التحسن في زمن المعالجة وتقليص الإهدار الموثق.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'تحسين وتطوير كفاءة العمليات', criterion_type = 'common', category = 'productivity',
        description_en = 'Proactive efforts to reduce processing cycle times, eliminate manual redundancies, and streamline operational workflows.',
        description_ar = 'المبادرة إلى تقليص زمن إنجاز العمليات والقضاء على التكرار وتبسيط الإجراءات اليومية.',
        how_measured_en = 'Measured in %: Documented reduction in cycle time or verified process improvement milestones.',
        how_measured_ar = 'يقاس بنسبة التحسن في زمن المعالجة وتقليص الإهدار الموثق.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 90, 9, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 90, display_order = 9;

  -- 10) Resource & Budget Utilization
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Resource & Budget Utilization' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Resource & Budget Utilization', 'كفاءة إدارة الموارد والميزانية', 'common', 'productivity',
            'Prudent management of assigned budgets, consumables, equipment, and company assets without wasteful expenditure.',
            'الترشيد في استخدام الموارد المتاحة والميزانيات المخصصة وحماية أصول وممتلكات المنشأة.',
            'Measured in %: ((Allocated budget - Cost variance) / Allocated budget) * 100 within +/- 5% tolerance.',
            'يقاس بنسبة الالتزام بالميزانية المحددة وتجنب الهدر المالي.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'كفاءة إدارة الموارد والميزانية', criterion_type = 'common', category = 'productivity',
        description_en = 'Prudent management of assigned budgets, consumables, equipment, and company assets without wasteful expenditure.',
        description_ar = 'الترشيد في استخدام الموارد المتاحة والميزانيات المخصصة وحماية أصول وممتلكات المنشأة.',
        how_measured_en = 'Measured in %: ((Allocated budget - Cost variance) / Allocated budget) * 100 within +/- 5% tolerance.',
        how_measured_ar = 'يقاس بنسبة الالتزام بالميزانية المحددة وتجنب الهدر المالي.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 10, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 10;

  -- 11) Customer / Stakeholder Satisfaction
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Customer / Stakeholder Satisfaction' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Customer / Stakeholder Satisfaction', 'رضا العملاء والجهات المستفيدة', 'common', 'quality',
            'Satisfaction rating from internal departments, external clients, or stakeholders regarding service delivery and responsiveness.',
            'نسبة رضا العملاء الداخليين والخارجيين وأصحاب المصلحة عن جودة وسرعة تقديم الخدمات.',
            'Measured in %: Positive feedback score percentage from periodic customer/stakeholder surveys.',
            'يقاس بالنسبة المئوية عبر استطلاعات قياس رضا العملاء والمستفيدين.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'رضا العملاء والجهات المستفيدة', criterion_type = 'common', category = 'quality',
        description_en = 'Satisfaction rating from internal departments, external clients, or stakeholders regarding service delivery and responsiveness.',
        description_ar = 'نسبة رضا العملاء الداخليين والخارجيين وأصحاب المصلحة عن جودة وسرعة تقديم الخدمات.',
        how_measured_en = 'Measured in %: Positive feedback score percentage from periodic customer/stakeholder surveys.',
        how_measured_ar = 'يقاس بالنسبة المئوية عبر استطلاعات قياس رضا العملاء والمستفيدين.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 90, 11, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 90, display_order = 11;

  -- 12) Workplace Safety & Compliance
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Workplace Safety & Compliance' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Workplace Safety & Compliance', 'السلامة المهنية والامتثال للأنظمة', 'common', 'safety',
            'Compliance with environmental health, safety standards, PPE requirements, and statutory regulatory requirements.',
            'الالتزام الصارم بقواعد السلامة والصحة المهنية وارتداء معدات الوقاية والامتثال للأنظمة.',
            'Measured in %: Safety checklist compliance rate and zero recorded non-compliance incidents.',
            'يقاس بنسبة الالتزام بقوائم التحقق للسلامة وخلو السجل من أي مخالفات.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'السلامة المهنية والامتثال للأنظمة', criterion_type = 'common', category = 'safety',
        description_en = 'Compliance with environmental health, safety standards, PPE requirements, and statutory regulatory requirements.',
        description_ar = 'الالتزام الصارم بقواعد السلامة والصحة المهنية وارتداء معدات الوقاية والامتثال للأنظمة.',
        how_measured_en = 'Measured in %: Safety checklist compliance rate and zero recorded non-compliance incidents.',
        how_measured_ar = 'يقاس بنسبة الالتزام بقوائم التحقق للسلامة وخلو السجل من أي مخالفات.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 12, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 12;

  -- 13) Confidentiality & Data Security
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Confidentiality & Data Security' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Confidentiality & Data Security', 'السرية وأمن المعلومات والبيانات', 'common', 'safety',
            'Protecting proprietary company data, maintaining credential security, and preventing unauthorized information leaks.',
            'حماية خصوصية وسرية بيانات الشركة والعملاء والالتزام بضوابط الأمن السيبراني ومنع تسريب المعلومات.',
            'Measured in %: Compliance with information security controls and zero security audit infractions.',
            'يقاس بنسبة الالتزام بضوابط أمن المعلومات وخلو السجل من أي انتهاكات سرية.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'السرية وأمن المعلومات والبيانات', criterion_type = 'common', category = 'safety',
        description_en = 'Protecting proprietary company data, maintaining credential security, and preventing unauthorized information leaks.',
        description_ar = 'حماية خصوصية وسرية بيانات الشركة والعملاء والالتزام بضوابط الأمن السيبراني ومنع تسريب المعلومات.',
        how_measured_en = 'Measured in %: Compliance with information security controls and zero security audit infractions.',
        how_measured_ar = 'يقاس بنسبة الالتزام بضوابط أمن المعلومات وخلو السجل من أي انتهاكات سرية.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 13, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 13;

  -- 14) Initiative & Continuous Improvement
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Initiative & Continuous Improvement' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Initiative & Continuous Improvement', 'روح المبادرة والتطوير المستمر', 'common', 'behavioral',
            'Demonstrating self-directed initiative, proposing practical workflow enhancements, and executing value-adding ideas.',
            'تقديم مقترحات بناءة لتطوير بيئة العمل والمبادرة الذاتية لتحقيق قيمة مضافة للمنشأة.',
            'Measured in %: Number of approved improvement proposals or value-add contributions implemented.',
            'يقاس بنسبة المبادرات والمقترحات المطبقة بنجاح.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'روح المبادرة والتطوير المستمر', criterion_type = 'common', category = 'behavioral',
        description_en = 'Demonstrating self-directed initiative, proposing practical workflow enhancements, and executing value-adding ideas.',
        description_ar = 'تقديم مقترحات بناءة لتطوير بيئة العمل والمبادرة الذاتية لتحقيق قيمة مضافة للمنشأة.',
        how_measured_en = 'Measured in %: Number of approved improvement proposals or value-add contributions implemented.',
        how_measured_ar = 'يقاس بنسبة المبادرات والمقترحات المطبقة بنجاح.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 90, 14, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 90, display_order = 14;

  -- 15) Adaptability & Change Management
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Adaptability & Change Management' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Adaptability & Change Management', 'المرونة والتكيف مع التغييرات', 'common', 'behavioral',
            'Flexibility in responding to changing operational requirements, organizational transitions, and new technological platforms.',
            'المرونة في التعامل مع متطلبات العمل المتغيرة والتكيف السريع مع الأدوات والأنظمة والسياسات الجديدة.',
            'Measured in %: Managerial evaluation rubric score on response and resilience during organizational shifts.',
            'يقاس بدرجة تقييم المرونة وسرعة الاستجابة للمتغيرات الوظيفية.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'المرونة والتكيف مع التغييرات', criterion_type = 'common', category = 'behavioral',
        description_en = 'Flexibility in responding to changing operational requirements, organizational transitions, and new technological platforms.',
        description_ar = 'المرونة في التعامل مع متطلبات العمل المتغيرة والتكيف السريع مع الأدوات والأنظمة والسياسات الجديدة.',
        how_measured_en = 'Measured in %: Managerial evaluation rubric score on response and resilience during organizational shifts.',
        how_measured_ar = 'يقاس بدرجة تقييم المرونة وسرعة الاستجابة للمتغيرات الوظيفية.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 90, 15, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 90, display_order = 15;

  -- 16) Documentation & Knowledge Base Maintenance
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Documentation & Knowledge Base Maintenance' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Documentation & Knowledge Base Maintenance', 'التوثيق وتحديث قاعدة المعرفة', 'common', 'coordination',
            'Maintaining accurate, structured, and up-to-date documentation, operational manuals, and team knowledge assets.',
            'الحرص على توثيق إجراءات العمل وتحديث الأدلة التشغيلية ومشاركة المعرفة المؤسسية.',
            'Measured in %: Audit score of assigned documentation completeness and update frequency.',
            'يقاس بنسبة اكتمال وتحديث المستندات التشغيلية وفق المراجعات الدورية.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'التوثيق وتحديث قاعدة المعرفة', criterion_type = 'common', category = 'coordination',
        description_en = 'Maintaining accurate, structured, and up-to-date documentation, operational manuals, and team knowledge assets.',
        description_ar = 'الحرص على توثيق إجراءات العمل وتحديث الأدلة التشغيلية ومشاركة المعرفة المؤسسية.',
        how_measured_en = 'Measured in %: Audit score of assigned documentation completeness and update frequency.',
        how_measured_ar = 'يقاس بنسبة اكتمال وتحديث المستندات التشغيلية وفق المراجعات الدورية.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 95, 16, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 95, display_order = 16;

  -- 17) SLA & Response Time Compliance
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'SLA & Response Time Compliance' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('SLA & Response Time Compliance', 'الالتزام باتفاقيات مستوى الخدمة وسرعة الرد', 'common', 'productivity',
            'Speed and responsiveness in attending to internal tickets, customer inquiries, and escalation workflows within agreed SLA thresholds.',
            'السرعة والالتزام باتفاقيات مستوى الخدمة في الرد على التذاكر واستفسارات العملاء والطلبات الداخلية.',
            'Measured in %: (Requests responded to within SLA / Total assigned requests) * 100.',
            'يقاس بالنسبة المئوية: (الطلبات المنجزة ضمن وقت الاستجابة / إجمالي الطلبات) * 100.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'الالتزام باتفاقيات مستوى الخدمة وسرعة الرد', criterion_type = 'common', category = 'productivity',
        description_en = 'Speed and responsiveness in attending to internal tickets, customer inquiries, and escalation workflows within agreed SLA thresholds.',
        description_ar = 'السرعة والالتزام باتفاقيات مستوى الخدمة في الرد على التذاكر واستفسارات العملاء والطلبات الداخلية.',
        how_measured_en = 'Measured in %: (Requests responded to within SLA / Total assigned requests) * 100.',
        how_measured_ar = 'يقاس بالنسبة المئوية: (الطلبات المنجزة ضمن وقت الاستجابة / إجمالي الطلبات) * 100.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 95, 17, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 95, display_order = 17;

  -- 18) Equipment & Asset Care
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Equipment & Asset Care' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Equipment & Asset Care', 'سلامة وصيانة الأجهزة والمعدات', 'common', 'technical',
            'Proper handling, routine maintenance adherence, and preservation of assigned digital and physical machinery and devices.',
            'المحافظة على المعدات والأجهزة المسندة والالتزام بجداول الصيانة الدورية لمنع التلف والأعطال.',
            'Measured in %: Periodic asset condition audit score and compliance with scheduled maintenance.',
            'يقاس بنسبة المحافظة على سلامة الأجهزة والالتزام بجداول الفحص الدوري.',
            '%', 0.025, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'سلامة وصيانة الأجهزة والمعدات', criterion_type = 'common', category = 'technical',
        description_en = 'Proper handling, routine maintenance adherence, and preservation of assigned digital and physical machinery and devices.',
        description_ar = 'المحافظة على المعدات والأجهزة المسندة والالتزام بجداول الصيانة الدورية لمنع التلف والأعطال.',
        how_measured_en = 'Measured in %: Periodic asset condition audit score and compliance with scheduled maintenance.',
        how_measured_ar = 'يقاس بنسبة المحافظة على سلامة الأجهزة والالتزام بجداول الفحص الدوري.',
        unit = '%', default_weight = 0.025, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.025, 100, 18, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.025, target_benchmark = 100, display_order = 18;

  -- 19) Training & Professional Development
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Training & Professional Development' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Training & Professional Development', 'التدريب والتطوير المهني الذاتي', 'common', 'behavioral',
            'Completion of assigned internal/external training programs, certifications, and proactive skill enhancement.',
            'إتمام الدورات التدريبية المعتمدة والحصول على الشهادات المهنية وتطوير المهارات الوظيفية.',
            'Measured in %: (Completed training hours / Required training hours) * 100.',
            'يقاس بالنسبة المئوية: (ساعات التدريب المنجزة / الساعات المطلوبة سنوياً) * 100.',
            '%', 0.025, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'التدريب والتطوير المهني الذاتي', criterion_type = 'common', category = 'behavioral',
        description_en = 'Completion of assigned internal/external training programs, certifications, and proactive skill enhancement.',
        description_ar = 'إتمام الدورات التدريبية المعتمدة والحصول على الشهادات المهنية وتطوير المهارات الوظيفية.',
        how_measured_en = 'Measured in %: (Completed training hours / Required training hours) * 100.',
        how_measured_ar = 'يقاس بالنسبة المئوية: (ساعات التدريب المنجزة / الساعات المطلوبة سنوياً) * 100.',
        unit = '%', default_weight = 0.025, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.025, 100, 19, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.025, target_benchmark = 100, display_order = 19;

  -- 20) Audit & Policy Compliance
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Audit & Policy Compliance' LIMIT 1;
  IF v_crit_id IS NULL THEN
    INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
    VALUES ('Audit & Policy Compliance', 'الامتثال للسياسات وتدقيق الجودة', 'common', 'coordination',
            'Full adherence to internal corporate governance policies, company bylaws, and passing internal/external audit reviews.',
            'الالتزام باللوائح والسياسات الداخلية ومعايير الحوكمة واجتياز عمليات التدقيق الدوري بنجاح.',
            'Measured in %: Internal governance audit score (%) and zero policy violations.',
            'يقاس بنسبة الامتثال في تقارير التدقيق الداخلي وخلو السجل من المخالفات.',
            '%', 0.05, 'higher_is_better', true, true)
    RETURNING id INTO v_crit_id;
  ELSE
    UPDATE public.kpi_criteria
    SET name_ar = 'الامتثال للسياسات وتدقيق الجودة', criterion_type = 'common', category = 'coordination',
        description_en = 'Full adherence to internal corporate governance policies, company bylaws, and passing internal/external audit reviews.',
        description_ar = 'الالتزام باللوائح والسياسات الداخلية ومعايير الحوكمة واجتياز عمليات التدقيق الدوري بنجاح.',
        how_measured_en = 'Measured in %: Internal governance audit score (%) and zero policy violations.',
        how_measured_ar = 'يقاس بنسبة الامتثال في تقارير التدقيق الداخلي وخلو السجل من المخالفات.',
        unit = '%', default_weight = 0.05, scoring_direction = 'higher_is_better', is_active = true, is_required = true
    WHERE id = v_crit_id;
  END IF;
  INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
  VALUES (v_template_id, v_crit_id, 0.05, 100, 20, '%')
  ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 20;

END $$;
