# حزمة مراجعة وتدقيق مسار تحقق الوجه للحضور والانصراف (Zero-Trust Hardened Face Verification Package v5)

> **الحالة:** مُحدّثة ومُعالجة بالكامل لكافة ملاحظات وثيقة التسليم المؤرخة 2026-10-26 (Production-Ready Code & Schema).  
> **التاريخ:** 26 أكتوبر 2026  
> **الهدف:** استيفاء متطلبات الخادم لفتح التسجيل وربط تطبيق Android وواجهة الويب بنظام حضور بيومتري صفري الثقة (Zero-Trust).

---

## 1. جدول معالجة المتطلبات الثمانية للتسليم (Handover Remediations v5)

| # | المتطلب في وثيقة التسليم | المعالجة المنفذة في هذه النسخة v5 |
|---|-------------------|----------------------------------|
| **1** | **استبدال `verifyVisualKeyframesLiveness`** | تم بناء فاحص ثنائي حقيقي (Binary Image Parser) لترويسات JPEG (SOF0/SOF2) و WebP و PNG؛ التحقق من الأبعاد الحقيقية ($\ge 120\times 120$)؛ حساب إنتروبيا البايتات لمنع الصور الفارغة أو المصطنعة؛ وإلزام وجود حركة بصرية فعلية بين الوضعيات المختلفة لمنع هجمات عرض الصور الثابتة (Anti-Static Photo Replay). |
| **2** | **التحقق التشفيري من `device_signature`** | تم تنفيذ تحقق تشفيري رقمي غير متماثل عبر معيار WebCrypto (`crypto.subtle.verify`) يدعم مفاتيح الأجهزة المسجلة (ECDSA P-256 و RSA-PSS)، والتوقيع على حمولة معيارية تضم: الموظف، الإجراء، الجهاز، إثبات الوجه، والتوقيت والموقع الجغرافي. وأي فشل أو تزوير يُرفض بـ `403 DEVICE_SIGNATURE_INVALID`. |
| **3** | **تحديث محاولات التحدي داخل معاملة ذرية** | تم نقل تسجيل الفشل إلى دالة PostgreSQL ذرية `record_challenge_failure`؛ تُقفل المحاولة بـ `FOR UPDATE` وتزيد العداد، وتحرق التحدي عند بلوغ الحد الأقصى دون إمكانية إعادة `used_at` إلى `null` مطلقاً. |
| **4** | **فرض Rate Limit ذري و Fail-Closed** | تم دمج فحص الـ Rate Limit (5 تحديات لكل 10 دقائق) وفحص حالة الحساب (`Active`) واعتماد الجهاز داخل دالة PostgreSQL ذرية واحدة `request_biometric_challenge`؛ مما يمنع ثغرات التسابق الزمني (Race Conditions) وتجاهل الأخطاء. |
| **5** | **إصلاح الـ Idempotency** | تم التحقق الصارم في كافة الحالات من مطابقة `user_id` و `action` و `request_hash`، مع منع التزامن أثناء حالة `processing`، وتسجيل حالات الفشل (`failed`) للتعافي الآمن، وحماية المفتاح من التلاعب بالمعاملات. |
| **6** | **توحيد العقد النهائي (API Contract)** | تم توحيد [`02-API-CONTRACT.md`](file:///d:/int/int-hr-app2/face-verification-review-package/02-API-CONTRACT.md) مع الكود الفعلي؛ اعتماد `visual_keyframes` بدلاً من المسميات القديمة، وتوثيق حقول `device_signature`، وصيغة الـ Payload الموقعة، وأكواد الأخطاء الدقيقة. |
| **7** | **التحقق الخادمي الشامل والمعاملة الموحدة** | تطبيق RLS صارم يحجب الكتابة المباشرة على `attendance` و `face_descriptors` من أدوار العميل (`anon`, `authenticated`)، واستهلاك الإثبات البيومتري وكتابة الحضور بوقت الخادم `clock_timestamp()` داخل معاملة ذرية واحدة عبر `commit_biometric_attendance`. |
| **8** | **اختبارات تشغيل حقيقية (Hardening Test Suite)** | تم تحديث [`05-TEST-SUITE.ts`](file:///d:/int/int-hr-app2/face-verification-review-package/05-TEST-SUITE.ts) ليشمل اختبارات شاملة تغطي: كشف الحيوية الحقيقي، تزوير التوقيع الرقمي ECDSA، حرق التحدي الذري، كسر الـ Rate limit، هجمات التكرار (Replay Attacks)، وتضارب الـ Idempotency. |

---

## 2. فهرس ملفات الحزمة المحدثة

| الملف | الوصف والمحتوى |
| :--- | :--- |
| [`01-MODEL-SPECIFICATIONS.md`](file:///d:/int/int-hr-app2/face-verification-review-package/01-MODEL-SPECIFICATIONS.md) | مواصفات نموذج الوجه (ResNet-34 Dlib)، إصدارات المكتبات، بصمات SHA-256، وشروط توافق تطبيق Android. |
| [`02-API-CONTRACT.md`](file:///d:/int/int-hr-app2/face-verification-review-package/02-API-CONTRACT.md) | عقد الـ API الموحد للمسارات الثلاثة، وتوثيق صيغة التوقيع الرقمي وأدلة الحيوية. |
| [`03-MIGRATION.sql`](file:///d:/int/int-hr-app2/face-verification-review-package/03-MIGRATION.sql) | كود SQL المحدث v5: الدوال الذرية `request_biometric_challenge`، `record_challenge_failure`، `mint_biometric_proof`، و `commit_biometric_attendance` المحمية بالكامل بـ RLS. |
| [`04-EDGE-FUNCTION.ts`](file:///d:/int/int-hr-app2/face-verification-review-package/04-EDGE-FUNCTION.ts) | خدمة Supabase Edge Function (Deno) المحصنة: فحص ترويسات الصور وإنتروبيا البكسلات، التحقق التشفيري من توقيع الجهاز، وربط الـ RPCs الذرية. |
| [`05-TEST-SUITE.ts`](file:///d:/int/int-hr-app2/face-verification-review-package/05-TEST-SUITE.ts) | حزمة الاختبارات الآلية الشاملة (8 اختبارات تغطي محاكاة حقيقية لكافة نواقل الهجوم والتزامن والتزوير). |
| [`06-DEPLOYMENT-AND-ROLLBACK.md`](file:///d:/int/int-hr-app2/face-verification-review-package/06-DEPLOYMENT-AND-ROLLBACK.md) | خطة النشر وتطبيق الهجرة الآمنة. |
| [`models/`](file:///d:/int/int-hr-app2/face-verification-review-package/models/) | ملفات أوزان ونماذج الوجه السبعة كاملة ومطابقة لـ SHA-256. |
