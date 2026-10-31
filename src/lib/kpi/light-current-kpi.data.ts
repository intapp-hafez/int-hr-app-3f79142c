/**
 * KPI Definitions & Calculations for
 * Junior ELV / Light Current Site Engineer Annual KPI Evaluation
 * Source: Light Current Engineer Annul KPI Evaluation.xlsx (Integrated Technics)
 * Fully localized with English and Arabic.
 */

export interface KpiMetricDefinition {
  id: number;
  category: string;
  category_ar: string;
  name: string;
  name_ar: string;
  definition: string;
  definition_ar: string;
  howMeasured: string;
  howMeasured_ar: string;
  weight: number; // e.g. 0.05 for 5%
  target: number; // e.g. 0.95 for 95%
  inputType: "percentage" | "rating_5" | "days" | "count";
  inputHint?: string;
  inputHint_ar?: string;
}

export interface KpiQuarterValues {
  actual: number | null; // stored as decimal (0.0 to 1.0)
  achievement: number | null; // MIN(actual/target, 1)
  score: number | null; // achievement * weight
}

export interface KpiRowState {
  id: number;
  q1: KpiQuarterValues;
  q2: KpiQuarterValues;
  q3: KpiQuarterValues;
  q4: KpiQuarterValues;
  annualScore: number | null; // Average of quarterly scores
}

export interface KpiCategorySummary {
  name: string;
  name_ar: string;
  totalWeight: number;
  earnedScore: number;
  maxScore: number;
  percentage: number;
}

export const KPI_CATEGORIES = [
  "Installation & Technical Execution",
  "Commissioning & System Programming",
  "System Integration",
  "Troubleshooting & Testing",
  "Reporting & Support",
  "Cross-Discipline Coordination",
  "Professional Development",
  "Soft Skills / Behavioral Competencies",
] as const;

export const KPI_CATEGORIES_AR: Record<string, string> = {
  "Installation & Technical Execution": "التنفيذ الفني والتركيبات",
  "Commissioning & System Programming": "التشغيل والبرمجة",
  "System Integration": "تكامل الأنظمة",
  "Troubleshooting & Testing": "استكشاف الأعطال والاختبار",
  "Reporting & Support": "التقارير والدعم الفني",
  "Cross-Discipline Coordination": "التنسيق بين التخصصات",
  "Professional Development": "التطوير المهني",
  "Soft Skills / Behavioral Competencies": "المهارات الشخصية والسلوكية",
};

