'use client';

import React, { useState } from 'react';
import { auth, db, doc, getDoc, setDoc, signInWithEmailAndPassword, signOut } from '@repo/firebase-config';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { isAdminPanelRole, isMainAdminEmail, normalizeAdminRole, normalizeEmail } from '@/lib/adminAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const signedInUser = credential.user;
      const signedInEmail = normalizeEmail(signedInUser.email);
      const isMainAdmin = isMainAdminEmail(signedInEmail);
      let storedRole = '';

      try {
        const userSnapshot = await getDoc(doc(db, 'users', signedInUser.uid));
        storedRole = normalizeAdminRole(userSnapshot.exists() ? userSnapshot.data().role : '');
      } catch (verifyError) {
        if (!isMainAdmin) {
          console.warn('Admin login verification failed:', verifyError);
          await signOut(auth);
          toast.error('Admin access could not be verified.');
          return;
        }
      }

      if (!isMainAdmin && !isAdminPanelRole(storedRole)) {
        await signOut(auth);
        toast.error('This email is not allowed to access the admin panel.');
        return;
      }

      if (isMainAdmin) {
        await setDoc(doc(db, 'users', signedInUser.uid), {
          email: signedInEmail,
          displayName: signedInUser.displayName || 'Main Administrator',
          role: 'superadmin',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      toast.success('Signed in successfully');
      router.replace('/');
    } catch (error: unknown) {
      console.error('Login error:', error);
      toast.error('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-gray-100 dark:border-gray-800 dark:bg-gray-800">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Login</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Welcome back! Please enter your details.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-brand-400"
              placeholder="admin@expressets.com"
            />
          </div>
          
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm outline-none transition-all focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-brand-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-70 dark:focus:ring-offset-gray-900 flex justify-center items-center gap-2"
          >
            {loading ? (
               <>
                 <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Signing in...
               </>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
