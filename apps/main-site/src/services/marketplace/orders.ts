import {
  arrayUnion,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from '@repo/firebase-config';
import type { CartLine, LocalOrder } from '@/context/MarketplaceContext';
import type { DeliveryMode } from '@/data/marketplace';
import { COURIER_RADAR_STATUSES } from '@repo/shared-types';
import { isValidCoordinates } from '@repo/shared-types';
import { isFirestoreDataSource, MOCK_CUSTOMER_ID } from './config';
import { normalizeOrderStatus, statusIndex, type OrderActor, type OrderStatus } from './status';

export type MarketplaceOrderStatus = OrderStatus;

export type DemoCourier = {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
};

export type MarketplaceOrderInput = {
  userId?: string;
  customerEmail?: string;
  restaurantId: string;
  restaurantName: string;
  brandId?: string;
  brandName?: string;
  branchId?: string;
  branchName?: string;
  restaurantLocation?: { lat: number; lng: number; address?: string };
  customerLocation?: { lat: number; lng: number };
  items: CartLine[];
  address: string;
  customerName: string;
  customerPhone: string;
  customerComment?: string;
  paymentMethod: 'cash' | 'card';
  fulfillmentType?: DeliveryMode;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  promoCode?: string | null;
  etaMinutes?: number;
};

export type CustomerOrderIdentity = {
  userId?: string | null;
  emails?: Array<string | null | undefined>;
  phones?: Array<string | null | undefined>;
};

export type CourierTrackingSnapshot = {
  currentLocation: ReturnType<typeof readCoordinate>;
  lastUpdated?: string;
  name?: string;
  phone?: string;
  vehicle?: string;
  vehicleType?: string;
};

type CourierSnapshot = {
  id?: string;
  uid?: string;
  name?: string;
  displayName?: string;
  fullName?: string;
  phone?: string;
  phoneNumber?: string;
  vehicle?: string;
  vehicleType?: string;
  vehicleName?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  plateNumber?: string;
  licensePlate?: string;
  vehiclePlate?: string;
  currentLocation?: unknown;
  location?: unknown;
  lastUpdated?: unknown;
  deleted?: boolean;
  archived?: boolean;
  isDeleted?: boolean;
  isTest?: boolean;
  test?: boolean;
  demo?: boolean;
  isDemo?: boolean;
  status?: string;
  isActive?: boolean;
  active?: boolean;
};

const BLOCKED_COURIER_STATUSES = new Set(['disabled', 'inactive', 'deleted', 'archived', 'suspended']);
const TEST_COURIER_PATTERN = /\b(test|demo|fake|sample|dummy|old test)\b/i;

function readCourierId(value?: CourierSnapshot | null) {
  return String(value?.id || value?.uid || '').trim();
}

function readCourierName(value?: CourierSnapshot | null) {
  return String(value?.name || value?.displayName || value?.fullName || '').trim();
}

function readCourierPhone(value?: CourierSnapshot | null) {
  return String(value?.phone || value?.phoneNumber || '').trim();
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function readCourierVehicle(value?: CourierSnapshot | null) {
  if (!value) return '';
  const vehicleDetails = [
    firstText(value.vehicleName, value.vehicleBrand),
    firstText(value.vehicleModel),
    firstText(value.plateNumber, value.licensePlate, value.vehiclePlate),
  ].filter(Boolean).join(' ');

  return vehicleDetails || firstText(value.vehicle);
}

function isRealCourierSnapshot(value?: CourierSnapshot | null) {
  if (!value || typeof value !== 'object') return false;
  const id = readCourierId(value);
  const name = readCourierName(value);
  const phone = readCourierPhone(value);
  const status = String(value.status || '').trim().toLowerCase();
  const flags = [value.deleted, value.archived, value.isDeleted, value.isTest, value.test, value.demo, value.isDemo];

  if (!id || !name || !phone) return false;
  if (flags.some(Boolean)) return false;
  if (value.isActive === false || value.active === false || BLOCKED_COURIER_STATUSES.has(status)) return false;
  return !TEST_COURIER_PATTERN.test(`${id} ${name} ${phone}`);
}

function normalizeAssignedCourier(value: unknown): LocalOrder['assignedCourier'] {
  if (!value || typeof value !== 'object') return null;
  const raw = value as CourierSnapshot;
  if (!isRealCourierSnapshot(raw)) return null;
  return {
    id: readCourierId(raw),
    name: readCourierName(raw),
    phone: readCourierPhone(raw),
    vehicle: readCourierVehicle(raw),
    vehicleType: raw.vehicleType ? String(raw.vehicleType) : '',
  };
}

function dateFromFirestore(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return typeof value === 'string' ? value : new Date().toISOString();
}

function readCoordinate(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.longitude);
  if (!isValidCoordinates(lat, lng)) return null;
  return {
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    ...(Number.isFinite(Number(raw.heading)) ? { heading: Number(raw.heading) } : {}),
    ...(Number.isFinite(Number(raw.speed)) ? { speed: Number(raw.speed) } : {}),
  };
}

function readMockOrders(): LocalOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('marketplace_orders');
    const parsed = raw ? (JSON.parse(raw) as LocalOrder[]) : [];
    return Array.isArray(parsed)
      ? parsed.map((order) => ({
        ...order,
        status: normalizeOrderStatus(order.status),
        statusIndex: statusIndex(order.status),
        restaurantId: order.restaurantId || order.items?.[0]?.restaurantId || 'unknown',
        customerAddress: order.customerAddress || order.address || '',
        subtotal: Number(order.subtotal ?? order.total ?? 0),
        deliveryFee: Number(order.deliveryFee ?? 0),
        serviceFee: Number(order.serviceFee ?? 0),
        discount: Number(order.discount ?? 0),
        paymentMethod: order.paymentMethod || 'cash',
        fulfillmentType: order.fulfillmentType || 'delivery',
        assignedCourier: normalizeAssignedCourier(order.assignedCourier),
      }))
      : [];
  } catch {
    return [];
  }
}

