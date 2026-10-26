# 02 - عقد الـ API للخدمات المنشورة (API Specification v5)

> المسار الخادمي الموحد: `POST https://<PROJECT_REF>.supabase.co/functions/v1/biometric-auth`  
> الهيدر الإلزامي لجميع الطلبات:  
> `Authorization: Bearer <Employee_JWT>`  
> `Content-Type: application/json`  
> المنطقة الزمنية المعتمدة للحضور: `Africa/Cairo`

---

## 1. مسار بدء التحقق (`begin-verification`)

### الطلب (Request):
```json
{
  "action": "begin-verification",
  "request_action": "check_in",
  "device_id": "device_pixel7_uuid_8842"
}
```

* **شروط التحقق الخادمي الذري (Atomic Pre-Check):**
  - **حالة الحساب:** تُفحص ذرياً داخل دالة `request_biometric_challenge`؛ يجب أن تكون `status === 'Active'` حصراً (`401 ACCOUNT_NOT_ACTIVE`).
  - **محدد السرعة الذري (Atomic Rate Limit):** فحص وحجز فوري في معاملة قاعدة البيانات (حد أقصى 5 تحديات خلال 10 دقائق)، وأي تجاوز يُرفض فوراً بكود `429 RATE_LIMITED`.
  - **اعتماد الجهاز (Device Binding):** في حال اشتراط الجهاز للموظف (`device_check_required`)، يُشترط وجوده واعتماده في `employee_devices` بحالة `approved` (`403 DEVICE_NOT_APPROVED` أو `403 DEVICE_NOT_REGISTERED`).
  - **الإجراء:** إما `check_in` أو `check_out` حصراً (`400 INVALID_ACTION`).

### الرد الناجح (200 OK):
```json
{
  "ok": true,
  "challenge_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "challenge_action": "check_in",
  "challenge_type": "pose_sequence",
  "expected_sequence": ["turn_left", "blink", "center"],
  "expires_at": "2026-10-26T16:45:45.000Z"
}
```

---

## 2. مسار مطابقة الوجه وإثبات الحيوية (`verify-face`)

### الطلب (Request):
```json
{
  "action": "verify-face",
  "challenge_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "device_id": "device_pixel7_uuid_8842",
  "descriptor": [0.0412, -0.1284, 0.0891, "...(128 finite floats)..."],
  "visual_keyframes": [
    {
      "step": "turn_left",
      "t": 1729960000100,
      "image_b64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
    },
    {
      "step": "blink",
      "t": 1729960000850,
      "image_b64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
    },
    {
      "step": "center",
      "t": 1729960001600,
      "image_b64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
    }
  ]
}
```

* **الضوابط الأمنية لمطابقة الوجه:**
  1. **فحص حيوية الإطارات الحقيقية (`verifyVisualKeyframesLiveness`):**
     - مطابقة عدد الإطارات مع خطوات التحدي المطلوبة.
     - ترتيب زمني تصاعدي صارم ($t_{i} > t_{i-1}$) وفترة تفاعل طبيعية ($800\text{ms} \le \Delta t \le 10000\text{ms}$).
     - فك بنية الصورة الثنائية (Binary Headers) والتحقق من الأبعاد ($\ge 120\times 120$).
     - فحص إنتروبيا وتشتت البكسلات (Byte Entropy $\ge 3.5$) لرفض الصور الفارغة أو المصطنعة.
     - فحص تباين الحركة البصرية بين الوضعيات لمنع هجمات عرض الصور الثابتة (Anti-Static Photo Replay).
  2. **فحص المتجه الرياضي:**
     - خلو المتجه من أي قيمة `NaN` أو `Infinity` أو مصفوفة لا تطابق 128 رقماً محدداً (`400 INVALID_DESCRIPTOR`).
     - مطابقة المسافة الإقليدية مع القالب المسجل في `face_descriptors` بحيث تكون $d \le 0.50$ (`403 FACE_MISMATCH`).
  3. **حرق التحدي الذري عند الفشل:**
     - أي فشل في الحيوية أو المطابقة يُسجل ذرياً عبر `record_challenge_failure` مع زيادة العداد دون إمكانية إعادة `used_at` إلى `null`.
     - تجاوز 3 محاولات يؤدي لحرق التحدي فوراً وإرجاع `429 MAX_ATTEMPTS_EXCEEDED`.
  4. **إصدار الإثبات الذري (`mint_biometric_proof`):**
     - استهلاك التحدي وإصدار الإثبات المشفر (`verification_proof`) ذرياً داخل معاملة PostgreSQL واحدة بصلاحية دقيقتين.

