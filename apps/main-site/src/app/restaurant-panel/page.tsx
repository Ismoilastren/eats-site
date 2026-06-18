'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock, X } from 'lucide-react';
import type { LocalOrder } from '@/context/MarketplaceContext';
import type { Restaurant } from '@/data/marketplace';
import { getRestaurants, isActiveOrderStatus, subscribeToOrders, updateOrderStatus, type OrderStatus } from '@/services/marketplace';
import { getNextRestaurantStatus } from '@repo/shared-types';
import { ModeBadge, money, RefreshButton, StatCard, StatusBadge } from '@/components/ops/OpsUi';

export default function RestaurantPanelPage() {
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const loadRestaurants = useCallback(async () => {
    try {
      const records = await getRestaurants();
      setRestaurants(records);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load restaurants');
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
    const unsubscribe = subscribeToOrders(
      (records) => {
        setOrders(records);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [loadRestaurants]);

  const filtered = useMemo(() => {
    return selectedRestaurantId === 'all'
      ? orders
      : orders.filter((order) => order.restaurantId === selectedRestaurantId);
  }, [orders, selectedRestaurantId]);

  const activeOrders = filtered.filter((order) => isActiveOrderStatus(order.status));
  const pastOrders = filtered.filter((order) => !isActiveOrderStatus(order.status));
  const todayOrders = filtered.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const averageOrder = todayOrders.length ? Math.round(todayRevenue / todayOrders.length) : 0;

  const mutateStatus = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    setError('');
    try {
      await updateOrderStatus(orderId, status, 'restaurant');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to update order');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 font-black shadow-sm"><ArrowLeft size={18} /> Customer site</Link>
            <h1 className="text-5xl font-black">Restaurant Panel</h1>
            <p className="mt-2 font-bold text-gray-500">Kitchen order control for pending, preparing and pickup states.</p>
          </div>
          <div className="flex items-center gap-2">
            <ModeBadge />
            <RefreshButton onClick={loadRestaurants} loading={loading} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Today orders" value={todayOrders.length} tone="yellow" />
          <StatCard label="Today revenue" value={money(todayRevenue)} />
          <StatCard label="Average order" value={money(averageOrder)} />
          <StatCard label="Active orders" value={activeOrders.length} tone="dark" />
        </div>

        {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600">{error}</p>}

        <section className="mt-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Active orders</h2>
            <select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} className="rounded-2xl bg-gray-100 px-4 py-3 font-black outline-none">
              <option value="all">All restaurants</option>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
          </div>
          <div className="mt-5 overflow-x-auto">
            {loading ? (
              <div className="h-44 animate-pulse rounded-[24px] bg-gray-100" />
            ) : activeOrders.length === 0 ? (
              <EmptyState text="No active kitchen orders." />
            ) : (
              <table className="min-w-[980px] w-full text-left">
                <thead className="text-sm font-black uppercase tracking-widest text-gray-400">
                  <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
                </thead>
                <tbody>
                  {activeOrders.map((order) => <OrderRow key={order.id} order={order} busy={busyId === order.id} onStatus={mutateStatus} />)}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-3xl font-black">Past orders</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pastOrders.slice(0, 8).map((order) => (
              <div key={order.id} className="rounded-[24px] bg-gray-50 p-4">
                <div className="flex justify-between gap-3">
                  <p className="font-black">#{order.id}</p>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 font-bold text-gray-500">{order.restaurantName} · {money(order.total)}</p>
              </div>
            ))}
            {pastOrders.length === 0 && <EmptyState text="No completed, cancelled or rejected orders yet." />}
          </div>
        </section>
      </main>
    </div>
  );
}

function OrderRow({ order, busy, onStatus }: { order: LocalOrder; busy: boolean; onStatus: (id: string, status: OrderStatus) => void }) {
  const next = getNextRestaurantStatus(order.status as OrderStatus);
  const customerNote = order.deliveryInstructions || order.customerComment || '';
  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="p-3">
        <p className="font-black">#{order.id}</p>
        <p className="text-sm font-bold text-gray-500">{order.restaurantName}</p>
      </td>
      <td className="p-3">
        <p className="font-black">{order.name}</p>
        <p className="font-bold text-gray-500">{order.phone}</p>
        <p className="max-w-[220px] text-sm font-semibold text-gray-400">{order.customerAddress || order.address}</p>
        {customerNote ? (
          <p className="mt-2 max-w-[260px] rounded-2xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
            Note: {customerNote}
          </p>
        ) : null}
      </td>
      <td className="p-3">
        {order.items.map((item) => <p key={item.id} className="font-bold">{item.quantity}x {item.name}</p>)}
        <p className="mt-2 font-black">{money(order.total)}</p>
      </td>
      <td className="p-3 font-bold">{order.paymentMethod}</td>
      <td className="p-3"><StatusBadge status={order.status} /></td>
      <td className="p-3">
        <div className="flex flex-wrap gap-2">
          {next && <button disabled={busy} onClick={() => onStatus(order.id, next)} className="inline-flex items-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 font-black text-white disabled:opacity-50"><Check size={16} /> Move next</button>}
          {order.status === 'pending' && <button disabled={busy} onClick={() => onStatus(order.id, 'rejected')} className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600 disabled:opacity-50"><X size={16} /> Reject</button>}
        </div>
      </td>
    </tr>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[24px] bg-gray-50 p-8 text-center font-black text-gray-400"><Clock className="mx-auto mb-3" />{text}</div>;
}
