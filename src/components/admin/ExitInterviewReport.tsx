import { useState, useMemo } from "react";
import {
  useEmployeePicker,
  EmployeePicker,
  EmployeeDocName,
  EditableText,
} from "./HrDocuments";
import {
  UserCheck,
  CheckCircle2,
  Printer,
  RotateCcw,
  Sparkles,
  Building2,
  Calendar,
  Briefcase,
  Star,
  MessageSquare,
  HelpCircle,
  FileCheck,
} from "lucide-react";
import { formatDate, todayISO } from "@/lib/date-format";

type RatingValue = 1 | 2 | 3 | 4 | 5 | 0;

export function ExitInterviewReport() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  // Primary Reason for leaving
  const [primaryReason, setPrimaryReason] = useState<string>("الاستقالة");
  const [resignationReasons, setResignationReasons] = useState<string[]>([
    "عرض عمل أفضل ومزايا تنافسية",
  ]);

  // Employee Experience
  const [satisfactionLikes, setSatisfactionLikes] = useState<string[]>([
    "الزملاء",
    "طبيعة العمل",
  ]);
  const [satisfactionDislikes, setSatisfactionDislikes] = useState<string[]>([
    "ضغط العمل",
  ]);

  // Expectations
  const [matchedExpectations, setMatchedExpectations] = useState<string>("نعم");

  // Ratings: Work Environment (1-5)
  const [envRatings, setEnvRatings] = useState<Record<string, RatingValue>>({
    "ظروف العمل العامة": 4,
    "تعاون الزملاء بروح الفريق": 5,
    "التعاون والتنسيق مع الإدارات الأخرى": 4,
    "الأجهزة والمعدات المستخدمة": 4,
    "التكنولوجيا والأنظمة المستخدمة": 4,
    "التدريب والتطوير المستمر": 3,
    "تداول وانسيابية المعلومات داخل الإدارة": 4,
    "وضوح السياسات المالية والمزايا": 3,
    "الروح المعنوية والعلاقات بين الزملاء": 5,
    "الروح المعنوية داخل الإدارة": 4,
    "مستوى ضغط العمل والمهام": 3,
    "مستوى الراتب مقارنة بالسوق": 3,
    "المزايا المالية والعينية والتأمين": 4,
  });

  // Ratings: Direct Manager (1-5)
  const [mgrRatings, setMgrRatings] = useState<Record<string, RatingValue>>({
    "التواصل الفعال مع الموظفين": 4,
    "الدعم والتوجيه المهني": 4,
    "العدالة والإنصاف في توزيع العمل": 4,
    "وضوح الأهداف والتوقعات": 4,
    "المتابعة والتغذية الراجعة البناءة": 4,
    "التقدير والتحفيز المستمر": 4,
    "التعامل باحترام واحترافية": 5,
  });

  // Performance discussions frequency
  const [perfFreq, setPerfFreq] = useState<string>("شهرياً");
  const [canTalkToMgr, setCanTalkToMgr] = useState<string>("نعم");

  // Return & Recommendation
  const [wouldReturn, setWouldReturn] = useState<string>("نعم");
  const [wouldRecommend, setWouldRecommend] = useState<string>("نعم");

  // Handover
  const [handoverDone, setHandoverDone] = useState<string>("نعم");

  // Compute Service Duration
  const startDate = e?.contract_start_date;
  const endDate =
    e?.contract_end_date || e?.last_action_date || todayISO();

  const serviceDuration = useMemo(() => {
    if (!startDate) return "—";
    try {
      const s = new Date(startDate);
      const end = new Date(endDate);
      const diffMonths =
        (end.getFullYear() - s.getFullYear()) * 12 +
        (end.getMonth() - s.getMonth());
      if (diffMonths < 1) return "أقل من شهر";
      const years = Math.floor(diffMonths / 12);
      const months = diffMonths % 12;
      const parts: string[] = [];
      if (years > 0) parts.push(`${years} ${years === 1 ? "سنة" : "سنوات"}`);
      if (months > 0) parts.push(`${months} ${months === 1 ? "شهر" : "أشهر"}`);
      return parts.join(" و ");
    } catch {
      return "—";
    }
  }, [startDate, endDate]);

  const toggleResignationReason = (val: string) => {
    setResignationReasons((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  const toggleLike = (val: string) => {
    setSatisfactionLikes((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  const toggleDislike = (val: string) => {
    setSatisfactionDislikes((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  // Calculate Average Environmental Score
  const envValues = Object.values(envRatings).filter((v) => v > 0);
  const avgEnvScore =
    envValues.length > 0
      ? (envValues.reduce<number>((a, b) => a + b, 0) / envValues.length).toFixed(1)
      : "—";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex-1 max-w-xl">
          <EmployeePicker
            picker={picker}
            label="Select Employee for Exit Interview (مقابلة نهاية الخدمة)"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            disabled={!picker.employeeId}
            onClick={() => window.print()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-40 transition"
          >
            <Printer className="h-4 w-4" /> Print Exit Interview Report
          </button>
        </div>
      </div>

      {!picker.employeeId ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">
          <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <h3 className="font-display text-base font-semibold text-foreground">
            No employee selected
          </h3>
          <p className="mt-1 text-sm">
            Select an employee from the dropdown above to load and fill out their Exit Interview report.
          </p>
        </div>
      ) : picker.loading || !e ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
          <p className="text-sm">Loading employee exit record…</p>
        </div>
      ) : (
        <div
          id="hr-doc-print-area"
          dir="rtl"
          className="mx-auto w-full max-w-4xl bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none font-medium text-[13px] leading-relaxed"
          style={{
            fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif",
          }}
        >
          {/* Document Header */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
            <div className="flex items-center gap-3">
              <img
                src="/int-logo%20for%20docx.png"
                alt="Integrated Technics Logo"
                className="h-16 object-contain"
              />
              <div className="text-right">
                <div className="font-bold text-base text-gray-900">
                  شركة التقنيات المتكاملة للتجارة والتوكيلات (ش.م.م)
                </div>
                <div className="text-xs text-gray-600 font-sans tracking-wide">
                  Integrated Technics for Trading & Agencies
                </div>
              </div>
            </div>

            <div className="border-2 border-black rounded-2xl px-5 py-2 text-center bg-gray-50/80">
              <div className="font-bold text-lg text-black">
                تقرير مقابلة نهاية الخدمة
              </div>
              <div className="text-xs text-gray-700 font-sans font-semibold tracking-wider">
                EXIT INTERVIEW REPORT
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                تاريخ المقابلة: {formatDate(todayISO())}
              </div>
            </div>
          </div>

          <div className="text-center font-bold text-xs text-gray-600 mb-6 bg-gray-100 py-1.5 rounded-lg border border-gray-300">
            نموذج تقييم تجربة الموظف، تحليل أسباب ترك العمل، وتطوير بيئة العمل الداخلي
          </div>

          {/* Section 1: Personal & Employment Info */}
          <div className="mb-6 rounded-xl border border-black p-4 bg-gray-50/50">
            <div className="font-bold text-base border-b border-black pb-1.5 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
              <span>أولاً: البيانات الشخصية والوظيفية</span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">اسم الموظف:</span>
                <span className="font-bold text-base flex-1">
                  <EmployeeDocName e={e} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">الرقم الوظيفي:</span>
                <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 border border-gray-300 rounded">
                  {e.emp_code || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">القطاع / الإدارة:</span>
                <EditableText
                  value={e.department || "الإدارة الفنية والتشغيل"}
                  className="font-bold flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">القسم:</span>
                <EditableText
                  value={e.section || "الاتصالات والشبكات"}
                  className="font-bold flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">المسمى الوظيفي:</span>
                <EditableText
                  value={e.position || "مهندس اتصالات"}
                  className="font-bold flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">مدة الخدمة:</span>
                <span className="font-bold text-black">{serviceDuration}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">تاريخ بداية العمل:</span>
                <EditableText
                  value={startDate ? formatDate(startDate) : "01/01/2024"}
                  className="font-bold font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 w-28">تاريخ نهاية العمل:</span>
                <EditableText
                  value={formatDate(endDate)}
                  className="font-bold font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Reason for Leaving */}
          <div className="mb-6 rounded-xl border border-black p-4">
            <div className="font-bold text-base border-b border-black pb-1.5 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
              <span>ثانياً: سبب ترك العمل</span>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              {[
                "الاستقالة",
                "انتهاء عقد محدد المدة",
                "إنهاء الخدمة بالاتفاق الودي",
                "الفصل من الخدمة",
                "أخرى",
              ].map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-1.5 cursor-pointer text-sm font-bold"
                  onClick={() => setPrimaryReason(reason)}
                >
                  <span
                    className={`w-4 h-4 rounded border border-black flex items-center justify-center text-xs font-bold ${
                      primaryReason === reason ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    {primaryReason === reason ? "✓" : ""}
                  </span>
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {primaryReason === "الاستقالة" && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-400">
                <div className="text-xs font-bold text-gray-700 mb-2">
                  في حالة الاستقالة، هل كان السبب مرتبطاً بـ:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    "عرض عمل أفضل ومزايا تنافسية",
                    "مستوى الراتب والمزايا المالية",
                    "عدم وجود فرصة واضحة للترقي والتطور",
                    "ظروف العمل وبيئة العمل",
                    "سوء المعاملة أو عدم التوافق الإداري",
                    "طبيعة العمل نمطية ولا يوجد تجديد",
                    "أسباب شخصية / عائلية",
                    "بعد السكن وصعوبة وسائل النقل",
                    "عدم توافق قواعد الأمن والسلامة",
                    "الزواج / الحمل",
                  ].map((sub) => {
                    const isChecked = resignationReasons.includes(sub);
                    return (
                      <label
                        key={sub}
                        className="flex items-center gap-1.5 cursor-pointer font-medium"
                        onClick={() => toggleResignationReason(sub)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                            isChecked ? "bg-black text-white" : "bg-white"
                          }`}
                        >
                          {isChecked ? "✓" : ""}
                        </span>
                        <span>{sub}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-gray-800">
                تفاصيل إضافية أو ظروف خاصة بقرار ترك العمل:
              </div>
              <div className="border-b border-dotted border-black min-h-[24px] py-1">
                <EditableText
                  value="الانتقال إلى خطوة مهنية جديدة في مجال الشبكات والاتصالات مع رغبة في زيادة التخصص التقني."
                  className="w-full font-medium"
                />
              </div>

              <div className="text-xs font-bold text-gray-800 pt-2">
                ما الذي كان يمكن للشركة أن تقوم به، وكان ربما سيؤثر في قرارك بترك العمل؟
              </div>
              <div className="border-b border-dotted border-black min-h-[24px] py-1">
                <EditableText
                  value="توفير مسار ترقية وتدرج وظيفي معتمد، وبرامج تدريب متقدمة في أحدث تقنيات الاتصالات."
                  className="w-full font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Employee Experience & Feedback */}
          <div className="mb-6 rounded-xl border border-black p-4">
            <div className="font-bold text-base border-b border-black pb-1.5 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
              <span>ثالثاً: تجربة الموظف خلال فترة العمل</span>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-gray-800 block mb-1.5">
                  ما هي أكثر الأشياء التي جعلتك تشعر بالرضاء خلال فترة عملك؟
                </span>
                <div className="flex flex-wrap gap-3 text-xs">
                  {[
                    "الزملاء",
                    "الرؤساء",
                    "ظروف العمل",
                    "طبيعة العمل",
                    "فرص التعلم والتطور",
                    "الراتب والمزايا",
                    "ثقافة الشركة والتعاون",
                  ].map((item) => {
                    const checked = satisfactionLikes.includes(item);
                    return (
                      <label
                        key={item}
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => toggleLike(item)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                            checked ? "bg-black text-white" : "bg-white"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-800 block mb-1.5">
                  ما هي أقل الأشياء التي جعلتك تشعر بالرضاء خلال فترة عملك؟
                </span>
                <div className="flex flex-wrap gap-3 text-xs">
                  {[
                    "ضغط العمل",
                    "ظروف العمل",
                    "الراتب والمزايا",
                    "الروتين وبطء الإجراءات",
                    "الأسانسير / خدمات المبنى",
                    "الرؤساء",
                    "الزملاء",
                  ].map((item) => {
                    const checked = satisfactionDislikes.includes(item);
                    return (
                      <label
                        key={item}
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => toggleDislike(item)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                            checked ? "bg-black text-white" : "bg-white"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="text-xs font-bold text-gray-800 mb-1">
                    هل وجدت العمل الذي كنت تقوم به كما توقعت أن يكون؟
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    {["نعم", "إلى حد ما", "لا"].map((ans) => (
                      <label
                        key={ans}
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => setMatchedExpectations(ans)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                            matchedExpectations === ans
                              ? "bg-black text-white"
                              : "bg-white"
                          }`}
                        >
                          {matchedExpectations === ans ? "✓" : ""}
                        </span>
                        <span>{ans}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-gray-800 mb-1">
                    لو كان مختلفاً عما توقعت، ما هو هذا الاختلاف؟
                  </div>
                  <div className="border-b border-dotted border-black min-h-[22px]">
                    <EditableText
                      value="حجم المهام الميدانية والمشاريع كان أكبر بكثير من المتوقع."
                      className="w-full text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-800 mb-1">
                  في رأيك، ما هي الأشياء التي ترى أنها ستساهم في تحسين وتطوير هذه الوظيفة؟
                </div>
                <div className="border-b border-dotted border-black min-h-[22px]">
                  <EditableText
                    value="إضافة مهندس دعم إضافي للفريق لتوزيع ضغط العمل الميداني، وتسريع دورة اعتماد المشتريات الفنية."
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-800 mb-1">
                  ما هي السياسات والإجراءات التي تقترح مراجعتها أو تعديلها؟
                </div>
                <div className="border-b border-dotted border-black min-h-[22px]">
                  <EditableText
                    value="التقنيات شركة رائدة وكبيرة، تحتاج فقط إجراءات تشغيلية أكثر مرونة وسرعة لفرق العمل الميدانية."
                    className="w-full text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Page Break for clean multi-page print */}
          <div className="break-before-page pt-4"></div>

          {/* Section 4: Work Environment Evaluation Matrix (1-5) */}
          <div className="mb-6 rounded-xl border border-black p-4">
            <div className="flex items-center justify-between border-b border-black pb-1.5 mb-3">
              <div className="font-bold text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
                <span>رابعاً: تقييم بيئة العمل والخدمات الداخلية</span>
              </div>
              <div className="text-xs font-bold bg-black text-white px-2.5 py-0.5 rounded-full">
                متوسط التقييم: {avgEnvScore} / 5
              </div>
            </div>

            <div className="text-xs font-bold text-gray-600 mb-2">
              مقياس التقييم: 1 = سيئ | 2 = أقل من المتوسط | 3 = متوسط | 4 = فوق المتوسط | 5 = ممتاز
            </div>

            <table className="w-full border border-black text-center text-xs">
              <thead>
                <tr className="border-b border-black bg-gray-100 font-bold">
                  <th className="border-l border-black p-2 text-right w-52">
                    عنصر التقييم
                  </th>
                  <th className="border-l border-black p-1.5 w-16">١ سيئ</th>
                  <th className="border-l border-black p-1.5 w-20">٢ أقل من متوسط</th>
                  <th className="border-l border-black p-1.5 w-16">٣ متوسط</th>
                  <th className="border-l border-black p-1.5 w-20">٤ فوق متوسط</th>
                  <th className="p-1.5 w-16">٥ ممتاز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {Object.keys(envRatings).map((item, idx) => (
                  <tr key={item} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="border-l border-black p-1.5 font-bold text-right text-gray-900">
                      {idx + 1}. {item}
                    </td>
                    {[1, 2, 3, 4, 5].map((score) => {
                      const selected = envRatings[item] === score;
                      return (
                        <td
                          key={score}
                          onClick={() =>
                            setEnvRatings((prev) => ({
                              ...prev,
                              [item]: score as RatingValue,
                            }))
                          }
                          className="border-l border-gray-300 p-1 cursor-pointer hover:bg-gray-200 transition"
                        >
                          <span
                            className={`w-4 h-4 mx-auto rounded-full border border-black flex items-center justify-center text-[10px] font-bold ${
                              selected ? "bg-black text-white" : "bg-transparent"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 5: Direct Manager Evaluation */}
          <div className="mb-6 rounded-xl border border-black p-4">
            <div className="font-bold text-base border-b border-black pb-1.5 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
              <span>خامساً: تقييم الإدارة والمدير المباشر</span>
            </div>

            <table className="w-full border border-black text-center text-xs mb-4">
              <thead>
                <tr className="border-b border-black bg-gray-100 font-bold">
                  <th className="border-l border-black p-2 text-right w-52">
                    عنصر التقييم
                  </th>
                  <th className="border-l border-black p-1.5 w-16">١ سيئ</th>
                  <th className="border-l border-black p-1.5 w-20">٢ أقل من متوسط</th>
                  <th className="border-l border-black p-1.5 w-16">٣ متوسط</th>
                  <th className="border-l border-black p-1.5 w-20">٤ فوق متوسط</th>
                  <th className="p-1.5 w-16">٥ ممتاز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {Object.keys(mgrRatings).map((item, idx) => (
                  <tr key={item} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="border-l border-black p-1.5 font-bold text-right text-gray-900">
                      {idx + 1}. {item}
                    </td>
                    {[1, 2, 3, 4, 5].map((score) => {
                      const selected = mgrRatings[item] === score;
                      return (
                        <td
                          key={score}
                          onClick={() =>
                            setMgrRatings((prev) => ({
                              ...prev,
                              [item]: score as RatingValue,
                            }))
                          }
                          className="border-l border-gray-300 p-1 cursor-pointer hover:bg-gray-200 transition"
                        >
                          <span
                            className={`w-4 h-4 mx-auto rounded-full border border-black flex items-center justify-center text-[10px] font-bold ${
                              selected ? "bg-black text-white" : "bg-transparent"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-gray-800 block mb-1">
                  كم مرة قام مديرك بمناقشة وتقييم أداءك معك؟
                </span>
                <div className="flex flex-wrap gap-2 font-bold">
                  {["أسبوعياً", "شهرياً", "كل 3 أشهر", "عند الحاجة فقط", "نادراً"].map(
                    (f) => (
                      <label
                        key={f}
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => setPerfFreq(f)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                            perfFreq === f ? "bg-black text-white" : "bg-white"
                          }`}
                        >
                          {perfFreq === f ? "✓" : ""}
                        </span>
                        <span>{f}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div>
                <span className="font-bold text-gray-800 block mb-1">
                  هل كنت تشعر بحرية التحدث مع مديرك عن المقترحات أو المشاكل؟
                </span>
                <div className="flex items-center gap-3 font-bold">
                  {["نعم", "إلى حد ما", "لا"].map((ans) => (
                    <label
                      key={ans}
                      className="flex items-center gap-1 cursor-pointer"
                      onClick={() => setCanTalkToMgr(ans)}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                          canTalkToMgr === ans ? "bg-black text-white" : "bg-white"
                        }`}
                      >
                        {canTalkToMgr === ans ? "✓" : ""}
                      </span>
                      <span>{ans}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Retention & Recommendations */}
          <div className="mb-6 rounded-xl border border-black p-4">
            <div className="font-bold text-base border-b border-black pb-1.5 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
              <span>سادساً: استبقاء الكفاءات والتوصيات المستقبلية</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-gray-800 block mb-1">
                  ما السبب الرئيسي الذي تعتقد أنه قد يدفع الكفاءات لمغادرة العمل بالشركة؟
                </span>
                <div className="border-b border-dotted border-black min-h-[22px]">
                  <EditableText
                    value="فوارق الرواتب في السوق للمتخصصين، والبحث عن مسار ترقي أسرع وفرص تدريب معتمدة دولياً."
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <span className="font-bold text-gray-800 block mb-1">
                  ما هو الشيء الواحد الذي تقترح أن تبدأ الشركة في تحسينه فوراً؟
                </span>
                <div className="border-b border-dotted border-black min-h-[22px]">
                  <EditableText
                    value="تحديث هيكل الرواتب والبدلات للمهندسين والميدانيين، وإطلاق مراجعة دورية للأداء مع حوافز إنجاز."
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="font-bold text-gray-800 block mb-1">
                    في رأيك، هل تحب العودة للعمل بالشركة مستقبلاً؟
                  </span>
                  <div className="flex items-center gap-3 font-bold mb-1">
                    {["نعم", "ربما", "لا"].map((ans) => (
                      <label
                        key={ans}
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => setWouldReturn(ans)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                            wouldReturn === ans ? "bg-black text-white" : "bg-white"
                          }`}
                        >
                          {wouldReturn === ans ? "✓" : ""}
                        </span>
                        <span>{ans}</span>
                      </label>
                    ))}
                  </div>
                  <div className="border-b border-dotted border-black min-h-[20px]">
                    <EditableText
                      value="إذا توفرت فرصة إدارية أو إشرافية في المشاريع الكبرى."
                      className="w-full text-gray-700"
                    />
                  </div>
                </div>

                <div>
                  <span className="font-bold text-gray-800 block mb-1">
                    هل توصي بالعمل في الشركة لزملائك ومعارفك؟
                  </span>
                  <div className="flex items-center gap-3 font-bold mb-1">
                    {["نعم", "ربما", "لا"].map((ans) => (
                      <label
                        key={ans}
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => setWouldRecommend(ans)}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                            wouldRecommend === ans
                              ? "bg-black text-white"
                              : "bg-white"
                          }`}
                        >
                          {wouldRecommend === ans ? "✓" : ""}
                        </span>
                        <span>{ans}</span>
                      </label>
                    ))}
                  </div>
                  <div className="border-b border-dotted border-black min-h-[20px]">
                    <EditableText
                      value="نعم، شركة مستقرة ومحترمة وبيئة عمل مريحة وبها خبرات قوية."
                      className="w-full text-gray-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 7: Handover & Clearances */}
          <div className="mb-6 rounded-xl border border-black p-4">
            <div className="font-bold text-base border-b border-black pb-1.5 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
              <span>سابعاً: تسليم المهام والعهد وخروج الموظف</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-gray-800 block mb-1.5">
                  هل تم الانتهاء من تسليم المهام والملفات والعهد المطلوبة قبل المغادرة؟
                </span>
                <div className="flex items-center gap-3 font-bold">
                  {["نعم", "جزئياً", "لا"].map((ans) => (
                    <label
                      key={ans}
                      className="flex items-center gap-1 cursor-pointer"
                      onClick={() => setHandoverDone(ans)}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border border-black flex items-center justify-center text-[10px] font-bold ${
                          handoverDone === ans ? "bg-black text-white" : "bg-white"
                        }`}
                      >
                        {handoverDone === ans ? "✓" : ""}
                      </span>
                      <span>{ans}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold text-gray-800 block mb-1">
                  ملاحظات أو مهام يرجى التأكيد على متابعتها:
                </span>
                <div className="border-b border-dotted border-black min-h-[20px]">
                  <EditableText
                    value="تم تسليم كافة ملفات المشاريع والوثائق للمهندس البديل وإخلاء العهد بالكامل."
                    className="w-full text-gray-700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 8: Signatures & HR Internal Block */}
          <div className="rounded-xl border border-black p-4 bg-gray-50/60">
            <div className="grid grid-cols-2 gap-8 text-center text-sm font-bold pb-6 border-b border-gray-400">
              <div>
                <div className="mb-8">توقيع الموظف</div>
                <div className="w-56 mx-auto border-b-2 border-black"></div>
                <div className="text-xs text-gray-600 mt-1">
                  التاريخ: {formatDate(todayISO())}
                </div>
              </div>

              <div>
                <div className="mb-8">توقيع مسئول الموارد البشرية (HR)</div>
                <div className="w-56 mx-auto border-b-2 border-black"></div>
                <div className="text-xs text-gray-600 mt-1">
                  التاريخ: {formatDate(todayISO())}
                </div>
              </div>
            </div>

            {/* HR Internal Notes Block */}
            <div className="mt-4 pt-2 text-xs">
              <div className="font-bold text-gray-900 mb-2">
                للاستخدام الداخلي بإدارة الموارد البشرية (HR Internal Review):
              </div>
              <div className="grid grid-cols-3 gap-3 font-medium">
                <div>
                  <span className="font-bold text-gray-800">مُجري المقابلة: </span>
                  <EditableText value="إدارة الموارد البشرية" />
                </div>
                <div>
                  <span className="font-bold text-gray-800">تصنيف سبب المغادرة: </span>
                  <EditableText value="فرصة عمل أفضل" />
                </div>
                <div>
                  <span className="font-bold text-gray-800">متابعة مطلوبة: </span>
                  <EditableText value="لا توجد متابعة" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-bold text-gray-800 shrink-0">
                  توصيات وملاحظات HR:
                </span>
                <EditableText
                  value="موظف كفء ومحترم، تمت التوصية بالحفاظ على التواصل معه كمرشح محتمل لمشاريع مستقبلية."
                  className="flex-1 border-b border-dotted border-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
