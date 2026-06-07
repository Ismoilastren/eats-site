'use client';
import React, { useState, useEffect } from 'react';
import { db, doc, getDoc, setDoc } from '@repo/firebase-config';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    baseDeliveryFee: 10000,
    feePerKm: 1500,
    taxRate: 12
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        
        const docSnap = await getDoc(docRef);
        
        if (docSnap && docSnap.exists()) {
          setSettings(docSnap.data() as any);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, 'settings', 'global');
      // Fire-and-forget background sync
      setDoc(docRef, settings, { merge: true }).catch(err => console.warn('Background sync failed:', err));
      toast.success('System settings saved securely to Firestore.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading settings... (Network might be slow)</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage global platform configurations directly on Firestore.</p>
      </div>
      
      <form onSubmit={handleSave} className="space-y-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-medium dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">Delivery Rules</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Base Delivery Fee (UZS)</label>
            <input 
              type="number" 
              value={settings.baseDeliveryFee}
              onChange={(e) => setSettings({...settings, baseDeliveryFee: Number(e.target.value)})}
              step="100" 
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fee per Kilometer (UZS)</label>
            <input 
              type="number" 
              value={settings.feePerKm}
              onChange={(e) => setSettings({...settings, feePerKm: Number(e.target.value)})}
              step="100" 
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tax Rate (%)</label>
            <input 
              type="number" 
              value={settings.taxRate}
              onChange={(e) => setSettings({...settings, taxRate: Number(e.target.value)})}
              step="1" 
              className="w-full rounded-lg border border-gray-300 p-2.5 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" 
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSaving}
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-white font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving to Firestore...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
