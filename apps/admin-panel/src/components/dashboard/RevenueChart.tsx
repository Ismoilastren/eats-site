'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const monthlyRevenue = [12400, 18200, 15800, 22300, 19600, 24800, 28100, 31500, 27900, 35200, 38600, 45678];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function RevenueChart() {
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
      type: 'area',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif',
      background: 'transparent',
      zoom: { enabled: false },
    },
    colors: ['#465fff'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    stroke: {
      curve: 'smooth',
      width: 2.5,
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: months,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: isDark ? '#98a2b3' : '#667085',
          fontSize: '12px',
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
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
      y: {
        formatter: (val: number) => `$${val.toLocaleString()}`,
      },
    },
  };

  const series = [
    {
      name: 'Revenue',
      data: monthlyRevenue,
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Revenue</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Revenue over the past 12 months</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
          Revenue
        </div>
      </div>
      <Chart options={options} series={series} type="area" height={350} />
    </div>
  );
}
