export type AddressSource = 'manual' | 'current_location' | 'map' | 'geocode';

export type CanonicalSavedAddress = {
  id: string;
  userId: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  source: AddressSource;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GeocodeAddressResult = {
  address: string;
  lat: number;
  lng: number;
  title?: string;
  subtitle?: string;
};

type YandexGeoObject = {
  name?: string;
  description?: string;
  Point?: { pos?: string };
  metaDataProperty?: { GeocoderMetaData?: { text?: string } };
};

const INVALID_ADDRESS_PATTERN =
  /^(unknown location|map location|selected point|address could not be resolved|map is unavailable|enter readable address|current gps location|order delivery|move map to location|selected address)$/i;

export const DEFAULT_MAP_CENTER = { latitude: 41.2995, longitude: 69.2401 };

export function publicApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '';
}

export function publicYandexMapsApiKey() {
  return process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY?.trim() || '';
}

export function missingApiBaseUrlMessage() {
  return 'Address lookup is not configured. Set EXPO_PUBLIC_API_BASE_URL and restart the app.';
}

export function missingYandexMapsKeyMessage() {
  return 'Yandex Maps is not configured. Set EXPO_PUBLIC_YANDEX_MAPS_API_KEY and restart the app.';
}

export function isReadableAddress(value?: string | null) {
  const address = String(value || '').trim();
  if (address.length < 6) return false;
  if (INVALID_ADDRESS_PATTERN.test(address)) return false;
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) return false;
  return true;
}

export function coordinateFromAddress(address: Partial<CanonicalSavedAddress> & { latitude?: number; longitude?: number }) {
  const lat = Number(address.lat ?? address.latitude);
  const lng = Number(address.lng ?? address.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function canonicalAddressForStorage(
  address: Partial<CanonicalSavedAddress> & { id?: string; latitude?: number; longitude?: number },
  fallbackUserId: string,
  fallbackNow: string,
) {
  const coords = coordinateFromAddress(address);
  const cleanAddress = String(address.address || '').trim();
  if (!coords || !isReadableAddress(cleanAddress)) return null;

  const source = address.source && ['manual', 'current_location', 'map', 'geocode'].includes(address.source)
    ? address.source
    : 'manual';

  return {
    ...(address.id ? { id: address.id } : {}),
    userId: address.userId || fallbackUserId,
    label: String(address.label || 'Address').trim() || 'Address',
    address: cleanAddress,
    lat: coords.lat,
    lng: coords.lng,
    source,
    isDefault: Boolean(address.isDefault),
    createdAt: String(address.createdAt || fallbackNow),
    updatedAt: String(address.updatedAt || fallbackNow),
  };
}

function parseGeoObject(geoObject?: YandexGeoObject): GeocodeAddressResult | null {
  if (!geoObject?.Point?.pos) return null;
  const [lng, lat] = geoObject.Point.pos.split(' ').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const metadataText = geoObject.metaDataProperty?.GeocoderMetaData?.text?.trim();
  const title = geoObject.name?.trim();
  const subtitle = geoObject.description?.trim();
  const address = metadataText || [title, subtitle].filter(Boolean).join(', ');

  if (!isReadableAddress(address)) return null;
  return { address, lat, lng, title, subtitle };
}

function parseGeocodePayload(payload: unknown): GeocodeAddressResult[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as {
    ok?: boolean;
    address?: unknown;
    formattedAddress?: unknown;
    lat?: unknown;
    lng?: unknown;
    results?: {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{ GeoObject?: YandexGeoObject }>;
        };
      };
    };
  };

  const members = data.results?.response?.GeoObjectCollection?.featureMember || [];
  const parsed = members
    .map((item) => parseGeoObject(item.GeoObject))
    .filter((item): item is GeocodeAddressResult => Boolean(item));

  if (parsed.length > 0) return parsed;

  const directAddress =
    typeof data.address === 'string'
      ? data.address.trim()
      : typeof data.formattedAddress === 'string'
        ? data.formattedAddress.trim()
        : '';
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (isReadableAddress(directAddress) && Number.isFinite(lat) && Number.isFinite(lng)) {
    return [{ address: directAddress, lat, lng }];
  }

  return [];
}

async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal as any });
  } finally {
    clearTimeout(timeout);
  }
}

export async function reverseGeocodeViaProxy(lat: number, lng: number) {
  const baseUrl = publicApiBaseUrl();
  if (!baseUrl) return { result: null, error: missingApiBaseUrlMessage() };

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    );
    const payload: unknown = await response.json();
    if (!response.ok) return { result: null, error: 'Address lookup is temporarily unavailable.' };
    const result = parseGeocodePayload(payload)[0] || null;
    return { result, error: result ? null : 'Yandex did not return a readable street address.' };
  } catch {
    return { result: null, error: 'Could not reach address lookup. Check connection and try again.' };
  }
}

export async function geocodeQueryViaProxy(query: string) {
  const normalized = query.trim();
  if (normalized.length < 3) return { results: [], error: 'Enter at least 3 characters to search.' };

  const baseUrl = publicApiBaseUrl();
  if (!baseUrl) return { results: [], error: missingApiBaseUrlMessage() };

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/geocode?query=${encodeURIComponent(normalized)}`,
    );
    const payload: unknown = await response.json();
    if (!response.ok) return { results: [], error: 'Address search is temporarily unavailable.' };
    const results = parseGeocodePayload(payload);
    return { results, error: results.length > 0 ? null : 'No readable address found.' };
  } catch {
    return { results: [], error: 'Could not reach address search. Check connection and try again.' };
  }
}
