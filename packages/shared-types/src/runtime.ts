import type { Courier, VehicleType } from './courier';
import type { Order, OrderStatus } from './order';

export type CoordinateLike = {
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  speed?: number | null;
};

export type NormalizedCoordinate = {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
};

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];
export const COURIER_RADAR_STATUSES: OrderStatus[] = ['preparing'];
export const ACTIVE_COURIER_STATUSES: OrderStatus[] = [
  'pending',
  'preparing',
  'courier_picked_up',
];

const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  pending: 'pending',
  confirmed: 'pending',
  preparing: 'preparing',
  cooking: 'preparing',
  ready: 'preparing',
  picked_up: 'courier_picked_up',
  courier_picked_up: 'courier_picked_up',
  'courier picked up': 'courier_picked_up',
  delivering: 'courier_picked_up',
  'on the way': 'courier_picked_up',
  delivered: 'delivered',
  completed: 'delivered',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

export function normalizeOrderStatus(status?: string | null): OrderStatus {
  const normalized = String(status || 'pending')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return LEGACY_STATUS_MAP[normalized] || 'pending';
}

export function isTerminalOrderStatus(status?: string | null): boolean {
  return TERMINAL_ORDER_STATUSES.includes(normalizeOrderStatus(status));
}

export function canClientCancelOrder(status?: string | null): boolean {
  return normalizeOrderStatus(status) === 'pending';
}

export function hasAssignedCourier(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  const assigned = order.assignedCourier;
  if (assigned && typeof assigned === 'object' && typeof assigned.id === 'string' && assigned.id.trim()) {
    return true;
  }
  return false;
}

export function normalizeCoordinate(location?: CoordinateLike | null): NormalizedCoordinate | null {
  if (!location) return null;
  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    ...(Number.isFinite(Number(location.heading)) ? { heading: Number(location.heading) } : {}),
    ...(Number.isFinite(Number(location.speed)) ? { speed: Number(location.speed) } : {}),
  };
}

export function formatCurrencyUZS(value?: number | string | null): string {
  const amount = Number(value ?? 0);
  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString('ru-RU')} UZS`;
}

export function formatFirestoreDate(value: unknown, fallback = 'Date not available'): string {
  if (!value) return fallback;
  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === 'object' && value !== null && typeof (value as { seconds?: unknown }).seconds === 'number') {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

export function normalizeVehicleType(value?: string | null): VehicleType {
  const vehicle = String(value || '').trim().toLowerCase();
  if (vehicle.includes('car') || vehicle.includes('auto')) return 'car';
  if (vehicle.includes('bike') || vehicle.includes('bicycle') || vehicle.includes('velo')) return 'bicycle';
  if (vehicle.includes('moto') || vehicle.includes('scooter')) return 'motorcycle';
  if (vehicle.includes('foot') || vehicle.includes('walk')) return 'foot';
  return 'bicycle';
}

export function getCourierVehicleType(courier?: Partial<Courier> | null, assignedCourier?: { vehicleType?: string; vehicle?: string } | null): VehicleType {
  return normalizeVehicleType(courier?.vehicleType || assignedCourier?.vehicleType || assignedCourier?.vehicle);
}

export function getVehicleLabel(vehicle?: string | null): string {
  switch (normalizeVehicleType(vehicle)) {
    case 'car':
      return 'Car';
    case 'bicycle':
      return 'Bicycle';
    case 'motorcycle':
      return 'Motorcycle';
    case 'foot':
      return 'On Foot';
    default:
      return 'Vehicle';
  }
}