export const LIGHT_CURRENT_ENGINEER_KPIS: KpiMetricDefinition[] = [
  {
    id: 1,
    category: "Installation & Technical Execution",
    category_ar: "التنفيذ الفني والتركيبات",
    name: "On-Time Installation Completion",
    name_ar: "إنجاز أعمال التركيبات في الوقت المحدد",
    definition:
      "Measures whether installation work is delivered at the pace the project schedule needs, directly affecting the overall project timeline.",
    definition_ar:
      "يقيس ما إذا كان عمل التركيب يتم تسليمه بالوتيرة التي يتطلبها الجدول الزمني للمشروع، مما يؤثر بشكل مباشر على الجدول الزمني العام.",
    howMeasured:
      "% of installation tasks completed on schedule (tasks completed on schedule ÷ total tasks assigned), tracked monthly from site progress reports.",
    howMeasured_ar:
      "نسبة مهام التركيب المنجزة في الموعد المحدد (المهام المكتملة في الموعد ÷ إجمالي المهام المسندة)، يتم تتبعها شهرياً من تقارير تقدم الموقع.",
    weight: 0.05,
    target: 0.95,
    inputType: "percentage",
    inputHint: "Enter % of tasks on schedule (e.g. 95%)",
    inputHint_ar: "أدخل نسبة المهام المنجزة بالموعد (الهدف 95%)",
  },
  {
    id: 2,
    category: "Installation & Technical Execution",
    category_ar: "التنفيذ الفني والتركيبات",
    name: "First-Time Compliance with Approved Shop Drawings",
    name_ar: "المطابقة من المرة الأولى للمخططات التنفيذية المعتمدة",
    definition:
      "Measures the ability to read and execute against approved drawings correctly without repeated inspection cycles.",
    definition_ar:
      "يقيس القدرة على قراءة وتنفيذ الأعمال وفق المخططات المعتمدة بشكل صحيح دون تكرار دورات الفحص والملاحظات.",
    howMeasured:
      "% of installations passing inspection against shop drawings on first attempt (passed ÷ total inspected).",
    howMeasured_ar:
      "نسبة التركيبات التي تجتاز الفحص والمطابقة للمخططات من المحاولة الأولى (الناجحة ÷ إجمالي المفحوصة).",
    weight: 0.05,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % passing first inspection (e.g. 90%)",
    inputHint_ar: "أدخل نسبة المطابقة من أول فحص (الهدف 90%)",
  },
  {
    id: 3,
    category: "Commissioning & System Programming",
    category_ar: "التشغيل والبرمجة",
    name: "Systems Commissioned On Time",
    name_ar: "تشغيل الأنظمة في الموعد المحدد",
    definition:
      "Measures delivery of commissioning on plan; commissioning delays are one of the most common causes of handover slippage.",
    definition_ar:
      "يقيس تسليم أعمال التشغيل وفق الخطة؛ حيث يعد تأخير التشغيل أحد أكثر أسباب تأخر التسليم النهائي للمشروع.",
    howMeasured:
      "% of systems commissioned on/before the planned date (systems on time ÷ total systems assigned for commissioning).",
    howMeasured_ar:
      "نسبة الأنظمة التي تم تشغيلها في الموعد المحدد أو قبله (الأنظمة المنجزة في الموعد ÷ إجمالي الأنظمة المسندة للتشغيل).",
    weight: 0.075,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % commissioned on time (e.g. 90%)",
    inputHint_ar: "أدخل نسبة الأنظمة المشغلة في الموعد (الهدف 90%)",
  },
  {
    id: 4,
    category: "Commissioning & System Programming",
    category_ar: "التشغيل والبرمجة",
    name: "First-Time Pass Rate on Startup / Commissioning Tests",
    name_ar: "معدل النجاح من المرة الأولى في اختبارات بدء التشغيل",
    definition:
      "Measures programming accuracy and readiness before requesting formal witness testing.",
    definition_ar:
      "يقيس دقة البرمجة والجاهزية قبل طلب الفحص الرسمي والاختبار بحضور الاستشاري/العميل.",
    howMeasured:
      "% of systems passing startup tests on first attempt (passed first time ÷ total systems tested).",
    howMeasured_ar:
      "نسبة الأنظمة التي تجتاز اختبارات بدء التشغيل من المحاولة الأولى (الناجحة من أول مرة ÷ إجمالي الأنظمة المختبرة).",
    weight: 0.075,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % passing first startup test (e.g. 90%)",
    inputHint_ar: "أدخل نسبة اجتياز الفحص الأولي (الهدف 90%)",
  },
  {
    id: 5,
    category: "System Integration",
    category_ar: "تكامل الأنظمة",
    name: "ELV Systems Verified as Correctly Integrated",
    name_ar: "التحقق من تكامل وربط أنظمة التيار الخفيف بشكل صحيح",
    definition:
      "Measures that ELV systems (CCTV, Access Control, Fire Alarm, BMS, etc.) interface with each other as designed, not just installed in isolation; the core differentiator of the role.",
    definition_ar:
      "يقيس ربط وتكامل أنظمة التيار الخفيف (كاميرات المراقبة، التحكم في الدخول، إنذار الحريق، وغيرها) مع بعضها كما هو مصمم، وليس فقط كأنظمة منفصلة؛ وهي الميزة الأساسية لمهندس التيار الخفيف.",
    howMeasured:
      "% of systems confirmed interfacing correctly per project requirement (confirmed ÷ total systems requiring integration).",
    howMeasured_ar:
      "نسبة الأنظمة المؤكد تكاملها وربطها التشغيلي بنجاح وفق متطلبات المشروع (الأنظمة المؤكدة ÷ إجمالي الأنظمة المطلوب ربطها).",
    weight: 0.075,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % interfacing correctly (e.g. 90%)",
    inputHint_ar: "أدخل نسبة الأنظمة المتكاملة بنجاح (الهدف 90%)",
  },
  {
    id: 6,
    category: "System Integration",
    category_ar: "تكامل الأنظمة",
    name: "Integration Issues Resolved Before Handover",
    name_ar: "حل مشكلات التكامل قبل التسليم",
    definition:
      "Measures closure of integration issues before handover; unresolved issues create client complaints and warranty callbacks.",
    definition_ar:
      "يقيس إغلاق ومعالجة كافة مشكلات الربط والتكامل قبل تسليم المشروع؛ حيث يسبب بقاؤها شكاوى العملاء واستدعاءات الضمان.",
    howMeasured:
      "% of integration issues closed before handover (closed ÷ total integration issues logged).",
    howMeasured_ar:
      "نسبة مشكلات التكامل المغلقة قبل التسليم (المشكلات المغلقة ÷ إجمالي مشكلات التكامل المسجلة).",
    weight: 0.075,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % integration issues closed (e.g. 90%)",
    inputHint_ar: "أدخل نسبة مشكلات التكامل المحلولة (الهدف 90%)",
  },
  {
    id: 7,
    category: "Troubleshooting & Testing",
    category_ar: "استكشاف الأعطال والاختبار",
    name: "Response Time to On-Site Technical Issues",
    name_ar: "سرعة الاستجابة للمشكلات الفنية بالموقع",
    definition:
      "Measures how quickly on-site technical issues are picked up, minimizing site downtime and avoiding blocking other disciplines (Electrical, Mechanical, Fit-out).",
    definition_ar:
      "يقيس سرعة معالجة المشكلات الفنية في الموقع، لتقليل توقف العمل وتجنب تعطيل التخصصات الأخرى (الكهرباء، الميكانيكا، التشطيبات).",
    howMeasured:
      "% of on-site technical issues responded to within 24 hours of being reported (from the site issue tracker).",
    howMeasured_ar:
      "نسبة المشكلات الفنية بالموقع التي تمت الاستجابة لها خلال 24 ساعة من الإبلاغ عنها (من سجل مشكلات الموقع).",
    weight: 0.1,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % responded within 24 hrs (e.g. 90%)",
    inputHint_ar: "أدخل نسبة الاستجابة خلال 24 ساعة (الهدف 90%)",
  },
  {
    id: 8,
    category: "Troubleshooting & Testing",
    category_ar: "استكشاف الأعطال والاختبار",
    name: "Recurring Fault Rate (Permanent Fix Rate)",
    name_ar: "معدل الحل الجذري للأعطال (عدم تكرار العطل)",
    definition:
      "Distinguishes genuine root-cause troubleshooting from temporary patch fixes.",
    definition_ar:
      "يميز بين استكشاف الأعطال وحلها الجذري الحقيقي وبين الحلول المؤقتة الترقيعية.",
    howMeasured:
      "% of faults handled that did not recur after the fix (1 − recurring fault rate).",
    howMeasured_ar:
      "نسبة الأعطال التي تم التعامل معها ولم تتكرر بعد الإصلاح (1 − معدل تكرار الأعطال).",
    weight: 0.05,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % permanent fix without recurring (e.g. 90%)",
    inputHint_ar: "أدخل نسبة الحلول الجذرية الدائمة (الهدف 90%)",
  },
  {
    id: 9,
    category: "Reporting & Support",
    category_ar: "التقارير والدعم الفني",
    name: "Timeliness of Site Progress Reports",
    name_ar: "الالتزام بمواعيد تقارير تقدم الأعمال",
    definition:
      "Measures whether accurate, on-time reporting is provided so management can track site status and forecast risk.",
    definition_ar:
      "يقيس تقديم تقارير دقيقة وفي الوقت المحدد لتمكين الإدارة من متابعة حالة الموقع واستشراف المخاطر.",
    howMeasured:
      "% of site progress reports submitted by the deadline (weekly or as assigned) (submitted on time ÷ total due).",
    howMeasured_ar:
      "نسبة تقارير تقدم الموقع المسلمة في الموعد المحدد (أسبوعياً أو حسب التكليف) (المسلمة في الموعد ÷ إجمالي التقارير المستحقة).",
    weight: 0.05,
    target: 1.0,
    inputType: "percentage",
    inputHint: "Enter % reports submitted on time (Target 100%)",
    inputHint_ar: "أدخل نسبة التقارير المسلمة في الموعد (الهدف 100%)",
  },
  {
    id: 10,
    category: "Reporting & Support",
    category_ar: "التقارير والدعم الفني",
    name: "Senior Engineer Satisfaction (Testing & Commissioning Support)",
    name_ar: "رضا كبار المهندسين (دعم الاختبارات والتشغيل)",
    definition:
      "Captures the quality of support given to senior/lead engineers during Testing & Commissioning, which is hard to quantify otherwise.",
    definition_ar:
      "يقيس جودة الدعم المقدم لكبار المهندسين خلال مراحل الاختبار والتشغيل، والتي يصعب قياسها ببيانات كمية فقط.",
    howMeasured:
      "Average rating (1–5) given by senior/lead engineers, collected quarterly. Enter as % of 5 (e.g. 4/5 = 80%).",
    howMeasured_ar:
      "متوسط التقييم (1–5) المقدم من كبار مهندسي التشغيل فصلياً. يتم إدخاله كنسبة مئوية من 5 (مثال: 4 من 5 = 80%).",
    weight: 0.05,
    target: 0.8,
    inputType: "rating_5",
    inputHint: "Rating out of 5 (4/5 = 80%, Target 80%)",
    inputHint_ar: "التقييم من 5 (4 من 5 = 80%، الهدف 80%)",
  },
  {
    id: 11,
    category: "Cross-Discipline Coordination",
    category_ar: "التنسيق بين التخصصات",
    name: "Interface Issues Resolved Without Escalation",
    name_ar: "حل مشكلات التداخل والتنسيق بدون تصعيد",
    definition:
      "Measures the ability to resolve day-to-day conflicts with Electrical / Mechanical / Fit-out directly, reducing management overhead.",
    definition_ar:
      "يقيس القدرة على حل التعارضات اليومية مع فرق الكهرباء والميكانيكا والتشطيبات بشكل مباشر في الموقع، وتقليل العبء على الإدارة العليا.",
    howMeasured:
      "% of interface issues resolved at site level (resolved without escalation ÷ total interface issues raised).",
    howMeasured_ar:
      "نسبة مشكلات التداخل المحلولة على مستوى الموقع (المحلولة دون تصعيد ÷ إجمالي مشكلات التداخل المطروحة).",
    weight: 0.05,
    target: 0.9,
    inputType: "percentage",
    inputHint: "Enter % resolved without escalation (e.g. 90%)",
    inputHint_ar: "أدخل نسبة المشكلات المحلولة بالموقع (الهدف 90%)",
  },
  {
    id: 12,
    category: "Cross-Discipline Coordination",
    category_ar: "التنسيق بين التخصصات",
    name: "Cross-Discipline Issue Resolution Time",
    name_ar: "زمن حل المشكلات المشتركة بين التخصصات",
    definition:
      "Measures how fast cross-discipline issues are closed, keeping the overall site programme moving across all trades.",
    definition_ar:
      "يقيس سرعة إغلاق المشكلات المشتركة للحفاظ على استمرار البرنامج الزمني لجميع التخصصات.",
    howMeasured:
      "Score % based on average working days from issue identification to resolution: 100% if average ≤ 3 days, reducing proportionally to 0% at 6 days or more.",
    howMeasured_ar:
      "نسبة التقييم بناءً على متوسط أيام العمل من تحديد المشكلة إلى حلها: 100% إذا كان المتوسط ≤ 3 أيام، وتنخفض تدريجياً إلى 0% عند 6 أيام فأكثر.",
    weight: 0.05,
    target: 1.0,
    inputType: "days",
    inputHint: "100% if ≤3 days; 0% if ≥6 days (Target 100%)",
    inputHint_ar: "100% إذا كان ≤ 3 أيام؛ 0% إذا كان ≥ 6 أيام",
  },
  {
    id: 13,
    category: "Cross-Discipline Coordination",
    category_ar: "التنسيق بين التخصصات",
    name: "Non-Conformance Reports (NCRs) Raised",
    name_ar: "تقارير عدم المطابقة (NCRs) الصادرة",
    definition:
      "Measures consistency of on-site quality; fewer non-conformance reports indicate consistent quality.",
    definition_ar:
      "يقيس ثبات واستمرارية جودة العمل في الموقع؛ فقلة تقارير عدم المطابقة تعكس جودة تنفيذية متسقة.",
    howMeasured:
      "Score % based on NCRs issued against the engineer's work area (year to date): 100% if ≤ 3, reducing proportionally to 0% at 6 or more.",
    howMeasured_ar:
      "نسبة التقييم بناءً على تقارير عدم المطابقة الصادرة ضد نطاق عمل المهندس (منذ بداية العام): 100% إذا كانت ≤ 3، وتنخفض تدريجياً إلى 0% عند 6 فأكثر.",
    weight: 0.05,
    target: 1.0,
    inputType: "count",
    inputHint: "100% if ≤3 NCRs; 0% if ≥6 NCRs (Target 100%)",
    inputHint_ar: "100% إذا كانت ≤ 3 تقارير؛ 0% إذا كانت ≥ 6 تقارير",
  },
  {
    id: 14,
    category: "Professional Development",
    category_ar: "التطوير المهني",
    name: "Certifications / Trainings Completed",
    name_ar: "الدورات والشهادات المهنية المنجزة",
    definition:
      "Tracks continued technical growth (ELV platforms, networking, etc.) for the role.",
    definition_ar:
      "يتابع النمو الفني المستمر في أنظمة التيار الخفيف والشبكات المتخصصة.",
    howMeasured:
      "Score % = relevant ELV/networking certifications or trainings completed and verified ÷ 2.5 (midpoint of the 2–3 target), capped at 100%.",
    howMeasured_ar:
      "نسبة التقييم = عدد الشهادات أو الدورات المعتمدة في التيار الخفيف والشبكات ÷ 2.5 (متوسط الهدف 2–3 شهادات سنوياً)، بحد أقصى 100%.",
    weight: 0.05,
    target: 1.0,
    inputType: "count",
    inputHint: "Completed certs ÷ 2.5 (e.g. 2 certs = 80%, 3 certs = 100%)",
    inputHint_ar: "عدد الشهادات ÷ 2.5 (شهادتان = 80%، 3 شهادات = 100%)",
  },
  {
    id: 15,
    category: "Soft Skills / Behavioral Competencies",
    category_ar: "المهارات الشخصية والسلوكية",
    name: "Problem-Solving & Hands-On Troubleshooting Mindset",
    name_ar: "عقلية حل المشكلات والتشخيص العملي بالموقع",
    definition:
      "Reflects the behavioral requirement for a high passion for site work and hands-on troubleshooting, hard to capture in a purely technical metric.",
    definition_ar:
      "يعكس المتطلب السلوكي للشغف بالعمل الميداني والتشخيص العملي للأعطال، وهو ما يصعب حصره بمقياس فني بحت.",
    howMeasured:
      "Supervisor rating (1–5), quarterly average, on independent problem-solving and hands-on troubleshooting on site. Enter as % of 5.",
    howMeasured_ar:
      "تقييم المشرف المباشر (1–5)، متوسط فصلي، في حل المشكلات باستقلالية والتعامل الميداني المباشر. يُدخل كنسبة من 5.",
    weight: 0.05,
    target: 0.8,
    inputType: "rating_5",
    inputHint: "Rating out of 5 (4/5 = 80%, Target 80%)",
    inputHint_ar: "التقييم من 5 (4 من 5 = 80%، الهدف 80%)",
  },
  {
    id: 16,
    category: "Soft Skills / Behavioral Competencies",
    category_ar: "المهارات الشخصية والسلوكية",
    name: "Adaptability to Site Environment & Work Pressure",
    name_ar: "التكيف مع بيئة الموقع وضغط العمل",
    definition:
      "Measures how well the engineer copes with constantly changing site conditions, tight deadlines and last-minute changes.",
    definition_ar:
      "يقيس قدرة المهندس على التأقلم مع ظروف الموقع المتغيرة، والمواعيد النهائية الحرجة، والتعديلات اللحظية.",
    howMeasured:
      "Supervisor rating (1–5) on ability to adapt to changing site conditions, tight deadlines and last-minute changes. Enter as % of 5.",
    howMeasured_ar:
      "تقييم المشرف المباشر (1–5) على التكيف مع تغيرات الموقع والمواعيد الضاغطة والتعديلات الطارئة. يُدخل كنسبة من 5.",
    weight: 0.05,
    target: 0.8,
    inputType: "rating_5",
    inputHint: "Rating out of 5 (4/5 = 80%, Target 80%)",
    inputHint_ar: "التقييم من 5 (4 من 5 = 80%، الهدف 80%)",
  },
  {
    id: 17,
    category: "Soft Skills / Behavioral Competencies",
    category_ar: "المهارات الشخصية والسلوكية",
    name: "Teamwork, Communication & Eagerness to Learn",
    name_ar: "العمل الجماعي، التواصل، والشغف بالتعلم",
    definition:
      "Covers coordination quality with other disciplines, clarity of communication (including English) and the proactive learning attitude expected of the role.",
    definition_ar:
      "يغطي جودة التنسيق مع التخصصات الأخرى، ووضوح التواصل (بما في ذلك اللغة الإنجليزية)، والمبادرة بتعلم التقنيات والأنظمة الحديثة.",
    howMeasured:
      "Supervisor rating (1–5) on coordination with team/other disciplines, communication clarity and proactiveness in learning new systems. Enter as % of 5.",
    howMeasured_ar:
      "تقييم المشرف المباشر (1–5) على التنسيق الجماعي، ووضوح التواصل، والمبادرة في تعلم أنظمة جديدة. يُدخل كنسبة من 5.",
    weight: 0.05,
    target: 0.8,
    inputType: "rating_5",
    inputHint: "Rating out of 5 (4/5 = 80%, Target 80%)",
    inputHint_ar: "التقييم من 5 (4 من 5 = 80%، الهدف 80%)",
  },
];