function sortOrdersByCreatedAt(orders: LocalOrder[]): LocalOrder[] {
  return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function writeMockOrders(orders: LocalOrder[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('marketplace_orders', JSON.stringify(orders));
  window.dispatchEvent(new Event('marketplace-orders-updated'));
}

function mapFirestoreOrder(data: DocumentData, id: string): LocalOrder {
  const status = normalizeOrderStatus(String(data.status || 'pending'));
  const assignedCourier = normalizeAssignedCourier(data.assignedCourier);
  const rawCourier = data.courier && typeof data.courier === 'object' ? data.courier as CourierSnapshot : null;
  const hasRawCourier = Boolean(
    rawCourier
    && (rawCourier.id || rawCourier.uid || rawCourier.name || rawCourier.phone || rawCourier.vehicle)
    && isRealCourierSnapshot(rawCourier as CourierSnapshot)
  );
  const courier = assignedCourier
    ? {
      name: String(assignedCourier.name || 'Courier'),
      vehicle: String(assignedCourier.vehicle || readCourierVehicle(rawCourier)),
      vehicleType: String(assignedCourier.vehicleType || ''),
      phone: String(assignedCourier.phone || ''),
      currentLocation: readCoordinate(rawCourier?.currentLocation),
      location: readCoordinate(rawCourier?.location),
      lastUpdated: rawCourier?.lastUpdated ? dateFromFirestore(rawCourier.lastUpdated) : undefined,
    }
    : rawCourier && hasRawCourier
      ? {
        name: readCourierName(rawCourier) || 'Courier',
        vehicle: readCourierVehicle(rawCourier),
        vehicleType: String(rawCourier.vehicleType || ''),
        phone: readCourierPhone(rawCourier),
        currentLocation: readCoordinate(rawCourier.currentLocation),
        location: readCoordinate(rawCourier.location),
        lastUpdated: rawCourier.lastUpdated ? dateFromFirestore(rawCourier.lastUpdated) : undefined,
      }
      : null;

  return {
    id: String(data.id || id),
    userId: data.userId ? String(data.userId) : undefined,
    customerEmail: data.customerEmail ? String(data.customerEmail) : undefined,
    restaurantId: String(data.restaurantId || data.items?.[0]?.restaurantId || 'unknown'),
    restaurantName: String(data.restaurantName || 'Restaurant'),
    brandId: data.brandId ? String(data.brandId) : undefined,
    brandName: data.brandName ? String(data.brandName) : undefined,
    branchId: data.branchId ? String(data.branchId) : undefined,
    branchName: data.branchName ? String(data.branchName) : undefined,
    items: Array.isArray(data.items) ? data.items : [],
    address: String(data.customerAddress || data.deliveryAddress || data.address || ''),
    customerAddress: String(data.customerAddress || data.deliveryAddress || data.address || ''),
    customerComment: String(data.customerComment || data.deliveryInstructions || data.adminComment || ''),
    deliveryInstructions: String(data.deliveryInstructions || data.customerComment || data.adminComment || ''),
    restaurantAddress: String(data.restaurantAddress || ''),
    restaurantLocation: readCoordinate(data.restaurantLocation),
    customerLocation: readCoordinate(data.customerLocation),
    deliveryLocation: readCoordinate(data.deliveryLocation),
    courierLocation: readCoordinate(data.courierLocation),
    phone: String(data.customerPhone || ''),
    name: String(data.customerName || ''),
    subtotal: Number(data.subtotal || data.total || data.totalAmount || 0),
    deliveryFee: Number(data.deliveryFee || 0),
    serviceFee: Number(data.serviceFee || 0),
    discount: Number(data.discount || 0),
    total: Number(data.total ?? data.totalAmount ?? 0),
    paymentMethod: data.paymentMethod === 'card' ? 'card' : 'cash',
    fulfillmentType: data.fulfillmentType === 'pickup' ? 'pickup' : 'delivery',
    status,
    createdAt: dateFromFirestore(data.createdAt),
    updatedAt: dateFromFirestore(data.updatedAt),
    statusIndex: statusIndex(status),
    assignedCourier,
    courierId: data.courierId ? String(data.courierId) : undefined,
    courier,
    etaMinutes: Number(data.etaMinutes || 24),
  };
}

export async function createOrder(orderInput: MarketplaceOrderInput): Promise<LocalOrder> {
  if (!isFirestoreDataSource()) {
    return {
      id: `213-${Date.now().toString().slice(-6)}`,
      userId: orderInput.userId || MOCK_CUSTOMER_ID,
      customerEmail: orderInput.customerEmail,
      restaurantId: orderInput.restaurantId,
      restaurantName: orderInput.restaurantName,
      brandId: orderInput.brandId,
      brandName: orderInput.brandName,
      branchId: orderInput.branchId,
      branchName: orderInput.branchName,
      items: orderInput.items,
      address: orderInput.address,
      customerAddress: orderInput.address,
      customerComment: orderInput.customerComment,
      deliveryInstructions: orderInput.customerComment,
      phone: orderInput.customerPhone,
      name: orderInput.customerName,
      subtotal: orderInput.subtotal,
      deliveryFee: orderInput.deliveryFee,
      serviceFee: orderInput.serviceFee,
      discount: orderInput.discount,
      total: orderInput.total,
      paymentMethod: orderInput.paymentMethod,
      fulfillmentType: orderInput.fulfillmentType || 'delivery',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusIndex: 0,
      assignedCourier: null,
      courier: null,
      restaurantAddress: orderInput.restaurantLocation?.address || '',
      restaurantLocation: orderInput.restaurantLocation || null,
      customerLocation: orderInput.customerLocation || null,
      deliveryLocation: orderInput.customerLocation || null,
      etaMinutes: orderInput.etaMinutes || 24,
    };
  }

  const orderRef = doc(collection(db, 'orders'));
  const customerLocation = orderInput.customerLocation
    && isValidCoordinates(orderInput.customerLocation.lat, orderInput.customerLocation.lng)
    ? {
      lat: orderInput.customerLocation.lat,
      lng: orderInput.customerLocation.lng,
      latitude: orderInput.customerLocation.lat,
      longitude: orderInput.customerLocation.lng,
    }
    : null;
  const restaurantLocation = orderInput.restaurantLocation
    && isValidCoordinates(orderInput.restaurantLocation.lat, orderInput.restaurantLocation.lng)
    ? {
      lat: orderInput.restaurantLocation.lat,
      lng: orderInput.restaurantLocation.lng,
      latitude: orderInput.restaurantLocation.lat,
      longitude: orderInput.restaurantLocation.lng,
    }
    : null;
  const payload = {
    id: orderRef.id,
    userId: orderInput.userId || MOCK_CUSTOMER_ID,
    customerEmail: orderInput.customerEmail || null,
    restaurantId: orderInput.restaurantId,
    restaurantName: orderInput.restaurantName,
    brandId: orderInput.brandId || null,
    brandName: orderInput.brandName || orderInput.restaurantName,
    branchId: orderInput.branchId || orderInput.restaurantId,
    branchName: orderInput.branchName || 'Main branch',
    ...(restaurantLocation ? { restaurantLocation } : {}),
    restaurantAddress: orderInput.restaurantLocation?.address || '',
    items: orderInput.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      restaurantId: item.restaurantId,
      brandId: item.brandId || orderInput.brandId || null,
      brandName: item.brandName || orderInput.brandName || null,
      branchId: item.branchId || orderInput.branchId || item.restaurantId,
      branchName: item.branchName || orderInput.branchName || null,
    })),
    address: orderInput.address,
    customerAddress: orderInput.address,
    deliveryAddress: orderInput.address,
    ...(customerLocation ? { customerLocation, deliveryLocation: customerLocation } : {}),
    customerName: orderInput.customerName,
    customerPhone: orderInput.customerPhone,
    customerComment: orderInput.customerComment || '',
    deliveryInstructions: orderInput.customerComment || '',
    paymentMethod: orderInput.paymentMethod,
    fulfillmentType: orderInput.fulfillmentType || 'delivery',
    subtotal: orderInput.subtotal,
    deliveryFee: orderInput.deliveryFee,
    serviceFee: orderInput.serviceFee,
    discount: orderInput.discount,
    total: orderInput.total,
    totalAmount: orderInput.total,
    promoCode: orderInput.promoCode || null,
    status: 'pending' as MarketplaceOrderStatus,
    statusHistory: [{ status: 'pending', at: new Date().toISOString() }],
    assignedCourier: null,
    courier: null,
    courierId: null,
    etaMinutes: orderInput.etaMinutes || 24,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(orderRef, payload);
  return mapFirestoreOrder({ ...payload, createdAt: new Date().toISOString() }, orderRef.id);
}

