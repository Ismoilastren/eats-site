'use client';

import { YandexMap, type MapPoint } from './YandexMap';
import { isValidCoordinates } from '@repo/shared-types';

type YandexMapPreviewProps = {
  center: { lat: number; lng: number };
  label: string;
  className?: string;
  customer?: { lat: number; lng: number; label?: string };
};

export function YandexMapPreview({ center, label, className = '', customer }: YandexMapPreviewProps) {
  if (!isValidCoordinates(center.lat, center.lng)) {
    return (
      <div className={`flex min-h-44 items-center justify-center rounded-[32px] bg-gray-100 p-6 text-center text-sm font-bold text-gray-500 ${className}`}>
        Map preview is unavailable because coordinates are missing.
      </div>
    );
  }

  const points: MapPoint[] = [
    { id: 'restaurant', label, lat: center.lat, lng: center.lng, color: '#f97316' },
    ...(customer && isValidCoordinates(customer.lat, customer.lng)
      ? [{ id: 'customer', label: customer.label || 'Customer', lat: customer.lat, lng: customer.lng, color: '#10b981' }]
      : []),
  ];
  const validCustomer = customer && isValidCoordinates(customer.lat, customer.lng) ? customer : undefined;

  return (
    <YandexMap
      center={center}
      points={points}
      line={validCustomer ? [center, validCustomer] : undefined}
      heightClassName={`min-h-44 ${className}`}
      fallbackLabel="Map preview is unavailable. Address details are shown above."
    />
  );
}
