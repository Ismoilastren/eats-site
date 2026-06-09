'use client';

import { useMemo, useState } from 'react';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { addressSuggestions } from '@/data/marketplace';
import { TASHKENT_CENTER } from '@/lib/yandexMaps';
import { YandexMap } from './YandexMap';
import type { SavedAddress } from '@/context/MarketplaceContext';

type AddressOption = SavedAddress & { label: string };

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
  const [query, setQuery] = useState(initialAddress.text || '');
  const [selected, setSelected] = useState<SavedAddress>(() => normalizeAddress(initialAddress.text || 'Tashkent, Amir Temur Avenue 14', {
    lat: initialAddress.lat || TASHKENT_CENTER.lat,
    lng: initialAddress.lng || TASHKENT_CENTER.lng,
  }));
  const [error, setError] = useState('');

  const suggestions: AddressOption[] = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return addressSuggestions
      .filter((item) => !normalized || item.toLowerCase().includes(normalized))
      .slice(0, 6)
      .map((item) => ({ ...normalizeAddress(item), label: item }));
  }, [query]);

  const selectAddress = (value: string) => {
    const next = normalizeAddress(value);
    setSelected(next);
    setQuery(value);
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
        setQuery(next.text);
      },
      () => setError('Could not access your location. Select an address manually.'),
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const confirm = () => {
    const text = query.trim() || selected.text;
    const next = normalizeAddress(text, { lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng });
    if (!next.inZone) {
      setError('Delivery is available inside Tashkent. Choose a Tashkent address.');
      return;
    }
    onConfirm(next);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 p-0 md:p-4">
      <div className="mx-auto flex h-full max-h-none max-w-6xl flex-col overflow-hidden bg-white shadow-2xl md:mt-6 md:h-[calc(100vh-48px)] md:rounded-[36px]">
        <div className="flex items-center justify-between border-b border-gray-100 p-5 md:p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-orange-500">Tashkent</p>
            <h2 className="text-3xl font-black text-gray-950 md:text-4xl">Delivery address</h2>
          </div>
          <button onClick={onCancel} className="rounded-full bg-gray-100 p-3 text-gray-700 hover:bg-gray-200"><X size={20} /></button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[380px_1fr]">
          <aside className="flex min-h-0 flex-col border-r border-gray-100 p-5 md:p-6">
            <div className="flex items-center gap-3 rounded-3xl bg-gray-100 px-4 py-4">
              <Search size={20} className="text-gray-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search street, building, landmark"
                className="min-w-0 flex-1 bg-transparent font-bold outline-none"
              />
              {query && <button onClick={() => setQuery('')}><X size={18} /></button>}
            </div>

            {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{error}</p>}

            <button onClick={useCurrentLocation} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-4 font-black text-white hover:bg-gray-800">
              <LocateFixed size={18} /> Use current location
            </button>

            <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {suggestions.map((item) => (
                <button
                  key={item.label}
                  onClick={() => selectAddress(item.label)}
                  className={`block w-full rounded-2xl px-4 py-3 text-left font-bold transition ${selected.text === item.label ? 'bg-orange-50 text-orange-700 ring-2 ring-orange-200' : 'bg-gray-50 text-gray-700 hover:bg-yellow-50'}`}
                >
                  <span className="flex items-start gap-2">
                    <MapPin size={18} className="mt-0.5 shrink-0 text-orange-500" />
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-3xl bg-gray-950 p-4 text-white">
              <p className="text-sm font-black uppercase tracking-widest text-orange-300">Selected</p>
              <p className="mt-2 font-black">{query.trim() || selected.text}</p>
              <p className="mt-1 text-sm font-bold text-gray-400">{(selected.lat || TASHKENT_CENTER.lat).toFixed(5)}, {(selected.lng || TASHKENT_CENTER.lng).toFixed(5)}</p>
            </div>

            <button onClick={confirm} className="mt-4 w-full rounded-2xl bg-yellow-300 px-4 py-4 font-black text-gray-950 hover:bg-yellow-200">Confirm address</button>
          </aside>

          <section className="min-h-[420px] bg-gray-950 p-4 md:p-6">
            <YandexMap
              center={{ lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng }}
              points={[{ id: 'selected', label: 'Address', lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng, color: '#f97316' }]}
              interactive
              dark
              heightClassName="h-full min-h-[420px]"
              fallbackLabel="Map is unavailable. You can still confirm the typed address."
              onSelect={(coords) => setSelected((current) => ({ ...current, ...coords }))}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
