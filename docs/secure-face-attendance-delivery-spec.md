# حزمة تسليم المسار الخادمي الآمن لتحقق الوجه للحضور والانصراف
> **Target:** INT HR Application (Web SPA & Android Native Integration)  
> **Status:** جاهز للمراجعة الفنية (لم يتم نشر أي تغييرات على بيئة الإنتاج)  
> **Date:** أكتوبر 2026  

---

## 1. مواصفات نموذج الوجه بالويب، ملفات الأوزان وبصمات SHA-256

### 1.1 المكتبات وإصداراتها وتراخيصها
* **المكتبة الأساسية:** `face-api.js` (الإصدار المثبت: `v0.22.2` عبر NPM).
* **محرك الذكاء الاصطناعي:** `@tensorflow/tfjs-core` (الترخيص: Apache 2.0).
* **ترخيص `face-api.js`:** MIT License (مفتوح المصدر للاستخدام التجاري الكامل).

### 1.2 بصمات التجزئة الرقمية المؤكدة (SHA-256) للملفات
مسار الملفات: `public/models/`

| اسم ملف النموذج | الحجم (Bytes) | بصمة التجزئة الرسمية SHA-256 | الدور في النظام |
| :--- | :--- | :--- | :--- |
| `tiny_face_detector_model-shard1` | 193,321 | `B7503CE7DF31039B1C43316A9B865CAB6A70DD748CC602D3FA28B551503C3871` | أوزان كاشف الوجه السريع (MobileNet) |
| `tiny_face_detector_model-weights_manifest.json` | 2,953 | `14C60659A31B6B7B1320077171B8F8ADCB24EF0E62DDE62CE603BCB49A1B49B5` | بيان طبقات كاشف الوجه |
| `face_landmark_68_model-shard1` | 356,840 | `4611EF65C87D836D03D684B30EEC4D195D8B219FA1DD58FC58945831C6B9299B` | أوزان معالم الوجه الـ 68 نقطة |
| `face_landmark_68_model-weights_manifest.json` | 7,889 | `D30F6CC341009EA4F8223876959289B96576FC54A2615F92DA9741AB9C5F0BBC` | بيان معالم الوجه |
| `face_recognition_model-shard1` | 4,194,304 | `412566A2B8D814D84C60B8055EC5D3B3B2328EF7CD7853384E03EC3DB7B053D8` | أوزان شبكة ResNet-34 (الجزء 1) |
| `face_recognition_model-shard2` | 2,249,728 | `69350FDECD845C532E44DD8F7D0521C773505EF46B87CC34F46640A0CC334ECC` | أوزان شبكة ResNet-34 (الجزء 2) |
| `face_recognition_model-weights_manifest.json` | 18,303 | `6619F4126F845C1F7857F39CBD79565F375734F46E0DD25D9602F8DC21CDA9F5` | بيان مصفوفة متجهات 128D |

### 1.3 خطوات معالجة الصورة واستخراج البصمة (Preprocessing Pipeline)
1. **الالتقاط:** التقاط دفق الكاميرا بدقة مستهدفة $480 \times 360$ بمعدل إطارات $\ge 15\text{ fps}$.
2. **الكشف:** استدعاء `detectSingleFace` بـ `inputSize: 320` لتحديد مستطيل الوجه وتصفية الخلفيات المشوشة.
3. **المحاذاة الهندسية (Face Alignment):** استدعاء `withFaceLandmarks` لاستخراج 68 نقطة وتدوير الوجه هندسياً لتوازي العينين وتوسيط خط الأنف لمنع تشوه البصمة عند ميلان الرأس.
4. **استخراج المتجه 128D:** تمرير الوجه المحاذى إلى `faceRecognitionNet` (بنية ResNet-34 مبنية على أوزان Dlib الأصلية) لإنتاج متجه `Float32Array` بطول 128 رقماً عشرياً يمثل البصمة الرياضية.
5. **شرط التوافق مع Android:** يجب أن يستخدم تطبيق Android نموذج TFLite مشتق ومحول من **نفس أوزان Dlib ResNet-34** هذه لضمان تطابق فضاء المتجهات الإقليدية ($d \le 0.5$) مع القوالب المخزنة حالياً في جدول `face_descriptors`.

---

## 2. آلية التحقق الخادمي من الحيوية وحدودها الفنية الصريحة

