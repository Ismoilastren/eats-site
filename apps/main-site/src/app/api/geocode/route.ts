import { NextRequest, NextResponse } from 'next/server';

const TASHKENT_BBOX = '69.1200,41.1900~69.4200,41.4200';
const REVERSE_KINDS = [undefined, 'house', 'street', 'district', 'locality'] as const;

type YandexGeoObject = {
  name?: string;
  description?: string;
  Point?: { pos?: string };
  metaDataProperty?: { GeocoderMetaData?: { text?: string } };
};

type OpenStreetMapReverseResponse = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

function geocoderErrorMessage(code: string) {
  switch (code) {
    case 'YANDEX_GEOCODER_API_KEY_MISSING':
      return 'Yandex geocoder is not configured on the server.';
    case 'YANDEX_GEOCODER_FORBIDDEN':
      return 'Yandex geocoder key is rejected. Check Vercel YANDEX_GEOCODER_API_KEY restrictions.';
    case 'YANDEX_GEOCODER_TIMEOUT':
      return 'Yandex geocoder timed out.';
    case 'INVALID_COORDINATES':
      return 'Valid coordinates are required.';
    case 'ADDRESS_NOT_RESOLVED':
      return 'Address not resolved';
    default:
      return 'Yandex geocoder is temporarily unavailable.';
  }
}

function cleanAddress(value?: string | null) {
  const address = String(value || '').trim();
  if (address.length < 6) return '';
  if (/^(unknown location|map location|selected point|address could not be resolved|order delivery)$/i.test(address)) return '';
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) return '';
  return address;
}

function parseYandexGeoObject(geoObject?: YandexGeoObject) {
  if (!geoObject?.Point?.pos) return null;
  const [lng, lat] = geoObject.Point.pos.split(' ').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const metadataAddress = cleanAddress(geoObject.metaDataProperty?.GeocoderMetaData?.text);
  const title = cleanAddress(geoObject.name);
  const subtitle = String(geoObject.description || '').trim();
  const address = metadataAddress || cleanAddress([title, subtitle].filter(Boolean).join(', '));
  if (!address) return null;

  return {
    address,
    lat,
    lng,
    title: title || address,
    subtitle,
    source: 'yandex-geocoder',
  };
}

function parseYandexResponse(payload: any) {
  const members = payload?.response?.GeoObjectCollection?.featureMember || [];
  return members
    .map((item: { GeoObject?: YandexGeoObject }) => parseYandexGeoObject(item.GeoObject))
    .filter(Boolean);
}

function errorResponse(code: string, status = 502) {
  return NextResponse.json({
    ok: false,
    error: geocoderErrorMessage(code),
    errorCode: code,
  }, { status });
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function buildYandexParams({
  apiKey,
  query,
  lat,
  lng,
  reverseKind,
}: {
  apiKey: string;
  query: string;
  lat?: number;
  lng?: number;
  reverseKind?: typeof REVERSE_KINDS[number];
}) {
  const isReverse = typeof lat === 'number' && typeof lng === 'number';
  const params = new URLSearchParams({
    apikey: apiKey,
    format: 'json',
    lang: 'en_US',
    geocode: isReverse ? `${lng},${lat}` : `${query}, Tashkent`,
    results: isReverse ? '1' : '5',
  });

  if (isReverse) {
    params.set('sco', 'longlat');
    if (reverseKind) params.set('kind', reverseKind);
  } else {
    params.set('bbox', TASHKENT_BBOX);
    params.set('rspn', '1');
  }

  return params;
}

async function requestYandex(params: URLSearchParams) {
  const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params.toString()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    return {
      response,
      results: [],
    };
  }

  const data = await response.json();
  return {
    response,
    results: parseYandexResponse(data),
  };
}

async function requestOpenStreetMapReverse(lat: number, lng: number) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'en',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ExpressEats/1.0 (https://eats-site-main-site.vercel.app)',
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) return null;
  const data = await response.json() as OpenStreetMapReverseResponse;
  const address = cleanAddress(data.display_name);
  if (!address) return null;

  return {
    address,
    lat,
    lng,
    source: 'openstreetmap-fallback',
  };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  const query = (
    request.nextUrl.searchParams.get('q') ||
    request.nextUrl.searchParams.get('query') ||
    ''
  ).trim();
  const latParam = request.nextUrl.searchParams.get('lat');
  const lngParam = request.nextUrl.searchParams.get('lng');
  const hasCoordinates = Boolean(latParam?.trim() && lngParam?.trim());
  const lat = hasCoordinates ? Number(latParam) : NaN;
  const lng = hasCoordinates ? Number(lngParam) : NaN;
  const isReverse = hasCoordinates && isValidLatitude(lat) && isValidLongitude(lng);

  if (hasCoordinates && !isReverse) {
    return errorResponse('INVALID_COORDINATES', 400);
  }

  if (!query && !isReverse) {
    return NextResponse.json({
      ok: false,
      error: 'A search query or coordinates are required.',
      errorCode: 'QUERY_OR_COORDINATES_REQUIRED',
    }, { status: 400 });
  }

  if (!apiKey) {
    if (isReverse) {
      const fallbackResult = await requestOpenStreetMapReverse(lat, lng).catch(() => null);
      if (fallbackResult) {
        return NextResponse.json({
          ok: true,
          ...fallbackResult,
        });
      }
    }
    return errorResponse('YANDEX_GEOCODER_API_KEY_MISSING', 503);
  }

  try {
    if (isReverse) {
      let rejectedStatus: number | null = null;
      for (const reverseKind of REVERSE_KINDS) {
        const params = buildYandexParams({ apiKey, query, lat, lng, reverseKind });
        const { response, results } = await requestYandex(params);

        if (!response.ok) {
          rejectedStatus = response.status;
          break;
        }

        const result = results[0];
        if (result) {
          return NextResponse.json({
            ok: true,
            address: result.address,
            lat: result.lat,
            lng: result.lng,
            source: result.source,
          });
        }
      }

      const fallbackResult = await requestOpenStreetMapReverse(lat, lng).catch(() => null);
      if (fallbackResult) {
        return NextResponse.json({
          ok: true,
          ...fallbackResult,
        });
      }

      if (rejectedStatus !== null) {
        return errorResponse(
          rejectedStatus === 403 ? 'YANDEX_GEOCODER_FORBIDDEN' : 'YANDEX_GEOCODER_REJECTED',
          rejectedStatus === 403 ? 403 : 502,
        );
      }

      console.warn('Yandex reverse geocode returned no address', {
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
      });

      return errorResponse('ADDRESS_NOT_RESOLVED', 404);
    }

    const params = buildYandexParams({ apiKey, query });
    const { response, results } = await requestYandex(params);

    if (!response.ok) {
      return errorResponse(
        response.status === 403 ? 'YANDEX_GEOCODER_FORBIDDEN' : 'YANDEX_GEOCODER_REJECTED',
        response.status === 403 ? 403 : 502,
      );
    }

    return NextResponse.json({
      ok: true,
      results,
      source: 'yandex-geocoder',
    });
  } catch (error) {
    return errorResponse(
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'YANDEX_GEOCODER_TIMEOUT'
        : 'YANDEX_GEOCODER_UNAVAILABLE',
      502,
    );
  }
}
