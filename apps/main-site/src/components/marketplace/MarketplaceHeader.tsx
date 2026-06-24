'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { AtSign, Clock3, MapPin, Search, ShoppingBag, Store, Truck, UserRound, X } from 'lucide-react';
import { useMarketplace } from '@/context/MarketplaceContext';
import { AddressMapPicker } from './AddressMapPicker';

export function MarketplaceHeader() {
  const router = useRouter();
  const { address, setAddress, cartCount, user, deliveryMode, setDeliveryMode } = useMarketplace();
  const [addressOpen, setAddressOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  useEffect(() => {
    const openAuth = () => router.push('/auth/login');
    window.addEventListener('marketplace:open-auth', openAuth);
    return () => window.removeEventListener('marketplace:open-auth', openAuth);
  }, [router]);

  const dispatchSearch = (value: string) => {
    window.dispatchEvent(new CustomEvent('marketplace:search', { detail: value.trim() }));
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatchSearch(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchActive(false);
    dispatchSearch('');
  };

  const displayAddress = address.text === 'Current location'
    ? 'Detected location'
    : address.text.replace(/^Tashkent,\s*/i, '') || 'Select address';

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

          <form
            role="search"
            onSubmit={submitSearch}
            className="order-3 flex h-11 min-w-0 flex-[1_1_100%] items-center gap-3 rounded-full bg-[#2b2a29] px-4 text-[#777570] focus-within:bg-[#353432] focus-within:ring-2 focus-within:ring-[#fce000] sm:order-none sm:flex-[1_1_320px] lg:max-w-xl"
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
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#777570]"
            />
            {searchActive && searchQuery && (
              <button type="button" onClick={clearSearch} aria-label="Clear search" className="rounded-full p-1 text-[#aaa8a0] hover:bg-white/10">
                <X size={16} />
              </button>
            )}
          </form>

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

            <div className="hidden h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white lg:flex">
              <Clock3 size={17} className="text-[#aaa8a0]" /> Now
            </div>

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
    </>
  );
}
