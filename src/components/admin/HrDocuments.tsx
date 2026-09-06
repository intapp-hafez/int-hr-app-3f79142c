import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, Search } from "lucide-react";
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
    queryFn: () => listFn({ data: { page: 1, pageSize: 50, q, sort: "full_name", dir: "asc" } }),
  });
  const detailFn = useServerFn(getEmployeeDetail);
  const detailQ = useQuery({
    queryKey: ["hr-doc-employee", employeeId],
    queryFn: () => detailFn({ data: { id: employeeId } }),
    enabled: !!employeeId,
  });
  const employees: any[] = (listQ.data as any)?.rows ?? [];
  return { q, setQ, employeeId, setEmployeeId, employees, detail: detailQ.data, loading: detailQ.isFetching };
}

function EmployeePicker({ picker, label }: { picker: ReturnType<typeof useEmployeePicker>; label: string }) {
  return (
    <div className="print:hidden grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
      <div className="relative">
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
        <Search className="pointer-events-none absolute start-3 bottom-2.5 h-4 w-4 text-muted-foreground" />
        <input
          className={`${inputCls} ps-9`}
          placeholder="Search employee…"
          value={picker.q}
          onChange={(e) => picker.setQ(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Employee</label>
        <select className={inputCls} value={picker.employeeId} onChange={(e) => picker.setEmployeeId(e.target.value)}>
          <option value="">Select employee…</option>
          {picker.employees.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.full_name} {e.emp_code ? `(${e.emp_code})` : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        disabled={!picker.employeeId}
        onClick={() => window.print()}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand disabled:opacity-40"
      >
        <Printer className="h-4 w-4" /> طباعة
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

/** شهادة الخبرة ومفردات المرتب */
export function ExperienceSalaryCertificate() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} label="ابحث عن الموظف" />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">اختر موظفاً لإنشاء شهادة الخبرة ومفردات المرتب</p>
      ) : picker.loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>
      ) : (
        <DocShell>
          <h2 className="mb-1 text-center text-xl font-bold">شهادة خبرة ومفردات مرتب</h2>
          <p className="mb-6 text-center text-xs text-gray-500">Experience &amp; Salary Details Certificate</p>

          <p className="mb-4 text-sm leading-7">
            تشهد إدارة الشركة بأن السيد/ة <strong>{e.full_name}</strong> يعمل لدينا بوظيفة{" "}
            <strong>{e.position ?? "—"}</strong> بقسم <strong>{e.department ?? "—"}</strong>
            {e.contract_start_date ? (
              <> منذ تاريخ <strong>{formatDate(e.contract_start_date)}</strong></>
            ) : null}
            ، وهو/هي على رأس عمله/ها حتى تاريخه. وقد أعطيت له/لها هذه الشهادة بناءً على طلبه/ها دون أدنى مسؤولية على الشركة.
          </p>

          <h3 className="mb-2 mt-6 font-bold text-gray-800">بيانات الموظف</h3>
          <InfoRow label="كود الموظف" value={e.emp_code} />
          <InfoRow label="الاسم" value={e.full_name} />
          <InfoRow label="الرقم القومي" value={e.national_id} />
          <InfoRow label="الوظيفة" value={e.position} />
          <InfoRow label="القسم" value={e.department} />
          <InfoRow label="نوع التعاقد" value={e.contract_type} />
          <InfoRow label="تاريخ بداية التعاقد" value={formatDate(e.contract_start_date)} />
          <InfoRow label="المدينة / المنطقة" value={[e.city, e.district].filter(Boolean).join(" - ") || null} />

          <h3 className="mb-2 mt-6 font-bold text-gray-800">مفردات المرتب</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-right">البند</th>
                <th className="border border-gray-300 px-3 py-2 text-right">القيمة (ج.م)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-3 py-2">إجمالي المرتب</td>
                <td className="border border-gray-300 px-3 py-2">{fmtMoney(e.salary_gross)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-2">صافي المرتب</td>
                <td className="border border-gray-300 px-3 py-2">{fmtMoney(e.salary_net)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-2">البدلات</td>
                <td className="border border-gray-300 px-3 py-2">{fmtMoney(e.allowance)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-2">مرتب التأمينات</td>
                <td className="border border-gray-300 px-3 py-2">{fmtMoney(e.insurance_salary)}</td>
              </tr>
            </tbody>
          </table>

          <SignatureBlock />
        </DocShell>
      )}
    </div>
  );
}

/** إقرار على سلف وعهد */
export function AdvancesCustodyAcknowledgment() {
  const picker = useEmployeePicker();
  const e = picker.detail as any;

  const custodyFn = useServerFn(listEmployeeCustody);
  const custodyQ = useQuery({
    queryKey: ["hr-doc-custody", picker.employeeId],
    queryFn: () => custodyFn({ data: { profileId: picker.employeeId } }),
    enabled: !!picker.employeeId,
  });

  const advancesFn = useServerFn(listAdvancesForHR);
  const advancesQ = useQuery({
    queryKey: ["hr-doc-advances", picker.employeeId],
    queryFn: async () => {
      const res: any = await advancesFn({ data: { page: 1, limit: 200 } });
      return (res?.advances ?? []).filter((a: any) => a.employee_id === picker.employeeId);
    },
    enabled: !!picker.employeeId,
  });

  const custody = (custodyQ.data ?? []).filter((c) => !c.return_date);
  const advances: any[] = advancesQ.data ?? [];
  const totalAdvance = advances.reduce(
    (s, a) => s + (Number(a.approved_amount ?? a.requested_amount ?? 0) - Number(a.paid_amount ?? 0)),
    0,
  );
  const loading = custodyQ.isFetching || advancesQ.isFetching || picker.loading;

  return (
    <div className="space-y-4">
      <EmployeePicker picker={picker} label="ابحث عن الموظف" />
      {!picker.employeeId ? (
        <p className="py-10 text-center text-sm text-muted-foreground">اختر موظفاً لإنشاء إقرار السلف والعهد</p>
      ) : loading || !e ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>
      ) : (
        <DocShell>
          <h2 className="mb-1 text-center text-xl font-bold">إقرار على سلف وعهد</h2>
          <p className="mb-6 text-center text-xs text-gray-500">Acknowledgment of Advances &amp; Custody</p>

          <p className="mb-4 text-sm leading-7">
            أقر أنا الموقع أدناه <strong>{e.full_name}</strong>
            {e.national_id ? <>، رقم قومي <strong>{e.national_id}</strong></> : null}، الموظف بوظيفة{" "}
            <strong>{e.position ?? "—"}</strong> بقسم <strong>{e.department ?? "—"}</strong>، بأنني استلمت
            وما زلت مديناً للشركة بالسلف والعهد الموضحة أدناه، وأتعهد بسدادها أو ردها عند الطلب أو عند انتهاء
            علاقتي بالعمل، ويحق للشركة خصم قيمتها من مستحقاتي دون الرجوع إليّ.
          </p>

          <h3 className="mb-2 mt-6 font-bold text-gray-800">أولاً: السلف القائمة</h3>
          {advances.length === 0 ? (
            <p className="py-2 text-sm text-gray-600">لا توجد سلف قائمة على الموظف.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2">م</th>
                  <th className="border border-gray-300 px-3 py-2">التاريخ</th>
                  <th className="border border-gray-300 px-3 py-2">المبلغ المعتمد (ج.م)</th>
                  <th className="border border-gray-300 px-3 py-2">المسدد (ج.م)</th>
                  <th className="border border-gray-300 px-3 py-2">المتبقي (ج.م)</th>
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
                      <td className="border border-gray-300 px-3 py-2">{fmtMoney(approved - paid)}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold">
                  <td colSpan={4} className="border border-gray-300 px-3 py-2 text-left">إجمالي السلف المتبقية</td>
                  <td className="border border-gray-300 px-3 py-2">{fmtMoney(totalAdvance)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <h3 className="mb-2 mt-6 font-bold text-gray-800">ثانياً: العهد المسلمة</h3>
          {custody.length === 0 ? (
            <p className="py-2 text-sm text-gray-600">لا توجد عهد قائمة باسم الموظف.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2">م</th>
                  <th className="border border-gray-300 px-3 py-2">تاريخ الاستلام</th>
                  <th className="border border-gray-300 px-3 py-2">اسم العهدة</th>
                  <th className="border border-gray-300 px-3 py-2">الرقم المسلسل</th>
                  <th className="border border-gray-300 px-3 py-2">الموديل</th>
                  <th className="border border-gray-300 px-3 py-2">الفئة</th>
                </tr>
              </thead>
              <tbody>
                {custody.map((c, i) => (
                  <tr key={c.id}>
                    <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                    <td className="border border-gray-300 px-3 py-2">{formatDate(c.custody_date)}</td>
                    <td className="border border-gray-300 px-3 py-2">{c.name}</td>
                    <td className="border border-gray-300 px-3 py-2">{c.serial_number ?? "—"}</td>
                    <td className="border border-gray-300 px-3 py-2">{c.model ?? "—"}</td>
                    <td className="border border-gray-300 px-3 py-2">{c.category ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SignatureBlock />
        </DocShell>
      )}
    </div>
  );
}