export async function getOrdersByUser(userId: string): Promise<LocalOrder[]> {
  if (!isFirestoreDataSource()) return readMockOrders();

  const ordersQuery = query(collection(db, 'orders'), where('userId', '==', userId || MOCK_CUSTOMER_ID));
  const snapshot = await getDocs(ordersQuery);
  return sortOrdersByCreatedAt(snapshot.docs.map((orderDoc) => mapFirestoreOrder(orderDoc.data(), orderDoc.id)));
}

function normalizePhone(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

export async function getOrdersForCustomer(identity: CustomerOrderIdentity): Promise<LocalOrder[]> {
  const emails = uniqueValues(identity.emails || []).map((email) => email.toLowerCase());
  const phones = uniqueValues(identity.phones || []);
  const normalizedPhones = phones.map(normalizePhone).filter(Boolean);

  if (!isFirestoreDataSource()) {
    const orders = sortOrdersByCreatedAt(readMockOrders());
    const matching = orders.filter((order) => {
      const userMatches = Boolean(identity.userId && order.userId === identity.userId);
      const emailMatches = Boolean(order.customerEmail && emails.includes(order.customerEmail.toLowerCase()));
      const phoneMatches = normalizedPhones.includes(normalizePhone(order.phone));
      return userMatches || emailMatches || phoneMatches;
    });

    // Browser-local orders are the safe demo fallback when older records lack identity fields.
    return matching.length > 0 ? matching : orders;
  }

  const queries = [
    ...(identity.userId
      ? [query(collection(db, 'orders'), where('userId', '==', identity.userId))]
      : []),
    ...emails.map((email) => query(collection(db, 'orders'), where('customerEmail', '==', email))),
    ...phones.map((phone) => query(collection(db, 'orders'), where('customerPhone', '==', phone))),
  ];

  const snapshots = await Promise.all(queries.map(async (ordersQuery) => {
    try {
      return await getDocs(ordersQuery);
    } catch {
      return null;
    }
  }));

  const records = new Map<string, LocalOrder>();
  snapshots.forEach((snapshot) => {
    snapshot?.docs.forEach((orderDoc) => {
      records.set(orderDoc.id, mapFirestoreOrder(orderDoc.data(), orderDoc.id));
    });
  });

  if (records.size === 0 && normalizedPhones.length > 0) {
    // Legacy demo fallback: only retain mock-customer orders matching this customer's phone.
    const fallbackQuery = query(collection(db, 'orders'), where('userId', '==', MOCK_CUSTOMER_ID));
    const fallbackSnapshot = await getDocs(fallbackQuery);
    fallbackSnapshot.docs.forEach((orderDoc) => {
      const order = mapFirestoreOrder(orderDoc.data(), orderDoc.id);
      if (normalizedPhones.includes(normalizePhone(order.phone))) {
        records.set(orderDoc.id, order);
      }
    });
  }

  return sortOrdersByCreatedAt([...records.values()]);
}

export async function getOrderById(orderId: string): Promise<LocalOrder | null> {
  if (!isFirestoreDataSource()) return readMockOrders().find((order) => order.id === orderId) || null;

  const orderDoc = await getDoc(doc(db, 'orders', orderId));
  return orderDoc.exists() ? mapFirestoreOrder(orderDoc.data(), orderDoc.id) : null;
}

export async function getAllOrders(): Promise<LocalOrder[]> {
  if (!isFirestoreDataSource()) {
    return sortOrdersByCreatedAt(readMockOrders());
  }

  const snapshot = await getDocs(collection(db, 'orders'));
  return sortOrdersByCreatedAt(
    snapshot.docs.flatMap((orderDoc) => {
      try {
        return [mapFirestoreOrder(orderDoc.data(), orderDoc.id)];
      } catch {
        return [];
      }
    }),
  );
}

export async function getOrdersByRestaurant(restaurantId: string): Promise<LocalOrder[]> {
  if (!isFirestoreDataSource()) {
    return readMockOrders()
      .filter((order) => order.restaurantId === restaurantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const ordersQuery = query(collection(db, 'orders'), where('restaurantId', '==', restaurantId));
  const snapshot = await getDocs(ordersQuery);
  return sortOrdersByCreatedAt(snapshot.docs.map((orderDoc) => mapFirestoreOrder(orderDoc.data(), orderDoc.id)));
}

export async function getAvailableCourierOrders(): Promise<LocalOrder[]> {
  const orders = await getAllOrders();
  return orders.filter((order) => COURIER_RADAR_STATUSES.includes(order.status) && !order.assignedCourier);
}

export async function assignOrderToCourier(orderId: string, courier: DemoCourier): Promise<void> {
  if (!isFirestoreDataSource()) {
    const orders = readMockOrders();
    writeMockOrders(orders.map((order) => order.id === orderId ? {
      ...order,
      assignedCourier: courier,
      courier: {
        name: courier.name,
        vehicle: courier.vehicle || 'Bicycle',
        phone: courier.phone || '',
      },
      updatedAt: new Date().toISOString(),
    } : order));
    return;
  }

  await updateDoc(doc(db, 'orders', orderId), {
    assignedCourier: courier,
    courier: {
      name: courier.name,
      vehicle: courier.vehicle || 'Bicycle',
      phone: courier.phone || '',
    },
    updatedAt: serverTimestamp(),
    statusHistory: arrayUnion({ status: 'assigned', actor: 'courier', at: new Date().toISOString() }),
  });
}

export async function updateOrderStatus(orderId: string, status: MarketplaceOrderStatus, actor: OrderActor = 'system'): Promise<void> {
  if (!isFirestoreDataSource()) {
    const nextStatus = normalizeOrderStatus(status);
    const orders = readMockOrders();
    writeMockOrders(orders.map((order) => order.id === orderId ? {
      ...order,
      status: nextStatus,
      statusIndex: statusIndex(nextStatus),
      updatedAt: new Date().toISOString(),
    } : order));
    return;
  }

  await updateDoc(doc(db, 'orders', orderId), {
    status,
    updatedAt: serverTimestamp(),
    statusHistory: arrayUnion({ status, actor, at: new Date().toISOString() }),
  });
}

export function subscribeToOrder(orderId: string, onChange: (order: LocalOrder | null) => void): Unsubscribe {
  if (!isFirestoreDataSource()) {
    const refresh = () => {
      onChange(readMockOrders().find((order) => order.id === orderId) || null);
    };
    refresh();
    window.addEventListener('marketplace-orders-updated', refresh);
    const interval = window.setInterval(refresh, 2500);
    return () => {
      window.removeEventListener('marketplace-orders-updated', refresh);
      window.clearInterval(interval);
    };
  }

  return onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
    onChange(snapshot.exists() ? mapFirestoreOrder(snapshot.data(), snapshot.id) : null);
  });
}

export function subscribeToCourierTracking(
  courierId: string,
  onChange: (courier: CourierTrackingSnapshot | null) => void,
): Unsubscribe {
  if (!courierId || !isFirestoreDataSource()) {
    onChange(null);
    return () => undefined;
  }

  return onSnapshot(
    doc(db, 'couriers', courierId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const data = snapshot.data();
      const courier = { id: snapshot.id, uid: snapshot.id, ...data } as CourierSnapshot;
      onChange({
        currentLocation: readCoordinate(data.currentLocation),
        lastUpdated: data.lastSeenAt || data.updatedAt
          ? dateFromFirestore(data.lastSeenAt || data.updatedAt)
          : undefined,
        name: readCourierName(courier) || undefined,
        phone: readCourierPhone(courier) || undefined,
        vehicle: readCourierVehicle(courier) || undefined,
        vehicleType: courier.vehicleType ? String(courier.vehicleType) : undefined,
      });
    },
    () => onChange(null),
  );
}

export function subscribeToOrders(
  onChange: (orders: LocalOrder[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!isFirestoreDataSource()) {
    const refresh = () => {
      onChange(sortOrdersByCreatedAt(readMockOrders()));
    };
    refresh();
    window.addEventListener('marketplace-orders-updated', refresh);
    const interval = window.setInterval(refresh, 2500);
    return () => {
      window.removeEventListener('marketplace-orders-updated', refresh);
      window.clearInterval(interval);
    };
  }

  return onSnapshot(
    collection(db, 'orders'),
    (snapshot) => {
      const orders = snapshot.docs.flatMap((orderDoc) => {
        try {
          return [mapFirestoreOrder(orderDoc.data(), orderDoc.id)];
        } catch {
          return [];
        }
      });
      onChange(sortOrdersByCreatedAt(orders));
    },
    (error) => onError?.(error),
  );
}
