'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const dailyOrders = [42, 58, 36, 71, 63, 48, 55, 82, 67, 73, 59, 88, 95, 72, 64, 78, 91, 53, 69, 85, 77, 68, 93, 61, 74, 87, 56, 80, 70, 92];
const days = Array.from({ length: 30 }, (_, i) => `${i + 1}`);

export function OrdersChart() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <div className="h-[350px] animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  const isDark = theme === 'dark';

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
      background: 'transparent',
    },
    colors: ['#465fff'],
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '55%',
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: days,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: isDark ? '#98a2b3' : '#667085',
          fontSize: '11px',
        },
        rotate: 0,
        hideOverlappingLabels: true,
      },
      title: {
        text: 'Day of Month',
        style: {
          color: isDark ? '#98a2b3' : '#667085',
          fontSize: '12px',
          fontWeight: 500,
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? '#98a2b3' : '#667085',
          fontSize: '12px',
        },
      },
    },
    grid: {
      borderColor: isDark ? '#344054' : '#e4e7ec',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
    },
  };

  const series = [
    {
      name: 'Orders',
      data: dailyOrders,
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Orders</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Order count for the last 30 days</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
          Orders
        </div>
      </div>
      <Chart options={options} series={series} type="bar" height={350} />
    </div>
  );
}
