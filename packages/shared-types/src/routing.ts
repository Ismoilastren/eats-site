import { isValidGeoPoint, type GeoPoint } from './geozone';

export type RouteMode = 'driving';
export type RouteSource = 'real_route' | 'fallback_preview';

export type RouteRequest = {
  restaurant: GeoPoint;
  customer: GeoPoint;
  courier?: GeoPoint | null;
  mode?: RouteMode;
};

export type RouteResult = {
  geometry: GeoPoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  source: RouteSource;
  error?: string;
};

const TASHKENT_BOUNDS = {
  minLat: 40.95,
  maxLat: 41.55,
  minLng: 68.85,
  maxLng: 69.65,
};

export function isLikelyTashkentPoint(point: GeoPoint) {
  return isValidGeoPoint(point)
    && point.lat >= TASHKENT_BOUNDS.minLat
    && point.lat <= TASHKENT_BOUNDS.maxLat
    && point.lng >= TASHKENT_BOUNDS.minLng
    && point.lng <= TASHKENT_BOUNDS.maxLng;
}

export function normalizeRoutePoint(point: unknown): GeoPoint | null {
  if (!point || typeof point !== 'object') return null;
  const lat = Number((point as GeoPoint).lat ?? (point as { latitude?: number }).latitude);
  const lng = Number((point as GeoPoint).lng ?? (point as { longitude?: number }).longitude);
  const direct = { lat, lng };
  if (isLikelyTashkentPoint(direct)) return direct;

  const swapped = { lat: lng, lng: lat };
  if (isLikelyTashkentPoint(swapped)) return swapped;

  return isValidGeoPoint(direct) ? direct : null;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const radius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

export function buildFallbackRoute(request: RouteRequest): RouteResult {
  const geometry = [request.courier, request.restaurant, request.customer]
    .filter(Boolean)
    .filter(isValidGeoPoint) as GeoPoint[];
  const distanceMeters = geometry.length >= 2
    ? geometry.slice(1).reduce((sum, point, index) => sum + haversineMeters(geometry[index], point), 0)
    : null;

  return {
    geometry,
    distanceMeters,
    durationSeconds: distanceMeters ? Math.round((distanceMeters / 1000 / 28) * 3600) : null,
    source: 'fallback_preview',
    error: 'Real routing service is not configured. Showing validated point-to-point preview only.',
  };
}
