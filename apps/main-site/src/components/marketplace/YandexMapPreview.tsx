'use client';

import { YandexMap, type MapPoint } from './YandexMap';

type YandexMapPreviewProps = {
  center: { lat: number; lng: number };
  label: string;
  className?: string;
  customer?: { lat: number; lng: number; label?: string };
};

export function YandexMapPreview({ center, label, className = '', customer }: YandexMapPreviewProps) {
  const points: MapPoint[] = [
    { id: 'restaurant', label, lat: center.lat, lng: center.lng, color: '#f97316' },
    ...(customer ? [{ id: 'customer', label: customer.label || 'Customer', lat: customer.lat, lng: customer.lng, color: '#10b981' }] : []),
  ];

  return (
    <YandexMap
      center={center}
      points={points}
      line={customer ? [center, customer] : undefined}
      heightClassName={`min-h-44 ${className}`}
      fallbackLabel="Map preview is unavailable. Address details are shown above."
    />
  );
}
