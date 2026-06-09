'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { LocalOrder } from '@/context/MarketplaceContext';
import type { Restaurant } from '@/data/marketplace';
import { getRestaurants, ORDER_STATUSES, subscribeToOrders, updateOrderStatus, type OrderStatus } from '@/services/marketplace';
import { ModeBadge, money, RefreshButton, StatCard, StatusBadge } from '@/components/ops/OpsUi';

export default function AdminDemoPage() {
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const loadRestaurants = useCallback(async () => {
    try {
      setRestaurants(await getRestaurants());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load restaurants');
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
    const unsubscribe = subscribeToOrders((records) => {
      setOrders(records);
      setLoading(false);
    });
    return unsubscribe;
  }, [loadRestaurants]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const statusMatch = statusFilter === 'all' || order.status === statusFilter;
    const restaurantMatch = restaurantFilter === 'all' || order.restaurantId === restaurantFilter;
    return statusMatch && restaurantMatch;
  }), [orders, restaurantFilter, statusFilter]);

  const totalRevenue = orders.filter((order) => order.status === 'delivered').reduce((sum, order) => sum + Number(order.total || 0), 0);
  const activeOrders = orders.filter((order) => !['delivered', 'cancelled', 'rejected'].includes(order.status));
  const deliveredOrders = orders.filter((order) => order.status === 'delivered');
  const failedOrders = orders.filter((order) => order.status === 'cancelled' || order.status === 'rejected');
  const uniqueUsers = new Set(orders.map((order) => `${order.name}-${order.phone}`)).size;

  const mutateStatus = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    setError('');
    try {
      await updateOrderStatus(orderId, status, 'admin');
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
            <h1 className="text-5xl font-black">Admin Demo Dashboard</h1>
            <p className="mt-2 font-bold text-gray-500">Restaurants, orders, mock users, revenue and operational status.</p>
          </div>
          <div className="flex items-center gap-2">
            <ModeBadge />
            <RefreshButton onClick={loadRestaurants} loading={loading} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Restaurants" value={restaurants.length} tone="yellow" />
          <StatCard label="Orders" value={orders.length} />
          <StatCard label="Revenue" value={money(totalRevenue)} tone="dark" />
          <StatCard label="Active" value={activeOrders.length} />
          <StatCard label="Delivered" value={deliveredOrders.length} />
          <StatCard label="Cancelled/rejected" value={failedOrders.length} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <StatCard label="Mock/users seen" value={uniqueUsers} />
          <StatCard label="Average delivered order" value={money(deliveredOrders.length ? Math.round(totalRevenue / deliveredOrders.length) : 0)} />
        </div>

        {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600">{error}</p>}

        <section className="mt-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black">Orders</h2>
            <div className="flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')} className="rounded-2xl bg-gray-100 px-4 py-3 font-black outline-none">
                <option value="all">All statuses</option>
                {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
              <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)} className="rounded-2xl bg-gray-100 px-4 py-3 font-black outline-none">
                <option value="all">All restaurants</option>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            {loading ? (
              <div className="h-44 animate-pulse rounded-[24px] bg-gray-100" />
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-[24px] bg-gray-50 p-8 text-center font-black text-gray-400">No orders for this filter.</div>
            ) : (
              <table className="min-w-[1100px] w-full text-left">
                <thead className="text-sm font-black uppercase tracking-widest text-gray-400">
                  <tr><th className="p-3">Order</th><th className="p-3">Restaurant</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Manual update</th></tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-t border-gray-100">
                      <td className="p-3 font-black">#{order.id}</td>
                      <td className="p-3 font-bold">{order.restaurantName}</td>
                      <td className="p-3">
                        <p className="font-black">{order.name || 'Mock customer'}</p>
                        <p className="font-bold text-gray-500">{order.phone}</p>
                      </td>
                      <td className="p-3 font-black">{money(order.total)}</td>
                      <td className="p-3"><StatusBadge status={order.status} /></td>
                      <td className="p-3">
                        <select disabled={busyId === order.id} value={order.status} onChange={(event) => mutateStatus(order.id, event.target.value as OrderStatus)} className="rounded-2xl bg-gray-100 px-4 py-3 font-black outline-none disabled:opacity-60">
                          {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-3xl font-black">Restaurants</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {restaurants.map((restaurant) => {
              const restaurantOrders = orders.filter((order) => order.restaurantId === restaurant.id);
              return (
                <div key={restaurant.id} className="rounded-[24px] bg-gray-50 p-4">
                  <p className="text-xl font-black">{restaurant.name}</p>
                  <p className="font-bold text-gray-500">{restaurant.cuisine.join(' · ')}</p>
                  <p className="mt-3 font-black">{restaurantOrders.length} orders · {money(restaurantOrders.reduce((sum, order) => sum + Number(order.total || 0), 0))}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
