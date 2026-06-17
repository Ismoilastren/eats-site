'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import {
  isAdminYandexMapsKeyConfigured,
  loadAdminYandexMaps,
  type YandexMaps3,
  type YMapInstance,
} from '@/lib/yandexMaps';
import type { RestaurantLocationValue } from '@/lib/restaurantAdmin';
import { reverseGeocodeRestaurant } from '@/lib/yandexGeocoder';
import { fromYandexCoords, toYandexCoords } from '@repo/shared-types';

type RestaurantLocationPickerProps = {
  value: RestaurantLocationValue;
  onChange: (value: RestaurantLocationValue) => void;
  error?: string;
};

const PRESET_LOCATIONS = [
  { label: 'Amir Temur branch', address: 'Tashkent, Amir Temur Avenue 14', lat: 41.3266, lng: 69.2817 },
  { label: 'Chorsu branch', address: 'Tashkent, Chorsu Bazaar entrance', lat: 41.3261, lng: 69.2358 },
  { label: 'Mirabad branch', address: 'Tashkent, Mirabad Street 27', lat: 41.2958, lng: 69.2831 },
  { label: 'Chilanzar branch', address: 'Tashkent, Chilanzar C-5, house 12', lat: 41.2859, lng: 69.2031 },
  { label: 'Yunusabad branch', address: 'Tashkent, Yunusabad 4', lat: 41.3672, lng: 69.2892 },
];

function markerElement() {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'transform: translate(-50%, -100%);';
  wrapper.innerHTML = `
    <div style="
      width: 38px;
      height: 38px;
      border-radius: 999px;
      background: #f97316;
      border: 4px solid #fff;
      box-shadow: 0 16px 30px rgba(15,23,42,.28);
    "></div>
    <div style="
      width: 5px;
      height: 22px;
      margin: -2px auto 0;
      background: #f97316;
      border-radius: 0 0 999px 999px;
      box-shadow: 0 12px 20px rgba(15,23,42,.22);
    "></div>
  `;
  return wrapper;
}

function MapSetupPanel({ loadError }: { loadError: string }) {
  const missingPublicKey = !isAdminYandexMapsKeyConfigured() || loadError.includes('not configured');

  return (
    <div className="max-w-sm text-left">
      <MapPin className="mx-auto text-orange-400" size={32} />
      <p className="mt-3 text-center font-bold text-white">Map setup required</p>
      <p className="mt-1 text-center text-sm text-gray-400">
        {missingPublicKey
          ? 'Missing NEXT_PUBLIC_YANDEX_MAPS_API_KEY. Manual address entry remains available.'
          : 'Check the Yandex JavaScript API key and allowed admin domain.'}
      </p>
      <div className="mt-4 rounded-xl bg-white/10 p-3 text-xs font-semibold text-gray-200">
        <p className="font-bold text-white">Required env</p>
        <p className="mt-1 font-mono text-orange-200">NEXT_PUBLIC_YANDEX_MAPS_API_KEY</p>
        <p className="mt-3 font-bold text-white">Allowed host</p>
        <p className="mt-1 font-mono text-orange-200">eats-adminn.vercel.app</p>
      </div>
      {loadError ? (
        <p className="mt-3 text-center text-[11px] font-semibold text-gray-500">Technical detail: {loadError}</p>
      ) : null}
    </div>
  );
}

function RestaurantAdminMap({
  value,
  onSelect,
}: {
  value: RestaurantLocationValue;
  onSelect: (coords: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const apiRef = useRef<YandexMaps3 | null>(null);
  const markerRef = useRef<unknown | null>(null);
  const onSelectRef = useRef(onSelect);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      setLoadError('');

      try {
        const ymaps3 = await loadAdminYandexMaps();
        if (cancelled || !containerRef.current) return;

        const map = new ymaps3.YMap(containerRef.current, {
          location: { center: toYandexCoords(value), zoom: 13 },
          theme: 'light',
          behaviors: ['drag', 'scrollZoom', 'pinchZoom', 'dblClick'],
        });
        map.addChild(new ymaps3.YMapDefaultSchemeLayer());
        map.addChild(new ymaps3.YMapDefaultFeaturesLayer());
        map.addChild(new ymaps3.YMapListener({
          onClick: (_object: unknown, event: { coordinates?: [number, number] }) => {
            const coordinates = event.coordinates;
            if (!coordinates) return;
            onSelectRef.current(fromYandexCoords(coordinates));
          },
        } as Record<string, unknown>));

        mapRef.current = map;
        apiRef.current = ymaps3;
        setStatus('loaded');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setLoadError(error instanceof Error ? error.message : 'Could not load Yandex Maps.');
          if (process.env.NODE_ENV !== 'production' && isAdminYandexMapsKeyConfigured()) console.warn('[RestaurantAdminMap]', error);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      apiRef.current = null;
      markerRef.current = null;
    };
    // Mount once; selected center/marker are updated in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps3 = apiRef.current;
    if (!map || !ymaps3 || status !== 'loaded') return;

    if (markerRef.current) map.removeChild?.(markerRef.current);
    markerRef.current = null;
    if (!value.coordinatesConfirmed) return;
    const marker = new ymaps3.YMapMarker({ coordinates: toYandexCoords(value) }, markerElement());
    map.addChild(marker);
    markerRef.current = marker;
    map.update({ location: { center: toYandexCoords(value), zoom: 14, duration: 250 } });
  }, [status, value.coordinatesConfirmed, value.lat, value.lng]);

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-2xl bg-gray-950">
      <div ref={containerRef} className="h-[320px] w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 text-sm font-bold text-white">
          Loading map...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 p-6 text-center text-white">
          <MapSetupPanel loadError={loadError} />
        </div>
      )}
    </div>
  );
}

