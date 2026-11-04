import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hydakxwzpfzwolencnmp.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZGFreHd6cGZ6d29sZW5jbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MTU0OCwiZXhwIjoyMDk2NDI3NTQ4fQ.UFHMPqwKXj5zQuxEA6zTw8kYfWDsvS9v6mnFK2qmUzs";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

interface SeedJd {
  position_name: string;
  position_id?: string;
  job_code: string;
  job_category: "Non-managerial" | "Managerial";
  position_type: "Full-time" | "Part-time" | "Contract";
  location_type: "On-site" | "Remote" | "Hybrid";
  job_grade: string;
  job_summary: string;
  responsibilities: string[];
  qualifications: string;
  technical_competencies: string[];
  behavioral_competencies: string[];
  internal_relations: string;
  external_relations: string;
  authority: string[];
  career_path: string[];
  doc_version: string;
  reviewed_by: string;
  approved_by: string;
  tags: string[];
}

const SEED_DATA: SeedJd[] = [
  // ── 1. HR: Talent Acquisition & OD Specialist ──────────────────────────────
  {
    position_name: "Talent Acquisition & OD Specialist",
    position_id: "07cc46a6-a46d-4989-ad5f-4af0a2c10ba0",
    job_code: "JD-HR-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Jr / Specialist",
    job_summary: "Responsible for driving end-to-end recruitment strategies for specialized technical and commercial roles while supporting organizational design initiatives. Ensures the company attracts, selects, and retains top-tier talent across ELV, ICT, and specialized engineering domains, while maintaining job descriptions, grading frameworks, performance appraisals, and employee experience workflows.",
    responsibilities: [
      "End-to-End Talent Acquisition: Manage full-lifecycle recruitment for technical, engineering, project management, and commercial roles from sourcing to onboarding.",
      "Sourcing Strategy & Employer Branding: Utilize advanced sourcing channels (LinkedIn Recruiter, tech platforms) to build robust pipelines of niche low-current and ICT talent.",
      "Organizational Design & Structure: Assist HR leadership in designing and updating organizational charts, department hierarchies, career paths, and workforce planning frameworks.",
      "Job Description & Grading Maintenance: Develop, review, and standardize comprehensive job descriptions, competency frameworks, and grading structures for all operational levels.",
      "Performance Management: Facilitate the annual performance appraisal cycle, goal-setting (KPI/OKRs) implementation, and review workflows in coordination with department heads.",
      "Training & Development (T&D): Identify technical and soft-skill training needs, coordinate professional certifications (PMP, CTS, vendor badges), and evaluate training effectiveness.",
      "Onboarding, Offboarding & Employee Experience: Design and execute structured onboarding programs for new technical hires, ensuring seamless integration into company culture and execute exit interviews.",
    ],
    qualifications: "Bachelor’s degree in Human Resources Management, Business Administration, Psychology, or related field. Professional HR certifications (CIPD, SHRM) strongly preferred. 1 to 3 years of progressive HR experience focusing heavily on technical recruitment in Engineering/ICT/Contracting sectors.",
    technical_competencies: ["HRIS Tools", "Applicant Tracking Systems (ATS)", "LinkedIn Talent Solutions", "ELV & ICT Technical Screening", "Competency Framework Design"],
    behavioral_competencies: ["Interviewing & Assessment", "Stakeholder Management", "Confidentiality & Ethics", "Organizational Agility", "Analytical Problem-Solving"],
    internal_relations: "All operational departments, Project Managers, and Executive Leadership",
    external_relations: "Recruitment agencies, Universities, Training providers, Professional networks, and Job-seekers",
    authority: [
      "Recruitment & Selection Authority: Empowered to source, screen, interview, and shortlist candidates up to senior technical levels, and issue initial job offers within approved salary ranges.",
      "Process & Tool Recommendation: Authority to recommend and implement new recruitment channels, assessment tests, and organizational development frameworks.",
      "Confidential Data Control: Access to sensitive employee records and corporate restructuring plans under strict confidentiality guidelines.",
    ],
    career_path: [
      "Coordinator / Recruiter",
      "TA & OD Specialist",
      "Senior Specialist / Lead",
      "TA Manager / OD Manager",
      "Head of HR",
      "HR Director",
    ],
    doc_version: "v1.0",
    reviewed_by: "HR Manager",
    approved_by: "HR Director",
    tags: ["HR", "Recruitment", "Talent Acquisition", "OD", "Organizational Development"],
  },

  // ── 2. SALES: Sales Account Manager ─────────────────────────────────────────
  {
    position_name: "Sales Account Manager",
    position_id: "8e0fe5fd-5d15-434f-a00b-e5c8e09c539e",
    job_code: "JD-SAL-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "Hybrid",
    job_grade: "Senior Specialist / G04",
    job_summary: "Drives business growth and revenue generation across enterprise clients and mega contracting projects. Identifies high-value project opportunities for Integrated Technics' low-current, audio-visual, specialized security (X-Ray), and ICT infrastructure solutions. Coordinates presales and technical teams to craft competitive bids, close high-value tenders, and foster long-term client relationships.",
    responsibilities: [
      "Revenue Generation & Target Achievement: Meet and exceed assigned quarterly and annual sales quotas across public tenders, private developments, and mega-projects.",
      "Pipeline Development & Prospecting: Proactively identify, qualify, and cultivate relationships with general contractors, consultants, real estate developers, and enterprise end-users.",
      "Bid Management & Proposal Coordination: Collaborate closely with Pre-Sales and Estimation teams to review tender specifications, prepare competitive commercial proposals, and ensure margin compliance.",
      "Key Account Management: Maintain strategic relationships with existing accounts, conducting regular business reviews and identifying cross-sell and upsell opportunities.",
      "Commercial Negotiations & Contract Closing: Lead contract negotiations, payment terms alignment, and scope clarifications in coordination with legal and finance departments.",
      "Market Intelligence & Competitor Tracking: Monitor market trends, upcoming infrastructure projects, vendor pricing shifts, and competitor activities across Egypt and regional markets.",
    ],
    qualifications: "Bachelor’s degree in Electrical Engineering, Electronics & Communications, or Business. 3 to 6 years of proven B2B enterprise sales experience within ELV, ICT, specialized security, or MEP contracting industries.",
    technical_competencies: ["ELV/ICT Solutions Knowledge", "CRM Systems (Salesforce/Odoo)", "Tender & RFP Analysis", "Commercial Contract Law", "Cost Estimation & Margin Modeling"],
    behavioral_competencies: ["Strategic Negotiation", "Executive Presentation", "Relationship Building", "Drive for Results", "Persuasion & Closing"],
    internal_relations: "Pre-Sales Engineers, Project Managers, Finance, Commercial Operations, and CEO/Executive Board",
    external_relations: "Main Contractors, MEP Consultants, Developers, Vendor Regional Directors, and Procurement Heads",
    authority: [
      "Commercial Proposal Submission: Authorized to approve commercial discounts within predefined matrix limits.",
      "Client Tender Participation: Power to submit technical and financial project bids.",
      "Customer Credit Recommendations: Authority to propose payment terms and milestones for credit committee review.",
    ],
    career_path: [
      "Junior Sales Engineer",
      "Sales Account Manager",
      "Senior Account Manager / Team Leader",
      "Sales Business Unit Manager",
      "Commercial Director",
    ],
    doc_version: "v1.0",
    reviewed_by: "Sales Director",
    approved_by: "Managing Director",
    tags: ["Sales", "Commercial", "Business Development", "Account Management", "ELV"],
  },

  // ── 3. ACCOUNTING: Senior Accountant ────────────────────────────────────────
  {
    position_name: "Senior Accountant",
    position_id: "c0e77b8b-8260-45de-bf71-f545fd49849c",
    job_code: "JD-ACC-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Senior Officer / G04",
    job_summary: "Maintains financial integrity and statutory compliance across all corporate general ledger and project accounting operations. Supervises accounts payable, accounts receivable, bank reconciliations, project revenue recognition, and VAT/withholding tax filings. Prepares accurate monthly financial closings and project profitability reports in accordance with Egyptian Accounting Standards and IFRS.",
    responsibilities: [
      "General Ledger & Month-End Closing: Oversee day-to-day GL entries, accruals, prepayments, depreciation, and timely monthly/quarterly financial close.",
      "Project Accounting & WIP Tracking: Track project costs against approved budgets, analyze cost-to-complete, recognize revenue based on percentage-of-completion, and flag cost overruns.",
      "Accounts Payable & Vendor Reconciliation: Audit subcontractor payment certificates, supplier invoices, and letters of credit (LCs) ensuring accuracy and contract compliance.",
      "Treasury & Cash Flow Management: Monitor daily cash positions, bank reconciliations, foreign currency requirements, and petty cash disbursements.",
      "Tax Compliance & Statutory Filings: Prepare and submit monthly VAT returns, payroll tax withholdings, corporate income tax schedules, and liaise with external auditors.",
      "Financial Reporting & Variance Analysis: Generate monthly P&L statements, balance sheets, and project gross-margin reports for senior leadership.",
    ],
    qualifications: "Bachelor’s degree in Accounting or Finance. Professional certifications (CMA, CPA, or DipIFR) strongly advantageous. 4 to 7 years of progressive accounting experience, preferably in contracting, engineering, or construction sectors.",
    technical_competencies: ["ERP Accounting Modules (Odoo/SAP/Oracle)", "Project Cost Accounting", "Egyptian Tax Law & VAT Compliance", "Financial Statement Preparation", "Advanced Excel Modeling"],
    behavioral_competencies: ["Meticulous Attention to Detail", "High Ethical Integrity", "Analytical Problem-Solving", "Deadline Discipline", "Audit Readiness"],
    internal_relations: "Project Site Managers, Procurement Team, Payroll & HR, Internal Auditors, and CFO",
    external_relations: "External Audit Firms, Commercial Banks, Tax Authority Auditors, and Major Suppliers",
    authority: [
      "Payment Voucher Verification: Authorized to review and approve journal entries and payment requisitions within delegated limits.",
      "Tax Filing Sign-off: Verification of preliminary tax declarations and statutory reconciliation schedules.",
      "Audit Liaison: Primary liaison for external financial and compliance auditors.",
    ],
    career_path: [
      "Junior Accountant",
      "Accountant",
      "Senior Accountant",
      "Accounting Supervisor / Chief Accountant",
      "Finance Manager",
      "CFO",
    ],
    doc_version: "v1.0",
    reviewed_by: "Chief Accountant",
    approved_by: "CFO",
    tags: ["Accounting", "Finance", "GL", "Tax", "Project Costing", "Odoo"],
  },

  // ── 4. PROCUREMENT: Purchasing Coordinator ──────────────────────────────────
  {
    position_name: "Purchasing Coordinator",
    position_id: "1f3a06ca-3502-4e3c-871a-13cac90c1958",
    job_code: "JD-PUR-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Officer / G03",
    job_summary: "Executes cost-effective, timely procurement of specialized ELV equipment, cables, security devices, audiovisual hardware, and project consumables. Manages RFQs, supplier negotiations, purchase order workflows, customs clearance tracking, and on-site delivery coordination to support seamless site operations without schedule delays.",
    responsibilities: [
      "Purchase Order Execution: Process approved Material Requisitions (MRs), verify technical specifications, issue RFQs, and generate formal Purchase Orders (POs) in ERP.",
      "Supplier Negotiation & Cost Optimization: Solicit competitive quotes from local and international distributors, negotiating payment terms, warranties, and volume discounts.",
      "Procurement Schedule & Delivery Tracking: Monitor order fulfillment timelines, factory lead-times, and shipping schedules to prevent project site downtime.",
      "Vendor Relationship & Performance Evaluation: Maintain approved vendor lists (AVL), evaluating suppliers on pricing, reliability, lead time, and post-sale technical support.",
      "Customs Clearance & Import Logistics Coordination: Coordinate with freight forwarders and customs brokers for imported consignments (AV processors, X-Ray scanners, servers).",
      "Warehouse Receiving & Dispute Resolution: Partner with warehouse keepers to verify delivered items against delivery notes and resolve RMA/damage claims promptly.",
    ],
    qualifications: "Bachelor’s degree in Business, Supply Chain Management, Logistics, or Engineering. 2 to 4 years of procurement experience within contracting, telecommunications, or electrical systems.",
    technical_competencies: ["ERP Procurement Workflows (Odoo)", "Incoterms 2020 & Shipping Documentation", "Technical BOQ Interpretation", "Vendor Sourcing & RFQ Management", "Price Comparison Modeling"],
    behavioral_competencies: ["Strong Commercial Negotiation", "Patience & Persistence", "Time Management", "Integrity & Transparency", "Cross-Functional Coordination"],
    internal_relations: "Site Project Engineers, Technical Office, Warehouse Keepers, Finance/Treasury, and Procurement Manager",
    external_relations: "Hardware Distributors, Manufacturers, International Freight Forwarders, and Customs Clearance Agents",
    authority: [
      "RFQ Issuance: Authorized to contact and solicit proposals from approved and new vendor sources.",
      "PO Generation: Authority to draft and recommend purchase orders up to approved budget thresholds.",
      "Material Receiving Sign-off: Verification of initial technical compliance upon warehouse delivery.",
    ],
    career_path: [
      "Purchasing Assistant",
      "Purchasing Coordinator",
      "Procurement Specialist",
      "Senior Procurement Engineer",
      "Procurement Manager",
      "Supply Chain Director",
    ],
    doc_version: "v1.0",
    reviewed_by: "Procurement Manager",
    approved_by: "Operations Director",
    tags: ["Purchasing", "Procurement", "Supply Chain", "Vendor Management", "Logistics"],
  },

  // ── 5. IT: IT Specialist ────────────────────────────────────────────────────
  {
    position_name: "IT Specialist",
    position_id: "08bed9b7-af8d-4138-a1f1-1302eae9e7e3",
    job_code: "JD-IT-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Officer / G03",
    job_summary: "Ensures seamless continuity, performance, and security of corporate IT infrastructure, networks, workstations, and business applications. Provides tier 1 & tier 2 technical support to head office and branch employees, administers Microsoft 365 / Active Directory, manages firewalls and VPNs, oversees routine backups, and supports ERP system maintenance.",
    responsibilities: [
      "User Support & Helpdesk Administration: Provide hands-on hardware, OS, and software troubleshooting for all company employees, resolving ticketing SLAs promptly.",
      "Network & Infrastructure Maintenance: Monitor local office LAN/WAN, Wi-Fi access points, switches, routers, and secure site-to-site VPN tunnels.",
      "Server & Cloud Administration: Manage Microsoft 365, user mailboxes, Active Directory user provisioning, file sharing permissions, and cloud storage.",
      "Data Backup & Disaster Recovery: Execute and verify daily, weekly, and monthly automated backups of critical databases, ERP instances, and file servers.",
      "Cybersecurity & Endpoint Protection: Deploy and update endpoint antivirus solutions, patch operating systems, enforce strong password policies, and monitor intrusion alerts.",
      "Hardware Asset Management: Maintain IT asset inventory (laptops, desktops, printers, biometric devices), conducting preventative maintenance and hardware upgrades.",
    ],
    qualifications: "Bachelor’s degree in Computer Science, Information Technology, or Computer Engineering. CompTIA Network+, Security+, CCNA, or Microsoft Certified Administrator certifications preferred. 2 to 4 years of hands-on IT support experience.",
    technical_competencies: ["Windows/Linux Server Administration", "Cisco/Fortinet Networking & VPNs", "Microsoft 365 & Azure AD", "Virtualization (VMware/Hyper-V)", "ERP User Support (Odoo)"],
    behavioral_competencies: ["Customer Service Orientation", "Rapid Problem Isolation", "High Discretion & Confidentiality", "Proactive System Monitoring", "Clear Technical Communication"],
    internal_relations: "All company personnel, System Developers, HR, Administration, and CTO",
    external_relations: "Internet Service Providers (ISPs), IT Hardware Vendors, Software Licensing Partners, and Cloud Providers",
    authority: [
      "Access Control Management: Authority to grant and revoke system access and domain credentials according to approved HR requests.",
      "Emergency System Isolation: Authorized to disconnect compromised devices or segments during security incidents.",
      "IT Consumables Requisition: Power to initiate procurement requests for computer parts and accessories.",
    ],
    career_path: [
      "IT Helpdesk Technician",
      "IT Specialist",
      "Senior Network / System Engineer",
      "IT Infrastructure Lead",
      "IT Manager",
      "Chief Technology Officer (CTO)",
    ],
    doc_version: "v1.0",
    reviewed_by: "IT Manager",
    approved_by: "CTO",
    tags: ["IT", "Infrastructure", "Helpdesk", "Networking", "SysAdmin", "Cybersecurity"],
  },

  // ── 6. TECHNICIAN: Project Technician ───────────────────────────────────────
  {
    position_name: "Project Technician",
    position_id: "76c7468d-5111-4429-bf82-68c9effa0fe0",
    job_code: "JD-TEC-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Technician / G02",
    job_summary: "Executes skilled on-site installation, cabling, termination, rack mounting, device testing, and maintenance of ELV, security, sound, and telecommunication systems on project sites. Works under the guidance of Site Engineers to ensure installations comply strictly with approved engineering drawings, safety standards, and project delivery schedules.",
    responsibilities: [
      "Site Cabling & Containment Installation: Pull and route copper (Cat6/Cat6A), coaxial, and fiber optic cabling through conduits, cable trays, and raceways according to schematic drawings.",
      "Device Mounting & Termination: Terminate patch panels, faceplates, RJ45 connectors, keystone jacks, terminal blocks, sensors, and IP cameras neatly and accurately.",
      "Rack Dressing & Equipment Installation: Mount network switches, servers, NVRs/DVRs, amplifiers, and UPS units into 19-inch racks with tidy cable lacing and labeling.",
      "Testing & Continuity Verification: Perform cable continuity, tone tracing, and certification testing using Fluke testers, recording all test results for inspection approvals.",
      "Corrective & Preventative Maintenance: Inspect installed equipment, troubleshoot wiring faults, replace defective devices, and clean optical connectors during maintenance visits.",
      "Site Safety & HSE Compliance: Adhere strictly to occupational health and safety rules, wearing full PPE (helmet, safety boots, harness) and maintaining clean work zones.",
    ],
    qualifications: "Technical Industrial Diploma (Electricity / Electronics / Communications) or equivalent vocational qualification. 2 to 5 years of physical on-site experience installing ELV, CCTV, Access Control, Fire Alarm, or Public Address systems.",
    technical_competencies: ["Fiber Splicing & Copper Termination", "Cable Tray & Conduit Routing", "Fluke Cable Testing & Certification", "Schematic & As-Built Drawing Reading", "Electrical Safety Standards"],
    behavioral_competencies: ["Physical Stamina & Agility", "Attention to Neatness & Labeling", "Teamwork & Punctuality", "Safety-First Mindset", "Responsiveness to Instructions"],
    internal_relations: "Site Engineers, Technical Supervisors, Site Safety Officers, and Warehouse Keepers",
    external_relations: "Main Contractor Site Foremen and Subcontractor Installation Crews",
    authority: [
      "Physical Installation Execution: Authorized to carry out wiring, mounting, and testing per approved method statements.",
      "Defect Reporting: Authority to halt work and report unsafe site conditions or damaged materials to the site supervisor.",
      "Equipment Handover Check: Signing site tool custody sheets and daily job cards.",
    ],
    career_path: [
      "Assistant Technician",
      "Project Technician",
      "Senior Specialist Technician",
      "Technical Supervisor",
      "Site Supervisor",
      "Field Operations Lead",
    ],
    doc_version: "v1.0",
    reviewed_by: "Technical Supervisor",
    approved_by: "Project Manager",
    tags: ["Technician", "ELV", "CCTV", "Cabling", "Installation", "Site Work"],
  },

  // ── 7. PROJECT / SITE ENGINEER: Project Site Engineer ──────────────────────
  {
    position_name: "Project Site Engineer",
    position_id: "c9f32d3f-5bf6-4b93-a33f-baf32dc90da8",
    job_code: "JD-ENG-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Officer / G03",
    job_summary: "Leads field engineering execution, technical supervision, commissioning, and client handover of low-current systems (CCTV, Access Control, Fire Alarm, Public Address, BMS, and Structured Cabling) on construction sites. Coordinates daily installation workflows, reviews shop drawings, inspects subcontractor performance, submits Work Inspection Requests (WIRs), and ensures milestone delivery within scope, budget, and quality standards.",
    responsibilities: [
      "On-Site Technical Supervision: Supervise daily installation of all ELV infrastructure, containment, cabling, and field devices ensuring strict adherence to approved shop drawings.",
      "Inspection & Consultant Approvals: Prepare and submit Work Inspection Requests (WIRs) and Material Inspection Requests (MIRs) to supervising MEP consultants, resolving snag-lists.",
      "Testing & Commissioning: Lead system programming, head-end configuration, device testing, and integration across CCTV, Access Control, and Network switches.",
      "Subcontractor & Workforce Management: Allocate tasks to technicians and subcontractors, monitor daily productivity, and enforce quality workmanship standards.",
      "Progress Reporting & Lookahead Planning: Maintain daily site logs, track percentage completion against project baseline schedules, and attend contractor progress meetings.",
      "As-Built Documentation & Handover: Redline drawings for as-built submission, prepare O&M manuals, and facilitate final client training and commissioning sign-off.",
    ],
    qualifications: "Bachelor’s degree in Electrical Engineering, Electronics, or Communications. 2 to 4 years of solid on-site project execution experience in ELV / Light Current contracting projects. AutoCAD proficiency required.",
    technical_competencies: ["ELV Systems Architecture (CCTV, Access, FA, PA)", "Shop Drawing & Schematic Interpretation", "Testing & Commissioning Protocols", "AutoCAD & Engineering Redlining", "Work Inspection Request (WIR) Procedures"],
    behavioral_competencies: ["Site Leadership & Problem Solving", "Consultant & Client Relationship Management", "Resilience Under Pressure", "High Quality Standards", "Team Motivation"],
    internal_relations: "Project Manager, Technical Office Team Leader, Technicians, Procurement Coordinator, and Safety Officer",
    external_relations: "Main Contractor Project Team, MEP Supervising Consultants, and Vendor Field Application Engineers",
    authority: [
      "Work Quality Inspection: Authorized to accept or reject subcontractor work on-site based on specification compliance.",
      "Daily Work Requisition: Authority to request site materials and tool handovers from the warehouse.",
      "Client Technical Representation: Power to represent the company in daily technical coordination site meetings.",
    ],
    career_path: [
      "Junior Site Engineer",
      "Project Site Engineer",
      "Senior Site Engineer",
      "Project Manager",
      "Senior Projects Manager",
      "Projects Director",
    ],
    doc_version: "v1.0",
    reviewed_by: "Project Manager",
    approved_by: "Projects Director",
    tags: ["Engineering", "ELV", "Site Engineer", "Testing & Commissioning", "Construction"],
  },

  // ── 8. AUDIOVISUAL: AV Engineer ─────────────────────────────────────────────
  {
    position_name: "AV Engineer",
    position_id: "b2886cef-36c8-4185-b7bf-06bd45ea8ee8",
    job_code: "JD-AV-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Specialist / G03",
    job_summary: "Specializes in the design, installation, programming, calibration, and integration of professional commercial audiovisual solutions (boardrooms, video walls, auditorium sound systems, digital signage, unified communications, and smart control systems). Ensures top-tier acoustic performance, video fidelity, and user-friendly touch panel interfaces for high-profile clients.",
    responsibilities: [
      "AV Systems Installation & Cabling: Supervise specialized audio/video cabling, display mounting, projection rigging, microphone placements, and rack integration.",
      "Control System & DSP Programming: Configure and program audio DSPs (Biamp, Q-SYS), video matrix switchers (Crestron, Extron, Kramer), and room automation controllers.",
      "Unified Communications Integration: Deploy and optimize Microsoft Teams Rooms (MTR), Zoom Rooms, PTZ cameras, and acoustic echo cancellation (AEC) systems.",
      "Acoustic Calibration & Video Tuning: Calibrate professional sound reinforcement systems using audio analyzers, and fine-tune LED video walls and laser projectors.",
      "User Training & Documentation: Conduct executive and client administrator training sessions, preparing simple quick-reference guides and system schematics.",
      "Preventative Maintenance & Event Support: Provide technical support during high-profile corporate events and conduct preventative maintenance on AV hardware.",
    ],
    qualifications: "Bachelor’s degree in Electrical, Electronics, or Sound Engineering. AVIXA CTS certification or Crestron/Q-SYS/Biamp vendor badges strongly preferred. 2 to 5 years of commercial AV systems integration experience.",
    technical_competencies: ["Audio DSP Programming (Biamp/Q-SYS)", "AV Over IP & Dante Protocols", "Crestron / Extron Control Systems", "Display Calibration & Video Walls", "Acoustic Tuning & Echo Cancellation"],
    behavioral_competencies: ["Aesthetic & Acoustic Sensitivity", "Customer-Centric Problem Solving", "Analytical Troubleshooting", "Executive Communication", "Detail Precision"],
    internal_relations: "AV Business Unit Head, Pre-Sales Engineers, Site Electricians, and Project Coordinators",
    external_relations: "Enterprise Executives, Interior Designers, AV Equipment Manufacturers, and Event Organizers",
    authority: [
      "System Commissioning Sign-off: Authorized to approve final audio/video calibration and hand over systems to clients.",
      "Firmware & Configuration Updates: Power to implement firmware updates and control program adjustments.",
      "Technical Recommendation: Authority to specify AV components and substitution equivalents.",
    ],
    career_path: [
      "Junior AV Technician",
      "AV Engineer",
      "Senior AV Specialist / Solution Architect",
      "AV Team Leader",
      "AV Business Unit Head",
    ],
    doc_version: "v1.0",
    reviewed_by: "AV Business Unit Head",
    approved_by: "Chief Technical Officer",
    tags: ["AV", "Audiovisual", "Crestron", "Q-SYS", "Unified Communications", "Video Walls"],
  },

  // ── 9. PROJECT MANAGEMENT: Project Manager ─────────────────────────────────
  {
    position_name: "Project Manager",
    position_id: "d5d4e9bc-3d29-43eb-b136-c6c51160b1fa",
    job_code: "JD-PM-001",
    job_category: "Managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Manager / G06",
    job_summary: "Leads end-to-end execution of large-scale turnkey ELV, ICT, and specialized engineering projects from contract award through testing, commissioning, and final handover. Accountable for project profit-and-loss (P&L), schedule baseline adherence, resource allocation, client management, subcontractor performance, and stringent quality/HSE compliance.",
    responsibilities: [
      "Project Charter & Baseline Execution: Establish project execution plans, Work Breakdown Structures (WBS), resource plans, and CPM baseline schedules in Primavera/MS Project.",
      "Budget Control & P&L Accountability: Monitor project cash flows, cost-to-complete, material requisitions, and subcontractor invoicing to protect agreed gross margins.",
      "Client & Consultant Stakeholder Management: Lead weekly progress meetings, coordinate technical submittals, manage variations/claims, and maintain high client satisfaction.",
      "Field Resource & Subcontractor Leadership: Direct site engineers, supervisors, and installation crews, optimizing labor productivity and enforcing site safety standards.",
      "Risk Mitigation & Issue Resolution: Identify technical, logistical, and commercial risks early, implementing proactive mitigation plans to avoid milestone delays.",
      "Testing, Commissioning & Handover: Direct integrated systems testing, snag-list closures, TOC (Taking-Over Certificate) approvals, and as-built/warranty handovers.",
    ],
    qualifications: "Bachelor’s degree in Electrical, Electronics, or Mechanical Engineering. PMP (Project Management Professional) certification strongly required. 7 to 12 years of project management experience in infrastructure/contracting.",
    technical_competencies: ["Primavera P6 & MS Project", "Contract Administration (FIDIC)", "ELV/ICT Turnkey Architecture", "Earned Value Management (EVM)", "WIR/MIR Approval Cycles"],
    behavioral_competencies: ["Strategic Leadership", "High-Stakes Negotiation", "Decisiveness Under Pressure", "Commercial Acumen", "Conflict Resolution"],
    internal_relations: "Engineering Director, Procurement, Finance/Accounting, Site Engineers, Safety Leads, and CEO",
    external_relations: "Main Contractor Project Directors, MEP Consulting Principals, Client Executive PMOs, and Regulatory Authorities",
    authority: [
      "Project Budget Expenditure: Authorized to approve material requisitions and site expenses within project budget limits.",
      "Subcontractor Work Sign-off: Authority to verify subcontractor payment certificates and milestone completion.",
      "Site Operations Directives: Power to direct site operational schedules, shift plans, and contractor interventions.",
    ],
    career_path: [
      "Senior Site Engineer",
      "Project Manager",
      "Senior Project Manager",
      "Projects Director",
      "VP of Operations",
    ],
    doc_version: "v1.0",
    reviewed_by: "Projects Director",
    approved_by: "Chief Executive Officer",
    tags: ["Project Management", "PMP", "FIDIC", "Turnkey", "ELV", "Contracting"],
  },

  // ── 10. PRE-SALES: Pre-Sales Light Current ──────────────────────────────────
  {
    position_name: "Pre-Sales Light Current",
    position_id: "8b829d1c-35db-4751-8052-d6acc36c9acd",
    job_code: "JD-PRE-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Senior Specialist / G04",
    job_summary: "Acts as the technical authority during the commercial bidding and proposal stage. Analyzes tender documents, tender drawings, and client specifications to engineer optimized, competitive system designs and Bills of Quantities (BOQs) across CCTV, Access Control, Fire Alarm, PA, BMS, and networking infrastructure. Interfaces with global vendors to secure special project pricing.",
    responsibilities: [
      "Tender Specification Analysis: Scrutinize RFP documents, consultant specifications, tender drawings, and compliance matrices for light current packages.",
      "System Architecture & Solution Design: Develop comprehensive system architectures, single-line diagrams (SLDs), equipment schedules, and technical write-ups.",
      "Cost Estimation & BOQ Preparation: Prepare detailed cost breakdown sheets, including hardware costs, software licenses, vendor warranties, and installation estimates.",
      "Vendor Relationship & Project Registration: Coordinate with manufacturers (Honeywell, Cisco, Hikvision, Bosch) to secure project registrations and competitive project pricing.",
      "Technical Proposal Authoring: Compile high-impact technical submittals, datasheets, compliance statements, and presentations for client evaluation committees.",
      "Sales Support & Client Presentations: Attend technical defense meetings with consultants and clients alongside the commercial sales team to articulate solution advantages.",
    ],
    qualifications: "Bachelor’s degree in Electrical, Communications, or Computer Engineering. 3 to 6 years of solid pre-sales design experience in ELV and ICT contracting fields.",
    technical_competencies: ["ELV System Sizing & Topology Design", "Vendor Portfolio Mastery (CCTV, Access, FA)", "AutoCAD & Visio Schematics", "Cost Engineering & BOQ Takeoff", "Technical Compliance Writing"],
    behavioral_competencies: ["Analytical Precision", "Persuasive Technical Articulation", "Speed Under Deadline", "Commercial Awareness", "Curiosity & Product Mastery"],
    internal_relations: "Sales Account Managers, Cost Estimation Engineers, Technical Office, and Managing Director",
    external_relations: "Global Hardware Manufacturers, System Distributors, and MEP Design Consultants",
    authority: [
      "Technical Compliance Determination: Authority to determine equipment substitutions and technical deviations.",
      "Project Design Sign-off: Verification of final technical proposal packages before commercial submission.",
      "Vendor Selection Recommendation: Power to recommend preferred vendor pairings for tender bids.",
    ],
    career_path: [
      "Junior Pre-Sales Engineer",
      "Pre-Sales Light Current",
      "Senior Pre-Sales Solution Architect",
      "Pre-Sales Team Leader",
      "Pre-Sales & Technical Director",
    ],
    doc_version: "v1.0",
    reviewed_by: "Pre-Sales Manager",
    approved_by: "Chief Technical Officer",
    tags: ["Pre-Sales", "Tender", "BOQ", "Solution Design", "ELV", "Proposals"],
  },

  // ── 11. SITE MANAGEMENT: Site Manager ───────────────────────────────────────
  {
    position_name: "Site Manager",
    position_id: "677cb341-4dc3-4513-ae06-6b1c65f6b340",
    job_code: "JD-STM-001",
    job_category: "Managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Manager / G05",
    job_summary: "Maintains full operational and administrative responsibility for all construction site execution activities, workforce coordination, safety enforcement, and day-to-day coordination with main contractors and MEP consultants. Ensures all field installations comply strictly with approved schedules, method statements, and zero-incident HSE mandates.",
    responsibilities: [
      "Overall Site Operational Command: Direct daily site installation activities across all low-current and specialized systems, maintaining smooth multi-trade workflows.",
      "Main Contractor Coordination: Represent the company in daily site logistics meetings, coordinate access to work areas, scaffolding, hoisting, and site storage.",
      "Subcontractor & Workforce Supervision: Manage deployment of in-house and third-party installation teams, inspecting quality and enforcing productivity targets.",
      "Safety & HSE Program Enforcement: Enforce zero-compromise site safety protocols, daily toolbox talks, risk assessments, and proper PPE compliance.",
      "Site Logistics & Material Preservation: Oversee on-site laydown areas, secure storage of sensitive hardware, tool custody, and scrap material control.",
      "Daily Site Documentation & Reporting: Maintain official daily site records, weather logs, manpower headcounts, progress photographs, and incident reports.",
    ],
    qualifications: "Bachelor’s degree in Electrical, Civil, or Construction Engineering. OSHA/NEBOSH safety certification is a strong plus. 6 to 10 years of robust site management experience on major contracting sites.",
    technical_competencies: ["Site Safety Management (OSHA/NEBOSH)", "Contractor Logistics Coordination", "Field Quality Assurance & Snagging", "Method Statement Execution", "Resource & Workforce Scheduling"],
    behavioral_competencies: ["Firm Site Leadership", "Decisive Crisis Handling", "Interpersonal Diplomacy", "High Stamina & Presence", "Safety Leadership"],
    internal_relations: "Project Manager, Site Engineers, Safety Officers, Warehouse Keepers, and HR/Admin",
    external_relations: "Main Contractor Site Directors, Consultant Resident Engineers, and Civil Defense Inspectors",
    authority: [
      "Site Safety Shutdown: Absolute authority to halt any work deemed unsafe or hazardous.",
      "Subcontractor Site Discipline: Power to issue site violation notices and enforce corrective actions on crews.",
      "Daily Material Release: Authority to release equipment from site stores to technicians.",
    ],
    career_path: [
      "Senior Site Engineer",
      "Site Manager",
      "Senior Construction Manager",
      "Project Director",
      "Operations Director",
    ],
    doc_version: "v1.0",
    reviewed_by: "Project Manager",
    approved_by: "Operations Director",
    tags: ["Site Management", "Construction", "Safety", "HSE", "Supervision", "Field Operations"],
  },

  // ── 12. LOGISTICS: Warehouse Keeper ─────────────────────────────────────────
  {
    position_name: "Warehouse Keeper",
    position_id: "1f1ec3f7-5ada-465b-93f0-2607bc6cf252",
    job_code: "JD-WH-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Officer / G02",
    job_summary: "Controls and protects all inventory, raw materials, cables, sensitive electronic components, tools, and project equipment held in corporate and site warehouses. Accurately logs goods receipt, inspections, staging, bin-location storage, and authorized disbursements in ERP while conducting continuous cycle counts to ensure zero inventory discrepancies.",
    responsibilities: [
      "Inventory Receiving & Inspection: Verify incoming consignments against supplier packing lists, Delivery Notes (DNs), and POs; inspect for damages and report defects.",
      "Storage & Bin-Location Management: Organize warehouse racking according to FIFO standards, climate-control requirements, and heavy equipment safety protocols.",
      "Material Disbursement & Issuance: Issue materials against approved Material Requisitions (MRs) and Delivery Orders (DOs), obtaining verified recipient signatures.",
      "ERP Inventory Accounting: Record all stock movements, receipts, issues, transfers, and adjustments in Odoo ERP with real-time accuracy.",
      "Cycle Counting & Stock Audits: Conduct regular physical stock audits and quarterly comprehensive stock counts, maintaining 99%+ inventory accuracy.",
      "Tool & Testing Equipment Custody: Manage company tools, Fluke testers, optical splicers, and power tools, tracking calibration dates and employee custody sheets.",
    ],
    qualifications: "Bachelor’s degree or Diploma in Commerce, Logistics, or Supply Chain. 2 to 5 years of warehouse and material inventory experience, preferably in contracting or electronics.",
    technical_competencies: ["ERP Inventory Modules (Odoo/SAP)", "Barcode Scanning & Bin-Location Systems", "Material Handling & Storage Safety", "Stock Reconciliation & Audit Protocols", "Tool Calibration Tracking"],
    behavioral_competencies: ["High Honesty & Integrity", "Methodical Organization", "Strict Attention to Accuracy", "Physical Endurance", "Accountability"],
    internal_relations: "Procurement Coordinators, Project Site Engineers, Logistics Officers, and Finance Auditors",
    external_relations: "Supplier Delivery Drivers, Freight Couriers, and External Inventory Auditors",
    authority: [
      "Material Release Authorization: Authority to withhold material release unless verified signed documentation exists.",
      "Damaged Shipment Rejection: Power to reject non-conforming or damaged goods upon arrival.",
      "Tool Return Verification: Authority to clear or hold employee tool return clearances.",
    ],
    career_path: [
      "Assistant Warehouse Keeper",
      "Warehouse Keeper",
      "Senior Warehouse Supervisor",
      "Warehouse Manager",
      "Logistics & Supply Chain Director",
    ],
    doc_version: "v1.0",
    reviewed_by: "Warehouse Supervisor",
    approved_by: "Procurement Manager",
    tags: ["Warehouse", "Inventory", "Odoo", "Material Handling", "Stock Control", "Logistics"],
  },

  // ── 13. SPECIALIZED SECURITY: X- Ray Engineer ──────────────────────────────
  {
    position_name: "X- Ray Engineer",
    position_id: "d42b6726-501d-4c63-8e01-487147ab4351",
    job_code: "JD-XRAY-001",
    job_category: "Non-managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Specialist / G03",
    job_summary: "Executes specialized technical installation, radiation calibration, preventive maintenance, and emergency repair of high-security X-Ray baggage scanners, cargo inspection systems, walk-through metal detectors (WTMD), and explosive trace detectors (ETD) deployed at airports, government buildings, and border terminals. Ensures strict compliance with atomic energy and radiation safety mandates.",
    responsibilities: [
      "Scanner Assembly & Mechanical Rigging: Supervise uncrating, rigging, placement, mechanical assembly, and lead-shielding verification of heavy X-Ray scanning systems.",
      "Electronic & Generator Calibration: Calibrate high-voltage X-Ray generators, conveyor belt drive systems, detector diode arrays, and dual-energy imaging software.",
      "Radiation Leakage Survey & Compliance: Conduct radiation survey measurements using calibrated Geiger counters, ensuring radiation emissions meet Egyptian Atomic Energy Authority limits.",
      "Preventive & Corrective Maintenance: Perform routine PM protocols (roller replacements, belt adjustments, optical sensor cleaning, and software image enhancements).",
      "Emergency Field Troubleshooting: Respond promptly to critical security checkpoint breakdowns, troubleshooting PCB boards, sensor loops, and emergency stop interlocks.",
      "Operator & Screener Training: Train security operators, police officers, and facility personnel on image interpretation, TIP (Threat Image Projection), and safety protocols.",
    ],
    qualifications: "Bachelor’s degree in Biomedical Engineering, Electronics, or Nuclear/Medical Physics. Radiation Protection Officer (RPO) certificate or vendor certifications (Smiths Detection, Astrophysics, Rapiscan) strongly preferred. 2 to 5 years of specialized inspection systems experience.",
    technical_competencies: ["Dual-Energy X-Ray Image Processing", "High-Voltage Generator Troubleshooting", "Radiation Safety & Survey Protocols", "Conveyor Automation & Drive Systems", "Threat Image Projection (TIP) Software"],
    behavioral_competencies: ["Safety & Regulatory Discipline", "Analytical Diagnostic Skill", "Calm Demeanor Under Pressure", "High Discretion & Security Clearance", "Client Training Capability"],
    internal_relations: "Specialized Security Solutions Business Unit Manager, Service Dispatchers, and Field Service Leads",
    external_relations: "Airport Authorities, Ministry of Interior Security Officials, Customs Officers, and Equipment Manufacturers",
    authority: [
      "Radiation Safety Clearance: Authority to certify an X-Ray unit safe for operation or shut it down for radiation leakage.",
      "Critical Service Sign-off: Power to certify operational readiness at high-security facilities.",
      "Warranty & Part Replacement Orders: Recommending warranty component replacements directly to manufacturers.",
    ],
    career_path: [
      "Junior X-Ray Service Engineer",
      "X- Ray Engineer",
      "Senior X-Ray Specialist / Team Leader",
      "Security Systems Service Manager",
      "Specialized Security Business Unit Head",
    ],
    doc_version: "v1.0",
    reviewed_by: "X-Ray Team Leader",
    approved_by: "Specialized Security Solutions Head",
    tags: ["X-Ray", "Security Scanners", "Radiation Safety", "Biomedical", "Inspection Systems"],
  },

  // ── 14. TECHNICAL OFFICE: Technical Office Team Leader ───────────────────────
  {
    position_name: "Technical Office Team Leader",
    position_id: "9268196d-52e1-4004-9b3e-77ec5c64f61c",
    job_code: "JD-TEC-OFF-001",
    job_category: "Managerial",
    position_type: "Full-time",
    location_type: "On-site",
    job_grade: "Lead Engineer / G05",
    job_summary: "Leads the engineering technical office team responsible for producing high-precision ELV/ICT shop drawings, coordinated composite drawings, material submittals, Request for Information (RFI) documents, and as-built packages. Serves as the engineering technical liaison between project site teams, consultant designers, and equipment manufacturers to resolve design clashes.",
    responsibilities: [
      "Shop Drawing Production & Review: Lead and audit the drafting of detailed ELV shop drawings, riser diagrams, conduit layouts, and coordination sections in AutoCAD/Revit.",
      "Consultant Technical Submittals: Compile comprehensive Material Submittal (MAS) packages with compliance statements, manufacturer catalogs, and test certificates for consultant approval.",
      "BIM & Cross-Discipline Coordination: Supervise clash detection and 3D coordination with HVAC, plumbing, structural, and architectural packages in Navisworks/Revit.",
      "RFI Management & Technical Inquiries: Draft technical RFIs to address specification ambiguities, discrepancies, or site physical clashes, coordinating engineering resolutions.",
      "Quantity Surveying & Variation Orders: Perform accurate quantity takeoffs from approved shop drawings, identifying scope deviations and drafting technical variation orders (VOs).",
      "As-Built Documentation & Record Keeping: Oversee the preparation of accurate as-built drawings, operation manuals (O&M), and spare part lists for project closeout.",
    ],
    qualifications: "Bachelor’s degree in Electrical Engineering. Advanced proficiency in AutoCAD and Revit BIM. 6 to 10 years of technical office experience in major electro-mechanical contracting projects.",
    technical_competencies: ["Revit MEP & BIM Coordination", "AutoCAD Riser & Shop Drawing Detailing", "Navisworks Clash Detection", "FIDIC Contract Engineering & Submittals", "Quantity Surveying & Takeoffs"],
    behavioral_competencies: ["Engineering Precision & Focus", "Team Leadership & Mentoring", "Consultant Negotiation Skills", "Structured Documentation Discipline", "Multitasking"],
    internal_relations: "Project Site Engineers, BIM Modelers, Draftsmen, Procurement Engineers, and Technical Director",
    external_relations: "MEP Consulting Engineers, Client Technical PMO, BIM Coordinators, and Vendor Application Teams",
    authority: [
      "Engineering Drawing Sign-off: Authorized to approve internal shop drawings before formal submittal to consultants.",
      "Technical Variance Endorsement: Authority to endorse engineering variation orders and scope changes.",
      "BIM Model Approvals: Verification of coordinated composite model submissions.",
    ],
    career_path: [
      "Senior Technical Office Engineer",
      "Technical Office Team Leader",
      "Technical Office Manager",
      "Engineering Director",
      "Chief Technical Officer (CTO)",
    ],
    doc_version: "v1.0",
    reviewed_by: "Technical Manager",
    approved_by: "Chief Technical Officer",
    tags: ["Technical Office", "BIM", "Revit", "Shop Drawings", "Submittals", "AutoCAD", "Coordination"],
  },
];

