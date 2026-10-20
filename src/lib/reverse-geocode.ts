export type GeocodeResult = {
  city?: string;
  district?: string;
  street?: string;
  formatted?: string;
  detailedAddress?: string;
};

function cleanText(val?: string | null): string {
  return (val ?? "").trim();
}

export function cleanGov(name?: string | null): string {
  return (name ?? "")
    .replace(/\s+Governorate$/i, "")
    .replace(/^محافظة\s+/i, "")
    .replace(/\s+محافظة$/i, "")
    .trim();
}

function isDistinct(val: string | undefined | null, ...compareWith: Array<string | undefined | null>): boolean {
  if (!val) return false;
  const clean = val.trim().toLowerCase();
  if (!clean) return false;
  if (/^(africa|asia|europe|sahara|time zone)/i.test(clean)) return false;
  for (const c of compareWith) {
    if (c && c.trim().toLowerCase() === clean) return false;
  }
  return true;
}

export function formatLocationParts(...parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const part of parts) {
    const trimmed = cleanText(part);
    if (!trimmed || /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(trimmed) || /^-?\d{1,3}(?:\.\d+)?$/.test(trimmed)) {
      continue;
    }
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    cleaned.push(trimmed);
  }
  return cleaned.join(", ");
}

function parseBDC(j: any): GeocodeResult {
  if (!j) return {};
  const country = cleanText(j.countryName);
  const subdivision = cleanGov(cleanText(j.principalSubdivision));
  const adminList: any[] = Array.isArray(j.localityInfo?.administrative) ? j.localityInfo.administrative : [];
  const infoList: any[] = Array.isArray(j.localityInfo?.informative) ? j.localityInfo.informative : [];

  let city =
    cleanGov(cleanText(j.city)) ||
    cleanGov(cleanText(adminList.find((a) => a.adminLevel === 4)?.name)) ||
    subdivision ||
    "";

  // 1. Check administrative levels >= 6
  let district = adminList.find((a) => a.adminLevel >= 6 && isDistinct(a.name, city, subdivision, country))?.name;

  // 2. Check locality (very common in Egypt e.g. "Al Umraniyah", "Dokki", "Madinat an Nasr")
  if (!district && isDistinct(j.locality, city, subdivision, country)) {
    district = cleanText(j.locality);
  }

  // 3. Check locality distinct from city
  if (!district && j.locality && isDistinct(j.locality, city)) {
    district = cleanText(j.locality);
  }

  // 4. Check informative entries describing district, suburb, neighborhood, kism, markaz, quarter
  if (!district) {
    const infoMatch = infoList.find(
      (i) =>
        /(district|suburb|neighborhood|neighbourhood|area|quarter|kism|markaz)/i.test(i.description ?? "") &&
        isDistinct(i.name, city, subdivision, country),
    );
    if (infoMatch) district = cleanText(infoMatch.name);
  }

  // 5. Check informative entries with order >= 4 that are distinct
  if (!district) {
    const infoMatch = infoList.find((i) => (i.order ?? 0) >= 4 && isDistinct(i.name, city, subdivision, country));
    if (infoMatch) district = cleanText(infoMatch.name);
  }

  const street = [cleanText(j.streetNumber), cleanText(j.streetName)].filter(Boolean).join(" ");

  return {
    city: city || undefined,
    district: cleanText(district) || undefined,
    street: street || undefined,
    detailedAddress: street || undefined,
  };
}

