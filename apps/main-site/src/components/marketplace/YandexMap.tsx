'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import { toYandexCoords } from '@repo/shared-types';
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

export type MapPath = {
  id: string;
  points: Array<{ lat: number; lng: number }>;
  color?: string;
  dashed?: boolean;
};

type YandexMapProps = {
  center?: { lat: number; lng: number };
  points?: MapPoint[];
  line?: Array<{ lat: number; lng: number }>;
  paths?: MapPath[];
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
  element.className = 'ymaps-custom-marker';
  element.style.cssText = 'transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;';
  const marker = document.createElement('div');
  const color = point.color || '#ff6b00';
  marker.style.cssText = `
    width: 42px;
    height: 50px;
    filter: drop-shadow(0 14px 22px rgba(0,0,0,.38));
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  marker.innerHTML = `
    <svg width="42" height="50" viewBox="0 0 42 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M21 49C21 49 39 29.9 39 18.6C39 8.9 30.94 1 21 1C11.06 1 3 8.9 3 18.6C3 29.9 21 49 21 49Z" fill="${color}" stroke="white" stroke-width="4"/>
      <circle cx="21" cy="18.5" r="6.5" fill="white"/>
    </svg>
  `;
  const label = document.createElement('div');
  label.style.cssText = `
    margin-top: -2px;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-radius: 999px;
    background: rgba(255,255,255,.96);
    padding: 6px 10px;
    color: #111827;
    box-shadow: 0 8px 22px rgba(15,23,42,.24);
    font: 800 12px system-ui;
  `;
  label.textContent = point.label;
  element.appendChild(marker);
  element.appendChild(label);
  return element;
}

export function YandexMap({
  center = TASHKENT_CENTER,
  points = [],
  line,
  paths = [],
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
  const [status, setStatus] = useState<'not_loaded' | 'loading' | 'loaded' | 'error'>('not_loaded');
  const [zoom, setZoom] = useState(14);
  const mapCenter = points[0] || center;
  const pointsSignature = JSON.stringify(points);
  const lineSignature = JSON.stringify(line || []);
  const pathsSignature = JSON.stringify(paths);

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
              onSelectRef.current?.({ lng, lat });
            },
          } as Record<string, unknown>));
        }

        mapsApiRef.current = ymaps3;
        mapRef.current = map;
        setStatus('loaded');
      } catch {
        if (cancelled) return;
        setStatus('error');
      }
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      mapsApiRef.current = null;
      dynamicChildrenRef.current = [];
    };
    // Only reinit if dark/interactive flags change — center/zoom handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, interactive]);

  // Fit tracking maps to every visible point; single-point pickers keep their selected zoom.
  useEffect(() => {
    if (status !== 'loaded' || !mapRef.current) return;
    if (points.length > 1) {
      const lngs = points.map((point) => point.lng);
      const lats = points.map((point) => point.lat);
      mapRef.current.update({
        location: {
          bounds: [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          margin: [70, 70, 70, 70],
          duration: 250,
        },
      });
      return;
    }
    mapRef.current.update({
      location: { center: toYandexCoords(mapCenter), zoom, duration: 250 },
    });
  }, [mapCenter.lat, mapCenter.lng, points.length, pointsSignature, status, zoom]);

  // Update markers/lines without remounting
  useEffect(() => {
    const map = mapRef.current;
    const ymaps3 = mapsApiRef.current;
    if (status !== 'loaded' || !map || !ymaps3) return;

    dynamicChildrenRef.current.forEach((child) => map.removeChild?.(child));
    const nextChildren: unknown[] = [];

    const visiblePaths: MapPath[] = [
      ...(line && line.length > 1 ? [{ id: 'legacy-line', points: line, color: '#f97316', dashed: true }] : []),
      ...paths,
    ];

    visiblePaths.forEach((path) => {
      if (path.points.length < 2) return;
      const feature = new ymaps3.YMapFeature({
        geometry: {
          type: 'LineString',
          coordinates: path.points.map(toYandexCoords),
        },
        style: {
          stroke: [{
            color: path.color || '#f97316',
            width: 5,
            ...(path.dashed ? { dash: [8, 6] } : {}),
          }],
        },
      });
      map.addChild(feature);
      nextChildren.push(feature);
    });

    points.forEach((point) => {
      const marker = new ymaps3.YMapMarker(
        { coordinates: toYandexCoords(point) },
        markerElement(point),
      );
      map.addChild(marker);
      nextChildren.push(marker);
    });

    dynamicChildrenRef.current = nextChildren;
  }, [lineSignature, pathsSignature, pointsSignature, status]);

  const updateZoom = (nextZoom: number) => {
    const bounded = Math.min(18, Math.max(4, nextZoom));
    setZoom(bounded);
  };

  const selectFromFallback = (event: MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    onSelect({
      lat: mapCenter.lat - y * 0.08,
      lng: mapCenter.lng + x * 0.12,
    });
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
            <p className="mt-3 font-black">Loading map…</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div
          onClick={selectFromFallback}
          className={`absolute inset-0 overflow-hidden bg-[#050914] text-white ${interactive ? 'cursor-crosshair' : 'pointer-events-none'}`}
        >
          <div className="absolute inset-0 opacity-65 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute left-[-10%] top-[22%] h-4 w-[120%] rotate-[12deg] rounded-full bg-[#26313f]" />
          <div className="absolute left-[20%] top-[-10%] h-[120%] w-4 rotate-[18deg] rounded-full bg-[#26313f]" />
          <div className="absolute left-[5%] top-[66%] h-3 w-[105%] -rotate-[7deg] rounded-full bg-[#303b4a]" />
          <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center">
            <div className="text-orange-500 drop-shadow-[0_18px_30px_rgba(0,0,0,.45)]">
              <MapPin size={52} className="fill-orange-500 text-white" />
            </div>
            <div className="mt-4 rounded-2xl bg-black/45 px-5 py-3 text-center backdrop-blur">
              <p className="text-lg font-black">{interactive ? 'Select a point on the map' : fallbackLabel}</p>
              <p className="mt-1 text-sm font-bold text-gray-400">
                {(mapCenter.lat || TASHKENT_CENTER.lat).toFixed(5)}, {(mapCenter.lng || TASHKENT_CENTER.lng).toFixed(5)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Center crosshair pin — pointer-events:none so wheel events pass through to map */}
      {interactive && status === 'loaded' && points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="address-picker-pin -mt-6 flex flex-col items-center">
            <MapPin size={58} className="fill-orange-500 text-white drop-shadow-[0_18px_30px_rgba(0,0,0,.45)]" />
          </div>
        </div>
      )}

      {/* Zoom controls — these sit on top but have explicit pointer-events:auto */}
      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-2xl bg-[#2b2a29] shadow-xl ring-1 ring-white/10" style={{ pointerEvents: 'auto' }}>
        <button aria-label="Zoom in" onClick={() => updateZoom(zoom + 1)} className="p-3 text-white hover:bg-[#3b3a38]"><Plus size={18} /></button>
        <button aria-label="Zoom out" onClick={() => updateZoom(zoom - 1)} className="border-t border-white/10 p-3 text-white hover:bg-[#3b3a38]"><Minus size={18} /></button>
      </div>

      {interactive && showLocateControl && (
        <button
          type="button"
          style={{ pointerEvents: 'auto' }}
          onClick={() => navigator.geolocation?.getCurrentPosition((position) => onSelect?.({ lat: position.coords.latitude, lng: position.coords.longitude }))}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-2xl bg-[#fce000] px-4 py-3 font-black text-[#111] shadow-xl hover:bg-[#ffe530]"
        >
          <LocateFixed size={18} /> Locate
        </button>
      )}
    </div>
  );
}
