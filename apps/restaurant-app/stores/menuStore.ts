import { create } from 'zustand';
import type { MenuItem } from '@repo/shared-types';
import { db, doc, setDoc, deleteDoc } from '@repo/firebase-config';
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

    const normalizedItem = {
      ...item,
      restaurantId,
      isAvailable: item.isAvailable ?? true,
      sortOrder: Number(item.sortOrder || 0),
      updatedAt: new Date(),
      createdAt: item.createdAt || new Date(),
    };

    await Promise.all([
      setDoc(doc(db, COLLECTIONS.MENU_ITEMS, item.id), normalizedItem, { merge: true }),
      setDoc(doc(db, COLLECTIONS.RESTAURANTS, restaurantId, 'dishes', item.id), normalizedItem, { merge: true }),
    ]);

    set((state) => ({ menuItems: [...state.menuItems, item] }));
  },

  updateMenuItem: async (id, updates) => {
    const restaurantId = useAuthStore.getState().restaurant?.id;
    if (!restaurantId) return;

    const state = get();
    const existingItem = state.menuItems.find(i => i.id === id);
    if (!existingItem) return;

    const updatedItem = { ...existingItem, ...updates, restaurantId, updatedAt: new Date() };
    const newMenuArray = state.menuItems.map(i => i.id === id ? updatedItem : i);

    await Promise.all([
      setDoc(doc(db, COLLECTIONS.MENU_ITEMS, id), updatedItem, { merge: true }),
      setDoc(doc(db, COLLECTIONS.RESTAURANTS, restaurantId, 'dishes', id), updatedItem, { merge: true }),
    ]);

    set({ menuItems: newMenuArray });
  },

  deleteMenuItem: async (id) => {
    const restaurantId = useAuthStore.getState().restaurant?.id;
    if (!restaurantId) return;

    const state = get();
    const itemToDelete = state.menuItems.find(i => i.id === id);
    if (!itemToDelete) return;

    await Promise.all([
      deleteDoc(doc(db, COLLECTIONS.MENU_ITEMS, id)),
      deleteDoc(doc(db, COLLECTIONS.RESTAURANTS, restaurantId, 'dishes', id)),
    ]);

    set({ menuItems: state.menuItems.filter(i => i.id !== id) });
  },

  toggleAvailability: async (id) => {
    const restaurantId = useAuthStore.getState().restaurant?.id;
    if (!restaurantId) return;

    const state = get();
    const item = state.menuItems.find(i => i.id === id);
    if (!item) return;

    const updatedItem = { ...item, restaurantId, isAvailable: !item.isAvailable, updatedAt: new Date() };
    const newMenuArray = state.menuItems.map(i => i.id === id ? updatedItem : i);

    await Promise.all([
      setDoc(doc(db, COLLECTIONS.MENU_ITEMS, id), updatedItem, { merge: true }),
      setDoc(doc(db, COLLECTIONS.RESTAURANTS, restaurantId, 'dishes', id), updatedItem, { merge: true }),
    ]);

    set({ menuItems: newMenuArray });
  },
}));
