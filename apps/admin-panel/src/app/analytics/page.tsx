'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { formatCurrencyUZS, normalizeOrderStatus } from '@repo/shared-types';

// Dynamically import ApexCharts to avoid SSR issues with window object
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type AnalyticsMetrics = {
  users: number;
  orders: number;
  restaurants: number;
  revenue: number;
  delivered: number;
  cancelled: number;
  chartLabels: string[];
  orderSeries: number[];
  userSeries: number[];
  statusBreakdown: Record<string, number>;
  paymentBreakdown: Record<string, number>;
  topRestaurants: Array<{ name: string; orders: number; revenue: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  courierPerformance: Array<{ name: string; delivered: number; revenue: number }>;
  averageOrderValue: number;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortDayLabel(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, systemTheme } = useTheme();

  const [metrics, setMetrics] = useState<AnalyticsMetrics>({
    users: 0,
    orders: 0,
    restaurants: 0,
    revenue: 0,
    delivered: 0,
    cancelled: 0,
    chartLabels: [],
    orderSeries: [],
    userSeries: [],
    statusBreakdown: {},
    paymentBreakdown: {},
    topRestaurants: [],
    topProducts: [],
    courierPerformance: [],
    averageOrderValue: 0,
  });

  useEffect(() => {
    setMounted(true);
    
    // Fetch live metrics from Firestore
    const fetchMetrics = async () => {
      try {
        const { db, collection, getDocs } = await import('@repo/firebase-config');
        const { COLLECTIONS } = await import('@repo/shared-types');
        
        const [usersSnap, ordersSnap, restaurantsSnap] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.USERS)),
          getDocs(collection(db, COLLECTIONS.ORDERS)),
          getDocs(collection(db, COLLECTIONS.RESTAURANTS))
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayKeys = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(today);
          date.setDate(today.getDate() - (6 - index));
          return dayKey(date);
        });
        const ordersByDay = Object.fromEntries(dayKeys.map((key) => [key, 0])) as Record<string, number>;
        const usersByDay = Object.fromEntries(dayKeys.map((key) => [key, 0])) as Record<string, number>;
        const statusBreakdown: Record<string, number> = {};
        const paymentBreakdown: Record<string, number> = {};
        const restaurants: Record<string, { name: string; orders: number; revenue: number }> = {};
        const products: Record<string, { name: string; quantity: number; revenue: number }> = {};
        const couriers: Record<string, { name: string; delivered: number; revenue: number }> = {};
        let revenue = 0;
        let delivered = 0;
        let cancelled = 0;

        ordersSnap.forEach((documentSnapshot) => {
          const order = documentSnapshot.data();
          const status = normalizeOrderStatus(order.status);
          const createdAt = toDate(order.createdAt);
          const paymentMethod = String(order.paymentMethod || order.payment?.method || 'unknown');
          const restaurantName = String(order.brandName || order.restaurantName || order.branchName || 'Unknown branch');
          const orderRevenue = Number(order.totalAmount || order.total || 0);
          statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
          paymentBreakdown[paymentMethod] = (paymentBreakdown[paymentMethod] || 0) + 1;
          restaurants[restaurantName] = restaurants[restaurantName] || { name: restaurantName, orders: 0, revenue: 0 };
          restaurants[restaurantName].orders += 1;
          if (status === 'delivered') {
            delivered += 1;
            revenue += orderRevenue;
            restaurants[restaurantName].revenue += orderRevenue;
            const courierName = String(order.courierName || order.assignedCourier?.name || order.courier?.name || 'Unassigned courier');
            couriers[courierName] = couriers[courierName] || { name: courierName, delivered: 0, revenue: 0 };
            couriers[courierName].delivered += 1;
            couriers[courierName].revenue += orderRevenue;
          }
          if (status === 'cancelled' || status === 'rejected') cancelled += 1;
          if (Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              const name = String(item.name || item.title || item.id || 'Unknown product');
              const quantity = Number(item.quantity || item.qty || 1);
              const itemRevenue = Number(item.price || 0) * quantity;
              products[name] = products[name] || { name, quantity: 0, revenue: 0 };
              products[name].quantity += quantity;
              products[name].revenue += itemRevenue;
            });
          }
          if (createdAt) {
            const key = dayKey(createdAt);
            if (key in ordersByDay) ordersByDay[key] += 1;
          }
        });

        usersSnap.forEach((documentSnapshot) => {
          const user = documentSnapshot.data();
          const createdAt = toDate(user.createdAt);
          if (createdAt) {
            const key = dayKey(createdAt);
            if (key in usersByDay) usersByDay[key] += 1;
          }
        });

        setMetrics({
          users: usersSnap.size,
          orders: ordersSnap.size,
          restaurants: restaurantsSnap.size,
          revenue,
          delivered,
          cancelled,
          chartLabels: dayKeys.map(shortDayLabel),
          orderSeries: dayKeys.map((key) => ordersByDay[key] || 0),
          userSeries: dayKeys.map((key) => usersByDay[key] || 0),
          statusBreakdown,
          paymentBreakdown,
          topRestaurants: Object.values(restaurants).sort((a, b) => b.orders - a.orders).slice(0, 8),
          topProducts: Object.values(products).sort((a, b) => b.quantity - a.quantity).slice(0, 8),
          courierPerformance: Object.values(couriers).sort((a, b) => b.delivered - a.delivered).slice(0, 8),
          averageOrderValue: delivered ? Math.round(revenue / delivered) : 0,
        });
      } catch {
        // Keep analytics as a clean empty state when Firestore rules are not deployed yet.
      }
    };
    fetchMetrics();
  }, []);

  const currentTheme = mounted ? (theme === 'system' ? systemTheme : theme) : 'light';
  const isDark = currentTheme === 'dark';

  const chartOptions = React.useMemo(() => ({
    chart: {
      type: 'area' as const,
      toolbar: { show: false },
      zoom: { enabled: false },
      selection: { enabled: false },
      fontFamily: 'inherit',
      background: 'transparent',
      animations: { enabled: false }
    },
    colors: ['#3b82f6', '#10b981'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth' as const, width: 2 },
    xaxis: {
      categories: metrics.chartLabels.length ? metrics.chartLabels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
      labels: { style: { colors: isDark ? '#9ca3af' : '#6b7280' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { style: { colors: isDark ? '#9ca3af' : '#6b7280' } }
    },
    grid: { 
      borderColor: isDark ? '#374151' : '#e5e7eb', 
      strokeDashArray: 4 
    },
    theme: { mode: isDark ? 'dark' as const : 'light' as const },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'inherit'
      },
      y: {
        formatter: (val: number) => val.toString()
      }
    },
    legend: {
      labels: { colors: isDark ? '#d1d5db' : '#374151' }
    }
  }), [isDark, metrics.chartLabels]);

  const chartSeries = React.useMemo(() => [
    { name: 'Orders created', data: metrics.orderSeries },
    { name: 'New users', data: metrics.userSeries }
  ], [metrics.orderSeries, metrics.userSeries]);

  const completionRate = metrics.orders > 0 ? Math.round((metrics.delivered / metrics.orders) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed performance metrics and live data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{metrics.users}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Orders</p>
          <p className="mt-2 text-3xl font-bold text-brand-600 dark:text-brand-400">{metrics.orders}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Restaurants</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{metrics.restaurants}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Delivered</p>
          <p className="mt-2 text-3xl font-bold text-success-600 dark:text-success-400">{metrics.delivered}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completion Rate</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{completionRate}%</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Delivered Revenue</p>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{formatCurrencyUZS(metrics.revenue)}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Order Value</p>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{formatCurrencyUZS(metrics.averageOrderValue)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium dark:text-white mb-4">Last 7 Days</h2>
        <div className="h-80 w-full">
          {mounted ? (
            <Chart options={chartOptions} series={chartSeries} type="area" height="100%" />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Loading Chart...
            </div>
          )}
        </div>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium dark:text-white mb-4">Order Status Breakdown</h2>
        <div className="space-y-3">
          {Object.entries(metrics.statusBreakdown).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm dark:bg-gray-900">
              <span className="font-semibold capitalize text-gray-700 dark:text-gray-200">{status.replace(/_/g, ' ')}</span>
              <span className="font-black text-gray-900 dark:text-white">{count}</span>
            </div>
          ))}
          {Object.keys(metrics.statusBreakdown).length === 0 && (
            <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              No order data yet.
            </p>
          )}
        </div>
      </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <BreakdownCard title="Top Restaurants / Branches" empty="No restaurant order data yet." rows={metrics.topRestaurants.map((item) => ({
          label: item.name,
          value: `${item.orders} orders`,
          detail: formatCurrencyUZS(item.revenue),
        }))} />
        <BreakdownCard title="Top Products" empty="No product data yet." rows={metrics.topProducts.map((item) => ({
          label: item.name,
          value: `${item.quantity} sold`,
          detail: formatCurrencyUZS(item.revenue),
        }))} />
        <BreakdownCard title="Courier Performance" empty="No delivered courier data yet." rows={metrics.courierPerformance.map((item) => ({
          label: item.name,
          value: `${item.delivered} delivered`,
          detail: formatCurrencyUZS(item.revenue),
        }))} />
      </div>
      <BreakdownCard title="Payment Method Distribution" empty="No payment data yet." rows={Object.entries(metrics.paymentBreakdown).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({
        label,
        value: `${count} orders`,
      }))} />
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; value: string; detail?: string }>;
  empty: string;
}) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-medium dark:text-white mb-4">{title}</h2>
      <div className="space-y-3">
        {rows.length ? rows.map((row) => (
          <div key={`${row.label}:${row.value}`} className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3 text-sm dark:bg-gray-900">
            <div className="min-w-0">
              <p className="truncate font-black text-gray-900 dark:text-white">{row.label}</p>
              {row.detail ? <p className="text-xs font-semibold text-gray-500">{row.detail}</p> : null}
            </div>
            <span className="shrink-0 font-bold text-brand-600 dark:text-brand-300">{row.value}</span>
          </div>
        )) : (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}
