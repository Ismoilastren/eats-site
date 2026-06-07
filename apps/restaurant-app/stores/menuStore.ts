import { create } from 'zustand';
import type { MenuItem } from '@repo/shared-types';
import { db, doc, updateDoc, arrayUnion, arrayRemove } from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuthStore } from './authStore';

interface MenuState {
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  addMenuItem: (item: MenuItem) => Promise<void>;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleAvailability: (id: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>()((set, get) => ({
  menuItems: [],
  setMenuItems: (items) => set({ menuItems: items }),

  addMenuItem: async (item) => {
    const restaurantId = useAuthStore.getState().restaurant?.id;
    if (!restaurantId) return;

    const docRef = doc(db, COLLECTIONS.RESTAURANTS, restaurantId);
    await updateDoc(docRef, {
      menu: arrayUnion(item)
    });
    // Optimistic UI update not strictly needed if onSnapshot is fast, but good for UX
    set((state) => ({ menuItems: [...state.menuItems, item] }));
  },

  updateMenuItem: async (id, updates) => {
    const restaurantId = useAuthStore.getState().restaurant?.id;
    if (!restaurantId) return;

    const state = get();
    const existingItem = state.menuItems.find(i => i.id === id);
    if (!existingItem) return;

    const updatedItem = { ...existingItem, ...updates };
    
    // We update the entire array to replace the object
    const newMenuArray = state.menuItems.map(i => i.id === id ? updatedItem : i);

    const docRef = doc(db, COLLECTIONS.RESTAURANTS, restaurantId);
    await updateDoc(docRef, {
      menu: newMenuArray
    });

    set({ menuItems: newMenuArray });
  },

  deleteMenuItem: async (id) => {
    const restaurantId = useAuthStore.getState().restaurant?.id;
    if (!restaurantId) return;

    const state = get();
    const itemToDelete = state.menuItems.find(i => i.id === id);
    if (!itemToDelete) return;

    const docRef = doc(db, COLLECTIONS.RESTAURANTS, restaurantId);
    
    // We can use arrayRemove if we pass the EXACT object, or just update the whole array
    await updateDoc(docRef, {
      menu: arrayRemove(itemToDelete)
    });

    set({ menuItems: state.menuItems.filter(i => i.id !== id) });
  },

  toggleAvailability: async (id) => {
    const restaurantId = useAuthStore.getState().restaurant?.id;
    if (!restaurantId) return;

    const state = get();
    const item = state.menuItems.find(i => i.id === id);
    if (!item) return;

    const updatedItem = { ...item, isAvailable: !item.isAvailable };
    const newMenuArray = state.menuItems.map(i => i.id === id ? updatedItem : i);

    const docRef = doc(db, COLLECTIONS.RESTAURANTS, restaurantId);
    await updateDoc(docRef, {
      menu: newMenuArray
    });

    set({ menuItems: newMenuArray });
  },
}));
