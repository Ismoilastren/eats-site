import { create } from 'zustand';
import type { Order } from '@repo/shared-types';

interface OrderState {
  incomingOrders: Order[];
  completedOrders: Order[];
  setIncomingOrders: (orders: Order[]) => void;
  setCompletedOrders: (orders: Order[]) => void;
  updateOrderStatus: (orderId: string, newStatus: string) => void;
}

export const useOrderStore = create<OrderState>()((set) => ({
  incomingOrders: [],
  completedOrders: [],
  setIncomingOrders: (orders) => set({ incomingOrders: orders }),
  setCompletedOrders: (orders) => set({ completedOrders: orders }),
  updateOrderStatus: (orderId, newStatus) => 
    set((state) => ({
      incomingOrders: state.incomingOrders.map(order => 
        order.id === orderId ? { ...order, status: newStatus as any } : order
      ),
      completedOrders: state.completedOrders.map(order => 
        order.id === orderId ? { ...order, status: newStatus as any } : order
      )
    })),
}));
