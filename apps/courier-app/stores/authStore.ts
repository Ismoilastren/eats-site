import { create } from 'zustand';
import type { Courier } from '@repo/shared-types';
import { COLLECTIONS } from '@repo/shared-types';
import {
  db,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from '@repo/firebase-config';
import {
  getCourierOperationalFields,
  mapCourierDocument,
} from '../services/courierProfileService';
import {
  clearCourierIdAsync,
  getCourierIdAsync,
  setCourierIdAsync,
} from '../utils/storage';

interface AuthState {
  courier: Courier | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  isLoading: boolean;
  isUpdatingStatus: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signIn: (courierId: string) => Promise<void>;
  signOut: () => Promise<void>;
  toggleOnline: () => Promise<void>;
  clearError: () => void;
}

let unsubscribeSnapshot: (() => void) | null = null;

const stopProfileSubscription = () => {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
};

const getReadableError = (error: unknown) => {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code.includes('permission-denied')) {
    return 'Courier profile access is blocked. Deploy the updated Firestore rules.';
  }
  return error instanceof Error ? error.message : 'Unable to connect courier profile.';
};

export const useAuthStore = create<AuthState>()((set, get) => {
  const subscribeToProfile = (courierId: string) => {
    stopProfileSubscription();
    const courierRef = doc(db, COLLECTIONS.COURIERS, courierId);
    unsubscribeSnapshot = onSnapshot(
      courierRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          void clearCourierIdAsync();
          stopProfileSubscription();
          set({
            courier: null,
            isAuthenticated: false,
            isOnline: false,
            isLoading: false,
            error: 'Courier profile not found.',
          });
          return;
        }
        const courier = mapCourierDocument(snapshot.id, snapshot.data());
        set({
          courier,
          isAuthenticated: true,
          isOnline: courier.isOnline,
          isLoading: false,
          error: null,
        });
      },
      (error) => {
        if (__DEV__) console.warn('courier-profile-listener', error.code);
        set({ error: getReadableError(error), isLoading: false });
      }
    );
  };

  const connect = async (courierId: string) => {
    const normalizedId = courierId.trim();
    if (!normalizedId) throw new Error('Enter a Courier ID.');

    const courierRef = doc(db, COLLECTIONS.COURIERS, normalizedId);
    const snapshot = await getDoc(courierRef);
    if (!snapshot.exists()) throw new Error('Courier profile not found.');

    const courier = mapCourierDocument(snapshot.id, snapshot.data());
    await setCourierIdAsync(snapshot.id);
    set({
      courier,
      isAuthenticated: true,
      isOnline: courier.isOnline,
      isLoading: false,
      error: null,
    });
    subscribeToProfile(snapshot.id);
  };

  return {
    courier: null,
    isAuthenticated: false,
    isOnline: false,
    isLoading: true,
    isUpdatingStatus: false,
    error: null,

    initialize: async () => {
      set({ isLoading: true, error: null });
      try {
        const savedId = await getCourierIdAsync();
        if (!savedId) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }
        await connect(savedId);
      } catch (error) {
        await clearCourierIdAsync();
        stopProfileSubscription();
        set({
          courier: null,
          isAuthenticated: false,
          isOnline: false,
          isLoading: false,
          error: getReadableError(error),
        });
      }
    },

    signIn: async (courierId) => {
      set({ isLoading: true, error: null });
      try {
        await connect(courierId);
      } catch (error) {
        set({ isLoading: false, error: getReadableError(error) });
        throw error;
      }
    },

    signOut: async () => {
      const courier = get().courier;
      try {
        if (courier) {
          const timestamp = serverTimestamp();
          await updateDoc(
            doc(db, COLLECTIONS.COURIERS, courier.id),
            getCourierOperationalFields(false, timestamp, null)
          );
        }
      } catch (error) {
        if (__DEV__) console.warn('courier-sign-out-status', getReadableError(error));
      } finally {
        stopProfileSubscription();
        await clearCourierIdAsync();
        set({
          courier: null,
          isAuthenticated: false,
          isOnline: false,
          isLoading: false,
          isUpdatingStatus: false,
          error: null,
        });
      }
    },

    toggleOnline: async () => {
      const { courier, isOnline } = get();
      if (!courier) return;

      const nextOnline = !isOnline;
      set({ isUpdatingStatus: true, error: null });
      try {
        const timestamp = serverTimestamp();
        await updateDoc(
          doc(db, COLLECTIONS.COURIERS, courier.id),
          getCourierOperationalFields(
            nextOnline,
            timestamp,
            courier.currentOrderId
          )
        );
      } catch (error) {
        const message = getReadableError(error);
        set({ error: message });
        throw new Error(message);
      } finally {
        set({ isUpdatingStatus: false });
      }
    },

    clearError: () => set({ error: null }),
  };
});
