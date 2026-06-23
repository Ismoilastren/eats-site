import { create } from 'zustand';
import type { Courier } from '@repo/shared-types';
import { COLLECTIONS } from '@repo/shared-types';
import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  onSnapshot,
  serverTimestamp,
  signInAnonymously,
  signOut as firebaseSignOut,
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

const COURIER_NOT_FOUND_MESSAGE =
  'Courier ID not found. Ask admin for the correct ID.';
const COURIER_AUTH_DISABLED_MESSAGE =
  'Courier authentication is not enabled yet. Enable Anonymous sign-in in Firebase Auth or use a supported courier login method.';
const COURIER_ALREADY_LINKED_MESSAGE =
  'This courier profile is already connected to another device/account.';
const COURIER_INACTIVE_MESSAGE =
  'This courier profile is inactive or archived. Ask admin to restore it before connecting.';

class CourierAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourierAuthError';
  }
}

const stopProfileSubscription = () => {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
};

const getFirebaseErrorCode = (error: unknown) =>
  typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

const getReadableError = (error: unknown) => {
  if (error instanceof CourierAuthError) return error.message;

  const code = getFirebaseErrorCode(error);
  if (code.includes('admin-restricted-operation')) {
    return COURIER_AUTH_DISABLED_MESSAGE;
  }
  if (code.includes('permission-denied')) {
    return 'Courier ID cannot be connected. Ask admin to verify this courier is active and not linked to another account.';
  }
  if (code.includes('network-request-failed') || code.includes('unavailable')) {
    return 'Network connection failed. Check your internet and try again.';
  }

  if (error instanceof Error && !error.message.includes('Firebase:')) {
    return error.message;
  }

  return 'Unable to connect courier profile. Please try again or ask admin for help.';
};

const waitForAuthHydration = async () => {
  const authWithReady = auth as typeof auth & {
    authStateReady?: () => Promise<void>;
  };
  if (typeof authWithReady.authStateReady === 'function') {
    await authWithReady.authStateReady();
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 1200);
    const unsubscribe = onAuthStateChanged(auth, () => {
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
};

const ensureAnonymousCourierSession = async () => {
  await waitForAuthHydration();
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  } catch (error) {
    if (getFirebaseErrorCode(error).includes('admin-restricted-operation')) {
      if (__DEV__) {
        console.warn(
          'courier-auth-anonymous-disabled',
          'Enable Anonymous sign-in in Firebase Authentication or add a supported courier login method.'
        );
      }
      throw new CourierAuthError(COURIER_AUTH_DISABLED_MESSAGE);
    }
    throw error;
  }
};

const getTextField = (data: Record<string, unknown>, key: string) =>
  typeof data[key] === 'string' ? String(data[key]).trim() : '';

const isBlockedCourierRecord = (data: Record<string, unknown>) => {
  const status = getTextField(data, 'status').toLowerCase();
  return (
    data.archived === true ||
    data.deleted === true ||
    data.isDeleted === true ||
    data.active === false ||
    data.isActive === false ||
    ['archived', 'deleted', 'disabled', 'inactive', 'suspended'].includes(status)
  );
};

const assertCourierCanConnect = (
  data: Record<string, unknown>,
  sessionUid: string
) => {
  if (isBlockedCourierRecord(data)) {
    throw new CourierAuthError(COURIER_INACTIVE_MESSAGE);
  }

  const linkedUid = getTextField(data, 'sessionUid');
  if (linkedUid && linkedUid !== sessionUid) {
    throw new CourierAuthError(COURIER_ALREADY_LINKED_MESSAGE);
  }
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
    if (!normalizedId) throw new CourierAuthError('Enter a Courier ID.');

    const courierRef = doc(db, COLLECTIONS.COURIERS, normalizedId);
    const snapshot = await getDoc(courierRef);
    if (!snapshot.exists()) throw new CourierAuthError(COURIER_NOT_FOUND_MESSAGE);

    const data = snapshot.data();
    const sessionUid = await ensureAnonymousCourierSession();
    assertCourierCanConnect(data, sessionUid);

    await updateDoc(courierRef, {
      sessionUid,
      authProvider: 'anonymous',
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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
          await updateDoc(doc(db, COLLECTIONS.COURIERS, courier.id), {
            ...getCourierOperationalFields(false, timestamp, null),
            sessionUid: null,
            authProvider: null,
          });
        }
      } catch (error) {
        if (__DEV__) console.warn('courier-sign-out-status', getReadableError(error));
      } finally {
        stopProfileSubscription();
        await clearCourierIdAsync();
        await firebaseSignOut(auth).catch(() => undefined);
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
