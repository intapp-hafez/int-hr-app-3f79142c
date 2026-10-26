# سجل التغييرات والتحديثات لحزمة تكامل Android (CHANGELOG.md)

تاريخ التحديث: 23 أكتوبر 2026  
مرجع كود النظام (Git Commit Reference): `4766fa3f6edbde5b6fb382623df2933d68a6bbd6` (فرع `main`)

---

## 1. ما تم إضافته (Added)
- **الكود المصدري الفعلي الكامل للخدمات**:
  - تم تضمين نسخ طبق الأصل من ملفات `src/backend/functions/` الخاصة بـ: المصادقة (`auth`, `onboarding`)، الموظفين (`employees`)، الأجهزة (`devices`)، البصمات والوجه (`biometrics`)، الحضور والانصراف (`attendance`, `grouped-attendance`, `attendance-rate-limit.server`)، الإجازات والأرصدة (`leaves`, `leave-balances`)، الأذونات (`employee-permissions`, `permissions`)، السلف (`advances`)، المهام (`tasks`)، الرسائل والمحادثات (`chat`)، والإشعارات (`notifications`, `face-enrollment-notices`).
- **المخططات والأنواع المعتمدة (Schemas & Types)**:
  - تم نسخ كامل لمجلد `src/backend/schemas/` (`index.ts`, `date-range.ts`, `validation-error.ts`).
  - تم نسخ ملف أنواع قاعدة البيانات `src/integrations/supabase/types.ts`.
  - تم نسخ ملفات المساعدة: `date-format.ts`, `reverse-geocode.ts`, `task-mapping.ts`, `store.ts`, `auth.ts`.
- **وحدات الخادم الداعمة لمكافحة التلاعب (Anti-Spoofing & Geofence)**:
  - تم تضمين ملفات `src/backend/server/` بما فيها: `anti-spoofing.server.ts`, `biometric-audit.server.ts`, `device-registry.server.ts`, `geofence.server.ts`.
- **ملف إعدادات الارتباط لتطبيق الأندرويد (Digital Asset Links)**:
  - ملف `assetlinks.json` تم تخصيصه لمعرف تطبيق المعاينة المطلوب: `com.integratedtechnics.employee.preview`.
- **ملفات التكوين لمشروع Capacitor 7**:
  - `package.json` محدث بإصدارات متوافقة مع Capacitor 7 وSupabase JS وZod.
  - `tsconfig.json` معد بروابط مسارات `@/*` تشير محليًا إلى `./src/*`.
- **جناح اختبارات آلي متكامل (Automated Test Suite)**:
  - ملف `src/tests/employee-integration.test.ts` يحتوي على فحوص آلية لحالات: الحساب غير النشط، فشل تحميل الملف، متجهات الوجه غير الصالحة (NaN/Infinity)، التوكن المنتهي أو المعاد استخدامه، الجهاز غير المصرح به، ومنع إصدار التوكنات من العميل.

---

## 2. ما تم تصحيحه وتأمينه (Corrected & Hardened)
- **تصحيح إصدار توكن الحضور بالوجه (Server-Side Trusted Verification)**:
  - **السابق (خطأ أمني)**: كان العميل يقرأ قالب الوجه من `face_descriptors`، ويقارن المسافة بنفسه، ويقوم بإدراج التوكن في `biometric_verification_tokens`.
  - **التصحيح**: تم تحديث Edge Function `biometric-auth` بإضافة إجراء `verify-face-attendance` بحيث يستلم الخادم المتجه فقط، ويفحص دقة الأرقام، ويقارنه مع القالب المشفر دون إرسال القالب للعميل مطلقًا، ويصدر التوكن بوقت الخادم.
- **التحقق الصارم من متجهات الوجه (Finite Vector Validation)**:
  - أضيفت دالة `validateFaceDescriptor` التي تفحص بدقة: الطول = 128 رقمًا، وجميعها أرقام محدودة (`Number.isFinite`) وترفض بشكل حاسم أي مصفوفة تحتوي على `NaN` أو `Infinity`.
