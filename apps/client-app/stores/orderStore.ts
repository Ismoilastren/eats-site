import { create } from 'zustand';
import type { Order } from '@repo/shared-types';

interface OrderState {
  orders: Order[];
  activeOrder: Order | null;
  isLoading: boolean;

  setOrders: (orders: Order[]) => void;
  setActiveOrder: (order: Order | null) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  setLoading: (loading: boolean) => void;
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  orders: [],
  activeOrder: null,
  isLoading: false,

  setOrders: (orders) => set({ orders }),

  setActiveOrder: (activeOrder) => set({ activeOrder }),

  addOrder: (order) =>
    set((state) => ({ orders: [order, ...state.orders] })),

  updateOrder: (orderId, updates) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, ...updates } : o
      ),
      activeOrder:
        state.activeOrder?.id === orderId
          ? { ...state.activeOrder, ...updates }
          : state.activeOrder,
    })),

  setLoading: (isLoading) => set({ isLoading }),
}));
