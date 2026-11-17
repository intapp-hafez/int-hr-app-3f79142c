export type NotificationCategoryGroup =
  | "expirations"
  | "requests"
  | "attendance"
  | "onboarding"
  | "performance"
  | "security";

export type NotificationMatrixRule = {
  id: string; // e.g. "id_expiry", "contract_expiry", etc.
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  group: NotificationCategoryGroup;
  // Channels
  inapp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
  // Responsible Receivers
  receivers: {
    notifyEmployee: boolean;      // Notify the affected employee
    notifyManager: boolean;       // Notify their direct line manager
    notifyHr: boolean;            // Notify HR & admin personnel
    customEmails: string[];       // Extra designated CC emails (e.g. compliance@company.com)
  };
  triggerSchedule: string;        // e.g. "Daily at 08:00 AM (30d before)"
  triggerScheduleAr: string;
  triggerType: "daily_cron" | "realtime" | "on_action";
  // Template Preview
  employeeTemplate: {
    subject: string;
    body: string;
  };
  responsibleTemplate: {
    subject: string;
    body: string;
  };
};

export const DEFAULT_NOTIFICATION_MATRIX: NotificationMatrixRule[] = [
  // Expirations
  {
    id: "id_expiry",
    name: "National ID Expiration",
    nameAr: "انتهاء بطاقة الرقم القومي",
    description: "Alerts when an employee's national identity card is approaching expiration or expired",
    descriptionAr: "تنبيه عند اقتراب انتهاء أو انتهاء صلاحية بطاقة الرقم القومي للموظف",
    group: "expirations",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Daily at 08:00 AM (30d, 15d, 7d before)",
    triggerScheduleAr: "يومياً الساعة 08:00 ص (قبل 30، 15، 7 أيام)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "[Action Required] Your National ID is Expiring Soon",
      body: "Dear {{employee_name}}, your National ID will expire on {{expiry_date}} ({{days_left}} days remaining). Please initiate the renewal process immediately and submit a photocopy of the renewed card to the HR department.",
    },
    responsibleTemplate: {
      subject: "[Follow-up Required] National ID Expiring: {{employee_name}}",
      body: "Notice: Employee {{employee_name}} (Dept: {{department}}) has a National ID expiring on {{expiry_date}}. The employee has been notified. Please ensure renewal paperwork is submitted before the deadline.",
    },
  },
  {
    id: "contract_expiry",
    name: "Employment Contract Expiration",
    nameAr: "انتهاء عقد العمل",
    description: "Alerts when a fixed-term employment contract is approaching its renewal cut-off",
    descriptionAr: "تنبيه عند اقتراب موعد انتهاء أو تجديد عقد العمل محدد المدة",
    group: "expirations",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Daily at 08:00 AM (45d, 30d, 15d before)",
    triggerScheduleAr: "يومياً الساعة 08:00 ص (قبل 45، 30، 15 يوماً)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "[Notice] Employment Contract Ending Soon",
      body: "Dear {{employee_name}}, this is a courtesy notice that your employment contract is concluding on {{expiry_date}}. Please coordinate with your department manager and HR regarding the renewal review.",
    },
    responsibleTemplate: {
      subject: "[HR Action] Contract Renewal Review: {{employee_name}}",
      body: "Notice: The employment contract for {{employee_name}} expires on {{expiry_date}}. Please initiate performance evaluation and renewal/non-renewal determination.",
    },
  },
  {
    id: "insurance_expiry",
    name: "Medical & Social Insurance Renewal",
    nameAr: "تجديد التأمين الطبي والاجتماعي",
    description: "Annual insurance policy renewals and medical health card update cycles",
    descriptionAr: "تجديد وثائق التأمين الطبي السنوية وبطاقات الرعاية الصحية",
    group: "expirations",
    inapp: true,
    email: true,
    push: false,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: false,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Daily at 08:00 AM (20d before)",
    triggerScheduleAr: "يومياً الساعة 08:00 ص (قبل 20 يوماً)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "Medical Insurance Renewal Notice",
      body: "Dear {{employee_name}}, your corporate medical insurance card is due for renewal on {{expiry_date}}. Please verify your current details on the HR portal.",
    },
    responsibleTemplate: {
      subject: "Insurance Policy Renewal Due: {{employee_name}}",
      body: "Notice: Medical coverage renewal for {{employee_name}} is due on {{expiry_date}}.",
    },
  },
  {
    id: "military_expiry",
    name: "Military Status Certificate Expiry",
    nameAr: "انتهاء شهادة الموقف التجنيدي",
    description: "Temporary military exemption certificates approaching legal renewal deadline",
    descriptionAr: "شهادات الإعفاء المؤقت من التجنيد المقتربة من تاريخ التجديد القانوني",
    group: "expirations",
    inapp: true,
    email: true,
    push: false,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: false,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Daily at 08:00 AM (60d, 30d before)",
    triggerScheduleAr: "يومياً الساعة 08:00 ص (قبل 60، 30 يوماً)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "[Urgent Legal Compliance] Military Exemption Renewal Due",
      body: "Dear {{employee_name}}, your temporary military exemption certificate will expire on {{expiry_date}}. Egyptian labor law requires submission of an updated military certificate immediately upon renewal.",
    },
    responsibleTemplate: {
      subject: "[Legal Compliance] Military Certificate Expiring: {{employee_name}}",
      body: "Compliance Warning: {{employee_name}} military certificate expires on {{expiry_date}}. Follow-up required to avoid legal non-compliance.",
    },
  },
  {
    id: "probation_end",
    name: "3-Month Probation Period Ending",
    nameAr: "انتهاء فترة الاختبار (3 أشهر)",
    description: "New hires approaching the end of their statutory 90-day probationary review",
    descriptionAr: "اقتراب نهاية فترة الاختبار القانونية (90 يوماً) للموظف الجديد",
    group: "expirations",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: false,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Daily at 08:00 AM (14d, 7d before)",
    triggerScheduleAr: "يومياً الساعة 08:00 ص (قبل 14، 7 أيام)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "Probation Period Review Scheduled",
      body: "Dear {{employee_name}}, your 90-day onboarding probationary period concludes on {{expiry_date}}. Your manager will schedule an evaluation review shortly.",
    },
    responsibleTemplate: {
      subject: "[Action Required] Probation Evaluation Due: {{employee_name}}",
      body: "Attention: The 90-day probation period for {{employee_name}} ends on {{expiry_date}}. Please submit the formal probation confirmation or extension review before the deadline.",
    },
  },

  // Requests & Approvals
  {
    id: "pending_leave",
    name: "Leave Request Submitted",
    nameAr: "تقديم طلب إجازة جديد",
    description: "Fires when an employee submits an annual, sick, or casual leave request",
    descriptionAr: "يتم الإرسال فور قيام الموظف بتقديم طلب إجازة سنوية أو مرضية أو عارضة",
    group: "requests",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Real-time on Submission",
    triggerScheduleAr: "فوري في الوقت الحقيقي عند التقديم",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "Leave Request Received - Awaiting Approval",
      body: "Dear {{employee_name}}, your request for {{leave_type}} from {{start_date}} to {{end_date}} has been received and routed to your manager for review.",
    },
    responsibleTemplate: {
      subject: "New Leave Request from {{employee_name}}",
      body: "Action Required: {{employee_name}} has requested {{days_count}} days of {{leave_type}} from {{start_date}} to {{end_date}}. Please review and approve or reject in the portal.",
    },
  },
  {
    id: "leave_decision",
    name: "Leave Decision (Approved / Rejected)",
    nameAr: "قرار طلب الإجازة (قبول / رفض)",
    description: "Notifies when a submitted leave has been approved or rejected",
    descriptionAr: "إشعار عند اتخاذ قرار بالقبول أو الرفض على طلب الإجازة",
    group: "requests",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: false,
      customEmails: [],
    },
    triggerSchedule: "Real-time on Decision",
    triggerScheduleAr: "فوري في الوقت الحقيقي عند اتخاذ القرار",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "Your Leave Request has been {{decision_status}}",
      body: "Dear {{employee_name}}, your request for {{leave_type}} ({{start_date}} to {{end_date}}) has been {{decision_status}} by {{approver_name}}.",
    },
    responsibleTemplate: {
      subject: "Team Leave Decision: {{employee_name}} ({{decision_status}})",
      body: "Notice: The leave request for team member {{employee_name}} from {{start_date}} to {{end_date}} has been {{decision_status}}.",
    },
  },
  {
    id: "advance_payment",
    name: "Salary Advance (Solaf) Request",
    nameAr: "طلب سلفة مالية",
    description: "Employee request for salary advance or payroll deduction installment",
    descriptionAr: "طلب سلفة نقدية على الراتب الشهري أو أقساط استقطاع",
    group: "requests",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: false,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Real-time on Submission",
    triggerScheduleAr: "فوري في الوقت الحقيقي عند التقديم",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "Salary Advance Request Submitted",
      body: "Dear {{employee_name}}, your request for an advance of {{amount}} EGP has been submitted to Finance & HR for processing.",
    },
    responsibleTemplate: {
      subject: "Salary Advance Request: {{employee_name}} ({{amount}} EGP)",
      body: "Notice: {{employee_name}} has submitted a salary advance request for {{amount}} EGP.",
    },
  },

  // Attendance & Clocking
  {
    id: "late",
    name: "Late Arrival / Shift Anomaly",
    nameAr: "تأخير الحضور عن الوردية",
    description: "Employee clocking in after the designated shift grace period",
    descriptionAr: "تسجيل حضور الموظف بعد انتهاء فترة السماح المحددة للوردية",
    group: "attendance",
    inapp: true,
    email: false,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: false,
      customEmails: [],
    },
    triggerSchedule: "Real-time on Clock-in",
    triggerScheduleAr: "فوري في الوقت الحقيقي عند البصمة",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "Late Clock-in Notice",
      body: "Dear {{employee_name}}, you clocked in at {{checkin_time}} today, which is {{minutes_late}} minutes past your shift start time.",
    },
    responsibleTemplate: {
      subject: "Team Attendance: {{employee_name}} Late Arrival",
      body: "Notice: {{employee_name}} checked in {{minutes_late}} minutes late today at {{checkin_time}}.",
    },
  },
  {
    id: "absent",
    name: "Unexcused Absence Cut-off",
    nameAr: "غياب بدون إذن",
    description: "Fires when an employee has not clocked in 2 hours after shift start without approved leave",
    descriptionAr: "يتم الإرسال عند عدم تسجيل الحضور بعد ساعتين من بدء الوردية بدون إجازة معتمدة",
    group: "attendance",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "Daily at 11:00 AM",
    triggerScheduleAr: "يومياً الساعة 11:00 ص",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "Absence Record Notice for Today",
      body: "Dear {{employee_name}}, no clock-in has been recorded for your shift today. If you are on emergency leave or experienced a technical issue, please notify your manager.",
    },
    responsibleTemplate: {
      subject: "Attendance Alert: {{employee_name}} Not Checked In",
      body: "Alert: Team member {{employee_name}} has not clocked in today and has no registered leave request.",
    },
  },

  // Onboarding & Account
  {
    id: "welcome_onboarding",
    name: "New Hire Welcome & Credentials",
    nameAr: "الترحيب بالموظف الجديد وبيانات الدخول",
    description: "Automatic dispatch of username, temporary password, and portal link upon onboarding",
    descriptionAr: "إرسال اسم المستخدم وكلمة المرور المؤقتة ورابط النظام فور إنشاء ملف الموظف",
    group: "onboarding",
    inapp: false,
    email: true,
    push: false,
    sms: true,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: false,
      customEmails: [],
    },
    triggerSchedule: "On Employee Account Creation",
    triggerScheduleAr: "فور إنشاء حساب الموظف",
    triggerType: "on_action",
    employeeTemplate: {
      subject: "Welcome to Integrated Technics — Your HR Portal Access",
      body: "Welcome {{employee_name}}! Your employee account is ready. Username: {{username}} | Temporary Password: {{password}} | Login: {{portal_url}}",
    },
    responsibleTemplate: {
      subject: "New Hire Onboarded: {{employee_name}}",
      body: "Notice: New team member {{employee_name}} has been created and login credentials dispatched.",
    },
  },

  // Performance & KPI
  {
    id: "kpi_period_open",
    name: "KPI Evaluation Period Open",
    nameAr: "فتح فترة تقييم الأداء (KPIs)",
    description: "Alerts managers when a new quarterly evaluation cycle is open for submission",
    descriptionAr: "تنبيه المديرين عند فتح فترة التقييم ربع السنوية لبدء تقييم الموظفين",
    group: "performance",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: false,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "On Period Activation",
    triggerScheduleAr: "فور تفعيل فترة التقييم",
    triggerType: "on_action",
    employeeTemplate: {
      subject: "Quarterly Evaluation Cycle Open",
      body: "Notice: The quarterly KPI evaluation period for {{quarter_name}} is now open.",
    },
    responsibleTemplate: {
      subject: "[Action Required] Submit Team KPI Evaluations for {{quarter_name}}",
      body: "The KPI evaluation period for {{quarter_name}} is officially open until {{close_date}}. Please complete and submit your team scorecards.",
    },
  },
  {
    id: "kpi_evaluation_returned",
    name: "KPI Scorecard Revision Return",
    nameAr: "إعادة تقييم KPI للمدير للتعديل",
    description: "Fires when HR returns a submitted KPI scorecard to the direct manager with revision notes",
    descriptionAr: "يتم الإرسال عندما يقوم مسؤول HR بإرجاع بطاقة التقييم للمدير المباشر مع ملاحظات المراجعة",
    group: "performance",
    inapp: true,
    email: true,
    push: true,
    sms: false,
    receivers: {
      notifyEmployee: false, // Internal return is hidden from employee
      notifyManager: true,
      notifyHr: false,
      customEmails: [],
    },
    triggerSchedule: "On HR Return Action",
    triggerScheduleAr: "فوري عند قيام HR بإرجاع التقييم",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "",
      body: "",
    },
    responsibleTemplate: {
      subject: "[Revision Required] KPI Evaluation Returned for {{employee_name}}",
      body: "Attention: HR has requested revisions on the scorecard for {{employee_name}} with notes: \"{{return_reason}}\". Please resolve the return notes and resubmit.",
    },
  },
];
