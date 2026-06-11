'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Home, Package, Search } from 'lucide-react';
import { auth, db, doc, getDoc, onAuthStateChanged } from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { useMarketplace, type LocalOrder } from '@/context/MarketplaceContext';
import { getOrdersForCustomer } from '@/services/marketplace';
import {
  formatOrderDate,
  formatOrderTotalSafe,
  getCustomerOrderStatus,
  isSuspiciousOrderTotal,
} from '@/lib/orderDisplay';

type StatusFilter = 'all' | 'active' | 'delivered' | 'cancelled';

const PAGE_SIZE = 10;

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const { user: marketplaceUser } = useMarketplace();
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError('');

      try {
        let profilePhone = '';
        if (firebaseUser) {
          const profileSnapshot = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
          if (profileSnapshot.exists()) {
            profilePhone = String(profileSnapshot.data().phone || '');
          }
        }

        const records = await getOrdersForCustomer({
          userId: firebaseUser?.uid,
          emails: [firebaseUser?.email, marketplaceUser?.email],
          phones: [profilePhone, marketplaceUser?.phone],
        });

        if (active) setOrders(records);
      } catch (loadError) {
        console.error('Customer order history load failed:', loadError);
        if (active) {
          setOrders([]);
          setError('Could not load order history. Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [marketplaceUser?.email, marketplaceUser?.phone]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, statusFilter]);

  const filteredOrders = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const orderStatus = getCustomerOrderStatus(order.status).status;
      const matchesSearch = !queryText
        || order.id.toLowerCase().includes(queryText)
        || (order.restaurantName || 'Restaurant').toLowerCase().includes(queryText);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && !['delivered', 'cancelled', 'rejected'].includes(orderStatus))
        || (statusFilter === 'delivered' && orderStatus === 'delivered')
        || (statusFilter === 'cancelled' && ['cancelled', 'rejected'].includes(orderStatus));

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const visibleOrders = filteredOrders.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <MarketplaceHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-6 lg:px-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-3 font-bold shadow-sm ring-1 ring-black/5">
            <Home size={17} />
            Back to home
          </Link>
          <Link href="/profile" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-3 font-bold shadow-sm ring-1 ring-black/5">
            <ArrowLeft size={18} />
            Back to profile
          </Link>
        </div>

        <div className="mt-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-yellow-600">Your account</p>
              <h1 className="mt-1 text-4xl font-black md:text-5xl">Order history</h1>
              <p className="mt-2 font-medium text-gray-500">Review active and completed deliveries.</p>
            </div>
            <label className="relative block w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by order ID or restaurant"
                className="w-full rounded-2xl bg-gray-100 py-4 pl-12 pr-4 font-semibold outline-none ring-yellow-300 transition focus:ring-2"
              />
            </label>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold transition ${
                  statusFilter === filter.id
                    ? 'bg-gray-950 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-600">{error}</p>
        )}

        {loading ? (
          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-[28px] bg-white" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-5 rounded-[32px] bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Package size={30} />
            </div>
            <p className="mt-4 text-2xl font-black">No orders found</p>
            <p className="mt-2 font-medium text-gray-500">
              {orders.length === 0
                ? 'Your orders will appear here after checkout.'
                : 'Try another search or status filter.'}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {visibleOrders.map((order) => {
              const orderStatus = getCustomerOrderStatus(order.status);
              const needsReview = isSuspiciousOrderTotal(order.total);

              return (
                <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">Order #{order.id.slice(0, 8).toUpperCase()}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${orderStatus.className}`}>
                          {orderStatus.label}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-lg font-bold text-gray-700">
                        {order.restaurantName || 'Restaurant'}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-500">{formatOrderDate(order.createdAt)}</p>
                    </div>

                    <div className="sm:text-right">
                      <p className={`font-black ${needsReview ? 'text-amber-700' : 'text-gray-950'}`}>
                        {formatOrderTotalSafe(order.total)}
                      </p>
                      {needsReview && <p className="mt-1 text-xs font-bold text-amber-600">Review required</p>}
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                    <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1 rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white hover:bg-gray-800">
                      View details
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </article>
              );
            })}

            {visibleCount < filteredOrders.length && (
              <button
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                className="w-full rounded-2xl bg-white px-5 py-4 font-bold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-yellow-50"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
