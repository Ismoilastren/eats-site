export type AppAddress = {
  address: string;
  lat?: number;
  lng?: number;
  label?: string;
  source?: "manual" | "map" | "geocode" | "current_location" | "popular" | "restaurant" | "admin" | "suggestion";
  city?: string;
  district?: string;
  entrance?: string;
  apartment?: string;
  notes?: string;
  updatedAt?: string;
};

export function isValidCoordinates(lat?: number, lng?: number): boolean {
  return typeof lat === 'number'
    && typeof lng === 'number'
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && lat !== 0
    && lng !== 0;
}

export function toYandexCoords(point: { lat: number; lng: number }): [number, number] {
  return [point.lng, point.lat];
}

export function fromYandexCoords(coords: [number, number]): { lat: number; lng: number } {
  return { lat: coords[1], lng: coords[0] };
}

export function isRawCoordinateAddress(text?: string): boolean {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return false;

  return /^(lat|lng|latitude|longitude)\s*:/i.test(trimmed)
    || /^-?\d{1,3}(?:\.\d+)?[,;\s]+-?\d{1,3}(?:\.\d+)?$/.test(trimmed);
}

export function isPlaceholderAddress(text?: string): boolean {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return (
    isRawCoordinateAddress(trimmed) ||
    lower.startsWith('selected point') ||
    lower.startsWith('near selected point') ||
    lower.startsWith('address not resolved') ||
    lower.startsWith('address could not be resolved') ||
    lower.startsWith('map point') ||
    lower === 'current location' ||
    lower === 'unnamed road'
  );
}

export function isReadableAddress(text?: string): boolean {
  return typeof text === 'string' && text.trim().length >= 3 && !isPlaceholderAddress(text);
}
