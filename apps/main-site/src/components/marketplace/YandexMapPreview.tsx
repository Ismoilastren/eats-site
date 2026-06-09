'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

declare global {
  interface Window {
    ymaps?: {
      ready: (callback: () => void) => void;
      Map: new (element: HTMLElement, options: Record<string, unknown>) => { destroy: () => void; geoObjects: { add: (item: unknown) => void } };
      Placemark: new (coordinates: [number, number], properties?: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
    };
  }
}

type YandexMapPreviewProps = {
  center: { lat: number; lng: number };
  label: string;
  className?: string;
};

export function YandexMapPreview({ center, label, className = '' }: YandexMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<{ destroy: () => void } | null>(null);
  const [fallback, setFallback] = useState(!process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) {
      setFallback(true);
      return;
    }

    let cancelled = false;
    const createMap = () => {
      if (cancelled || !mapRef.current || !window.ymaps) return;
      instanceRef.current?.destroy();
      const map = new window.ymaps.Map(mapRef.current, {
        center: [center.lat, center.lng],
        controls: ['zoomControl'],
        zoom: 13,
      });
      map.geoObjects.add(new window.ymaps.Placemark([center.lat, center.lng], { balloonContent: label }, { preset: 'islands#orangeDotIcon' }));
      instanceRef.current = map;
      setFallback(false);
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-yandex-maps="true"]');
    if (window.ymaps) {
      window.ymaps.ready(createMap);
    } else if (existingScript) {
      existingScript.addEventListener('load', () => window.ymaps?.ready(createMap), { once: true });
      existingScript.addEventListener('error', () => setFallback(true), { once: true });
    } else {
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=en_US`;
      script.async = true;
      script.dataset.yandexMaps = 'true';
      script.onload = () => window.ymaps?.ready(createMap);
      script.onerror = () => setFallback(true);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [center.lat, center.lng, label]);

  if (fallback) {
    return (
      <div className={`flex min-h-44 items-center gap-3 rounded-3xl bg-gray-100 p-5 text-gray-700 ${className}`}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <MapPin size={22} />
        </div>
        <div>
          <p className="font-black text-gray-950">{label}</p>
          <p className="mt-1 text-sm font-bold text-gray-500">
            Map preview fallback. Add NEXT_PUBLIC_YANDEX_MAPS_API_KEY to enable Yandex Maps.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={`min-h-44 overflow-hidden rounded-3xl bg-gray-100 ${className}`} />;
}
