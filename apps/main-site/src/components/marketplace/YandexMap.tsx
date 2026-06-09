'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import { loadYandexMaps, TASHKENT_CENTER, type YMapInstance } from '@/lib/yandexMaps';

export type MapPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color?: string;
};

type YandexMapProps = {
  center?: { lat: number; lng: number };
  points?: MapPoint[];
  line?: Array<{ lat: number; lng: number }>;
  interactive?: boolean;
  dark?: boolean;
  heightClassName?: string;
  fallbackLabel?: string;
  showLocateControl?: boolean;
  onSelect?: (coords: { lat: number; lng: number }) => void;
  onStatusChange?: (status: 'not_loaded' | 'loading' | 'loaded' | 'error') => void;
};

function markerElement(point: MapPoint) {
  const element = document.createElement('div');
  element.className = 'ymaps-demo-marker';
  element.innerHTML = `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: ${point.color || '#f97316'};
      border: 4px solid white;
      box-shadow: 0 14px 28px rgba(15, 23, 42, .28);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font: 900 14px system-ui;
    ">${point.label.slice(0, 1).toUpperCase()}</div>
  `;
  return element;
}

export function YandexMap({
  center = TASHKENT_CENTER,
  points = [],
  line,
  interactive = false,
  dark = false,
  heightClassName = 'h-[420px]',
  fallbackLabel = 'Map is temporarily unavailable.',
  showLocateControl = true,
  onSelect,
  onStatusChange,
}: YandexMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const [status, setStatus] = useState<'not_loaded' | 'loading' | 'loaded' | 'error'>('not_loaded');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(13);
  const mapCenter = points[0] || center;
  const signature = useMemo(() => JSON.stringify({ center, points, line, interactive, dark, zoom }), [center, dark, interactive, line, points, zoom]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      setError('');

      try {
        const ymaps3 = await loadYandexMaps();
        if (cancelled || !containerRef.current) return;

        mapRef.current?.destroy();
        const map = new ymaps3.YMap(containerRef.current, {
          location: { center: [mapCenter.lng, mapCenter.lat], zoom },
          theme: dark ? 'dark' : 'light',
        });
        map.addChild(new ymaps3.YMapDefaultSchemeLayer({ theme: dark ? 'dark' : 'light' }));
        map.addChild(new ymaps3.YMapDefaultFeaturesLayer());

        if (line && line.length > 1) {
          map.addChild(new ymaps3.YMapFeature({
            geometry: {
              type: 'LineString',
              coordinates: line.map((point) => [point.lng, point.lat]),
            },
            style: { stroke: [{ color: '#f97316', width: 5, dash: [8, 6] }] },
          }));
        }

        points.forEach((point) => {
          map.addChild(new ymaps3.YMapMarker({ coordinates: [point.lng, point.lat] }, markerElement(point)));
        });

        if (interactive) {
          map.addChild(new ymaps3.YMapListener({
            onClick: (_object: unknown, event: { coordinates?: [number, number] }) => {
              const coordinates = event.coordinates;
              if (coordinates) onSelect?.({ lng: coordinates[0], lat: coordinates[1] });
            },
          }));
        }

        mapRef.current = map;
        setStatus('loaded');
      } catch (loadError) {
        if (cancelled) return;
        setStatus('error');
        setError(loadError instanceof Error ? loadError.message : 'Could not load Yandex Maps.');
      }
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [signature, mapCenter.lat, mapCenter.lng, onSelect, zoom]);

  const updateZoom = (nextZoom: number) => {
    const bounded = Math.min(18, Math.max(4, nextZoom));
    setZoom(bounded);
    mapRef.current?.update({ location: { center: [mapCenter.lng, mapCenter.lat], zoom: bounded } });
  };

  return (
    <div className={`relative overflow-hidden rounded-[32px] bg-[#111827] ${heightClassName}`}>
      <div ref={containerRef} className="h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 text-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-orange-500" />
            <p className="mt-3 font-black">Loading map...</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 p-6 text-white">
          <div className="max-w-sm text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
              <MapPin size={26} />
            </div>
            <p className="mt-4 text-xl font-black">{fallbackLabel}</p>
            <p className="mt-2 text-sm font-bold text-gray-400">{error || 'Enter the address manually and continue checkout.'}</p>
          </div>
        </div>
      )}

      {interactive && status === 'loaded' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="-mt-10 flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-orange-500 shadow-2xl ring-4 ring-white" />
            <div className="h-8 w-1 rounded-b-full bg-orange-500" />
          </div>
        </div>
      )}

      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <button aria-label="Zoom in" onClick={() => updateZoom(zoom + 1)} className="p-3 text-gray-950 hover:bg-gray-100"><Plus size={18} /></button>
        <button aria-label="Zoom out" onClick={() => updateZoom(zoom - 1)} className="border-t border-gray-100 p-3 text-gray-950 hover:bg-gray-100"><Minus size={18} /></button>
      </div>

      {interactive && showLocateControl && (
        <button
          type="button"
          onClick={() => navigator.geolocation?.getCurrentPosition((position) => onSelect?.({ lat: position.coords.latitude, lng: position.coords.longitude }))}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-gray-950 shadow-xl hover:bg-gray-100"
        >
          <LocateFixed size={18} /> Locate
        </button>
      )}
    </div>
  );
}
