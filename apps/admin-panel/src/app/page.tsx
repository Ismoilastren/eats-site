'use client';

import React from 'react';
import { MetricsCard } from '@/components/dashboard/MetricsCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { OrdersChart } from '@/components/dashboard/OrdersChart';
import { RecentOrders } from '@/components/dashboard/RecentOrders';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back! Here&apos;s what&apos;s happening with your platform today.
        </p>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricsCard
          title="Total Revenue"
          value="$45,678"
          trend={12.5}
          iconBg="bg-brand-50 dark:bg-brand-500/10"
          icon={
            <svg className="h-6 w-6 text-brand-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
        <MetricsCard
          title="Active Orders"
          value="156"
          trend={8.2}
          iconBg="bg-success-50 dark:bg-success-500/10"
          icon={
            <svg className="h-6 w-6 text-success-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          }
        />
        <MetricsCard
          title="Registered Users"
          value="2,847"
          trend={5.3}
          iconBg="bg-info-50 dark:bg-info-500/10"
          icon={
            <svg className="h-6 w-6 text-info-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
        />
        <MetricsCard
          title="Active Couriers"
          value="43"
          trend={-2.4}
          iconBg="bg-warning-50 dark:bg-warning-500/10"
          icon={
            <svg className="h-6 w-6 text-warning-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3h15v13H1z" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RevenueChart />
        <OrdersChart />
      </div>

      {/* Recent orders table */}
      <RecentOrders />
    </div>
  );
}