export interface PerformanceRating {
  tier: "Outstanding" | "Exceeds Expectations" | "Meets Expectations" | "Needs Improvement" | "Unsatisfactory";
  tier_ar: string;
  minScore: number;
  color: string;
  badgeClass: string;
  bgClass: string;
  description: string;
  description_ar: string;
}

export const RATING_SCALE: PerformanceRating[] = [
  {
    tier: "Outstanding",
    tier_ar: "ممتاز (أداء استثنائي)",
    minScore: 0.9,
    color: "#10b981", // emerald
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
    description: "Consistently exceeds standard targets across technical execution, integration, and collaboration.",
    description_ar: "يتجاوز باستمرار الأهداف المحددة في التنفيذ الفني وتكامل الأنظمة والتنسيق الميداني.",
  },
  {
    tier: "Exceeds Expectations",
    tier_ar: "يتجاوز التوقعات",
    minScore: 0.75,
    color: "#3b82f6", // blue
    badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
    description: "Performs above requirements with dependable execution and proactive issue resolution.",
    description_ar: "يؤدي بكفاءة أعلى من المتطلبات، مع تنفيذ موثوق وحل استباقي للمشكلات الفنية.",
  },
  {
    tier: "Meets Expectations",
    tier_ar: "يحقق التوقعات",
    minScore: 0.6,
    color: "#f59e0b", // amber
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    bgClass: "bg-amber-50 dark:bg-amber-950/20",
    description: "Meets expected job benchmarks with solid delivery on scheduled tasks and site support.",
    description_ar: "يلبي معايير العمل المتوقعة بأداء مستقر وتسليم المهام الميدانية في مواعيدها.",
  },
  {
    tier: "Needs Improvement",
    tier_ar: "يحتاج إلى تحسين",
    minScore: 0.4,
    color: "#f97316", // orange
    badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    bgClass: "bg-orange-50 dark:bg-orange-950/20",
    description: "Key targets fell short; requires structured coaching in programming, schedule, or site coordination.",
    description_ar: "دون الأهداف الرئيسية في بعض المجالات؛ يتطلب خطة تدريب وتوجيه منظم في البرمجة والتنسيق.",
  },
  {
    tier: "Unsatisfactory",
    tier_ar: "غير مرضٍ",
    minScore: 0.0,
    color: "#ef4444", // red
    badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    bgClass: "bg-rose-50 dark:bg-rose-950/20",
    description: "Fails to meet minimum engineering standards or recurring unresolved technical errors.",
    description_ar: "إخفاق في تلبية الحد الأدنى من المعايير الهندسية أو تكرار الأخطاء الفنية دون علاج.",
  },
];

