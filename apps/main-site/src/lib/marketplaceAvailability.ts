import type { Restaurant } from '@/data/marketplace';

export type DeliveryDateKey = 'today' | 'tomorrow';

export type DeliveryTimeSelection = {
  mode: 'now' | 'scheduled';
  day: DeliveryDateKey;
  time?: string;
  label: string;
};

export const DEFAULT_DELIVERY_TIME: DeliveryTimeSelection = {
  mode: 'now',
  day: 'today',
  label: 'Now',
};

export function buildTimeSlots() {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return slots;
}

export function formatDeliveryTimeLabel(selection: DeliveryTimeSelection) {
  if (selection.mode === 'now') return 'Now';
  const prefix = selection.day === 'tomorrow' ? 'Tomorrow' : 'Today';
  return `${prefix} ${selection.time || ''}`.trim();
}

function parseMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function targetMinutes(selection: DeliveryTimeSelection, now = new Date()) {
  if (selection.mode === 'now') return now.getHours() * 60 + now.getMinutes();
  return parseMinutes(selection.time || '') ?? now.getHours() * 60 + now.getMinutes();
}

export function isRestaurantAvailableAt(restaurant: Restaurant, selection: DeliveryTimeSelection, now = new Date()) {
  if (!restaurant.isOpen) return false;
  const raw = String(restaurant.workingHours || '').trim();
  if (!raw || /^24\s*\/\s*7$/i.test(raw) || /^all day$/i.test(raw)) return true;

  const [startRaw, endRaw] = raw.split('-').map((part) => part.trim());
  const start = parseMinutes(startRaw || '');
  const end = parseMinutes(endRaw || '');
  const current = targetMinutes(selection, now);
  if (start === null || end === null) return true;
  if (start === end) return true;
  if (start < end) return current >= start && current <= end;
  return current >= start || current <= end;
}

export function restaurantCuisineLabel(restaurant: Restaurant) {
  const seen = new Set<string>();
  return [restaurant.category, ...restaurant.cuisine]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .join(' · ');
}
