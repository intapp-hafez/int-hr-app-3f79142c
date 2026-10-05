import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, Search, ChevronDown, Check, X, User, Loader2 } from "lucide-react";
import { listEmployeesAdmin, getEmployeeDetail } from "@/backend/functions/employees.functions";
import { listEmployeeCustody } from "@/backend/functions/custody.functions";
import { listAdvancesForHR } from "@/backend/functions/advances.functions";
import { formatDate, todayISO } from "@/lib/date-format";
import { AppLogo } from "@/components/AppLogo";
import { getArabicPosition, getArabicDepartment } from "@/lib/arabic-labels";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring";

function fmtMoney(v?: number | null) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export function useEmployeePicker() {
  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const listFn = useServerFn(listEmployeesAdmin);
  const listQ = useQuery({
    queryKey: ["hr-doc-employees", q],
    queryFn: () => listFn({ data: { page: 1, pageSize: 100, q, sort: "full_name", dir: "asc" } }),
  });
  const detailFn = useServerFn(getEmployeeDetail);
  const detailQ = useQuery({
    queryKey: ["hr-doc-employee", employeeId],
    queryFn: () => detailFn({ data: { id: employeeId } }),
    enabled: !!employeeId,
  });
  const employees: any[] = (listQ.data as any)?.rows ?? [];
  return { q, setQ, employeeId, setEmployeeId, employees, detail: detailQ.data, loading: detailQ.isFetching, listLoading: listQ.isFetching };
}

export function EmployeePicker({ picker, label = "Employee" }: { picker: ReturnType<typeof useEmployeePicker>; label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Find currently selected employee object
  const selectedEmp = picker.employees.find((e: any) => e.id === picker.employeeId) || (picker.detail as any);

  return (
    <div className="print:hidden space-y-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1 max-w-xl" ref={containerRef}>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>

          {/* Trigger button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border bg-card px-3 py-1.5 text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-ring ${
              isOpen ? "border-brand ring-2 ring-brand/20" : "border-input hover:border-muted-foreground/40"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              {selectedEmp ? (
                <div className="flex flex-col text-start truncate leading-tight">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-foreground truncate">
                      {selectedEmp.full_name_ar || selectedEmp.full_name}
                    </span>
                    {selectedEmp.full_name_ar && selectedEmp.full_name && selectedEmp.full_name !== selectedEmp.full_name_ar && (
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                        ({selectedEmp.full_name})
                      </span>
                    )}
                    {selectedEmp.emp_code ? (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono font-medium text-muted-foreground">
                        {selectedEmp.emp_code}
                      </span>
                    ) : null}
                  </div>
                  {(selectedEmp.position || selectedEmp.department) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
                      {selectedEmp.position && <span className="font-medium text-foreground/80">{selectedEmp.position}</span>}
                      {selectedEmp.position && selectedEmp.department && <span>·</span>}
                      {selectedEmp.department && <span>{selectedEmp.department}</span>}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">Select employee…</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ms-2">
              {picker.employeeId && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    picker.setEmployeeId("");
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </button>

          {/* Dropdown Menu with Search Option Inside List */}
          {isOpen && (
            <div className="absolute start-0 top-full z-50 mt-1.5 w-full rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg animate-in fade-in-50 zoom-in-95">
              {/* Search option inside list */}
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  className="w-full rounded-lg border border-input bg-card py-1.5 pe-8 ps-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                  placeholder="Search employee by Arabic name, English name, or code…"
                  value={picker.q}
                  onChange={(e) => picker.setQ(e.target.value)}
                />
                {picker.q && (
                  <button
                    type="button"
                    onClick={() => picker.setQ("")}
                    className="absolute end-2 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* List options */}
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {picker.listLoading && picker.employees.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    <span>Searching employees…</span>
                  </div>
                ) : picker.employees.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No employees found matching "{picker.q}"
                  </div>
                ) : (
                  picker.employees.map((e: any) => {
                    const isSelected = e.id === picker.employeeId;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          picker.setEmployeeId(e.id);
                          setIsOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition text-left ${
                          isSelected
                            ? "bg-brand/10 text-brand font-medium"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className="flex flex-col truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">
                              {e.full_name_ar || e.full_name}
                            </span>
                            {e.full_name_ar && e.full_name && e.full_name !== e.full_name_ar && (
                              <span className="text-xs text-muted-foreground truncate font-normal">
                                ({e.full_name})
                              </span>
                            )}
                            {e.emp_code && (
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                                {e.emp_code}
                              </span>
                            )}
                          </div>
                          {(e.position || e.department) && (
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {[e.position, e.department].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-brand ms-2" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Print Button */}
        <button
          disabled={!picker.employeeId}
          onClick={() => window.print()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-40"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>
    </div>
  );
}

function DocShell({ children, formCode }: { children: React.ReactNode, formCode?: string }) {
  return (
    <div
      id="hr-doc-print-area"
      dir="rtl"
      className="mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-border bg-white p-10 text-gray-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      style={{ fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif" }}
    >
      <div className="mb-6 flex items-center justify-between border-b-2 border-gray-800 pb-4">
        <img src="/int-logo%20for%20docx.png" alt="Integrated Technics Logo" className="h-16 object-contain" />
        {formCode ? (
          <div className="flex flex-col items-center justify-center border border-gray-800 px-4 py-2 rounded text-gray-900 bg-white">
            <span className="text-[11px] font-semibold mb-0.5">تاريخ الإصدار: {formatDate(todayISO())}</span>
            <span className="text-sm font-bold">نموذج رقم {formCode}</span>
          </div>
        ) : (
          <div className="text-left text-xs text-gray-500">
            <p>تاريخ الإصدار: {formatDate(todayISO())}</p>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 border-b border-dashed border-gray-300 py-2 text-sm">
      <span className="w-40 shrink-0 font-bold text-gray-700">{label}:</span>
      <span>{value ?? "—"}</span>
    </div>
  );
}

export function EmployeeDocName({ e }: { e: any }) {
  return <span className="mx-1">{e.full_name_ar || e.full_name}</span>;
}

function SignatureBlock() {
  return (
    <div className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
      <div>
        <p className="font-bold">توقيع الموظف</p>
        <div className="mt-10 border-t border-gray-400 pt-1">الاسم والتوقيع</div>
      </div>
      <div>
        <p className="font-bold">الشؤون الإدارية</p>
        <div className="mt-10 border-t border-gray-400 pt-1">الاسم والتوقيع</div>
      </div>
      <div>
        <p className="font-bold">المدير المسؤول</p>
        <div className="mt-10 border-t border-gray-400 pt-1">الاسم والتوقيع</div>
      </div>
    </div>
  );
}

/** شهادة الخبرة */
export function ExperienceCertificate() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate the Experience Certificate</p>
      ) : picker.loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DocShell>
          <h2 className="mb-1 text-center text-xl font-bold">شهادة خبرة</h2>
          <p className="mb-6 text-center text-xs text-gray-500">Experience Certificate</p>

          <p className="mb-4 text-sm leading-8 text-justify">
            تشهد إدارة الشركة بأن {e.gender === "female" ? "السيدة" : "السيد"}/ <strong className="inline-flex items-center"><EmployeeDocName e={e} /></strong>
            {e.national_id ? <> (بطاقة رقم قومي: <strong>{e.national_id}</strong>)</> : ""}
            ، قد {e.gender === "female" ? "عملت / تعمل" : "عمل / يعمل"} لدينا بوظيفة <strong><EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} /></strong> بقسم <strong><EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} /></strong>
            {e.contract_start_date ? (
              <> اعتباراً من تاريخ <strong>{formatDate(e.contract_start_date)}</strong></>
            ) : null}
            {e.contract_end_date ? (
              <> وحتى تاريخ <strong>{formatDate(e.contract_end_date)}</strong></>
            ) : (
              <>، وما زال{e.gender === "female" ? "ت" : ""} على رأس عمل{e.gender === "female" ? "ها" : "ه"} حتى تاريخه</>
            )}
            .
          </p>
          <p className="mb-4 text-sm leading-8 text-justify">
            وخلال فترة عمل{e.gender === "female" ? "ها" : "ه"} بالشركة أظهر{e.gender === "female" ? "ت" : ""} الكفاءة وحسن السير والسلوك والتعاون التام مع زملائ{e.gender === "female" ? "ها" : "ه"} ورؤسائ{e.gender === "female" ? "ها" : "ه"} في العمل.
          </p>
          <p className="mb-6 text-sm leading-8 text-justify text-gray-600">
            وقد أُعطيت ل{e.gender === "female" ? "ها" : "ه"} هذه الشهادة بناءً على طلب{e.gender === "female" ? "ها" : "ه"} لتقديمها إلى من يهمه الأمر دون أدنى مسؤولية أو التزام على الشركة تجاه الغير.
          </p>

          <h3 className="mb-2 mt-6 font-bold text-gray-800">بيانات الموظف</h3>
          <InfoRow label="كود الموظف" value={e.emp_code} />
          <InfoRow label="الاسم بالكامل" value={e.full_name_ar || e.full_name} />
          <InfoRow label="الرقم القومي" value={e.national_id} />
          <InfoRow label="المسمى الوظيفي" value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} />
          <InfoRow label="القسم / الإدارة" value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} />
          <InfoRow label="نوع التعاقد" value={e.contract_type} />
          <InfoRow label="تاريخ بداية العمل" value={formatDate(e.contract_start_date)} />
          {e.contract_end_date && <InfoRow label="تاريخ نهاية العمل" value={formatDate(e.contract_end_date)} />}
          <InfoRow label="مقر العمل" value={[e.city, e.district].filter(Boolean).join(" - ") || null} />

          <div className="mt-14 grid grid-cols-2 gap-8 text-center text-sm">
            <div>
              <p className="font-bold">إدارة الموارد البشرية</p>
              <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-600">الاسم والتوقيع</div>
            </div>
            <div>
              <p className="font-bold">المدير العام / المفوض</p>
              <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-600">الخاتم والاعتماد</div>
            </div>
          </div>
        </DocShell>
      )}
    </div>
  );
}

/** شهادة مفردات مرتب */
export function SalaryCertificate() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate the Salary Certificate</p>
      ) : picker.loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DocShell>
          <div className="mx-auto max-w-4xl bg-white px-8 py-10 text-gray-900 print:px-0 print:py-0" dir="rtl" style={{ fontFamily: 'Tajawal, Cairo, "Segoe UI", Tahoma, sans-serif' }}>
            <div className="mb-10 text-left print:text-left">
              <span className="text-gray-500 font-medium tracking-wider print:text-gray-800">تحريرا فى :</span>
              <span className="mr-3 font-semibold text-gray-800">{new Date().toLocaleDateString("ar-EG")}</span>
            </div>

            <div className="mb-12 space-y-2">
              <p className="text-2xl font-bold text-gray-900">الي من يهمه الامر،،،</p>
              <p className="text-2xl font-bold text-gray-900">تحية طيبة وبعد،،</p>
            </div>

            <div className="space-y-10 text-lg leading-[2.2]">
              <p className="text-justify text-gray-800">
                تشهد شركة التقنيات المتكاملة (Integrated Technics)
                <br />
                بسجل تجارى رقم <strong className="font-mono">98033</strong> ، وعنوانها/ 9و – ابراج سما – دائري المعادي- القاهره – الدور الارضي.
              </p>

              <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 shadow-sm print:shadow-none print:border-transparent print:bg-transparent print:p-0 space-y-4">
                <p className="text-gray-800 flex items-center">
                  بأن {e.gender === "female" ? "السيدة" : "السيد"}/ <strong className="text-2xl text-brand print:text-black mx-1 inline-flex items-center"><EmployeeDocName e={e} /></strong>
                </p>
                <div className="flex flex-wrap gap-y-4 gap-x-12">
                  <p>
                    بطاقة رقم: <strong className="font-mono text-xl">{e.national_id || "................................"}</strong>
                  </p>
                  <p>
                    ورقمة التاميني: <strong className="font-mono text-xl">{e.insurance_number || "................................"}</strong>
                  </p>
                </div>
              </div>

              <p className="text-justify text-gray-800">
                وأن {e.gender === "female" ? "الموظفة تعمل" : "الموظف يعمل"} بالهيكل الادارى بإدارة / قسم <strong className="text-xl"><EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} /></strong> بوظيفة <strong className="text-xl"><EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} /></strong> ، وذلك فى الفترة من تاريخ <strong>{e.contract_start_date ? formatDate(e.contract_start_date) : "................................"}</strong> وحتى الان بعقد يجدد تلقائياً كل سنه ، وان صافي راتب{e.gender === "female" ? "ها" : "ه"} الشهرى <strong className="text-brand print:text-black font-bold text-xl px-1">{fmtMoney(e.salary_net)}</strong>
                <br />
                <span className="text-gray-600">(فقط لاغير).</span>
              </p>

              <p className="text-justify text-gray-600">
                وقد قدمت هذه الشهادة بناء على طلب{e.gender === "female" ? "ها" : "ه"} دون ادنى مسئولية على الشركة.
              </p>
            </div>

            <div className="mt-20 flex justify-end">
              <div className="text-center w-80">
                <p className="mb-4 font-bold text-lg text-gray-800">وتفضلوا بقبول فائق الاحترام،،،</p>
                <p className="mb-20 font-bold text-lg text-gray-800">مقدمة لسيادتكم شركة التقنيات المتكاملة</p>
                <p className="border-t-[3px] border-gray-800 pt-3 font-bold text-xl text-gray-900">توقيع المديــــر المسئــــول</p>
              </div>
            </div>
          </div>
        </DocShell>
      )}
    </div>
  );
}

