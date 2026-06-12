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
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

export function isPlaceholderAddress(text?: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    lower.startsWith('selected point') ||
    lower.startsWith('near selected point') ||
    lower.startsWith('address not resolved') ||
    lower.startsWith('address could not be resolved') ||
    lower === 'current location' ||
    lower === 'unnamed road'
  );
}

export function isReadableAddress(text?: string): boolean {
  return !isPlaceholderAddress(text) && typeof text === 'string' && text.trim().length > 0;
}
