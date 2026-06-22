import { create, type StoreApi, type UseBoundStore } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
  avgDeliveryTime?: number;
  minOrderAmount?: number;
  freeDeliveryThreshold?: number;
}

interface CartState {
  items: CartItem[];
  restaurant: CartRestaurant | null;
  deliveryFee: number;
  restaurantInstructions: string;
  cutleryCount: number;
  lastSwitchWarning: string | null;

  addItem: (item: CartItem, restaurant: CartRestaurant) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  setDeliveryFee: (fee: number) => void;
  setRestaurantInstructions: (instructions: string) => void;
  setCutleryCount: (count: number) => void;
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

const CART_STORAGE_KEY = 'client-app-cart';
const canUseStorage = () => Platform.OS !== 'web' || 'window' in globalThis;

type CartStore = UseBoundStore<StoreApi<CartState>> & {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
};

let hydrated = false;
const hydrationListeners = new Set<() => void>();

const partialize = (state: CartState) => ({
  items: state.items,
  restaurant: state.restaurant,
  deliveryFee: state.deliveryFee,
  restaurantInstructions: state.restaurantInstructions,
  cutleryCount: state.cutleryCount,
  lastSwitchWarning: null,
});

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  restaurant: null,
  deliveryFee: 0,
  restaurantInstructions: '',
  cutleryCount: 0,
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
        restaurantInstructions: '',
        cutleryCount: 0,
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
  setRestaurantInstructions: (instructions) => set({ restaurantInstructions: String(instructions || '').slice(0, 500) }),
  setCutleryCount: (count) => {
    const nextCount = Math.max(0, Math.min(20, Math.floor(Number(count) || 0)));
    set({ cutleryCount: nextCount });
  },
  clearSwitchWarning: () => set({ lastSwitchWarning: null }),
  clearCart: () => set({
    items: [],
    restaurant: null,
    deliveryFee: 0,
    restaurantInstructions: '',
    cutleryCount: 0,
    lastSwitchWarning: null,
  }),
  getSubtotal: () => get().items.reduce((sum, item) => sum + money(item.price) * item.quantity, 0),
  getTotal: () => get().getSubtotal() + money(get().deliveryFee),
  getItemCount: () => get().items.reduce((count, item) => count + item.quantity, 0),
})) as CartStore;

useCartStore.persist = {
  hasHydrated: () => hydrated,
  onFinishHydration: (listener) => {
    hydrationListeners.add(listener);
    return () => hydrationListeners.delete(listener);
  },
};

useCartStore.subscribe((state) => {
  if (!hydrated || !canUseStorage()) return;
  void AsyncStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ state: partialize(state), version: 0 })
  );
});

void (async () => {
  if (!canUseStorage()) {
    hydrated = true;
    hydrationListeners.forEach((listener) => listener());
    return;
  }

  try {
    const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: Partial<CartState> } | Partial<CartState>;
      const state: Partial<CartState> =
        'state' in parsed && parsed.state ? parsed.state : (parsed as Partial<CartState>);
      useCartStore.setState({
        items: Array.isArray(state.items) ? state.items : [],
        restaurant: state.restaurant ?? null,
        deliveryFee: money(state.deliveryFee),
        restaurantInstructions: String(state.restaurantInstructions || ''),
        cutleryCount: Math.max(0, Math.min(20, Math.floor(Number(state.cutleryCount) || 0))),
        lastSwitchWarning: null,
      });
    }
  } catch (error) {
    console.warn('Cart hydration failed:', error);
  } finally {
    hydrated = true;
    hydrationListeners.forEach((listener) => listener());
  }
})();