async function run() {
  console.log("Seeding default Job Descriptions...");

  for (const item of SEED_DATA) {
    // 1. Resolve position ID if missing or verify existence
    let posId = item.position_id;
    if (!posId) {
      const { data: pos } = await supabase
        .from("positions")
        .select("id")
        .ilike("name_en", `%${item.position_name}%`)
        .limit(1)
        .maybeSingle();
      if (pos) posId = pos.id;
    }

    if (!posId) {
      console.warn(`Could not find position for "${item.position_name}", skipping.`);
      continue;
    }

    const payload = {
      position_id: posId,
      job_code: item.job_code,
      job_category: item.job_category,
      position_type: item.position_type,
      location_type: item.location_type,
      job_grade: item.job_grade,
      job_summary: item.job_summary,
      responsibilities: item.responsibilities,
      qualifications: item.qualifications,
      technical_competencies: item.technical_competencies,
      behavioral_competencies: item.behavioral_competencies,
      internal_relations: item.internal_relations,
      external_relations: item.external_relations,
      authority: item.authority,
      career_path: item.career_path,
      doc_version: item.doc_version,
      reviewed_by: item.reviewed_by,
      approved_by: item.approved_by,
      tags: item.tags,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("position_job_descriptions")
      .select("id")
      .eq("position_id", posId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("position_job_descriptions")
        .update(payload)
        .eq("id", existing.id);
      if (error) console.error(`Error updating JD for ${item.position_name}:`, error.message);
      else console.log(`✓ Updated JD for: ${item.position_name}`);
    } else {
      const { error } = await supabase
        .from("position_job_descriptions")
        .insert(payload);
      if (error) console.error(`Error inserting JD for ${item.position_name}:`, error.message);
      else console.log(`✓ Inserted JD for: ${item.position_name}`);
    }
  }

  console.log("Seeding finished!");
}

run().catch(console.error);