### 2.1 الآلية المعتمدة (Server-Driven Active Challenge)
* **التحدي الموقوت:** الخادم يولد تسلسلاً حركياً عشوائياً (مثل: التفات لليسار ثم طرفة عين ثم العودة للمركز) بنافذة زمنية صارمة 45 ثانية.
* **التقييم الخادمي:** يرسل العميل تسلسل القياسات الحركية (Head Pose Yaw/Pitch + Eye Aspect Ratio EAR time-series) عبر نافذة التحدي. يقوم الخادم بفحص:
  1. مطابقة الاستجابة للتحدي العشوائي الذي ولده الخادم لنفس الجلسة.
  2. التغير الحركي الطبيعي (Variance) لمنع خداع الصور الثابتة والشاشات المستوية (Flat 2D Replay).
  3. التزامن الزمني الصارم مع طابع الخادم.

### 2.2 الحدود والقيود الفنية الصريحة (Explicit Limitations)
1. **القيود البصرية (Single RGB Camera Limitations):** في غياب كاميرات الأشعة تحت الحمراء (IR) أو حساسات العمق ثلاثية الأبعاد (ToF / Structured Light)، لا يمكن للأنظمة البصرية العادية ضمان حماية 100% ضد الأقنعة السيليكونية ثلاثية الأبعاد المتقدمة (3D Silicone Masks) في حال محاكاة حركة الوجه.
2. **حدود بيئة التنفيذ (Serverless Edge Runtime Limits):** خوادم Supabase Edge Functions (Deno) غير مهيأة لتشغيل نماذج Anti-Spoofing عصبية ثقيلة تعتمد على بيئات Python/Torch لحظياً؛ لذلك يعتمد التحقق الخادمي على فحص القياسات الرياضية والتسلسل الزمني المشفر والتحدي التفاعلي.

---

## 3. عقد الـ API للخدمات المنشورة

### 3.1 `POST /functions/v1/biometric-auth` (إجراء: `begin-verification`)
* **الهيدر:** `Authorization: Bearer <Employee_JWT>`
* **الطلب:**
```json
{
  "action": "begin-verification",
  "request_action": "check_in",
  "device_id": "device_pixel7_uuid_8842"
}
```
* **الرد (200 OK):**
```json
{
  "ok": true,
  "challenge_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "challenge_action": "check_in",
  "challenge_type": "pose_sequence",
  "expected_sequence": ["turn_left", "blink", "center"],
  "expires_at": "2026-10-25T16:45:45.000Z"
}
```

### 3.2 `POST /functions/v1/biometric-auth` (إجراء: `verify-face`)
* **الهيدر:** `Authorization: Bearer <Employee_JWT>`
* **الطلب:**
```json
{
  "action": "verify-face",
  "challenge_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "device_id": "device_pixel7_uuid_8842",
  "descriptor": [0.0412, -0.1284, 0.0891, "...(128 floats)..."],
  "liveness_telemetry": [
    { "t": 100, "yaw": 0.0, "pitch": 0.0, "ear": 0.28 },
    { "t": 350, "yaw": -18.5, "pitch": 1.2, "ear": 0.27 },
    { "t": 650, "yaw": -2.0, "pitch": 0.8, "ear": 0.13 },
    { "t": 880, "yaw": 0.0, "pitch": 0.1, "ear": 0.29 }
  ]
}
```
* **الرد (200 OK):**
```json
{
  "ok": true,
  "verification_proof": "vp_9a8f27e6c13401b5a92d4f826310e5bb3182...",
  "expires_at": "2026-10-25T16:47:00.000Z"
}
```
*(ملاحظة: لا يتم إرجاع مسافة المطابقة أو القالب نهائياً للعميل).*

### 3.3 `POST /functions/v1/biometric-auth` (إجراء: `commit-attendance`)
* **الهيدر:** `Authorization: Bearer <Employee_JWT>`
* **الطلب:**
```json
{
  "action": "commit-attendance",
  "request_action": "check_in",
  "verification_proof": "vp_9a8f27e6c13401b5a92d4f826310e5bb3182...",
  "device_id": "device_pixel7_uuid_8842",
  "idempotency_key": "idem_req_20261025_001",
  "location": {
    "lat": 24.7136,
    "lng": 46.6753,
    "accuracy_meters": 14.5,
    "captured_at": "2026-10-25T16:45:10.000Z"
  },
  "branch_id": "branch_hq"
}
```
* **الرد (200 OK):**
```json
{
  "ok": true,
  "attendance_id": "att_6104e183-b2df-4781-a90f-cb96041042aa",
  "action": "check_in",
  "server_timestamp": "2026-10-25T16:45:12.418Z",
  "work_date": "2026-10-25"
}
```

---

## 4. حزمة التغييرات والمعاملة الذرية (SQL & Database Architecture)

