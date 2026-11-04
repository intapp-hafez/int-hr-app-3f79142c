/**
 * Dynamic Job Description Engine
 * Synthesizes job description duties, operational pillars, and competencies
 * dynamically from employee profile details and matched KPI template criteria.
 */

export interface JobDutyItem {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  benchmark?: string;
  weight?: number;
  category?: string;
}

export interface JobDutyPillar {
  number: string;
  titleEn: string;
  titleAr: string;
  color: "emerald" | "blue" | "purple" | "amber" | "rose" | "teal" | "indigo";
  duties: JobDutyItem[];
}

export interface CompetencyBadge {
  en: string;
  ar: string;
  level?: string;
}

export interface DynamicJobDescriptionData {
  positionTitleEn: string;
  positionTitleAr: string;
  departmentNameEn: string;
  departmentNameAr: string;
  jobGrade: string;
  managerName: string;
  employeeCode: string;
  contractType: string;
  purposeEn: string;
  purposeAr: string;
  pillars: JobDutyPillar[];
  technicalCompetencies: CompetencyBadge[];
  behavioralCompetencies: CompetencyBadge[];
  commonWeightPct: number;
  positionWeightPct: number;
  totalMetricsCount: number;
}

const PILLAR_COLORS: ("emerald" | "blue" | "purple" | "amber" | "rose" | "teal" | "indigo")[] = [
  "emerald",
  "blue",
  "purple",
  "amber",
  "rose",
  "teal",
  "indigo",
];

const CATEGORY_NAMES: Record<string, { en: string; ar: string }> = {
  technical: { en: "Technical Execution & Core Deliverables", ar: "التنفيذ التخصصي والمهام الفنية" },
  quality: { en: "Quality Assurance & Compliance", ar: "معايير الجودة والامتثال" },
  productivity: { en: "Productivity & Milestones Delivery", ar: "الإنتاجية ومواعيد الإنجاز" },
  safety: { en: "Occupational Safety & Site HSE", ar: "السلامة المهنية وضوابط العمل" },
  coordination: { en: "Cross-Discipline Coordination", ar: "التنسيق المشترك وإدارة العمليات" },
  behavioral: { en: "Professional Conduct & Standards", ar: "السلوك المهني ومعايير العمل" },
};

/**
 * Builds a dynamic Job Description from employee profile and matched template.
 */
