'use client';

export type YandexMapsStatus = 'not_loaded' | 'loading' | 'loaded' | 'error';

export type YandexMaps3 = {
  ready: Promise<void>;
  YMap: new (element: HTMLElement, options: Record<string, unknown>) => YMapInstance;
  YMapDefaultSchemeLayer: new (options?: Record<string, unknown>) => unknown;
  YMapDefaultFeaturesLayer: new (options?: Record<string, unknown>) => unknown;
  YMapMarker: new (options: Record<string, unknown>, element: HTMLElement) => unknown;
  YMapListener: new (options: Record<string, unknown>) => unknown;
  YMapFeature: new (options: Record<string, unknown>) => unknown;
};

export type YMapInstance = {
  addChild: (child: unknown) => YMapInstance;
  removeChild?: (child: unknown) => YMapInstance;
  destroy: () => void;
  update: (options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    ymaps3?: YandexMaps3;
    __ymaps3Promise?: Promise<YandexMaps3>;
    __ymaps3Status?: YandexMapsStatus;
  }
}

export const TASHKENT_CENTER = { lat: 41.311081, lng: 69.240562 };

export function isYandexMapsKeyConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY);
}

export function getYandexMapsStatus(): YandexMapsStatus {
  if (typeof window === 'undefined') return 'not_loaded';
  return window.__ymaps3Status || (window.ymaps3 ? 'loaded' : 'not_loaded');
}

export function loadYandexMaps(): Promise<YandexMaps3> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Yandex Maps can only load in the browser.'));
  }

  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  if (!apiKey) {
    window.__ymaps3Status = 'error';
    return Promise.reject(new Error('Yandex Maps API key is not configured.'));
  }

  if (window.ymaps3) {
    window.__ymaps3Status = 'loaded';
    return Promise.resolve(window.ymaps3);
  }

  if (window.__ymaps3Promise) return window.__ymaps3Promise;

  window.__ymaps3Status = 'loading';
  window.__ymaps3Promise = new Promise<YandexMaps3>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps-v3="true"]');

    const onReady = async () => {
      try {
        if (!window.ymaps3) throw new Error('Yandex Maps did not initialize.');
        await window.ymaps3.ready;
        window.__ymaps3Status = 'loaded';
        resolve(window.ymaps3);
      } catch (error) {
        window.__ymaps3Status = 'error';
        reject(error);
      }
    };

    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => {
        window.__ymaps3Status = 'error';
        reject(new Error('Could not load Yandex Maps.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=en_US`;
    script.async = true;
    script.dataset.yandexMapsV3 = 'true';
    script.onload = onReady;
    script.onerror = () => {
      window.__ymaps3Status = 'error';
      reject(new Error('Could not load Yandex Maps.'));
    };
    document.head.appendChild(script);
  });

  return window.__ymaps3Promise;
}

export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
