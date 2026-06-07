'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

// Dynamically import ApexCharts to avoid SSR issues with window object
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, systemTheme } = useTheme();

  const [metrics, setMetrics] = useState({
    users: 0,
    orders: 0,
    restaurants: 0,
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

        setMetrics({
          users: usersSnap.size,
          orders: ordersSnap.size,
          restaurants: restaurantsSnap.size
        });
      } catch (err) {
        console.warn('Failed to load metrics', err);
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
      categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
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
  }), [isDark]);

  // Mock chart data representing recent trends
  const chartSeries = React.useMemo(() => [
    { name: 'Weekly Orders', data: [31, 40, 28, 51, 42, 109, metrics.orders > 0 ? metrics.orders : 100] },
    { name: 'Active Users', data: [11, 32, 45, 32, 34, 52, metrics.users > 0 ? metrics.users : 41] }
  ], [metrics.orders, metrics.users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed performance metrics and live data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium dark:text-white mb-4">Traffic Overview</h2>
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
    </div>
  );
}
