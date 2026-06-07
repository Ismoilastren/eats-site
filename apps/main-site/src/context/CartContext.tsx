'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { MenuItem, Restaurant } from '@repo/shared-types';

export type CartRestaurantMeta = Pick<Restaurant, 'id' | 'name' | 'imageUrl' | 'location' | 'deliveryFee'>;

export interface CartItem extends MenuItem {
  quantity: number;
  restaurantName?: string;
  restaurantImage?: string;
  restaurantLocation?: Restaurant['location'];
  restaurantDeliveryFee?: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity?: number, restaurant?: CartRestaurantMeta) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse cart from local storage", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const addToCart = (item: MenuItem, quantity: number = 1, restaurant?: CartRestaurantMeta) => {
    setCart(prev => {
      const nextItem: CartItem = {
        ...item,
        quantity,
        restaurantName: restaurant?.name,
        restaurantImage: restaurant?.imageUrl,
        restaurantLocation: restaurant?.location,
        restaurantDeliveryFee: restaurant?.deliveryFee,
      };

      if (prev.length > 0 && prev[0].restaurantId !== item.restaurantId) {
        return [nextItem];
      }

      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? {
          ...i,
          quantity: i.quantity + quantity,
          restaurantName: restaurant?.name ?? i.restaurantName,
          restaurantImage: restaurant?.imageUrl ?? i.restaurantImage,
          restaurantLocation: restaurant?.location ?? i.restaurantLocation,
          restaurantDeliveryFee: restaurant?.deliveryFee ?? i.restaurantDeliveryFee,
        } : i);
      }
      return [...prev, nextItem];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQ = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQ };
      }
      return i;
    }));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