export function RestaurantLocationPicker({ value, onChange, error }: RestaurantLocationPickerProps) {
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState('');
  const requestRef = useRef(0);
  const filteredPresets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return PRESET_LOCATIONS;
    return PRESET_LOCATIONS.filter((item) =>
      `${item.label} ${item.address}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  const updateAddress = (address: string) => {
    onChange({ ...value, address, source: 'manual' });
    setGeocodeMessage('');
  };

  const selectPreset = (preset: typeof PRESET_LOCATIONS[number]) => {
    onChange({
      address: preset.address,
      lat: preset.lat,
      lng: preset.lng,
      source: 'admin',
      coordinatesConfirmed: true,
    });
    setQuery('');
    setGeocodeMessage('');
  };

  const resolveCoordinates = async (
    coords: { lat: number; lng: number },
    source: RestaurantLocationValue['source'],
  ) => {
    const requestId = ++requestRef.current;
    setResolving(true);
    setGeocodeMessage('Resolving readable address...');
    onChange({ address: '', ...coords, source, coordinatesConfirmed: true });

    const result = await reverseGeocodeRestaurant(coords.lat, coords.lng);
    if (requestId !== requestRef.current) return;
    setResolving(false);

    if (result.address) {
      onChange({ address: result.address, ...coords, source: 'geocode', coordinatesConfirmed: true });
      setGeocodeMessage('Readable address resolved by Yandex Geocoder.');
      return;
    }

    setGeocodeMessage(
      `${result.error || 'Address could not be resolved.'} [${result.errorCode || 'ADDRESS_NOT_RESOLVED'}] Enter the address manually.`,
    );
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeocodeMessage('Browser location is unavailable. Enter the address manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void resolveCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }, 'current_location');
      },
      () => setGeocodeMessage('Location permission was denied or unavailable. Enter the address manually.'),
      { enableHighAccuracy: true, timeout: 7000 },
    );
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4">
        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
          Branch / filial address
        </label>
        <textarea
          value={value.address}
          onChange={(event) => updateAddress(event.target.value)}
          rows={3}
          placeholder="Enter exact branch pickup address, e.g. Tashkent, Amir Temur Avenue 14"
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        {geocodeMessage && (
          <p className={`mt-2 text-xs font-semibold ${geocodeMessage.includes('[') ? 'text-amber-700' : 'text-emerald-700'}`}>
            {geocodeMessage}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search branch address preset"
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white hover:bg-gray-800 dark:bg-orange-500 dark:hover:bg-orange-600"
          >
            <LocateFixed size={17} /> Use this device location
          </button>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Branch address presets</p>
              <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-600">
                {filteredPresets.length}
              </span>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {filteredPresets.length ? filteredPresets.map((preset) => (
                <button
                  key={preset.address}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className="flex w-full items-start gap-3 rounded-xl bg-gray-50 p-3 text-left hover:bg-orange-50 dark:bg-gray-950 dark:hover:bg-orange-500/10"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 dark:bg-gray-900">
                    <MapPin size={17} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-gray-900 dark:text-white">{preset.label}</span>
                    <span className="text-xs font-semibold text-gray-500">{preset.address}</span>
                  </span>
                </button>
              )) : (
                <div className="rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-500 dark:bg-gray-950">
                  No preset address found. You can still enter the address manually.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gray-950 p-4 text-white">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">Selected point</p>
            <p className="mt-2 line-clamp-2 text-sm font-bold">
              {resolving ? 'Resolving readable address...' : value.address || 'Enter a readable address'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {value.coordinatesConfirmed
                ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} · ${value.source}`
                : 'No map point selected · manual address mode'}
            </p>
          </div>
        </div>

        <RestaurantAdminMap
          value={value}
          onSelect={(coords) => {
            void resolveCoordinates(coords, 'map');
          }}
        />
      </div>
    </div>
  );
}
