# دليل التكامل الشامل لتطبيق Android (React + Capacitor 7) — نظام INT-HR

- **مرجع كود النظام الأساسي (Git Commit)**: `4766fa3f6edbde5b6fb382623df2933d68a6bbd6` (فرع `main`).
- **تاريخ الإصدار**: 23 أكتوبر 2026.
- **معرف تطبيق الأندرويد للمعاينة (Preview Package Name)**: `com.integratedtechnics.employee.preview`.

---

## 1. البنية البرمجية وطبقة الـ Client Execution Adapter

### 1.1 طبيعة النظام الأساسي
نظام INT-HR يعمل كـ **Pure Static SPA**. دوال الخادم (`createServerFn`) لا تتصل بسيرفر Node خلفي، بل تُنفذ محليًا عبر طبقة وسيطة (`start-shim.ts`)، وتتصل مباشرة بقاعدة بيانات Supabase عبر مكتبة `@supabase/supabase-js`.
- **حدود الحماية (Authorization Boundary)**: محكومة تمامًا بسياسات **Row Level Security (RLS)** في PostgreSQL استنادًا إلى معرف المستخدم المصادق عليه `auth.uid()`.
- **صلاحيات الأدوار**: تُقرأ حصريًا من جدول `user_roles` المرتبط بالمستخدم، ولا يُعتمد على أي claims محلية في المتصفح.

### 1.2 طبقة الـ Adapter المحدثة في الحزمة (`src/lib/start-shim.ts`)
تم إصلاح مشكلة تجاهل الـ Middlewares في الـ shim، بحيث يقوم الـ Adapter في تطبيق Android بما يلي:
1. استرجاع جلسة Supabase والتأكد من وجود JWT صالح.
2. التحقق الفوري من جدول `profiles` للتأكد من أن حالة الموظف هي `Active`. في حال كان الحساب `Inactive`، يتم استدعاء `supabase.auth.signOut()` فورًا ورمي استثناء `AccountInactiveError`.
3. التحقق من صلاحيات الموظف في `user_roles`.
4. تمرير الـ `context` الموثق للدوال.

### 1.3 إدارة وتخزين الجلسة على Android
متصفح WebView في Android قد يفرغ `localStorage` عند إغلاق التطبيق. لذلك تم إعداد العميل في `src/integrations/supabase/client.ts` ليستخدم `@capacitor/preferences` كـ storage engine دائم ومحمي في ذاكرة النظام.

---

## 2. قاعدة البيانات والحماية الأمنية (Database & Security Architecture)

### 2.1 الجداول والعلاقات الأساسية
- **`profiles`**: بيانات الموظف، تاريخ بدء العقد، الراتب، ورقم المشرف، وأعلام الأمان (`status`, `face_required`, `device_check_required`, `annual_advance_limit`, `face_reenroll_allowed`).
- **`user_roles`**: جدول الربط بين المستخدمين وأدوارهم (`role: 'employee'`).
- **`employee_devices`**: الأجهزة المسجلة والمصرح لها (`device_id`, `status: 'approved' | 'pending' | 'rejected'`).
- **`face_descriptors`**: متجهات ملامح الوجه المشفرة (مصفوفة 128 رقمًا). الوصول إليها مقيد للموظف والإدارة.
- **`biometric_verification_tokens`**: توكنات التحقق الحيوي المؤقتة للحضور.
- **`attendance_records`**: سجلات الحضور والانصراف وساعات العمل المحتسبة.
- **`attendance_attempts`**: سجل المحاولات وقرارات الرفض ومؤشرات التلاعب.
- **`attendance_review_cases`**: القضايا الأمنية المحولة للمراجعة الإدارية.
- **`leaves`**: طلبات الإجازات والأيام المخصومة وروابط الإثبات الطبي المرفقة.
- **`leave_balances`**: رصيد الموظف لكل نوع إجازة.
- **`employee_advances`**: طلبات السلف المالية وحالتها وتواريخ استحقاقها.
- **`employee_permissions`**: طلبات الاستئذان الساعية والحدود الشهرية.

### 2.2 كود الاستهلاك الذري لتوكن الحضور (Atomic Token Consumption)
لمنع هجمات إعادة الإرسال (Replay Attacks)، يتم استهلاك التوكن في دالة `validateAndConsumeBioToken` (`src/backend/functions/attendance.functions.ts`) باستعلام ذري:
```sql
UPDATE public.biometric_verification_tokens
SET used_at = now()
WHERE id = :token_id
  AND used_at IS NULL
RETURNING id;
```
إذا لم يرجع هذا الاستعلام صفًا، تُرفض عملية تسجيل الحضور فورًا بخطأ `biometric_replayed`؛ مما يضمن أن التوكن لا يمكن استخدامه مرتين حتى في حالات الإرسال المتزامن.

