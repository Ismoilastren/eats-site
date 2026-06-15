'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react';
import { TASHKENT_CENTER } from '@/lib/yandexMaps';
import { geocodeAddress, getLastGeocoderError, reverseGeocode } from '@/lib/yandexGeocoder';
import { YandexMap } from './YandexMap';
import type { SavedAddress } from '@/context/MarketplaceContext';
import { isPlaceholderAddress, isReadableAddress, type AppAddress } from '@repo/shared-types';

type AddressOption = SavedAddress & { label: string };
type SelectedMeta = NonNullable<AppAddress['source']>;

// Resolution state for the currently selected address text
type ResolutionState = 'idle' | 'loading' | 'resolved' | 'error';

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
  if (!text) return '';
  return text.replace(/^Tashkent,\s*/i, '').trim() || text;
}



function isInsideTashkent(coords: { lat: number; lng: number }) {
  return coords.lat >= 40.95 && coords.lat <= 41.55 && coords.lng >= 68.95 && coords.lng <= 69.55;
}

function normalizeManualAddress(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /tashkent|toshkent/i.test(trimmed) ? trimmed : `Tashkent, ${trimmed}`;
}

function geocoderFallbackMessage() {
  const failure = getLastGeocoderError();
  return failure
    ? `${failure.message} [${failure.code}] Enter the address manually below.`
    : 'We could not detect the exact address. Enter it manually below.';
}

