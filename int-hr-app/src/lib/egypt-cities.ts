// Approximate centroids for major Egyptian cities/governorates.
// Keys are lowercased; lookup also tries English and Arabic synonyms.
export type CityCentroid = { lat: number; lng: number; en: string; ar: string };

export const EGYPT_CITIES: Record<string, CityCentroid> = {
  cairo: { lat: 30.0444, lng: 31.2357, en: "Cairo", ar: "القاهرة" },
  giza: { lat: 30.0131, lng: 31.2089, en: "Giza", ar: "الجيزة" },
  alexandria: { lat: 31.2001, lng: 29.9187, en: "Alexandria", ar: "الإسكندرية" },
  "port said": { lat: 31.2653, lng: 32.3019, en: "Port Said", ar: "بورسعيد" },
  suez: { lat: 29.9668, lng: 32.5498, en: "Suez", ar: "السويس" },
  ismailia: { lat: 30.5965, lng: 32.2715, en: "Ismailia", ar: "الإسماعيلية" },
  mansoura: { lat: 31.0409, lng: 31.3785, en: "Mansoura", ar: "المنصورة" },
  tanta: { lat: 30.7865, lng: 31.0004, en: "Tanta", ar: "طنطا" },
  zagazig: { lat: 30.5877, lng: 31.502, en: "Zagazig", ar: "الزقازيق" },
  damietta: { lat: 31.4165, lng: 31.8133, en: "Damietta", ar: "دمياط" },
  "kafr el-sheikh": { lat: 31.1107, lng: 30.9388, en: "Kafr El-Sheikh", ar: "كفر الشيخ" },
  damanhur: { lat: 31.0341, lng: 30.4682, en: "Damanhur", ar: "دمنهور" },
  banha: { lat: 30.4599, lng: 31.1843, en: "Banha", ar: "بنها" },
  shibin: { lat: 30.5526, lng: 31.0094, en: "Shibin El-Kom", ar: "شبين الكوم" },
  fayoum: { lat: 29.3084, lng: 30.8428, en: "Fayoum", ar: "الفيوم" },
  "beni suef": { lat: 29.0744, lng: 31.0978, en: "Beni Suef", ar: "بني سويف" },
  minya: { lat: 28.0871, lng: 30.7618, en: "Minya", ar: "المنيا" },
  asyut: { lat: 27.1809, lng: 31.1837, en: "Asyut", ar: "أسيوط" },
  sohag: { lat: 26.5569, lng: 31.6948, en: "Sohag", ar: "سوهاج" },
  qena: { lat: 26.1551, lng: 32.716, en: "Qena", ar: "قنا" },
  luxor: { lat: 25.6872, lng: 32.6396, en: "Luxor", ar: "الأقصر" },
  aswan: { lat: 24.0889, lng: 32.8998, en: "Aswan", ar: "أسوان" },
  hurghada: { lat: 27.2579, lng: 33.8116, en: "Hurghada", ar: "الغردقة" },
  "sharm el-sheikh": { lat: 27.9158, lng: 34.3299, en: "Sharm El-Sheikh", ar: "شرم الشيخ" },
  "el-arish": { lat: 31.1313, lng: 33.8031, en: "El-Arish", ar: "العريش" },
  marsa: { lat: 31.3543, lng: 27.2373, en: "Marsa Matruh", ar: "مرسى مطروح" },
  "new valley": { lat: 25.4477, lng: 30.5577, en: "New Valley", ar: "الوادي الجديد" },
  "6th of october": { lat: 29.9361, lng: 30.9269, en: "6th of October", ar: "السادس من أكتوبر" },
  "new cairo": { lat: 30.0286, lng: 31.4969, en: "New Cairo", ar: "القاهرة الجديدة" },
  obour: { lat: 30.2236, lng: 31.4691, en: "Obour", ar: "العبور" },
  badr: { lat: 30.1326, lng: 31.7195, en: "Badr", ar: "بدر" },
  helwan: { lat: 29.8493, lng: 31.3343, en: "Helwan", ar: "حلوان" },
  shubra: { lat: 30.1286, lng: 31.2422, en: "Shubra El-Kheima", ar: "شبرا الخيمة" },
};

const ALIASES: Record<string, string> = {
  "el cairo": "cairo",
  "el-cairo": "cairo",
  alex: "alexandria",
  iskandariya: "alexandria",
  "port-said": "port said",
  portsaid: "port said",
  "el-mansoura": "mansoura",
  "el mansoura": "mansoura",
  "october city": "6th of october",
  "6 october": "6th of october",
  "new-cairo": "new cairo",
};

export function lookupCity(name?: string | null): CityCentroid | null {
  if (!name) return null;
  const raw = name.trim().toLowerCase();
  if (!raw) return null;
  if (EGYPT_CITIES[raw]) return EGYPT_CITIES[raw];
  if (ALIASES[raw] && EGYPT_CITIES[ALIASES[raw]]) return EGYPT_CITIES[ALIASES[raw]];
  // Match by Arabic name
  for (const v of Object.values(EGYPT_CITIES)) {
    if (v.ar === name.trim()) return v;
  }
  // Loose contains match
  for (const [k, v] of Object.entries(EGYPT_CITIES)) {
    if (raw.includes(k) || k.includes(raw)) return v;
  }
  return null;
}

export const EGYPT_CENTER: [number, number] = [26.8206, 30.8025];