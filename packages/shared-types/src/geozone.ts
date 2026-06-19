export type GeoPoint = {
  lat: number;
  lng: number;
};

export type GeozoneStatus = 'active' | 'inactive' | 'archived';

export type DeliveryGeozone = {
  id: string;
  name: string;
  status: GeozoneStatus;
  color?: string;
  polygon: GeoPoint[];
  branchIds?: string[];
  deliveryFee?: number;
  minOrder?: number;
  freeDeliveryThreshold?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  archivedAt?: unknown;
};

export function isValidGeoPoint(point: unknown): point is GeoPoint {
  if (!point || typeof point !== 'object') return false;
  const lat = Number((point as GeoPoint).lat);
  const lng = Number((point as GeoPoint).lng);
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && lat !== 0
    && lng !== 0;
}

export function normalizeGeoPoint(point: unknown): GeoPoint | null {
  if (!point || typeof point !== 'object') return null;
  const lat = Number((point as GeoPoint).lat ?? (point as { latitude?: number }).latitude);
  const lng = Number((point as GeoPoint).lng ?? (point as { longitude?: number }).longitude);
  const normalized = { lat, lng };
  return isValidGeoPoint(normalized) ? normalized : null;
}

export function validatePolygon(points: unknown[]): { ok: true; polygon: GeoPoint[] } | { ok: false; error: string } {
  if (!Array.isArray(points)) return { ok: false, error: 'Polygon must be an array of points.' };
  const polygon = points.map(normalizeGeoPoint).filter(Boolean) as GeoPoint[];
  if (polygon.length < 3) return { ok: false, error: 'Polygon must contain at least 3 valid points.' };
  return { ok: true, polygon };
}

export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]) {
  if (!isValidGeoPoint(point) || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }

  return inside;
}
