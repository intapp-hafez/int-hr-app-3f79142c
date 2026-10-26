# 06 - خطة النشر والتراجع الفوري (Deployment & Rollback Runbook)

## 1. مبادئ النشر الآمن (Zero-Downtime Principles)
1. **عدم المساس بالإنتاج أثناء المراجعة:** تم تجهيز جميع الملفات في مسار انعزالي (`face-verification-review-package/`) ولم يتم تطبيق أي تغيير في بيئة Supabase الحية.
2. **الحفاظ الصارم على الحدود الأمنية:** لن يتم أبداً إعادة فتح ثغرات كتابة التوكنات أو القوالب من العميل في أي سيناريو تراجع.
3. **التوافق التام مع التوقيت والقاعدة:** تم توحيد المنطقة الزمنية على `Africa/Cairo`، وإضافة عمود `metadata` لـ `biometric_audit_log` دون أي تعارض في المخطط.

---

## 2. خطوات النشر المنسقة عند الاعتماد (Deployment Steps)

### الخطوة 1: تطبيق ملف الهجرة على Supabase
يتم تنفيذ محتوى `03-MIGRATION.sql` عبر Supabase SQL Editor أو CLI:
```bash
supabase db push
```
* **ماذا يحدث في هذه الخطوة؟**
  - إنشاء جداول `biometric_challenges` (مع قيد الاستهلاك الفردي `used_at`)، و `biometric_verification_proofs` و `attendance_idempotency_records` (المقيد بتجزئة الطلب).
  - إضافة عمود `metadata` لجدول `biometric_audit_log`.
  - سحب صلاحيات `INSERT, UPDATE, DELETE` على `attendance` و `face_descriptors` من المستخدمين (`authenticated, anon`) لمنع أي تلاعب مباشر عبر PostgREST.
  - إنشاء وتثبيت الدالة الذرية `commit_biometric_attendance` وسحب تنفيذها من `PUBLIC` وحصرها بـ `service_role`.

### الخطوة 2: نشر الـ Edge Function المحدثة
```bash
supabase functions deploy biometric-auth
```
* **ماذا يحدث في هذه الخطوة؟**
  - تفعيل المسارات الثلاثة `begin-verification` و `verify-face` و `commit-attendance` مع التحقق الصارم من الحيوية المرئية، ومنع ثغرة الـ NaN، وحساب تجزئة الطلب للـ Idempotency، وإيقاف مسار `face-login` المباشر غير المقيد نهائياً لمنع أي تجاوز.

### الخطوة 3: تفعيل التحقق في تطبيق Android والويب
* في تطبيق Android: ربط الأزرار بالـ 3 استدعاءات بالترتيب.
* في الويب: تفعيل التدفق الموحد في `FaceCapture` و `employee.check.tsx` وإلغاء وضع المعاينة (Preview-only).

---

## 3. خطة التراجع الآمن (Secure Rollback Plan)
إذا طرأ أي عائق تقني بعد النشر، يتم التراجع باتباع الإجراءات الآمنة التالية **دون إعادة فتح أي ثغرات أمنية**:

1. **إسقاط الدالة الذرية الجديدة أو تعطيل استدعائها:**
```sql
-- تعطيل الدالة الذرية في ثانية واحدة
REVOKE EXECUTE ON FUNCTION public.commit_biometric_attendance FROM service_role;
```
2. **العودة للمسار الإداري المعتمد:**
   - يتم توجيه طلبات الحضور عبر دوال الخادم الموثقة (Server Functions) المعتمدة في النظام، دون منح صلاحيات كتابة مباشرة للمستخدمين على جداول قاعدة البيانات.
3. **الجداول الإضافية:**
   - جداول `biometric_challenges` و `biometric_verification_proofs` و `attendance_idempotency_records` معزولة تماماً (Additive) وبقاؤها في القاعدة لا يؤثر إطلاقاً على أي استعلام في النظام.
