'use client';

import React from 'react';

interface MetricsCardProps {
  title: string;
  value: string;
  trend: number; // positive = up, negative = down
  icon: React.ReactNode;
  iconBg: string;
}

export function MetricsCard({ title, value, trend, icon, iconBg }: MetricsCardProps) {
  const isPositive = trend >= 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
        <div
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isPositive
              ? 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500'
              : 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500'
          }`}
        >
          {isPositive ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 11V3M3 7l4-4 4 4" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3v8M3 7l4 4 4-4" />
            </svg>
          )}
          {Math.abs(trend)}%
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{title}</p>
      </div>
    </div>
  );
}
