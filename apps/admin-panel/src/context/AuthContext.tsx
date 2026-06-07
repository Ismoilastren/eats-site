'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, signOut, type FirebaseUser, db, doc, setDoc } from '@repo/firebase-config';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userUpdateTick, setUserUpdateTick] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Automatically sync the user to Firestore so they appear in lists and their displayName is current
        try {
          const isMainAdmin = currentUser.email === 'admin@2321eats.com' || currentUser.email === 'mainadmin@demo.com';
          
          await setDoc(doc(db, 'users', currentUser.uid), {
            email: currentUser.email,
            displayName: currentUser.displayName,
            // Only set role to superadmin if they are the main admin, otherwise fallback to admin if not set
            ...(isMainAdmin ? { role: 'superadmin' } : { })
          }, { merge: true });
        } catch (err) {
          console.warn('Failed to sync user to Firestore on auth state change:', err);
        }

        if (pathname === '/login') {
          router.push('/');
        }
      } else {
        if (pathname !== '/login') {
          router.push('/login');
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  const refreshUser = () => setUserUpdateTick(t => t + 1);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser, ...({_tick: userUpdateTick} as any) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
