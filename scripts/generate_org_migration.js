import fs from 'fs';

const rawData = `Dep Code	Name of Department	Perant Dep	Positions	Description	Level	Reports to position
100	Executive Management	-	CEO	Chief Executive Officer	C	-
			CTO	Chief Technical Officer	C	CEO
101	Executive Office	Executive Management	EOC	Executive Operations Control 	SR	CEO
			OM	Office Manager	SR	CEO
			PUR	Public Relations Specialist	SR	CEO
			HRD	Human Resources Director	D	CEO
102	Human Resources	Executive Management	HRM	Human Resources Manager	M	HRD
			HRL	Human Resources Leader	TL	HRM
			HRS-II	Sr. Human Resources Specialist	SR	HRL
			HRS	Human Resources Specialist	JR	HRL
			HRC	Human Resource Coordinator	JR	HRL
103	Administrative	Executive Management	ADM	Administration Manager	M	CEO
			ADO	Administartion Officer	SR	ADM
			ADA	Admin Assist	JR	ADO
			BUS	Buffit Supervisor	WR	ADO
			BUW	Buffit Worker	WR	BUS
104	Finance	Executive Management	FCM	Finance Manager	M	CEO
			ACM	Accounting Manager	UM	FCM
			ACR	Accounts Receivable Specialist	SR	ACM
			ACP	Account Payable Specialist	SR	ACM
			ACTR	Treasury Accountant	JR	ACM
			ACDE	Accountant Data Entry	JR	ACM
105	Logistic & Supply Chain	Administrative	LGM	Logistic Manager	UM	ADM
			LGS	Logistic specialist	JR	LGM
			PUM	Purchasing Manager	UM	ADM
			PUS	Purchasing Supervisor	SUP	PUM
			PUS-II	Sr. Purchasing Specialist	SR	PUM
			PUS	Purchasing Specialist	JR	PUM
			FTO	Fleet Officer	UM	ADM
			DV	Driver	WR	FTO
106	Sales	Executive Management	SLM	Sales Manager	M	CEO
			SLAM	Sales Accounts Manager	UM	SLM
			SLC	Sales Coordinator	JR	SLAM
200	Technical	Executive Management	TCHD	Technical Director	D	CTO
			EBUM	Engineering  Business Unit Manager	UM	CTO
			TCHA	Technical Personal Assist	SR	TCHD
201	Engineering	Technical	END	Engineering Director	D	TCHD
			TCHSM	Technical Site Manager	PM	END
			SE-II	Sr. Site Engineer 	SR	TCHSM
			SE	Site Engineer	JR	TCHSM
202	Implementation & Maintenance 	Technical	SRM	Implementation & Maintenance Manager	M	END
			SMM	Service Maintenance Manager	M	END
			TECS	Technical Supervisor	SUP	SRM
			TEC	Technician	WR	SRM
203	Pre-Sales	Technical	PSM	Pre-Sales Manager	M	CTO
			PSTL	Pre-Sales Team Leader 	TL	PSM
			PSE-II	Sr. Pre-Sales Engineer 	SR	PSTL
			PSE	Pre-Sales Engineer 	JR	PSTL
204	Project Management	Executive Management	PMD	Project Management Director	D	CEO
			PM	Project Manager	UM	PMD
			PMC	Project Management Coordinator	JR	PM
			PSE-II	Sr. Project Site Engineer	SR	PM
			PSE	Project Site Engineer	JR	PM
			PTECHS	Project Technical Supervisor	SUP	PM
			PTECH	Project Technician	WR	PM
205	Infrastructure (IT)	Technical	IT-II	Sr. IT Specialist 	SR	TCHD
			IT	IT Specialist	JR	TCHD`;

let currentDepCode = null;
let currentDepName = null;
let currentParentDep = null;

const lines = rawData.split('\n').slice(1); // skip header
const sqlStatements = [];

sqlStatements.push(`-- Migration: 045-seed-org-structure
-- Description: Add structural columns and seed org chart

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.departments(id);

ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS code text UNIQUE;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS reports_to_position_id uuid REFERENCES public.positions(id);
`);

const departments = [];
const positions = [];
const depPos = [];