function normalizeAddress(
  text: string,
  coords?: { lat: number; lng: number },
  source: SelectedMeta = 'suggestion',
): SavedAddress {
  const nextCoords = coords || addressCoordinates[text] || TASHKENT_CENTER;
  const normalizedText = text.toLowerCase();
  const inZone = normalizedText.includes('tashkent')
    || normalizedText.includes('toshkent')
    || isInsideTashkent(nextCoords);
  return {
    text,
    inZone,
    lat: nextCoords.lat,
    lng: nextCoords.lng,
    source,
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
  const [manualAddress, setManualAddress] = useState('');

  // `selected` holds coordinates + resolved text (or empty text while resolving)
  const [selected, setSelected] = useState<SavedAddress>(() => {
    const hasRealAddress = !isPlaceholderAddress(initialAddress.text);
    return normalizeAddress(
      hasRealAddress ? initialAddress.text : '',
      {
        lat: initialAddress.lat || TASHKENT_CENTER.lat,
        lng: initialAddress.lng || TASHKENT_CENTER.lng,
      },
      initialAddress.source || (hasRealAddress ? 'suggestion' : 'map'),
    );
  });

  const [selectedMeta, setSelectedMeta] = useState<SelectedMeta>(
    initialAddress.source || (isPlaceholderAddress(initialAddress.text) ? 'map' : 'suggestion'),
  );

  // resolutionState tracks whether we have a readable address text for the selected coords
  const [resolutionState, setResolutionState] = useState<ResolutionState>(
    isPlaceholderAddress(initialAddress.text) ? 'idle' : 'resolved',
  );

  const [confirmingAddress, setConfirmingAddress] = useState(false);
  const [error, setError] = useState('');

  // Request counter to cancel stale geocode responses
  const geocodeRequestRef = useRef(0);
  // Debounce timer for map-click geocoding
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Search suggestions ───────────────────────────────────────────────────
  const suggestions: AddressOption[] = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const localSuggestions = primarySuggestions
      .filter((item) => !normalized || item.toLowerCase().includes(normalized))
      .map((item) => ({ ...normalizeAddress(item, undefined, 'suggestion'), label: item }));
    const merged = [...localSuggestions, ...geocodedSuggestions];
    return merged.filter((item, index, list) => list.findIndex((entry) => entry.label === item.label) === index);
  }, [geocodedSuggestions, query]);

  // Debounce search query → geocoder
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 3) {
      setGeocodeQuery('');
      setGeocodedSuggestions([]);
      setSearchingAddress(false);
      return;
    }
    const id = setTimeout(() => setGeocodeQuery(normalized), 350);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (!geocodeQuery) return;
    setSearchingAddress(true);
    geocodeAddress(geocodeQuery)
      .then((items) => {
        if (!cancelled) {
          setGeocodedSuggestions(items.map((item) => ({
            ...normalizeAddress(item.fullAddress, { lat: item.lat, lng: item.lng }, 'suggestion'),
            label: item.fullAddress,
          })));
        }
      })
      .catch(() => {
        if (!cancelled) setGeocodedSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setSearchingAddress(false);
      });
    return () => { cancelled = true; };
  }, [geocodeQuery]);

  // ─── FIX: Remove the old `resolutionState === 'idle'` useEffect that was
  // double-triggering geocoding and conflicting with handleMapSelect.
  // Initial geocoding (when modal opens with a map point but no address) is
  // handled once here, and only once.
  const didInitialGeocodeRef = useRef(false);
  useEffect(() => {
    if (didInitialGeocodeRef.current) return;
    if (resolutionState !== 'idle') {
      didInitialGeocodeRef.current = true;
      return;
    }
    didInitialGeocodeRef.current = true;

    const coords = {
      lat: selected.lat || TASHKENT_CENTER.lat,
      lng: selected.lng || TASHKENT_CENTER.lng,
    };
    const requestId = ++geocodeRequestRef.current;
    setResolutionState('loading');
    setDetectingAddress(true);

    reverseGeocode(coords.lat, coords.lng)
      .then((result) => {
        if (requestId !== geocodeRequestRef.current) return;
        if (!result || isPlaceholderAddress(result.fullAddress)) {
          setResolutionState('error');
          setError(geocoderFallbackMessage());
          return;
        }
        setSelected(normalizeAddress(result.fullAddress, coords, 'map'));
        setResolutionState('resolved');
        setError('');
      })
      .catch(() => {
        if (requestId !== geocodeRequestRef.current) return;
        setResolutionState('error');
        setError(geocoderFallbackMessage());
      })
      .finally(() => {
        if (requestId === geocodeRequestRef.current) setDetectingAddress(false);
      });
  // Run only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => () => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
  }, []);

  // ─── Select from suggestion list ─────────────────────────────────────────
  const selectAddress = (item: AddressOption) => {
    const next = normalizeAddress(
      item.label,
      { lat: item.lat || TASHKENT_CENTER.lat, lng: item.lng || TASHKENT_CENTER.lng },
      'suggestion',
    );
    setSelected(next);
    setSelectedMeta('suggestion');
    setResolutionState('resolved');
    setQuery('');
    setManualAddress('');
    setError('');
  };

  // ─── Use current GPS location ─────────────────────────────────────────────
  const useCurrentLocation = () => {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setSelectedMeta('current_location');
        setResolutionState('loading');
        setQuery('');
        setManualAddress('');
        setError('');
        setDetectingAddress(true);
        setSelected(normalizeAddress('', coords, 'current_location'));

        const requestId = ++geocodeRequestRef.current;
        reverseGeocode(coords.lat, coords.lng)
          .then((result) => {
            if (requestId !== geocodeRequestRef.current) return;
            if (!result || isPlaceholderAddress(result.fullAddress)) {
              setResolutionState('error');
              setError(geocoderFallbackMessage());
              return;
            }
            setSelected(normalizeAddress(result.fullAddress, coords, 'current_location'));
            setResolutionState('resolved');
            setError('');
          })
          .catch(() => {
            if (requestId === geocodeRequestRef.current) {
              setResolutionState('error');
              setError(geocoderFallbackMessage());
            }
          })
          .finally(() => {
            if (requestId === geocodeRequestRef.current) setDetectingAddress(false);
          });
      },
      () => {
        setDetectingAddress(false);
        setError('Could not access your location. Select an address manually.');
      },
      { enableHighAccuracy: true, timeout: 7000 },
    );
  };

  // ─── Map click handler ────────────────────────────────────────────────────
  // FIX: This is now the ONLY place that triggers geocoding from map interaction.
  // The previous approach of using onUpdate (fired on every pan frame) caused
  // constant geocode spam and race conditions.
  const handleMapSelect = useCallback((coords: { lat: number; lng: number }) => {
    // Cancel any previous in-flight debounce
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);

    // Immediately update coordinates and show resolving state
    setSelected((current) => ({ ...current, text: '', inZone: false, source: 'map', lat: coords.lat, lng: coords.lng }));
    setSelectedMeta('map');
    setResolutionState('loading');
    setQuery('');
    setManualAddress('');
    setError('');
    setDetectingAddress(true);

    // Debounce the actual geocode call to absorb rapid clicks
    const requestId = ++geocodeRequestRef.current;
    geocodeTimerRef.current = setTimeout(() => {
      reverseGeocode(coords.lat, coords.lng)
        .then((result) => {
          if (requestId !== geocodeRequestRef.current) return;
          if (!result || isPlaceholderAddress(result.fullAddress)) {
            setResolutionState('error');
            setError(geocoderFallbackMessage());
            return;
          }
          setSelected(normalizeAddress(result.fullAddress, coords, 'map'));
          setResolutionState('resolved');
          setError('');
        })
        .catch(() => {
          if (requestId === geocodeRequestRef.current) {
            setResolutionState('error');
            setError(geocoderFallbackMessage());
          }
        })
        .finally(() => {
          if (requestId === geocodeRequestRef.current) setDetectingAddress(false);
        });
    }, 250);
  }, []);

  // ─── Confirm / save ───────────────────────────────────────────────────────
  const confirm = async () => {
    if (detectingAddress || confirmingAddress) return;

    let next = selected;
    const typedQuery = query.trim();
    const manualTrimmed = manualAddress.trim();

    // If there's something in the search box, try to geocode it first
    if (typedQuery) {
      setConfirmingAddress(true);
      setError('');
      const results = await geocodeAddress(typedQuery)
        .catch(() => [])
        .finally(() => setConfirmingAddress(false));
      if (results[0]) {
        next = normalizeAddress(results[0].fullAddress, results[0], 'suggestion');
        setSelected(next);
        setSelectedMeta('suggestion');
        setResolutionState('resolved');
        setQuery('');
      } else {
        // Treat typed text as manual address with current map coords
        const manualText = normalizeManualAddress(typedQuery);
        next = normalizeAddress(
          manualText,
          { lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng },
          'manual',
        );
        setManualAddress(manualText);
        setSelected(next);
        setSelectedMeta('manual');
        setResolutionState('resolved');
        setQuery('');
      }
    } else if (manualTrimmed) {
      // User typed in the manual address field while geocoding failed
      const manualText = normalizeManualAddress(manualTrimmed);
      next = normalizeAddress(
        manualText,
        { lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng },
        'manual',
      );
      setSelected(next);
      setSelectedMeta('manual');
      setResolutionState('resolved');
    }

    // Final validation
    if (!isReadableAddress(next.text)) {
      setResolutionState('error');
      setError('Enter a readable delivery address before confirming.');
      return;
    }
    if (!next.inZone) {
      setError('Delivery is available inside Tashkent. Choose a Tashkent address.');
      return;
    }
    onConfirm({ ...next, confirmed: true });
  };

  // ─── Derived display values ───────────────────────────────────────────────
  const selectedSecondary = selectedMeta === 'current_location'
    ? 'Detected location in Tashkent'
    : selectedMeta === 'manual'
      ? 'Manually entered delivery address'
      : selectedMeta === 'map'
        ? 'Near selected point'
        : 'Tashkent delivery area';

  const selectedTitle = cleanAddressTitle(isReadableAddress(selected.text) ? selected.text : manualAddress);
  const showEmptySuggestions = query.trim().length > 0 && suggestions.length === 0 && !searchingAddress;

  // Confirm button is enabled when:
  // - not currently resolving
  // - AND ( have a resolved readable address OR have typed something )
  const hasConfirmableAddress = isReadableAddress(selected.text) || query.trim().length > 0 || manualAddress.trim().length > 0;
  const confirmDisabled = detectingAddress || confirmingAddress || !hasConfirmableAddress;

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 p-0 md:p-4">
      <div className="mx-auto flex h-full max-h-none max-w-6xl flex-col overflow-hidden bg-white shadow-2xl md:mt-6 md:h-[calc(100vh-48px)] md:rounded-[36px]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 md:px-6">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-orange-500">Tashkent</p>
            <h2 className="text-3xl font-black leading-tight text-gray-950 md:text-4xl">Delivery address</h2>
          </div>
          <button aria-label="Close address picker" onClick={onCancel} className="rounded-full bg-gray-100 p-3 text-gray-700 hover:bg-gray-200"><X size={20} /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[390px_1fr] md:overflow-hidden">
          {/* Left panel */}
          <aside className="flex min-h-0 flex-col border-r border-gray-100 bg-white p-4 md:p-5">
            {/* Search */}
            <div className="flex items-center gap-3 rounded-[24px] bg-gray-100 px-4 py-3.5 ring-1 ring-transparent focus-within:bg-white focus-within:ring-orange-200">
              <Search size={20} className="shrink-0 text-gray-500" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError('');
                }}
                placeholder="Search address"
                className="min-w-0 flex-1 bg-transparent font-bold outline-none"
              />
              {query && <button onClick={() => setQuery('')} className="rounded-full bg-white p-1 text-gray-500"><X size={16} /></button>}
            </div>

            {/* Error + manual input */}
            {error && (
              <div className="mt-3 rounded-2xl bg-amber-50 p-3 border border-amber-100">
                <p className="text-sm font-bold text-amber-800">{error}</p>
                {resolutionState === 'error' && (
                  <label className="mt-3 block">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-700">Enter address manually</span>
                    <input
                      value={manualAddress}
                      onChange={(event) => {
                        setManualAddress(event.target.value);
                        setError('');
                      }}
                      placeholder="Street, building, apartment"
                      className="mt-1.5 w-full rounded-xl bg-white px-3 py-3 font-bold text-gray-950 outline-none ring-1 ring-amber-200 focus:ring-2 focus:ring-orange-300"
                    />
                  </label>
                )}
              </div>
            )}

            {/* Current location */}
            <button onClick={useCurrentLocation} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[22px] bg-gray-950 px-4 py-3.5 font-black text-white shadow-sm hover:bg-gray-800">
              <LocateFixed size={18} /> Use current location
            </button>

            {/* Suggestions */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Popular addresses</p>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-600">
                  {searchingAddress ? 'Searching…' : suggestions.length}
                </span>
              </div>
              <div className="space-y-2 md:max-h-[240px] md:overflow-y-auto md:pr-1">
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

            {/* Selected address card */}
            <div className="mt-4 rounded-[26px] bg-gray-950 p-4 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                  <Navigation size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-orange-300">Selected address</p>
                  <p className="mt-1 line-clamp-2 font-black leading-snug">
                    {detectingAddress
                      ? 'Detecting address…'
                      : selectedTitle || (resolutionState === 'error' ? 'Tap to enter manually →' : 'Choose a point on the map')}
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-300">
                    {resolutionState === 'error' && !manualAddress.trim()
                      ? 'Use the manual input above'
                      : selectedSecondary}
                  </p>
                  <p className="mt-1 text-xs font-bold text-gray-600">
                    {(selected.lat || TASHKENT_CENTER.lat).toFixed(5)}, {(selected.lng || TASHKENT_CENTER.lng).toFixed(5)}
                  </p>
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <div className="sticky bottom-0 -mx-4 mt-4 bg-white px-4 pb-4 pt-2 md:static md:mx-0 md:mt-auto md:p-0 md:pt-4">
              <button
                onClick={confirm}
                disabled={confirmDisabled}
                className="w-full rounded-[22px] bg-yellow-300 px-4 py-4 font-black text-gray-950 shadow-sm hover:bg-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                {confirmingAddress ? 'Resolving address…' : detectingAddress ? 'Detecting…' : 'Confirm address'}
              </button>
            </div>
          </aside>

          {/* Map panel */}
          <section className="min-h-[360px] bg-gray-950 p-3 md:min-h-[420px] md:p-5">
            <YandexMap
              center={{ lat: selected.lat || TASHKENT_CENTER.lat, lng: selected.lng || TASHKENT_CENTER.lng }}
              points={[{
                id: 'selected-address',
                label: selectedTitle || 'Address',
                lat: selected.lat || TASHKENT_CENTER.lat,
                lng: selected.lng || TASHKENT_CENTER.lng,
                color: '#f97316',
              }]}
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
