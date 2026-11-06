export interface ProjectEmployee {
  id: string;
  name: string;
  name_ar?: string;
  role: string;
  department: string;
  avatarUrl?: string;
  email: string;
  phone?: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  title_ar?: string;
  status: "completed" | "in_progress" | "pending";
  priority: "low" | "medium" | "high";
  assignee: {
    name: string;
    avatarUrl?: string;
  };
  dueDate: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "doc" | "image" | "archive" | "sheet";
  uploadedBy: string;
  uploadedAt: string;
}

export interface ProjectUpdate {
  id: string;
  author: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  content: string;
  timestamp: string;
}

export interface Project {
  id: string; // e.g. "PRJ-001"
  name: string;
  name_ar?: string;
  projectManager: {
    name: string;
    avatarUrl?: string;
  };
  reportedManager: {
    name: string;
    avatarUrl?: string;
  };
  location: string;
  startDate: string;
  endDate: string;
  status: "ongoing" | "upcoming" | "completed" | "on_hold";
  notes: string;
  notes_ar?: string;
  employeesCount: number;
  completedTasksCount: number;
  totalTasksCount: number;
  employees: ProjectEmployee[];
  tasks: ProjectTask[];
  files: ProjectFile[];
  updates: ProjectUpdate[];
}

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "PRJ-001",
    name: "Head Office Renovation",
    name_ar: "تجديد وتطوير المقر الرئيسي",
    projectManager: {
      name: "John Reyes",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    },
    reportedManager: {
      name: "Maria Santos",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    },
    location: "Head Office",
    startDate: "Jan 15, 2025",
    endDate: "Apr 30, 2025",
    status: "ongoing",
    notes: "Full architectural and MEP renovation of 3rd and 4th floors including HVAC replacement and smart meeting rooms.",
    notes_ar: "تجديد وتحديث كامل للأعمال المعمارية والميكانيكية والكهربائية للدورين الثالث والرابع بما في ذلك أنظمة التكييف وغرف الاجتماعات الذكية.",
    employeesCount: 12,
    completedTasksCount: 8,
    totalTasksCount: 10,
    employees: [
      { id: "e1", name: "John Reyes", role: "Project Manager", department: "Project Management", email: "john.reyes@integ.com" },
      { id: "e2", name: "David Chen", role: "Site Engineer", department: "Engineering", email: "david.c@integ.com" },
      { id: "e3", name: "Sarah Al-Ghamdi", role: "Electrical Supervisor", department: "Engineering", email: "sarah.g@integ.com" },
      { id: "e4", name: "Tariq Mansour", role: "Safety Officer", department: "HSE", email: "tariq.m@integ.com" },
    ],
    tasks: [
      { id: "t1", title: "HVAC Ducting Dismantling", status: "completed", priority: "high", assignee: { name: "David Chen" }, dueDate: "Feb 10, 2025" },
      { id: "t2", title: "Power Distribution Cabling", status: "completed", priority: "high", assignee: { name: "Sarah Al-Ghamdi" }, dueDate: "Feb 25, 2025" },
      { id: "t3", title: "Drywall Partitions Erection", status: "completed", priority: "medium", assignee: { name: "John Reyes" }, dueDate: "Mar 15, 2025" },
      { id: "t4", title: "Acoustic Ceiling Tiles Installation", status: "in_progress", priority: "medium", assignee: { name: "David Chen" }, dueDate: "Apr 10, 2025" },
      { id: "t5", title: "Final MEP Testing & Snagging", status: "pending", priority: "high", assignee: { name: "Sarah Al-Ghamdi" }, dueDate: "Apr 28, 2025" },
    ],
    files: [
      { id: "f1", name: "Renovation_Approved_Drawings_v2.pdf", size: "8.4 MB", type: "pdf", uploadedBy: "John Reyes", uploadedAt: "Jan 12, 2025" },
      { id: "f2", name: "Safety_Execution_Plan_HSE.pdf", size: "2.1 MB", type: "pdf", uploadedBy: "Tariq Mansour", uploadedAt: "Jan 14, 2025" },
    ],
    updates: [
      { id: "u1", author: { name: "John Reyes", role: "Project Manager" }, content: "Drywall partitioning completed for east wing. Proceeding with ceiling grid.", timestamp: "2 days ago" },
    ],
  },
  {
    id: "PRJ-002",
    name: "Branch Expansion - Cebu",
    name_ar: "توسعة وتجهيز فرع سيبو",
    projectManager: {
      name: "Liza Cortez",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    },
    reportedManager: {
      name: "Carlos Medina",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
    location: "Cebu",
    startDate: "Feb 01, 2025",
    endDate: "Jun 30, 2025",
    status: "ongoing",
    notes: "Expansion of operations in Cebu, including office setup, manpower deployment, and system integration.",
    notes_ar: "توسيع العمليات التشغيلية في فرع سيبو، وتجهيز المكاتب ونشر القوى العاملة وربط الأنظمة المركزية.",
    employeesCount: 18,
    completedTasksCount: 5,
    totalTasksCount: 14,
    employees: [
      { id: "e10", name: "Liza Cortez", role: "Project Lead", department: "Operations", email: "liza.cortez@integ.com" },
      { id: "e11", name: "Michael Chang", role: "Network Architect", department: "IT & Networks", email: "m.chang@integ.com" },
      { id: "e12", name: "Fatima Al-Zahra", role: "HR Operations Lead", department: "Human Resources", email: "fatima.z@integ.com" },
      { id: "e13", name: "Khaled Nabil", role: "Procurement Specialist", department: "Finance", email: "k.nabil@integ.com" },
      { id: "e14", name: "Rami Youssef", role: "Field Technician", department: "Technical Services", email: "rami.y@integ.com" },
      { id: "e15", name: "Nouran Ezzat", role: "Logistics Coordinator", department: "Supply Chain", email: "nouran.e@integ.com" },
    ],
    tasks: [
      { id: "t11", title: "Lease Contract Signing & Legal Filing", status: "completed", priority: "high", assignee: { name: "Liza Cortez" }, dueDate: "Feb 10, 2025" },
      { id: "t12", title: "Telecom & Fiber Optic Line Setup", status: "completed", priority: "high", assignee: { name: "Michael Chang" }, dueDate: "Feb 22, 2025" },
      { id: "t13", title: "Workstation Furniture Assembly", status: "completed", priority: "medium", assignee: { name: "Khaled Nabil" }, dueDate: "Mar 05, 2025" },
      { id: "t14", title: "Fire Safety & Access Control Commissioning", status: "completed", priority: "high", assignee: { name: "Rami Youssef" }, dueDate: "Mar 20, 2025" },
      { id: "t15", title: "Core Server Rack Installation", status: "completed", priority: "high", assignee: { name: "Michael Chang" }, dueDate: "Apr 02, 2025" },
      { id: "t16", title: "Local Staff Onboarding & Induction", status: "in_progress", priority: "medium", assignee: { name: "Fatima Al-Zahra" }, dueDate: "Apr 25, 2025" },
      { id: "t17", title: "CCTV Camera Placement & Testing", status: "in_progress", priority: "high", assignee: { name: "Rami Youssef" }, dueDate: "May 05, 2025" },
      { id: "t18", title: "ERP & POS Synchronization", status: "in_progress", priority: "high", assignee: { name: "Michael Chang" }, dueDate: "May 18, 2025" },
      { id: "t19", title: "Signage & Brand Guidelines Fit-Out", status: "in_progress", priority: "low", assignee: { name: "Khaled Nabil" }, dueDate: "May 25, 2025" },
      { id: "t20", title: "Emergency Power & UPS Testing", status: "in_progress", priority: "medium", assignee: { name: "Rami Youssef" }, dueDate: "Jun 02, 2025" },
      { id: "t21", title: "Vendor Service Level Agreements", status: "in_progress", priority: "medium", assignee: { name: "Liza Cortez" }, dueDate: "Jun 10, 2025" },
      { id: "t22", title: "Final Municipality Permits Approval", status: "pending", priority: "high", assignee: { name: "Liza Cortez" }, dueDate: "Jun 18, 2025" },
      { id: "t23", title: "Mock Operational Run & Stress Test", status: "pending", priority: "high", assignee: { name: "Liza Cortez" }, dueDate: "Jun 24, 2025" },
      { id: "t24", title: "Official Grand Opening Ceremony", status: "pending", priority: "medium", assignee: { name: "Fatima Al-Zahra" }, dueDate: "Jun 30, 2025" },
    ],
    files: [
      { id: "f10", name: "Cebu_Branch_Floor_Plan_v3.pdf", size: "14.2 MB", type: "pdf", uploadedBy: "Liza Cortez", uploadedAt: "Feb 02, 2025" },
      { id: "f11", name: "Network_Topology_Diagram.png", size: "3.5 MB", type: "image", uploadedBy: "Michael Chang", uploadedAt: "Feb 15, 2025" },
      { id: "f12", name: "Equipment_Procurement_PO_Batch1.xlsx", size: "1.2 MB", type: "sheet", uploadedBy: "Khaled Nabil", uploadedAt: "Feb 20, 2025" },
      { id: "f13", name: "Signed_Commercial_Lease_Agreement.pdf", size: "4.8 MB", type: "pdf", uploadedBy: "Liza Cortez", uploadedAt: "Feb 08, 2025" },
      { id: "f14", name: "HSE_Inspection_Certificate.pdf", size: "950 KB", type: "pdf", uploadedBy: "Rami Youssef", uploadedAt: "Mar 22, 2025" },
      { id: "f15", name: "Staffing_Requisition_Final.docx", size: "620 KB", type: "doc", uploadedBy: "Fatima Al-Zahra", uploadedAt: "Apr 05, 2025" },
    ],
    updates: [
      { id: "u10", author: { name: "Liza Cortez", role: "Project Lead" }, content: "Server rack installation confirmed by IT team. Proceeding with client workstation deployment.", timestamp: "3 hours ago" },
      { id: "u11", author: { name: "Michael Chang", role: "Network Architect" }, content: "Primary and backup fiber lines terminated. Internal speeds tested at 1.2 Gbps symmetrical.", timestamp: "Yesterday at 4:15 PM" },
      { id: "u12", author: { name: "Fatima Al-Zahra", role: "HR Operations Lead" }, content: "First batch of 8 local customer support engineers completed corporate compliance training.", timestamp: "Apr 22, 2025" },
      { id: "u13", author: { name: "Khaled Nabil", role: "Procurement Specialist" }, content: "All office ergonomic desks and meeting chairs received and placed on floor.", timestamp: "Apr 18, 2025" },
      { id: "u14", author: { name: "Carlos Medina", role: "Operations Director" }, content: "Approved project schedule adjustment of 1 week for municipality permit clearance.", timestamp: "Apr 14, 2025" },
    ],
  },
  {
    id: "PRJ-003",
    name: "IT System Upgrade",
    name_ar: "تحديث البنية التحتية لتكنولوجيا المعلومات",
    projectManager: {
      name: "Mark Villanueva",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    },
    reportedManager: {
      name: "Maria Santos",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    },
    location: "Head Office",
    startDate: "Mar 10, 2025",
    endDate: "May 15, 2025",
    status: "completed",
    notes: "ERP database migration to cloud clusters and corporate firewall failover installation.",
    notes_ar: "ترحيل قاعدة بيانات نظام تخطيط الموارد إلى السحابة وتركيب جدار حماية متقدم.",
    employeesCount: 8,
    completedTasksCount: 7,
    totalTasksCount: 7,
    employees: [
      { id: "e20", name: "Mark Villanueva", role: "Lead Systems Engineer", department: "IT", email: "mark.v@integ.com" },
      { id: "e21", name: "Hassan Farouk", role: "Database Admin", department: "IT", email: "hassan.f@integ.com" },
    ],
    tasks: [
      { id: "t30", title: "Database Snapshot Backup", status: "completed", priority: "high", assignee: { name: "Hassan Farouk" }, dueDate: "Mar 15, 2025" },
      { id: "t31", title: "Cloud VM Cluster Provisioning", status: "completed", priority: "high", assignee: { name: "Mark Villanueva" }, dueDate: "Mar 22, 2025" },
      { id: "t32", title: "Data Ingestion & Integrity Audit", status: "completed", priority: "high", assignee: { name: "Hassan Farouk" }, dueDate: "Apr 05, 2025" },
      { id: "t33", title: "Dual Firewall Appliance Mounting", status: "completed", priority: "medium", assignee: { name: "Mark Villanueva" }, dueDate: "Apr 18, 2025" },
      { id: "t34", title: "User Acceptance Testing (UAT)", status: "completed", priority: "medium", assignee: { name: "Mark Villanueva" }, dueDate: "Apr 30, 2025" },
      { id: "t35", title: "Cutover to Cloud Instance", status: "completed", priority: "high", assignee: { name: "Mark Villanueva" }, dueDate: "May 08, 2025" },
      { id: "t36", title: "Decommissioning Legacy Servers", status: "completed", priority: "low", assignee: { name: "Hassan Farouk" }, dueDate: "May 15, 2025" },
    ],
    files: [
      { id: "f30", name: "Cloud_Migration_Signoff_Report.pdf", size: "3.2 MB", type: "pdf", uploadedBy: "Mark Villanueva", uploadedAt: "May 15, 2025" },
    ],
    updates: [
      { id: "u30", author: { name: "Mark Villanueva", role: "Lead Systems Engineer" }, content: "Project fully completed with zero downtime during cutover.", timestamp: "May 15, 2025" },
    ],
  },
  {
    id: "PRJ-004",
    name: "Warehouse Improvement",
    name_ar: "تطوير وأتمتة مستودعات التخزين",
    projectManager: {
      name: "Anna Dela Cruz",
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    },
    reportedManager: {
      name: "Carlos Medina",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
    location: "Laguna",
    startDate: "Apr 01, 2025",
    endDate: "Aug 31, 2025",
    status: "ongoing",
    notes: "Automation of picking aisles, barcode inventory scanners, and loading dock resurfacing.",
    notes_ar: "أتمتة ممرات جمع البضائع وأنظمة الباركود وإعادة تأهيل أرصفة التحميل والتفريغ.",
    employeesCount: 10,
    completedTasksCount: 3,
    totalTasksCount: 9,
    employees: [
      { id: "e40", name: "Anna Dela Cruz", role: "Warehouse Specialist", department: "Logistics", email: "anna.dc@integ.com" },
    ],
    tasks: [
      { id: "t40", title: "Survey Floor Load Capacities", status: "completed", priority: "medium", assignee: { name: "Anna Dela Cruz" }, dueDate: "Apr 15, 2025" },
      { id: "t41", title: "Procure Industrial Barcode Scanners", status: "completed", priority: "high", assignee: { name: "Anna Dela Cruz" }, dueDate: "May 02, 2025" },
      { id: "t42", title: "Reroute Forklift Charging Bays", status: "completed", priority: "high", assignee: { name: "Anna Dela Cruz" }, dueDate: "May 20, 2025" },
      { id: "t43", title: "Epoxy Floor Coating for Bays 1-4", status: "in_progress", priority: "medium", assignee: { name: "Anna Dela Cruz" }, dueDate: "Jun 15, 2025" },
      { id: "t44", title: "WMS Software Integration", status: "pending", priority: "high", assignee: { name: "Anna Dela Cruz" }, dueDate: "Jul 10, 2025" },
    ],
    files: [],
    updates: [],
  },
  {
    id: "PRJ-005",
    name: "New Office Setup - Davao",
    name_ar: "تجهيز وتأسيس مكتب دافاو الجديد",
    projectManager: {
      name: "Ramon Bautista",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
    },
    reportedManager: {
      name: "Maria Santos",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    },
    location: "Davao",
    startDate: "May 01, 2025",
    endDate: "Jul 31, 2025",
    status: "upcoming",
    notes: "Site lease finalization, interior architectural design, and primary team allocation.",
    notes_ar: "اعتماد عقد إيجار الموقع، والتصميمات المعمارية الداخلية وتوزيع الكادر الوظيفي الأولي.",
    employeesCount: 6,
    completedTasksCount: 0,
    totalTasksCount: 6,
    employees: [
      { id: "e50", name: "Ramon Bautista", role: "Branch Lead", department: "Operations", email: "ramon.b@integ.com" },
    ],
    tasks: [
      { id: "t50", title: "Finalize Lease Contract", status: "pending", priority: "high", assignee: { name: "Ramon Bautista" }, dueDate: "May 10, 2025" },
      { id: "t51", title: "Select Local Fit-out Contractor", status: "pending", priority: "medium", assignee: { name: "Ramon Bautista" }, dueDate: "May 25, 2025" },
    ],
    files: [],
    updates: [],
  },
];

const STORAGE_KEY = "integrated_technics_projects_data_v1";

export function loadProjectsFromStorage(): Project[] {
  if (typeof window === "undefined") return INITIAL_PROJECTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_PROJECTS;
  } catch {
    return INITIAL_PROJECTS;
  }
}

export function saveProjectsToStorage(projects: Project[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error("Failed to save projects to localStorage:", err);
  }
}