export function getRatingFromScore(score: number | null): PerformanceRating {
  if (score === null || isNaN(score)) {
    return {
      tier: "Unsatisfactory",
      tier_ar: "غير متوفر",
      minScore: 0,
      color: "#94a3b8",
      badgeClass: "bg-muted text-muted-foreground border-border",
      bgClass: "bg-muted/30",
      description: "No evaluation entered yet.",
      description_ar: "لم يتم إدخال بيانات التقييم بعد.",
    };
  }
  for (const rating of RATING_SCALE) {
    if (score >= rating.minScore) return rating;
  }
  return RATING_SCALE[RATING_SCALE.length - 1];
}

/**
 * Calculates achievement % given actual value and target.
 * Excel Formula: =IF(Actual="","",MIN(Actual/Target, 1))
 */
export function calculateAchievement(actual: number | null | undefined, target: number): number | null {
  if (actual === null || actual === undefined || isNaN(actual)) return null;
  return Math.min(1.0, actual / target);
}

/**
 * Calculates score given achievement and weight.
 * Excel Formula: =IF(Achv="","",Achv*Weight)
 */
export function calculateScore(achievement: number | null, weight: number): number | null {
  if (achievement === null || isNaN(achievement)) return null;
  return achievement * weight;
}

/**
 * Calculates annual score as average of valid quarterly scores.
 * Excel Formula: =IFERROR(AVERAGE(Q1, Q2, Q3, Q4), "")
 */
