// =============================================
// DELIVERY STORE — Available & active deliveries
// =============================================
import { create } from 'zustand';
import type { Order, OrderStatus } from '@repo/shared-types';
import { COLLECTIONS, PAGE_SIZE } from '@repo/shared-types';
import {
  db,
  collection,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  limit,
  serverTimestamp,
  runTransaction,
} from '@repo/firebase-config';
import type { Unsubscribe } from '@repo/firebase-config';
import {
  ACTIVE_COURIER_STATUSES,
  COURIER_RADAR_STATUSES,
  isTerminalOrderStatus,
  normalizeOrderStatus,
} from '@repo/shared-types';

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getCourierVehicleSnapshot(courierData: Record<string, unknown>) {
  const vehicle = [
    firstText(courierData.vehicleName, courierData.vehicleBrand),
    firstText(courierData.vehicleModel),
    firstText(courierData.plateNumber, courierData.licensePlate),
  ].filter(Boolean).join(' ') || firstText(courierData.vehicleName, courierData.vehicleType);

  return Object.fromEntries(Object.entries({
    vehicle,
    vehicleType: firstText(courierData.vehicleType, courierData.vehicle),
    vehicleName: firstText(courierData.vehicleName, courierData.vehicleBrand),
    vehicleBrand: firstText(courierData.vehicleBrand, courierData.vehicleName),
    vehicleModel: firstText(courierData.vehicleModel),
    plateNumber: firstText(courierData.plateNumber, courierData.licensePlate).toUpperCase(),
    licensePlate: firstText(courierData.licensePlate, courierData.plateNumber).toUpperCase(),
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

interface DeliveryState {
  availableDeliveries: Order[];
  activeDeliveries: Order[];
  activeDelivery: Order | null;
  isLoadingAvailable: boolean;
  isLoadingActive: boolean;
  error: string | null;

  // Actions
  subscribeToAvailableDeliveries: () => Unsubscribe;
  subscribeToActiveDelivery: (courierId: string) => Unsubscribe;
  acceptDelivery: (orderId: string, courierId: string, courierName: string, courierPhone: string) => Promise<void>;
  updateDeliveryStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  completeDelivery: (orderId: string) => Promise<void>;
  setActiveDelivery: (delivery: Order | null) => void;
  clearError: () => void;
}

export const useDeliveryStore = create<DeliveryState>()((set, get) => ({
  availableDeliveries: [],
  activeDeliveries: [],
  activeDelivery: null,
  isLoadingAvailable: true,
  isLoadingActive: false,
  error: null,

  subscribeToAvailableDeliveries: () => {
    set({ isLoadingAvailable: true });

    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const q = query(
      ordersRef,
      where('status', 'in', COURIER_RADAR_STATUSES),
      where('assignedCourier', '==', null),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const deliveries: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (COURIER_RADAR_STATUSES.includes(normalizeOrderStatus(data.status)) && !data.courierId && !data.assignedCourier) {
            deliveries.push({ id: docSnap.id, ...data } as Order);
          }
        });
        set({ availableDeliveries: deliveries, isLoadingAvailable: false, error: null });
      },
      (error) => {
        console.warn('Available deliveries subscription error:', error);
        set({ isLoadingAvailable: false, error: 'Failed to load available deliveries' });
      }
    );

    return unsubscribe;
  },

  subscribeToActiveDelivery: (courierId: string) => {
    set({ isLoadingActive: true });

    const ordersRef = collection(db, COLLECTIONS.ORDERS);

    // Use separate simple queries and merge in memory to avoid composite index requirements
    const q1 = query(ordersRef, where('assignedCourier.id', '==', courierId));
    const q2 = query(ordersRef, where('courierId', '==', courierId));

    let list1: Order[] = [];
    let list2: Order[] = [];

    const processActiveDeliveries = () => {
      const mergedMap = new Map<string, Order>();
      [...list1, ...list2].forEach((order) => {
        const status = normalizeOrderStatus(order.status);
        if (ACTIVE_COURIER_STATUSES.includes(status) && !isTerminalOrderStatus(status)) {
          mergedMap.set(order.id, order);
        }
      });

      const allActives = Array.from(mergedMap.values());
      const activeDoc = allActives[0];
      if (activeDoc) {
        set({ activeDeliveries: allActives, activeDelivery: activeDoc, isLoadingActive: false });
      } else {
        set({ activeDeliveries: [], activeDelivery: null, isLoadingActive: false });
      }
    };

    const unsub1 = onSnapshot(
      q1,
      (snapshot) => {
        list1 = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
        processActiveDeliveries();
      },
      (error) => {
        console.warn('Active delivery subscription error 1:', error);
        set({ isLoadingActive: false });
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snapshot) => {
        list2 = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
        processActiveDeliveries();
      },
      (error) => {
        console.warn('Active delivery subscription error 2:', error);
        set({ isLoadingActive: false });
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  },

  acceptDelivery: async (orderId, courierId, courierName, courierPhone) => {
    try {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      const courierRef = doc(db, COLLECTIONS.COURIERS, courierId);

      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order no longer exists');
        const courierSnap = await transaction.get(courierRef);
        const courierData = courierSnap.exists() ? courierSnap.data() : {};

        const orderData = orderSnap.data();
        const status = normalizeOrderStatus(orderData.status);
        if (!COURIER_RADAR_STATUSES.includes(status) || orderData.courierId || orderData.assignedCourier) {
          throw new Error('Order is no longer available');
        }
        const vehicleSnapshot = getCourierVehicleSnapshot(courierData);

        transaction.update(orderRef, {
          courierId,
          courierName,
          courierPhone,
          assignedCourier: {
            id: courierId,
            name: courierName,
            phone: courierPhone,
            ...vehicleSnapshot,
          },
          courier: {
            uid: courierId,
            id: courierId,
            name: courierName,
            phone: courierPhone,
            ...vehicleSnapshot,
          },
          updatedAt: serverTimestamp(),
        });

        transaction.update(courierRef, {
          currentOrderId: orderId,
          status: 'busy',
          isOnline: true,
          isAvailable: false,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      const updatedSnap = await getDoc(orderRef);
      if (updatedSnap.exists()) {
        set({
          activeDelivery: { id: updatedSnap.id, ...updatedSnap.data() } as Order,
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to accept delivery';
      set({ error: message });
      throw error;
    }
  },

  updateDeliveryStatus: async (orderId, status) => {
    try {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);

      const updateData: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (status === 'delivered') {
        updateData.deliveredAt = serverTimestamp();
      }

      await updateDoc(orderRef, updateData);

      const { activeDelivery } = get();
      if (activeDelivery && activeDelivery.id === orderId) {
        set({ activeDelivery: { ...activeDelivery, status } });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update status';
      set({ error: message });
      throw error;
    }
  },

  completeDelivery: async (orderId) => {
    try {
      const { activeDelivery } = get();
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      const assignedCourierId = activeDelivery?.assignedCourier?.id || activeDelivery?.courierId;
      if (!assignedCourierId) throw new Error('Courier is missing for this delivery');

      const courierRef = doc(db, COLLECTIONS.COURIERS, assignedCourierId);

      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order no longer exists');

        const orderData = orderSnap.data();
        if (normalizeOrderStatus(orderData.status) === 'delivered') {
          throw new Error('Order was already delivered');
        }
        if (normalizeOrderStatus(orderData.status) !== 'on_the_way') {
          throw new Error('Order is not ready to be delivered');
        }

        transaction.update(orderRef, {
          status: 'delivered',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(courierRef, {
          currentOrderId: null,
          status: 'online',
          isOnline: true,
          isAvailable: true,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      set({ activeDelivery: null });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to complete delivery';
      set({ error: message });
      throw error;
    }
  },

  setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),
  clearError: () => set({ error: null }),
}));
