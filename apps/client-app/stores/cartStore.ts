import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NormalizedCoordinate, OrderItem } from '@repo/shared-types';

export interface CartItem extends OrderItem {
  restaurantId: string;
  restaurantName: string;
}

export interface CartRestaurant {
  id: string;
  name: string;
  imageUrl?: string;
  location?: NormalizedCoordinate | { lat: number; lng: number } | null;
  deliveryFee?: number;
}

interface CartState {
  items: CartItem[];
  restaurant: CartRestaurant | null;
  deliveryFee: number;
  lastSwitchWarning: string | null;

  addItem: (item: CartItem, restaurant: CartRestaurant) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  setDeliveryFee: (fee: number) => void;
  clearSwitchWarning: () => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurant: null,
      deliveryFee: 0,
      lastSwitchWarning: null,

      addItem: (item, restaurant) => {
        const { items, restaurant: currentRestaurant } = get();
        const normalizedItem = {
          ...item,
          price: money(item.price),
          quantity: Math.max(1, Number(item.quantity) || 1),
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
        };

        if (currentRestaurant?.id && currentRestaurant.id !== restaurant.id) {
          set({
            items: [normalizedItem],
            restaurant,
            deliveryFee: money(restaurant.deliveryFee),
            lastSwitchWarning: 'Cart switched to the selected restaurant.',
          });
          return;
        }

        const existing = items.find((cartItem) => cartItem.id === normalizedItem.id);
        if (existing) {
          set({
            items: items.map((cartItem) =>
              cartItem.id === normalizedItem.id
                ? { ...cartItem, quantity: cartItem.quantity + normalizedItem.quantity }
                : cartItem
            ),
            restaurant,
            deliveryFee: money(restaurant.deliveryFee),
          });
          return;
        }

        set({
          items: [...items, normalizedItem],
          restaurant,
          deliveryFee: money(restaurant.deliveryFee),
        });
      },

      removeItem: (itemId) => {
        const nextItems = get().items.filter((item) => item.id !== itemId);
        set({
          items: nextItems,
          ...(nextItems.length === 0
            ? { restaurant: null, deliveryFee: 0, lastSwitchWarning: null }
            : {}),
        });
      },

      updateQuantity: (itemId, quantity) => {
        const nextQuantity = Number(quantity);
        if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
          get().removeItem(itemId);
          return;
        }

        set({
          items: get().items.map((item) =>
            item.id === itemId ? { ...item, quantity: Math.floor(nextQuantity) } : item
          ),
        });
      },

      setDeliveryFee: (fee) => set({ deliveryFee: money(fee) }),
      clearSwitchWarning: () => set({ lastSwitchWarning: null }),
      clearCart: () => set({ items: [], restaurant: null, deliveryFee: 0, lastSwitchWarning: null }),
      getSubtotal: () => get().items.reduce((sum, item) => sum + money(item.price) * item.quantity, 0),
      getTotal: () => get().getSubtotal() + money(get().deliveryFee),
      getItemCount: () => get().items.reduce((count, item) => count + item.quantity, 0),
    }),
    {
      name: 'client-app-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        restaurant: state.restaurant,
        deliveryFee: state.deliveryFee,
        lastSwitchWarning: null,
      }),
    }
  )
);