export function calculateAnnualScore(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => typeof s === "number" && !isNaN(s));
  if (!valid.length) return null;
  const sum = valid.reduce((acc, s) => acc + s, 0);
  return sum / valid.length;
}

/**
 * Initialize clean state for all 17 KPIs.
 */
export function createEmptyEvaluationState(): Record<number, KpiRowState> {
  const state: Record<number, KpiRowState> = {};
  for (const kpi of LIGHT_CURRENT_ENGINEER_KPIS) {
    state[kpi.id] = {
      id: kpi.id,
      q1: { actual: null, achievement: null, score: null },
      q2: { actual: null, achievement: null, score: null },
      q3: { actual: null, achievement: null, score: null },
      q4: { actual: null, achievement: null, score: null },
      annualScore: null,
    };
  }
  return state;
}

/**
 * Generates realistic sample data for demo/previewing the scorecard calculations.
 */
export function createMockEvaluationState(): Record<number, KpiRowState> {
  const state: Record<number, KpiRowState> = {};
  const sampleActuals: Record<number, [number, number, number, number]> = {
    1: [0.96, 0.94, 0.97, 0.95],
    2: [0.90, 0.88, 0.92, 0.91],
    3: [0.88, 0.90, 0.92, 0.95],
    4: [0.85, 0.90, 0.90, 0.92],
    5: [0.90, 0.92, 0.91, 0.94],
    6: [0.88, 0.90, 0.95, 0.92],
    7: [0.92, 0.95, 0.91, 0.94],
    8: [0.90, 0.89, 0.92, 0.91],
    9: [1.00, 1.00, 0.95, 1.00],
    10: [0.80, 0.85, 0.90, 0.85],
    11: [0.88, 0.92, 0.90, 0.94],
    12: [1.00, 0.90, 1.00, 0.95],
    13: [1.00, 1.00, 0.85, 1.00],
    14: [0.80, 0.80, 1.00, 1.00],
    15: [0.80, 0.85, 0.85, 0.90],
    16: [0.85, 0.80, 0.85, 0.85],
    17: [0.90, 0.85, 0.90, 0.90],
  };

  for (const kpi of LIGHT_CURRENT_ENGINEER_KPIS) {
    const [a1, a2, a3, a4] = sampleActuals[kpi.id] ?? [0.9, 0.9, 0.9, 0.9];
    const achv1 = calculateAchievement(a1, kpi.target);
    const score1 = calculateScore(achv1, kpi.weight);

    const achv2 = calculateAchievement(a2, kpi.target);
    const score2 = calculateScore(achv2, kpi.weight);

    const achv3 = calculateAchievement(a3, kpi.target);
    const score3 = calculateScore(achv3, kpi.weight);

    const achv4 = calculateAchievement(a4, kpi.target);
    const score4 = calculateScore(achv4, kpi.weight);

    const annual = calculateAnnualScore([score1, score2, score3, score4]);

    state[kpi.id] = {
      id: kpi.id,
      q1: { actual: a1, achievement: achv1, score: score1 },
      q2: { actual: a2, achievement: achv2, score: score2 },
      q3: { actual: a3, achievement: achv3, score: score3 },
      q4: { actual: a4, achievement: achv4, score: score4 },
      annualScore: annual,
    };
  }
  return state;
}
