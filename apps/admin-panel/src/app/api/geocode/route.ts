import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      results: [],
      error: 'Yandex Geocoder API key is not configured.',
      errorCode: 'YANDEX_GEOCODER_KEY_MISSING',
    }, { status: 503 });
  }

  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({
      ok: false,
      results: [],
      error: 'Valid coordinates are required.',
      errorCode: 'INVALID_COORDINATES',
    }, { status: 400 });
  }

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

    return NextResponse.json({ ok: true, results: await response.json() });
  } catch {
    return NextResponse.json({
      ok: false,
      results: [],
      error: 'Could not reach Yandex Geocoder.',
      errorCode: 'YANDEX_GEOCODER_UNAVAILABLE',
    }, { status: 502 });
  }
}
