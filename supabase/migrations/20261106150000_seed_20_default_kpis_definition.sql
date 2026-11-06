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

  -- 2. Define and Link 20 Core KPIs
  -- 1) Attendance & Punctuality
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Attendance & Punctuality', 'الانضباط والالتزام بساعات العمل', 'common', 'behavioral',
          'Adherence to official site and office working hours, timely check-ins, and shift schedule compliance without unapproved absenteeism.',
          'الالتزام التام بساعات العمل الرسمية وتسجيل الحضور والانصراف في المواعيد المحددة وعدم الغياب دون إذن مسبق.',
          'Measured in %: (Actual days attended on time / Scheduled work days) * 100 via biometric attendance records.',
          'يقاس بالنسبة المئوية: (أيام الحضور في الموعد / إجمالي أيام العمل المجدولة) * 100 عبر سجلات البصمة.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Attendance & Punctuality' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 1, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 1;
  END IF;

  -- 2) Teamwork & Cross-functional Collaboration
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Teamwork & Cross-functional Collaboration', 'العمل الجماعي والتعاون المشترك', 'common', 'behavioral',
          'Active support to peers, constructive cross-departmental cooperation, knowledge sharing, and maintaining a positive work atmosphere.',
          'التعاون الفعال مع الزملاء ومشاركة المعرفة والعمل بروح الفريق الواحد لدعم إنجاز المهام المشتركة بين الإدارات.',
          'Measured in %: Quarterly supervisor and peer rubric evaluation converted to percentage.',
          'يقاس بالنسبة المئوية بناءً على التقييم الربعي للإشراف والتعاون الجماعي.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Teamwork & Cross-functional Collaboration' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 2, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 2;
  END IF;

  -- 3) Professional Communication & Reporting
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Professional Communication & Reporting', 'التواصل المهني ودقة التقارير', 'common', 'behavioral',
          'Delivering clear, timely, and structured verbal and written communication with clients, managers, and external partners.',
          'التواصل المهني الواضح ورفع التقارير الدورية في مواعيدها ومتابعة التعليمات بدقة عالية.',
          'Measured in %: Timeliness and accuracy rate of submitted periodic operational reports.',
          'يقاس بنسبة الالتزام بمواعيد تسليم التقارير وجودة الصياغة وخلوها من الأخطاء.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Professional Communication & Reporting' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 3, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 3;
  END IF;

  -- 4) On-Time Task & Project Delivery
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('On-Time Task & Project Delivery', 'تسليم المهام والمشاريع في الموعد المحدد', 'common', 'technical',
          'Completion of scheduled project milestones, sprint deliverables, and daily work orders within established timelines.',
          'إنجاز المهام المسندة والمراحل التنفيذية للمشاريع في التواريخ المتفق عليها دون تأخير غير مبرر.',
          'Measured in %: (Tasks completed on or before deadline / Total assigned tasks) * 100.',
          'يقاس بالنسبة المئوية: (المهام المنجزة في الموعد / إجمالي المهام المسندة) * 100.',
          '%', 0.10, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'On-Time Task & Project Delivery' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.10, 95, 4, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.10, target_benchmark = 95, display_order = 4;
  END IF;

  -- 5) Work Quality & First-Time Accuracy
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Work Quality & First-Time Accuracy', 'جودة العمل والدقة من المرة الأولى', 'common', 'quality',
          'Delivering error-free outputs compliant with specifications, minimizing rework, defects, and client rejections.',
          'تقديم مخرجات دقيقة ومطابقة للمواصفات الفنية مع تقليل التعديلات والأخطاء وإعادة العمل لأدنى حد.',
          'Measured in %: (Deliverables approved without rework / Total deliverables submitted) * 100.',
          'يقاس بالنسبة المئوية: (المخرجات المعتمدة من أول مرة / إجمالي المخرجات المقدمة) * 100.',
          '%', 0.10, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Work Quality & First-Time Accuracy' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.10, 95, 5, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.10, target_benchmark = 95, display_order = 5;
  END IF;

  -- 6) Problem-Solving & Technical Troubleshooting
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Problem-Solving & Technical Troubleshooting', 'سرعة وكفاءة حل المشكلات والأعطال', 'common', 'technical',
          'Swift identification of root causes and implementing robust, sustainable solutions for operational and technical issues.',
          'القدرة على التشخيص السريع لجذور المشكلات وتقديم حلول جذرية وعملية تضمن استمرارية الأعمال.',
          'Measured in %: (Issues resolved within SLA timeframe / Total issues logged) * 100.',
          'يقاس بالنسبة المئوية: (المشكلات المحلولة ضمن وقت الاستجابة المعتمد / إجمالي البلاغات) * 100.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Problem-Solving & Technical Troubleshooting' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 90, 6, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 90, display_order = 6;
  END IF;

  -- 7) Productivity & Target Achievement Rate
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Productivity & Target Achievement Rate', 'معدل الإنتاجية وتحقيق الأهداف المحددة', 'common', 'productivity',
          'Volume of output and achievement rate compared to agreed quarterly department production quotas.',
          'حجم الإنجاز الفعلي مقارنة بالأهداف الإنتاجية والخطط التشغيلية المعتمدة للربع السنوي.',
          'Measured in %: (Actual completed units or milestones / Planned target quota) * 100.',
          'يقاس بالنسبة المئوية: (الإنجاز الفعلي / المستهدف المخطط له) * 100.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Productivity & Target Achievement Rate' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 7, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 7;
  END IF;

  -- 8) Customer & Stakeholder Satisfaction
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Customer & Stakeholder Satisfaction', 'رضا العملاء وأصحاب المصلحة', 'common', 'quality',
          'Achieving high satisfaction ratings from internal departments, external clients, and key partners.',
          'تحقيق مستويات رضا عالية من العملاء الداخليين والخارجيين وحسن الاستجابة لمتطلباتهم.',
          'Measured in %: Average CSAT rating score from customer feedback surveys.',
          'يقاس بنسبة متوسط تقييم رضا العملاء من استبيانات التقييم المعتمدة.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Customer & Stakeholder Satisfaction' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 90, 8, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 90, display_order = 8;
  END IF;

  -- 9) Cost Control & Resource Optimization
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Cost Control & Resource Optimization', 'ترشيد النفقات والاستخدام الأمثل للموارد', 'common', 'productivity',
          'Optimizing material usage, preventing wastage, and operating within allocated budgetary allowances.',
          'الاستغلال الأمثل لموارد وأصول الشركة والحد من الهدر والالتزام بالميزانيات التقديرية المعتمدة.',
          'Measured in %: (Actual expenditure / Budgeted cost) variance within <= 0% overspend.',
          'يقاس بنسبة التزام النفقات الفعلية مقارنة بالميزانية المعتمدة مع عدم وجود عجز.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Cost Control & Resource Optimization' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 9, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 9;
  END IF;

  -- 10) Safety & Regulatory Policy Compliance
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Safety & Regulatory Policy Compliance', 'الالتزام بالسلامة المهنية والسياسات المؤسسية', 'common', 'safety',
          'Strict adherence to occupational health and safety rules, cybersecurity guidelines, and company SOPs.',
          'الالتزام بقواعد السلامة والصحة المهنية والأمن السيبراني واللوائح الداخلية للشركة.',
          'Measured in %: Zero safety or compliance violations recorded during the evaluation period.',
          'يقاس بنسبة مئوية (100% تعني خلو السجل من أي مخالفات سلامة أو إجراءات تشغيلية).',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Safety & Regulatory Policy Compliance' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 10, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 10;
  END IF;

  -- 11) Continuous Learning & Professional Training
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Continuous Learning & Professional Training', 'التطوير الذاتي والتدريب المستمر', 'common', 'behavioral',
          'Completing mandatory skill development courses, acquiring relevant certifications, and attending workshops.',
          'إتمام الدورات التدريبية المعتمدة وتطوير المهارات التخصصية ونقل المعرفة للزملاء.',
          'Measured in %: (Actual training hours completed / Planned annual training hours) * 100.',
          'يقاس بنسبة ساعات التدريب المنجزة مقارنة بالساعات المقررة سنوياً.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Continuous Learning & Professional Training' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 11, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 11;
  END IF;

  -- 12) Initiative & Process Innovation
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Initiative & Process Innovation', 'المبادرة والابتكار في تحسين بيئة العمل', 'common', 'productivity',
          'Proactively proposing and implementing process optimizations, automation scripts, or efficiency ideas.',
          'تقديم مقترحات بناءة وحلول ابتكارية تسهم في تبسيط الإجراءات وأتمتة العمليات وتقليل التكاليف.',
          'Measured in scale (1-5): Number of accepted improvement initiatives submitted per quarter.',
          'يقاس بمقياس (1 إلى 5) بحسب عدد المبادرات التحسينية المعتمدة والمنفذة خلال الربع.',
          'scale', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Initiative & Process Innovation' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 12, 'scale')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 12;
  END IF;

  -- 13) Documentation Completeness & Archiving
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Documentation Completeness & Archiving', 'اكتمال التوثيق والأرشفة المؤسسية', 'common', 'quality',
          'Maintaining up-to-date documentation of workflows, system configurations, technical specifications, and logs.',
          'توثيق كافة المستندات وسجلات العمل والكتيبات الفنية وأرشفتها بنظام الشركة الموحد.',
          'Measured in %: Audit compliance score on documentation completeness and accessibility.',
          'يقاس بنسبة اكتمال الملفات والوثائق المؤرشفة أثناء المراجعة الدورية.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Documentation Completeness & Archiving' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 13, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 13;
  END IF;

  -- 14) System & Service Uptime Availability
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('System & Service Uptime Availability', 'جاهزية واستمرارية الأنظمة والخدمات', 'common', 'technical',
          'Ensuring assigned systems, databases, software platforms, or infrastructure assets remain online with minimal downtime.',
          'الحفاظ على استمرارية تشغيل الأنظمة والمنصات التقنية والأجهزة وتفادي التوقفات غير المخططة.',
          'Measured in %: (Actual operational uptime hours / Total scheduled hours) * 100.',
          'يقاس بنسبة الجاهزية والتشغيل الفعلي مقارنة بإجمالي ساعات العمل المجدولة.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'System & Service Uptime Availability' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 99, 14, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 99, display_order = 14;
  END IF;

  -- 15) Response Time to Service Inquiries
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Response Time to Service Inquiries', 'سرعة الاستجابة لطلبات الخدمة والدعم', 'common', 'productivity',
          'Timely initial response and continuous update cycle for all incoming support tickets, internal requests, and client calls.',
          'الالتزام بالرد السريع ومتابعة التذاكر وطلبات الدعم الفني والخدمات الموجهة خلال الوقت المحدد.',
          'Measured in %: (Inquiries acknowledged within standard SLA / Total received inquiries) * 100.',
          'يقاس بالنسبة المئوية للطلبات التي تم الرد عليها ضمن معيار اتفاقية مستوى الخدمة SLA.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Response Time to Service Inquiries' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 95, 15, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 95, display_order = 15;
  END IF;

  -- 16) Budget Adherence & Financial Accuracy
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Budget Adherence & Financial Accuracy', 'الالتزام بالموازنة التقديرية والدقة المالية', 'common', 'productivity',
          'Accurate accounting entries, zero financial discrepancies, and strictly operating within designated budget caps.',
          'الدقة في إعداد القيود والمطالبات المالية والالتزام بسقوف الإنفاق المعتمدة دون تجاوز.',
          'Measured in %: Accuracy rate of invoices, purchase orders, and zero recurring accounting reconciliations.',
          'يقاس بنسبة الدقة وخلو المطالبات وأوامر الشراء من الأخطاء والتباينات المالية.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Budget Adherence & Financial Accuracy' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 16, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 16;
  END IF;

  -- 17) Leadership & Team Mentorship
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Leadership & Team Mentorship', 'القيادة والتوجيه والإشراف الفعال', 'common', 'behavioral',
          'Providing constructive guidance, coaching junior team members, setting clear objectives, and evaluating performance fairly.',
          'توجيه وتدريب الموظفين الجدد وقيادة الفريق بكفاءة ومتابعة تحقيق الأهداف التشغيلية بعدالة.',
          'Measured in %: Quarterly leadership assessment rubric score and team member growth progress.',
          'يقاس بنسبة إنجاز خطط تطوير أعضاء الفريق ومعدل تحقيق مؤشرات أداء القسم.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Leadership & Team Mentorship' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 17, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 17;
  END IF;

  -- 18) Operational Risk Management & Mitigation
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Operational Risk Management & Mitigation', 'إدارة المخاطر التشغيلية والوقاية من الأزمات', 'common', 'safety',
          'Anticipating operational vulnerabilities, implementing mitigation actions, and preventing high-severity business disruptions.',
          'التنبؤ المبكر بالمخاطر وتطبيق خطط الطوارئ لتفادي أي تعطل في سير العمليات التشغيلية.',
          'Measured in %: Zero unmitigated high-risk incidents and full adherence to preventative risk matrix.',
          'يقاس بنسبة عدم حدوث أي انقطاع حرج وتطبيق خطط الوقاية من المخاطر بنجاح.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Operational Risk Management & Mitigation' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 100, 18, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 100, display_order = 18;
  END IF;

  -- 19) Vendor & Contractor Performance Oversight
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Vendor & Contractor Performance Oversight', 'متابعة أداء الموردين والمقاولين الخارجيين', 'common', 'coordination',
          'Monitoring contractor delivery timelines, ensuring service level agreement compliance, and managing billing disputes.',
          'متابعة التزام الموردين والمقاولين بالمواصفات المعتمدة وجداول التوريد والشروط التعاقدية.',
          'Measured in %: (Vendor milestones approved on-time / Total contracted milestones) * 100.',
          'يقاس بالنسبة المئوية للتوريدات والأعمال المنفذة مطابقة للشروط والوقت المحدد.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Vendor & Contractor Performance Oversight' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 95, 19, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 95, display_order = 19;
  END IF;

  -- 20) Client Retention & Account Growth
  INSERT INTO public.kpi_criteria (name_en, name_ar, criterion_type, category, description_en, description_ar, how_measured_en, how_measured_ar, unit, default_weight, scoring_direction, is_active, is_required)
  VALUES ('Client Retention & Account Growth', 'استبقاء العملاء وتنمية الأعمال', 'common', 'coordination',
          'Maintaining long-term client relationships, prompt issue escalations resolution, and identifying account renewal opportunities.',
          'الحفاظ على العلاقات المستمرة مع العملاء وتجديد العقود وفتح فرص أعمال جديدة وتطوير الخدمات.',
          'Measured in %: (Active client contracts renewed / Total contracts up for renewal) * 100.',
          'يقاس بنسبة تجديد العقود مع العملاء القائمين ونمو القيمة الإجمالية للعقود.',
          '%', 0.05, 'higher_is_better', true, true)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_crit_id FROM public.kpi_criteria WHERE name_en = 'Client Retention & Account Growth' LIMIT 1;
  IF v_crit_id IS NOT NULL THEN
    INSERT INTO public.kpi_template_items (template_id, criterion_id, weight, target_benchmark, display_order, unit)
    VALUES (v_template_id, v_crit_id, 0.05, 95, 20, '%')
    ON CONFLICT (template_id, criterion_id) DO UPDATE SET weight = 0.05, target_benchmark = 95, display_order = 20;
  END IF;

END $$;