/** شهادة الخبرة ومفردات المرتب (مدمجة للتوافق مع الإصدارات السابقة) */
export function ExperienceSalaryCertificate() {
  return <ExperienceCertificate />;
}

/** إقرار سلف */
export function AdvancesAcknowledgment() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  const advancesFn = useServerFn(listAdvancesForHR);
  const advancesQ = useQuery({
    queryKey: ["hr-doc-advances", picker.employeeId],
    queryFn: async () => {
      const res: any = await advancesFn({ data: { page: 1, limit: 200 } });
      return (res?.advances ?? []).filter((a: any) => a.employee_id === picker.employeeId);
    },
    enabled: !!picker.employeeId,
  });

  const advances: any[] = advancesQ.data ?? [];
  const totalAdvance = advances.reduce(
    (s, a) => s + (Number(a.approved_amount ?? a.requested_amount ?? 0) - Number(a.paid_amount ?? 0)),
    0,
  );
  const loading = advancesQ.isFetching || picker.loading;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate the Advances Acknowledgment</p>
      ) : loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DocShell>
          <h2 className="mb-1 text-center text-xl font-bold">إقرار سلف مالية</h2>
          <p className="mb-6 text-center text-xs text-gray-500">Advances Acknowledgment</p>

          <p className="mb-4 text-sm leading-8 text-justify">
            أقر أنا الموقع أدناه <strong className="inline-flex items-center"><EmployeeDocName e={e} /></strong>
            {e.national_id ? <> (بطاقة رقم قومي: <strong>{e.national_id}</strong>)</> : null}،
            {e.gender === "female" ? "الموظفة" : "الموظف"} بوظيفة <strong><EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} /></strong> بقسم <strong><EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} /></strong>،
            بأنني مدين{e.gender === "female" ? "ة" : ""} للشركة بالسلف المالية الموضحة في الجدول أدناه بإجمالي مبلغ متبقي قدره (<strong>{fmtMoney(totalAdvance)} ج.م</strong>)،
            وأتعهد بسداد هذا المبلغ طبقاً للأقساط المحددة، وفي حالة تركي للعمل أو انتهاء خدمتي بالشركة لأي سبب من الأسباب
            تصبح كافة المبالغ المتبقية مستحقة السداد فوراً، وأوافق دون قيد أو شرط على خصمها من مستحقاتي أو مكافآتي طرف الشركة.
          </p>

          <div className="mb-6 rounded-xl border border-gray-300 p-4 bg-gray-50/50">
            <h3 className="mb-3 font-bold text-gray-800 text-base border-b pb-1.5">بيانات الموظف المقر</h3>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الاسم:</span>
                <span className="font-bold text-gray-900">{e.full_name_ar || e.full_name || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الرقم الوظيفي (الكود):</span>
                <span className="font-mono font-bold">{e.emp_code || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">القسم / الإدارة:</span>
                <EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} className="font-bold" />
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الوظيفة:</span>
                <EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} className="font-bold" />
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الرقم القومي:</span>
                <span className="font-mono font-bold">{e.national_id || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">تاريخ التعيين:</span>
                <span className="font-bold">{e.contract_start_date ? formatDate(e.contract_start_date) : "—"}</span>
              </div>
            </div>
          </div>

          <h3 className="mb-2 mt-6 font-bold text-gray-800">بيان السلف المالية القائمة</h3>
          {advances.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              لا توجد سلف قائمة على الموظف حالياً / No active advances for this employee.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center">م</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">التاريخ</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">المبلغ المعتمد (ج.م)</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">المسدد (ج.م)</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">المتبقي (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((a, i) => {
                  const approved = Number(a.approved_amount ?? a.requested_amount ?? 0);
                  const paid = Number(a.paid_amount ?? 0);
                  return (
                    <tr key={a.id}>
                      <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                      <td className="border border-gray-300 px-3 py-2">{formatDate(a.created_at)}</td>
                      <td className="border border-gray-300 px-3 py-2">{fmtMoney(approved)}</td>
                      <td className="border border-gray-300 px-3 py-2">{fmtMoney(paid)}</td>
                      <td className="border border-gray-300 px-3 py-2 font-medium">{fmtMoney(approved - paid)}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold bg-gray-50">
                  <td colSpan={4} className="border border-gray-300 px-3 py-2 text-left">إجمالي السلف المتبقية</td>
                  <td className="border border-gray-300 px-3 py-2 text-brand">{fmtMoney(totalAdvance)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <div className="mt-14 grid grid-cols-3 gap-6 text-center text-sm">
            <div>
              <p className="font-bold">توقيع المقر بما فيه (الموظف)</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">الاسم والتوقيع</div>
            </div>
            <div>
              <p className="font-bold">الإدارة المالية والحسابات</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">المراجعة والاعتماد</div>
            </div>
            <div>
              <p className="font-bold">إدارة الموارد البشرية</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">الاعتماد والخاتم</div>
            </div>
          </div>
        </DocShell>
      )}
    </div>
  );
}

