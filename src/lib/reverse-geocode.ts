export type GeocodeResult = {
  city?: string;
  district?: string;
  street?: string;
  formatted?: string;
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
  const street = [cleanText(addr.house_number), cleanText(addr.road)].filter(Boolean).join(" ") || cleanText(addr.road);

  return {
    city: city || undefined,
    district: cleanText(district) || undefined,
    street: street || undefined,
  };
}

/**
 * Reverse geocodes coordinates into city, district, and street.
 * Queries BigDataCloud and falls back to / enriches with Nominatim OpenStreetMap.
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<GeocodeResult> {
  let bdc: GeocodeResult = {};
  let nom: GeocodeResult = {};

  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(4000) : undefined },
    );
    if (r.ok) {
      bdc = parseBDC(await r.json());
    }
  } catch {
    // ignore and continue to Nominatim
  }

  // If district or street or city is missing, query Nominatim
  if (!bdc.district || !bdc.street || !bdc.city) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en&addressdetails=1`,
        {
          headers: { "User-Agent": "HR-App reverse geocoding" },
          signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(4000) : undefined,
        },
      );
      if (r.ok) {
        nom = parseNominatim(await r.json());
      }
    } catch {
      // ignore
    }
  }

  const city = bdc.city || nom.city;
  const rawDistrict = bdc.district || nom.district;
  const district = isDistinct(rawDistrict, city) ? rawDistrict : undefined;
  const street = nom.street || bdc.street;

  const formatted = formatLocationParts(street, district, city);

  return {
    city,
    district,
    street,
    formatted: formatted || undefined,
  };
}
