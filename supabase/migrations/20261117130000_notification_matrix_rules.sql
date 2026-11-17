-- Migration: Notification Types & Dispatch Matrix with Responsible Receivers
-- Date: 2026-11-17
-- Description: Creates notification_matrix_rules table, configures RLS, performance indexes, and seeds default routing rules.

-- 1. Create notification_matrix_rules table
CREATE TABLE IF NOT EXISTS public.notification_matrix_rules (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_ar text,
  description text,
  description_ar text,
  category_group text NOT NULL CHECK (category_group IN ('expirations', 'requests', 'attendance', 'onboarding', 'performance', 'security')),
  inapp boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT false,
  sms boolean NOT NULL DEFAULT false,
  notify_employee boolean NOT NULL DEFAULT true,
  notify_manager boolean NOT NULL DEFAULT true,
  notify_hr boolean NOT NULL DEFAULT true,
  custom_emails text[] NOT NULL DEFAULT '{}',
  trigger_schedule text,
  trigger_schedule_ar text,
  trigger_type text NOT NULL DEFAULT 'daily_cron' CHECK (trigger_type IN ('daily_cron', 'realtime', 'on_action')),
  employee_subject text,
  employee_body text,
  responsible_subject text,
  responsible_body text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Grants & RLS Policies
GRANT SELECT ON public.notification_matrix_rules TO authenticated;
GRANT ALL ON public.notification_matrix_rules TO service_role;
ALTER TABLE public.notification_matrix_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matrix_rules_read_authenticated" ON public.notification_matrix_rules;
CREATE POLICY "matrix_rules_read_authenticated"
  ON public.notification_matrix_rules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "matrix_rules_write_admin_hr" ON public.notification_matrix_rules;
CREATE POLICY "matrix_rules_write_admin_hr"
  ON public.notification_matrix_rules
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')
  );

-- 3. Optimization Indexes for Notification Deliveries Log
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_email_created 
  ON public.notif_deliveries(channel, created_at DESC) 
  WHERE channel = 'email';

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_status_channel 
  ON public.notif_deliveries(status, channel, created_at DESC);

