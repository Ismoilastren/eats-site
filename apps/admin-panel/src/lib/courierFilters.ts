import { getVehicleLabel, normalizeCanonicalVehicleType } from '@repo/shared-types';

export type AdminCourierRecord = Record<string, any> & {
  id: string;
  uid?: string;
};

const BLOCKED_STATUSES = new Set(['disabled', 'inactive', 'deleted', 'archived', 'suspended']);
const TEST_PATTERNS = /\b(test|demo|fake|sample|dummy|old test)\b/i;

export function getCourierId(courier?: Partial<AdminCourierRecord> | null) {
  return String(courier?.id || courier?.uid || '').trim();
}

export function getCourierName(courier?: Partial<AdminCourierRecord> | null) {
  return String(courier?.displayName || courier?.fullName || courier?.name || '').trim();
}

export function getCourierPhone(courier?: Partial<AdminCourierRecord> | null) {
  return String(courier?.phone || courier?.phoneNumber || '').trim();
}

export function getCourierVehicle(courier?: Partial<AdminCourierRecord> | null) {
  const vehicleType = normalizeCanonicalVehicleType(courier?.vehicleType || courier?.vehicle || courier?.vehicleBrand);
  const vehicle = [
    courier?.vehicleName || courier?.vehicleBrand,
    courier?.vehicleModel,
    courier?.plateNumber || courier?.licensePlate,
  ].filter(Boolean).join(' ') || courier?.vehicle || getVehicleLabel(vehicleType);

  return { vehicle, vehicleType };
}

export function getCourierStatus(courier?: Partial<AdminCourierRecord> | null) {
  const status = String(courier?.status || '').trim().toLowerCase();
  if (status === 'busy') return 'busy';
  if (status === 'online' || courier?.isOnline === true) return 'online';
  if (status === 'inactive' || courier?.isActive === false) return 'inactive';
  return 'offline';
}

export function getCourierInvalidReason(courier?: Partial<AdminCourierRecord> | null) {
  const id = getCourierId(courier);
  const name = getCourierName(courier);
  const phone = getCourierPhone(courier);
  const status = String(courier?.status || '').trim().toLowerCase();
  const flags = [
    courier?.deleted,
    courier?.archived,
    courier?.isDeleted,
    courier?.isTest,
    courier?.test,
    courier?.demo,
    courier?.isDemo,
  ];

  if (!id) return 'missing id';
  if (flags.some(Boolean)) return 'deleted, archived, test, or demo record';
  if (courier?.isActive === false || courier?.active === false || BLOCKED_STATUSES.has(status)) return 'inactive or disabled';
  if (!name) return 'missing name';
  if (!phone) return 'missing phone';
  if (TEST_PATTERNS.test(`${id} ${name} ${phone}`)) return 'test or demo data';
  return '';
}

export function isRealCourier(courier?: Partial<AdminCourierRecord> | null) {
  return !getCourierInvalidReason(courier);
}

export function getCourierAssignableReason(courier?: Partial<AdminCourierRecord> | null) {
  const invalidReason = getCourierInvalidReason(courier);
  if (invalidReason) return invalidReason;
  const status = getCourierStatus(courier);
  if (status !== 'online') return 'courier is offline or inactive';
  if (courier?.isAvailable === false) return 'courier is unavailable';
  if (courier?.currentOrderId) return 'courier already has an active order';
  return '';
}

export function isAssignableCourier(courier?: Partial<AdminCourierRecord> | null) {
  return !getCourierAssignableReason(courier);
}

export function sortCouriers(a: AdminCourierRecord, b: AdminCourierRecord) {
  const statusRank: Record<string, number> = { online: 0, busy: 1, offline: 2, inactive: 3 };
  const rankA = statusRank[getCourierStatus(a)] ?? 9;
  const rankB = statusRank[getCourierStatus(b)] ?? 9;
  if (rankA !== rankB) return rankA - rankB;
  return getCourierName(a).localeCompare(getCourierName(b));
}