export function buildDynamicJobDescription(
  profile: any,
  template: any,
  managerFallback?: string
): DynamicJobDescriptionData {
  const positionTitleEn =
    profile?.position ||
    template?.position?.name_en ||
    template?.name_en ||
    "Specialist";
  const positionTitleAr =
    profile?.position_ar ||
    template?.position?.name_ar ||
    template?.name_ar ||
    positionTitleEn;

  const departmentNameEn =
    profile?.department ||
    template?.department?.name_en ||
    "Integrated Technics";
  const departmentNameAr =
    template?.department?.name_ar ||
    departmentNameEn;

  const jobGrade = profile?.job_grade || template?.job_grade?.name_en || "Senior Officer / G04";
  const managerName = profile?.manager || managerFallback || "Direct Manager";
  const employeeCode = profile?.emp_code || "EMP-0001";
  const contractType = profile?.contract_type || "FullTime";

  // 1. Dynamic Purpose Synthesis
  let purposeEn = template?.description?.trim() || "";
  let purposeAr = "";

  if (!purposeEn) {
    purposeEn = `Directly responsible for executing and overseeing ${positionTitleEn} responsibilities within the ${departmentNameEn} department. Ensures operational excellence, strict adherence to quality and engineering standards, and achievement of organizational goals within approved timelines.`;
    purposeAr = `المسؤولية المباشرة عن قيادة وتنفيذ مهام ومسؤوليات ${positionTitleAr} ضمن إدارة ${departmentNameAr}، وضمان التميز التشغيلي والالتزام الصارم بمعايير الجودة والأداء المؤسسي والأهداف المعتمدة وفقاً للجدول الزمني.`;
  } else {
    purposeAr = `المسؤولية التنفيذية والمهنية المعتمدة لـ ${positionTitleAr} ضمن إدارة ${departmentNameAr}، والالتزام بمعايير الأداء والتقييم المؤسسي المعتمد.`;
  }

  // 2. Dynamic Pillars & Duties from Template Criteria
  const items: any[] = template?.items || [];
  let pillars: JobDutyPillar[] = [];

  if (items.length > 0) {
    // Check if items have structured subdomains in description_en or how_measured_en
    const hasSubdomains = items.some(
      (it) => it.criterion?.description_en && it.criterion.description_en.length < 50
    );

    if (hasSubdomains) {
      // Group by subdomain / functional area
      const domainMap = new Map<string, any[]>();
      items.forEach((it) => {
        const domain = it.criterion?.description_en?.trim() || it.criterion?.category || "General";
        if (!domainMap.has(domain)) domainMap.set(domain, []);
        domainMap.get(domain)!.push(it);
      });

      let pIndex = 0;
      domainMap.forEach((domainItems, domainName) => {
        const firstCrit = domainItems[0]?.criterion;
        const titleEn = domainName;
        const titleAr = firstCrit?.description_ar?.trim() || firstCrit?.name_ar || domainName;

        pillars.push({
          number: String(pIndex + 1).padStart(2, "0"),
          titleEn,
          titleAr,
          color: PILLAR_COLORS[pIndex % PILLAR_COLORS.length],
          duties: domainItems.map((it, dIdx) => ({
            id: it.criterion_id || String(dIdx),
            nameEn: it.criterion?.name_en || `Responsibility ${dIdx + 1}`,
            nameAr: it.criterion?.name_ar || it.criterion?.name_en || `المسؤولية ${dIdx + 1}`,
            descriptionEn: it.criterion?.how_measured_en || it.criterion?.description_en || "",
            descriptionAr: it.criterion?.how_measured_ar || it.criterion?.description_ar || "",
            benchmark: it.target_benchmark ? `${it.target_benchmark}${it.unit || "%"}` : undefined,
            weight: it.weight ? Number(it.weight) * 100 : undefined,
            category: it.criterion?.category,
          })),
        });
        pIndex++;
      });
    } else {
      // Group by Criterion Category (technical, quality, productivity, safety, coordination, behavioral)
      const catMap = new Map<string, any[]>();
      items.forEach((it) => {
        const cat = it.criterion?.category || "technical";
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push(it);
      });

      let pIndex = 0;
      catMap.forEach((catItems, catKey) => {
        const catName = CATEGORY_NAMES[catKey] || {
          en: catKey.charAt(0).toUpperCase() + catKey.slice(1),
          ar: catKey,
        };

        pillars.push({
          number: String(pIndex + 1).padStart(2, "0"),
          titleEn: catName.en,
          titleAr: catName.ar,
          color: PILLAR_COLORS[pIndex % PILLAR_COLORS.length],
          duties: catItems.map((it, dIdx) => ({
            id: it.criterion_id || String(dIdx),
            nameEn: it.criterion?.name_en || `Responsibility ${dIdx + 1}`,
            nameAr: it.criterion?.name_ar || it.criterion?.name_en || `المسؤولية ${dIdx + 1}`,
            descriptionEn: it.criterion?.description_en || it.criterion?.how_measured_en || "",
            descriptionAr: it.criterion?.description_ar || it.criterion?.how_measured_ar || "",
            benchmark: it.target_benchmark ? `${it.target_benchmark}${it.unit || "%"}` : undefined,
            weight: it.weight ? Number(it.weight) * 100 : undefined,
            category: it.criterion?.category,
          })),
        });
        pIndex++;
      });
    }
  }

  // 3. Fallback Dynamic Domain Synthesis if template has no items
  if (pillars.length === 0) {
    pillars = generateFallbackPillarsForRole(positionTitleEn, positionTitleAr, departmentNameEn);
  }

  // 4. Dynamic Competencies Extraction
  const technicalCompetencies: CompetencyBadge[] = [];
  const behavioralCompetencies: CompetencyBadge[] = [];

  if (items.length > 0) {
    const seenTech = new Set<string>();
    const seenBehav = new Set<string>();

    items.forEach((it) => {
      const crit = it.criterion;
      if (!crit) return;

      const isBehavioral = crit.category === "behavioral" || crit.category === "safety" || crit.category === "coordination";
      const conceptEn = crit.name_en?.trim();
      const conceptAr = crit.name_ar?.trim() || conceptEn;

      if (isBehavioral) {
        if (!seenBehav.has(conceptEn) && seenBehav.size < 6) {
          seenBehav.add(conceptEn);
          behavioralCompetencies.push({ en: conceptEn, ar: conceptAr });
        }
      } else {
        if (!seenTech.has(conceptEn) && seenTech.size < 8) {
          seenTech.add(conceptEn);
          technicalCompetencies.push({ en: conceptEn, ar: conceptAr });
        }
      }
    });
  }

  // Ensure default competencies exist if empty
  if (technicalCompetencies.length === 0) {
    technicalCompetencies.push(
      { en: `${positionTitleEn} Domain Knowledge`, ar: `المعرفة التخصصية بـ ${positionTitleAr}` },
      { en: "Standards & Specifications", ar: "المعايير والمواصفات الفنية" },
      { en: "Systems Operation & Tools", ar: "تشغيل الأنظمة والأدوات" },
      { en: "Quality & Process Compliance", ar: "ضمان الجودة والامتثال الإجرائي" }
    );
  }

  if (behavioralCompetencies.length === 0) {
    behavioralCompetencies.push(
      { en: "Attendance & Professional Punctuality", ar: "الانضباط والالتزام بمواعيد العمل" },
      { en: "Teamwork & Cross-functional Collaboration", ar: "العمل الجماعي والتعاون المشترك" },
      { en: "Problem Solving & Analytical Thinking", ar: "حل المشكلات والتفكير التحليلي" },
      { en: "Confidentiality & Code of Conduct", ar: "السرية والالتزام بميثاق السلوك المهني" }
    );
  }

  return {
    positionTitleEn,
    positionTitleAr,
    departmentNameEn,
    departmentNameAr,
    jobGrade,
    managerName,
    employeeCode,
    contractType,
    purposeEn,
    purposeAr,
    pillars,
    technicalCompetencies,
    behavioralCompetencies,
    commonWeightPct: Number(template?.common_weight_pct ?? 40),
    positionWeightPct: Number(template?.position_weight_pct ?? 60),
    totalMetricsCount: items.length || pillars.reduce((sum, p) => sum + p.duties.length, 0),
  };
}

