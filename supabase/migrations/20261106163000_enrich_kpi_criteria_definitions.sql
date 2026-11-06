-- Enrich legacy KPI criteria with complete descriptions and measurement methodologies
DO $$
BEGIN
  -- Discipline & Site Safety Compliance
  UPDATE public.kpi_criteria
  SET how_measured_en = 'Measured in %: (Safety checklist audits passed / Total audits conducted) * 100 with zero safety violations.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (عمليات التدقيق المجتازة / إجمالي جولات التفتيش) * 100 مع خلو السجل من المخالفات.'
  WHERE name_en = 'Discipline & Site Safety Compliance';

  -- On-Time Installation Completion
  UPDATE public.kpi_criteria
  SET how_measured_en = 'Measured in %: (Milestones completed on schedule / Scheduled project milestones) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (المراحل المنجزة في الموعد / إجمالي المراحل المجدولة) * 100.'
  WHERE name_en = 'On-Time Installation Completion';

  -- Compliance with Approved Shop Drawings
  UPDATE public.kpi_criteria
  SET how_measured_en = 'Measured in %: (Inspections passed without defect / Total consultant site inspections) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الفحوصات المعتمدة دون ملاحظات / إجمالي طلبات الفحص) * 100.'
  WHERE name_en = 'Compliance with Approved Shop Drawings';

  -- System Commissioning & Programming Accuracy
  UPDATE public.kpi_criteria
  SET how_measured_en = 'Measured in %: First-time successful system test and commissioning approval rate.',
      how_measured_ar = 'يقاس بالنسبة المئوية لنجاح تشغيل وبرمجة الأنظمة من أول اختبار اعتماد.'
  WHERE name_en = 'System Commissioning & Programming Accuracy';

  -- Cross-System Integration Execution
  UPDATE public.kpi_criteria
  SET how_measured_en = 'Measured in %: (Verified system interface trip tests passed / Total required integration tests) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية لاجتياز اختبارات الربط والتكامل بين الأنظمة المختلفة بنجاح.'
  WHERE name_en = 'Cross-System Integration Execution';

  -- Troubleshooting & Technical Issue Resolution
  UPDATE public.kpi_criteria
  SET how_measured_en = 'Measured in %: (Site technical snags resolved within SLA / Total raised snags) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الملاحظات الفنية المعالجة في الوقت المحدد / إجمالي الملاحظات) * 100.'
  WHERE name_en = 'Troubleshooting & Technical Issue Resolution';

  -- Daily & Weekly Site Reporting Quality
  UPDATE public.kpi_criteria
  SET how_measured_en = 'Measured in %: Timeliness and accuracy rate of daily logs and weekly progress submissions.',
      how_measured_ar = 'يقاس بنسبة الالتزام بمواعيد تسليم التقارير اليومية والأسبوعية ودقة البيانات.'
  WHERE name_en = 'Daily & Weekly Site Reporting Quality';

  -- Reporting & Policy Compliance
  UPDATE public.kpi_criteria
  SET description_en = 'Adherence to operational reporting schedules, HR guidelines, and company administrative standard operating procedures.',
      description_ar = 'الالتزام بجداول تسليم التقارير التشغيلية واللوائح الإدارية وسياسات الموارد البشرية.',
      how_measured_en = 'Measured in %: (Reports submitted on time without defects / Required reports) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية لتقديم التقارير الدورية دون تأخير أو أخطاء جوهرية.'
  WHERE name_en = 'Reporting & Policy Compliance';

  -- Shop Drawing Execution Compliance
  UPDATE public.kpi_criteria
  SET description_en = 'Ensuring physical site works and cabling align strictly with approved engineering shop drawings and technical specifications.',
      description_ar = 'مطابقة الأعمال المنفذة والتمديدات للمخططات التنفيذية المعتمدة والمواصفات الهندسية.',
      how_measured_en = 'Measured in %: First-time consultant inspection approval rate without rework notices.',
      how_measured_ar = 'يقاس بنسبة اعتماد الاستشاري للأعمال المنفذة من الزيارة الأولى دون ملاحظات إعادة عمل.'
  WHERE name_en = 'Shop Drawing Execution Compliance';

  -- Code Quality & Automated Test Coverage
  UPDATE public.kpi_criteria
  SET description_en = 'Maintaining high software code standards, passing static analysis linters, and writing comprehensive unit and integration tests.',
      description_ar = 'الالتزام بمعايير جودة الشفرة البرمجية واجتياز الفحص الثابت وتغطية الاختبارات التلقائية.',
      how_measured_en = 'Measured in %: Automated test code coverage percentage and zero critical SonarQube/linter blockers.',
      how_measured_ar = 'يقاس بنسبة التغطية البرمجية للاختبارات وخلو الكود من المشكلات الحرجة.'
  WHERE name_en = 'Code Quality & Automated Test Coverage';

  -- Sprint Velocity & On-Time Story Delivery
  UPDATE public.kpi_criteria
  SET description_en = 'Completing committed user stories and technical tasks within standard two-week sprint deadlines without carryover.',
      description_ar = 'إنجاز المهام البرمجية ونقاط العمل الملتزم بها ضمن دورة العمل البرمجية دون ترحيل.',
      how_measured_en = 'Measured in %: (Completed story points / Committed sprint story points) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (نقاط القصة المنجزة / النقاط الملتزم بها في السبرنت) * 100.'
  WHERE name_en = 'Sprint Velocity & On-Time Story Delivery';

  -- Production Defect & Bug Escape Rate
  UPDATE public.kpi_criteria
  SET description_en = 'Minimizing software bugs, production regressions, and critical incidents detected post-release.',
      description_ar = 'الحد من الأخطاء البرمجية والأعطال التي تظهر في بيئة الإنتاج بعد إطلاق التحديثات.',
      how_measured_en = 'Measured in %: 100 - ((Critical production defects / Total released features) * 100).',
      how_measured_ar = 'يقاس بالنسبة المئوية: 100 - ((الأخطاء الحرجة المكتشفة / إجمالي المزايا المطلقة) * 100).'
  WHERE name_en = 'Production Defect & Bug Escape Rate';

  -- Recruitment Milestone & Time-to-Hire
  UPDATE public.kpi_criteria
  SET description_en = 'Sourcing, screening, and successfully placing qualified candidates within approved departmental SLA timelines.',
      description_ar = 'استقطاب واختيار وتعيين الكفاءات المؤهلة لشغل الوظائف الشاغرة خلال الوقت المستهدف.',
      how_measured_en = 'Measured in %: (Positions closed within target time-to-hire SLA / Total approved requisitions) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الوظائف المغلقة ضمن الوقت المستهدف / إجمالي الشواغر المعتمدة) * 100.'
  WHERE name_en = 'Recruitment Milestone & Time-to-Hire';

  -- Payroll Processing Timeliness & Accuracy
  UPDATE public.kpi_criteria
  SET description_en = 'Accurate monthly salary calculations, statutory deductions, bank file transfers, and dispute-free payroll closure.',
      description_ar = 'دقة واكتمال حسابات الرواتب الشهرية والخصومات والتحويلات البنكية في المواعيد المحددة دون منازعات.',
      how_measured_en = 'Measured in %: Payroll processing completed on or before monthly cutoff date with zero critical error disputes.',
      how_measured_ar = 'يقاس بالالتزام بتاريخ الإقفال الشهري للرواتب وخلو كشوف المسيرات من الأخطاء.'
  WHERE name_en = 'Payroll Processing Timeliness & Accuracy';

  -- Onboarding Experience & Retention Rate
  UPDATE public.kpi_criteria
  SET description_en = 'Structured onboarding, orientation facilitation, and probation period retention of newly hired staff.',
      description_ar = 'تنفيذ برنامج التهيئة والتعريف المؤسسي بنجاح واستقرار الموظفين الجدد خلال فترة التجربة.',
      how_measured_en = 'Measured in %: (New hires successfully completing 90-day probation / Total new hires) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الموظفون الجدد الذين اجتازوا فترة التجربة بنجاح / إجمالي المعينين) * 100.'
  WHERE name_en = 'Onboarding Experience & Retention Rate';

  -- Personnel Records & Labor Law Compliance
  UPDATE public.kpi_criteria
  SET description_en = 'Full legal compliance of employee files, contracts, social insurance, and labor office documentation.',
      description_ar = 'اكتمال ملفات الموظفين والعقود والتأمينات الاجتماعية والامتثال التام للأنظمة واللوائح الرسمية.',
      how_measured_en = 'Measured in %: Personnel record audit completeness and regulatory compliance checklist score.',
      how_measured_ar = 'يقاس بنسبة اكتمال سجلات الموظفين وقوائم الامتثال لقانون العمل.'
  WHERE name_en = 'Personnel Records & Labor Law Compliance';

  -- Code Review & Team Knowledge Sharing
  UPDATE public.kpi_criteria
  SET description_en = 'Participating actively in peer pull request reviews, architectural sessions, and mentoring junior engineers.',
      description_ar = 'المشاركة الفعالة في مراجعة الأكواد البرمجية للزملاء والجلسات التقنية وتدريب المهندسين المبتدئين.',
      how_measured_en = 'Measured in scale (1-5): Peer review turnaround time (<24h) and quarterly engineering review score.',
      how_measured_ar = 'يقاس بمقياس (1-5) لسرعة وجودة مراجعة الأكواد ومشاركة المعرفة مع الفريق.'
  WHERE name_en = 'Code Review & Team Knowledge Sharing';

  -- Employee Grievance & Issue Resolution Rate
  UPDATE public.kpi_criteria
  SET description_en = 'Timely investigation, fair resolution, and transparent documentation of employee grievances and workplace issues.',
      description_ar = 'سرعة فحص وحل الشكاوى العمالية والنزاعات الداخلية بموضوعية وشفافية ضمن الإطار الزمني للسياسة.',
      how_measured_en = 'Measured in %: (Grievances resolved within target policy SLA / Total received grievances) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الشكاوى التي تمت معالجتها في الوقت المحدد / إجمالي الشكاوى) * 100.'
  WHERE name_en = 'Employee Grievance & Issue Resolution Rate';

  -- API Latency & System Performance SLA
  UPDATE public.kpi_criteria
  SET description_en = 'Maintaining fast backend response times, database query efficiency, and 99.9% uptime for core production services.',
      description_ar = 'الحفاظ على سرعة استجابة واجهات التطبيقات (API) وكفاءة قواعد البيانات واستقرار الخدمات بنسبة 99.9%.',
      how_measured_en = 'Measured in %: (Requests served under 300ms SLA / Total HTTP requests) * 100 via APM monitoring.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الطلبات المعالجة في أقل من 300 مللي ثانية / إجمالي الطلبات) * 100 عبر نظام المراقبة.'
  WHERE name_en = 'API Latency & System Performance SLA';

  -- Monthly Financial Closing Timeliness
  UPDATE public.kpi_criteria
  SET description_en = 'Completing monthly financial ledger reconciliation, journal entries, and financial statements by target calendar cutoff.',
      description_ar = 'إتمام القيود المحاسبية والتسويات وإصدار القوائم المالية الشهرية في المواعيد المقررة.',
      how_measured_en = 'Measured in %: Monthly book closing achieved on or before the 5th working day of the subsequent month.',
      how_measured_ar = 'يقاس بالإقفال الشهري للدفاتر قبل اليوم الخامس من الشهر التالي.'
  WHERE name_en = 'Monthly Financial Closing Timeliness';

  -- Accounts Receivable & Collection Follow-up
  UPDATE public.kpi_criteria
  SET description_en = 'Managing invoice aging, prompt follow-up on overdue customer balances, and accelerating cash collection.',
      description_ar = 'متابعة أعمار الديون والتحصيل الفعال لمستحقات الشركة لدى العملاء وتقليل متأخرات السداد.',
      how_measured_en = 'Measured in %: (Actual collected payments / Total receivables due in period) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (المبالغ المحصلة فعلياً / إجمالي المستحقات واجبة التحصيل) * 100.'
  WHERE name_en = 'Accounts Receivable & Collection Follow-up';

  -- Opportunity Pipeline Conversion Velocity
  UPDATE public.kpi_criteria
  SET description_en = 'Advancing qualified sales leads through the sales pipeline stages to closed-won deals efficiently.',
      description_ar = 'تحويل الفرص البيعية المؤهلة عبر مراحل القمع البيعي وإتمام الصفقات بكفاءة وسرعة.',
      how_measured_en = 'Measured in %: (Won opportunities / Total qualified pipeline opportunities) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الصفقات الرابحة / إجمالي الفرص المؤهلة) * 100.'
  WHERE name_en = 'Opportunity Pipeline Conversion Velocity';

  -- Commercial Proposal Turnaround Time
  UPDATE public.kpi_criteria
  SET description_en = 'Preparing and submitting accurate, commercially viable technical proposals and RFPs within client deadlines.',
      description_ar = 'إعداد وتقديم العروض الفنية والمالية للعملاء بدقة وسرعة ضمن المواعيد المحددة.',
      how_measured_en = 'Measured in %: (Proposals submitted within SLA / Total customer RFPs received) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (العروض المقدمة في الموعد / إجمالي طلبات العروض) * 100.'
  WHERE name_en = 'Commercial Proposal Turnaround Time';

  -- Accounts Payable & Invoice Accuracy
  UPDATE public.kpi_criteria
  SET description_en = 'Verifying vendor invoices against purchase orders, resolving discrepancies, and scheduling on-time disbursements.',
      description_ar = 'مطابقة فواتير الموردين مع أوامر الشراء واعتمادها ومتابعة السداد في المواعيد المتفق عليها.',
      how_measured_en = 'Measured in %: (Vendor invoices processed without error / Total processed invoices) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية لفواتير الموردين المعالجة بدون أخطاء مطابقة.'
  WHERE name_en = 'Accounts Payable & Invoice Accuracy';

  -- Tax & Statutory Filing Compliance
  UPDATE public.kpi_criteria
  SET description_en = 'Timely preparation and filing of VAT, corporate tax, withholding, and social insurance statutory returns.',
      description_ar = 'إعداد وتقديم الإقرارات الضريبية والزكوية والتأمينات وسداد الالتزامات في المواعيد النظامية.',
      how_measured_en = 'Measured in %: 100% on-time filing compliance with tax authorities with zero late filing penalties.',
      how_measured_ar = 'يقاس بالالتزام بنسبة 100% بالمواعيد النظامية المحددة وخلو السجل من الغرامات.'
  WHERE name_en = 'Tax & Statutory Filing Compliance';

  -- Client Retention & Contract Renewal Rate
  UPDATE public.kpi_criteria
  SET description_en = 'Maintaining long-term client relationships, ensuring service quality, and securing recurring contract renewals.',
      description_ar = 'المحافظة على استمرارية العملاء وتجديد عقود الصيانة والخدمات السنوية بنجاح.',
      how_measured_en = 'Measured in %: (Renewed contracts value / Total eligible contracts up for renewal) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (قيمة العقود المجددة / إجمالي العقود القابلة للتجديد) * 100.'
  WHERE name_en = 'Client Retention & Contract Renewal Rate';

  -- First Response Time (FRT) SLA
  UPDATE public.kpi_criteria
  SET description_en = 'Prompt initial response to client support inquiries, tickets, and escalation messages.',
      description_ar = 'سرعة الاستجابة الأولى لاستفسارات وبلاغات العملاء عبر القنوات المعتمدة.',
      how_measured_en = 'Measured in %: (Inquiries responded to within 15 minutes / Total inquiries received) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (البلاغات المستجابة خلال 15 دقيقة / إجمالي البلاغات) * 100.'
  WHERE name_en = 'First Response Time (FRT) SLA';

  -- Bank & Ledger Reconciliation Variance
  UPDATE public.kpi_criteria
  SET description_en = 'Daily and monthly reconciliation between bank statements, ERP cash books, and general ledger accounts.',
      description_ar = 'مطابقة كشوف الحسابات البنكية مع قيود اليومية ودفاتر الأستاذ العام وتصفية الفروقات دورياً.',
      how_measured_en = 'Measured in %: Zero unexplained bank reconciliation variance at month-end closing.',
      how_measured_ar = 'يقاس بعدم وجود أي فروقات بنكية غير مبررة عند الإقفال الشهري.'
  WHERE name_en = 'Bank & Ledger Reconciliation Variance';

  -- Quarterly Sales Quota Achievement
  UPDATE public.kpi_criteria
  SET description_en = 'Achieving assigned quarterly closed-won revenue and contract booking targets.',
      description_ar = 'تحقيق المستهدف البيعي والتحصيلي الربعي المعتمد للوظيفة.',
      how_measured_en = 'Measured in %: (Actual revenue booked / Assigned quarterly sales quota) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (الإيراد المحقق فعلياً / المستهدف الربعي المعتمد) * 100.'
  WHERE name_en = 'Quarterly Sales Quota Achievement';

  -- CRM Pipeline Hygiene & Activity Logging
  UPDATE public.kpi_criteria
  SET description_en = 'Accurate and timely recording of customer interactions, meeting notes, deals, and stages in CRM.',
      description_ar = 'تسجيل كافة الأنشطة والمكالمات والاجتماعات وتحديث مراحل الصفقات في نظام إدارة علاقات العملاء.',
      how_measured_en = 'Measured in %: CRM activity audit score based on completeness and weekly logging frequency.',
      how_measured_ar = 'يقاس بنسبة اكتمال تسجيل الأنشطة وتحديث بيانات العملاء أسبوعياً.'
  WHERE name_en = 'CRM Pipeline Hygiene & Activity Logging';

  -- Customer Support Ticket Resolution SLA
  UPDATE public.kpi_criteria
  SET description_en = 'Resolving customer support tickets within defined SLA timeframes based on severity level.',
      description_ar = 'حل وإغلاق تذاكر دعم العملاء الفنية والتشغيلية ضمن اتفاقية مستوى الخدمة المحددة.',
      how_measured_en = 'Measured in %: (Tickets resolved within SLA / Total assigned tickets) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (التذاكر المحلولة ضمن وقت الاتفاقية / إجمالي التذاكر) * 100.'
  WHERE name_en = 'Customer Support Ticket Resolution SLA';

  -- Help Center Knowledge Base Contribution
  UPDATE public.kpi_criteria
  SET description_en = 'Writing and updating troubleshooting guides, FAQs, and self-service documentation for common customer issues.',
      description_ar = 'إعداد وتحديث مقالات الدعم الفني والأسئلة الشائعة لتسهيل حل المشكلات ذاتياً للعملاء.',
      how_measured_en = 'Measured in %: (Approved knowledge base articles published / Monthly documentation target) * 100.',
      how_measured_ar = 'يقاس بنسبة إنجاز مقالات الدعم الفني المعتمدة مقارنة بالمستهدف الشهري.'
  WHERE name_en = 'Help Center Knowledge Base Contribution';

  -- Support Ticket Reopen Rate
  UPDATE public.kpi_criteria
  SET description_en = 'Delivering comprehensive first-time solutions so customer tickets do not need to be reopened for the same issue.',
      description_ar = 'تقديم حلول نهائية للمشكلات من المرة الأولى لتفادي إعادة فتح تذاكر الدعم لنفس السبب.',
      how_measured_en = 'Measured in %: 100 - ((Reopened tickets / Total closed tickets) * 100). Target: <= 5%.',
      how_measured_ar = 'يقاس بالنسبة المئوية: 100 - ((التذاكر المعاد فتحها / إجمالي التذاكر المغلقة) * 100).'
  WHERE name_en = 'Support Ticket Reopen Rate';

  -- Troubleshooting & Issue Resolution
  UPDATE public.kpi_criteria
  SET description_en = 'Diagnosing system faults, debugging operational errors, and applying effective technical resolutions.',
      description_ar = 'تشخيص الأعطال التشغيلية وتصحيح المشكلات الفنية بكفاءة وسرعة استجابة عالية.',
      how_measured_en = 'Measured in %: (Reported issues resolved within SLA / Total reported issues) * 100.',
      how_measured_ar = 'يقاس بالنسبة المئوية: (المشكلات المعالجة ضمن الوقت المحدد / إجمالي المشكلات) * 100.'
  WHERE name_en = 'Troubleshooting & Issue Resolution';

END $$;

