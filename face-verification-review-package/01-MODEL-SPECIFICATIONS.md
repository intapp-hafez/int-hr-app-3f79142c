# 01 - مواصفات نموذج الوجه وبصمات SHA-256 وكود الاستخراج

## 1. المكتبات والإصدارات والتراخيص
* **اسم المكتبة بالويب:** `face-api.js` (الإصدار: `v0.22.2`).
* **المحرك التحتي:** `@tensorflow/tfjs-core` (الترخيص: Apache 2.0).
* **ترخيص المكتبة:** MIT License (مفتوح المصدر تجارياً).

---

## 2. ملفات النماذج وبصمات SHA-256 الرسمية
مسار الملفات الفعلي بالنظام: `public/models/`

| اسم الملف | الحجم (بايت) | بصمة التجزئة الرسمية SHA-256 |
| :--- | :--- | :--- |
| `face_recognition_model-shard1` | 4,194,304 | `412566A2B8D814D84C60B8055EC5D3B3B2328EF7CD7853384E03EC3DB7B053D8` |
| `face_recognition_model-shard2` | 2,249,728 | `69350FDECD845C532E44DD8F7D0521C773505EF46B87CC34F46640A0CC334ECC` |
| `face_recognition_model-weights_manifest.json` | 18,303 | `6619F4126F845C1F7857F39CBD79565F375734F46E0DD25D9602F8DC21CDA9F5` |
| `tiny_face_detector_model-shard1` | 193,321 | `B7503CE7DF31039B1C43316A9B865CAB6A70DD748CC602D3FA28B551503C3871` |
| `tiny_face_detector_model-weights_manifest.json` | 2,953 | `14C60659A31B6B7B1320077171B8F8ADCB24EF0E62DDE62CE603BCB49A1B49B5` |
| `face_landmark_68_model-shard1` | 356,840 | `4611EF65C87D836D03D684B30EEC4D195D8B219FA1DD58FC58945831C6B9299B` |
| `face_landmark_68_model-weights_manifest.json` | 7,889 | `D30F6CC341009EA4F8223876959289B96576FC54A2615F92DA9741AB9C5F0BBC` |

---

## 3. كود استخراج البصمة الفعلي بالويب (معالجة الصورة)
```typescript
// 1. طلب دفق الفيديو من الكاميرا الأمامية
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: "user", width: 480, height: 360 },
  audio: false,
});

// 2. الكشف عن الوجه ومحاذاته هندسياً واستخراج المتجه 128D
const detection = await faceapi
  .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
  .withFaceLandmarks()     // 68 نقطة لمحاذاة دوران الرأس وموازاة العينين
  .withFaceDescriptor();   // استخراج المتجه الرياضي عبر ResNet-34

// 3. المتجه الناتج (Float32Array بطول 128)
const descriptor: number[] = Array.from(detection.descriptor);
```

---

## 4. شرط التوافق الحاسم لتطبيق Android
* نموذج الويب يعتمد على **Dlib ResNet-34** المدرب لإنتاج متجهات في فضاء Euclidean $d \le 0.5$.
* لكي يتمكن تطبيق Android من مطابقة نفس القوالب المخزنة في `face_descriptors` دون إعادة تسجيل الموظفين، **يجب تشغيل نموذج TFLite مكافئ ومحول من نفس أوزان Dlib ResNet-34**.
* أي نموذج بديل (مثل MobileFaceNet أو Google ML Kit Face) لن يتطابق رياضياً مع القوالب الحالية.
