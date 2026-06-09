'use client';

import { RefreshCw } from 'lucide-react';
import { formatCurrencyUZS } from '@repo/shared-types';
import { isFirestoreDataSource, ORDER_STATUS_LABELS, type OrderStatus } from '@/services/marketplace';

const statusClass: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready_for_pickup: 'bg-purple-100 text-purple-800',
  picked_up: 'bg-indigo-100 text-indigo-800',
  on_the_way: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
};

export function ModeBadge() {
  const firestore = isFirestoreDataSource();
  return (
    <span className={`rounded-full px-4 py-2 text-sm font-black ${firestore ? 'bg-green-100 text-green-700' : 'bg-gray-950 text-white'}`}>
      {firestore ? 'Firestore mode' : 'Mock mode'}
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function StatCard({ label, value, tone = 'white' }: { label: string; value: string | number; tone?: 'white' | 'dark' | 'yellow' }) {
  const className = tone === 'dark'
    ? 'bg-gray-950 text-white'
    : tone === 'yellow'
      ? 'bg-yellow-300 text-gray-950'
      : 'bg-white text-gray-950';

  return (
    <div className={`rounded-[28px] p-5 shadow-sm ring-1 ring-black/5 ${className}`}>
      <p className={`text-sm font-black uppercase tracking-widest ${tone === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 font-black text-white disabled:opacity-60">
      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
      Refresh
    </button>
  );
}

export function money(value: number) {
  return formatCurrencyUZS(Number(value || 0));
}
