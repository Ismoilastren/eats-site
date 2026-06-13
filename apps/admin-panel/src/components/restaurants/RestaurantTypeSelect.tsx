'use client';

import { ChevronDown } from 'lucide-react';
import type { RestaurantTypeOption } from '@/lib/restaurantAdmin';

type RestaurantTypeSelectProps = {
  value: string;
  options: RestaurantTypeOption[];
  loading?: boolean;
  onChange: (value: string) => void;
  error?: string;
};

export function RestaurantTypeSelect({
  value,
  options,
  loading,
  onChange,
  error,
}: RestaurantTypeSelectProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
        Restaurant Type
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm font-semibold text-gray-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="">{loading ? 'Loading types...' : 'Select restaurant type'}</option>
          {options.map((option) => (
            <option key={`${option.source}-${option.id}-${option.name}`} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
      </div>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Loaded from admin categories/settings and existing restaurant data.
        </p>
      )}
    </div>
  );
}
