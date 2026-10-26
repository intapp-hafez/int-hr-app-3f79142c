# INT-HR — Employee Portal APIs & Business Logic Specification (Verified Code Edition)

- **مرجع كود النظام (Git Commit Reference)**: `4766fa3f6edbde5b6fb382623df2933d68a6bbd6`
- **حالة التوثيق**: مدقق ومطابق بنسبة 100% لكود وقواعد بيانات نظام INT-HR الحالي.

---

## 1. نموذج البنية البرمجية والمصادقة

### 1.1 طبيعة النظام
- **Pure Static SPA / Hybrid Native via Capacitor**:
  - يتصل التطبيق مباشرة بنقاط نهاية Supabase (PostgREST و Auth و Edge Functions).
  - الأمان وحواجز الصلاحيات تعتمد كليًا على **PostgreSQL Row Level Security (RLS)** استنادًا إلى جلسة الموظف الموثقة `auth.uid()`.
  - دور المستخدم يُقرأ دائمًا من جدول `user_roles` المرتبط بـ `user_id`. لا يُعتمد على أي ادعاءات مخزنة محليًا في العميل.
  - عند كل طلب، يتم فحص `profiles.status`. إذا كانت الحالة `Inactive`، تُبطل الجلسة فورًا عبر `signOut()` وتُرفض العملية.

---

## 2. جدول الخدمات ونقاط الاتصال المباشرة للموظف

| الخدمة | نوع الاستدعاء | الدالة في الكود / الجدول المقابل | الحالة (مؤكد / مقترح) |
| :--- | :--- | :--- | :--- |
| **تسجيل الدخول بكلمة المرور** | Supabase Auth SDK | `supabase.auth.signInWithPassword` | **مؤكد بالكود** (مع التحقق الصارم من حالة الحساب). |
| **تسجيل الدخول بالوجه** | Edge Function | `biometric-auth` (`action: "face-login"`) | **مؤكد بالكود** (يتحقق من المسافة وينشئ JWT بالأدمن). |
| **التحقق من الوجه للحضور** | Edge Function | `biometric-auth` (`action: "verify-face-attendance"`) | **مؤكد ومُحدّث بالحزمة** (إصدار التوكن بالسيرفر). |
| **تسجيل جهاز الموظف** | PostgREST / Upsert | `employee_devices` | **مؤكد بالكود**. |
| **تسجيل الحضور (Check-In)** | Server Function / DB | `checkIn` (`attendance_records` + `attendance_attempts`) | **مؤكد بالكود** (فحص النطاق والتلاعب والتوكن الذري). |
| **تسجيل الانصراف (Check-Out)** | Server Function / DB | `checkOut` (`attendance_records`) | **مؤكد بالكود**. |
| **سجل الحضور للموظف** | PostgREST / Select | `attendance_records` | **مؤكد بالكود**. |
| **أرصدة الإجازات** | PostgREST / Select | `leave_balances` + `leave_types` | **مؤكد بالكود**. |
| **تقديم طلب إجازة** | Server Function / DB | `submitLeave` (`leaves`) | **مؤكد بالكود** (مرفق Base64 Data URL حتى 1.5 ميجا). |
| **طلب استئذان ساعي** | Server Function / DB | `requestPermission` (`employee_permissions`) | **مؤكد بالكود**. |
| **طلب سلفة مالية** | Server Function / DB | `createAdvanceRequest` (`employee_advances`) | **مؤكد بالكود** (بين 15 و 20 من الشهر وبعد 3 أشهر عمل). |
| **المهام المسندة** | Server Function / DB | `listTasks` (`tasks` + `task_assignees`) | **مؤكد بالكود**. |
| **المحادثات والرسائل** | PostgREST / Select & Insert | `chat_channels` + `chat_messages` | **مؤكد بالكود**. |

---

## 3. تفاصيل العمليات البرمجية والحماية

### 3.1 الحضور والانصراف (Attendance Engine)

#### حقول الإدخال لعملية `checkIn` / `checkOut`:
```typescript
interface AttendanceCheckPayload {
  branch?: string;              // افتراضي: "HQ"
  lat: number;                  // إحداثيات خط العرض
  lng: number;                  // إحداثيات خط الطول
  accuracy_m?: number | null;   // دقة الـ GPS بالأمتار
  gps_age_ms?: number | null;   // عمر قراءة الـ GPS بالملي ثانية
  gps_sample_count?: number;    // عدد العينات المجمعة (1 إلى 20)
  device_id: string;            // المعرف المميز لجهاز الموظف
  biometric_token?: string;     // توكن التحقق الصادر من الخادم
  biometric_method?: "face" | "fingerprint";
  note?: string;                // ملاحظة اختيارية
  altitude?: number | null;
  speed?: number | null;
  samples?: Array<{ lat: number; lng: number; accuracy_m?: number | null; timestamp?: number | null }>;
}
```

#### الاستهلاك الذري للتوكن لمنع إعادة الاستخدام:
```sql
UPDATE public.biometric_verification_tokens
SET used_at = now()
WHERE id = :token_id AND used_at IS NULL
RETURNING id;
```

#### سياسة الموقع الوهمي (Mock GPS Policy):
- عند رصد `mock_detected`: رفض قاطع وفوري (`outcome: "reject"`).
- تسجيل المحاولة في `attendance_attempts`.
- إنشاء بلاغ فوري في `attendance_review_cases` بحالة `pending`.
- عند تكرار 3 محاولات خلال ساعتين: حظر الموظف من الحضور تلقائيًا لمدة ساعتين (`attendance_restricted`).

---

### 3.2 تقديم طلب إجازة (`submitLeave`)
- **الجدول الفعلي**: `leaves` (وليس `leave_requests`).
- **المرفقات**: تُرسل كسلسلة **Base64 Data URL** (PDF أو PNG أو JPEG) بحد أقصى **1.5 ميجابايت** في حقل `proof_url`.
- **شروط العمل**: لا يسمح بالتواريخ المتداخلة مع إجازة سابقة، واستبعاد أيام العطلات الأسبوعية والرسمية من حساب الأيام الفعلية.

---

### 3.3 طلب سلفة مالية (`createAdvanceRequest`)
- **الجدول الفعلي**: `employee_advances`.
- **النافذة الزمنية الإلزامية**: متاح فقط بين **يومي 15 و 20 من كل شهر ميلادي**.
- **شرط فترة التجربة**: مرور **3 أشهر على الأقل** على بدء العقد (`diffMonths >= 3`).
- **الحد الأقصى**: لا يتجاوز الرصيد السنوي المحدد للموظف في `profiles.annual_advance_limit`.
- **عدم وجود سلف نشطة**: لا يسمح بسلفة جديدة قبل تسديد السلف القائمة.

---

### 3.4 طلب استئذان ساعي (`requestPermission`)
- **الجدول الفعلي**: `employee_permissions`.
- **الحقول**: `permission_type` ("personal" | "work"), `date`, `start_time`, `end_time`, `reason`.
- **شروط العمل**: التحقق من عدم تجاوز الحد الأقصى لساعات الاستئذان الشهرية المحددة في النظام.
