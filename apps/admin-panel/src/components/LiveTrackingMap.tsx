'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { normalizeCoordinate, toYandexCoords, type CoordinateLike } from '@repo/shared-types';
import {
  isAdminYandexMapsKeyConfigured,
  loadAdminYandexMaps,
  type YandexMaps3,
  type YMapInstance,
} from '@/lib/yandexMaps';

interface LiveTrackingMapProps {
  restaurantLocation?: CoordinateLike | null;
  customerLocation?: CoordinateLike | null;
  courierLocation?: CoordinateLike | null;
}

type Point = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color: string;
};

const OVERLAP_KEY_PRECISION = 4;
const OVERLAP_DISPLAY_OFFSET = 0.00028;

function spreadOverlappingPoints(points: Point[]) {
  const groups = new Map<string, Point[]>();
  points.forEach((point) => {
    const key = `${point.lat.toFixed(OVERLAP_KEY_PRECISION)}:${point.lng.toFixed(OVERLAP_KEY_PRECISION)}`;
    groups.set(key, [...(groups.get(key) || []), point]);
  });

  return points.map((point) => {
    const key = `${point.lat.toFixed(OVERLAP_KEY_PRECISION)}:${point.lng.toFixed(OVERLAP_KEY_PRECISION)}`;
    const group = groups.get(key) || [];
    if (group.length <= 1) return point;

    const index = group.findIndex((groupPoint) => groupPoint.id === point.id);
    const angle = ((Math.PI * 2) / group.length) * index - Math.PI / 2;
    return {
      ...point,
      lat: point.lat + Math.sin(angle) * OVERLAP_DISPLAY_OFFSET,
      lng: point.lng + Math.cos(angle) * OVERLAP_DISPLAY_OFFSET,
    };
  });
}

