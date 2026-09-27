import fs from 'fs';

const filePath = 'd:/int/int-hr-app2/src/components/admin/HrDocuments.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetSection = `          <div className="grid grid-cols-2 gap-8 mt-8">
            <div className="flex items-center gap-2">
               <span className="w-32">توقيع المؤمن عليه :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
            </div>`;

const newSection = `          <div className="relative mt-12 border-t border-[#64a1d4]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-8 border-2 border-[#64a1d4] rounded-[20px] text-lg">
              بيانات مقدم الطلب
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-24">مقدم الطلب :</span>
                <span className="font-bold text-gray-900 text-lg">احمد رفعت فكري</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24">الرقم التأمينى :</span>
                <DigitBox count={9} value="77379162" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24">الرقم قومى :</span>
                <DigitBox count={14} value="29907210102595" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-32">صفة مقدم الطلب :</span>
                <span className="font-bold text-gray-900 text-lg">مفوض</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-32">رقم التليفون :</span>
                <span className="font-bold text-gray-900 text-lg">01143974889</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="flex items-center gap-2">
               <span className="w-32">توقيع المؤمن عليه :</span>
               <span className="border-b border-dotted border-[#64a1d4] flex-1"></span>
            </div>`;

if (content.includes(targetSection)) {
  content = content.replace(targetSection, newSection);
  fs.writeFileSync(filePath, content);
  console.log("Successfully replaced content.");
} else {
  console.log("Could not find target section.");
}
