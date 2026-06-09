'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DeliveryMode, Dish, Promo, Restaurant } from '@/data/marketplace';
import {
  createOrder,
  getOrdersByUser,
  getPromos,
  isFirestoreDataSource,
  MOCK_CUSTOMER_ID,
  subscribeRestaurants,
  type OrderStatus,
  type MarketplaceOrderInput,
} from '@/services/marketplace';

export type CartLine = Dish & {
  quantity: number;
  restaurantName: string;
  restaurantSlug: string;
  restaurantMinOrder: number;
  restaurantDeliveryFee: number;
};

export type MockUser = { name: string; phone: string };
export type SavedAddress = { text: string; inZone: boolean };
export type LocalOrder = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  items: CartLine[];
  address: string;
  customerAddress: string;
  phone: string;
  name: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  paymentMethod: 'cash' | 'card';
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  statusIndex: number;
  assignedCourier: { id: string; name: string; phone?: string; vehicle?: string } | null;
  courier: { name: string; vehicle: string; phone: string };
  etaMinutes?: number;
};

type MarketplaceContextValue = {
  cart: CartLine[];
  restaurants: Restaurant[];
  user: MockUser | null;
  address: SavedAddress;
  favorites: string[];
  orders: LocalOrder[];
  promo: Promo | null;
  marketplacePromos: Promo[];
  deliveryMode: DeliveryMode;
  dataLoading: boolean;
  dataError: string | null;
  addDish: (restaurant: Restaurant, dish: Dish, quantity?: number) => void;
  updateQuantity: (dishId: string, delta: number) => void;
  removeDish: (dishId: string) => void;
  clearCart: () => void;
  setAddress: (address: SavedAddress) => void;
  toggleFavorite: (restaurantId: string) => void;
  login: (name: string, phone: string) => void;
  logout: () => void;
  applyPromo: (code: string) => boolean;
  removePromo: () => void;
  setDeliveryMode: (mode: DeliveryMode) => void;
  reloadOrders: () => Promise<void>;
  placeOrder: (payload: { name: string; phone: string; address: string; paymentMethod?: 'cash' | 'card' }) => Promise<LocalOrder>;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  cartCount: number;
};

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);
const FRIENDLY_DATA_ERROR = 'Could not load live marketplace data. Refresh the page or check Firebase settings.';

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [user, setUser] = useState<MockUser | null>(null);
  const [address, setAddressState] = useState<SavedAddress>({ text: 'Tashkent, Amir Temur Avenue 14', inZone: true });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [marketplacePromos, setMarketplacePromos] = useState<Promo[]>([]);
  const [deliveryMode, setDeliveryModeState] = useState<DeliveryMode>('delivery');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCart(readStorage<CartLine[]>('marketplace_cart', []));
    setUser(readStorage<MockUser | null>('marketplace_user', null));
    setAddressState(readStorage<SavedAddress>('marketplace_address', { text: 'Tashkent, Amir Temur Avenue 14', inZone: true }));
    setFavorites(readStorage<string[]>('marketplace_favorites', []));
    if (!isFirestoreDataSource()) {
      setOrders(readStorage<LocalOrder[]>('marketplace_orders', []));
    }
    setPromo(readStorage<Promo | null>('marketplace_promo', null));
    setDeliveryModeState(readStorage<DeliveryMode>('marketplace_delivery_mode', 'delivery'));
    setLoaded(true);
  }, []);

  useEffect(() => {
    setDataLoading(true);
    setDataError(null);

    getPromos()
      .then(setMarketplacePromos)
      .catch(() => setDataError(FRIENDLY_DATA_ERROR));

    const unsubscribe = subscribeRestaurants(
      (restaurantRecords) => {
        setRestaurants(restaurantRecords);
        setDataLoading(false);
      },
      (error) => {
        console.error('Marketplace restaurants subscription failed:', error);
        setDataError(FRIENDLY_DATA_ERROR);
        setRestaurants([]);
        setDataLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const reloadOrders = useCallback(async () => {
    try {
      const records = await getOrdersByUser(MOCK_CUSTOMER_ID);
      setOrders(records);
    } catch (error) {
      console.error('Marketplace orders load failed:', error);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    reloadOrders();
  }, [loaded, reloadOrders]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('marketplace_cart', JSON.stringify(cart));
    localStorage.setItem('marketplace_user', JSON.stringify(user));
    localStorage.setItem('marketplace_address', JSON.stringify(address));
    localStorage.setItem('marketplace_favorites', JSON.stringify(favorites));
    if (!isFirestoreDataSource()) {
      localStorage.setItem('marketplace_orders', JSON.stringify(orders));
    }
    localStorage.setItem('marketplace_promo', JSON.stringify(promo));
    localStorage.setItem('marketplace_delivery_mode', JSON.stringify(deliveryMode));
  }, [address, cart, deliveryMode, favorites, loaded, orders, promo, user]);

  const addDish = (restaurant: Restaurant, dish: Dish, quantity = 1) => {
    setCart((current) => {
      if (!dish.available) return current;
      if (current.length > 0 && current[0].restaurantSlug !== restaurant.slug) {
        const replace = window.confirm('Your cart has items from another restaurant. Replace it?');
        if (!replace) return current;
        return [{
          ...dish,
          quantity,
          restaurantName: restaurant.name,
          restaurantSlug: restaurant.slug,
          restaurantMinOrder: restaurant.minOrder,
          restaurantDeliveryFee: restaurant.deliveryFee,
        }];
      }
      const existing = current.find((item) => item.id === dish.id);
      if (existing) {
        return current.map((item) => item.id === dish.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, {
        ...dish,
        quantity,
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        restaurantMinOrder: restaurant.minOrder,
        restaurantDeliveryFee: restaurant.deliveryFee,
      }];
    });
  };

  const updateQuantity = (dishId: string, delta: number) => {
    setCart((current) => current
      .map((item) => item.id === dishId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const removeDish = (dishId: string) => setCart((current) => current.filter((item) => item.id !== dishId));
  const clearCart = () => setCart([]);
  const setAddress = (next: SavedAddress) => setAddressState(next);
  const toggleFavorite = (restaurantId: string) => setFavorites((current) => current.includes(restaurantId) ? current.filter((id) => id !== restaurantId) : [...current, restaurantId]);
  const login = (name: string, phone: string) => setUser({ name, phone });
  const logout = () => setUser(null);
  const setDeliveryMode = (mode: DeliveryMode) => setDeliveryModeState(mode);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length === 0 || promo?.type === 'freeDelivery' ? 0 : cart[0].restaurantDeliveryFee;
  const serviceFee = subtotal > 0 ? 3000 : 0;
  const discount = promo?.type === 'percent' ? Math.round(subtotal * (promo.value / 100)) : 0;
  const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const applyPromo = (code: string) => {
    const found = marketplacePromos.find((item) => item.code.toLowerCase() === code.trim().toLowerCase());
    if (!found) return false;
    setPromo(found);
    return true;
  };
  const removePromo = () => setPromo(null);

  const placeOrder = useCallback(async (payload: { name: string; phone: string; address: string; paymentMethod?: 'cash' | 'card' }) => {
    const restaurant = restaurants.find((item) => item.slug === cart[0]?.restaurantSlug || item.id === cart[0]?.restaurantId);
    const orderInput: MarketplaceOrderInput = {
      userId: MOCK_CUSTOMER_ID,
      restaurantId: restaurant?.id || cart[0]?.restaurantId || 'unknown',
      restaurantName: restaurant?.name || cart[0]?.restaurantName || 'Restaurant',
      restaurantLocation: restaurant?.location,
      items: cart,
      address: payload.address,
      customerName: payload.name,
      customerPhone: payload.phone,
      paymentMethod: payload.paymentMethod || 'cash',
      subtotal,
      deliveryFee,
      serviceFee,
      discount,
      total,
      promoCode: promo?.code || null,
      etaMinutes: restaurant?.etaMax || 24,
    };
    const order = await createOrder(orderInput);
    setOrders((current) => [order, ...current]);
    clearCart();
    setPromo(null);
    return order;
  }, [cart, deliveryFee, discount, promo?.code, restaurants, serviceFee, subtotal, total]);

  const value = useMemo<MarketplaceContextValue>(() => ({
    cart,
    restaurants,
    user,
    address,
    favorites,
    orders,
    promo,
    marketplacePromos,
    deliveryMode,
    dataLoading,
    dataError,
    addDish,
    updateQuantity,
    removeDish,
    clearCart,
    setAddress,
    toggleFavorite,
    login,
    logout,
    applyPromo,
    removePromo,
    setDeliveryMode,
    reloadOrders,
    placeOrder,
    subtotal,
    deliveryFee,
    serviceFee,
    discount,
    total,
    cartCount,
  }), [address, cart, cartCount, dataError, dataLoading, deliveryFee, deliveryMode, discount, favorites, marketplacePromos, orders, placeOrder, promo, reloadOrders, restaurants, serviceFee, subtotal, total, user]);

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext);
  if (!context) throw new Error('useMarketplace must be used within MarketplaceProvider');
  return context;
}