### 2.3 أين تنفذ العمليات الحساسة فعليًا؟
- **في المتصفح / العميل**: واجهات العرض، التقاط الصورة واستخراج متجه الـ 128، وتجميع عينات الـ GPS.
- **في قاعدة البيانات (PostgreSQL RLS & Triggers)**: التحقق من قيود الجداول، حساب رصيد الإجازات التلقائي عبر trigger، وفحص صلاحيات القراءة والتعديل حسب `auth.uid()`.
- **في الخادم الموثوق (Supabase Edge Function `biometric-auth`)**:
  - فحص تطابق الوجه وإصدار توكن الحضور دون إرسال القالب للعميل.
  - تسجيل الدخول بالوجه وتوليد جلسة JWT موثقة باستخدام مفتاح `service_role`.

---

## 3. تصحيح التحقق بالوجه ومكافحة التلاعب (Secure Face Engine)

### 3.1 إصلاح التحقق وإصدار التوكن عبر خدمة موثوقة
تم تعديل تدفق فحص الوجه بالكامل:
- **السابق (غير آمن)**: كان العميل يقرأ القالب من قاعدة البيانات ويقارن المسافة ويصدر التوكن بنفسه.
- **المعتمد الآن (آمن وموثوق)**:
  1. يقوم العميل باستخراج متجه الـ 128 رقمًا من كاميرا الهاتف.
  2. يفحص العميل صحة المتجه باستخدام `validateFaceDescriptor` (128 رقمًا محدودًا، ورفض NaN وInfinity).
  3. يرسل العميل المتجه مع رمز المصادقة (Bearer JWT) إلى Edge Function `biometric-auth`:
     ```typescript
     supabase.functions.invoke("biometric-auth", {
       body: {
         action: "verify-face-attendance",
         descriptor: faceVector128,
         attendanceAction: "check_in",
         lat: coords.latitude,
         lng: coords.longitude,
         accuracy_m: coords.accuracy
       }
     });
     ```
  4. تقوم الـ Edge Function بتحميل قالب الوجه المرجعي باستخدام صلاحيات الأدمن، ومقارنة المسافة الرياضية، وإدراج التوكن في `biometric_verification_tokens` بوقت الخادم وصلاحية دقيقتين فقط (`expires_at = now() + 2 minutes`).
  5. تعيد الدالة التوكن للعميل دون إرسال قالب الوجه أبدًا.

### 3.2 فحص الحيوية ومكافحة إعادة الإرسال (Liveness & Replay Status)
- **الحالة في الكود الحالي**:
  - التحقق من ثبات النقاط (Landmark Detection) يتم في واجهة الـ WebView عبر `face-api.js`.
  - **فجوة صريحة (Known Gap)**: لا يتوفر في النظام الحالي خوارزمية Challenge-Response حركية في السيرفر (مثل مطالبة الموظف بالرمش مرتين أو الالتفاف مع توقيع الصور رقميًا)؛ تم تسجيل هذه النقطة كأحد النواقص المطلوب إضافتها في إصدار قادم.

### 3.3 سياسة الموقع الوهمي (Mock GPS Policy)
- **سلوك مؤكد 100% في الكود**:
  - إذا رصد النظام استخدام برامج الموقع الوهمي (`mock_detected: true`) أو كانت بيانات الـ GPS غير متناسقة:
    1. **رفض قاطع وفوري (Hard REJECT)** لعملية الحضور.
    2. تسجيل المحاولة في `attendance_attempts` بالسبب `mock_gps_detected`.
    3. إنشاء بلاغ أمني عاجل في `attendance_review_cases` بحالة `pending`.
    4. إذا تكررت محاولات التلاعب **3 مرات خلال ساعتين**، يتم حظر تسجيل الحضور للموظف مؤقتًا لمدة ساعتين مع رسالة لمراجعة الإدارة (`attendance_restricted`).

---

## 4. المصادقة وبصمة Android (WebAuthn / Passkeys)

### 4.1 دورة الجلسة وتأمين الدخول
- **`loginWithPassword`**:
  - يتحقق من بيانات الدخول مع Supabase Auth.
  - يفحص فورًا `profiles.status`. إذا فشل تحميل الملف أو كانت الحالة ليست `Active`، يتم استدعاء `supabase.auth.signOut()` فورًا ورمي استثناء صريح.
- **تغيير كلمة المرور**:
  ```typescript
  await supabase.auth.updateUser({ password: newPassword });
  ```
- **استعادة كلمة المرور**:
  ```typescript
  await supabase.auth.resetPasswordForEmail(email);
  ```
- **تجديد الجلسة**: يتم تلقائيًا بواسطة العميل (`autoRefreshToken: true`) أو يدويًا عبر `supabase.auth.refreshSession()`.

### 4.2 الفرق بين BiometricPrompt المحلي وPasskey الموثق من الخادم
1. **فتح التطبيق محليًا (Local Biometric Lock via BiometricPrompt)**:
   - يتم عبر نظام تشغيل Android فقط (بصمة الإصبع أو بصمة الوجه في الهاتف).
   - الهدف: حماية التطبيق من المتطفلين عند فتح الشاشة، وفك تشفير الـ Refresh Token المخزن محليًا في `@capacitor/preferences`.
   - لا يتصل بالخادم ولا يولد جلسة جديدة.