- **معالجة الـ Middlewares في `start-shim.ts`**:
  - **السابق**: كان الـ shim يتجاهل `.middleware()`.
  - **التصحيح**: أصبح الـ shim يتحقق من وجود الجلسة، ويفحص حالة `profiles.status` بأنها `Active`، ويرمي استثناء `AccountInactiveError` أو `UnauthorizedError` قبل استدعاء أي دالة.
- **تأمين دورة الدخول بكلمة المرور (`loginWithPassword`)**:
  - عند نجاح تسجيل الدخول بالبريد، يتم فورًا فحص الملف الشخصي. إذا فشل القراءة أو كان الحساب `Inactive`، يُستدعى `supabase.auth.signOut()` فورًا وتُرفض العملية.
- **فحص أخطاء `setSession`**:
  - تم فحص ومعالجة نتائج `supabase.auth.setSession` ورمي أخطاء صريحة عند الفشل بدلاً من تجاهلها.
- **توثيق استهلاك التوكن الذري (Atomic Token Consumption)**:
  - تم توثيق والاعتماد على استعلام الحماية الذري:
    `UPDATE biometric_verification_tokens SET used_at = now() WHERE id = :id AND used_at IS NULL` لمنع إعادة الاستخدام نهائيًا (Anti-Replay).

---

## 3. الفروقات المؤكدة بين الكود المنشور والمقترحات (Confirmed vs Proposals)

| الخاصية | الحالة في كود النظام الحالي (Commit 4766fa3) | ما تم تصحيحه أو اقتراحه للتكامل |
| :--- | :--- | :--- |
| **مرفقات الإجازات** | تُخزن كسلسلة Base64 Data URL (حتى 1.5 ميجا) في عمود نصي `proof_url`. | **فجوة**: لا يوجد Storage Bucket مخصص حاليًا. الحزمة تعتمد Base64 data URL حتى إنشاء Bucket. |
| **فحص الحيوية (Liveness)** | يعتمد على اكتشاف معالم الوجه عبر مكتبة الواجهة (Client-side landmark detection) فقط. | **فجوة صريحة**: لا يوجد Challenge-Response حركي في السيرفر (مثل رمش العين أو الالتفاف)؛ تم تسجيله كنقص صريح أدناه. |
| **بصمة الحضور** | السياسة تفرض `face_required === true` افتراضيًا. | تعطيل الوجه لا يعني إثبات بصمة، بل يعفي الموظف من التوكن الحيوي ما لم يتم ربط قارئ بصمة معتمد. |
| **سياسة Mock GPS** | رفض قاطع (Hard Reject) وتسجيل محاولة في `attendance_attempts` وفتح بلاغ `attendance_review_cases`. | مؤكدة ومطابقة للكود الفعلي 100%. |

---

## 4. قائمة النواقص الحالية التي تحتاج تنفيذًا مستقبليًا (Gaps Backlog)
1. **فحص حيوية الوجه في الخادم (Server-side Liveness Challenge)**:
   - الكود الحالي يتحقق من صحة المتجه الرياضي ومطابقته للقالب، لكنه لا يفرض challenge عشوائي (مثل طلب الالتفاف يمينًا أو الرمش مع توقيع رقمي للقطات)؛ مما يجعله عرضة للهجمات المتقدمة في حال تسريب المتجه. يُوصى بإضافة challenge-response token من الخادم قبل التقاط الوجه.
2. **إنشاء Storage Bucket للمرفقات الكبيرة**:
   - الاعتماد على Base64 Data URLs في حقول قاعدة البيانات يزيد من حجم الصفوف ويحد من حجم الملفات (1.5 - 2.5 ميجابايت). يُوصى بإنشاء bucket باسم `employee-attachments` مع سياسات RLS المناسبة.
3. **تطبيق Digital Asset Links على نطاق الإنتاج**:
   - لتفعيل WebAuthn / Passkeys داخل تطبيق Android دون الحاجة إلى إضافة Native، يجب نشر ملف `assetlinks.json` المرفق على مسار النطاق الفعلي للنظام: `https://<DOMAIN>/.well-known/assetlinks.json`.
