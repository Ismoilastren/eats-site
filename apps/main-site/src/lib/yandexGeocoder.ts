'use client';

import { TASHKENT_CENTER } from './yandexMaps';

export type GeocodeResult = {
  title: string;
  address: string;
  lat: number;
  lng: number;
};

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

const cache = new Map<string, GeocodeResult[]>();

function apiKey() {
  return process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || '';
}

function parseResult(geoObject?: YandexGeoObject): GeocodeResult | null {
  const [lng, lat] = (geoObject?.Point?.pos || '').split(' ').map(Number);
  if (!geoObject?.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const description = geoObject.description || 'Tashkent';
  const address = `${geoObject.name}${description.toLowerCase().includes('tashkent') ? ', Tashkent' : ''}`;
  return {
    title: geoObject.name,
    address,
    lat,
    lng,
  };
}

async function requestGeocoder(params: URLSearchParams, cacheKey: string) {
  if (!apiKey()) return [];
  if (cache.has(cacheKey)) return cache.get(cacheKey) || [];

  try {
    const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params.toString()}`);
    if (!response.ok) return [];
    const data = await response.json() as YandexGeocoderResponse;
    const results = (data.response?.GeoObjectCollection?.featureMember || [])
      .map((item) => parseResult(item.GeoObject))
      .filter((item): item is GeocodeResult => Boolean(item));
    cache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const normalized = query.trim();
  if (normalized.length < 3 || !apiKey()) return [];

  const params = new URLSearchParams({
    apikey: apiKey(),
    format: 'json',
    lang: 'en_US',
    geocode: `${normalized}, Tashkent`,
    bbox: '69.1200,41.1900~69.4200,41.4200',
    rspn: '1',
    results: '4',
  });

  return requestGeocoder(params, `search:${normalized.toLowerCase()}`);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (!apiKey()) return null;

  const params = new URLSearchParams({
    apikey: apiKey(),
    format: 'json',
    lang: 'en_US',
    geocode: `${lng},${lat}`,
    results: '1',
  });

  const results = await requestGeocoder(params, `reverse:${lat.toFixed(5)},${lng.toFixed(5)}`);
  return results[0] || {
    title: 'Selected point',
    address: 'Selected point, Tashkent',
    lat: lat || TASHKENT_CENTER.lat,
    lng: lng || TASHKENT_CENTER.lng,
  };
}