/** إقرار عهد */
export function CustodyAcknowledgment() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  const custodyFn = useServerFn(listEmployeeCustody);
  const custodyQ = useQuery({
    queryKey: ["hr-doc-custody", picker.employeeId],
    queryFn: () => custodyFn({ data: { profileId: picker.employeeId } }),
    enabled: !!picker.employeeId,
  });

  const custody = (custodyQ.data ?? []).filter((c) => !c.return_date);
  const loading = custodyQ.isFetching || picker.loading;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate the Custody Acknowledgment</p>
      ) : loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DocShell>
          <h2 className="mb-1 text-center text-xl font-bold">إقرار استلام عهدة</h2>
          <p className="mb-6 text-center text-xs text-gray-500">Custody Receipt &amp; Acknowledgment</p>

          <p className="mb-4 text-sm leading-8 text-justify">
            أقر أنا الموقع أدناه <strong className="inline-flex items-center"><EmployeeDocName e={e} /></strong>
            {e.national_id ? <> (بطاقة رقم قومي: <strong>{e.national_id}</strong>)</> : null}،
            {e.gender === "female" ? "الموظفة" : "الموظف"} بوظيفة <strong><EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} /></strong> بقسم <strong><EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} /></strong>،
            بأنني استلمت العهد والأجهزة والأدوات الموضحة أدناه بحالة جيدة وصالحة للاستعمال، وأتعهد بالمحافظة عليها
            واستخدامها فقط في أغراض العمل الموكلة إليّ، كما أتعهد بردها بالحالة التي استلمتها بها فور طلبها أو عند
            انتهاء علاقة العمل بالشركة، وفي حالة فقدها أو تلفها نتيجة الإهمال أو التقصير أتحمل قيمتها كاملة دون أدنى اعتراض،
            وللشركة الحق في خصم قيمتها من مستحقاتي.
          </p>

          <div className="mb-6 rounded-xl border border-gray-300 p-4 bg-gray-50/50">
            <h3 className="mb-3 font-bold text-gray-800 text-base border-b pb-1.5">بيانات الموظف المستلم للعهدة</h3>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 text-sm">
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الاسم:</span>
                <span className="font-bold text-gray-900">{e.full_name_ar || e.full_name || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الرقم الوظيفي (الكود):</span>
                <span className="font-mono font-bold">{e.emp_code || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">القسم / الإدارة:</span>
                <EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} className="font-bold" />
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الوظيفة:</span>
                <EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} className="font-bold" />
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">الرقم القومي:</span>
                <span className="font-mono font-bold">{e.national_id || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="font-semibold text-gray-600">تاريخ التعيين:</span>
                <span className="font-bold">{e.contract_start_date ? formatDate(e.contract_start_date) : "—"}</span>
              </div>
            </div>
          </div>

          <h3 className="mb-2 mt-6 font-bold text-gray-800">بيان العهد المستلمة</h3>
          {custody.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              لا توجد عهد قائمة باسم الموظف حالياً / No active custody items for this employee.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center">م</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">تاريخ الاستلام</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">اسم العهدة</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">الرقم المسلسل</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">الموديل</th>
                  <th className="border border-gray-300 px-3 py-2 text-right">الفئة</th>
                </tr>
              </thead>
              <tbody>
                {custody.map((c, i) => (
                  <tr key={c.id}>
                    <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                    <td className="border border-gray-300 px-3 py-2">{formatDate(c.custody_date)}</td>
                    <td className="border border-gray-300 px-3 py-2 font-medium">{c.name}</td>
                    <td className="border border-gray-300 px-3 py-2">{c.serial_number ?? "—"}</td>
                    <td className="border border-gray-300 px-3 py-2">{c.model ?? "—"}</td>
                    <td className="border border-gray-300 px-3 py-2">{c.category ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-14 grid grid-cols-3 gap-6 text-center text-sm">
            <div>
              <p className="font-bold">المستلم (الموظف)</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">الاسم والتوقيع</div>
            </div>
            <div>
              <p className="font-bold">مسؤول العهد والمخازن</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">الاسم والتوقيع</div>
            </div>
            <div>
              <p className="font-bold">إدارة الموارد البشرية</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">الاعتماد والخاتم</div>
            </div>
          </div>
        </DocShell>
      )}
    </div>
  );
}

/** نموذج طلب سلفة */
export function LoanRequestForm() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  const advancesFn = useServerFn(listAdvancesForHR);
  const advancesQ = useQuery({
    queryKey: ["hr-doc-advances", picker.employeeId],
    queryFn: async () => {
      const res: any = await advancesFn({ data: { page: 1, limit: 200 } });
      return (res?.advances ?? []).filter((a: any) => a.employee_id === picker.employeeId);
    },
    enabled: !!picker.employeeId,
  });

  const advances: any[] = advancesQ.data ?? [];
  const totalAdvance = advances.reduce(
    (s, a) => s + (Number(a.approved_amount ?? a.requested_amount ?? 0) - Number(a.paid_amount ?? 0)),
    0,
  );
  const loading = advancesQ.isFetching || picker.loading;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} label="Select Employee for Loan Request" />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate the Loan Request form</p>
      ) : loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DocShell formCode="21 Loan طلب سلفة">
          {/* Header matching PDF 21 Loan طلب سلفة */}
          <div className="flex justify-between items-center pb-2 mb-3 border-b-2 border-black">
            <AppLogo className="h-10 w-auto" />
            <div className="text-center flex-1 pr-6">
              <h1 className="text-2xl font-black tracking-wide text-black inline-flex items-center gap-3">
                <span>طلب سـلـفـــــة</span>
                <span className="text-gray-400 font-normal">/</span>
                <span className="font-sans text-xl font-bold tracking-normal">Loan request</span>
              </h1>
            </div>
          </div>

          {/* Form Box with 5 Numbered Sections */}
          <div className="border-[2px] border-black text-xs text-black bg-white">
            {/* Section 1: بيانات الموظف / Emp. Data */}
            <div className="flex border-b-2 border-black">
              {/* Right vertical badge */}
              <div className="w-8 shrink-0 border-l-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none text-black">
                <span>1</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">بيانات الموظف</span>
                <span>1</span>
              </div>

              {/* Section 1 Content */}
              <div className="flex-1 p-2 space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">الاسم : Name :</span>
                    <strong className="flex-1 border-b border-dotted border-black px-1 font-bold truncate">
                      {e.full_name_ar || e.full_name}
                    </strong>
                  </div>
                  <div className="col-span-3 flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">الرقـــــــم : . No :</span>
                    <strong className="flex-1 border-b border-dotted border-black px-1 font-mono font-bold text-center">
                      {e.emp_code || "—"}
                    </strong>
                  </div>
                  <div className="col-span-4 flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">المسمى الوظيفي : Job title :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1 font-bold truncate">
                      <EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} />
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">القسم : Section :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1">
                      <EditableText value={e.section || getArabicDepartment(e) || "—"} />
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">الإدارة : Department :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1 font-bold">
                      <EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} />
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">بداية العمل : going date :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1 font-mono font-bold">
                      <EditableText value={e.contract_start_date ? formatDate(e.contract_start_date) : "—"} />
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">التوقيع : Signature :</span>
                    <span className="flex-1 border-b border-dotted border-black h-4"></span>
                  </div>
                </div>
              </div>

              {/* Left vertical badge */}
              <div className="w-8 shrink-0 border-r-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none font-sans text-black">
                <span>1</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">Emp. Data</span>
                <span>1</span>
              </div>
            </div>

            {/* Section 2: معلومات السلفة / loan info */}
            <div className="flex border-b-2 border-black">
              {/* Right vertical badge */}
              <div className="w-8 shrink-0 border-l-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none text-black">
                <span>2</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">معلومات السلفة</span>
                <span>2</span>
              </div>

              {/* Section 2 Content */}
              <div className="flex-1 p-2 space-y-2">
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">الراتب الأساسي : Basic salary :</span>
                    <strong className="flex-1 border-b border-dotted border-black px-1 font-mono font-bold">
                      <EditableText value={`${fmtMoney(e.salary_net ?? e.salary_gross)} ج.م`} />
                    </strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold whitespace-nowrap">قيمة السلفة : Loan explication :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1 font-mono">
                      <EditableText value="........................ ج.م" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-bold whitespace-nowrap">فترة التسديد : payment period :</span>
                  <span className="flex-1 border-b border-dotted border-black px-1">
                    <EditableText value="تخصم على عدد ( ...... ) أقساط شهرية متتالية" />
                  </span>
                </div>
              </div>

              {/* Left vertical badge */}
              <div className="w-8 shrink-0 border-r-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none font-sans text-black">
                <span>2</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">loan info.</span>
                <span>2</span>
              </div>
            </div>

            {/* Section 3: الموافقات / Recommend diction' s (Includes الضامن) */}
            <div className="flex border-b-2 border-black">
              {/* Right vertical badge */}
              <div className="w-8 shrink-0 border-l-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none text-black">
                <span>3</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">الموافقات</span>
                <span>3</span>
              </div>

              {/* Section 3 Content */}
              <div className="flex-1 divide-y-2 divide-black">
                {/* 3.1 المدير المباشر */}
                <div className="p-2 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs">المدير المباشر : Responsible Manager:</span>
                    <div className="flex items-center gap-6 font-bold text-xs">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                        <span>أوافق Approved</span>
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                        <span>لا أوافق Not Approved</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold whitespace-nowrap">ملاحظات : Note’s :</span>
                    <span className="flex-1 border-b border-dotted border-black h-4"></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">الاسم : name :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1">
                        <EditableText value={e.manager_name || "........................"} />
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التوقيع : signature :</span>
                      <span className="flex-1 border-b border-dotted border-black h-4"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التاريخ : Date :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1 font-mono text-center">
                        <EditableText value="    /   / 202 " />
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3.2 الضامن (مدير المباشر او رئيس قسم او زميل) - GUARANTOR */}
                <div className="p-2 space-y-1.5 bg-yellow-50/20 print:bg-transparent">
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-xs flex items-center gap-2">
                      <span className="text-black">الضامن (مدير المباشر او رئيس قسم او زميل) :</span>
                      <span className="font-sans font-normal text-[11px] text-gray-700">Personnel Dept.:</span>
                    </div>
                    <div className="flex items-center gap-4 font-bold text-xs">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                        <span>أوافق</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold whitespace-nowrap">ملاحظات : Note’s :</span>
                    <span className="flex-1 border-b border-dotted border-black h-4"></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">الاسم : name :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1">
                        <EditableText value="................................" />
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التوقيع : signature :</span>
                      <span className="flex-1 border-b border-dotted border-black h-4"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التاريخ : Date :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1 font-mono text-center">
                        <EditableText value="    /   / 202 " />
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3.3 قسم المحاسبة */}
                <div className="p-2 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs">قسم المحـاسبة : Account Section:</span>
                    <div className="flex items-center gap-6 font-bold text-xs">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                        <span>أوافق Approved</span>
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                        <span>لا أوافق Not Approved</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold whitespace-nowrap">ملاحظات : Note’s :</span>
                    <span className="flex-1 border-b border-dotted border-black h-4"></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">الاسم : name :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1">
                        <EditableText value="................................" />
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التوقيع : signature :</span>
                      <span className="flex-1 border-b border-dotted border-black h-4"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التاريخ : Date :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1 font-mono text-center">
                        <EditableText value="    /   / 202 " />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Left vertical badge */}
              <div className="w-8 shrink-0 border-r-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none font-sans text-black">
                <span>3</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[9px]">Recommend diction' s</span>
                <span>3</span>
              </div>
            </div>

            {/* Section 4: الاعتماد / Approval */}
            <div className="flex border-b-2 border-black">
              {/* Right vertical badge */}
              <div className="w-8 shrink-0 border-l-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none text-black">
                <span>4</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">الاعتماد</span>
                <span>4</span>
              </div>

              {/* Section 4 Content */}
              <div className="flex-1 p-2 space-y-2">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                    <span className="font-bold whitespace-nowrap">أوافق على السلفة على أن تسدد خلال :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1 font-sans text-left text-gray-700" dir="ltr">
                      I Approve this loan to be paid during:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                    <span className="font-bold whitespace-nowrap">غير موافق بسبب :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1 font-sans text-left text-gray-700" dir="ltr">
                      I don't approve:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-black" />
                    <span className="font-bold whitespace-nowrap">تؤجل السلفة لمدة :</span>
                    <span className="flex-1 border-b border-dotted border-black px-1 font-sans text-left text-gray-700" dir="ltr">
                      Adjourning to:
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <p className="font-bold text-sm">مدير الموارد البشرية</p>
                  <p className="font-sans text-xs text-gray-600 font-bold">HR Manager</p>
                  <div className="grid grid-cols-2 gap-4 text-xs mt-3 max-w-md mx-auto">
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التوقيع : signature :</span>
                      <span className="flex-1 border-b border-dotted border-black h-4"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التاريخ : Date :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1 font-mono text-center">
                        <EditableText value="    /   / 202 " />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Left vertical badge */}
              <div className="w-8 shrink-0 border-r-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none font-sans text-black">
                <span>4</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">Approval</span>
                <span>4</span>
              </div>
            </div>

            {/* Section 5: إقرار الموظف / Emp. affirmance */}
            <div className="flex">
              {/* Right vertical badge */}
              <div className="w-8 shrink-0 border-l-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none text-black">
                <span>5</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">إقرار الموظف</span>
                <span>5</span>
              </div>

              {/* Section 5 Content: Two columns */}
              <div className="flex-1 p-2 grid grid-cols-2 gap-4">
                {/* Arabic Column */}
                <div className="space-y-2 text-justify text-[11px] leading-relaxed">
                  <p>
                    أقر أنا الموقع أدناه بأنني استلمت مبلغاً وقدره{" "}
                    <strong className="border-b border-dotted border-black px-1">
                      <EditableText value="........................" />
                    </strong>{" "}
                    فقط لا غير كسلفة يتم تسديدها حسب التعهد أعلاه أو حسب النظام الداخلي للشركة وتعميد صاحب الصلاحية .
                  </p>
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">الاسم :</span>
                      <strong className="flex-1 border-b border-dotted border-black px-1 truncate">
                        {e.full_name_ar || e.full_name}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التوقيع :</span>
                      <span className="flex-1 border-b border-dotted border-black h-4"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">التاريخ :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1 font-mono text-center">
                        <EditableText value={formatDate(todayISO())} />
                      </span>
                    </div>
                  </div>
                </div>

                {/* English Column */}
                <div className="space-y-2 text-justify text-[10px] leading-relaxed border-r border-gray-300 pr-3 font-sans" dir="ltr">
                  <p>
                    I am the under signed affirm that I have received the amount of{" "}
                    <strong className="border-b border-dotted border-black px-1">
                      <EditableText value="........................" />
                    </strong>{" "}
                    EL. as a loan to be paid as a.m. info or as the internal company procedure's or as baptizing.
                  </p>
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">Name :</span>
                      <strong className="flex-1 border-b border-dotted border-black px-1 truncate">
                        {e.full_name || e.full_name_ar}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">Signature :</span>
                      <span className="flex-1 border-b border-dotted border-black h-4"></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold whitespace-nowrap">Date :</span>
                      <span className="flex-1 border-b border-dotted border-black px-1 font-mono text-center">
                        <EditableText value={formatDate(todayISO())} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Left vertical badge */}
              <div className="w-8 shrink-0 border-r-2 border-black bg-gray-100 flex flex-col items-center justify-between py-1 font-bold text-[11px] select-none font-sans text-black">
                <span>5</span>
                <span className="[writing-mode:vertical-rl] rotate-180 py-1 tracking-wider whitespace-nowrap text-[10px]">Emp. affirmance</span>
                <span>5</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-3 flex justify-between text-[11px] font-bold text-gray-700">
            <span>* الأصل + صورة لشؤون الموظفين</span>
            <span>* صورة الرواتب – الإدارة المالية</span>
          </div>

          {/* Existing advances notice (only shown when viewing if advances exist) */}
          {advances.length > 0 && (
            <div className="print:hidden mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex justify-between items-center">
              <span>تنبيه: يوجد لدى الموظف سلف قائمة بإجمالي:</span>
              <strong className="text-sm font-bold text-amber-900">{fmtMoney(totalAdvance)} ج.م</strong>
            </div>
          )}
        </DocShell>
      )}
    </div>
  );
}

