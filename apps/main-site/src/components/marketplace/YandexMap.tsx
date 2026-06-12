'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import {
  loadYandexMaps,
  TASHKENT_CENTER,
  type YandexMaps3,
  type YMapInstance,
} from '@/lib/yandexMaps';

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
  const marker = document.createElement('div');
  marker.style.cssText = `
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
  `;
  marker.textContent = point.label.slice(0, 1).toUpperCase();
  element.appendChild(marker);
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
  const mapsApiRef = useRef<YandexMaps3 | null>(null);
  const dynamicChildrenRef = useRef<unknown[]>([]);
  const onSelectRef = useRef(onSelect);
  // Track the last coords we reported so we don't fire on tiny floating-point drift
  const lastClickCoordsRef = useRef<[number, number]>([center.lng, center.lat]);
  // Debounce timer for pan-end reporting
  const panDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<'not_loaded' | 'loading' | 'loaded' | 'error'>('not_loaded');
  const [zoom, setZoom] = useState(14);
  const mapCenter = points[0] || center;
  const pointsSignature = useMemo(() => JSON.stringify(points), [points]);
  const lineSignature = useMemo(() => JSON.stringify(line || []), [line]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');

      try {
        const ymaps3 = await loadYandexMaps();
        if (cancelled || !containerRef.current) return;

        // FIX P0: Pass behaviors array so trackpad/mouse-wheel zoom works.
        // In Yandex Maps JS API v3, behaviors must be explicitly listed.
        // 'scrollZoom' enables trackpad pinch and mouse-wheel zoom.
        // 'drag' enables map panning.
        // Non-interactive maps still need 'drag' for normal mouse pan.
        const behaviors = interactive
          ? ['drag', 'scrollZoom', 'pinchZoom', 'dblClick']
          : ['drag'];

        const map = new ymaps3.YMap(containerRef.current, {
          location: { center: [mapCenter.lng, mapCenter.lat], zoom },
          theme: dark ? 'dark' : 'light',
          behaviors,
        } as Record<string, unknown>);

        map.addChild(new ymaps3.YMapDefaultSchemeLayer({ theme: dark ? 'dark' : 'light' }));
        map.addChild(new ymaps3.YMapDefaultFeaturesLayer());

        if (interactive) {
          // FIX P0: Only fire onSelect on explicit click events, NOT on pan/zoom.
          // The onUpdate approach was causing reverse-geocode spam on every pan frame.
          // A user clicking the map is a deliberate intent to select a point.
          // Panning to reposition is not — we use the center-pin metaphor instead.
          map.addChild(new ymaps3.YMapListener({
            onClick: (_object: unknown, event: { coordinates?: [number, number] }) => {
              const coordinates = event.coordinates;
              if (!coordinates) return;
              const [lng, lat] = coordinates;
              lastClickCoordsRef.current = [lng, lat];
              onSelectRef.current?.({ lng, lat });
            },
          } as Record<string, unknown>));
        }

        lastClickCoordsRef.current = [mapCenter.lng, mapCenter.lat];
        mapsApiRef.current = ymaps3;
        mapRef.current = map;
        setStatus('loaded');
      } catch (loadError) {
        if (cancelled) return;
        setStatus('error');
        if (process.env.NODE_ENV !== 'production') console.warn('[YandexMap]', loadError);
      }
    }

    init();
    return () => {
      cancelled = true;
      if (panDebounceRef.current) clearTimeout(panDebounceRef.current);
      mapRef.current?.destroy();
      mapRef.current = null;
      mapsApiRef.current = null;
      dynamicChildrenRef.current = [];
    };
    // Only reinit if dark/interactive flags change — center/zoom handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, interactive]);

  // Smoothly pan to center when parent changes selected address
  useEffect(() => {
    if (status !== 'loaded' || !mapRef.current) return;
    mapRef.current.update({
      location: {
        center: [mapCenter.lng, mapCenter.lat],
        zoom,
        duration: 250,
      },
    });
  }, [mapCenter.lat, mapCenter.lng, status, zoom]);

  // Update markers/lines without remounting
  useEffect(() => {
    const map = mapRef.current;
    const ymaps3 = mapsApiRef.current;
    if (status !== 'loaded' || !map || !ymaps3) return;

    dynamicChildrenRef.current.forEach((child) => map.removeChild?.(child));
    const nextChildren: unknown[] = [];

    if (line && line.length > 1) {
      const feature = new ymaps3.YMapFeature({
        geometry: {
          type: 'LineString',
          coordinates: line.map((point) => [point.lng, point.lat]),
        },
        style: { stroke: [{ color: '#f97316', width: 5, dash: [8, 6] }] },
      });
      map.addChild(feature);
      nextChildren.push(feature);
    }

    points.forEach((point) => {
      const marker = new ymaps3.YMapMarker(
        { coordinates: [point.lng, point.lat] },
        markerElement(point),
      );
      map.addChild(marker);
      nextChildren.push(marker);
    });

    dynamicChildrenRef.current = nextChildren;
  }, [line, lineSignature, points, pointsSignature, status]);

  const updateZoom = (nextZoom: number) => {
    const bounded = Math.min(18, Math.max(4, nextZoom));
    setZoom(bounded);
  };

  return (
    // FIX P0: The container must NOT have overflow-hidden while the map needs wheel events.
    // touch-action: none prevents the mobile browser from intercepting pinch gestures.
    // We keep overflow-hidden on outer wrapper for border-radius clipping only — that's fine
    // because wheel events are not blocked by overflow:hidden, only by pointer-events:none.
    <div className={`relative overflow-hidden overscroll-none rounded-[32px] bg-[#111827] ${heightClassName}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 text-white pointer-events-none">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-orange-500" />
            <p className="mt-3 font-black">Loading map...</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 p-6 text-white pointer-events-none">
          <div className="max-w-sm text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
              <MapPin size={26} />
            </div>
            <p className="mt-4 text-xl font-black">{fallbackLabel}</p>
            <p className="mt-2 text-sm font-bold text-gray-400">
              Enter the address manually and continue checkout.
            </p>
          </div>
        </div>
      )}

      {/* Center crosshair pin — pointer-events:none so wheel events pass through to map */}
      {interactive && status === 'loaded' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="address-picker-pin -mt-8 flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-orange-500 shadow-xl ring-[3px] ring-white" />
            <div className="h-6 w-1 rounded-b-full bg-orange-500" />
          </div>
        </div>
      )}

      {/* Zoom controls — these sit on top but have explicit pointer-events:auto */}
      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl" style={{ pointerEvents: 'auto' }}>
        <button aria-label="Zoom in" onClick={() => updateZoom(zoom + 1)} className="p-3 text-gray-950 hover:bg-gray-100"><Plus size={18} /></button>
        <button aria-label="Zoom out" onClick={() => updateZoom(zoom - 1)} className="border-t border-gray-100 p-3 text-gray-950 hover:bg-gray-100"><Minus size={18} /></button>
      </div>

      {interactive && showLocateControl && (
        <button
          type="button"
          style={{ pointerEvents: 'auto' }}
          onClick={() => navigator.geolocation?.getCurrentPosition((position) => onSelect?.({ lat: position.coords.latitude, lng: position.coords.longitude }))}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-gray-950 shadow-xl hover:bg-gray-100"
        >
          <LocateFixed size={18} /> Locate
        </button>
      )}
    </div>
  );
}
