'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, db, getDocs, limit, query } from '@repo/firebase-config';
import { MARKETPLACE_DATA_SOURCE } from '@/services/marketplace';

type DebugState = {
  loading: boolean;
  ok: boolean;
  projectId: string;
  dataSource: string;
  restaurantsCount: number | null;
  ordersCount: number | null;
  error: string | null;
};

export default function ConnectionDebugPage() {
  const [state, setState] = useState<DebugState>({
    loading: true,
    ok: false,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'missing',
    dataSource: MARKETPLACE_DATA_SOURCE,
    restaurantsCount: null,
    ordersCount: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkConnection() {
      try {
        const [restaurantsSnap, ordersSnap] = await Promise.all([
          getDocs(query(collection(db, 'restaurants'), limit(1000))),
          getDocs(query(collection(db, 'orders'), limit(1000))),
        ]);

        if (cancelled) return;
        setState((current) => ({
          ...current,
          loading: false,
          ok: true,
          restaurantsCount: restaurantsSnap.size,
          ordersCount: ordersSnap.size,
          error: null,
        }));
      } catch (error) {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          loading: false,
          ok: false,
          error: error instanceof Error ? error.message : 'Firestore read failed',
        }));
      }
    }

    checkConnection();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    ['Data source', state.dataSource],
    ['Firebase project ID', state.projectId],
    ['Firestore read', state.loading ? 'Checking...' : state.ok ? 'OK' : 'Failed'],
    ['Restaurants count', state.restaurantsCount ?? '-'],
    ['Orders count', state.ordersCount ?? '-'],
    ['Fallback/mock active', state.dataSource === 'mock' ? 'Yes' : 'No'],
  ];

  return (
    <main className="min-h-screen bg-[#f6f6f3] px-4 py-10 text-gray-950">
      <section className="mx-auto max-w-3xl rounded-[36px] bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-yellow-500">Internal debug</p>
            <h1 className="mt-2 text-4xl font-black">Connection status</h1>
          </div>
          <Link href="/" className="rounded-2xl bg-gray-950 px-4 py-3 font-black text-white">Home</Link>
        </div>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-gray-100">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[180px_1fr] border-b border-gray-100 last:border-b-0">
              <div className="bg-gray-50 px-4 py-4 font-black text-gray-500">{label}</div>
              <div className="px-4 py-4 font-bold">{String(value)}</div>
            </div>
          ))}
        </div>

        {state.error && (
          <div className="mt-6 rounded-3xl bg-red-50 px-5 py-4 font-bold text-red-600">
            {state.error}
          </div>
        )}
      </section>
    </main>
  );
}
