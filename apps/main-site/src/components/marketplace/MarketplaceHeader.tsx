'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AtSign, Clock3, MapPin, Search, ShoppingBag, Store, Truck, UserRound, X } from 'lucide-react';
import { useMarketplace } from '@/context/MarketplaceContext';
import { AddressMapPicker } from './AddressMapPicker';
import {
  buildTimeSlots,
  formatDeliveryTimeLabel,
  restaurantCuisineLabel,
  type DeliveryDateKey,
} from '@/lib/marketplaceAvailability';

export function MarketplaceHeader() {
  const router = useRouter();
  const {
    address,
    setAddress,
    cartCount,
    user,
    deliveryMode,
    setDeliveryMode,
    deliveryTime,
    setDeliveryTime,
    restaurants,
    dataLoading,
  } = useMarketplace();
  const [addressOpen, setAddressOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeDay, setTimeDay] = useState<DeliveryDateKey>(deliveryTime.day);

  useEffect(() => {
    const openAuth = () => router.push('/auth/login');
    window.addEventListener('marketplace:open-auth', openAuth);
    return () => window.removeEventListener('marketplace:open-auth', openAuth);
  }, [router]);

  useEffect(() => {
    if (!searchActive) return undefined;
    const closeSearch = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-marketplace-search]')) setSearchActive(false);
    };
    document.addEventListener('mousedown', closeSearch);
    return () => document.removeEventListener('mousedown', closeSearch);
  }, [searchActive]);

  const dispatchSearch = (value: string) => {
    window.dispatchEvent(new CustomEvent('marketplace:search', { detail: value.trim() }));
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatchSearch(searchQuery);
    const first = searchResults[0];
    if (first) {
      router.push(first.href);
      setSearchActive(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchActive(false);
    dispatchSearch('');
  };

  const displayAddress = address.text === 'Current location'
    ? 'Detected location'
    : address.text.replace(/^Tashkent,\s*/i, '') || 'Select address';

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return restaurants.slice(0, 5).map((restaurant) => ({
      id: restaurant.id,
      title: restaurant.name,
      subtitle: `${restaurant.etaMin}-${restaurant.etaMax} min · ${restaurantCuisineLabel(restaurant)}`,
      href: `/restaurant/${restaurant.slug}`,
    }));
    const matches = restaurants.flatMap((restaurant) => {
      const restaurantMatch = [
        restaurant.name,
        restaurant.category,
        restaurant.cuisine.join(' '),
      ].join(' ').toLowerCase().includes(query);
      const dishMatches = restaurant.menu
        .filter((dish) => [dish.name, dish.description, dish.category].join(' ').toLowerCase().includes(query))
        .slice(0, 2)
        .map((dish) => ({
          id: `${restaurant.id}-${dish.id}`,
          title: dish.name,
          subtitle: `${restaurant.name} · ${dish.category}`,
          href: `/restaurant/${restaurant.slug}?dish=${encodeURIComponent(dish.id)}`,
        }));
      return [
        ...(restaurantMatch ? [{
          id: restaurant.id,
          title: restaurant.name,
          subtitle: `${restaurant.etaMin}-${restaurant.etaMax} min · ${restaurantCuisineLabel(restaurant)}`,
          href: `/restaurant/${restaurant.slug}`,
        }] : []),
        ...dishMatches,
      ];
    });
    return matches.slice(0, 6);
  }, [restaurants, searchQuery]);

  const chooseSearchResult = (href: string) => {
    router.push(href);
    setSearchActive(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#21201f]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Home"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2b2a29] text-[#fce000] transition-colors hover:bg-[#3a3937]"
            >
              <AtSign size={21} strokeWidth={2.5} />
            </Link>

            <div className="hidden h-11 items-center rounded-full bg-[#2b2a29] p-1 sm:flex">
              <button
                type="button"
                onClick={() => setDeliveryMode('delivery')}
                className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors ${
                  deliveryMode === 'delivery' ? 'bg-white text-black' : 'text-white hover:bg-white/5'
                }`}
              >
                <Truck size={15} /> Delivery
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode('pickup')}
                className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors ${
                  deliveryMode === 'pickup' ? 'bg-white text-black' : 'text-white hover:bg-white/5'
                }`}
              >
                <Store size={15} /> Pickup
              </button>
            </div>
          </div>

          <div data-marketplace-search className="relative order-3 min-w-0 flex-[1_1_100%] sm:order-none sm:flex-[1_1_320px] lg:max-w-xl">
            <form
              role="search"
              onSubmit={submitSearch}
              className="flex h-11 items-center gap-3 rounded-full bg-[#2b2a29] px-4 text-[#777570] transition-colors focus-within:bg-[#343331] focus-within:ring-1 focus-within:ring-white/10"
            >
              <Search size={20} className="shrink-0" />
              <input
                aria-label="Search restaurants and dishes"
                name="marketplace-search"
                autoComplete="off"
                value={searchQuery}
                onFocus={() => setSearchActive(true)}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  dispatchSearch(event.target.value);
                }}
                placeholder="Search in Eats"
                className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm font-semibold text-white outline-none ring-0 placeholder:text-[#777570] focus:border-0 focus:outline-none focus:ring-0"
              />
              {searchActive && searchQuery && (
                <button type="button" onClick={clearSearch} aria-label="Clear search" className="rounded-full p-1 text-[#aaa8a0] hover:bg-white/10">
                  <X size={16} />
                </button>
              )}
            </form>
            {searchActive && (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[70] overflow-hidden rounded-[22px] bg-[#2b2a29] p-2 shadow-[0_22px_65px_rgba(0,0,0,.42)] ring-1 ring-white/10">
                {dataLoading ? (
                  <div className="px-4 py-5 text-sm font-bold text-[#aaa8a0]">Loading restaurants and dishes…</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-5 text-sm font-bold text-[#aaa8a0]">Nothing found. Try pizza, burgers, sushi, or a restaurant name.</div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => chooseSearchResult(result.href)}
                      className="block w-full rounded-[16px] px-4 py-3 text-left hover:bg-[#3a3937]"
                    >
                      <span className="block font-black text-white">{result.title}</span>
                      <span className="mt-1 block text-sm font-bold text-[#aaa8a0]">{result.subtitle}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setAddressOpen(true)}
              aria-label="Select delivery address"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2b2a29] text-[#fce000] transition-colors hover:bg-[#3a3937] md:hidden"
            >
              <MapPin size={18} />
            </button>
            <button
              type="button"
              onClick={() => setAddressOpen(true)}
              className="hidden h-11 max-w-[190px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-white transition-colors hover:bg-[#2b2a29] md:flex"
            >
              <MapPin size={17} className="shrink-0 text-[#fce000]" />
              <span className="truncate">{displayAddress}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTimeDay(deliveryTime.day);
                setTimeOpen(true);
              }}
              className="hidden h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white hover:bg-[#2b2a29] lg:flex"
            >
              <Clock3 size={17} className="text-[#aaa8a0]" /> {formatDeliveryTimeLabel(deliveryTime)}
            </button>

            <Link
              href="/cart"
              className="flex h-11 items-center gap-2 rounded-full bg-[#fce000] px-4 text-sm font-black text-black transition-colors hover:bg-[#ffe530]"
            >
              <ShoppingBag size={17} />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && <span>· {cartCount}</span>}
            </Link>

            <Link
              href={user ? '/profile' : '/auth/login'}
              aria-label={user ? 'Profile' : 'Sign in'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2b2a29] text-white transition-colors hover:bg-[#3a3937]"
            >
              <UserRound size={18} />
            </Link>
          </div>

          <div className="order-4 flex h-11 w-full items-center rounded-full bg-[#2b2a29] p-1 sm:hidden">
            <button
              type="button"
              onClick={() => setDeliveryMode('delivery')}
              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold ${
                deliveryMode === 'delivery' ? 'bg-white text-black' : 'text-white'
              }`}
            >
              <Truck size={15} /> Delivery
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMode('pickup')}
              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold ${
                deliveryMode === 'pickup' ? 'bg-white text-black' : 'text-white'
              }`}
            >
              <Store size={15} /> Pickup
            </button>
          </div>
        </div>
      </header>

      {addressOpen && (
        <AddressMapPicker
          initialAddress={address}
          onCancel={() => setAddressOpen(false)}
          onConfirm={(nextAddress) => {
            setAddress(nextAddress);
            setAddressOpen(false);
          }}
        />
      )}
      {timeOpen && (
        <div className="fixed inset-0 z-[85] bg-black/55" role="dialog" aria-modal="true" aria-label="Delivery time">
          <button type="button" aria-label="Close delivery time" className="absolute inset-0" onClick={() => setTimeOpen(false)} />
          <div className="absolute left-1/2 top-[82px] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 rounded-[28px] bg-[#42413f] p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,.55)] ring-1 ring-white/10 lg:left-auto lg:right-[220px] lg:translate-x-0">
            <div className="flex items-center justify-between gap-3">
              <div className="grid flex-1 grid-cols-2 rounded-full bg-[#2b2a29] p-1">
                {(['today', 'tomorrow'] as DeliveryDateKey[]).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setTimeDay(day)}
                    className={`rounded-full px-4 py-3 text-sm font-black ${timeDay === day ? 'bg-white text-black' : 'text-[#ddd9cf]'}`}
                  >
                    {day === 'today' ? 'Today' : 'Tomorrow'}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Close" onClick={() => setTimeOpen(false)} className="rounded-full bg-[#53514d] p-2"><X size={18} /></button>
            </div>
            <div className="mt-4 max-h-[440px] space-y-1 overflow-y-auto pr-1">
              {timeDay === 'today' && (
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryTime({ mode: 'now', day: 'today', label: 'Now' });
                    setTimeOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[16px] px-4 py-4 text-left text-lg font-semibold ${deliveryTime.mode === 'now' ? 'bg-[#fce000] text-black' : 'hover:bg-[#33322f]'}`}
                >
                  <span>Now</span>
                  {deliveryTime.mode === 'now' && <span className="text-xl">✓</span>}
                </button>
              )}
              {buildTimeSlots({ day: timeDay }).map((slot) => {
                const selected = deliveryTime.mode === 'scheduled' && deliveryTime.day === timeDay && deliveryTime.time === slot;
                return (
                  <button
                    key={`${timeDay}-${slot}`}
                    type="button"
                    onClick={() => {
                      setDeliveryTime({ mode: 'scheduled', day: timeDay, time: slot, label: `${timeDay === 'tomorrow' ? 'Tomorrow' : 'Today'} ${slot}` });
                      setTimeOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-[16px] px-4 py-4 text-left text-lg font-semibold ${selected ? 'bg-[#fce000] text-black' : 'hover:bg-[#33322f]'}`}
                  >
                    <span>{slot}</span>
                    {selected && <span className="text-xl">✓</span>}
                  </button>
                );
              })}
              {timeDay === 'today' && buildTimeSlots({ day: 'today' }).length === 0 && (
                <p className="rounded-[16px] bg-[#33322f] px-4 py-4 text-sm font-bold text-[#ddd9cf]">
                  No more scheduled slots today. Choose Now or Tomorrow.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
