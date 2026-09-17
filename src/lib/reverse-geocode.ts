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
  const subdivision = cleanText(j.principalSubdivision);
  const adminList: any[] = Array.isArray(j.localityInfo?.administrative) ? j.localityInfo.administrative : [];
  const infoList: any[] = Array.isArray(j.localityInfo?.informative) ? j.localityInfo.informative : [];

  const city =
    cleanText(j.city) ||
    cleanText(adminList.find((a) => a.adminLevel === 4)?.name) ||
    subdivision ||
    "";

  // 1. Check administrative levels >= 6
  let district = adminList.find((a) => a.adminLevel >= 6 && isDistinct(a.name, city, subdivision, country))?.name;

  // 2. Check locality (very common in Egypt e.g. "Al Umraniyah", "Dokki", "Madinat an Nasr")
  if (!district && isDistinct(j.locality, city, subdivision, country)) {
    district = cleanText(j.locality);
  }

  // 3. Check informative entries describing district, suburb, neighborhood, kism, markaz, quarter
  if (!district) {
    const infoMatch = infoList.find(
      (i) =>
        /(district|suburb|neighborhood|neighbourhood|area|quarter|kism|markaz)/i.test(i.description ?? "") &&
        isDistinct(i.name, city, subdivision, country),
    );
    if (infoMatch) district = cleanText(infoMatch.name);
  }

  // 4. Check informative entries with order >= 4 that are distinct
  if (!district) {
    const infoMatch = infoList.find((i) => (i.order ?? 0) >= 4 && isDistinct(i.name, city, subdivision, country));
    if (infoMatch) district = cleanText(infoMatch.name);
  }

  const street = [cleanText(j.streetNumber), cleanText(j.streetName)].filter(Boolean).join(" ");

  return {
    city: city || undefined,
    district: district || undefined,
    street: street || undefined,
    detailedAddress: street || undefined,
  };
}

function parseNominatim(j: any): GeocodeResult {
  if (!j || !j.address) return {};
  const addr = j.address;
  const city = cleanText(addr.city || addr.town || addr.state || addr.county || "");

  const districtCandidates = [
    addr.city_district,
    addr.suburb,
    addr.quarter,
    addr.neighbourhood,
    addr.district,
    addr.borough,
    addr.village,
  ];

  const district = districtCandidates.find((d) => isDistinct(d, city));

  const landmark = cleanText(addr.amenity || addr.building || addr.shop || addr.office || addr.tourism || addr.leisure || "");
  const streetWithNumber = [cleanText(addr.house_number), cleanText(addr.road)].filter(Boolean).join(" ") || cleanText(addr.road);
  const area = cleanText(addr.neighbourhood || addr.suburb || addr.quarter || "");

  const detailedParts = [landmark, streetWithNumber, area].filter(Boolean);
  const detailedAddress = detailedParts.join(", ") || streetWithNumber || cleanText(j.display_name);

  return {
    city: city || undefined,
    district: cleanText(district) || undefined,
    street: detailedAddress || streetWithNumber || undefined,
    detailedAddress: detailedAddress || undefined,
  };
}

/**
 * Reverse geocodes coordinates into city, district, street, and detailed address.
 * Supports language localization ("ar" or "en").
 * Queries Nominatim OpenStreetMap enriched with BigDataCloud.
 */
export async function reverseGeocodeCoords(lat: number, lng: number, lang: string = "en"): Promise<GeocodeResult> {
  let bdc: GeocodeResult = {};
  let nom: GeocodeResult = {};
  const isAr = lang.startsWith("ar");
  const nomLang = isAr ? "ar,en" : "en";
  const bdcLang = isAr ? "ar" : "en";

  // 1. Query Nominatim for detailed street, house number, landmark & neighbourhood
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${nomLang}&addressdetails=1`,
      {
        headers: { "User-Agent": "HR-App reverse geocoding" },
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(5000) : undefined,
      },
    );
    if (r.ok) {
      nom = parseNominatim(await r.json());
    }
  } catch {
    // ignore and continue
  }

  // 2. Query BigDataCloud as fallback / supplement if city or district is missing
  if (!nom.city || !nom.district || !nom.detailedAddress) {
    try {
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${bdcLang}`,
        { signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(4000) : undefined },
      );
      if (r.ok) {
        bdc = parseBDC(await r.json());
      }
    } catch {
      // ignore
    }
  }

  const city = nom.city || bdc.city;
  const rawDistrict = nom.district || bdc.district;
  const district = isDistinct(rawDistrict, city) ? rawDistrict : undefined;
  const detailedAddress = nom.detailedAddress || bdc.detailedAddress || nom.street || bdc.street;
  const street = detailedAddress || nom.street || bdc.street;

  const formatted = formatLocationParts(street, district, city);

  return {
    city,
    district,
    street,
    detailedAddress,
    formatted: formatted || undefined,
  };
}