/** إقرار على سلف وعهد (مدمجة للتوافق مع الإصدارات السابقة) */
export function AdvancesCustodyAcknowledgment() {
  return <AdvancesAcknowledgment />;
}

/** نموذج تحقيق مع موظف */
export function InvestigationForm() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} label="Select Employee for Investigation Form" />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate the Investigation form</p>
      ) : picker.loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DocShell formCode="F-HR-020">
          <h2 className="mb-6 mt-2 text-center text-xl font-bold underline underline-offset-8">نموذج تحقيق مع موظف</h2>

          <div className="mb-6 rounded-lg border border-gray-800 p-0 shadow-sm bg-gray-50/30">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr>
                  <td className="border-b border-l border-gray-800 p-2 font-semibold w-32 bg-gray-100">اسم الموظف:</td>
                  <td className="border-b border-gray-800 p-2 font-bold flex items-center h-full"><EmployeeDocName e={e} /></td>
                </tr>
                <tr>
                  <td className="border-b border-l border-gray-800 p-2 font-semibold w-32 bg-gray-100">الرقم الوظيفي:</td>
                  <td className="border-b border-gray-800 p-2 font-bold">{e.emp_code || "—"}</td>
                </tr>
                <tr>
                  <td className="border-b border-l border-gray-800 p-2 font-semibold w-32 bg-gray-100">الوظيفة:</td>
                  <td className="border-b border-gray-800 p-2 font-bold"><EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "أخصائي"} /></td>
                </tr>
                <tr>
                  <td className="border-l border-gray-800 p-2 font-semibold w-32 bg-gray-100">موقع العمل:</td>
                  <td className="p-2 font-bold"><EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة العامة"} /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <p className="mb-3 font-semibold text-gray-800">حيث أن {e.gender === "female" ? "الموظفة المذكور بياناتها" : "الموظف المذكور بياناته"} أعلاه ، قد {e.gender === "female" ? "قامت" : "قام"} بالآتي:</p>
            <div className="space-y-6 mt-4">
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
            </div>
          </div>

          <div className="mb-8 mt-12">
            <h3 className="mb-3 font-bold text-gray-800">إفادة {e.gender === "female" ? "الموظفة" : "الموظف"}:</h3>
            <div className="space-y-6 mt-4">
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <div className="text-left w-64">
                <p className="font-semibold text-gray-800 mb-8 text-right">توقيع {e.gender === "female" ? "الموظفة" : "الموظف"} على إفادت{e.gender === "female" ? "ها" : "ه"}:</p>
                <div className="border-b border-gray-500"></div>
              </div>
            </div>
          </div>

          <div className="mb-12 mt-12">
            <h3 className="mb-3 font-bold text-gray-800">التوصيات والقرارات:</h3>
            <div className="space-y-6 mt-4">
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
              <div className="border-b-2 border-dashed border-gray-400"></div>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm font-semibold text-gray-800">
            <div className="flex flex-col items-center">
              <p className="mb-10 text-right w-full">الاعتماد:</p>
            </div>
            <div className="flex flex-col justify-start text-right">
              <p className="mb-8">موظف الشئون الإدارية الذي قام بالتحقيق:</p>
              <div className="flex items-center mb-6">
                <span className="w-16">الاسم:</span>
                <div className="flex-1 border-b border-gray-500"></div>
              </div>
              <div className="flex items-center">
                <span className="w-16">التوقيع:</span>
                <div className="flex-1 border-b border-gray-500"></div>
              </div>
            </div>
          </div>
        </DocShell>
      )}
    </div>
  );
}