function parseNominatim(j: any): GeocodeResult {
  if (!j || !j.address) return {};
  const addr = j.address;
  const state = cleanGov(cleanText(addr.state));
  const rawCity = cleanGov(cleanText(addr.city || addr.town || ""));
  let city = rawCity || state || cleanText(addr.county);

  const districtCandidates = [
    addr.city_district,
    addr.suburb,
    addr.quarter,
    addr.neighbourhood,
    addr.district,
    addr.borough,
    addr.village,
  ];

  let district = districtCandidates.find((d) => isDistinct(d, city, state));

  if (!district && state && rawCity && isDistinct(rawCity, state)) {
    city = state;
    district = rawCity.replace(/\s+City$/i, "").replace(/\s+مدينة$/i, "").replace(/^مدينة\s+/i, "");
  }

  const landmark = cleanText(addr.amenity || addr.building || addr.shop || addr.office || addr.tourism || addr.leisure || "");
  const streetWithNumber = [cleanText(addr.house_number), cleanText(addr.road)].filter(Boolean).join(" ") || cleanText(addr.road);
  const area = cleanText(district || addr.neighbourhood || addr.suburb || addr.quarter || "");

  const detailedParts = [landmark, streetWithNumber, area].filter(Boolean);
  const detailedAddress = detailedParts.join(", ") || streetWithNumber || cleanText(j.display_name);

  return {
    city: city || undefined,
    district: cleanText(district) || undefined,
    street: detailedAddress || streetWithNumber || undefined,
    detailedAddress: detailedAddress || undefined,
  };
}

const memCache = new Map<string, GeocodeResult>();
const inFlight = new Map<string, Promise<GeocodeResult>>();

function getCacheKey(lat: number, lng: number, lang: string): string {
  return `geo_${Number(lat).toFixed(4)}_${Number(lng).toFixed(4)}_${lang.slice(0, 2)}`;
}

/**
 * Synchronously retrieves a cached reverse-geocode result if available in memory or localStorage.
 */
export function getCachedGeocode(lat: number, lng: number, lang: string = "en"): GeocodeResult | null {
  if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const key = getCacheKey(lat, lng, lang);
  if (memCache.has(key)) return memCache.get(key)!;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = localStorage.getItem(`rgc_${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          memCache.set(key, parsed);
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Reverse geocodes coordinates into city, district, street, and detailed address.
 * Supports language localization ("ar" or "en").
 * Queries Nominatim OpenStreetMap and BigDataCloud concurrently with deduplication and caching.
 */
export async function reverseGeocodeCoords(lat: number, lng: number, lang: string = "en"): Promise<GeocodeResult> {
  if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) {
    return {};
  }

  const cached = getCachedGeocode(lat, lng, lang);
  if (cached && (cached.city || cached.district)) {
    return cached;
  }

  const key = getCacheKey(lat, lng, lang);
  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }

  const promise = (async (): Promise<GeocodeResult> => {
    let bdc: GeocodeResult = {};
    let nom: GeocodeResult = {};
    const isAr = lang.startsWith("ar");
    const nomLang = isAr ? "ar,en" : "en";
    const bdcLang = isAr ? "ar" : "en";

    // Query Nominatim & BigDataCloud concurrently for fast and complete city/district resolution
    const [nomRes, bdcRes] = await Promise.allSettled([
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${nomLang}&addressdetails=1`,
        {
          headers: { "User-Agent": "HR-App reverse geocoding" },
          signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(4000) : undefined,
        },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => parseNominatim(j)),
      fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${bdcLang}`,
        {
          signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(3500) : undefined,
        },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => parseBDC(j)),
    ]);

    if (nomRes.status === "fulfilled" && nomRes.value) {
      nom = nomRes.value;
    }
    if (bdcRes.status === "fulfilled" && bdcRes.value) {
      bdc = bdcRes.value;
    }

    const city = nom.city || bdc.city;
    const rawDistrict = nom.district || bdc.district;
    const district = isDistinct(rawDistrict, city) ? rawDistrict : undefined;
    const detailedAddress = nom.detailedAddress || bdc.detailedAddress || nom.street || bdc.street;
    const street = detailedAddress || nom.street || bdc.street;

    const formatted = formatLocationParts(street, district, city);

    const result: GeocodeResult = {
      city,
      district,
      street,
      detailedAddress,
      formatted: formatted || undefined,
    };

    if (result.city || result.district) {
      memCache.set(key, result);
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(`rgc_${key}`, JSON.stringify(result));
        } catch {}
      }
    }

    return result;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}
