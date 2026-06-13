'use client';
import React, { useState } from 'react';
import { db, doc, setDoc } from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import toast from 'react-hot-toast';

const DEMO_USERS = [
  { uid: 'demo_user_1', displayName: 'Alisher Navoiy', email: 'alisher@yandex.uz', phone: '+998901234561', role: 'customer' },
  { uid: 'demo_user_2', displayName: 'Zahiriddin Bobur', email: 'bobur@yandex.uz', phone: '+998901234562', role: 'customer' },
  { uid: 'demo_user_3', displayName: 'Mirzo Ulugbek', email: 'ulugbek@science.uz', phone: '+998901234563', role: 'customer' },
  { uid: 'demo_user_4', displayName: 'Ibn Sino', email: 'ibnsino@med.uz', phone: '+998901234564', role: 'customer' },
  { uid: 'demo_user_5', displayName: 'Al-Xorazmiy', email: 'xorazmiy@math.uz', phone: '+998901234565', role: 'customer' },
  { uid: 'demo_user_6', displayName: 'Amir Temur', email: 'temur@empire.uz', phone: '+998901234566', role: 'customer' },
  { uid: 'demo_user_7', displayName: 'Jaloliddin Manguberdi', email: 'jaloliddin@khorezm.uz', phone: '+998901234567', role: 'customer' },
  { uid: 'demo_user_8', displayName: 'Nodira Begim', email: 'nodira@poetry.uz', phone: '+998901234568', role: 'customer' },
  { uid: 'demo_user_9', displayName: 'Zulfiya', email: 'zulfiya@poetry.uz', phone: '+998901234569', role: 'customer' },
  { uid: 'demo_user_10', displayName: 'Abdulla Qodiriy', email: 'qodiriy@novel.uz', phone: '+998901234570', role: 'customer' },
];

const DEMO_ADMINS = [
  { uid: 'demo_admin_1', displayName: 'Express (Admin)', email: 'admin1@express.uz', phone: '+998991112231', role: 'admin' },
  { uid: 'demo_admin_2', displayName: 'Super Admin', email: 'super@express.uz', phone: '+998991112232', role: 'admin' },
  { uid: 'demo_admin_3', displayName: 'Manager 1', email: 'manager1@express.uz', phone: '+998991112233', role: 'admin' },
  { uid: 'demo_admin_4', displayName: 'Manager 2', email: 'manager2@express.uz', phone: '+998991112234', role: 'admin' },
  { uid: 'demo_admin_5', displayName: 'Support Lead', email: 'support@express.uz', phone: '+998991112235', role: 'admin' },
  { uid: 'demo_admin_6', displayName: 'Marketing Head', email: 'marketing@express.uz', phone: '+998991112236', role: 'admin' },
  { uid: 'demo_admin_7', displayName: 'Operations Lead', email: 'ops@express.uz', phone: '+998991112237', role: 'admin' },
  { uid: 'demo_admin_8', displayName: 'Finance Admin', email: 'finance@express.uz', phone: '+998991112238', role: 'admin' },
  { uid: 'demo_admin_9', displayName: 'HR Admin', email: 'hr@express.uz', phone: '+998991112239', role: 'admin' },
  { uid: 'demo_admin_10', displayName: 'Tech Lead', email: 'tech@express.uz', phone: '+998991112240', role: 'admin' },
];

export default function SeedPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const isProduction = process.env.NODE_ENV === 'production';

  const handleSeed = async () => {
    if (isProduction || confirmation !== 'SEED DEMO DATA') {
      toast.error('Demo seeding is disabled without explicit local confirmation.');
      return;
    }

    setIsSeeding(true);
    toast.loading('Seeding data into Firestore...', { id: 'seed' });

    try {
      const promises = [...DEMO_USERS, ...DEMO_ADMINS].map((user) => 
        setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
          ...user,
          createdAt: new Date(),
        })
      );

      await Promise.all(promises);
      toast.success('Successfully injected 10 demo users and 10 demo admins!', { id: 'seed' });
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to seed: ' + error.message, { id: 'seed' });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="max-w-lg rounded-xl bg-white p-8 shadow-sm dark:bg-gray-800 text-center space-y-4">
        <h1 className="text-2xl font-bold">Data Seeder</h1>
        {isProduction ? (
          <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-left text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            Demo seeding is disabled in production. Use the live admin workflows to create users, restaurants, couriers, and orders.
          </div>
        ) : (
          <>
            <p className="text-gray-500">Local-only utility for injecting demo accounts into Firestore.</p>
            <label className="block text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
              Type SEED DEMO DATA to enable
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="SEED DEMO DATA"
              />
            </label>
          </>
        )}
        <button
          onClick={handleSeed}
          disabled={isProduction || isSeeding || confirmation !== 'SEED DEMO DATA'}
          className="rounded-lg bg-brand-500 px-6 py-3 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {isProduction ? 'Disabled in Production' : isSeeding ? 'Seeding...' : 'Run Local Seed Script'}
        </button>
      </div>
    </div>
  );
}