/**
 * Generates tailored fallback pillars based on position title keywords.
 */
function generateFallbackPillarsForRole(
  posEn: string,
  posAr: string,
  deptEn: string
): JobDutyPillar[] {
  const pLower = posEn.toLowerCase();
  const dLower = deptEn.toLowerCase();

  // HR / People Operations
  if (pLower.includes("hr") || pLower.includes("human") || pLower.includes("talent") || dLower.includes("hr")) {
    return [
      {
        number: "01",
        titleEn: "Talent Acquisition & Sourcing",
        titleAr: "استقطاب المواهب والتوظيف",
        color: "emerald",
        duties: [
          {
            id: "hr-1",
            nameEn: "Time-to-Fill & Recruitment Velocity",
            nameAr: "تحقيق المستهدف الزمني للتوظيف",
            descriptionEn: "Managing end-to-end talent sourcing, candidate screening, and vacancy closures.",
            descriptionAr: "إدارة عمليات استقطاب الكفاءات والمقابلات وإغلاق الشواغر وفقاً للجدول الزمني.",
          },
          {
            id: "hr-2",
            nameEn: "Candidate Experience & Quality of Hire",
            nameAr: "جودة التعيينات وتجربة المرشحين",
            descriptionEn: "Ensuring top-tier candidate assessment and high post-probation retention.",
            descriptionAr: "تقييم الكفاءات وضمان معدلات استبقاء عالية بعد انتهاء فترة الاختبار.",
          },
        ],
      },
      {
        number: "02",
        titleEn: "Onboarding & Employee Experience",
        titleAr: "التهيئة والاندماج الوظيفي",
        color: "blue",
        duties: [
          {
            id: "hr-3",
            nameEn: "New Hire Induction & Orientation",
            nameAr: "برامج التهيئة والتعريف بالعمل",
            descriptionEn: "Facilitating seamless documentation, equipment handover, and culture orientation.",
            descriptionAr: "تسليم الوثائق والتعريف ببيئة العمل وسياسات الشركة للموظفين الجدد.",
          },
        ],
      },
      {
        number: "03",
        titleEn: "Performance Management & OD",
        titleAr: "إدارة الأداء والتطوير التنظيمي",
        color: "purple",
        duties: [
          {
            id: "hr-4",
            nameEn: "KPI Goal Setting & Appraisal Cycles",
            nameAr: "تحديد مؤشرات الأداء ودورات التقييم",
            descriptionEn: "Overseeing appraisal cycles, feedback tracking, and developmental action plans.",
            descriptionAr: "متابعة دورات تقييم الأداء ومراجعة الملاحظات وخطط التطوير الفردية.",
          },
        ],
      },
      {
        number: "04",
        titleEn: "Policy Compliance & Labor Law",
        titleAr: "الامتثال وقوانين العمل",
        color: "amber",
        duties: [
          {
            id: "hr-5",
            nameEn: "Statutory Filing & Confidentiality",
            nameAr: "الالتزام باللوائح والسرية المهنية",
            descriptionEn: "Ensuring strict confidentiality and alignment with statutory regulations.",
            descriptionAr: "الحفاظ على سرية البيانات والالتزام بالقوانين المنظمة لشؤون العاملين.",
          },
        ],
      },
    ];
  }

  // Software / IT
  if (pLower.includes("software") || pLower.includes("developer") || pLower.includes("it") || dLower.includes("it")) {
    return [
      {
        number: "01",
        titleEn: "System Design & Architecture",
        titleAr: "تصميم وهندسة النظم",
        color: "emerald",
        duties: [
          {
            id: "it-1",
            nameEn: "Technical Architecture & Scalability",
            nameAr: "المعمارية التقنية وتوسعية الأنظمة",
            descriptionEn: "Design robust, maintainable backend and frontend modules per architectural guidelines.",
            descriptionAr: "تصميم وبرمجة الوحدات البرمجية وفقاً لأعلى معايير التوسعية والاستقرار.",
          },
        ],
      },
      {
        number: "02",
        titleEn: "Sprint Delivery & Code Quality",
        titleAr: "التسليم في السبرنت وجودة الأكواد",
        color: "blue",
        duties: [
          {
            id: "it-2",
            nameEn: "On-Time Story Delivery & Testing",
            nameAr: "إنجاز المهام البرمجية والاختبارات",
            descriptionEn: "Delivering sprint backlog tasks with unit tests and minimal production defect escapes.",
            descriptionAr: "تسليم المهام البرمجية مع الاختبارات الآلية والحد من الأعطال التشغيلية.",
          },
        ],
      },
      {
        number: "03",
        titleEn: "Code Review & Continuous Integration",
        titleAr: "مراجعة الأكواد والتكامل المستمر",
        color: "purple",
        duties: [
          {
            id: "it-3",
            nameEn: "Peer Code Reviews & Knowledge Sharing",
            nameAr: "مراجعة الأكواد ومشاركة المعرفة",
            descriptionEn: "Conducting rigorous peer reviews and maintaining CI/CD pipeline integrity.",
            descriptionAr: "المراجعة الفنية لكود الزملاء والحفاظ على سلاسة التكامل والنشر المستمر.",
          },
        ],
      },
    ];
  }

  // Finance / Accounting
  if (pLower.includes("account") || pLower.includes("financ") || dLower.includes("financ")) {
    return [
      {
        number: "01",
        titleEn: "Financial Accounting & General Ledger",
        titleAr: "المحاسبة المالية ودفتر الأستاذ",
        color: "emerald",
        duties: [
          {
            id: "fin-1",
            nameEn: "Monthly Closing & Ledger Reconciliation",
            nameAr: "الإقفال المالي الشهري ومطابقة الحسابات",
            descriptionEn: "Timely journal entries, monthly closing reconciliations, and trial balance accuracy.",
            descriptionAr: "تسجيل القيود المحاسبية والإقفال الشهري ومطابقة ميزان المراجعة بدقة.",
          },
        ],
      },
      {
        number: "02",
        titleEn: "Accounts Payable & Invoicing",
        titleAr: "الحسابات الدائنة والفواتير",
        color: "blue",
        duties: [
          {
            id: "fin-2",
            nameEn: "Invoice Verification & Payment Processing",
            nameAr: "مراجعة الفواتير ومعالجة المدفوعات",
            descriptionEn: "Auditing vendor invoices, purchase orders, and payment approvals.",
            descriptionAr: "مراجعة فواتير الموردين وأوامر الشراء واعتماد أوامر الدفع.",
          },
        ],
      },
      {
        number: "03",
        titleEn: "Statutory Compliance & Tax Filing",
        titleAr: "الامتثال الضريبي والتقارير القانونية",
        color: "purple",
        duties: [
          {
            id: "fin-3",
            nameEn: "Tax Declarations & Audit Readiness",
            nameAr: "الإقرارات الضريبية والجاهزية للمراجعة",
            descriptionEn: "Accurate VAT and corporate tax filings and support for internal/external audits.",
            descriptionAr: "إعداد الإقرارات الضريبية والتعاون مع مراجعي الحسابات الماليين.",
          },
        ],
      },
    ];
  }

  // Default Engineering / Site
  return [
    {
      number: "01",
      titleEn: "Field Engineering & Technical Execution",
      titleAr: "التنفيذ الفني والهندسة الميدانية",
      color: "emerald",
      duties: [
        {
          id: "eng-1",
          nameEn: "Installation & Technical Delivery",
          nameAr: "التركيبات والتنفيذ الفني",
          descriptionEn: "Supervising installation, conduit laying, and equipment mounting per specifications.",
          descriptionAr: "الإشراف على أعمال التركيبات ومسارات الكابلات وتثبيت الأجهزة وفقاً للمخططات.",
        },
      ],
    },
    {
      number: "02",
      titleEn: "Commissioning & Testing Handover",
      titleAr: "التشغيل والاختبار والتسليم",
      color: "blue",
      duties: [
        {
          id: "eng-2",
          nameEn: "Testing, Configuration & Acceptance",
          nameAr: "البرمجة والاختبار والتسليم للاستشاري",
          descriptionEn: "System programming, diagnostic loop testing, and formal T&C sign-offs.",
          descriptionAr: "برمجة الأنظمة واختبارات التشغيل والتسليم الرسمي لاستشاري المشروع.",
        },
      ],
    },
    {
      number: "03",
      titleEn: "Site Safety & Quality Compliance",
      titleAr: "السلامة المهنية وضمان الجودة",
      color: "rose",
      duties: [
        {
          id: "eng-3",
          nameEn: "HSE Standards & Daily Documentation",
          nameAr: "معايير السلامة وتوثيق الأعمال اليومية",
          descriptionEn: "Adherence to PPE site rules, zero defect policy, and accurate daily diary submissions.",
          descriptionAr: "الالتزام بمهمات السلامة المهنية ومتابعة التقارير اليومية للأعمال.",
        },
      ],
    },
  ];
}

