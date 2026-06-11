import { NextRequest, NextResponse } from 'next/server';

const TASHKENT_BBOX = '69.1200,41.1900~69.4200,41.4200';

export async function GET(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Yandex Maps API key is not configured.' }, { status: 503 });
  }

  const query = request.nextUrl.searchParams.get('query')?.trim();
  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  const isReverse = Number.isFinite(lat) && Number.isFinite(lng);

  if (!query && !isReverse) {
    return NextResponse.json({ error: 'A search query or coordinates are required.' }, { status: 400 });
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
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Yandex Geocoder rejected the request.' }, { status: 502 });
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: 'Could not reach Yandex Geocoder.' }, { status: 502 });
  }
}
