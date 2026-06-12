'use client';

export type AddressResult = {
  title: string;
  subtitle: string;
  fullAddress: string;
  lat: number;
  lng: number;
};

export type GeocodeResult = AddressResult;

type YandexGeocoderResponse = {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          name?: string;
          description?: string;
          Point?: { pos?: string };
          metaDataProperty?: { GeocoderMetaData?: { text?: string } };
        };
      }>;
    };
  };
};

type YandexGeoObject = {
  name?: string;
  description?: string;
  Point?: { pos?: string };
  metaDataProperty?: { GeocoderMetaData?: { text?: string } };
};

// Only cache successful (non-empty) results to allow retries on failure.
const cache = new Map<string, AddressResult[]>();

function apiKey() {
  return process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || '';
}

function parseResult(geoObject?: YandexGeoObject): AddressResult | null {
  if (!geoObject?.Point?.pos) return null;
  // Yandex geocoder returns coordinates as "lng lat" (longitude first)
  const parts = geoObject.Point.pos.split(' ').map(Number);
  const lng = parts[0];
  const lat = parts[1];
  if (!geoObject.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const metadataAddress = geoObject.metaDataProperty?.GeocoderMetaData?.text?.trim();
  const description = geoObject.description?.trim() || 'Tashkent';
  const fullAddress = metadataAddress || `${geoObject.name}, ${description}`;

  return {
    title: geoObject.name,
    subtitle: description,
    fullAddress,
    lat,
    lng,
  };
}

async function requestGeocoder(path: string, cacheKey: string): Promise<AddressResult[]> {
  if (!apiKey()) return [];

  // Return cached results (only set for successful non-empty responses)
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const response = await fetch(path);
    if (!response.ok) return [];

    const data = await response.json() as YandexGeocoderResponse;
    const results = (data.response?.GeoObjectCollection?.featureMember || [])
      .map((item) => parseResult(item.GeoObject))
      .filter((item): item is AddressResult => Boolean(item));

    // FIX: Only cache non-empty results so failed lookups can be retried
    if (results.length > 0) {
      cache.set(cacheKey, results);
    }

    return results;
  } catch {
    return [];
  }
}

export async function geocodeAddress(query: string): Promise<AddressResult[]> {
  const normalized = query.trim();
  if (normalized.length < 3 || !apiKey()) return [];

  return requestGeocoder(
    `/api/geocode?query=${encodeURIComponent(normalized)}`,
    `search:${normalized.toLowerCase()}`,
  );
}

export async function reverseGeocode(lat: number, lng: number): Promise<AddressResult | null> {
  if (!apiKey()) return null;

  const results = await requestGeocoder(
    `/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`,
  );
  return results[0] ?? null;
}
