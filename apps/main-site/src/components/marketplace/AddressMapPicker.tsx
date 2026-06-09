'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react';
import { TASHKENT_CENTER } from '@/lib/yandexMaps';
import { YandexMap } from './YandexMap';
import type { SavedAddress } from '@/context/MarketplaceContext';

type AddressOption = SavedAddress & { label: string };
type SelectedMeta = 'preset' | 'current' | 'map';

const addressCoordinates: Record<string, { lat: number; lng: number }> = {
  'Tashkent, Amir Temur Avenue 14': { lat: 41.311081, lng: 69.240562 },
  'Tashkent, Chorsu Bazaar entrance': { lat: 41.3261, lng: 69.2355 },
  'Tashkent, Mirabad Street 27': { lat: 41.2966, lng: 69.2817 },
  'Tashkent, Chilanzar C-5, house 12': { lat: 41.2852, lng: 69.2033 },
  'Tashkent, Yunusabad-4, building 8': { lat: 41.3672, lng: 69.2892 },
  'Tashkent, Yunusabad 4': { lat: 41.3672, lng: 69.2892 },
  'Tashkent, Magic City main gate': { lat: 41.3049, lng: 69.2468 },
  'Tashkent, Parkent Street 131': { lat: 41.3255, lng: 69.3311 },
  'Tashkent, Almazar metro station': { lat: 41.2566, lng: 69.1958 },
};

const primarySuggestions = [
  'Tashkent, Amir Temur Avenue 14',
  'Tashkent, Chorsu Bazaar entrance',
  'Tashkent, Mirabad Street 27',
  'Tashkent, Chilanzar C-5, house 12',
  'Tashkent, Yunusabad 4',
];

function cleanAddressTitle(text: string) {
  if (!text) return 'Selected point, Tashkent';
  if (text === 'Current location') return 'Current location';
  return text.replace(/^Tashkent,\s*/i, '').trim() || text;
}

function normalizeAddress(text: string, coords?: { lat: number; lng: number }): SavedAddress {
  const nextCoords = coords || addressCoordinates[text] || TASHKENT_CENTER;
  const inZone = text.toLowerCase().includes('tashkent') || text.toLowerCase().includes('toshkent') || text === 'Current location';
  return {
    text,
    inZone,
    lat: nextCoords.lat,
    lng: nextCoords.lng,
  };
}

