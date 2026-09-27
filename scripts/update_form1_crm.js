import fs from 'fs';

const filePath = 'd:/int/int-hr-app2/src/components/admin/HrDocuments.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const targetStart = "function DigitBox({ count, value =";
const startIndex = content.indexOf(targetStart);
if (startIndex === -1) throw new Error("Could not find DigitBox");

const newContent = content.substring(0, startIndex) + `function DigitBox({ count, value = "" }: { count: number, value?: string }) {
  const chars = value.toString().padStart(count, " ").slice(-count).split("");
  return (
    <div className="flex" dir="ltr">
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
                 {/* Logo placeholder or text */}
                 <div className="w-16 h-16 border-[2px] rounded-full flex items-center justify-center text-[10px] text-center mb-1 border-blue-800 text-blue-800 leading-tight">
                   الهيئة القومية<br/>للتأمين الاجتماعي
                 </div>
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
                  <span className="font-bold text-lg">احمد رفعت فكري</span>
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
                  <span className="font-bold text-lg">مفوض</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-36 font-bold text-lg">رقم التليفون :</span>
                  <span className="font-bold text-lg">01143974889</span>
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
                 <span className="w-36 font-bold text-lg text-left pl-2">اسم المؤمن عليه :</span>
                 <span className="font-bold text-lg flex-1">{e.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-28 font-bold text-lg">الرقم القومى :</span>
                 <DigitBox count={14} value={e.national_id || ""} />
                 <span className="w-36 font-bold text-lg text-left pl-2">الجنسية :</span>
                 <span className="font-bold text-lg">مصرى</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                 <span className="w-24 font-bold text-lg">المؤهل :</span>
                 <span className="font-bold text-lg flex-1">بكالوريوس هندسه</span>
                 <span className="w-24 font-bold text-lg">المهنة :</span>
                 <span className="font-bold text-lg flex-1">{e.position || "مهندسه شبكات"}</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                 <span className="w-36 font-bold text-lg">تاريخ بدء الإشتراك :</span>
                 <DigitBox count={8} value={new Date().toISOString().split('T')[0].replace(/-/g, "")} /> 
                 <span className="w-20 font-bold text-lg mr-8">القطاع :</span>
                 <span className="font-bold text-lg">3</span>
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
                     <div className="font-bold text-xl tracking-[0.4em] py-1">{e.salary || "16700"}</div>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-bold text-lg ml-2">الأجر<br/>الشامل</span>
                   <div className="border border-black text-center min-w-[120px]">
                     <div className="border-b border-black text-sm p-1">جنيــــــــــــــــــــه</div>
                     <div className="font-bold text-xl tracking-[0.4em] py-1">{e.salary ? e.salary + 4600 : "21300"}</div>
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
                 <span className="font-bold text-lg flex-1">التقنيات المتكامله</span>
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
                 <span className="font-bold text-lg">0</span>
                 <span className="font-bold text-lg mr-12">شارع :</span>
                 <span className="font-bold text-lg">0</span>
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
               <span className="font-bold text-lg ml-2">/</span>
               <span className="font-bold text-lg ml-2">/</span>
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
              أقر انا {e.full_name || "...................................."} العامل بالمنشأة عاليه بأن اثبت حالتي الصحية أمام اللجنة الطبية المختصة بالهيئة المعنية بالتأمين الصحي أو الجهة الطبية المختصة وموافاة الهيئة بالتقرير الطبي عن حالتي الصحية خلال أسبوعين من تاريخ التحاقي بالعمل وفي حالة عدم قيامي بذلك فإن الهيئة القومية للتأمين الاجتماعي ليس عليها أدنى التزام قانوني بعرضى على اللجان الطبية لاثبات العجدز او صرف أية مستحقات تأمينية تترتب على العجز أيا كان نوعه السابق أو المعاصر لتاريخ الالتحاق بالعمل.
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
`;

fs.writeFileSync(filePath, newContent);
console.log("Successfully replaced Form 1 CRM.");
