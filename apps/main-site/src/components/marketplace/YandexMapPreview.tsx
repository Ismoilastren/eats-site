'use client';

import { YandexMap, type MapPoint } from './YandexMap';
import { isValidCoordinates } from '@repo/shared-types';
import { TASHKENT_CENTER } from '@/lib/yandexMaps';

type YandexMapPreviewProps = {
  center: { lat: number; lng: number };
  label: string;
  className?: string;
  customer?: { lat: number; lng: number; label?: string };
  dark?: boolean;
};

export function YandexMapPreview({ center, label, className = '', customer, dark = false }: YandexMapPreviewProps) {
  const safeCenter = isValidCoordinates(center.lat, center.lng) ? center : TASHKENT_CENTER;

  const points: MapPoint[] = [
    { id: 'restaurant', label, lat: safeCenter.lat, lng: safeCenter.lng, color: '#f97316' },
    ...(customer && isValidCoordinates(customer.lat, customer.lng)
      ? [{ id: 'customer', label: customer.label || 'Customer', lat: customer.lat, lng: customer.lng, color: '#10b981' }]
      : []),
  ];
  const validCustomer = customer && isValidCoordinates(customer.lat, customer.lng) ? customer : undefined;

  return (
    <YandexMap
      center={safeCenter}
      points={points}
      line={validCustomer ? [safeCenter, validCustomer] : undefined}
      heightClassName={`min-h-44 ${className}`}
      fallbackLabel="Location preview"
      dark={dark}
    />
  );
}
