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

  // Additional Default Rules (Expirations, Attendance, Requests, Onboarding, Security)
  {
    id: "passport_expiry",
    name: "Passport Expiration",
    nameAr: "انتهاء جواز السفر",
    description: "Alerts when an employee's passport is expiring within 6 months, critical for foreign travel and work missions",
    descriptionAr: "تنبيه عند اقتراب انتهاء صلاحية جواز سفر الموظف قبل 6 أشهر، هام لمهمات العمل والسفر الخارجي",
    group: "expirations",
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
    triggerSchedule: "Daily at 08:00 AM (180d, 90d, 30d before)",
    triggerScheduleAr: "يومياً الساعة 08:00 ص (قبل 180، 90، 30 يوماً)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "[Passport Expiry Notice] Your Passport is Due for Renewal",
      body: "Dear {{employee_name}}, your passport will expire on {{expiry_date}} ({{days_left}} days remaining). Please renew it and provide a certified copy of the new passport to HR.",
    },
    responsibleTemplate: {
      subject: "[HR Record Update] Passport Expiration: {{employee_name}}",
      body: "Notice: Employee {{employee_name}} has a passport expiring on {{expiry_date}}. Please update travel records once renewed.",
    },
  },
  {
    id: "driving_license_expiry",
    name: "Driving License Expiration",
    nameAr: "انتهاء رخصة القيادة",
    description: "Alerts for drivers, field technicians, and logistics personnel when their driver's license is approaching expiration",
    descriptionAr: "تنبيه للسائقين وفنيي المواقع ومسؤولي الحركة عند اقتراب انتهاء رخصة القيادة المهنية أو الخاصة",
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
      subject: "[Action Required] Your Driving License is Expiring Soon",
      body: "Dear {{employee_name}}, your driver's license will expire on {{expiry_date}} ({{days_left}} days left). Please renew your license promptly to avoid vehicle operation suspension.",
    },
    responsibleTemplate: {
      subject: "[Fleet Safety Alert] Driving License Expiring: {{employee_name}}",
      body: "Attention: Team member {{employee_name}} (Dept: {{department}}) has a driver's license expiring on {{expiry_date}}. Ensure license renewal before dispatching on field assignments.",
    },
  },
  {
    id: "work_permit_expiry",
    name: "Work Permit & Residency Expiration",
    nameAr: "انتهاء تصريح العمل والإقامة",
    description: "Alerts for non-national employees when statutory work permits or residency visas are due for renewal",
    descriptionAr: "تنبيه للموظفين غير المحليين عند اقتراب موعد تجديد تصريح العمل القانوني أو الإقامة",
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
    triggerSchedule: "Daily at 08:00 AM (60d, 30d, 15d before)",
    triggerScheduleAr: "يومياً الساعة 08:00 ص (قبل 60، 30، 15 يوماً)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "[Statutory Compliance] Work Permit / Residency Renewal",
      body: "Dear {{employee_name}}, your work permit / residency authorization expires on {{expiry_date}}. HR has initiated governmental renewal procedures. Please submit any requested travel documents.",
    },
    responsibleTemplate: {
      subject: "[Compliance Critical] Work Permit Renewal Due: {{employee_name}}",
      body: "Legal Notice: Work permit authorization for {{employee_name}} will expire on {{expiry_date}}. Immediate government liaison action required to prevent statutory penalties.",
    },
  },
  {
    id: "early_departure",
    name: "Early Departure from Shift",
    nameAr: "مغادرة مبكرة قبل انتهاء الوردية",
    description: "Fires when an employee clocks out more than 15 minutes before their scheduled shift end time without approved permission",
    descriptionAr: "يتم الإرسال عند تسجيل انصراف الموظف قبل موعد نهاية الوردية بأكثر من 15 دقيقة بدون إذن معتمد",
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
    triggerSchedule: "Real-time on Early Clock-out",
    triggerScheduleAr: "فوري في الوقت الحقيقي عند بصمة الانصراف",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "Notice: Early Clock-Out Recorded",
      body: "Dear {{employee_name}}, you clocked out at {{checkout_time}}, which is {{minutes_early}} minutes before your scheduled shift end. If this was authorized by permission, please submit a formal excuse in the portal.",
    },
    responsibleTemplate: {
      subject: "Attendance Notice: {{employee_name}} Early Departure",
      body: "Notice: Team member {{employee_name}} clocked out early today at {{checkout_time}} ({{minutes_early}} minutes before shift conclusion).",
    },
  },
  {
    id: "missing_clock_out",
    name: "Missing Clock-Out at Shift End",
    nameAr: "عدم تسجيل بصمة الانصراف",
    description: "Fires when an employee clocked in but has not registered a clock-out punch 2 hours after their shift ended",
    descriptionAr: "تنبيه عند تسجيل حضور الموظف وعدم تسجيل انصرافه بعد ساعتين من نهاية ورديته",
    group: "attendance",
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
    triggerSchedule: "Daily at 08:00 PM (Shift End + 2h)",
    triggerScheduleAr: "يومياً الساعة 08:00 م (بعد ساعتين من الوردية)",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "[Action Required] Incomplete Attendance Record (Missing Clock-Out)",
      body: "Dear {{employee_name}}, no clock-out punch was recorded for your shift today. Please submit an attendance correction request through the portal to verify your exit time.",
    },
    responsibleTemplate: {
      subject: "Incomplete Clock-Out: {{employee_name}}",
      body: "Alert: Employee {{employee_name}} clocked in today at {{checkin_time}} but has no exit punch recorded. An attendance correction may be submitted for your review.",
    },
  },
  {
    id: "overtime_approved",
    name: "Overtime Request Decision",
    nameAr: "اعتماد ساعات العمل الإضافي",
    description: "Fires when overtime hours are submitted by an employee and approved or rejected by management",
    descriptionAr: "إشعار عند اعتماد أو رفض ساعات العمل الإضافية من قبل الإدارة المباشرة",
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
    triggerSchedule: "Real-time on Overtime Approval",
    triggerScheduleAr: "فوري عند اتخاذ القرار",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "Your Overtime Request Has Been {{decision_status}}",
      body: "Dear {{employee_name}}, your request for {{overtime_hours}} overtime hours on {{work_date}} has been {{decision_status}} by {{approver_name}}.",
    },
    responsibleTemplate: {
      subject: "Overtime Approved for Payroll: {{employee_name}}",
      body: "Notice: {{overtime_hours}} hours of overtime for {{employee_name}} on {{work_date}} have been approved and queued for monthly payroll processing.",
    },
  },
  {
    id: "permission_request",
    name: "Time-Off Permission / Excuse Request",
    nameAr: "طلب إذن خروج مؤقت",
    description: "Fires when an employee requests a 1-to-3 hour personal or medical excuse during the working day",
    descriptionAr: "يتم الإرسال عند تقديم طلب إذن شخصي أو طبي لمغادرة العمل لمدة محددة خلال اليوم",
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
    triggerSchedule: "Real-time on Request",
    triggerScheduleAr: "فوري في الوقت الحقيقي عند التقديم",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "Permission Request Submitted",
      body: "Dear {{employee_name}}, your request for a {{hours_count}}-hour excuse on {{request_date}} (Reason: {{reason}}) has been sent to your manager for approval.",
    },
    responsibleTemplate: {
      subject: "[Action Required] Permission Request from {{employee_name}}",
      body: "Team Member {{employee_name}} has requested {{hours_count}} hours of time-off permission on {{request_date}} ({{time_range}}). Please review and approve in the portal.",
    },
  },
  {
    id: "custody_assignment",
    name: "Asset Custody Assignment & Return",
    nameAr: "تسليم أو استرداد عهدة عينية",
    description: "Alerts when company property (laptop, smartphone, car, technical equipment, safety gear) is assigned or returned",
    descriptionAr: "إشعار عند تسليم أو إرجاع عهدة عينية (حاسوب محمول، هاتف، سيارة شركة، معدات أمان، أجهزة فنية)",
    group: "onboarding",
    inapp: true,
    email: true,
    push: false,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "On Custody Handover Action",
    triggerScheduleAr: "فور تسجيل تسليم أو استلام العهدة",
    triggerType: "on_action",
    employeeTemplate: {
      subject: "[Custody Receipt] Company Asset Assigned: {{asset_name}}",
      body: "Dear {{employee_name}}, the following company asset has been assigned to your custody: {{asset_name}} (Serial: {{asset_serial}}). Please log into the portal to digitally acknowledge receipt.",
    },
    responsibleTemplate: {
      subject: "Asset Custody Confirmation: {{employee_name}}",
      body: "Notice: Asset {{asset_name}} (Serial: {{asset_serial}}) has been registered under employee {{employee_name}} custody.",
    },
  },
  {
    id: "payslip_published",
    name: "Monthly Payslip Release",
    nameAr: "إصدار قسيمة الراتب الشهري",
    description: "Notifies employees when monthly payroll calculation is finalized and encrypted digital payslips are released",
    descriptionAr: "إشعار الموظفين فور اعتماد مسير الرواتب الشهري ونشر قسيمة الراتب الرقمية المشفرة",
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
    triggerSchedule: "On Payroll Finalization (28th-30th)",
    triggerScheduleAr: "شهرياً فور اعتماد مسير الرواتب",
    triggerType: "on_action",
    employeeTemplate: {
      subject: "Your Payslip for {{month_name}} is Now Available",
      body: "Dear {{employee_name}}, your monthly salary breakdown and digital payslip for {{month_name}} is now ready for review and download on your HR portal.",
    },
    responsibleTemplate: {
      subject: "Monthly Payroll Dispatch Complete: {{month_name}}",
      body: "Notice: Monthly payroll publication for {{month_name}} has completed. Digital payslips have been released to all eligible employees.",
    },
  },
  {
    id: "disciplinary_action",
    name: "Administrative Notice / Investigation",
    nameAr: "إخطار جزاء إداري أو استدعاء تحقيق",
    description: "Dispatches confidential formal notices regarding administrative penalties, attendance violations, or legal inquiry",
    descriptionAr: "إرسال إخطار رسمي سري بشأن توقيع جزاء إداري أو استدعاء للتحقيق القانوني وفقاً للائحة العمل",
    group: "security",
    inapp: true,
    email: true,
    push: false,
    sms: false,
    receivers: {
      notifyEmployee: true,
      notifyManager: true,
      notifyHr: true,
      customEmails: [],
    },
    triggerSchedule: "On Disciplinary Order Finalization",
    triggerScheduleAr: "فور اعتماد القرار الإداري",
    triggerType: "on_action",
    employeeTemplate: {
      subject: "[Confidential] Official Administrative Notice from HR",
      body: "Dear {{employee_name}}, an official administrative notification (Ref: {{incident_ref}}) has been recorded regarding {{violation_type}}. Please review the attached notice details on the portal.",
    },
    responsibleTemplate: {
      subject: "[Confidential HR Copy] Disciplinary Order: {{employee_name}}",
      body: "Notice: An administrative action (Ref: {{incident_ref}}) has been finalized for employee {{employee_name}} (Dept: {{department}}).",
    },
  },
  {
    id: "password_reset",
    name: "Security Alert: Password Changed",
    nameAr: "تنبيه أمان: تغيير كلمة المرور",
    description: "Instant notification dispatched when account credentials or password is updated or reset",
    descriptionAr: "إشعار أمان فوري يتم إرساله عند تعديل كلمة المرور أو إعادة تعيينها",
    group: "security",
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
    triggerSchedule: "Real-time on Password Update",
    triggerScheduleAr: "فوري لحظة تغيير كلمة المرور",
    triggerType: "realtime",
    employeeTemplate: {
      subject: "[Security Alert] Your Account Password Was Recently Changed",
      body: "Hello {{employee_name}}, the password for your Integrated Technics HR account was changed on {{change_timestamp}}. If you did not authorize this change, please contact IT Security immediately.",
    },
    responsibleTemplate: {
      subject: "Security Audit: Password Reset for {{employee_name}}",
      body: "Security Notice: Password update recorded for user {{employee_name}} (Username: {{username}}) on {{change_timestamp}}.",
    },
  },
  {
    id: "work_anniversary",
    name: "Work Anniversary & Milestones",
    nameAr: "ذكرى سنوية للالتحاق بالعمل",
    description: "Automated congratulatory greeting celebrating 1, 3, 5, 10+ years of dedication with Integrated Technics",
    descriptionAr: "تهنئة مؤتمتة احتفاءً بمرور عام أو أعوام على التحاق الموظف بالشركة وتكريماً لعطائه",
    group: "onboarding",
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
    triggerSchedule: "Annually on Hire Date at 09:00 AM",
    triggerScheduleAr: "سنوياً في تاريخ التعيين الساعة 09:00 ص",
    triggerType: "daily_cron",
    employeeTemplate: {
      subject: "Happy Work Anniversary, {{employee_name}}! 🎉",
      body: "Dear {{employee_name}}, congratulations on completing {{years_count}} year(s) with Integrated Technics! Thank you for your continued dedication, leadership, and contributions to our team.",
    },
    responsibleTemplate: {
      subject: "Team Milestone: {{employee_name}} Celebrates {{years_count}} Years!",
      body: "Notice: Team member {{employee_name}} reaches their {{years_count}}-year milestone today! Please join in recognizing their hard work and commitment.",
    },
  },
];
