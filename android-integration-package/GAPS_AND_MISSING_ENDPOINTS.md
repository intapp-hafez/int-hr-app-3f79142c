# فجوات التوافق وقائمة النواقص (Code Gap Analysis & Discrepancies)

هذا المستند يوضح الفروقات الجوهرية بين ما ورد في مسودة وثيقة `emp-apis.md` وبين **السلوك الفعلي المؤكد داخل كود وقاعدة بيانات مشروع INT-HR**.

---

## 1. الفروقات في أسماء الجداول والحقول (Database Schema Mismatches)

| المفهوم | ما ذُكر في المسودة الأولية | السلوك الفعلي المؤكد في الكود | الإجراء المطلوب في تطبيق Android |
| :--- | :--- | :--- | :--- |
| **جدول الإجازات** | `leave_requests` | `leaves` | يجب توجيه استعلامات وحفظ الإجازات إلى جدول `leaves`. |
| **جدول قوالب بصمة الوجه** | `employee_biometrics` | `face_descriptors` | جدول البصمة هو `face_descriptors`، ويحتوي على الحقول `user_id` و `descriptor` (`numeric[]` بطول 128) و `enrolled_at`. |
| **جدول السلف المالية** | `advances` / `salary_advances` | `employee_advances` | الجدول المعتمد هو `employee_advances`، وتُحفظ فيه الحالة باسم `status: "pending_manager"`. |
| **مرفقات الإجازات** | روابط Supabase Storage | `proof_url` (Base64 Data URL) | النظام لا يستخدم Storage Bucket للمرفقات، بل يستقبل الملف كـ `data:image/jpeg;base64,...` أو `data:application/pdf;base64,...` بحد أقصى **1.5 ميجابايت** عبر الحقول `proof_url` و `proof_mime` و `proof_name`. |
| **مرفقات السلف** | ملفات منفصلة | `attachment_url` (Base64 Data URL) | الحقل يستقبل سلسلة نصية بحد أقصى 2.5 ميجابايت. |

---

## 2. قواعد الأعمال الصارمة غير المذكورة في التوثيق القديم

### 2.1 نافذة تقديم السلف المالية (Advance Request Window)
- **الكود الفعلي** في `src/backend/functions/advances.functions.ts` سطر 141:
  ```typescript
  const currentDay = today.getDate();
  if (currentDay < 15 || currentDay > 20) {
    throw new Error("Advance requests are only accepted between the 15th and 20th of the month.");
  }
  ```
- **القاعدة**: لا يمكن لأي موظف تقديم طلب سلفة إلا بين **يومي 15 و 20 من كل شهر ميلادي**. أي طلب يُرسل خارج هذه النافذة يُرفض فوريًا بخطأ برمجي.
- **فترة الاختبار (Probation)**: إذا كان عقد الموظف لم يمر عليه **3 أشهر كاملة** (`diffMonths < 3`)، يُرفض الطلب.

### 2.2 إعادة تسجيل بصمة الوجه (Face Re-enrollment Guard)
- **الكود الفعلي** في `src/backend/functions/biometrics.functions.ts` سطر 37:
  - إذا كان الموظف مسجلًا لوجهه مسبقًا، لا يستطيع إعادة التسجيل بنفسه إلا إذا قام مسؤول النظام بتفعيل الخيار في ملفه:
    `profiles.face_reenroll_allowed === true`.
  - بمجرد نجاح إعادة التسجيل، يُعاد إغلاق الحقل تلقائيًا (`face_reenroll_allowed: false`).

---

## 3. العمليات التي تحتاج سيرفر وسيط أو Edge Function

### 3.1 تسجيل الدخول بالوجه (Face Login Session Minting)
- **الواقع التقني**:
  - مطابقة متجهات الوجه الرياضية (Euclidean distance <= 0.5) تتم في العميل أو الـ RPC.
  - لكن **إنشاء جلسة تسجيل دخول صالحة للمستخدم (JWT)** دون إدخال كلمة مرور يتطلب صلاحيات إدارية (`auth.admin.generateLink` ثم `auth.verifyOtp`).
- **الموقف في الكود**:
  - تم تجهيز ونشر Supabase Edge Function باسم `biometric-auth` لهذا الغرض.
  - تطبيق Android يجب أن يستدعي:
    ```typescript
    supabase.functions.invoke("biometric-auth", {
      body: { action: "face-login", email, descriptor }
    });
    ```
  - لا يمكن تنفيذ ذلك مباشرة عبر متصفح العميل دون مفتاح `service_role` المحظور وضعه في العميل.

### 3.2 فحص الموقع الوهمي ومكافحة التلاعب (Mock GPS & Spoofing Defense)
- **السلوك المؤكد في الكود**:
  - **ليس مجرد تسجيل للمراجعة**: إذا كشف محرك التواجد `evaluatePresence` موقعًا وهميًا (`mock_detected`)، يتم **رفض عملية تسجيل الحضور بالكامل وبشكل قطعي (Hard REJECT)**.
  - تُسجل محاولة الرفض في جدول `attendance_attempts` مع كود `mock_gps_detected`.
  - يُنشأ بلاغ أمني عاجل في `attendance_review_cases` بحالة `pending`.
  - إذا تكررت محاولات التلاعب **3 مرات خلال ساعتين**، يُحظر الموظف من تسجيل الحضور تلقائيًا لمدة ساعتين مع رسالة: `"تعذر إتمام العملية حاليًا. يرجى التواصل مع الإدارة"`.

---

## 4. قيود تطبيق Android (Capacitor WebView)

### 4.1 بصمة الإصبع (WebAuthn / Passkeys) داخل WebView
- **المشكلة**: متصفح WebView الافتراضي في Android لا يدعم استدعاءات `navigator.credentials.get()` لمفتاح FIDO2 ما لم تتوفر الشروط التالية:
  1. وجود ملف **Digital Asset Links** على الرابط:
     `https://<YOUR_DOMAIN>/.well-known/assetlinks.json`
     يحتوي على `package_name` الخاص بتطبيق Android وبصمة الشهادة `sha256_cert_fingerprints`.
  2. أن يكون الـ `rpID` هو نفس النطاق الموثق في الملف.
- **الحل العملي لتطبيق Android**:
  - استخدام إضافة Capacitor الأصلية للبصمة الحيوية مثل:
    `@aparajita/capacitor-biometric-auth` أو `@pantrist/capacitor-plugin-fido`.

### 4.2 هل بصمة الإصبع بديلة عن الوجه في الحضور؟
- **الكود الفعلي**:
  - في جدول `profiles` يوجد حقل `face_required` (افتراضيًا `true`).
  - ما دام `face_required === true`، فإن واجهة وفحص الحضور يفرضان **مسح الوجه** للحصول على توكن التحقق.
  - البصمة تدعم تسجيل الدخول كبديل لكلمة المرور، ولكن في الحضور لا تُقبل بديلاً عن الوجه إلا إذا قام الإداري بإلغاء إلزامية الوجه لهذا الموظف تحديدًا (`face_required: false`).