function AbsenceWarningForm({ type }: { type: "first" | "second" }) {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  const isFirst = type === "first";
  const title = isFirst ? "إنذار أول بالغياب المتصل بمدة 5 أيام" : "إنذار ثاني بالغياب المتصل بمدة أيام";

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} label={`Select Employee for ${isFirst ? 'First' : 'Second'} Warning`} />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate the Warning form</p>
      ) : picker.loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DocShell>
          <div className="mx-auto w-full max-w-2xl text-justify text-lg leading-[2.2]" style={{ fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif" }}>
            <div className="mb-12 border-2 border-gray-900 bg-gray-100 p-3 text-center">
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            </div>

            <div className="mb-10 space-y-4 font-bold text-gray-900 text-xl">
              <div className="flex">
                <span className="w-24">التاريخ</span>
                <span className="mr-2">: {formatDate(todayISO())}</span>
              </div>
              <div className="flex">
                <span className="w-24">الإسم</span>
                <span className="mr-2 flex items-center">: <span className="mx-2 inline-flex items-center"><EmployeeDocName e={e} /></span></span>
              </div>
              <div className="flex">
                <span className="w-24">{isFirst ? "الوظيفة" : "القسم"}</span>
                <span className="mr-2">: {isFirst ? (getArabicPosition(e) !== "—" ? getArabicPosition(e) : "................................") : (getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "................................")}</span>
              </div>
            </div>

            <div className="mb-8 space-y-6">
              <p>
                نظراً لانقطاعكم عن العمل بشركة التقنيات المتكاملة منذ {isFirst ? "يوم" : "اليوم الاول الأحد"} ........................ الموافق &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / 202 م
                <br/>
                و حتى يوم {isFirst ? "" : "الخميس "}........................ الموافق &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / 202 م بصفة متواصلة من دون إبداء أي سبب مشروع أو إبلاغ الإدارة بسبب الانقطاع وبناء على نص قانون العمل.
              </p>
              
              <p>
                وعليه يعتبر هذا الخطاب إنذار كتابي {isFirst ? "أول وفي حال الاستمرار فى الانقطاع لمدة خمسة أيام أخرى" : "ثاني وفي حال الاستمرار فى الانقطاع"} يحق للشركة إنهاء خدمتكم وطلبكم بالتعويض المشار إليه في العقد.
              </p>
            </div>

            <div className="mt-16 space-y-8 font-bold text-xl text-gray-900">
              <p className="text-center underline underline-offset-8">ولكم منا جزيل الشكر,,,</p>
              <div className="flex justify-start mt-16 pl-12">
                <div className="text-center">
                  <p>المدير المسئول</p>
                  <div className="mt-12 w-48 border-b-2 border-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
        </DocShell>
      )}
    </div>
  );
}

export function FirstWarningForm() {
  return <AbsenceWarningForm type="first" />;
}

export function SecondWarningForm() {
  return <AbsenceWarningForm type="second" />;
}


function formatLocalPhone(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  let cleaned = rawPhone.trim();
  if (cleaned.startsWith("+20")) {
    cleaned = "0" + cleaned.slice(3).replace(/\D/g, "");
  } else if (cleaned.startsWith("0020")) {
    cleaned = "0" + cleaned.slice(4).replace(/\D/g, "");
  } else if (cleaned.startsWith("20") && cleaned.length > 10) {
    cleaned = "0" + cleaned.slice(2).replace(/\D/g, "");
  } else {
    cleaned = cleaned.replace(/\D/g, "");
    if (cleaned.length === 10 && cleaned.startsWith("1")) {
      cleaned = "0" + cleaned;
    }
  }
  return cleaned;
}

export function EditableText({ value, className }: { value?: string, className?: string }) {
  const [key, setKey] = useState(value);
  useEffect(() => setKey(value), [value]);
  return (
    <span 
      key={key}
      contentEditable 
      suppressContentEditableWarning 
      className={`outline-none hover:bg-gray-100 focus:bg-gray-100 cursor-text px-1 min-w-[20px] inline-block ${className || ""}`}
    >
      {value}
    </span>
  );
}

function DigitBox({ count, value = "" }: { count: number, value?: string }) {
  const [val, setVal] = useState(value.toString());
  useEffect(() => setVal(value.toString()), [value]);
  const chars = val.padStart(count, " ").slice(-count).split("");
  return (
    <div className="flex relative" dir="ltr">
      <input 
        type="text" 
        value={val} 
        onChange={(e) => setVal(e.target.value.replace(/[^0-9 ]/g, '').slice(0, count))} 
        className="absolute inset-0 opacity-0 cursor-text outline-none w-full h-full" 
        maxLength={count}
      />
      {chars.map((char, i) => (
        <div key={i} className="w-[20px] h-[24px] border border-black flex items-center justify-center font-bold text-black text-sm -ml-[1px]">
          {char.trim()}
        </div>
      ))}
    </div>
  );
}

function CheckSquare({ checked }: { checked?: boolean }) {
  return (
    <div className="w-[18px] h-[18px] border border-black flex items-center justify-center text-sm font-bold -mt-0.5">
      {checked && "✓"}
    </div>
  );
}

