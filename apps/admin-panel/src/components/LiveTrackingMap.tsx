'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { normalizeCoordinate, toYandexCoords } from '@repo/shared-types';
import {
  isAdminYandexMapsKeyConfigured,
  loadAdminYandexMaps,
  type YandexMaps3,
  type YMapInstance,
} from '@/lib/yandexMaps';

interface LiveTrackingMapProps {
  restaurantLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  customerLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
  courierLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
}

type Point = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color: string;
};

function markerElement(point: Point) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'transform: translate(-50%, -50%); display:flex; flex-direction:column; align-items:center;';

  const marker = document.createElement('div');
  marker.style.cssText = `
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: ${point.color};
    border: 4px solid white;
    box-shadow: 0 12px 26px rgba(15,23,42,.3);
  `;

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

export default function LiveTrackingMap({
  restaurantLocation,
  customerLocation,
  courierLocation,
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const apiRef = useRef<YandexMaps3 | null>(null);
  const childrenRef = useRef<unknown[]>([]);
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
  const pointsSignature = JSON.stringify(points);

  useEffect(() => {
    if (restaurantLat === undefined || restaurantLng === undefined || customerLat === undefined || customerLng === undefined) return;
    const initialRestaurant = { lat: restaurantLat, lng: restaurantLng };
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      setLoadError('');
      try {
        const ymaps3 = await loadAdminYandexMaps();
        if (cancelled || !containerRef.current) return;
        const map = new ymaps3.YMap(containerRef.current, {
          location: { center: toYandexCoords(initialRestaurant), zoom: 13 },
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
  }, [customerLat, customerLng, restaurantLat, restaurantLng]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps3 = apiRef.current;
    if (
      !map
      || !ymaps3
      || status !== 'loaded'
      || restaurantLat === undefined
      || restaurantLng === undefined
      || customerLat === undefined
      || customerLng === undefined
    ) return;

    childrenRef.current.forEach((child) => map.removeChild?.(child));
    const children: unknown[] = [];
    const restaurantPoint = { lat: restaurantLat, lng: restaurantLng };
    const customerPoint = { lat: customerLat, lng: customerLng };

    const route = new ymaps3.YMapFeature({
      geometry: {
        type: 'LineString',
        coordinates: [toYandexCoords(restaurantPoint), toYandexCoords(customerPoint)],
      },
      style: { stroke: [{ color: '#f97316', width: 5, dash: [8, 6] }] },
    });
    map.addChild(route);
    children.push(route);

    if (courierLat !== undefined && courierLng !== undefined) {
      const courierRoute = new ymaps3.YMapFeature({
        geometry: {
          type: 'LineString',
          coordinates: [
            toYandexCoords({ lat: courierLat, lng: courierLng }),
            toYandexCoords(customerPoint),
          ],
        },
        style: { stroke: [{ color: '#16a34a', width: 5 }] },
      });
      map.addChild(courierRoute);
      children.push(courierRoute);
    }

    points.forEach((point) => {
      const marker = new ymaps3.YMapMarker({ coordinates: toYandexCoords(point) }, markerElement(point));
      map.addChild(marker);
      children.push(marker);
    });
    childrenRef.current = children;

    const lngs = points.map((point) => point.lng);
    const lats = points.map((point) => point.lat);
    map.update({
      location: {
        bounds: [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        margin: [55, 55, 55, 55],
        duration: 250,
      },
    });
  }, [
    courierLat,
    courierLng,
    customerLat,
    customerLng,
    points,
    pointsSignature,
    restaurantLat,
    restaurantLng,
    status,
  ]);

  if (!restaurant || !customer) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center bg-amber-50 p-6 text-center">
        <div>
          <MapPin className="mx-auto text-amber-600" size={30} />
          <p className="mt-3 font-bold text-gray-900">Tracking map unavailable because coordinates are missing.</p>
          <p className="mt-1 text-sm font-semibold text-gray-500">No pickup or destination point is being estimated.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-72 overflow-hidden bg-gray-950">
      <div ref={containerRef} className="h-full min-h-72 w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 font-bold text-white">
          Loading Yandex map...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 p-6 text-center text-white">
          <div>
            <MapPin className="mx-auto text-orange-400" size={30} />
            <p className="mt-3 font-bold">Yandex tracking map could not load.</p>
            <p className="mt-1 text-sm text-gray-400">
              {!isAdminYandexMapsKeyConfigured() || loadError.includes('not configured')
                ? 'Missing NEXT_PUBLIC_YANDEX_MAPS_API_KEY for the admin deployment.'
                : 'Check the JavaScript API key, allowed admin domain, and network connection.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