for (const line of lines) {
  const parts = line.split('\t');
  if (parts.length < 7) continue;

  let depCode = parts[0].trim();
  let depName = parts[1].trim();
  let parentDep = parts[2].trim();
  
  if (depCode) {
    currentDepCode = depCode;
    currentDepName = depName;
    currentParentDep = parentDep === '-' ? null : parentDep;
    
    departments.push({ code: currentDepCode, name: currentDepName, parent: currentParentDep });
  }

  const posCode = parts[3].trim();
  const posDesc = parts[4].trim();
  const level = parts[5].trim();
  const reportsTo = parts[6].trim();

  if (posCode) {
    positions.push({ code: posCode, desc: posDesc, level: level, reportsTo: reportsTo === '-' ? null : reportsTo });
    depPos.push({ depCode: currentDepCode, posCode: posCode, level: level });
  }
}

// Write departments logic
sqlStatements.push(`-- 1. Insert Departments (Level 1 - No Parent)`);
departments.filter(d => !d.parent).forEach(d => {
  sqlStatements.push(`INSERT INTO public.departments (code, name_en, name_ar, sort_order) VALUES ('${d.code}', '${d.name.replace(/'/g, "''")}', '${d.name.replace(/'/g, "''")}', ${d.code}) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;`);
});

sqlStatements.push(`\n-- 2. Insert Departments (Level 2+ - With Parent)`);
departments.filter(d => d.parent).forEach(d => {
  sqlStatements.push(`
DO $$
DECLARE
    v_parent_id uuid;
BEGIN
    SELECT id INTO v_parent_id FROM public.departments WHERE name_en = '${d.parent.replace(/'/g, "''")}' OR code = (SELECT code FROM public.departments WHERE name_en = '${d.parent.replace(/'/g, "''")}' LIMIT 1) LIMIT 1;
    INSERT INTO public.departments (code, name_en, name_ar, sort_order, parent_id) 
    VALUES ('${d.code}', '${d.name.replace(/'/g, "''")}', '${d.name.replace(/'/g, "''")}', ${d.code}, v_parent_id)
    ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id;
END $$;`);
});

sqlStatements.push(`\n-- 3. Insert Positions (without reports_to)`);
positions.forEach(p => {
  sqlStatements.push(`INSERT INTO public.positions (code, name_en, name_ar, sort_order) VALUES ('${p.code}', '${p.desc.replace(/'/g, "''")}', '${p.desc.replace(/'/g, "''")}', 1) ON CONFLICT (code) DO UPDATE SET name_en = EXCLUDED.name_en;`);
});

sqlStatements.push(`\n-- 4. Update Positions (with reports_to)`);
positions.filter(p => p.reportsTo).forEach(p => {
  sqlStatements.push(`
DO $$
DECLARE
    v_reports_to_id uuid;
BEGIN
    SELECT id INTO v_reports_to_id FROM public.positions WHERE code = '${p.reportsTo}';
    UPDATE public.positions SET reports_to_position_id = v_reports_to_id WHERE code = '${p.code}';
END $$;`);
});

sqlStatements.push(`\n-- 5. Insert Department Positions`);
depPos.forEach(dp => {
  sqlStatements.push(`
DO $$
DECLARE
    v_dep_id uuid;
    v_pos_id uuid;
    v_grade_id uuid;
BEGIN
    SELECT id INTO v_dep_id FROM public.departments WHERE code = '${dp.depCode}';
    SELECT id INTO v_pos_id FROM public.positions WHERE code = '${dp.posCode}';
    SELECT id INTO v_grade_id FROM public.job_grades WHERE code = '${dp.level}';
    
    IF v_dep_id IS NOT NULL AND v_pos_id IS NOT NULL AND v_grade_id IS NOT NULL THEN
        INSERT INTO public.department_positions (department_id, position_id, job_grade_id, headcount)
        VALUES (v_dep_id, v_pos_id, v_grade_id, 1)
        ON CONFLICT (department_id, position_id) DO UPDATE SET job_grade_id = EXCLUDED.job_grade_id;
    END IF;
END $$;`);
});

fs.writeFileSync('docs/migrations/045-seed-org-structure.sql', sqlStatements.join('\n'));
console.log('Migration generated successfully.');