-- 4. Seed Default Notification Matrix Rules
INSERT INTO public.notification_matrix_rules (
  id, name, name_ar, description, description_ar, category_group,
  inapp, email, push, sms,
  notify_employee, notify_manager, notify_hr, custom_emails,
  trigger_schedule, trigger_schedule_ar, trigger_type,
  employee_subject, employee_body, responsible_subject, responsible_body
) VALUES
(
  'id_expiry',
  'National ID Expiration',
  'انتهاء بطاقة الرقم القومي',
  'Alerts when an employee national identity card is approaching expiration or expired',
  'تنبيه عند اقتراب انتهاء أو انتهاء صلاحية بطاقة الرقم القومي للموظف',
  'expirations',
  true, true, true, false,
  true, true, true, '{}',
  'Daily at 08:00 AM (30d, 15d, 7d before)',
  'يومياً الساعة 08:00 ص (قبل 30، 15، 7 أيام)',
  'daily_cron',
  '[Action Required] Your National ID is Expiring Soon',
  'Dear {{employee_name}}, your National ID will expire on {{expiry_date}} ({{days_left}} days remaining). Please initiate the renewal process immediately and submit a photocopy of the renewed card to HR.',
  '[Follow-up Required] National ID Expiring: {{employee_name}}',
  'Notice: Employee {{employee_name}} (Dept: {{department}}) has a National ID expiring on {{expiry_date}}. The employee has been notified. Please ensure renewal paperwork is submitted before deadline.'
),
(
  'contract_expiry',
  'Employment Contract Expiration',
  'انتهاء عقد العمل',
  'Alerts when a fixed-term employment contract is approaching its renewal cut-off',
  'تنبيه عند اقتراب موعد انتهاء أو تجديد عقد العمل محدد المدة',
  'expirations',
  true, true, true, false,
  true, true, true, '{}',
  'Daily at 08:00 AM (45d, 30d, 15d before)',
  'يومياً الساعة 08:00 ص (قبل 45، 30، 15 يوماً)',
  'daily_cron',
  '[Notice] Employment Contract Ending Soon',
  'Dear {{employee_name}}, this is a courtesy notice that your employment contract is concluding on {{expiry_date}}. Please coordinate with your department manager and HR regarding the renewal review.',
  '[HR Action] Contract Renewal Review: {{employee_name}}',
  'Notice: The employment contract for {{employee_name}} expires on {{expiry_date}}. Please initiate performance evaluation and renewal determination.'
),
(
  'insurance_expiry',
  'Medical & Social Insurance Renewal',
  'تجديد التأمين الطبي والاجتماعي',
  'Annual insurance policy renewals and medical health card update cycles',
  'تجديد وثائق التأمين الطبي السنوية وبطاقات الرعاية الصحية',
  'expirations',
  true, true, false, false,
  true, false, true, '{}',
  'Daily at 08:00 AM (20d before)',
  'يومياً الساعة 08:00 ص (قبل 20 يوماً)',
  'daily_cron',
  'Medical Insurance Renewal Notice',
  'Dear {{employee_name}}, your corporate medical insurance card is due for renewal on {{expiry_date}}. Please verify your current details on the HR portal.',
  'Insurance Policy Renewal Due: {{employee_name}}',
  'Notice: Medical coverage renewal for {{employee_name}} is due on {{expiry_date}}.'
),
(
  'military_expiry',
  'Military Status Certificate Expiry',
  'انتهاء شهادة الموقف التجنيدي',
  'Temporary military exemption certificates approaching legal renewal deadline',
  'شهادات الإعفاء المؤقت من التجنيد المقتربة من تاريخ التجديد القانوني',
  'expirations',
  true, true, false, false,
  true, false, true, '{}',
  'Daily at 08:00 AM (60d, 30d before)',
  'يومياً الساعة 08:00 ص (قبل 60، 30 يوماً)',
  'daily_cron',
  '[Urgent Legal Compliance] Military Exemption Renewal Due',
  'Dear {{employee_name}}, your temporary military exemption certificate will expire on {{expiry_date}}. Egyptian labor law requires submission of an updated military certificate immediately upon renewal.',
  '[Legal Compliance] Military Certificate Expiring: {{employee_name}}',
  'Compliance Warning: {{employee_name}} military certificate expires on {{expiry_date}}. Follow-up required to avoid legal non-compliance.'
),
(
  'probation_end',
  '3-Month Probation Period Ending',
  'انتهاء فترة الاختبار (3 أشهر)',
  'New hires approaching the end of their statutory 90-day probationary review',
  'اقتراب نهاية فترة الاختبار القانونية (90 يوماً) للموظف الجديد',
  'expirations',
  true, true, true, false,
  false, true, true, '{}',
  'Daily at 08:00 AM (14d, 7d before)',
  'يومياً الساعة 08:00 ص (قبل 14، 7 أيام)',
  'daily_cron',
  'Probation Period Review Scheduled',
  'Dear {{employee_name}}, your 90-day onboarding probationary period concludes on {{expiry_date}}. Your manager will schedule an evaluation review shortly.',
  '[Action Required] Probation Evaluation Due: {{employee_name}}',
  'Attention: The 90-day probation period for {{employee_name}} ends on {{expiry_date}}. Please submit the formal probation confirmation or extension review before the deadline.'
),
(
  'pending_leave',
  'Leave Request Submitted',
  'تقديم طلب إجازة جديد',
  'Fires when an employee submits an annual, sick, or casual leave request',
  'يتم الإرسال فور قيام الموظف بتقديم طلب إجازة سنوية أو مرضية أو عارضة',
  'requests',
  true, true, true, false,
  true, true, true, '{}',
  'Real-time on Submission',
  'فوري في الوقت الحقيقي عند التقديم',
  'realtime',
  'Leave Request Received - Awaiting Approval',
  'Dear {{employee_name}}, your request for {{leave_type}} from {{start_date}} to {{end_date}} has been received and routed to your manager for review.',
  'New Leave Request from {{employee_name}}',
  'Action Required: {{employee_name}} has requested {{days_count}} days of {{leave_type}} from {{start_date}} to {{end_date}}. Please review and approve or reject in the portal.'
),
(
  'leave_decision',
  'Leave Decision (Approved / Rejected)',
  'قرار طلب الإجازة (قبول / رفض)',
  'Notifies when a submitted leave has been approved or rejected',
  'إشعار عند اتخاذ قرار بالقبول أو الرفض على طلب الإجازة',
  'requests',
  true, true, true, false,
  true, true, false, '{}',
  'Real-time on Decision',
  'فوري في الوقت الحقيقي عند اتخاذ القرار',
  'realtime',
  'Your Leave Request has been {{decision_status}}',
  'Dear {{employee_name}}, your request for {{leave_type}} ({{start_date}} to {{end_date}}) has been {{decision_status}} by {{approver_name}}.',
  'Team Leave Decision: {{employee_name}} ({{decision_status}})',
  'Notice: The leave request for team member {{employee_name}} from {{start_date}} to {{end_date}} has been {{decision_status}}.'
),
(
  'advance_payment',
  'Salary Advance (Solaf) Request',
  'طلب سلفة مالية',
  'Employee request for salary advance or payroll deduction installment',
  'طلب سلفة نقدية على الراتب الشهري أو أقساط استقطاع',
  'requests',
  true, true, true, false,
  true, false, true, '{}',
  'Real-time on Submission',
  'فوري في الوقت الحقيقي عند التقديم',
  'realtime',
  'Salary Advance Request Submitted',
  'Dear {{employee_name}}, your request for an advance of {{amount}} EGP has been submitted to Finance & HR for processing.',
  'Salary Advance Request: {{employee_name}} ({{amount}} EGP)',
  'Notice: {{employee_name}} has submitted a salary advance request for {{amount}} EGP.'
),
(
  'late',
  'Late Arrival / Shift Anomaly',
  'تأخير الحضور عن الوردية',
  'Employee clocking in after the designated shift grace period',
  'تسجيل حضور الموظف بعد انتهاء فترة السماح المحددة للوردية',
  'attendance',
  true, false, true, false,
  true, true, false, '{}',
  'Real-time on Clock-in',
  'فوري في الوقت الحقيقي عند البصمة',
  'realtime',
  'Late Clock-in Notice',
  'Dear {{employee_name}}, you clocked in at {{checkin_time}} today, which is {{minutes_late}} minutes past your shift start time.',
  'Team Attendance: {{employee_name}} Late Arrival',
  'Notice: {{employee_name}} checked in {{minutes_late}} minutes late today at {{checkin_time}}.'
),
(
  'absent',
  'Unexcused Absence Cut-off',
  'غياب بدون إذن',
  'Fires when an employee has not clocked in 2 hours after shift start without approved leave',
  'يتم الإرسال عند عدم تسجيل الحضور بعد ساعتين من بدء الوردية بدون إجازة معتمدة',
  'attendance',
  true, true, true, false,
  true, true, true, '{}',
  'Daily at 11:00 AM',
  'يومياً الساعة 11:00 ص',
  'daily_cron',
  'Absence Record Notice for Today',
  'Dear {{employee_name}}, no clock-in has been recorded for your shift today. If you are on emergency leave or experienced a technical issue, please notify your manager.',
  'Attendance Alert: {{employee_name}} Not Checked In',
  'Alert: Team member {{employee_name}} has not clocked in today and has no registered leave request.'
),
(
  'welcome_onboarding',
  'New Hire Welcome & Credentials',
  'الترحيب بالموظف الجديد وبيانات الدخول',
  'Automatic dispatch of username, temporary password, and portal link upon onboarding',
  'إرسال اسم المستخدم وكلمة المرور المؤقتة ورابط النظام فور إنشاء ملف الموظف',
  'onboarding',
  false, true, false, true,
  true, true, false, '{}',
  'On Employee Account Creation',
  'فور إنشاء حساب الموظف',
  'on_action',
  'Welcome to Integrated Technics — Your HR Portal Access',
  'Welcome {{employee_name}}! Your employee account is ready. Username: {{username}} | Temporary Password: {{password}} | Login: {{portal_url}}',
  'New Hire Onboarded: {{employee_name}}',
  'Notice: New team member {{employee_name}} has been created and login credentials dispatched.'
),
(
  'kpi_period_open',
  'KPI Evaluation Period Open',
  'فتح فترة تقييم الأداء (KPIs)',
  'Alerts managers when a new quarterly evaluation cycle is open for submission',
  'تنبيه المديرين عند فتح فترة التقييم ربع السنوية لبدء تقييم الموظفين',
  'performance',
  true, true, true, false,
  false, true, true, '{}',
  'On Period Activation',
  'فور تفعيل فترة التقييم',
  'on_action',
  'Quarterly Evaluation Cycle Open',
  'Notice: The quarterly KPI evaluation period for {{quarter_name}} is now open.',
  '[Action Required] Submit Team KPI Evaluations for {{quarter_name}}',
  'The KPI evaluation period for {{quarter_name}} is officially open until {{close_date}}. Please complete and submit your team scorecards.'
),
(
  'kpi_evaluation_returned',
  'KPI Scorecard Revision Return',
  'إعادة تقييم KPI للمدير للتعديل',
  'Fires when HR returns a submitted KPI scorecard to the direct manager with revision notes',
  'يتم الإرسال عندما يقوم مسؤول HR بإرجاع بطاقة التقييم للمدير المباشر مع ملاحظات المراجعة',
  'performance',
  true, true, true, false,
  false, true, false, '{}',
  'On HR Return Action',
  'فوري عند قيام HR بإرجاع التقييم',
  'realtime',
  '',
  '',
  '[Revision Required] KPI Evaluation Returned for {{employee_name}}',
  'Attention: HR has requested revisions on the scorecard for {{employee_name}} with notes: "{{return_reason}}". Please resolve the return notes and resubmit.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  description = EXCLUDED.description,
  description_ar = EXCLUDED.description_ar,
  category_group = EXCLUDED.category_group,
  trigger_schedule = EXCLUDED.trigger_schedule,
  trigger_schedule_ar = EXCLUDED.trigger_schedule_ar,
  trigger_type = EXCLUDED.trigger_type,
  employee_subject = EXCLUDED.employee_subject,
  employee_body = EXCLUDED.employee_body,
  responsible_subject = EXCLUDED.responsible_subject,
  responsible_body = EXCLUDED.responsible_body;
