import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  signOut,
  type FirebaseUser,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';

type ClientProfile = {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  photoURL: string;
};

type AuthContextValue = {
  user: FirebaseUser | null;
  profile: ClientProfile | null;
  initializing: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const toClientProfile = async (firebaseUser: FirebaseUser): Promise<ClientProfile> => {
  let phone = firebaseUser.phoneNumber || '';
  let displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Customer';
  let photoURL = firebaseUser.photoURL || '';

  try {
    const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      phone = String(data.phone || data.phoneNumber || phone || '');
      displayName = String(data.displayName || data.fullName || data.name || displayName);
      photoURL = String(data.photoURL || photoURL || '');
    }
  } catch (error) {
    console.warn('Failed to hydrate client profile:', error);
  }

  return {
    uid: firebaseUser.uid,
    displayName,
    email: firebaseUser.email || '',
    phone,
    photoURL,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const setStoreUser = useAuthStore((state) => state.setUser);
  const logoutStore = useAuthStore((state) => state.logout);
  const clearCart = useCartStore((state) => state.clearCart);
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        logoutStore();
        setInitializing(false);
        return;
      }

      const hydratedProfile = await toClientProfile(firebaseUser);
      setProfile(hydratedProfile);
      setStoreUser({
        uid: hydratedProfile.uid,
        displayName: hydratedProfile.displayName,
        email: hydratedProfile.email,
        phone: hydratedProfile.phone,
        photoURL: hydratedProfile.photoURL,
        role: 'client',
        savedAddresses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [logoutStore, setStoreUser]);

  useEffect(() => {
    if (initializing) return;

    const currentRoot = segments[0];
    const isAuthRoute = currentRoot === 'login' || currentRoot === 'register' || currentRoot === '(auth)';

    if (!user && !isAuthRoute) {
      router.replace('/login');
      return;
    }

    if (user && isAuthRoute) {
      router.replace('/(tabs)');
    }
  }, [initializing, router, segments, user]);

  const logout = async () => {
    clearCart();
    logoutStore();
    setProfile(null);
    await signOut(auth);
    router.replace('/login');
  };

  const value = useMemo(
    () => ({ user, profile, initializing, logout }),
    [user, profile, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