2. **تسجيل الدخول الموثق بالسيرفر (FIDO2 / Passkey Authentication)**:
   - يطلب Challenge من السيرفر (`webauthnAuthOptions`).
   - يقوم المعالج الأمني في Android بتوقيع الـ Challenge بالمفتاح الخاص (Private Key).
   - يرسل الاستجابة إلى السيرفر (`webauthnAuthVerify`) لمطابقتها مع المفتاح العام المسجل في `webauthn_credentials`.
   - يقوم السيرفر بإنشاء وتوثيق جلسة JWT جديدة.

### 4.3 إعدادات Digital Asset Links لنظام Android
لتشغيل Passkeys داخل التطبيق:
1. تم توفير ملف `assetlinks.json` في الحزمة معدًا للمعرف:
   `com.integratedtechnics.employee.preview`.
2. يجب رفع الملف على خادم النطاق الخاص بكم على المسار:
   `https://<YOUR_DOMAIN>/.well-known/assetlinks.json`
3. استبدل قيم `sha256_cert_fingerprints` ببصمة الشهادة المستخرجة من keystore التطبيق:
   ```bash
   keytool -list -v -keystore your-release-key.keystore
   ```

### 4.4 سياسة بصمة الحضور
- في الكود الحالي، بصمة الإصبع **معتمدة لتسجيل الدخول فقط**.
- تسجيل الحضور يشترط مسح الوجه (`face_required === true`).
- تعطيل `face_required` يعني فقط عدم إلزام الموظف بمسح الوجه؛ ولا يعتبر إثباتًا لبصمة الإصبع ما لم يتوفر قارئ بصمة معتمد.

---

## 5. دليل استخدام الدوال (TypeScript Code Examples)

يمكنك استيراد كافة الدوال المؤمنة مباشرة من `src/client/secure-api-client.ts`:

```typescript
import {
  loginWithPassword,
  loginWithFaceDescriptor,
  verifyFaceAndGetToken,
  submitPunchIn,
  submitLeave,
  submitAdvance,
} from "./src/client/secure-api-client";

// 1. تسجيل الدخول بكلمة المرور مع الحماية التلقائية للحسابات غير النشطة
try {
  const session = await loginWithPassword("employee@example.com", "SecretPass123!");
  console.log("Logged in with access token:", session.access_token);
} catch (err: any) {
  alert(`Login error: ${err.message}`);
}

// 2. تسجيل الحضور بالوجه والموقع الجغرافي
async function handleCheckIn(faceVector128: number[], position: GeolocationPosition) {
  try {
    // التحقق الموثوق عبر السيرفر للحصول على التوكن
    const bioResult = await verifyFaceAndGetToken({
      descriptor: faceVector128,
      action: "check_in",
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
    });

    // تسجيل الحضور بالتوكن المعتمد
    const res = await submitPunchIn({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
      deviceId: "android-device-uuid",
      biometricToken: bioResult.token,
      note: "Punched in from Android app",
    });

    console.log("Punch in successful:", res);
  } catch (err: any) {
    alert(`Attendance failed: ${err.message}`);
  }
}
```

---

## 6. بيئة الاختبار والتحقق الآلي

### 6.1 تشغيل الاختبارات الآلية
تحتوي الحزمة على جناح اختبارات آلي (`src/tests/employee-integration.test.ts`) يفحص الحالات الست المطلوبة:
```bash
# تشغيل الاختبارات
npx tsx src/tests/employee-integration.test.ts
```
نتائج التشغيل المتوقعة والمؤكدة:
- `[PASS] Case 1: Inactive Account Rejection`
- `[PASS] Case 2: Profile Load Failure Handling`
- `[PASS] Case 3: Face Vector Validation (128 finite floats, NaN/Infinity rejected)`
- `[PASS] Case 4: Expired or Replayed Biometric Token Defense`
- `[PASS] Case 5: Unauthorized Device Gate`
- `[PASS] Case 6: Trusted Server vs Client Token Issuance`

### 6.2 خطوات الاختبار على بيئة غير إنتاجية (Staging)
1. **إعداد حساب موظف تجريبي**:
   - لا ترسل بيانات الاعتماد عبر قنوات غير مشفرة. أنشئ حسابًا في بيئة الـ Staging ببريد مثل `staging.employee@internal.test`.
   - قم بتسجيل وتفعيل الجهاز التجريبي من لوحة تحكم الأدمن في جدول `employee_devices` بحالة `approved`.
2. **اختبار محاكاة الموقع (Mock Location Test)**:
   - فعّل خيار "Allow mock locations" في إعدادات مطور Android، واستخدم تطبيق GPS Spoofing.
   - حاول تسجيل الحضور، وتحقق من ظهور رسالة الرفض القاطع ورصد المحاولة في `attendance_attempts`.
3. **اختبار السلف والإجازات**:
   - تأكد من أن تقديم السلفة خارج نافذة (15 إلى 20 من الشهر) يُرفض فورًا برسالة: `"Advance requests are only accepted between the 15th and 20th of the month"`.
