import { getArabicPosition, getArabicDepartment } from "@/lib/arabic-labels";
import { useState } from "react";
import {
  useEmployeePicker,
  EmployeePicker,
  EmployeeDocName,
  EditableText,
} from "./HrDocuments";
import { formatDate, todayISO } from "@/lib/date-format";
import { FileText, Printer } from "lucide-react";

export function ResignationForm() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;
  const [docType, setDocType] = useState<"request" | "acceptance">("request");

  const today = todayISO();
  const lastWorkDate = e?.contract_end_date || e?.last_action_date || today;

  // Day of week in Arabic
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
            label="Select Employee for Resignation Form (طلب استقالة)"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDocType("request")}
              className={`rounded-lg px-3 py-1.5 transition ${docType === "request"
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              طلب استقالة (Request)
            </button>
            <button
              type="button"
              onClick={() => setDocType("acceptance")}
              className={`rounded-lg px-3 py-1.5 transition ${docType === "acceptance"
                  ? "bg-gradient-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              إخطار قبول استقالة (Acceptance)
            </button>
          </div>
          <button
            type="button"
            disabled={!picker.employeeId}
            onClick={() => window.print()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-40 transition"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {!picker.employeeId ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <h3 className="font-display text-base font-semibold text-foreground">
            No employee selected
          </h3>
          <p className="mt-1 text-sm">
            Select an employee from the dropdown above to generate their official Resignation Request or Acceptance Notice.
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
          <div className="mb-8 flex items-center justify-between border-b-2 border-gray-800 pb-4">
            <img
              src="/int-logo%20for%20docx.png"
              alt="Integrated Technics Logo"
              className="h-16 object-contain"
            />
            <div className="text-left text-xs text-gray-500 font-sans">
              <p className="font-bold text-gray-800">
                شركة التقنيات المتكاملة ذات مسؤلية محدودة
              </p>
              <p className="mt-1 font-semibold text-gray-700">
                تاريخ الإصدار: {formatDate(today)}
              </p>
            </div>
          </div>

          {docType === "request" ? (
            /* طلب استقالة */
            <div className="space-y-6 pt-2">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-center flex-1 border-b-2 border-gray-900 pb-2 inline-block mx-auto max-w-xs">
                  طلب إستقالة
                </h1>
                <div className="text-sm font-bold text-gray-700 font-mono">
                  بتاريخ: <EditableText value={formatDate(today)} />
                </div>
              </div>

              <div className="text-base font-bold text-gray-900 space-y-1">
                <p>السيد / المدير الإداري لشركة التقنيات المتكاملة</p>
                <p className="text-gray-700">بعد التحية،،،</p>
              </div>

              <p className="text-base leading-10 text-justify text-gray-900">
                مقدم لسيادتكم /{" "}
                <strong className="inline-flex items-center text-lg">
                  <EmployeeDocName e={e} />
                </strong>
                {e.emp_code && (
                  <>
                    {" "}
                    (كود:{" "}
                    <strong className="font-mono">{e.emp_code}</strong>)
                  </>
                )}
                ، الوظيفة:{" "}
                <strong>
                  <EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "مهندس"} />
                </strong>{" "}
                بإدارة{" "}
                <strong>
                  <EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة الفنية"} />
                </strong>{" "}
                لدى شركة التقنيات المتكاملة.
              </p>

              <p className="text-base leading-10 text-justify text-gray-900">
                برجاء التكرم من سيادتكم بقبول استقالتي من عملي بشركة التقنيات
                المتكاملة وذلك لظروف شخصية خاصة بي بناءً على رغبتي، علماً بأن
                آخر يوم عمل لي بالشركة سيكون يوم{" "}
                <strong>
                  <EditableText value={dayName} />
                </strong>{" "}
                الموافق{" "}
                <strong className="font-mono">
                  <EditableText value={formatDate(lastWorkDate)} />
                </strong>
                .
              </p>

              <p className="text-base leading-10 text-justify text-gray-800">
                وأود أن أتوجه لسيادتكم ولإدارة الشركة وزملائي الأعزاء بخالص الشكر
                والتقدير على حسن التعاون والدعم المقدم لي طوال فترة عملي بالشركة،
                متمنياً للشركة دوام التقدم والازدهار.
              </p>

              <div className="pt-10 space-y-2 text-base font-bold text-gray-900">
                <p>مقدم لسيادتكم من:</p>
                <div className="pr-4 space-y-2">
                  <p>
                    الاسم:{" "}
                    <strong className="text-gray-900">
                      {e.full_name_ar || e.full_name || "—"}
                    </strong>
                  </p>
                  <p>
                    القسم / الإدارة:{" "}
                    <span className="font-semibold text-gray-800">
                      <EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة الفنية"} />
                    </span>
                  </p>
                  <p>
                    الوظيفة:{" "}
                    <span className="font-semibold text-gray-800">
                      <EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "مهندس"} />
                    </span>
                  </p>
                  <div className="flex items-center gap-3 pt-4">
                    <span>توقيع الموظف:</span>
                    <span className="w-56 border-b-2 border-dotted border-gray-800 inline-block"></span>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <span>التاريخ:</span>
                    <span className="font-mono font-normal">
                      <EditableText value={formatDate(today)} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* قرار وإخطار قبول الاستقالة */
            <div className="space-y-6 pt-2">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-center flex-1 border-b-2 border-gray-900 pb-2 inline-block mx-auto max-w-sm">
                  إخطار بقبول استقالة
                </h1>
                <div className="text-sm font-bold text-gray-700 font-mono">
                  التاريخ: <EditableText value={formatDate(today)} />
                </div>
              </div>

              <div className="text-base font-bold text-gray-900 space-y-1">
                <p>
                  السيد /{" "}
                  <strong className="inline-flex items-center text-lg">
                    {e.full_name_ar || e.full_name}
                  </strong>{" "}
                  المحترم
                </p>
                <p>
                  القسم / الإدارة:{" "}
                  <strong>
                    <EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة الفنية"} />
                  </strong>
                </p>
                <p>
                  الوظيفة:{" "}
                  <strong>
                    <EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "مهندس"} />
                  </strong>
                </p>
                <p className="text-gray-700 pt-1">تحية طيبة وبعد،،،</p>
              </div>

              <p className="text-base leading-10 text-justify text-gray-900">
                نود الإشارة إلى أننا قد تسلمنا الاستقالة المقدمة منكم بتاريخ{" "}
                <strong className="font-mono">
                  <EditableText value={formatDate(today)} />
                </strong>
                ، ونفيدكم بأنه قد تمت الموافقة وقبول الاستقالة.
              </p>

              <p className="text-base leading-10 text-justify text-gray-900">
                الرجاء التكرم بإنهاء تسليم كافة العهد والأجهزة والمستندات الموجودة
                بحوزتكم لإدارة شركة التقنيات المتكاملة وفقاً لنموذج إخلاء الطرف
                المعتمد، وذلك تمهيداً لإعداد وتصفية مستحقات نهاية الخدمة الخاصة
                بكم.
              </p>

              <p className="text-base leading-10 text-justify text-gray-800">
                وإذ نعرب لكم عن شكرنا وتقديرنا لجهودكم المخلصة طوال فترة عملكم
                معنا، فإننا نتمنى لكم دوام التوفيق والنجاح في مسيرتكم المهنية
                القادمة.
              </p>

              <div className="flex justify-between items-start pt-8 pb-8">
                <div></div>
                <div className="text-center font-bold text-base">
                  <p>المدير المسؤول</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    شركة التقنيات المتكاملة
                  </p>
                  <div className="mt-12 w-48 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-400 p-4 bg-gray-50/70 mt-6 text-sm">
                <div className="font-bold text-gray-900 mb-2">
                  إقرار استلام وإخطار الموظف:
                </div>
                <p className="text-gray-800 leading-7 mb-4">
                  نفيدكم بأنني قد علمت وتسلمت إخطار قبول الاستقالة، وأتعهد
                  بالالتزام بتسليم العهد وكافة الإجراءات المطلوبة.
                </p>
                <div className="grid grid-cols-3 gap-4 font-bold text-gray-800 pt-2">
                  <div>
                    الاسم:{" "}
                    <span className="font-normal font-sans">
                      <EmployeeDocName e={e} />
                    </span>
                  </div>
                  <div>
                    التوقيع:{" "}
                    <span className="border-b border-dotted border-gray-800 w-28 inline-block"></span>
                  </div>
                  <div>
                    التاريخ:{" "}
                    <span className="font-mono font-normal">
                      <EditableText value={formatDate(today)} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
