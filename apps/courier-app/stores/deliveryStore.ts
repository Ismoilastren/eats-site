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
  increment,
} from '@repo/firebase-config';
import type { Unsubscribe } from '@repo/firebase-config';
import {
  ACTIVE_COURIER_STATUSES,
  isTerminalOrderStatus,
  normalizeOrderStatus,
} from '@repo/shared-types';

interface DeliveryState {
  availableDeliveries: Order[];
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
  activeDelivery: null,
  isLoadingAvailable: true,
  isLoadingActive: false,
  error: null,

  subscribeToAvailableDeliveries: () => {
    set({ isLoadingAvailable: true });

    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const q = query(
      ordersRef,
      where('status', '==', 'preparing'),
      where('assignedCourier', '==', null),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const deliveries: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (normalizeOrderStatus(data.status) === 'preparing' && !data.courierId && !data.assignedCourier) {
            deliveries.push({ id: docSnap.id, ...data } as Order);
          }
        });
        set({ availableDeliveries: deliveries, isLoadingAvailable: false, error: null });
      },
      (error) => {
        console.error('Available deliveries subscription error:', error);
        set({ isLoadingAvailable: false, error: 'Failed to load available deliveries' });
      }
    );

    return unsubscribe;
  },

  subscribeToActiveDelivery: (courierId: string) => {
    set({ isLoadingActive: true });

    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const q = query(
      ordersRef,
      where('assignedCourier.id', '==', courierId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activeDoc = snapshot.docs.find((docSnap) => {
          const status = normalizeOrderStatus(docSnap.data().status);
          return ACTIVE_COURIER_STATUSES.includes(status) && !isTerminalOrderStatus(status);
        });

        if (activeDoc) {
          set({
            activeDelivery: { id: activeDoc.id, ...activeDoc.data() } as Order,
            isLoadingActive: false,
          });
        } else {
          set({ activeDelivery: null, isLoadingActive: false });
        }
      },
      (error) => {
        console.error('Active delivery subscription error:', error);
        set({ isLoadingActive: false });
      }
    );

    return unsubscribe;
  },

  acceptDelivery: async (orderId, courierId, courierName, courierPhone) => {
    try {
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      const courierRef = doc(db, COLLECTIONS.COURIERS, courierId);

      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order no longer exists');

        const orderData = orderSnap.data();
        const status = normalizeOrderStatus(orderData.status);
        if (status !== 'preparing' || orderData.courierId || orderData.assignedCourier) {
          throw new Error('Order is no longer available');
        }

        transaction.update(orderRef, {
          courierId,
          courierName,
          courierPhone,
          assignedCourier: {
            id: courierId,
            name: courierName,
            phone: courierPhone,
          },
          updatedAt: serverTimestamp(),
        });

        transaction.update(courierRef, {
          currentOrderId: orderId,
          isAvailable: false,
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
        if (normalizeOrderStatus(orderData.status) !== 'courier_picked_up') {
          throw new Error('Order is not ready to be delivered');
        }

        const payout = Number(orderData.deliveryFee || 10000);
        const safePayout = Number.isFinite(payout) && payout > 0 ? payout : 10000;

        transaction.update(orderRef, {
          status: 'delivered',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(courierRef, {
          totalEarnings: increment(safePayout),
          totalDeliveries: increment(1),
          currentOrderId: null,
          isAvailable: true,
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
