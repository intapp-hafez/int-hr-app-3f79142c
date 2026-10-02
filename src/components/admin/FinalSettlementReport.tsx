import { useState } from "react";
import {
  useEmployeePicker,
  EmployeePicker,
  EmployeeDocName,
  EditableText,
} from "./HrDocuments";
import { formatDate, todayISO } from "@/lib/date-format";
import { Award, Printer, CheckCircle2, ShieldCheck, FileCheck, Layers } from "lucide-react";

export function FinalSettlementReport() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;
  const [docType, setDocType] = useState<"certificate" | "internalClearance">("certificate");

  const today = todayISO();
  const lastWorkDate = e?.contract_end_date || e?.last_action_date || today;

  // Day name in Arabic
  const dayName = new Date(lastWorkDate).toLocaleDateString("ar-EG", {
    weekday: "long",
  });

  return (
    <div className="space-y-4 pb-12">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex-1 max-w-xl">
          <EmployeePicker
            picker={picker}
            label="Select Employee for Final Settlement & Clearance (مخالصة وإخلاء طرف)"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDocType("certificate")}
              className={`rounded-lg px-3 py-1.5 transition ${
                docType === "certificate"
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              مخالصة نهائية وإخلاء طرف
            </button>
            <button
              type="button"
              onClick={() => setDocType("internalClearance")}
              className={`rounded-lg px-3 py-1.5 transition ${
                docType === "internalClearance"
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              إخلاء طرف داخلي وتسليم العهد
            </button>
          </div>
          <button
            type="button"
            disabled={!picker.employeeId}
            onClick={() => window.print()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-40 transition"
          >
            <Printer className="h-4 w-4" /> Print Document
          </button>
        </div>
      </div>

      {!picker.employeeId ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">
          <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <h3 className="font-display text-base font-semibold text-foreground">
            No employee selected
          </h3>
          <p className="mt-1 text-sm">
            Select an employee from the dropdown above to generate their official Final Settlement & Clearance document.
          </p>
        </div>
      ) : picker.loading || !e ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
          <p className="text-sm">Loading employee record…</p>
        </div>
      ) : (
        <div
          id="hr-doc-print-area"
          dir="rtl"
          className="mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-border bg-white p-12 text-gray-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none font-medium text-[15px] leading-loose"
          style={{
            fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif",
          }}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b-2 border-gray-800 pb-4">
            <img
              src="/int-logo%20for%20docx.png"
              alt="Integrated Technics Logo"
              className="h-16 object-contain"
            />
            <div className="text-left text-xs text-gray-600 font-sans">
              <p className="font-bold text-gray-900">
                شركة التقنيات المتكاملة للتجارة والتوكيلات (ش.م.م)
              </p>
              <p className="mt-0.5">
                Integrated Technics for Trading & Agencies
              </p>
              <p className="mt-1 font-semibold text-gray-700">
                تاريخ الإصدار: {formatDate(today)}
              </p>
            </div>
          </div>

          {docType === "certificate" ? (
            /* مخالصة نهائية وشهادة إخلاء طرف */
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold border-b-2 border-gray-900 pb-1 px-8 inline-block">
                  مخالصة نهائية وشهادة إخلاء طرف
                </h1>
                <div className="text-xs text-gray-600 font-sans font-semibold tracking-wider mt-1">
                  FINAL SETTLEMENT & CLEARANCE CERTIFICATE
                </div>
              </div>

              {/* Employee Summary Card */}
              <div className="rounded-xl border border-gray-800 p-4 bg-gray-50/70 text-sm leading-relaxed mb-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الاسم:</span>
                    <span className="font-bold text-base flex-1">
                      <EmployeeDocName e={e} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الكود:</span>
                    <span className="font-mono font-bold">
                      {e.emp_code || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الوظيفة:</span>
                    <EditableText
                      value={e.position || "مهندس"}
                      className="font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الرقم القومي:</span>
                    <EditableText
                      value={e.national_id || "—"}
                      className="font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الإدارة:</span>
                    <EditableText
                      value={e.department || "الإدارة الفنية"}
                      className="font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">تاريخ انتهاء العمل:</span>
                    <EditableText
                      value={formatDate(lastWorkDate)}
                      className="font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Settlement Clauses */}
              <div className="space-y-4 text-justify text-base leading-8 text-gray-900">
                <p>
                  بأنني كنت أعمل بشركة <strong>التقنيات المتكاملة</strong> وإنني
                  تركت العمل بتقديم استقالتي بناءً على رغبتي وبدون ضغط أو إكراه
                  لظروف شخصية خاصة بي في يوم{" "}
                  <strong>
                    <EditableText value={dayName} />
                  </strong>{" "}
                  الموافق{" "}
                  <strong className="font-mono">
                    <EditableText value={formatDate(lastWorkDate)} />
                  </strong>
                  .
                </p>

                <p>
                  وأقر بأنني <strong>استلمت كافة حقوقي المالية والعينية</strong>{" "}
                  من الشركة خلال فترة عملي بالشركة كاملة، وأنه ليست في عهدتي أو
                  حيازتي أي عهدة مالية أو عينية أو أي مستندات أصلية أو صور منها
                  أو أجهزة أو عُدد أو آلات أو برامج كمبيوتر تخص نشاط الشركة.
                </p>

                <p>
                  كما أقر بتنازلي عن أي إجازات سابقة (إجازات اعتيادية أو عارضة أو
                  أي إجازات أخرى من أي نوع كان) لم أحصل عليها منذ تعييني بالشركة
                  وحتى تاريخه وذلك بسبب عدم مطالبتي بالحصول عليها، ولا يجوز لي
                  الرجوع على الشركة بأي مستحقات بشأنها من أي نوع كان حالياً أو
                  مستقبلاً.
                </p>

                <p>
                  كما أقر بأنني أحافظ على أسرار الشركة المالية والفنية التي عرفتها
                  وتعلمتها خلال فترة عملي بالشركة بما لا يضر بمصلحة شركة{" "}
                  <strong>التقنيات المتكاملة</strong>، وإذا ظهر خلاف ذلك يحق
                  للسيد المهندس /{" "}
                  <strong>وليد نبيل عبد الوهاب علي</strong> – رئيس مجلس الإدارة
                  اتخاذ كافة الإجراءات القانونية ضدي.
                </p>

                <p className="font-bold text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-300">
                  وهذا إقرار تم مني بكامل إرادتي الحرة ووعيي الكامل دون ضغط أو
                  إكراه من أي نوع من جهة العمل أو غيرها، وبراءة ذمة شاملة ونهائية.
                </p>
              </div>

              {/* Signatures Block */}
              <div className="pt-8 border-t border-gray-400">
                <div className="grid grid-cols-2 gap-8 text-sm font-bold">
                  {/* Employee Sign-off */}
                  <div className="space-y-2">
                    <p className="font-bold text-base text-gray-900 border-b border-gray-300 pb-1">
                      المُقر بما فيه (الموظف):
                    </p>
                    <p>
                      الاسم:{" "}
                      <span className="font-normal font-sans">
                        <EmployeeDocName e={e} />
                      </span>
                    </p>
                    <p>
                      الوظيفة:{" "}
                      <span className="font-normal">
                        <EditableText value={e.position || "مهندس"} />
                      </span>
                    </p>
                    <p>
                      الرقم القومي:{" "}
                      <span className="font-mono font-normal">
                        <EditableText value={e.national_id || "—"} />
                      </span>
                    </p>
                    <div className="flex items-center gap-2 pt-3">
                      <span>توقيع الموظف:</span>
                      <span className="w-44 border-b-2 border-dotted border-gray-800 inline-block"></span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span>التاريخ:</span>
                      <span className="font-mono font-normal">
                        <EditableText value={formatDate(today)} />
                      </span>
                    </div>
                  </div>

                  {/* Company Clearance Sign-off */}
                  <div className="space-y-2 text-left pl-4">
                    <p className="font-bold text-base text-gray-900 border-b border-gray-300 pb-1 text-right">
                      اعتماد إدارة الشركة:
                    </p>
                    <div className="space-y-4 pt-2 text-right">
                      <div>
                        <span className="text-xs text-gray-700 block">
                          المدير المالي (براءة الذمة المالية):
                        </span>
                        <div className="w-48 border-b border-dotted border-gray-800 mt-4"></div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-700 block">
                          المدير الإداري / الموارد البشرية:
                        </span>
                        <div className="w-48 border-b border-dotted border-gray-800 mt-4"></div>
                      </div>
                      <div className="pt-2">
                        <div className="w-32 h-16 border-2 border-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 mx-auto text-center">
                          خاتم الشركة المعتمد
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* نموذج إخلاء طرف داخلي وتسليم العهد */
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold border-b-2 border-gray-900 pb-1 px-8 inline-block">
                  إخـلاء طـرف داخلي وتسليم العهد
                </h1>
                <div className="text-xs text-gray-600 font-sans font-semibold tracking-wider mt-1">
                  INTERNAL HANDOVER & CLEARANCE CHECKLIST
                </div>
              </div>

              {/* Employee Summary Card */}
              <div className="rounded-xl border border-gray-800 p-4 bg-gray-50/70 text-sm leading-relaxed mb-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الاسم:</span>
                    <span className="font-bold text-base flex-1">
                      <EmployeeDocName e={e} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الكود:</span>
                    <span className="font-mono font-bold">
                      {e.emp_code || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الوظيفة:</span>
                    <EditableText
                      value={e.position || "مهندس"}
                      className="font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">الإدارة:</span>
                    <EditableText
                      value={e.department || "الإدارة الفنية"}
                      className="font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">تاريخ التعيين:</span>
                    <EditableText
                      value={
                        e.contract_start_date
                          ? formatDate(e.contract_start_date)
                          : "01/01/2024"
                      }
                      className="font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 w-24">تاريخ نهاية الخدمة:</span>
                    <EditableText
                      value={formatDate(lastWorkDate)}
                      className="font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Handover Sections Table */}
              <div className="space-y-4 text-xs">
                {/* 1. إدارة الموظف */}
                <div className="border border-black rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 font-bold text-sm border-b border-black flex justify-between items-center">
                    <span>1. إدارة الموظف (المشاريع والمهام الفنية)</span>
                    <span className="text-xs font-normal text-gray-600">اعتماد مدير الإدارة</span>
                  </div>
                  <table className="w-full text-center">
                    <thead className="bg-gray-50 border-b border-gray-300">
                      <tr>
                        <th className="p-1.5 text-right w-1/3 border-l border-gray-300">الأعمال والمهام المكلف بها</th>
                        <th className="p-1.5 w-24 border-l border-gray-300">الحالة</th>
                        <th className="p-1.5 w-36 border-l border-gray-300">المستلم</th>
                        <th className="p-1.5">ملاحظات واعتماد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">ملفات المشاريع والوثائق التقنية</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تم التسليم ✓</td>
                        <td className="p-2 border-l border-gray-300">مهندس المشروع</td>
                        <td className="p-2 text-gray-600">لا توجد أعمال معلقة</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">التقارير اليومية والأسبوعية</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تم التسليم ✓</td>
                        <td className="p-2 border-l border-gray-300">مدير الإدارة</td>
                        <td className="p-2 text-gray-600">مكتملة ومؤرشفة</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. نظم المعلومات IT */}
                <div className="border border-black rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 font-bold text-sm border-b border-black flex justify-between items-center">
                    <span>2. إدارة النظم وتكنولوجيا المعلومات (IT)</span>
                    <span className="text-xs font-normal text-gray-600">اعتماد مسؤول IT</span>
                  </div>
                  <table className="w-full text-center">
                    <thead className="bg-gray-50 border-b border-gray-300">
                      <tr>
                        <th className="p-1.5 text-right w-1/3 border-l border-gray-300">البيان والعهدة الإلكترونية</th>
                        <th className="p-1.5 w-24 border-l border-gray-300">الحالة</th>
                        <th className="p-1.5 w-36 border-l border-gray-300">المستلم</th>
                        <th className="p-1.5">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">جهاز لابتوب / كمبيوتر + الشاحن</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تم الفحص والتسليم ✓</td>
                        <td className="p-2 border-l border-gray-300">مسؤول الدعم الفني</td>
                        <td className="p-2 text-gray-600">حالة ممتازة وبدون أضرار</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">البريد الإلكتروني وحسابات الأنظمة</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تم الإيقاف ✓</td>
                        <td className="p-2 border-l border-gray-300">إدارة الأنظمة</td>
                        <td className="p-2 text-gray-600">تم إلغاء الصلاحيات والربط</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. الإدارة المالية */}
                <div className="border border-black rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 font-bold text-sm border-b border-black flex justify-between items-center">
                    <span>3. الإدارة المالية (العهد النقدية والسلف)</span>
                    <span className="text-xs font-normal text-gray-600">اعتماد الحسابات</span>
                  </div>
                  <table className="w-full text-center">
                    <thead className="bg-gray-50 border-b border-gray-300">
                      <tr>
                        <th className="p-1.5 text-right w-1/3 border-l border-gray-300">البيان المالي</th>
                        <th className="p-1.5 w-24 border-l border-gray-300">الحالة</th>
                        <th className="p-1.5 w-36 border-l border-gray-300">المستلم</th>
                        <th className="p-1.5">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">العهدة النقدية المؤقتة والمستديمة</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تمت التسوية ✓</td>
                        <td className="p-2 border-l border-gray-300">الخزينة والحسابات</td>
                        <td className="p-2 text-gray-600">الرصيد صفري ولا توجد مديونيات</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">سلف العاملين ومشتريات العهد</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تم السداد ✓</td>
                        <td className="p-2 border-l border-gray-300">الحسابات العامة</td>
                        <td className="p-2 text-gray-600">تمت التسوية بمسير المستحقات</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. الشؤون الإدارية و HR */}
                <div className="border border-black rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 font-bold text-sm border-b border-black flex justify-between items-center">
                    <span>4. الشؤون الإدارية والموارد البشرية (HR)</span>
                    <span className="text-xs font-normal text-gray-600">اعتماد HR</span>
                  </div>
                  <table className="w-full text-center">
                    <thead className="bg-gray-50 border-b border-gray-300">
                      <tr>
                        <th className="p-1.5 text-right w-1/3 border-l border-gray-300">البيان والوثائق الإدارية</th>
                        <th className="p-1.5 w-24 border-l border-gray-300">الحالة</th>
                        <th className="p-1.5 w-36 border-l border-gray-300">المستلم</th>
                        <th className="p-1.5">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">كارنيه الشركة + بطاقة التأمين الصحي</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تم الاستلام ✓</td>
                        <td className="p-2 border-l border-gray-300">مسؤول الموارد البشرية</td>
                        <td className="p-2 text-gray-600">تم الاسترداد وفقاً لنموذج 6</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-right border-l border-gray-300">شريحة الهاتف + المفاتيح ومستلزمات العمل</td>
                        <td className="p-2 border-l border-gray-300 font-bold text-success">تم الاستلام ✓</td>
                        <td className="p-2 border-l border-gray-300">الخدمات الإدارية</td>
                        <td className="p-2 text-gray-600">تم الاستلام بالكامل</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Final Signatures */}
              <div className="grid grid-cols-2 gap-8 text-center text-xs font-bold pt-6 border-t border-gray-400 mt-6">
                <div>
                  <p>توقيع الموظف بتسليم كافة العهد أعلاه</p>
                  <div className="w-48 mx-auto border-b border-gray-800 mt-8"></div>
                </div>
                <div>
                  <p>اعتماد مدير الموارد البشرية والشؤون الإدارية</p>
                  <div className="w-48 mx-auto border-b border-gray-800 mt-8"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
