'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, signOut, type FirebaseUser, db, doc, getDoc, setDoc } from '@repo/firebase-config';
import { useRouter, usePathname } from 'next/navigation';
import { isAdminPanelRole, isMainAdminEmail, normalizeAdminRole, normalizeEmail } from '@/lib/adminAuth';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  adminRole: string | null;
  authError: string | null;
  logout: () => Promise<void>;
  refreshUser: () => void;
  _tick?: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  adminRole: null,
  authError: null,
  logout: async () => {},
  refreshUser: () => {},
  _tick: 0,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userUpdateTick, setUserUpdateTick] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = normalizeEmail(currentUser.email);
        const isMainAdmin = isMainAdminEmail(email);
        let storedRole = '';
        let displayName = currentUser.displayName || (email ? email.split('@')[0] : 'Admin user');

        try {
          const userSnapshot = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userSnapshot.exists() ? userSnapshot.data() : null;
          storedRole = normalizeAdminRole(userData?.role);
          displayName = currentUser.displayName || String(userData?.displayName || '') || displayName;
        } catch (error) {
          if (!isMainAdmin) {
            console.warn('Failed to verify admin role:', error);
            setUser(null);
            setAdminRole(null);
            setAuthError('Admin access could not be verified.');
            setLoading(false);
            await signOut(auth);
            router.replace('/login');
            return;
          }
        }

        const effectiveRole = isMainAdmin ? 'superadmin' : storedRole;
        if (!isMainAdmin && !isAdminPanelRole(effectiveRole)) {
          setUser(null);
          setAdminRole(null);
          setAuthError('This email is not allowed to access the admin panel.');
          setLoading(false);
          await signOut(auth);
          router.replace('/login');
          return;
        }

        try {
          await setDoc(doc(db, 'users', currentUser.uid), {
            email,
            displayName,
            updatedAt: new Date().toISOString(),
            ...(isMainAdmin ? { role: 'superadmin' } : {}),
          }, { merge: true });
        } catch (err) {
          console.warn('Failed to sync verified admin user to Firestore:', err);
        }

        setUser(currentUser);
        setAdminRole(effectiveRole);
        setAuthError(null);
        setLoading(false);

        if (pathname === '/login') {
          router.replace('/');
        }
      } else {
        setUser(null);
        setAdminRole(null);
        setAuthError(null);
        setLoading(false);
        if (pathname !== '/login') {
          router.replace('/login');
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const logout = async () => {
    setUser(null);
    setAdminRole(null);
    setAuthError(null);
    await signOut(auth);
    router.replace('/login');
  };
  
  const refreshUser = () => setUserUpdateTick(t => t + 1);

  return (
    <AuthContext.Provider value={{ user, loading, adminRole, authError, logout, refreshUser, _tick: userUpdateTick }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
