'use client';

import {
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { isFirestoreDataSource } from '@/services/marketplace';

export type CustomerProfile = {
  fullName: string;
  phone: string;
  email: string;
  role?: string;
};

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  maskedNumber: string;
  expiry: string;
  cardholderName: string;
  createdAt: string;
};

export type SavedLocationSource = 'manual' | 'map' | 'current_location' | 'suggestion';

export type SavedLocation = {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  source: SavedLocationSource;
  createdAt: string;
};

const CUSTOMER_PROFILE_EVENT = 'customer-profile:changed';
const paymentKey = (uid: string) => `profile_payment_methods_${uid}`;
const locationKey = (uid: string) => `profile_saved_locations_${uid}`;
const profileKey = (uid: string) => `profile_customer_${uid}`;
const deletedPaymentKey = (uid: string) => `profile_deleted_payment_methods_${uid}`;
const deletedLocationKey = (uid: string) => `profile_deleted_saved_locations_${uid}`;

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    throw new Error('Browser storage is not available.');
  }
  localStorage.setItem(key, JSON.stringify(value));
}

function notify(uid: string, resource: 'profile' | 'paymentMethods' | 'savedLocations') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CUSTOMER_PROFILE_EVENT, {
    detail: { uid, resource },
  }));
}

function uniqueById<T extends { id: string }>(remote: T[], local: T[]) {
  const records = new Map<string, T>();
  remote.forEach((item) => records.set(item.id, item));
  local.forEach((item) => records.set(item.id, item));
  return Array.from(records.values());
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizePaymentMethod(id: string, data: Record<string, unknown>): PaymentMethod | null {
  const last4 = safeString(data.last4).replace(/\D/g, '').slice(-4);
  if (last4.length !== 4) return null;
  const cardholderName = safeString(data.cardholderName || data.holderName).toUpperCase();
  const expiry = safeString(data.expiry);
  return {
    id,
    brand: safeString(data.brand) || 'Other',
    last4,
    maskedNumber: safeString(data.maskedNumber) || maskCardNumber(last4),
    expiry,
    cardholderName,
    createdAt: safeString(data.createdAt) || new Date().toISOString(),
  };
}

function normalizeSavedLocation(id: string, data: Record<string, unknown>): SavedLocation | null {
  const label = safeString(data.label);
  const address = safeString(data.address);
  if (!label || !address || /^selected point/i.test(address)) return null;
  const source = safeString(data.source);
  return {
    id,
    label,
    address,
    lat: safeCoordinate(data.lat),
    lng: safeCoordinate(data.lng),
    source: source === 'map' || source === 'current_location' || source === 'suggestion'
      ? source
      : 'manual',
    createdAt: safeString(data.createdAt) || new Date().toISOString(),
  };
}

export function createCustomerRecordId(prefix: 'card' | 'location') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

export function normalizeUzbekPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return null;
}