### الرد الناجح (200 OK):
```json
{
  "ok": true,
  "verification_proof": "vp_9a8f27e6c13401b5a92d4f826310e5bb3182fc0d4",
  "expires_at": "2026-10-26T16:47:00.000Z"
}
```

---

## 3. مسار إتمام الحضور الذري (`commit-attendance`)

### الطلب (Request):
```json
{
  "action": "commit-attendance",
  "request_action": "check_in",
  "verification_proof": "vp_9a8f27e6c13401b5a92d4f826310e5bb3182fc0d4",
  "device_id": "device_pixel7_uuid_8842",
  "device_signature": "MEYCIQDwP3...Base64Signature...",
  "idempotency_key": "idem_req_20261026_001",
  "location": {
    "lat": 30.0444,
    "lng": 31.2357,
    "accuracy_meters": 14.5,
    "captured_at": "2026-10-26T16:45:10.000Z"
  }
}
```

* **الضوابط الصارمة في المعاملة الذرية الخادمية:**
  1. **التحقق التشفيري من توقيع الجهاز (`device_signature`):**
     - إذا كان للجهاز مفتاح عام مسجل في `employee_devices.public_key`، يُلزم بتقديم توقيع رقمي.
     - يتم التحقق تشفيرياً (ECDSA P-256 أو RSA-PSS) عبر WebCrypto من التوقيع الموقع على النص المعياري:
       `${user.id}:${request_action}:${device_id}:${verification_proof}:${lat}:${lng}:${captured_at}`
     - التوقيع المزور أو التالف يُرفض فوراً بكود `403 DEVICE_SIGNATURE_INVALID`.
  2. **إدارة دورة حياة الـ Idempotency المعززة:**
     - التحقق الصارم من تطابق `user_id` و `action` و `request_hash` لجميع الحالات. أي اختلاف يعيد فوراً `409 IDEMPOTENCY_CONFLICT`.
     - إذا كانت الحالة `completed`: يُعاد الرد المخزن فوراً.
     - إذا كانت الحالة `failed`: يُعاد الخطأ المخزن فوراً.
     - إذا كانت الحالة `processing`: منع التزامن (`409 CONCURRENT_REQUEST_IN_PROGRESS`)، مع إمكانية التعافي الآمن للطلبات العالقة (> 30 ثانية).
  3. **الضوابط الفيزيائية للموقع الجغرافي (Geofence & GPS):**
     - رفض أي إحداثيات خارج الحدود الفيزيائية $(-90 \le \text{lat} \le 90,\; -180 \le \text{lng} \le 180)$ بكود `400 INVALID_COORDINATES`.
     - رفض أي دقة سالبة أو تتجاوز $50\text{m}$ بكود `400 LOW_ACCURACY_LOCATION`.
     - رفض أي عينة قديمة تجاوز عمرها 30 ثانية بكود `400 STALE_LOCATION`.
     - إلزامية النطاق الجغرافي: غياب النطاق للموظف يُرفض بـ `403 NO_ASSIGNED_GEOFENCE`، وخروجه عن النطاق يُرفض بـ `403 GEOFENCE_VIOLATION`.
  4. **استهلاك الإثبات وتسجيل الحضور الذري:**
     - استهلاك الإثبات بقفل سطري `FOR UPDATE` وكتابة الحضور بوقت الخادم الموثوق `clock_timestamp()` في معاملة واحدة.

### الرد الناجح (200 OK):
```json
{
  "ok": true,
  "attendance_id": "att_6104e183-b2df-4781-a90f-cb96041042aa",
  "action": "check_in",
  "branch": "Cairo Branch",
  "server_timestamp": "2026-10-26T18:45:12.418Z",
  "work_date": "2026-10-26"
}
```

---

## 4. إيقاف مسار `face-login` غير المقيد
* مسار `face-login` المباشر مغلق نهائياً ويعيد `403 PASSWORDLESS_FACE_LOGIN_DEPRECATED`. لا يُسمح بإصدار جلسات بدون مسار التحدي التشفيري المعتمد.
