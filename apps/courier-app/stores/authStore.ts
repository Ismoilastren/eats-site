import { create } from 'zustand';
import type { Courier } from '@repo/shared-types';
import { COLLECTIONS } from '@repo/shared-types';
import {
  db,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from '@repo/firebase-config';
import { clearCourierIdAsync, getCourierIdAsync, setCourierIdAsync } from '../utils/storage';

interface AuthState {
  courier: Courier | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (courierId: string) => Promise<void>;
  signOut: () => Promise<void>;
  toggleOnline: () => Promise<void>;
  clearError: () => void;
}

let unsubscribeSnapshot: (() => void) | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  courier: null,
  isAuthenticated: false,
  isOnline: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      const savedId = await getCourierIdAsync();
      if (savedId) {
        const courierDocRef = doc(db, COLLECTIONS.COURIERS, savedId);
        const courierSnap = await getDoc(courierDocRef);

        if (courierSnap.exists()) {
          const courierData = { id: courierSnap.id, ...courierSnap.data() } as Courier;
          set({
            courier: courierData,
            isAuthenticated: true,
            isOnline: courierData.isOnline || false,
            isLoading: false,
            error: null,
          });

          // Setup real-time listener for the profile
          if (unsubscribeSnapshot) unsubscribeSnapshot();
          unsubscribeSnapshot = onSnapshot(courierDocRef, (snap) => {
            if (snap.exists()) {
              const data = { id: snap.id, ...snap.data() } as Courier;
              set({ courier: data, isOnline: data.isOnline || false });
            }
          });
        } else {
          await clearCourierIdAsync();
          set({ isAuthenticated: false, isLoading: false });
        }
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('Initialize error:', error);
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  signIn: async (courierId: string) => {
    set({ isLoading: true, error: null });
    try {
      const courierDocRef = doc(db, COLLECTIONS.COURIERS, courierId);
      const courierSnap = await getDoc(courierDocRef);

      if (courierSnap.exists()) {
        const courierData = { id: courierSnap.id, ...courierSnap.data() } as Courier;
        await setCourierIdAsync(courierId);
        
        set({
          courier: courierData,
          isAuthenticated: true,
          isOnline: courierData.isOnline || false,
          isLoading: false,
          error: null,
        });

        if (unsubscribeSnapshot) unsubscribeSnapshot();
        unsubscribeSnapshot = onSnapshot(courierDocRef, (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Courier;
            set({ courier: data, isOnline: data.isOnline || false });
          }
        });
      } else {
        set({ isLoading: false, error: 'Invalid Courier ID. Not found in couriers collection.' });
      }
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Failed to login' });
    }
  },

  signOut: async () => {
    try {
      const { courier } = get();
      if (courier) {
        const courierRef = doc(db, COLLECTIONS.COURIERS, courier.id);
        await updateDoc(courierRef, {
          isOnline: false,
          isAvailable: false,
          updatedAt: serverTimestamp(),
        });
      }
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      await clearCourierIdAsync();
      set({
        courier: null,
        isAuthenticated: false,
        isOnline: false,
        error: null,
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  },

  toggleOnline: async () => {
    const { courier, isOnline } = get();
    if (!courier) return;

    const newStatus = !isOnline;
    // Optimistic update for snappy UI
    set({
      isOnline: newStatus,
      courier: { ...courier, isOnline: newStatus, isAvailable: newStatus },
    });

    try {
      const courierRef = doc(db, COLLECTIONS.COURIERS, courier.id);
      await updateDoc(courierRef, {
        isOnline: newStatus,
        isAvailable: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to toggle online status:', error);
      // Revert on failure
      set({
        isOnline: !newStatus,
        courier: { ...courier, isOnline: !newStatus, isAvailable: !newStatus },
      });
    }
  },

  clearError: () => set({ error: null }),
}));