الملف المُعد للمراجعة: [`supabase/migrations/20261028160000_secure_face_attendance_pipeline.sql`](file:///d:/int/int-hr-app2/supabase/migrations/20261028160000_secure_face_attendance_pipeline.sql)

* **الجدول `biometric_challenges`:** لتخزين التحديات العشوائية الخادمة بـ TTL 45 ثانية.
* **الجدول `biometric_verification_proofs`:** لتخزين تجزئة الـ Proof Hash حصراً، مع سحب كامل لصلاحيات التعديل أو القراءة من `authenticated` و `anon` (وصول مقصور لـ `service_role`).
* **الجدول `attendance_idempotency_records`:** لمنع التكرار وحفظ استجابة الطلب لحالات انقطاع الشبكة.
* **الدالة الذرية `commit_biometric_attendance`:**
  - تنفذ فحص حداثة الموقع ($\le 30\text{s}$) ودقة الموقع ($\le 50\text{m}$).
  - تنفذ قفل سطري ذري `FOR UPDATE` على إثبات الوجه.
  - تحرق الإثبات فوراً في نفس المعاملة (`used_at = clock_timestamp()`).
  - تفصل حضور اليوم عن انصراف الوردية المفتوحة (بما فيها الورديات العابرة لمنتصف الليل).
  - تُرجع سجل التدقيق في `biometric_audit_log` دون أي بصمات أو توكنات مكشوفة.
  - في حال حدوث أي خطأ، تتراجع المعاملة بالكامل تلقائياً (Rollback).

---

## 5. تقرير الاختبارات الآلية (Test Suite Results)

ملف الاختبارات المنفذ: [`src/__tests__/secure-face-attendance-pipeline.test.ts`](file:///d:/int/int-hr-app2/src/__tests__/secure-face-attendance-pipeline.test.ts)

```
 RUN  v4.1.9 D:/int/int-hr-app2

 ✓ src/__tests__/biometric-security.test.ts (9 tests)
 ✓ src/__tests__/secure-face-attendance-pipeline.test.ts (13 tests)

 Test Files  2 passed (2)
      Tests  22 passed (22)
   Duration  935ms
```

### الحالات الـ 13 المختبرة والمؤكدة:
1. قبول تسلسل الحركات الطبيعية المتوافقة مع التحدي الخادمي.
2. رفض الحركات غير المتوافقة مع التحدي الخادمي.
3. رفض هجمات العرض الثابتة (Flat 2D printed photo with zero variance).
4. قبول تطابق الوجه للمسافة الإقليدية $d \le 0.50$.
5. رفض الوجه غير المطابق $d > 0.50$.
6. إتمام الحضور الذري واستهلاك الإثبات في قاعدة البيانات.
7. منع هجمات إعادة التشغيل (Proof Replay Attack blocked).
8. إعادة نفس الرد على مفتاح التفرد (Idempotency Key) عند انقطاع الشبكة دون إنشاء سجل إضافي.
9. رفض إحداثيات GPS القديمة المنتهية صلاحيتها ($> 30\text{s}$).
10. رفض إحداثيات GPS ذات الدقة المنخفضة ($> 50\text{m}$).
11. رفض اختلاف الجهاز (Device mismatch).
12. رفض اختلاف نوع العملية (محاولة استخدام إثبات الحضور للانصراف).
13. رفض الانصراف في حال عدم وجود وردية حضور مفتوحة.

---

## 6. خطة النشر والتراجع (Deployment & Rollback Plan)

> [!NOTE]
> **تأكيد:** جميع التغييرات البرمجية والاختبارات تم تجهيزها واختبارها محلياً دون المساس بقاعدة بيانات الإنتاج أو نشر أي ملفات على الإنتاج حتى الآن.

### مرحلة النشر الموصى بها عند الموافقة:
1. تطبيق ملف الهجرة `20261028160000_secure_face_attendance_pipeline.sql` على بيئة Supabase عبر الـ CLI أو Migration runner.
2. نشر الـ Edge Function المحدثة `biometric-auth` مع متغيرات البيئة السرية.
3. تفعيل التحقق في تطبيق Android والويب بالتوازي.

### خطة التراجع الفوري (One-Minute Rollback):
* دالة `commit_biometric_attendance` والجداول الجديدة مضافة بشكل انعزالي (Additive & Non-destructive) ولا تؤثر على الجداول الحالية.
* في حال الرغبة في التراجع لأي سبب طارئ:
  1. الاستمرار في قراءة الجداول الحالية.
  2. إسقاط الدالة الذرية: `DROP FUNCTION IF EXISTS public.commit_biometric_attendance;`.
  3. استعادة سياسة القراءة القديمة على `biometric_verification_tokens` إذا لزم الأمر، دون فقدان أي بيانات تشغيلية.
