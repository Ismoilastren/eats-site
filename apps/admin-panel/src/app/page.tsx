'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MetricsCard } from '@/components/dashboard/MetricsCard';
import { RecentOrders } from '@/components/dashboard/RecentOrders';
import {
  collection,
  db,
  onSnapshot,
  orderBy,
  query,
} from '@repo/firebase-config';
import {
  COLLECTIONS,
  Order,
  OrderStatus,
  formatCurrencyUZS,
  normalizeOrderStatus,
} from '@repo/shared-types';

type DashboardUser = {
  uid?: string;
  role?: string;
};

type DashboardCourier = {
  id?: string;
  uid?: string;
  status?: string;
  isOnline?: boolean;
  isAvailable?: boolean;
};

type DashboardRestaurant = {
  id?: string;
  status?: string;
  isActive?: boolean;
  active?: boolean;
};

const ACTIVE_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
];

const CANCELLED_STATUSES: OrderStatus[] = ['cancelled', 'rejected'];

const getOrderTotal = (order: Partial<Order> & Record<string, unknown>) => {
  const total = Number(order.totalAmount ?? order.total ?? 0);
  if (!Number.isFinite(total) || total < 0 || total > 100_000_000) {
    return 0;
  }
  return total;
};

const getCreatedMillis = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const cardIconClass = 'h-6 w-6';

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [restaurants, setRestaurants] = useState<DashboardRestaurant[]>([]);
  const [couriers, setCouriers] = useState<DashboardCourier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(
        query(collection(db, COLLECTIONS.ORDERS), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Order));
          setIsLoading(false);
        },
        (error) => {
          console.error('Dashboard orders subscription failed:', error);
          setIsLoading(false);
        }
      ),
      onSnapshot(
        collection(db, COLLECTIONS.USERS),
        (snapshot) => {
          setUsers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as DashboardUser));
        },
        (error) => console.error('Dashboard users subscription failed:', error)
      ),
      onSnapshot(
        collection(db, COLLECTIONS.RESTAURANTS),
        (snapshot) => {
          setRestaurants(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DashboardRestaurant));
        },
        (error) => console.error('Dashboard restaurants subscription failed:', error)
      ),
      onSnapshot(
        collection(db, COLLECTIONS.COURIERS),
        (snapshot) => {
          setCouriers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DashboardCourier));
        },
        (error) => console.error('Dashboard couriers subscription failed:', error)
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const stats = useMemo(() => {
    const normalizedOrders = orders.map((order) => ({
      ...order,
      normalizedStatus: normalizeOrderStatus(order.status),
    }));
    const deliveredOrders = normalizedOrders.filter((order) => order.normalizedStatus === 'delivered');
    const activeOrders = normalizedOrders.filter((order) => ACTIVE_STATUSES.includes(order.normalizedStatus));
    const cancelledOrders = normalizedOrders.filter((order) => CANCELLED_STATUSES.includes(order.normalizedStatus));
    const customerUsers = users.filter((user) => ['client', 'customer', 'user'].includes(String(user.role || 'customer')));
    const activeRestaurants = restaurants.filter((restaurant) => restaurant.isActive !== false && restaurant.active !== false && restaurant.status !== 'inactive');
    const onlineCouriers = couriers.filter((courier) => courier.isOnline === true || ['online', 'busy'].includes(String(courier.status || '').toLowerCase()));

    return {
      totalRevenue: deliveredOrders.reduce((sum, order) => sum + getOrderTotal(order), 0),
      activeOrders: activeOrders.length,
      totalOrders: normalizedOrders.length,
      deliveredOrders: deliveredOrders.length,
      cancelledOrders: cancelledOrders.length,
      customers: customerUsers.length,
      restaurants: restaurants.length,
      activeRestaurants: activeRestaurants.length,
      couriers: couriers.length,
      onlineCouriers: onlineCouriers.length,
    };
  }, [orders, users, restaurants, couriers]);

  const problemOrders = useMemo(
    () =>
      orders
        .filter((order) => CANCELLED_STATUSES.includes(normalizeOrderStatus(order.status)))
        .slice(0, 5),
    [orders]
  );

  const recentActiveOrders = useMemo(
    () =>
      orders
        .filter((order) => ACTIVE_STATUSES.includes(normalizeOrderStatus(order.status)))
        .slice(0, 5),
    [orders]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Live platform overview from Firestore. Counters are calculated from real records only.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-success-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-success-700 dark:bg-success-500/10 dark:text-success-400">
          {isLoading ? 'Connecting...' : 'Realtime'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricsCard
          title="Delivered Revenue"
          value={formatCurrencyUZS(stats.totalRevenue)}
          trend={0}
          iconBg="bg-brand-50 dark:bg-brand-500/10"
          icon={
            <svg className={`${cardIconClass} text-brand-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
        <MetricsCard
          title="Active Orders"
          value={String(stats.activeOrders)}
          trend={0}
          iconBg="bg-success-50 dark:bg-success-500/10"
          icon={
            <svg className={`${cardIconClass} text-success-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <path d="M3 6h18M16 10a4 4 0 01-8 0" />
            </svg>
          }
        />
        <MetricsCard
          title="Customers"
          value={String(stats.customers)}
          trend={0}
          iconBg="bg-info-50 dark:bg-info-500/10"
          icon={
            <svg className={`${cardIconClass} text-info-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
            </svg>
          }
        />
        <MetricsCard
          title="Online Couriers"
          value={`${stats.onlineCouriers}/${stats.couriers}`}
          trend={0}
          iconBg="bg-warning-50 dark:bg-warning-500/10"
          icon={
            <svg className={`${cardIconClass} text-warning-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3h15v13H1z" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Platform totals</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Current Firestore totals across core collections.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              ['Total orders', stats.totalOrders],
              ['Delivered', stats.deliveredOrders],
              ['Cancelled/rejected', stats.cancelledOrders],
              ['Restaurants', stats.restaurants],
              ['Active restaurants', stats.activeRestaurants],
              ['Couriers', stats.couriers],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/70">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active order queue</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Newest orders that still need operational attention.</p>
          <div className="mt-5 space-y-3">
            {recentActiveOrders.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">No active orders right now.</div>
            ) : (
              recentActiveOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">#{order.id.slice(0, 8).toUpperCase()}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{order.customerName || 'Unknown customer'}</div>
                    </div>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                      {normalizeOrderStatus(order.status).replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Problem orders</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Cancelled and rejected orders for quick review.</p>
          <div className="mt-5 space-y-3">
            {problemOrders.length === 0 ? (
              <div className="rounded-xl bg-success-50 p-4 text-sm font-medium text-success-700 dark:bg-success-500/10 dark:text-success-400">No cancelled or rejected orders in the latest feed.</div>
            ) : (
              problemOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-error-100 bg-error-50/50 p-4 dark:border-error-500/20 dark:bg-error-500/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">#{order.id.slice(0, 8).toUpperCase()}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {order.createdAt ? new Date(getCreatedMillis(order.createdAt)).toLocaleString() : 'No timestamp'}
                      </div>
                    </div>
                    <span className="rounded-full bg-error-100 px-3 py-1 text-xs font-bold text-error-700 dark:bg-error-500/20 dark:text-error-400">
                      {normalizeOrderStatus(order.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <RecentOrders />
    </div>
  );
}
