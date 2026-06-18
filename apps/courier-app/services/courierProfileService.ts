import type { Courier, CourierLocation, CourierStatus } from '@repo/shared-types';
import { normalizeCanonicalVehicleType } from '@repo/shared-types';

type CourierDocument = Record<string, unknown>;

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const safeNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const mapLocation = (value: unknown): CourierLocation | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const lat = Number(source.lat ?? source.latitude);
  const lng = Number(source.lng ?? source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    ...(Number.isFinite(Number(source.heading))
      ? { heading: Number(source.heading) }
      : {}),
    ...(Number.isFinite(Number(source.speed))
      ? { speed: Number(source.speed) }
      : {}),
    updatedAt: source.updatedAt,
  };
};

export const mapCourierDocument = (
  id: string,
  data: CourierDocument
): Courier => {
  const currentOrderId = firstText(data.currentOrderId) || null;
  const isOnline =
    data.isOnline === true ||
    data.status === 'online' ||
    data.status === 'busy';
  const status: CourierStatus = currentOrderId
    ? 'busy'
    : isOnline
      ? 'online'
      : 'offline';
  const vehicleName = firstText(
    data.vehicleName,
    data.vehicleBrand,
    data.vehicleModel
  );
  const plateNumber = firstText(
    data.plateNumber,
    data.licensePlate,
    data.vehiclePlate
  );

  return {
    id,
    name: firstText(data.name, data.displayName, data.fullName),
    displayName: firstText(data.displayName, data.name, data.fullName),
    fullName: firstText(data.fullName, data.name, data.displayName),
    phone: firstText(data.phone, data.phoneNumber),
    vehicleType: normalizeCanonicalVehicleType(
      firstText(data.vehicleType, data.vehicle, data.vehicleBrand)
    ),
    vehicleName: vehicleName || undefined,
    plateNumber: plateNumber || undefined,
    vehicleBrand: firstText(data.vehicleBrand, data.vehicleName) || undefined,
    vehicleModel: firstText(data.vehicleModel) || undefined,
    licensePlate:
      firstText(data.licensePlate, data.plateNumber) || undefined,
    status,
    isOnline,
    isAvailable:
      data.isAvailable === true || (status === 'online' && !currentOrderId),
    currentOrderId,
    currentLocation: mapLocation(data.currentLocation),
    totalEarnings: safeNumber(data.totalEarnings ?? data.earnings),
    todayEarnings: safeNumber(data.todayEarnings),
    weeklyEarnings: safeNumber(data.weeklyEarnings),
    completedOrders: safeNumber(
      data.completedOrders ?? data.deliveries ?? data.totalDeliveries
    ),
    deliveries: safeNumber(data.deliveries ?? data.completedOrders),
    totalDeliveries: safeNumber(
      data.totalDeliveries ?? data.completedOrders ?? data.deliveries
    ),
    rating: safeNumber(data.rating) || 5,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastSeenAt: data.lastSeenAt,
  };
};

export const getCourierOperationalFields = (
  online: boolean,
  timestamp: unknown,
  currentOrderId?: string | null
) => {
  const hasOrder = Boolean(currentOrderId);
  return {
    status: hasOrder ? 'busy' : online ? 'online' : 'offline',
    isOnline: online,
    isAvailable: online && !hasOrder,
    ...(currentOrderId !== undefined ? { currentOrderId } : {}),
    lastSeenAt: timestamp,
    updatedAt: timestamp,
  };
};
