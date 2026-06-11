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
  restaurantId: string;
  restaurantName: string;
  restaurantLocation?: { lat: number; lng: number; address?: string };
  customerLocation?: { lat: number; lng: number };
  items: CartLine[];
  address: string;
  customerName: string;
  customerPhone: string;
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

function dateFromFirestore(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return typeof value === 'string' ? value : new Date().toISOString();
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
        assignedCourier: order.assignedCourier || null,
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
  const assignedCourier = data.assignedCourier && typeof data.assignedCourier === 'object'
    ? {
      id: String(data.assignedCourier.id || ''),
      name: String(data.assignedCourier.name || 'Courier'),
      phone: data.assignedCourier.phone ? String(data.assignedCourier.phone) : '',
      vehicle: data.assignedCourier.vehicle ? String(data.assignedCourier.vehicle) : 'Bicycle',
    }
    : null;

  return {
    id: String(data.id || id),
    userId: data.userId ? String(data.userId) : undefined,
    customerEmail: data.customerEmail ? String(data.customerEmail) : undefined,
    restaurantId: String(data.restaurantId || data.items?.[0]?.restaurantId || 'unknown'),
    restaurantName: String(data.restaurantName || 'Restaurant'),
    items: Array.isArray(data.items) ? data.items : [],
    address: String(data.customerAddress || data.address || ''),
    customerAddress: String(data.customerAddress || data.address || ''),
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
    courier: {
      name: String(assignedCourier?.name || data.courier?.name || 'Courier'),
      vehicle: String(assignedCourier?.vehicle || data.courier?.vehicle || 'Bicycle'),
      phone: String(assignedCourier?.phone || data.courier?.phone || ''),
    },
    etaMinutes: Number(data.etaMinutes || 24),
  };
}

export async function createOrder(orderInput: MarketplaceOrderInput): Promise<LocalOrder> {
  if (!isFirestoreDataSource()) {
    return {
      id: `213-${Date.now().toString().slice(-6)}`,
      userId: orderInput.userId || MOCK_CUSTOMER_ID,
      restaurantId: orderInput.restaurantId,
      restaurantName: orderInput.restaurantName,
      items: orderInput.items,
      address: orderInput.address,
      customerAddress: orderInput.address,
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
      courier: {
        name: 'Akmal R.',
        vehicle: 'Bicycle',
        phone: '+998 90 777 21 13',
      },
      etaMinutes: orderInput.etaMinutes || 24,
    };
  }

  const orderRef = doc(collection(db, 'orders'));
  const customerLocation = {
    lat: orderInput.customerLocation?.lat ?? 41.311081,
    lng: orderInput.customerLocation?.lng ?? 69.240562,
    latitude: orderInput.customerLocation?.lat ?? 41.311081,
    longitude: orderInput.customerLocation?.lng ?? 69.240562,
  };
  const payload = {
    id: orderRef.id,
    userId: orderInput.userId || MOCK_CUSTOMER_ID,
    restaurantId: orderInput.restaurantId,
    restaurantName: orderInput.restaurantName,
    restaurantLocation: orderInput.restaurantLocation || { lat: 41.311081, lng: 69.240562 },
    restaurantAddress: orderInput.restaurantLocation?.address || '',
    items: orderInput.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      restaurantId: item.restaurantId,
    })),
    address: orderInput.address,
    customerAddress: orderInput.address,
    deliveryAddress: orderInput.address,
    customerLocation,
    deliveryLocation: customerLocation,
    customerName: orderInput.customerName,
    customerPhone: orderInput.customerPhone,
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
  return orders.filter((order) => ['preparing', 'ready_for_pickup'].includes(order.status) && !order.assignedCourier);
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
