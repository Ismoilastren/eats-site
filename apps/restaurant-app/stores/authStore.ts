import { create } from 'zustand';
import type { Restaurant } from '@repo/shared-types';

interface User {
  uid: string;
  email: string;
}

interface AuthState {
  user: User | null;
  restaurant: Restaurant | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setRestaurant: (restaurant: Restaurant | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  restaurant: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setRestaurant: (restaurant) => set({ restaurant }),
  logout: () => set({ user: null, restaurant: null, isAuthenticated: false }),
}));
