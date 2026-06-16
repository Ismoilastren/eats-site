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
let lastError: { message: string; code: string } | null = null;

export function getLastGeocoderError() {
  return lastError;
}

function geocoderErrorMessage(code: string) {
  switch (code) {
    case 'YANDEX_GEOCODER_API_KEY_MISSING':
      return 'Automatic address lookup is not configured.';
    case 'YANDEX_GEOCODER_FORBIDDEN':
      return 'Automatic address lookup is not enabled for this key.';
    case 'YANDEX_GEOCODER_TIMEOUT':
      return 'Automatic address lookup took too long.';
    case 'YANDEX_GEOCODER_UNAVAILABLE':
      return 'Automatic address lookup is temporarily unavailable.';
    default:
      return 'Automatic address lookup could not resolve this address.';
  }
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
  // Return cached results (only set for successful non-empty responses)
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const response = await fetch(path);
    const json = await response.json();

    if (!response.ok || !json.ok) {
      const code = String(json.errorCode || json.error || 'YANDEX_GEOCODER_REJECTED');
      lastError = {
        message: geocoderErrorMessage(code),
        code,
      };
      return [];
    }

    const data = json.results as YandexGeocoderResponse;
    const results = (data.response?.GeoObjectCollection?.featureMember || [])
      .map((item) => parseResult(item.GeoObject))
      .filter((item): item is AddressResult => Boolean(item));

    // FIX: Only cache non-empty results so failed lookups can be retried
    if (results.length > 0) {
      cache.set(cacheKey, results);
      lastError = null;
    } else {
      lastError = {
        message: 'Yandex Geocoder did not return a readable address.',
        code: 'ADDRESS_NOT_RESOLVED',
      };
    }

    return results;
  } catch {
    lastError = {
      message: 'Could not reach the geocoder endpoint.',
      code: 'YANDEX_GEOCODER_UNAVAILABLE',
    };
    return [];
  }
}

export async function geocodeAddress(query: string): Promise<AddressResult[]> {
  const normalized = query.trim();
  if (normalized.length < 3) return [];

  return requestGeocoder(
    `/api/geocode?query=${encodeURIComponent(normalized)}`,
    `search:${normalized.toLowerCase()}`,
  );
}

export async function reverseGeocode(lat: number, lng: number): Promise<AddressResult | null> {


  const results = await requestGeocoder(
    `/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`,
  );
  return results[0] ?? null;
}