export function normalizeCardNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function passesLuhn(number: string) {
  let sum = 0;
  let shouldDouble = false;
  for (let index = number.length - 1; index >= 0; index -= 1) {
    let digit = Number(number[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function validateCardNumber(value: string) {
  const number = normalizeCardNumber(value);
  return /^\d{13,19}$/.test(number) && passesLuhn(number);
}

export function validateExpiry(expiry: string, now = new Date()) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return false;
  const [month, year] = expiry.split('/').map(Number);
  const currentYear = Number(String(now.getFullYear()).slice(-2));
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

export function getCardBrand(numberValue: string) {
  const number = normalizeCardNumber(numberValue);
  if (/^8600/.test(number)) return 'Uzcard';
  if (/^9860/.test(number)) return 'Humo';
  if (/^4/.test(number)) return 'Visa';
  if (/^5[1-5]/.test(number)) return 'Mastercard';
  if (/^3[47]/.test(number)) return 'Amex';
  return 'Other';
}

export function maskCardNumber(numberValue: string) {
  const last4 = normalizeCardNumber(numberValue).slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export function isStoredPaymentMethodValid(method: PaymentMethod) {
  return method.last4.length === 4
    && Boolean(method.cardholderName)
    && validateExpiry(method.expiry);
}

export function readStoredCustomerProfile(uid: string): CustomerProfile | null {
  const stored = readStorage<Partial<CustomerProfile> | null>(profileKey(uid), null);
  if (!stored) return null;
  return {
    fullName: safeString(stored.fullName),
    phone: safeString(stored.phone),
    email: safeString(stored.email),
    role: safeString(stored.role) || 'client',
  };
}

export async function loadCustomerProfile(uid: string): Promise<CustomerProfile | null> {
  const local = readStoredCustomerProfile(uid);
  if (!isFirestoreDataSource()) return local;

  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (!snapshot.exists()) return local;
    const data = snapshot.data();
    const remote: CustomerProfile = {
      fullName: safeString(data.fullName || data.name),
      phone: safeString(data.phone),
      email: safeString(data.email),
      role: safeString(data.role) || 'client',
    };
    return { ...remote, ...local };
  } catch {
    return local;
  }
}

export async function saveCustomerProfile(uid: string, profile: CustomerProfile) {
  const normalized: CustomerProfile = {
    fullName: profile.fullName.trim(),
    phone: profile.phone.trim(),
    email: profile.email.trim(),
    role: profile.role || 'client',
  };
  writeStorage(profileKey(uid), normalized);
  notify(uid, 'profile');

  if (isFirestoreDataSource()) {
    void setDoc(doc(db, COLLECTIONS.USERS, uid), normalized, { merge: true }).catch(() => undefined);
  }
  return { value: normalized };
}

export function readStoredPaymentMethods(uid: string) {
  const deleted = new Set(readStorage<string[]>(deletedPaymentKey(uid), []));
  return readStorage<PaymentMethod[]>(paymentKey(uid), [])
    .map((item) => normalizePaymentMethod(item.id, item as unknown as Record<string, unknown>))
    .filter(isPresent)
    .filter((item) => !deleted.has(item.id));
}

export async function loadPaymentMethods(uid: string) {
  const local = readStoredPaymentMethods(uid);
  if (!isFirestoreDataSource()) return local;

  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.USERS, uid, 'paymentMethods'));
    const deleted = new Set(readStorage<string[]>(deletedPaymentKey(uid), []));
    const remote = snapshot.docs
      .map((paymentDoc) => normalizePaymentMethod(paymentDoc.id, paymentDoc.data()))
      .filter(isPresent)
      .filter((item) => !deleted.has(item.id));
    const merged = uniqueById(remote, local);
    writeStorage(paymentKey(uid), merged);
    return merged;
  } catch {
    return local;
  }
}

export async function savePaymentMethod(uid: string, method: PaymentMethod) {
  const safeMethod = normalizePaymentMethod(method.id, method as unknown as Record<string, unknown>);
  if (!safeMethod) throw new Error('Payment method data is invalid.');
  const next = uniqueById(readStoredPaymentMethods(uid), [safeMethod]);
  writeStorage(paymentKey(uid), next);
  writeStorage(deletedPaymentKey(uid), readStorage<string[]>(deletedPaymentKey(uid), []).filter((id) => id !== method.id));
  notify(uid, 'paymentMethods');

  if (isFirestoreDataSource()) {
    void setDoc(doc(db, COLLECTIONS.USERS, uid, 'paymentMethods', safeMethod.id), {
      brand: safeMethod.brand,
      last4: safeMethod.last4,
      maskedNumber: safeMethod.maskedNumber,
      expiry: safeMethod.expiry,
      cardholderName: safeMethod.cardholderName,
      createdAt: safeMethod.createdAt,
    }).catch(() => undefined);
  }
  return { value: safeMethod };
}

export async function removePaymentMethod(uid: string, id: string) {
  writeStorage(paymentKey(uid), readStoredPaymentMethods(uid).filter((item) => item.id !== id));
  writeStorage(deletedPaymentKey(uid), Array.from(new Set([
    ...readStorage<string[]>(deletedPaymentKey(uid), []),
    id,
  ])));
  notify(uid, 'paymentMethods');
  if (isFirestoreDataSource()) {
    void deleteDoc(doc(db, COLLECTIONS.USERS, uid, 'paymentMethods', id)).catch(() => undefined);
  }
}

export function readStoredLocations(uid: string) {
  const deleted = new Set(readStorage<string[]>(deletedLocationKey(uid), []));
  return readStorage<SavedLocation[]>(locationKey(uid), [])
    .map((item) => normalizeSavedLocation(item.id, item as unknown as Record<string, unknown>))
    .filter(isPresent)
    .filter((item) => !deleted.has(item.id));
}

export async function loadSavedLocations(uid: string) {
  const local = readStoredLocations(uid);
  if (!isFirestoreDataSource()) return local;

  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.USERS, uid, 'addresses'));
    const deleted = new Set(readStorage<string[]>(deletedLocationKey(uid), []));
    const remote = snapshot.docs
      .map((locationDoc) => normalizeSavedLocation(locationDoc.id, locationDoc.data()))
      .filter(isPresent)
      .filter((item) => !deleted.has(item.id));
    const merged = uniqueById(remote, local);
    writeStorage(locationKey(uid), merged);
    return merged;
  } catch {
    return local;
  }
}

export async function saveSavedLocation(uid: string, location: SavedLocation) {
  const safeLocation = normalizeSavedLocation(location.id, location as unknown as Record<string, unknown>);
  if (!safeLocation) throw new Error('Saved location data is invalid.');
  const next = uniqueById(readStoredLocations(uid), [safeLocation]);
  writeStorage(locationKey(uid), next);
  writeStorage(deletedLocationKey(uid), readStorage<string[]>(deletedLocationKey(uid), []).filter((id) => id !== location.id));
  notify(uid, 'savedLocations');

  if (isFirestoreDataSource()) {
    void setDoc(doc(db, COLLECTIONS.USERS, uid, 'addresses', safeLocation.id), safeLocation)
      .catch(() => undefined);
  }
  return { value: safeLocation };
}

export async function removeSavedLocation(uid: string, id: string) {
  writeStorage(locationKey(uid), readStoredLocations(uid).filter((item) => item.id !== id));
  writeStorage(deletedLocationKey(uid), Array.from(new Set([
    ...readStorage<string[]>(deletedLocationKey(uid), []),
    id,
  ])));
  notify(uid, 'savedLocations');
  if (isFirestoreDataSource()) {
    void deleteDoc(doc(db, COLLECTIONS.USERS, uid, 'addresses', id)).catch(() => undefined);
  }
}

export function subscribeCustomerProfileStorage(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handleCustom = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key?.startsWith('profile_')) listener();
  };
  window.addEventListener(CUSTOMER_PROFILE_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(CUSTOMER_PROFILE_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}
