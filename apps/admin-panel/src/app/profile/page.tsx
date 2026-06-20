'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateProfile, db, doc, getDoc, setDoc } from '@repo/firebase-config';
import toast from 'react-hot-toast';
import { displayAdminRole, normalizeAdminRole, normalizeEmail } from '@/lib/adminAuth';

export default function ProfilePage() {
  const { user, refreshUser, adminRole } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    if (user) {
      const emailName = normalizeEmail(user.email).split('@')[0] || 'Admin user';
      setNickname(user.displayName || emailName);

      getDoc(doc(db, 'users', user.uid)).then(snapshot => {
        const storedRole = snapshot.exists() ? normalizeAdminRole(snapshot.data().role) : '';
        setUserRole(storedRole || normalizeAdminRole(adminRole));
      }).catch(err => {
        console.warn('Failed to fetch role:', err);
        setUserRole(normalizeAdminRole(adminRole));
      });
    }
  }, [adminRole, user]);

  const handleSave = async () => {
    if (!user) return;
    if (!nickname.trim()) {
      toast.error('Nickname cannot be empty');
      return;
    }
    
    setIsSaving(true);
    const toastId = toast.loading('Saving nickname...');
    
    try {
      // Step 1: Update Firebase Auth (Critical for UI)
      await updateProfile(user, { displayName: nickname });
      
      // Step 2: Update Firestore (Background sync, don't wait for it)
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, { 
        displayName: nickname,
        email: user.email
      }, { merge: true }).catch(err => console.warn('Background sync failed:', err));
      
      refreshUser();
      toast.success('Nickname updated successfully!', { id: toastId });
      setIsEditing(false);
    } catch (error: unknown) {
      console.error('Failed to save profile:', error);
      const message = error instanceof Error ? error.message : 'Failed to update';
      toast.error(`Error: ${message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const displayName = user?.displayName || normalizeEmail(user?.email).split('@')[0] || 'Admin user';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const effectiveRole = normalizeAdminRole(userRole || adminRole);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View your account information and role.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-2xl font-bold text-white uppercase shadow-sm shrink-0">
            {avatarLetter}
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
                <button 
                  onClick={handleSave} 
                  disabled={isSaving} 
                  className="rounded bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setNickname(displayName);
                  }} 
                  disabled={isSaving} 
                  className="rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </h2>
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="text-gray-400 hover:text-brand-500 transition-colors"
                  title="Edit Nickname"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </div>
            )}
            
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
              effectiveRole === 'superadmin'
                ? 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20'
                : effectiveRole
                  ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20'
                  : 'bg-gray-50 text-gray-600 ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-300 dark:ring-gray-500/20'
            }`}>
              {displayAdminRole(effectiveRole)}
            </span>
          </div>
        </div>
        
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
            <div className="flex gap-2">
              <input 
                type="email" 
                disabled 
                value={user?.email || 'Loading...'} 
                className="w-full rounded-lg border border-gray-300 p-2.5 outline-none bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed" 
              />
              <button 
                onClick={() => copyToClipboard(user?.email || '', 'Email address')}
                className="flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white p-2.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors"
                title="Copy Email"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Your email address cannot be changed from this panel.</p>
          </div>
          
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Account ID</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                disabled 
                value={user?.uid || 'Loading...'} 
                className="w-full rounded-lg border border-gray-300 p-2.5 outline-none bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed font-mono text-sm" 
              />
              <button 
                onClick={() => copyToClipboard(user?.uid || '', 'Account ID')}
                className="flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white p-2.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors"
                title="Copy ID"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
