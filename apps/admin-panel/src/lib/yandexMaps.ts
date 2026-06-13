'use client';

export type YandexMapsStatus = 'not_loaded' | 'loading' | 'loaded' | 'error';

export type YandexMaps3 = {
  ready: Promise<void>;
  YMap: new (element: HTMLElement, options: Record<string, unknown>) => YMapInstance;
  YMapDefaultSchemeLayer: new (options?: Record<string, unknown>) => unknown;
  YMapDefaultFeaturesLayer: new (options?: Record<string, unknown>) => unknown;
  YMapMarker: new (options: Record<string, unknown>, element: HTMLElement) => unknown;
  YMapListener: new (options: Record<string, unknown>) => unknown;
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
    __adminYmaps3Promise?: Promise<YandexMaps3>;
    __adminYmaps3Status?: YandexMapsStatus;
  }
}

export const TASHKENT_CENTER = { lat: 41.311081, lng: 69.240562 };

export function loadAdminYandexMaps(): Promise<YandexMaps3> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Yandex Maps can only load in the browser.'));
  }

  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  if (!apiKey) {
    window.__adminYmaps3Status = 'error';
    return Promise.reject(new Error('Yandex Maps API key is not configured.'));
  }

  if (window.ymaps3) {
    window.__adminYmaps3Status = 'loaded';
    return Promise.resolve(window.ymaps3);
  }

  if (window.__adminYmaps3Promise) return window.__adminYmaps3Promise;

  window.__adminYmaps3Status = 'loading';
  window.__adminYmaps3Promise = new Promise<YandexMaps3>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps-v3="true"]');

    const onReady = async () => {
      try {
        if (!window.ymaps3) throw new Error('Yandex Maps did not initialize.');
        await window.ymaps3.ready;
        window.__adminYmaps3Status = 'loaded';
        resolve(window.ymaps3);
      } catch (error) {
        window.__adminYmaps3Status = 'error';
        reject(error);
      }
    };

    if (existing) {
      if (window.ymaps3) {
        void onReady();
      } else {
        existing.addEventListener('load', onReady, { once: true });
        existing.addEventListener('error', () => {
          window.__adminYmaps3Status = 'error';
          reject(new Error('Could not load Yandex Maps.'));
        }, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=en_US`;
    script.async = true;
    script.dataset.yandexMapsV3 = 'true';
    script.onload = onReady;
    script.onerror = () => {
      window.__adminYmaps3Status = 'error';
      reject(new Error('Could not load Yandex Maps.'));
    };
    document.head.appendChild(script);
  });

  return window.__adminYmaps3Promise;
}