export function AddressMapPicker({
  initialAddress,
  onCancel,
  onConfirm,
}: {
  initialAddress: SavedAddress;
  onCancel: () => void;
  onConfirm: (address: SavedAddress) => void;
}) {
  const [query, setQuery] = useState('');
  const [geocodeQuery, setGeocodeQuery] = useState('');
  const [geocodedSuggestions, setGeocodedSuggestions] = useState<AddressOption[]>([]);
  const [detectingAddress, setDetectingAddress] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [selected, setSelected] = useState<SavedAddress>(() => normalizeAddress(initialAddress.text || 'Tashkent, Amir Temur Avenue 14', {
    lat: initialAddress.lat || TASHKENT_CENTER.lat,
    lng: initialAddress.lng || TASHKENT_CENTER.lng,
  }));
  const [selectedMeta, setSelectedMeta] = useState<SelectedMeta>(initialAddress.text === 'Current location' ? 'current' : 'preset');
  const [error, setError] = useState('');

  const reverseGeocode = useCallback(async (coords: { lat: number; lng: number }) => {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
    if (!apiKey) return null;
    const params = new URLSearchParams({
      apikey: apiKey,
      format: 'json',
      lang: 'en_US',
      geocode: `${coords.lng},${coords.lat}`,
      results: '1',
    });
    const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json() as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{ GeoObject?: { name?: string; description?: string; metaDataProperty?: { GeocoderMetaData?: { text?: string } } } }>;
        };
      };
    };
    const geoObject = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const title = geoObject?.name || geoObject?.metaDataProperty?.GeocoderMetaData?.text;
    if (!title) return null;
    const description = geoObject?.description || 'Tashkent';
    return `${title}${description.toLowerCase().includes('tashkent') ? ', Tashkent' : ''}`;
  }, []);

  const geocodeSearch = useCallback(async (value: string) => {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
    if (!apiKey || value.trim().length < 3) return [];
    const params = new URLSearchParams({
      apikey: apiKey,
      format: 'json',
      lang: 'en_US',
      geocode: `${value.trim()}, Tashkent`,
      bbox: '69.1200,41.1900~69.4200,41.4200',
      rspn: '1',
      results: '4',
    });
    const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params.toString()}`);
    if (!response.ok) return [];
    const data = await response.json() as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{ GeoObject?: { name?: string; description?: string; Point?: { pos?: string } } }>;
        };
      };
    };
    return (data.response?.GeoObjectCollection?.featureMember || [])
      .map((item) => {
        const geoObject = item.GeoObject;
        const [lng, lat] = (geoObject?.Point?.pos || '').split(' ').map(Number);
        if (!geoObject?.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const label = `${geoObject.name}${geoObject.description?.toLowerCase().includes('tashkent') ? ', Tashkent' : ''}`;
        return { ...normalizeAddress(label, { lat, lng }), label };
      })
      .filter((item): item is AddressOption => Boolean(item));
  }, []);

  const suggestions: AddressOption[] = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const localSuggestions = primarySuggestions
      .filter((item) => !normalized || item.toLowerCase().includes(normalized))
      .map((item) => ({ ...normalizeAddress(item), label: item }));
    const merged = [...localSuggestions, ...geocodedSuggestions];
    return merged.filter((item, index, list) => list.findIndex((entry) => entry.label === item.label) === index);
  }, [geocodedSuggestions, query]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 3) {
      setGeocodeQuery('');
      setGeocodedSuggestions([]);
      setSearchingAddress(false);
      return;
    }
    const id = window.setTimeout(() => setGeocodeQuery(normalized), 350);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (!geocodeQuery) return;
    setSearchingAddress(true);
    geocodeSearch(geocodeQuery)
      .then((items) => {
        if (!cancelled) setGeocodedSuggestions(items);
      })
      .catch(() => {
        if (!cancelled) setGeocodedSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setSearchingAddress(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geocodeQuery, geocodeSearch]);

  const selectAddress = (item: AddressOption) => {
    const next = normalizeAddress(item.label, { lat: item.lat || TASHKENT_CENTER.lat, lng: item.lng || TASHKENT_CENTER.lng });
    setSelected(next);
    setSelectedMeta('preset');
    setQuery('');
    setError('');
  };

  const useCurrentLocation = () => {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = normalizeAddress('Current location', { lat: position.coords.latitude, lng: position.coords.longitude });
        setSelected(next);
        setSelectedMeta('current');
        setQuery('');
      },
      () => setError('Could not access your location. Select an address manually.'),
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const showEmptySuggestions = query.trim().length > 0 && suggestions.length === 0;
  const selectedDisplayText = showEmptySuggestions ? query.trim() : selected.text;

  const confirm = () => {
    const text = selectedDisplayText;
    const next = normalizeAddress(text, { lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng });
    if (!next.inZone) {
      setError('Delivery is available inside Tashkent. Choose a Tashkent address.');
      return;
    }
    onConfirm(next);
  };

  const selectedSecondary = selectedMeta === 'current' ? 'Detected location in Tashkent' : selectedMeta === 'map' ? 'Near selected point' : 'Tashkent delivery area';
  const selectedTitle = cleanAddressTitle(selectedDisplayText);

  const handleMapSelect = useCallback((coords: { lat: number; lng: number }) => {
    setSelected((current) => ({ ...current, text: 'Selected point, Tashkent', ...coords }));
    setSelectedMeta('map');
    setDetectingAddress(true);
    window.setTimeout(() => {
      reverseGeocode(coords)
        .then((label) => {
          if (!label) return;
          setSelected((current) => ({ ...current, text: label, ...coords }));
        })
        .catch(() => undefined)
        .finally(() => setDetectingAddress(false));
    }, 450);
  }, [reverseGeocode]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 p-0 md:p-4">
      <div className="mx-auto flex h-full max-h-none max-w-6xl flex-col overflow-hidden bg-white shadow-2xl md:mt-6 md:h-[calc(100vh-48px)] md:rounded-[36px]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 md:px-6">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-orange-500">Tashkent</p>
            <h2 className="text-3xl font-black leading-tight text-gray-950 md:text-4xl">Delivery address</h2>
          </div>
          <button aria-label="Close address picker" onClick={onCancel} className="rounded-full bg-gray-100 p-3 text-gray-700 hover:bg-gray-200"><X size={20} /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[390px_1fr] md:overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r border-gray-100 bg-white p-4 md:p-5">
            <div className="flex items-center gap-3 rounded-[24px] bg-gray-100 px-4 py-3.5 ring-1 ring-transparent focus-within:bg-white focus-within:ring-orange-200">
              <Search size={20} className="shrink-0 text-gray-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search address"
                className="min-w-0 flex-1 bg-transparent font-bold outline-none"
              />
              {query && <button onClick={() => setQuery('')} className="rounded-full bg-white p-1 text-gray-500"><X size={16} /></button>}
            </div>

            {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{error}</p>}

            <button onClick={useCurrentLocation} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[22px] bg-gray-950 px-4 py-3.5 font-black text-white shadow-sm hover:bg-gray-800">
              <LocateFixed size={18} /> Use current location
            </button>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Popular addresses</p>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-600">{searchingAddress ? 'Searching' : suggestions.length}</span>
              </div>
              <div className="space-y-2 md:max-h-[260px] md:overflow-y-auto md:pr-1">
                {suggestions.map((item) => {
                  const active = selected.text === item.label;
                  return (
                    <button
                      key={item.label}
                      onClick={() => selectAddress(item)}
                      className={`block w-full rounded-[22px] px-4 py-3 text-left transition ${active ? 'bg-orange-50 text-orange-700 ring-2 ring-orange-200' : 'bg-gray-50 text-gray-800 hover:bg-yellow-50'}`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-orange-500 text-white' : 'bg-white text-orange-500'}`}>
                          {active ? <CheckCircle2 size={18} /> : <MapPin size={18} />}
                        </span>
                        <span>
                          <span className="block font-black">{item.label.replace('Tashkent, ', '')}</span>
                          <span className="mt-0.5 block text-sm font-bold text-gray-500">Tashkent delivery area</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
                {showEmptySuggestions && (
                  <div className="rounded-[22px] bg-gray-50 px-4 py-5 text-center font-bold text-gray-500">
                    No matching address found. You can confirm the typed address.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[26px] bg-gray-950 p-4 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                  <Navigation size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-orange-300">Selected address</p>
                  <p className="mt-1 line-clamp-2 font-black leading-snug">{detectingAddress ? 'Detecting address...' : selectedTitle}</p>
                  <p className="mt-1 text-sm font-bold text-gray-300">{selectedSecondary}</p>
                  <p className="mt-1 text-xs font-bold text-gray-500">{(selected.lat || TASHKENT_CENTER.lat).toFixed(5)}, {(selected.lng || TASHKENT_CENTER.lng).toFixed(5)}</p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-4 mt-4 bg-white px-4 pb-4 pt-2 md:static md:mx-0 md:mt-auto md:p-0 md:pt-4">
              <button onClick={confirm} className="w-full rounded-[22px] bg-yellow-300 px-4 py-4 font-black text-gray-950 shadow-sm hover:bg-yellow-200">Confirm address</button>
            </div>
          </aside>

          <section className="min-h-[360px] bg-gray-950 p-3 md:min-h-[420px] md:p-5">
            <YandexMap
              center={{ lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng }}
              points={[{ id: 'selected', label: 'Address', lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng, color: '#f97316' }]}
              interactive
              dark
              showLocateControl={false}
              heightClassName="h-[360px] md:h-full md:min-h-[420px]"
              fallbackLabel="Map is unavailable. You can still confirm the typed address."
              onSelect={handleMapSelect}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
