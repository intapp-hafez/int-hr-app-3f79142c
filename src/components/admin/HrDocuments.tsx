import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, Search, ChevronDown, Check, X, User, Loader2 } from "lucide-react";
import { listEmployeesAdmin, getEmployeeDetail } from "@/backend/functions/employees.functions";
import { listEmployeeCustody } from "@/backend/functions/custody.functions";
import { listAdvancesForHR } from "@/backend/functions/advances.functions";
import { formatDate, todayISO } from "@/lib/date-format";
import { AppLogo } from "@/components/AppLogo";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring";

function fmtMoney(v?: number | null) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function useEmployeePicker() {
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

function EmployeePicker({ picker, label = "Employee" }: { picker: ReturnType<typeof useEmployeePicker>; label?: string }) {
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
    <div className="print:hidden flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="relative flex-1 max-w-lg" ref={containerRef}>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>

        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex h-10 w-full items-center justify-between rounded-xl border bg-card px-3 text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-ring ${
            isOpen ? "border-brand ring-2 ring-brand/20" : "border-input hover:border-muted-foreground/40"
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedEmp ? (
              <span className="font-medium text-foreground truncate">
                {selectedEmp.full_name}
                {selectedEmp.emp_code ? (
                  <span className="ms-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                    {selectedEmp.emp_code}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-muted-foreground">Select employee…</span>
            )}
          </div>
          <div className="flex items-center gap-1">
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
                placeholder="Search employee by name or code…"
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
                        <span className="truncate">{e.full_name}</span>
                        {(e.emp_code || e.department || e.position) && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {[e.emp_code && `Code: ${e.emp_code}`, e.position, e.department].filter(Boolean).join(" · ")}
                          </span>
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
  );
}

function DocShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="hr-doc-print-area"
      dir="rtl"
      className="mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-border bg-white p-10 text-gray-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      style={{ fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif" }}
    >
      <div className="mb-6 flex items-center justify-between border-b-2 border-gray-800 pb-4">
        <AppLogo size={34} />
        <div className="text-left text-xs text-gray-500">
          <p>تاريخ الإصدار: {formatDate(todayISO())}</p>
        </div>
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
            تشهد إدارة الشركة بأن السيد/ة <strong>{e.full_name}</strong>
            {e.national_id ? <> (بطاقة رقم قومي: <strong>{e.national_id}</strong>)</> : ""}
            ، قد عمل / يعمل لدينا بوظيفة <strong>{e.position ?? "—"}</strong> بقسم <strong>{e.department ?? "—"}</strong>
            {e.contract_start_date ? (
              <> اعتباراً من تاريخ <strong>{formatDate(e.contract_start_date)}</strong></>
            ) : null}
            {e.contract_end_date ? (
              <> وحتى تاريخ <strong>{formatDate(e.contract_end_date)}</strong></>
            ) : (
              <>، وما زال على رأس عمله حتى تاريخه</>
            )}
            .
          </p>
          <p className="mb-4 text-sm leading-8 text-justify">
            وخلال فترة عمله بالشركة أظهر الكفاءة وحسن السير والسلوك والتعاون التام مع زملائه ورؤسائه في العمل.
          </p>
          <p className="mb-6 text-sm leading-8 text-justify text-gray-600">
            وقد أُعطيت له هذه الشهادة بناءً على طلبه لتقديمها إلى من يهمه الأمر دون أدنى مسؤولية أو التزام على الشركة تجاه الغير.
          </p>

          <h3 className="mb-2 mt-6 font-bold text-gray-800">بيانات الموظف</h3>
          <InfoRow label="كود الموظف" value={e.emp_code} />
          <InfoRow label="الاسم بالكامل" value={e.full_name} />
          <InfoRow label="الرقم القومي" value={e.national_id} />
          <InfoRow label="المسمى الوظيفي" value={e.position} />
          <InfoRow label="القسم / الإدارة" value={e.department} />
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
          <h2 className="mb-1 text-center text-xl font-bold">شهادة مفردات مرتب</h2>
          <p className="mb-6 text-center text-xs text-gray-500">Salary Details Certificate</p>

          <p className="mb-4 text-sm leading-8 text-justify">
            تشهد إدارة الشركة بأن السيد/ة <strong>{e.full_name}</strong>
            {e.national_id ? <> (بطاقة رقم قومي: <strong>{e.national_id}</strong>)</> : ""}،
            يعمل لدينا بوظيفة <strong>{e.position ?? "—"}</strong> بقسم <strong>{e.department ?? "—"}</strong>
            {e.contract_start_date ? (
              <> منذ تاريخ <strong>{formatDate(e.contract_start_date)}</strong></>
            ) : null}
            ، وما زال على رأس عمله حتى تاريخه، وبيان مفردات مرتبه الشهري كالآتي:
          </p>

          <h3 className="mb-2 mt-4 font-bold text-gray-800">البيانات الوظيفية</h3>
          <InfoRow label="كود الموظف" value={e.emp_code} />
          <InfoRow label="الاسم" value={e.full_name} />
          <InfoRow label="الرقم القومي" value={e.national_id} />
          <InfoRow label="الوظيفة" value={e.position} />
          <InfoRow label="القسم" value={e.department} />
          <InfoRow label="نوع التعاقد" value={e.contract_type} />
          <InfoRow label="تاريخ بداية التعاقد" value={formatDate(e.contract_start_date)} />

          <h3 className="mb-2 mt-6 font-bold text-gray-800">بيان مفردات المرتب الشهري</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-right">البند</th>
                <th className="border border-gray-300 px-3 py-2 text-right">القيمة (ج.م)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-3 py-2 font-medium">إجمالي المرتب (Gross Salary)</td>
                <td className="border border-gray-300 px-3 py-2 font-semibold">{fmtMoney(e.salary_gross)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-2 font-medium">صافي المرتب (Net Salary)</td>
                <td className="border border-gray-300 px-3 py-2 font-semibold text-brand">{fmtMoney(e.salary_net)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-2">البدلات (Allowances)</td>
                <td className="border border-gray-300 px-3 py-2">{fmtMoney(e.allowance)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-2">مرتب التأمينات (Insurance Salary)</td>
                <td className="border border-gray-300 px-3 py-2">{fmtMoney(e.insurance_salary)}</td>
              </tr>
              {e.emergency_fund ? (
                <tr>
                  <td className="border border-gray-300 px-3 py-2">صندوق الطوارئ</td>
                  <td className="border border-gray-300 px-3 py-2">{fmtMoney(e.emergency_fund)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <p className="mt-6 text-xs text-gray-500 leading-6 text-justify">
            وقد أعطيت هذه الشهادة للموظف المذكور بناءً على طلبه لتقديمها إلى الجهات المعنية دون أدنى مسؤولية أو التزام مالي على الشركة تجاه الغير.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
            <div>
              <p className="font-bold">الإدارة المالية</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">الاسم والتوقيع</div>
            </div>
            <div>
              <p className="font-bold">الموارد البشرية</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">الاسم والتوقيع</div>
            </div>
            <div>
              <p className="font-bold">اعتماد الإدارة والختم</p>
              <div className="mt-10 border-t border-gray-400 pt-1 text-xs text-gray-600">خاتم الشركة</div>
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
            أقر أنا الموقع أدناه <strong>{e.full_name}</strong>
            {e.national_id ? <> (بطاقة رقم قومي: <strong>{e.national_id}</strong>)</> : null}،
            الموظف بوظيفة <strong>{e.position ?? "—"}</strong> بقسم <strong>{e.department ?? "—"}</strong>،
            بأنني مدين للشركة بالسلف المالية الموضحة في الجدول أدناه بإجمالي مبلغ متبقي قدره (<strong>{fmtMoney(totalAdvance)} ج.م</strong>)،
            وأتعهد بسداد هذا المبلغ طبقاً للأقساط المحددة، وفي حالة تركي للعمل أو انتهاء خدمتي بالشركة لأي سبب من الأسباب
            تصبح كافة المبالغ المتبقية مستحقة السداد فوراً، وأوافق دون قيد أو شرط على خصمها من مستحقاتي أو مكافآتي طرف الشركة.
          </p>

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
            أقر أنا الموقع أدناه <strong>{e.full_name}</strong>
            {e.national_id ? <> (بطاقة رقم قومي: <strong>{e.national_id}</strong>)</> : null}،
            الموظف بوظيفة <strong>{e.position ?? "—"}</strong> بقسم <strong>{e.department ?? "—"}</strong>،
            بأنني استلمت العهد والأجهزة والأدوات الموضحة أدناه بحالة جيدة وصالحة للاستعمال، وأتعهد بالمحافظة عليها
            واستخدامها فقط في أغراض العمل الموكلة إليّ، كما أتعهد بردها بالحالة التي استلمتها بها فور طلبها أو عند
            انتهاء علاقة العمل بالشركة، وفي حالة فقدها أو تلفها نتيجة الإهمال أو التقصير أتحمل قيمتها كاملة دون أدنى اعتراض،
            وللشركة الحق في خصم قيمتها من مستحقاتي.
          </p>

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

/** إقرار على سلف وعهد (مدمجة للتوافق مع الإصدارات السابقة) */
export function AdvancesCustodyAcknowledgment() {
  return <AdvancesAcknowledgment />;
}