function markerElement(point: Point) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'transform: translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; z-index: 50; pointer-events:none;';

  const marker = document.createElement('div');
  marker.style.cssText = `
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: ${point.color};
    border: 4px solid white;
    box-shadow: 0 14px 30px rgba(15,23,42,.35);
    color: white;
    font: 900 14px system-ui;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  marker.textContent = point.label[0] || '';

  const label = document.createElement('div');
  label.textContent = point.label;
  label.style.cssText = `
    margin-top: 6px;
    border-radius: 999px;
    background: rgba(255,255,255,.96);
    padding: 5px 9px;
    color: #111827;
    box-shadow: 0 7px 18px rgba(15,23,42,.18);
    font: 800 11px system-ui;
    white-space: nowrap;
  `;

  wrapper.append(marker, label);
  return wrapper;
}

function buildMapLocation(points: Point[]) {
  if (points.length === 0) {
    return { center: toYandexCoords({ lat: 41.311081, lng: 69.240562 }), zoom: 12 };
  }

  if (points.length === 1) {
    return { center: toYandexCoords(points[0]), zoom: 14 };
  }

  const lngs = points.map((point) => point.lng);
  const lats = points.map((point) => point.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const sameLng = minLng === maxLng;
  const sameLat = minLat === maxLat;

  return {
    bounds: [
      [sameLng ? minLng - 0.01 : minLng, sameLat ? minLat - 0.01 : minLat],
      [sameLng ? maxLng + 0.01 : maxLng, sameLat ? maxLat + 0.01 : maxLat],
    ],
    margin: [55, 55, 55, 55],
  };
}

function AdminMapSetupPanel({ loadError }: { loadError: string }) {
  const missingPublicKey = !isAdminYandexMapsKeyConfigured() || loadError.includes('not configured');

  return (
    <div className="max-w-md text-left">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
        <MapPin size={30} />
      </div>
      <p className="mt-4 text-center text-xl font-black text-white">Admin map setup required</p>
      <p className="mt-2 text-center text-sm font-semibold text-gray-400">
        {missingPublicKey
          ? 'The admin deployment is missing the browser Yandex Maps key.'
          : 'The Yandex Maps key or allowed admin domain rejected this request.'}
      </p>
      <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-semibold text-gray-200">
        <p className="font-black text-white">Required Vercel env</p>
        <p className="mt-2 font-mono text-xs text-orange-200">NEXT_PUBLIC_YANDEX_MAPS_API_KEY</p>
        <p className="mt-3 font-black text-white">Allowed web host</p>
        <p className="mt-2 font-mono text-xs text-orange-200">eats-adminn.vercel.app</p>
      </div>
      {loadError ? (
        <p className="mt-3 text-center text-xs font-semibold text-gray-500">Technical detail: {loadError}</p>
      ) : null}
    </div>
  );
}

export default function LiveTrackingMap({
  restaurantLocation,
  customerLocation,
  courierLocation,
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const apiRef = useRef<YandexMaps3 | null>(null);
  const childrenRef = useRef<unknown[]>([]);
  const pointsRef = useRef<Point[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  const restaurant = normalizeCoordinate(restaurantLocation);
  const customer = normalizeCoordinate(customerLocation);
  const courier = normalizeCoordinate(courierLocation);
  const restaurantLat = restaurant?.latitude;
  const restaurantLng = restaurant?.longitude;
  const customerLat = customer?.latitude;
  const customerLng = customer?.longitude;
  const courierLat = courier?.latitude;
  const courierLng = courier?.longitude;
  const points = useMemo<Point[]>(() => [
    ...(restaurantLat !== undefined && restaurantLng !== undefined ? [{
      id: 'restaurant',
      label: 'Restaurant',
      lat: restaurantLat,
      lng: restaurantLng,
      color: '#f97316',
    }] : []),
    ...(customerLat !== undefined && customerLng !== undefined ? [{
      id: 'customer',
      label: 'Customer',
      lat: customerLat,
      lng: customerLng,
      color: '#2563eb',
    }] : []),
    ...(courierLat !== undefined && courierLng !== undefined ? [{
      id: 'courier',
      label: 'Courier',
      lat: courierLat,
      lng: courierLng,
      color: '#16a34a',
    }] : []),
  ], [courierLat, courierLng, customerLat, customerLng, restaurantLat, restaurantLng]);
  const hasPoints = points.length > 0;
  const displayPoints = useMemo(() => spreadOverlappingPoints(points), [points]);

  useEffect(() => {
    pointsRef.current = displayPoints;
  }, [displayPoints]);

  useEffect(() => {
    if (!hasPoints) {
      childrenRef.current.forEach((child) => mapRef.current?.removeChild?.(child));
      childrenRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
      apiRef.current = null;
      return;
    }

    if (mapRef.current && apiRef.current) return;

    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      setLoadError('');
      try {
        const ymaps3 = await loadAdminYandexMaps();
        if (cancelled || !containerRef.current) return;
        const map = new ymaps3.YMap(containerRef.current, {
          location: buildMapLocation(pointsRef.current),
          theme: 'light',
          behaviors: ['drag', 'scrollZoom', 'pinchZoom', 'dblClick'],
        });
        map.addChild(new ymaps3.YMapDefaultSchemeLayer());
        map.addChild(new ymaps3.YMapDefaultFeaturesLayer());
        mapRef.current = map;
        apiRef.current = ymaps3;
        setStatus('loaded');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setLoadError(error instanceof Error ? error.message : 'Could not load Yandex Maps.');
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      apiRef.current = null;
      childrenRef.current = [];
    };
  }, [hasPoints]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps3 = apiRef.current;
    if (
      !map
      || !ymaps3
      || status !== 'loaded'
      || !points.length
    ) return;

    childrenRef.current.forEach((child) => map.removeChild?.(child));
    const children: unknown[] = [];

    displayPoints.forEach((point) => {
      const marker = new ymaps3.YMapMarker({ coordinates: toYandexCoords(point) }, markerElement(point));
      map.addChild(marker);
      children.push(marker);
    });
    childrenRef.current = children;

    map.update({
      location: {
        ...buildMapLocation(displayPoints),
        duration: 250,
      },
    });
  }, [displayPoints, points.length, status]);

  if (!points.length) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center bg-amber-50 p-6 text-center">
        <div>
          <MapPin className="mx-auto text-amber-600" size={30} />
          <p className="mt-3 font-bold text-gray-900">Tracking map unavailable because all coordinates are missing.</p>
          <p className="mt-1 text-sm font-semibold text-gray-500">No pickup, destination, or courier point is being estimated.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-72 overflow-hidden bg-gray-950">
      <div ref={containerRef} className="h-full min-h-72 w-full" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        {points.map((point) => (
          <span
            key={`${point.id}-${point.lat}-${point.lng}`}
            className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-gray-800 shadow-lg"
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: point.color }} />
            {point.label}: shown
          </span>
        ))}
      </div>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 font-bold text-white">
          Loading Yandex map...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 p-6 text-center text-white">
          <AdminMapSetupPanel loadError={loadError} />
        </div>
      )}
    </div>
  );
}
