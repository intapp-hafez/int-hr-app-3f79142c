import fs from 'fs';

const filePath = 'd:/int/int-hr-app2/src/components/admin/HrDocuments.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const digitBoxOld = `function DigitBox({ count, value = "" }: { count: number, value?: string }) {
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
}`;

const digitBoxNew = `function EditableText({ value, className }: { value?: string, className?: string }) {
  const [key, setKey] = useState(value);
  useEffect(() => setKey(value), [value]);
  return (
    <span 
      key={key}
      contentEditable 
      suppressContentEditableWarning 
      className={\`outline-none hover:bg-gray-100 focus:bg-gray-100 cursor-text px-1 min-w-[20px] inline-block \${className || ""}\`}
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
}`;

if (content.includes(digitBoxOld)) {
  content = content.replace(digitBoxOld, digitBoxNew);
  // Now replace hardcoded texts with <EditableText value="..." className="..." />
  // "احمد رفعت فكري"
  content = content.replace(
    `<span className="font-bold text-lg">احمد رفعت فكري</span>`,
    `<EditableText value="احمد رفعت فكري" className="font-bold text-lg" />`
  );
  // "مفوض"
  content = content.replace(
    `<span className="font-bold text-lg">مفوض</span>`,
    `<EditableText value="مفوض" className="font-bold text-lg" />`
  );
  // "01143974889"
  content = content.replace(
    `<span className="font-bold text-lg">01143974889</span>`,
    `<EditableText value="01143974889" className="font-bold text-lg" />`
  );
  // "مصرى"
  content = content.replace(
    `<span className="font-bold text-lg">مصرى</span>`,
    `<EditableText value="مصرى" className="font-bold text-lg" />`
  );
  // "بكالوريوس هندسه"
  content = content.replace(
    `<span className="font-bold text-lg flex-1">بكالوريوس هندسه</span>`,
    `<EditableText value="بكالوريوس هندسه" className="font-bold text-lg flex-1" />`
  );
  // e.position
  content = content.replace(
    `<span className="font-bold text-lg flex-1">{e.position || "مهندسه شبكات"}</span>`,
    `<EditableText value={e.position || "مهندسه شبكات"} className="font-bold text-lg flex-1" />`
  );
  // Sector 3
  content = content.replace(
    `<span className="font-bold text-lg">3</span>`,
    `<EditableText value="3" className="font-bold text-lg" />`
  );
  
  // Salary
  content = content.replace(
    `<div className="font-bold text-xl tracking-[0.4em] py-1">{e.salary || "16700"}</div>`,
    `<div className="font-bold text-xl tracking-[0.4em] py-1 relative">
       <EditableText value={e.salary || "16700"} />
     </div>`
  );
  content = content.replace(
    `<div className="font-bold text-xl tracking-[0.4em] py-1">{e.salary ? e.salary + 4600 : "21300"}</div>`,
    `<div className="font-bold text-xl tracking-[0.4em] py-1 relative">
       <EditableText value={e.salary ? (e.salary + 4600).toString() : "21300"} />
     </div>`
  );
  
  // "التقنيات المتكامله"
  content = content.replace(
    `<span className="font-bold text-lg flex-1">التقنيات المتكامله</span>`,
    `<EditableText value="التقنيات المتكامله" className="font-bold text-lg flex-1" />`
  );
  // Building 0
  content = content.replace(
    `<span className="font-bold text-lg">0</span>\n                 <span className="font-bold text-lg mr-12">شارع :</span>\n                 <span className="font-bold text-lg">0</span>`,
    `<EditableText value="0" className="font-bold text-lg" />\n                 <span className="font-bold text-lg mr-12">شارع :</span>\n                 <EditableText value="0" className="font-bold text-lg" />`
  );
  
  // Date of sign
  content = content.replace(
    `<span className="font-bold text-lg mr-8">تاريخ المطابقة :</span>\n               <span className="font-bold text-lg ml-2">/</span>\n               <span className="font-bold text-lg ml-2">/</span>`,
    `<span className="font-bold text-lg mr-8">تاريخ المطابقة :</span>\n               <EditableText className="font-bold text-lg ml-2 min-w-[20px] text-center" />\n               <span className="font-bold text-lg">/</span>\n               <EditableText className="font-bold text-lg mx-2 min-w-[20px] text-center" />\n               <span className="font-bold text-lg">/</span>\n               <EditableText className="font-bold text-lg mr-2 min-w-[40px]" />`
  );

  fs.writeFileSync(filePath, content);
  console.log("Successfully made form editable.");
} else {
  console.log("Could not find DigitBox.");
}
