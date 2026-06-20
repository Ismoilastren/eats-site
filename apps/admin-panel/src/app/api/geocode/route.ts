import { NextRequest, NextResponse } from 'next/server';

type ReverseLookupResult = {
  address: string;
  provider: 'yandex' | 'nominatim';
  raw: unknown;
};

type ReverseLookupError = {
  error: string;
  errorCode: string;
  status: number;
};

type NominatimResponse = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function cleanPart(value?: string | null) {
  return String(value || '').trim();
}

function uniqueParts(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return parts
    .map(cleanPart)
    .filter((part) => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildNominatimAddress(data: NominatimResponse) {
  const address = data.address || {};
  const road = cleanPart(address.road || address.pedestrian || address.footway || address.path);
  const house = cleanPart(address.house_number);
  const streetAddress = [road, house].filter(Boolean).join(' ');
  const district = cleanPart(address.suburb || address.neighbourhood || address.city_district || address.district);
  const city = cleanPart(address.city || address.town || address.village || 'Tashkent');
  const state = cleanPart(address.state);
  const displayFallback = cleanPart(data.display_name)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);

  const parts = uniqueParts([streetAddress, district, city, state]);
  return parts.length >= 2 ? parts.join(', ') : displayFallback.join(', ');
}

async function reverseWithNominatim(lat: number, lng: number): Promise<ReverseLookupResult | ReverseLookupError> {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      addressdetails: '1',
      namedetails: '1',
      'accept-language': 'en',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': '2(13) Delivery Admin address resolver',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      return {
        error: 'NOMINATIM_REJECTED',
        errorCode: 'NOMINATIM_REJECTED',
        status: 502,
      };
    }

    const data = await response.json() as NominatimResponse;
    const address = buildNominatimAddress(data);
    if (!address) {
      return {
        error: 'ADDRESS_NOT_RESOLVED',
        errorCode: 'ADDRESS_NOT_RESOLVED',
        status: 502,
      };
    }

    return { address, provider: 'nominatim', raw: data };
  } catch (error) {
    return {
      error: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'NOMINATIM_TIMEOUT'
        : 'NOMINATIM_UNAVAILABLE',
      errorCode: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'NOMINATIM_TIMEOUT'
        : 'NOMINATIM_UNAVAILABLE',
      status: 502,
    };
  }
}

async function reverseWithYandex(apiKey: string, lat: number, lng: number): Promise<ReverseLookupResult | ReverseLookupError> {
  const params = new URLSearchParams({
    apikey: apiKey,
    format: 'json',
    lang: 'en_US',
    geocode: `${lng},${lat}`,
    results: '1',
  });

  try {
    const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      return {
        error: response.status === 403 ? 'YANDEX_GEOCODER_FORBIDDEN' : 'YANDEX_GEOCODER_REJECTED',
        errorCode: response.status === 403 ? 'YANDEX_GEOCODER_FORBIDDEN' : 'YANDEX_GEOCODER_REJECTED',
        status: response.status === 403 ? 403 : 502,
      };
    }

    return { address: '', provider: 'yandex', raw: await response.json() };
  } catch (error) {
    return {
      error: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'YANDEX_GEOCODER_TIMEOUT'
        : 'YANDEX_GEOCODER_UNAVAILABLE',
      errorCode: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'YANDEX_GEOCODER_TIMEOUT'
        : 'YANDEX_GEOCODER_UNAVAILABLE',
      status: 502,
    };
  }
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  const latParam = request.nextUrl.searchParams.get('lat');
  const lngParam = request.nextUrl.searchParams.get('lng');
  const hasCoordinates = Boolean(latParam?.trim() && lngParam?.trim());
  const lat = hasCoordinates ? Number(latParam) : NaN;
  const lng = hasCoordinates ? Number(lngParam) : NaN;
  if (!hasCoordinates || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({
      ok: false,
      results: [],
      error: 'Valid coordinates are required.',
      errorCode: 'INVALID_COORDINATES',
    }, { status: 400 });
  }

  const yandexResult = apiKey ? await reverseWithYandex(apiKey, lat, lng) : null;
  if (yandexResult && 'raw' in yandexResult) {
    return NextResponse.json({ ok: true, provider: yandexResult.provider, results: yandexResult.raw });
  }

  const fallbackResult = await reverseWithNominatim(lat, lng);
  if ('raw' in fallbackResult) {
    return NextResponse.json({
      ok: true,
      provider: fallbackResult.provider,
      address: fallbackResult.address,
      coordinates: { lat, lng },
      yandexError: yandexResult && 'errorCode' in yandexResult ? yandexResult.errorCode : apiKey ? undefined : 'YANDEX_GEOCODER_API_KEY_MISSING',
      results: fallbackResult.raw,
    });
  }

  const primaryError = yandexResult && 'errorCode' in yandexResult
    ? yandexResult
    : {
        error: 'YANDEX_GEOCODER_API_KEY_MISSING',
        errorCode: 'YANDEX_GEOCODER_API_KEY_MISSING',
        status: 503,
      };

  return NextResponse.json({
    ok: false,
    results: [],
    error: primaryError.error,
    errorCode: primaryError.errorCode,
    fallbackError: fallbackResult.errorCode,
  }, { status: primaryError.status });
}
