import fs from 'fs';
const content = `

function DigitBox({ count, value = "" }: { count: number, value?: string }) {
  const chars = value.toString().padStart(count, " ").slice(-count).split("");
  return (
    <div className="flex" dir="ltr">
      {chars.map((char, i) => (
        <div key={i} className="w-[22px] h-[26px] border border-[#64a1d4] flex items-center justify-center font-bold text-gray-900 text-sm -ml-[1px]">
          {char.trim()}
        </div>
      ))}
    </div>
  );
}

function CheckSquare({ checked }: { checked?: boolean }) {
  return (
    <div className="w-[18px] h-[18px] border border-[#64a1d4] flex items-center justify-center text-sm font-bold -mt-0.5">
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
          className="mx-auto w-full max-w-4xl bg-white p-6 text-[#4a9bd4] shadow-sm print:max-w-none print:p-0 print:shadow-none text-sm font-bold mt-4"
          style={{ fontFamily: "'Traditional Arabic', 'Amiri', 'Segoe UI', serif" }}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-[#64a1d4] pb-2 mb-4">
            <div className="text-right flex flex-col gap-1">
              <h1 className="text-2xl font-bold">الهيئة القومية للتأمين الإجتماعى</h1>
              <div className="flex items-center gap-2 mt-2">
                <span>مكتب :</span>
                <div className="border-b border-dotted border-[#64a1d4] w-40"></div>
              </div>
            </div>
            <div className="text-center mt-6">
              <h2 className="text-2xl font-bold rounded-[30px] border-2 border-[#64a1d4] px-16 py-1 bg-white">طلب إشتراك مؤمن عليه</h2>
            </div>
            <div className="text-left flex flex-col gap-6">
              <div className="font-bold text-lg">نموذج رقم (1)</div>
              <div className="text-xs">مطابع المخابرات العامة</div>
            </div>
          </div>
          
          {/* Establishment Info */}
          <div className="grid grid-cols-2 gap-4 mb-4 mt-8 items-center">
            <div className="flex items-center justify-end gap-2 pr-8">
              <span className="text-[#4a9bd4]">الفئة :</span>
              <div className="flex items-center gap-2">
                 <div className="border border-[#64a1d4] px-2">1</div>
                 <span>عاملين لدى الغير</span>
                 <CheckSquare checked={true} />
              </div>
              <div className="flex items-center gap-2 mr-4">
                 <div className="border border-[#64a1d4] px-2">3</div>
                 <span>المصريين بالخارج</span>
                 <CheckSquare />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                 <div className="border border-[#64a1d4] px-2">2</div>
                 <span>أصحاب أعمال</span>
                 <CheckSquare />
              </div>
              <div className="flex items-center gap-2 mr-4">
                 <div className="border border-[#64a1d4] px-2">4</div>
                 <span>عمالة غير منتظمة</span>
                 <CheckSquare />
              </div>
            </div>
            
            <div className="flex items-center gap-2 col-span-2 mt-2">
               <span className="w-24">رقم المنشأة :</span>
               <DigitBox count={9} />
               <span className="mr-8">قطاع المنشأة :</span>
               <DigitBox count={2} />
            </div>
            
            <div className="flex items-center gap-2 col-span-2 mt-2">
               <span className="w-24">اسم المنشأة :</span>
               <span className="text-gray-900 border-b border-dotted border-[#64a1d4] flex-1 pb-1">التقنيات المتكاملة Integrated Technics</span>
               <span className="mr-4">رقم التسجيل الضريبى للمنشأة :</span>
               <div className="border-b border-dotted border-[#64a1d4] w-48 text-center text-gray-900 pb-1">/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/</div>
            </div>
          </div>

          <div className="relative mt-8 border-t border-[#64a1d4]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-8 border-2 border-[#64a1d4] rounded-[20px] text-lg">
              بيانات المؤمن عليه
            </div>
          </div>

          {/* Insured Data */}
          <div className="space-y-4 mt-8">
            <div className="flex items-center gap-2">
               <span className="w-32">الرقم التأمينى :</span>
               <DigitBox count={9} value={e.insurance_number || ""} />
            </div>
            <div className="flex items-center gap-2">
               <span className="w-32">الرقم القومى :</span>
               <DigitBox count={14} value={e.national_id || ""} />
            </div>
            <div className="flex items-center gap-2">
               <span className="w-32">اسم المؤمن عليه :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1 text-gray-900">{e.full_name}</span>
               <span className="mx-4">الجنسية :</span>
               <span className="border-b border-dotted border-[#64a1d4] w-32 text-gray-900 text-center">مصرى</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-32">المؤهل :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
               <span className="mx-4">كود المهنة :</span>
               <DigitBox count={6} />
               <span className="mx-4">المسمى :</span>
               <span className="border-b border-dotted border-[#64a1d4] w-48 text-gray-900 text-center">{e.position || ""}</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-32">تاريخ بدء الإشتراك :</span>
               <DigitBox count={8} />
               <div className="mr-8 flex items-center gap-2">
                 <span>نوع المدة</span>
                 <div className="border border-[#64a1d4] w-12 h-8"></div>
                 <span className="mr-4">المسمى :</span>
                 <span className="border-b border-dotted border-[#64a1d4] w-24"></span>
                 <span className="mr-4">كود الاشتراك</span>
                 <div className="border border-[#64a1d4] w-12 h-8"></div>
                 <span className="mr-4">القطاع :</span>
                 <span className="border-b border-dotted border-[#64a1d4] w-16"></span>
               </div>
            </div>
            <div className="flex items-center gap-6 mt-6">
               <div className="flex items-center gap-2 border border-[#64a1d4] p-2">
                 <span>أجر أساسى :</span>
                 <DigitBox count={4} />
                 <span>قرش</span>
                 <DigitBox count={5} />
                 <span>جنيه</span>
               </div>
               <div className="flex items-center gap-2 border border-[#64a1d4] p-2">
                 <span>أجر/دخل الاشتراك :</span>
                 <DigitBox count={4} />
                 <span>قرش</span>
                 <DigitBox count={5} />
                 <span>جنيه</span>
               </div>
               <div className="flex items-center gap-2 border border-[#64a1d4] p-2">
                 <span>الأجر الشامل :</span>
                 <DigitBox count={4} />
                 <span>قرش</span>
                 <DigitBox count={5} />
                 <span>جنيه</span>
               </div>
            </div>
            <div className="flex justify-between px-12 text-xs font-normal">
              <span>( لحساب %7 وفقا لقانون العمل )</span>
              <span>( لحساب اشتراك التأمين الصحى الشامل )</span>
            </div>
          </div>
          
          <div className="relative mt-12 border-t border-[#64a1d4]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-8 border-2 border-[#64a1d4] rounded-[20px] text-lg">
              بيانات محل إقامة المؤمن عليه
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-8">
            <div className="space-y-4">
              <h3 className="text-center font-bold text-lg mb-4 text-[#4a9bd4]">العنوان داخل مصر</h3>
              <div className="flex items-center gap-2">
                 <span className="w-24">عقار رقم :</span>
                 <DigitBox count={4} />
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-24">شياخة / قرية :</span>
                 <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-24">شارع / حارة :</span>
                 <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-24">قسم / مركز :</span>
                 <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
                 <span className="mx-2">محافظة :</span>
                 <DigitBox count={2} />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-center font-bold text-lg mb-4 text-[#4a9bd4]">العنوان خارج مصر</h3>
              <div className="flex items-center gap-2">
                 <span className="w-24">الدولة :</span>
                 <DigitBox count={3} />
                 <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-24">المدينة :</span>
                 <DigitBox count={3} />
                 <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-24">جهة العمل :</span>
                 <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-8">
            <div className="flex items-center gap-2">
               <span className="w-32">توقيع المؤمن عليه :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-32">توقيع المدير المسئول :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-32">رقم التليفون :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1 text-gray-900">{e.phone || ""}</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-32">البريد الإلكترونى :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1 text-gray-900">{e.email || ""}</span>
            </div>
          </div>

          <div className="mt-10 border border-[#64a1d4]">
            <table className="w-full text-center">
              <thead>
                <tr className="border-b border-[#64a1d4] divide-x divide-x-reverse divide-[#64a1d4]">
                  <th className="p-2 w-24">البيان</th>
                  <th className="p-2">مستلم الطلب</th>
                  <th className="p-2">المراجع</th>
                  <th className="p-2">سجل آليا بمعرفة</th>
                  <th className="p-2">روجع آليا بمعرفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#64a1d4]">
                <tr className="divide-x divide-x-reverse divide-[#64a1d4]">
                  <td className="p-2 font-bold">الاسم</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr className="divide-x divide-x-reverse divide-[#64a1d4]">
                  <td className="p-2 font-bold h-10">التوقيع</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr className="divide-x divide-x-reverse divide-[#64a1d4]">
                  <td className="p-2 font-bold">التاريخ</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-center text-xs font-bold text-gray-700">
            ملحوظة : على صاحب العمل والعامل الإطلاع على التوجيهات الموضحة خلف النموذج مع التوقيع على الإقرار . ( أنظر خلفه )
          </div>
        </div>
      )}
    </div>
  );
}
`;
fs.appendFileSync('d:/int/int-hr-app2/src/components/admin/HrDocuments.tsx', content);
