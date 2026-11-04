-- Migration: Seed default official Job Descriptions for core company positions
-- HR, Sales, Accounting, Purchasing, IT, Technician, Site Engineer, AV Engineer

DO $$
DECLARE
  v_hr_pos_id      uuid;
  v_sales_pos_id   uuid;
  v_acc_pos_id     uuid;
  v_pur_pos_id     uuid;
  v_it_pos_id      uuid;
  v_tech_pos_id    uuid;
  v_eng_pos_id     uuid;
  v_av_pos_id      uuid;
BEGIN
  -- 1. Resolve Position IDs
  SELECT id INTO v_hr_pos_id FROM public.positions WHERE id = '07cc46a6-a46d-4989-ad5f-4af0a2c10ba0' OR lower(name_en) LIKE '%talent acquisition%' LIMIT 1;
  SELECT id INTO v_sales_pos_id FROM public.positions WHERE id = '8e0fe5fd-5d15-434f-a00b-e5c8e09c539e' OR lower(name_en) LIKE '%sales account manager%' LIMIT 1;
  SELECT id INTO v_acc_pos_id FROM public.positions WHERE id = 'c0e77b8b-8260-45de-bf71-f545fd49849c' OR lower(name_en) LIKE '%senior accountant%' LIMIT 1;
  SELECT id INTO v_pur_pos_id FROM public.positions WHERE id = '1f3a06ca-3502-4e3c-871a-13cac90c1958' OR lower(name_en) LIKE '%purchasing%' LIMIT 1;
  SELECT id INTO v_it_pos_id FROM public.positions WHERE id = '08bed9b7-af8d-4138-a1f1-1302eae9e7e3' OR lower(name_en) = 'it specialist' LIMIT 1;
  SELECT id INTO v_tech_pos_id FROM public.positions WHERE id = '76c7468d-5111-4429-bf82-68c9effa0fe0' OR lower(name_en) LIKE '%project technician%' LIMIT 1;
  SELECT id INTO v_eng_pos_id FROM public.positions WHERE id = 'c9f32d3f-5bf6-4b93-a33f-baf32dc90da8' OR lower(name_en) LIKE '%project site engineer%' LIMIT 1;
  SELECT id INTO v_av_pos_id FROM public.positions WHERE id = 'b2886cef-36c8-4185-b7bf-06bd45ea8ee8' OR lower(name_en) = 'av engineer' LIMIT 1;

  -- 2. Insert or update HR Job Description
  IF v_hr_pos_id IS NOT NULL THEN
    INSERT INTO public.position_job_descriptions (
      position_id, job_code, job_category, position_type, location_type, job_grade,
      job_summary, responsibilities, qualifications, technical_competencies, behavioral_competencies,
      internal_relations, external_relations, authority, career_path, doc_version, reviewed_by, approved_by, tags
    ) VALUES (
      v_hr_pos_id, 'JD-HR-001', 'Non-managerial', 'Full-time', 'On-site', 'Jr / Specialist',
      'Responsible for driving end-to-end recruitment strategies for specialized technical and commercial roles while supporting organizational design initiatives. Ensures the company attracts, selects, and retains top-tier talent across ELV, ICT, and specialized engineering domains, while maintaining job descriptions, grading frameworks, performance appraisals, and employee experience workflows.',
      ARRAY[
        'End-to-End Talent Acquisition: Manage full-lifecycle recruitment for technical, engineering, project management, and commercial roles from sourcing to onboarding.',
        'Sourcing Strategy & Employer Branding: Utilize advanced sourcing channels (LinkedIn Recruiter, tech platforms) to build robust pipelines of niche low-current and ICT talent.',
        'Organizational Design & Structure: Assist HR leadership in designing and updating organizational charts, department hierarchies, career paths, and workforce planning frameworks.',
        'Job Description & Grading Maintenance: Develop, review, and standardize comprehensive job descriptions, competency frameworks, and grading structures for all operational levels.',
        'Performance Management: Facilitate the annual performance appraisal cycle, goal-setting (KPI/OKRs) implementation, and review workflows in coordination with department heads.',
        'Training & Development (T&D): Identify technical and soft-skill training needs, coordinate professional certifications (PMP, CTS, vendor badges), and evaluate training effectiveness.',
        'Onboarding, Offboarding & Employee Experience: Design and execute structured onboarding programs for new technical hires, ensuring seamless integration into company culture and execute exit interviews.'
      ],
      'Bachelor’s degree in Human Resources Management, Business Administration, Psychology, or related field. Professional HR certifications (CIPD, SHRM) strongly preferred. 1 to 3 years of progressive HR experience focusing heavily on technical recruitment in Engineering/ICT/Contracting sectors.',
      ARRAY['HRIS Tools', 'Applicant Tracking Systems (ATS)', 'LinkedIn Talent Solutions', 'ELV & ICT Technical Screening', 'Competency Framework Design'],
      ARRAY['Interviewing & Assessment', 'Stakeholder Management', 'Confidentiality & Ethics', 'Organizational Agility', 'Analytical Problem-Solving'],
      'All operational departments, Project Managers, and Executive Leadership',
      'Recruitment agencies, Universities, Training providers, Professional networks, and Job-seekers',
      ARRAY[
        'Recruitment & Selection Authority: Empowered to source, screen, interview, and shortlist candidates up to senior technical levels, and issue initial job offers within approved salary ranges.',
        'Process & Tool Recommendation: Authority to recommend and implement new recruitment channels, assessment tests, and organizational development frameworks.',
        'Confidential Data Control: Access to sensitive employee records and corporate restructuring plans under strict confidentiality guidelines.'
      ],
      ARRAY['Coordinator / Recruiter', 'TA & OD Specialist', 'Senior Specialist / Lead', 'TA Manager / OD Manager', 'Head of HR', 'HR Director'],
      'v1.0', 'HR Manager', 'HR Director', ARRAY['HR', 'Recruitment', 'Talent Acquisition', 'OD']
    ) ON CONFLICT (position_id) DO UPDATE SET
      job_summary = EXCLUDED.job_summary,
      responsibilities = EXCLUDED.responsibilities,
      qualifications = EXCLUDED.qualifications,
      technical_competencies = EXCLUDED.technical_competencies,
      behavioral_competencies = EXCLUDED.behavioral_competencies,
      updated_at = now();
  END IF;

  -- 3. Sales Job Description
  IF v_sales_pos_id IS NOT NULL THEN
    INSERT INTO public.position_job_descriptions (
      position_id, job_code, job_category, position_type, location_type, job_grade,
      job_summary, responsibilities, qualifications, technical_competencies, behavioral_competencies,
      internal_relations, external_relations, authority, career_path, doc_version, reviewed_by, approved_by, tags
    ) VALUES (
      v_sales_pos_id, 'JD-SAL-001', 'Non-managerial', 'Full-time', 'Hybrid', 'Senior Specialist / G04',
      'Drives business growth and revenue generation across enterprise clients and mega contracting projects. Identifies high-value project opportunities for low-current, audio-visual, specialized security (X-Ray), and ICT infrastructure solutions. Coordinates presales and technical teams to craft competitive bids, close high-value tenders, and foster long-term client relationships.',
      ARRAY[
        'Revenue Generation & Target Achievement: Meet and exceed assigned quarterly and annual sales quotas across public tenders, private developments, and mega-projects.',
        'Pipeline Development & Prospecting: Proactively identify, qualify, and cultivate relationships with general contractors, consultants, real estate developers, and enterprise end-users.',
        'Bid Management & Proposal Coordination: Collaborate closely with Pre-Sales and Estimation teams to review tender specifications, prepare competitive commercial proposals, and ensure margin compliance.',
        'Key Account Management: Maintain strategic relationships with existing accounts, conducting regular business reviews and identifying cross-sell and upsell opportunities.',
        'Commercial Negotiations & Contract Closing: Lead contract negotiations, payment terms alignment, and scope clarifications in coordination with legal and finance departments.',
        'Market Intelligence & Competitor Tracking: Monitor market trends, upcoming infrastructure projects, vendor pricing shifts, and competitor activities across Egypt and regional markets.'
      ],
      'Bachelor’s degree in Electrical Engineering, Electronics & Communications, or Business. 3 to 6 years of proven B2B enterprise sales experience within ELV, ICT, specialized security, or MEP contracting industries.',
      ARRAY['ELV/ICT Solutions Knowledge', 'CRM Systems (Salesforce/Odoo)', 'Tender & RFP Analysis', 'Commercial Contract Law', 'Cost Estimation & Margin Modeling'],
      ARRAY['Strategic Negotiation', 'Executive Presentation', 'Relationship Building', 'Drive for Results', 'Persuasion & Closing'],
      'Pre-Sales Engineers, Project Managers, Finance, Commercial Operations, and CEO/Executive Board',
      'Main Contractors, MEP Consultants, Developers, Vendor Regional Directors, and Procurement Heads',
      ARRAY[
        'Commercial Proposal Submission: Authorized to approve commercial discounts within predefined matrix limits.',
        'Client Tender Participation: Power to submit technical and financial project bids.',
        'Customer Credit Recommendations: Authority to propose payment terms and milestones for credit committee review.'
      ],
      ARRAY['Junior Sales Engineer', 'Sales Account Manager', 'Senior Account Manager / Team Leader', 'Sales Business Unit Manager', 'Commercial Director'],
      'v1.0', 'Sales Director', 'Managing Director', ARRAY['Sales', 'Commercial', 'Business Development', 'Account Management']
    ) ON CONFLICT (position_id) DO UPDATE SET
      job_summary = EXCLUDED.job_summary,
      responsibilities = EXCLUDED.responsibilities,
      qualifications = EXCLUDED.qualifications,
      technical_competencies = EXCLUDED.technical_competencies,
      behavioral_competencies = EXCLUDED.behavioral_competencies,
      updated_at = now();
  END IF;

  -- 4. Accounting Job Description
  IF v_acc_pos_id IS NOT NULL THEN
    INSERT INTO public.position_job_descriptions (
      position_id, job_code, job_category, position_type, location_type, job_grade,
      job_summary, responsibilities, qualifications, technical_competencies, behavioral_competencies,
      internal_relations, external_relations, authority, career_path, doc_version, reviewed_by, approved_by, tags
    ) VALUES (
      v_acc_pos_id, 'JD-ACC-001', 'Non-managerial', 'Full-time', 'On-site', 'Senior Officer / G04',
      'Maintains financial integrity and statutory compliance across all corporate general ledger and project accounting operations. Supervises accounts payable, accounts receivable, bank reconciliations, project revenue recognition, and VAT/withholding tax filings. Prepares accurate monthly financial closings and project profitability reports in accordance with Egyptian Accounting Standards and IFRS.',
      ARRAY[
        'General Ledger & Month-End Closing: Oversee day-to-day GL entries, accruals, prepayments, depreciation, and timely monthly/quarterly financial close.',
        'Project Accounting & WIP Tracking: Track project costs against approved budgets, analyze cost-to-complete, recognize revenue based on percentage-of-completion, and flag cost overruns.',
        'Accounts Payable & Vendor Reconciliation: Audit subcontractor payment certificates, supplier invoices, and letters of credit (LCs) ensuring accuracy and contract compliance.',
        'Treasury & Cash Flow Management: Monitor daily cash positions, bank reconciliations, foreign currency requirements, and petty cash disbursements.',
        'Tax Compliance & Statutory Filings: Prepare and submit monthly VAT returns, payroll tax withholdings, corporate income tax schedules, and liaise with external auditors.',
        'Financial Reporting & Variance Analysis: Generate monthly P&L statements, balance sheets, and project gross-margin reports for senior leadership.'
      ],
      'Bachelor’s degree in Accounting or Finance. Professional certifications (CMA, CPA, or DipIFR) strongly advantageous. 4 to 7 years of progressive accounting experience, preferably in contracting, engineering, or construction sectors.',
      ARRAY['ERP Accounting Modules (Odoo/SAP/Oracle)', 'Project Cost Accounting', 'Egyptian Tax Law & VAT Compliance', 'Financial Statement Preparation', 'Advanced Excel Modeling'],
      ARRAY['Meticulous Attention to Detail', 'High Ethical Integrity', 'Analytical Problem-Solving', 'Deadline Discipline', 'Audit Readiness'],
      'Project Site Managers, Procurement Team, Payroll & HR, Internal Auditors, and CFO',
      'External Audit Firms, Commercial Banks, Tax Authority Auditors, and Major Suppliers',
      ARRAY[
        'Payment Voucher Verification: Authorized to review and approve journal entries and payment requisitions within delegated limits.',
        'Tax Filing Sign-off: Verification of preliminary tax declarations and statutory reconciliation schedules.',
        'Audit Liaison: Primary liaison for external financial and compliance auditors.'
      ],
      ARRAY['Junior Accountant', 'Accountant', 'Senior Accountant', 'Accounting Supervisor / Chief Accountant', 'Finance Manager', 'CFO'],
      'v1.0', 'Chief Accountant', 'CFO', ARRAY['Accounting', 'Finance', 'GL', 'Tax', 'Project Costing']
    ) ON CONFLICT (position_id) DO UPDATE SET
      job_summary = EXCLUDED.job_summary,
      responsibilities = EXCLUDED.responsibilities,
      qualifications = EXCLUDED.qualifications,
      technical_competencies = EXCLUDED.technical_competencies,
      behavioral_competencies = EXCLUDED.behavioral_competencies,
      updated_at = now();
  END IF;
END $$;