export function SocialInsuranceForm1() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} label="Select Employee for Form 1 (س1)" />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate Form 1</p>
      ) : picker.loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div
          id="hr-doc-print-area"
          dir="rtl"
          className="mx-auto w-full max-w-4xl bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none font-bold text-[15px]"
          style={{ fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif", lineHeight: 1.6 }}
        >
          {/* Page 1 */}
          <div className="min-h-[1050px]">
            {/* Header */}
            <div className="flex justify-between items-start border-b-[3px] border-black pb-2 mb-4">
              <div className="text-right flex flex-col gap-1 w-1/3">
                <h1 className="text-xl font-bold">الهيئة القومية للتأمين الاجتماعى</h1>
                <h2 className="text-xl font-bold">مكتب : اكتوبر</h2>
              </div>
              <div className="text-center w-1/3 flex flex-col items-center">
                 <img src="/images/social-insurance-logo.png" alt="الهيئة القومية للتأمين الاجتماعي" className="h-20 object-contain mb-1 mix-blend-multiply" />
              </div>
              <div className="text-left w-1/3 flex justify-end">
                <div className="font-bold text-lg mt-2">نموذج رقم ( 1 )</div>
              </div>
            </div>
            
            <div className="text-center mt-2 mb-6">
              <span className="text-xl font-bold px-8">طلــــــــب اشتراك مــؤمــــن عليـــــــــه</span>
            </div>
            
            {/* Class Section */}
            <div className="flex justify-between items-center mb-6 px-4">
              <div className="flex items-center gap-4">
                <span className="font-bold text-lg">الفئة</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border border-black flex justify-center items-center font-bold">1</div>
                    <span className="font-bold">عاملين لدى الغير</span>
                    <div className="w-8 h-8 border-[2px] border-black flex justify-center items-center text-2xl">✓</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border border-black flex justify-center items-center font-bold">3</div>
                    <span className="font-bold">العاملين بالمخابز</span>
                    <div className="w-8 h-8 border-[2px] border-black"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 border border-black flex justify-center items-center font-bold">2</div>
                <span className="font-bold">أصحاب أعمال لهم منشآت</span>
                <div className="w-8 h-8 border-[2px] border-black"></div>
              </div>
            </div>

            {/* Applicant Data */}
            <div className="relative mt-8 mb-6 border-t-[2px] border-black">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-lg font-bold">
                بيانات مقدم الطلب
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 mb-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-28 font-bold text-lg">مقدم الطلب :</span>
                  <EditableText value="احمد رفعت فكري" className="font-bold text-lg" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-28 font-bold text-lg">الرقم التأمينى :</span>
                  <DigitBox count={9} value="77379162" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-28 font-bold text-lg">الرقم قومى :</span>
                  <DigitBox count={14} value="29907210102595" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-36 font-bold text-lg">صفة مقدم الطلب :</span>
                  <EditableText value="مفوض" className="font-bold text-lg" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-36 font-bold text-lg">رقم التليفون :</span>
                  <EditableText value="01143974889" className="font-bold text-lg" />
                </div>
              </div>
            </div>

            {/* Insured Data */}
            <div className="relative mt-12 mb-6 border-t-[2px] border-black">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-lg font-bold">
                بيانات المؤمن عليه
              </div>
            </div>

            <div className="space-y-4 mt-8">
              <div className="flex items-center gap-2">
                 <span className="w-28 font-bold text-lg">الرقم التأمينى :</span>
                 <DigitBox count={9} value={e.insurance_number || ""} />
                 <span className="w-40 font-bold text-lg text-left pl-2">اسم المؤمن عليه (عربي) :</span>
                 <span className="font-bold text-lg flex-1 text-black">{e.full_name_ar || e.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-28 font-bold text-lg">الرقم القومى :</span>
                 <DigitBox count={14} value={e.national_id || ""} />
                 <span className="w-40 font-bold text-lg text-left pl-2">الجنسية :</span>
                 <EditableText value="مصرى" className="font-bold text-lg" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                 <span className="w-28 font-bold text-lg">القسم / الإدارة :</span>
                 <EditableText value={getArabicDepartment(e) !== "—" ? getArabicDepartment(e) : "الإدارة الفنية"} className="font-bold text-lg flex-1" />
                 <span className="w-28 font-bold text-lg mr-4">المهنة / الوظيفة :</span>
                 <EditableText value={getArabicPosition(e) !== "—" ? getArabicPosition(e) : "مهندس شبكات"} className="font-bold text-lg flex-1" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                 <span className="w-36 font-bold text-lg">تاريخ بدء الإشتراك :</span>
                 <DigitBox count={8} value={new Date().toISOString().split('T')[0].replace(/-/g, "")} /> 
                 <span className="w-20 font-bold text-lg mr-8">القطاع :</span>
                 <EditableText value="3" className="font-bold text-lg" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                 <span className="w-32 font-bold text-lg">كود الاشتراك:</span>
                 <span className="border-b-[2px] border-dotted border-orange-400 w-48"></span>
                 <span className="w-24 font-bold text-lg mr-8">نوع المدة :</span>
                 <span className="border-b-[2px] border-dotted border-orange-400 w-48"></span>
              </div>
              
              <div className="flex items-center justify-between mt-6 px-12">
                 <div className="flex items-center gap-2">
                   <span className="font-bold text-lg ml-2">أجر / دخل الإشتراك</span>
                   <div className="border border-black text-center min-w-[120px]">
                     <div className="border-b border-black text-sm p-1">جنيــــــــــــــــــــه</div>
                     <div className="font-bold text-xl tracking-[0.4em] py-1 relative">
       <EditableText value={e.salary || "16700"} />
     </div>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-bold text-lg ml-2">الأجر<br/>الشامل</span>
                   <div className="border border-black text-center min-w-[120px]">
                     <div className="border-b border-black text-sm p-1">جنيــــــــــــــــــــه</div>
                     <div className="font-bold text-xl tracking-[0.4em] py-1 relative">
       <EditableText value={e.salary ? (e.salary + 4600).toString() : "21300"} />
     </div>
                   </div>
                 </div>
              </div>
              
              <div className="flex items-center gap-2 mt-6">
                 <span className="font-bold text-lg">بيانات العجز إن وجدت : تاريخ بداية العجز :</span>
                 <DigitBox count={8} />
                 <span className="font-bold text-lg mr-4">نسبة العجز :</span>
                 <span className="border-b-[2px] border-dotted border-orange-400 w-32"></span>
                 <span className="text-orange-400 font-bold">%</span>
              </div>
              
              <div className="flex items-center gap-4 mt-6">
                 <span className="font-bold text-lg">استيفاء الكشف الطبي الإبتدائى :</span>
                 <span className="font-bold text-lg">نعم</span>
                 <div className="w-8 h-8 border-[2px] border-black flex justify-center items-center text-2xl">✓</div>
                 <span className="font-bold text-lg mr-4">لا</span>
                 <div className="w-8 h-8 border-[2px] border-black"></div>
              </div>
            </div>

            {/* Establishment Data */}
            <div className="relative mt-12 mb-6 border-t-[2px] border-black">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-lg font-bold">
                بيانات المنشأة
              </div>
            </div>
            
            <div className="space-y-6 mt-8">
              <div className="flex items-center gap-6">
                 <span className="font-bold text-lg">نوع المنشأة :</span>
                 <div className="flex items-center gap-2">
                   <span className="font-bold text-lg">نمطى</span>
                   <div className="w-6 h-6 border-[2px] border-black flex justify-center items-center font-bold">✓</div>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-bold text-lg">سيارة</span>
                   <div className="w-6 h-6 border-[2px] border-black"></div>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-bold text-lg">مركب صيد</span>
                   <div className="w-6 h-6 border-[2px] border-black"></div>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-bold text-lg">مخابز بلدية</span>
                   <div className="w-6 h-6 border-[2px] border-black"></div>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <span className="font-bold text-lg">اسم المنشأة :</span>
                 <EditableText value="التقنيات المتكامله" className="font-bold text-lg flex-1" />
                 <span className="font-bold text-lg">رقم المنشأة :</span>
                 <DigitBox count={7} value="2966716" />
              </div>
            </div>

            {/* Address */}
            <div className="relative mt-12 mb-6 border-t-[2px] border-black">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-lg font-bold">
                بيانات محل اقامه المؤمن عليه
              </div>
            </div>
            
            <div className="flex justify-between mt-8 px-4">
               <div className="flex items-center gap-4">
                 <span className="font-bold text-lg">عقار رقم</span>
                 <EditableText value="0" className="font-bold text-lg" />
                 <span className="font-bold text-lg mr-12">شارع :</span>
                 <EditableText value="0" className="font-bold text-lg" />
               </div>
               <div className="flex items-center gap-4">
                 <span className="font-bold text-lg">قرية #</span>
               </div>
               <div className="w-32"></div>
            </div>
            <div className="flex justify-between mt-4 px-4">
               <div className="flex items-center gap-4">
                 <span className="font-bold text-lg">قسم / مركز #</span>
               </div>
               <div className="flex items-center gap-4 mr-16">
                 <span className="font-bold text-lg">محافظة #</span>
               </div>
               <div className="w-32"></div>
            </div>

            {/* Signatures */}
            <div className="relative mt-12 mb-6 border-t-[2px] border-black">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-lg font-bold">
                التوقيع
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mt-8">
               <div className="space-y-6">
                 <div className="flex gap-2 items-center">
                   <span className="w-36 font-bold text-lg">توقيع المؤمن عليه :</span>
                   <span className="border-b-[2px] border-dotted border-orange-400 flex-1"></span>
                 </div>
                 <div className="flex gap-2 items-center">
                   <span className="w-36 font-bold text-lg">رقم التليفون :</span>
                   <span className="border-b-[2px] border-dotted border-orange-400 flex-1"></span>
                 </div>
                 <div className="font-bold text-lg mt-2">تحريراً فى :</div>
               </div>
               <div className="space-y-4">
                 <div className="font-bold text-lg mb-8 text-center">توقيع صاحب العمل / المدير المسئول</div>
                 <div className="border-b-[2px] border-dotted border-orange-400 w-full mt-4"></div>
               </div>
            </div>

            {/* Validation */}
            <div className="relative mt-12 mb-6 border-t-[2px] border-black">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-lg font-bold">
                مطابقة التوقيع
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-8 pb-12 border-b-[3px] border-black">
               <span className="font-bold text-lg">توقيع الموظف المختص بالمطابقة :</span>
               <span className="border-b-[2px] border-dotted border-orange-400 w-48"></span>
               <span className="font-bold text-lg mr-8">تاريخ المطابقة :</span>
               <EditableText className="font-bold text-lg ml-2 min-w-[20px] text-center" />
               <span className="font-bold text-lg">/</span>
               <EditableText className="font-bold text-lg mx-2 min-w-[20px] text-center" />
               <span className="font-bold text-lg">/</span>
               <EditableText className="font-bold text-lg mr-2 min-w-[40px]" />
            </div>
          </div>
          
          {/* Page 2 */}
          <div className="break-before-page min-h-[1050px] pt-12">
            <div className="text-center font-bold text-sm mb-4">
              ملحوظة: على صاحب العمل والعامل الإطلاع على التوجيهات الموضحة خلف النموذج مع التوقيع على الإقرار. (انظر خلفه)
            </div>
            <h2 className="text-center font-bold text-2xl mb-8">إرشـــــــادات</h2>
            
            <div className="space-y-4 text-[17px] font-bold leading-[2]">
              <p>1- على صاحب العمل أن يرسل هذا النموذج مع طلب اشتراكه في الهيئة لأول مرة وخلال أسبوعين على الأكثر من تاريخ التحاق أي عامل جديد بالعمل لديه سواء كان التحاقا نهائياً أو تحت الاختبار .</p>
              <p>2- التوقيع على هذا النموذج بما يفيد الاطلاع والموافقة على جميع البيانات الواردة به ولا يجوز لمـــــن وقَّع عليها أن يعارض في تلك البيانات أمام الهيئة وله أن يلجأ إلى مكتب علاقات العمل المختص أو القضاء.</p>
              <p>3- يستخدم هذا النموذج كطلب اشتراك في تأمين إصابات العمل فقط بالنسبة للفئات التاليه:</p>
              <p className="pr-4">(أ) من تجاوز سن الشيخوخة وأوقف انتفاعه بتأمين الشيخوخة والعجز والوفاة.</p>
              <p className="pr-4">(ب) العاملون الذين يخضعون لأحكام قانون العمل ممن تقل أعمارهم عن 18 سنة.</p>
              <p className="pr-4">(ج) العاملون المتدرجون والتلاميذ الصناعيون والطلاب المشتغلون في مشروعات التشغيل الصيفي والخدمة العامة، ويشترط اعتماد النموذج المحرر لهم من المدير المسئول بالهيئة التي تشرف على التلمذة الصناعية، والتدريب مع ختمها بخاتم هذه الجهة مع إرفاق نسخة من عقد عمل المتدرب أو المستند المثبت لنوع العمل في جميع هذه الحالات.</p>
              <p className="pr-4">(د) يقتصر استيفاء الأجر على الفئات التي يتقاضى فيها المؤمن عليه أجرا من صاحب العمل.</p>
            </div>
            
            <h2 className="text-center font-bold text-2xl mt-12 mb-8">إقـــــــــرار</h2>
            
            <div className="flex justify-between items-center text-xl font-bold mb-4">
              <div>اسم المنشأة التقنيات المتكامله</div>
              <div>رقمها التأميني: 2966716</div>
            </div>
            <div className="text-xl font-bold mb-8">العنوان: 9و ابراج سما المعادي</div>
            
            <p className="text-[17px] font-bold leading-[2] text-justify mb-12">
              أقر أنا الموقع على هذا النموذج بالالتزام بعرض المؤمن عليه على اللجنة الطبية المختصة بالهيئة المعنية بالتأمين الصحي أو الجهة الطبية المختصة لإجراء الفحص الطبي الأولي وإثبات حالته الصحية وقت توقيع الكشف الطبي مع الالتزام بموافاة بتقرير اللياقة الطبية الصادر من الجهة الطبية المختصة عن حالته الصحية خلال أسبوعين على الأكثر من تاريخ التحاقه بالعمل تطبيقا لأحكام قانون العمل.
            </p>
            
            <div className="text-xl font-bold text-left pl-12 mb-20">
              <div className="mb-12 text-center w-72 inline-block">توقيع (صاحب العمل / المدير المسئول)</div>
              <br/>
              <div className="w-72 inline-block text-center">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
            </div>
            
            <p className="text-[17px] font-bold leading-[2] text-justify mb-12">
              أقر انا {e.full_name_ar || e.full_name ? <EmployeeDocName e={e} /> : "...................................."} العامل بالمنشأة عاليه بأن اثبت حالتي الصحية أمام اللجنة الطبية المختصة بالهيئة المعنية بالتأمين الصحي أو الجهة الطبية المختصة وموافاة الهيئة بالتقرير الطبي عن حالتي الصحية خلال أسبوعين من تاريخ التحاقي بالعمل وفي حالة عدم قيامي بذلك فإن الهيئة القومية للتأمين الاجتماعي ليس عليها أدنى التزام قانوني بعرضى على اللجان الطبية لاثبات العجدز او صرف أية مستحقات تأمينية تترتب على العجز أيا كان نوعه السابق أو المعاصر لتاريخ الالتحاق بالعمل.
            </p>
            
            <div className="text-xl font-bold text-left pl-12">
              <div className="mb-12 text-center w-72 inline-block">توقيع المؤمن عليه</div>
              <br/>
              <div className="w-72 inline-block text-center">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SocialInsuranceForm6() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  const endDateStr = e?.contract_end_date || e?.last_action_date || new Date().toISOString().split("T")[0];
  const [endY, endM, endD] = endDateStr.split("-");

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} label="Select Employee for Form 6 (س6)" />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Select an employee to generate Form 6</p>
      ) : picker.loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div
          id="hr-doc-print-area"
          dir="rtl"
          className="mx-auto w-full max-w-4xl bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none font-bold text-[14px]"
          style={{ fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif", lineHeight: 1.5 }}
        >
          {/* Page 1 */}
          <div className="min-h-[1050px]">
            {/* Header */}
            <div className="flex justify-between items-start border-b-[3px] border-black pb-2 mb-3">
              <div className="text-right flex flex-col gap-0.5 w-1/3">
                <h1 className="text-xl font-bold">الهيئة القومية للتأمين الإجتماعي</h1>
                <div className="flex items-center gap-1 text-base font-bold">
                  <span>مكتب :</span>
                  <EditableText value="اكتوبر" className="font-bold text-base" />
                </div>
              </div>
              <div className="text-center w-1/3 flex flex-col items-center">
                <img
                  src="/images/social-insurance-logo.png"
                  alt="الهيئة القومية للتأمين الاجتماعي"
                  className="h-16 object-contain mb-1 mix-blend-multiply"
                />
              </div>
              <div className="text-left w-1/3 flex flex-col items-end">
                <div className="font-bold text-lg">نموذج رقم (٦)</div>
                <div className="text-xs text-gray-700">مطابع المخابرات العامة</div>
              </div>
            </div>

            {/* Main Title */}
            <div className="text-center my-3">
              <span className="text-2xl font-bold border-b-2 border-black pb-1 px-8 inline-block">
                إخطار بإنتهاء اشتراك مؤمن عليه
              </span>
            </div>

            {/* Establishment Data */}
            <div className="flex items-center justify-between gap-4 my-4 p-2 border border-black rounded-lg">
              <div className="flex items-center gap-2 flex-1">
                <span className="font-bold text-base whitespace-nowrap">اسم المنشأة :</span>
                <EditableText value="التقنيات المتكاملة" className="font-bold text-base flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base whitespace-nowrap">رقم المنشأة :</span>
                <DigitBox count={9} value="002966716" />
              </div>
            </div>

            {/* Insured Data Section */}
            <div className="relative mt-6 mb-4 border-t-[2px] border-black">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-base font-bold">
                بيانات المؤمن عليه
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-32 font-bold text-base">الرقم التأميني :</span>
                <DigitBox count={9} value={e.insurance_number || ""} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-32 font-bold text-base">الرقم القومــــي :</span>
                <DigitBox count={14} value={e.national_id || ""} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-32 font-bold text-base">الإســـم :</span>
                <span className="font-bold text-base flex-1 text-black">
                  {e.full_name_ar || e.full_name}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="w-32 font-bold text-base">القسم / الإدارة :</span>
                <EditableText value={getArabicDepartment(e)} className="font-bold text-base flex-1" />
                <span className="w-28 font-bold text-base mr-4">الوظيفة / المهنة :</span>
                <EditableText value={getArabicPosition(e)} className="font-bold text-base flex-1" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">تاريخ إنتهاء الإشتراك :</span>
                  <div className="flex items-center gap-1" dir="ltr">
                    <DigitBox count={4} value={endY || "2026"} />
                    <span className="font-bold">/</span>
                    <DigitBox count={2} value={endM || "01"} />
                    <span className="font-bold">/</span>
                    <DigitBox count={2} value={endD || "01"} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">سبب انتهاء الإشتراك :</span>
                  <DigitBox count={2} value="01" />
                  <EditableText value={e.inactive_reason || "استقالة"} className="font-bold text-base min-w-[120px]" />
                </div>
              </div>
            </div>

            {/* Residence Address Section */}
            <div className="relative mt-6 mb-4 border-t-[2px] border-black">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-base font-bold">
                بيانات محل إقامة المؤمن عليه
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">عقــــــــار رقــــــــم :</span>
                  <DigitBox count={4} value="9" />
                </div>
                <div className="flex items-center gap-2 flex-1 mr-4">
                  <span className="font-bold text-base whitespace-nowrap">شـــارع / حـــــارة :</span>
                  <EditableText value={e.district || "ابراج سما المعادي"} className="font-bold text-base flex-1" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">شياخة / قرية :</span>
                  <EditableText value={e.city || "المعادي"} className="font-bold text-base min-w-[70px]" />
                  <DigitBox count={2} value="01" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">قسم / مركز :</span>
                  <EditableText value="المعادي" className="font-bold text-base min-w-[70px]" />
                  <DigitBox count={2} value="02" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">محافظــــة :</span>
                  <EditableText value="القاهرة" className="font-bold text-base min-w-[70px]" />
                  <DigitBox count={2} value="01" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">رقم المحمول أو التليفون الأرضي :</span>
                  <span dir="ltr" className="inline-block">
                    <EditableText
                      value={formatLocalPhone(e.phone) || "01000000000"}
                      className="font-bold text-base font-mono tracking-wider text-left"
                    />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">البريد الإلكتروني :</span>
                  <span dir="ltr" className="inline-block">
                    <EditableText value={e.email || ""} className="font-bold text-base font-mono text-left" />
                  </span>
                </div>
              </div>
            </div>

            {/* Acknowledgment Section */}
            <div className="relative mt-6 mb-4 border-t-[2px] border-black">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-base font-bold">
                إقرار المؤمن عليه والمدير المسئول
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <p className="text-base font-bold">
                أقر أن البيانات بعاليه صحيحة وأن المؤمن عليه تسلم صورة من هذا الإخطار .
              </p>
              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <span>توقيع المؤمن عليه :</span>
                  <span className="border-b-[2px] border-dotted border-black w-44 inline-block"></span>
                  <span className="mr-2">٢٠ &nbsp;&nbsp; / &nbsp;&nbsp; /</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>توقيع المدير المسئول :</span>
                  <span className="border-b-[2px] border-dotted border-black w-44 inline-block"></span>
                  <span className="mr-2">٢٠ &nbsp;&nbsp; / &nbsp;&nbsp; /</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 text-sm text-gray-800">
                <span>تم مطابقة التوقيع بمعرفتي /</span>
                <span className="border-b border-dotted border-black flex-1"></span>
              </div>
            </div>

            {/* Dispute Acknowledgment Section */}
            <div className="relative mt-6 mb-4 border-t-[2px] border-black">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white px-6 border-[2px] border-[#4a9bd4] text-[#4a9bd4] rounded-lg text-base font-bold">
                إقرار المدير المسئول فى حالة وجود نزاع
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <p className="text-base font-bold">
                أقر أن البيانات بعاليه صحيحة وأننى أرسلت صورة من هذا الإخطار إلى المؤمن عليه بخطاب موصى عليه بعلم الوصول
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span>برقم :</span>
                  <span className="border-b-[2px] border-dotted border-black w-40 inline-block"></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>بتاريخ :</span>
                  <span className="mr-2">/ &nbsp;&nbsp; / &nbsp;&nbsp; ٢٠</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <span>توقيع المدير المسئول :</span>
                  <span className="border-b-[2px] border-dotted border-black w-48 inline-block"></span>
                  <span className="mr-2">٢٠ &nbsp;&nbsp; / &nbsp;&nbsp; /</span>
                </div>
                <div className="border-2 border-black rounded-full px-8 py-3 text-center text-xs font-bold">
                  خاتم الجهة
                </div>
              </div>
            </div>

            {/* Official Review Table */}
            <div className="mt-5">
              <table className="w-full border-2 border-black text-center text-xs">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100 font-bold">
                    <th className="border-l border-black p-1.5 w-24">البيان</th>
                    <th className="border-l border-black p-1.5">مستلم الإخطار</th>
                    <th className="border-l border-black p-1.5">المراجـــــع</th>
                    <th className="border-l border-black p-1.5">مسجـــل آلـــي</th>
                    <th className="p-1.5">مراجـــع آلـــي</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black">
                    <td className="border-l border-black p-2 font-bold bg-gray-50">الإسـم</td>
                    <td className="border-l border-black p-2"></td>
                    <td className="border-l border-black p-2"></td>
                    <td className="border-l border-black p-2"></td>
                    <td className="p-2"></td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="border-l border-black p-2 font-bold bg-gray-50">التوقيع</td>
                    <td className="border-l border-black p-2"></td>
                    <td className="border-l border-black p-2"></td>
                    <td className="border-l border-black p-2"></td>
                    <td className="p-2"></td>
                  </tr>
                  <tr>
                    <td className="border-l border-black p-2 font-bold bg-gray-50">التاريخ</td>
                    <td className="border-l border-black p-2"></td>
                    <td className="border-l border-black p-2"></td>
                    <td className="border-l border-black p-2"></td>
                    <td className="p-2"></td>
                  </tr>
                </tbody>
              </table>
              <div className="text-center font-bold text-xs mt-2">
                ملحوظة : يلزم التأكد من توقيع كل من العامل وصاحب العمل على الإقرار الموضح خلف النموذج . (أنظر خلفه)
              </div>
            </div>
          </div>

          {/* Page 2 */}
          <div className="break-before-page min-h-[1050px] pt-8">
            <h2 className="text-center font-bold text-2xl mb-6 border-b-2 border-black pb-2 inline-block mx-auto px-12 block w-fit">
              إرشـــــــادات
            </h2>

            <div className="space-y-4 text-base font-bold leading-[2] text-justify px-2">
              <p>
                ١- يحرر هذا النموذج من أصل وصورتين يرسل الأصل لمكتب الهيئة المختص خلال أسبوع من تاريخ تحقق إحدى الوقائع الآتية :
              </p>
              <div className="pr-6 space-y-1">
                <p>أ- إنتهاء خدمة المؤمن عليه .</p>
                <p>ب- إنتهاء مدة التلمذة الصناعية أو التدرج .</p>
                <p>ج- إنتهاء العمل بالمشروع الصيفي للطلبة .</p>
              </div>
              <p>
                ويحتفظ صاحب العمل بصورة ويسلم صورة للعامل بعد توقيعه أو يرسل له بخطاب مسجل بعلم الوصول خلال 24 ساعة من إرساله لمكتب الهيئة المختص فى حالة رفضه التوقيع .
              </p>
              <p>
                ٢- في حالة إخلال صاحب العمل بالإخطار فى الموعد المشار إليه بالنسبة للمؤمن عليهم فى البند (أ) من رقم (1) يلتزم بأداء مبلغ إضافي يقدر بنسبة (20%) من قيمة الاشتراك المستحق عن الشهر الأخير وذلك عن كل شهر تأخير عن المدة من تاريخ إنتهاء الخدمة حتى تاريخ إرسال النموذج لمكتب الهيئة المختص وفى حساب مدة التأخير يحذف كسر الشهر .
              </p>
            </div>

            <div className="mt-8 mb-4">
              <h2 className="text-center font-bold text-2xl border-b-2 border-black pb-2 inline-block mx-auto px-12 block w-fit">
                إقـــــــــرار
              </h2>
            </div>

            <div className="p-4 border-2 border-black rounded-lg space-y-3 mb-6">
              <div className="flex justify-between items-center text-base font-bold">
                <div className="flex items-center gap-2">
                  <span>اسم المنشأة :</span>
                  <EditableText value="التقنيات المتكاملة" />
                </div>
                <div className="flex items-center gap-2">
                  <span>رقمها التأميني :</span>
                  <DigitBox count={9} value="002966716" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-base font-bold">
                <span>العنوان :</span>
                <EditableText value="9و أبراج سما المعادي - القاهرة" className="flex-1" />
              </div>
              <div className="flex justify-between items-center text-base font-bold">
                <div className="flex items-center gap-2">
                  <span>اسم المؤمن عليه :</span>
                  <EmployeeDocName e={e} />
                </div>
                <div className="flex items-center gap-2">
                  <span>رقمه التأميني :</span>
                  <DigitBox count={9} value={e.insurance_number || ""} />
                </div>
              </div>
            </div>

            <div className="space-y-6 text-base font-bold leading-[2] text-justify px-2">
              <p>
                ٣- أقر أنا الموقع أدناه بأننى قد قمت بسحب البطاقة العلاجية من المؤمن عليه وتم تسليمها لفرع الهيئة المعنية بالتأمين الصحي وفي حالة ظهور ما يخالف ذلك أكون مسئولاً بالتضامن مع العامل فى مواجهة الهيئة المعنية بالتأمين الصحي عن كافة مصاريف العلاج والرعاية الطبية تعويضاً عن الانتفاع بدون وجه حق بمزايا العلاج والرعاية الطبية بعد إنتهاء الخدمة .
              </p>

              <div className="flex justify-between items-center pt-2 px-8">
                <div className="text-center">
                  <div className="mb-8">توقيع صاحب العمل</div>
                  <div>( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
                </div>
                <div className="text-center">
                  <div className="mb-8">توقيع المؤمن عليه</div>
                  <div>( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
                </div>
              </div>

              <div className="border-t-2 border-black pt-6 mt-6">
                <p>
                  ٤- أقر أنا الموقع أدناه بأن المؤمن عليه محل هذا النموذج قد رفض تسليم البطاقات العلاجية وقمت بإخطار الهيئة المعنية بالتأمين الصحي ببيانات المؤمن عليه لإيقاف التعامل معه .
                </p>

                <div className="flex justify-start items-center pt-4 px-8">
                  <div className="text-center">
                    <div className="mb-8">توقيع صاحب العمل</div>
                    <div>( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

