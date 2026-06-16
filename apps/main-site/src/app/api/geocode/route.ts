import { NextRequest, NextResponse } from 'next/server';

const TASHKENT_BBOX = '69.1200,41.1900~69.4200,41.4200';

export async function GET(request: NextRequest) {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      results: [],
      error: 'Yandex Geocoder API key is not configured.',
      errorCode: 'YANDEX_GEOCODER_API_KEY_MISSING',
    }, { status: 503 });
  }

  const query = request.nextUrl.searchParams.get('query')?.trim();
  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  const isReverse = Number.isFinite(lat) && Number.isFinite(lng);

  if (!query && !isReverse) {
    return NextResponse.json({ ok: false, results: [], error: 'A search query or coordinates are required.' }, { status: 400 });
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    format: 'json',
    lang: 'en_US',
    geocode: isReverse ? `${lng},${lat}` : `${query}, Tashkent`,
    results: isReverse ? '1' : '5',
  });

  if (!isReverse) {
    params.set('bbox', TASHKENT_BBOX);
    params.set('rspn', '1');
  }

  try {
    const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        results: [],
        error: response.status === 403
          ? 'Yandex Geocoder HTTP API is not enabled or the server key is not authorized.'
          : 'Yandex Geocoder rejected the request.',
        errorCode: response.status === 403 ? 'YANDEX_GEOCODER_FORBIDDEN' : 'YANDEX_GEOCODER_REJECTED',
      }, { status: response.status === 403 ? 403 : 502 });
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, results: data });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      results: [],
      error: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'Yandex Geocoder request timed out.'
        : 'Could not reach Yandex Geocoder.',
      errorCode: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'YANDEX_GEOCODER_TIMEOUT'
        : 'YANDEX_GEOCODER_UNAVAILABLE',
    }, { status: 502 });
  }
}
