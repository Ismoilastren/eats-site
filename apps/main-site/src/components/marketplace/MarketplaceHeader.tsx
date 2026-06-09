'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, LocateFixed, MapPin, Search, ShoppingCart, UserRound, X } from 'lucide-react';
import { addressSuggestions } from '@/data/marketplace';
import { useMarketplace } from '@/context/MarketplaceContext';

export function MarketplaceHeader() {
  const { address, setAddress, cartCount, user, login, logout, deliveryMode, setDeliveryMode } = useMarketplace();
  const [addressOpen, setAddressOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '+998');
  const [otp, setOtp] = useState('');
  const [authStep, setAuthStep] = useState<'details' | 'otp'>('details');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [addressInput, setAddressInput] = useState(address.text);

  useEffect(() => setAddressInput(address.text), [address.text]);
  useEffect(() => {
    if (!authOpen) return;
    setName(user?.name || '');
    setPhone(user?.phone || '+998');
    setOtp('');
    setAuthStep('details');
    setAuthError('');
  }, [authOpen, user?.name, user?.phone]);

  const saveAddress = (text: string) => {
    const inZone = text.toLowerCase().includes('tashkent') || text.toLowerCase().includes('toshkent');
    setAddress({ text, inZone });
    setAddressOpen(false);
  };

  const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');
  const phoneLooksValid = (value: string) => /^\+?998\d{9}$/.test(normalizePhone(value));
  const continueAuth = () => {
    setAuthError('');
    if (!name.trim()) {
      setAuthError('Name is required.');
      return;
    }
    if (!phone.trim()) {
      setAuthError('Phone number is required.');
      return;
    }
    if (!phoneLooksValid(phone)) {
      setAuthError('Enter a valid Uzbekistan phone number, for example +998 90 123 45 67.');
      return;
    }
    setAuthBusy(true);
    window.setTimeout(() => {
      setAuthBusy(false);
      setAuthStep('otp');
    }, 250);
  };
  const verifyAuth = () => {
    setAuthError('');
    if (otp.trim() !== '1111') {
      setAuthError('Incorrect verification code. Demo code is 1111.');
      return;
    }
    setAuthBusy(true);
    window.setTimeout(() => {
      login(name.trim(), normalizePhone(phone));
      setAuthBusy(false);
      setAuthOpen(false);
    }, 250);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/95 shadow-sm shadow-black/[0.02] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap lg:px-8">
          <Link href="/" className="shrink-0 text-xl font-black tracking-tight text-[#111827] md:text-2xl">
            <span className="text-[#facc15]">2(13)</span> Delivery
          </Link>

          <button onClick={() => setAddressOpen(true)} className="order-3 flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-left text-sm font-bold text-gray-800 hover:bg-gray-200 md:order-none md:max-w-[280px]">
            <MapPin size={18} className="shrink-0 text-gray-500" />
            <span className="truncate">{address.text || 'Select address'}</span>
            <ChevronDown size={16} />
          </button>

          <div className="hidden rounded-2xl bg-gray-100 p-1 text-sm font-black text-gray-950 sm:flex">
            <button onClick={() => setDeliveryMode('delivery')} className={`rounded-xl px-3 py-2 ${deliveryMode === 'delivery' ? 'bg-yellow-300 shadow-sm' : 'text-gray-500'}`}>Delivery</button>
            <button onClick={() => setDeliveryMode('pickup')} className={`rounded-xl px-3 py-2 ${deliveryMode === 'pickup' ? 'bg-yellow-300 shadow-sm' : 'text-gray-500'}`}>Pickup</button>
          </div>

          <button onClick={() => setSearchOpen(true)} className="order-2 flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl bg-gray-100 px-4 py-3 text-left text-gray-500 hover:bg-gray-200 lg:order-none">
            <Search size={20} />
            <span className="truncate font-semibold">Search restaurants or dishes</span>
          </button>

          <button onClick={() => setSearchOpen(true)} className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 sm:flex">
            <Bell size={20} />
          </button>

          <Link href="/cart" className="relative order-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-950 text-white hover:bg-gray-800 lg:order-none">
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-300 px-1 text-xs font-black text-gray-950">{cartCount}</span>}
          </Link>

          <button onClick={() => setAuthOpen(true)} className="hidden h-12 items-center gap-2 rounded-2xl bg-gray-100 px-4 font-black text-gray-800 hover:bg-gray-200 sm:flex">
            <UserRound size={18} />
            {user ? user.name.split(' ')[0] : 'Login'}
          </button>
        </div>
      </header>

      {addressOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 p-4">
          <div className="mx-auto mt-4 max-h-[92vh] max-w-xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl md:mt-16">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-yellow-500">Tashkent</p>
                <h2 className="text-3xl font-black text-gray-950">Delivery address</h2>
              </div>
              <button onClick={() => setAddressOpen(false)} className="rounded-full bg-gray-100 p-3"><X size={20} /></button>
            </div>
            <label className="mt-5 block text-sm font-black text-gray-500">Address</label>
            <input value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="Tashkent, street and building" className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 font-bold outline-none focus:border-yellow-400" />
            {addressInput && !(addressInput.toLowerCase().includes('tashkent') || addressInput.toLowerCase().includes('toshkent')) && (
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">Outside delivery zone. Choose an address inside Tashkent.</p>
            )}
            <button onClick={() => saveAddress('Tashkent, current location')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-4 font-black text-white">
              <LocateFixed size={18} /> Use current location
            </button>
            <div className="mt-4 space-y-2">
              {addressSuggestions.map((item) => (
                <button key={item} onClick={() => saveAddress(item)} className="block w-full rounded-2xl bg-gray-50 px-4 py-3 text-left font-bold text-gray-700 hover:bg-yellow-50">{item}</button>
              ))}
            </div>
            <button onClick={() => saveAddress(addressInput)} className="mt-5 w-full rounded-2xl bg-yellow-300 px-4 py-4 font-black text-gray-950">Save address</button>
          </div>
        </div>
      )}

      {authOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 p-4">
          <div className="mx-auto mt-20 max-w-md rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-gray-950">{user ? 'Profile' : authStep === 'otp' ? 'Enter verification code' : 'Sign in'}</h2>
                {!user && <p className="mt-1 font-bold text-gray-500">{authStep === 'otp' ? 'Demo code: 1111' : 'Enter your name and phone number to continue.'}</p>}
              </div>
              <button onClick={() => setAuthOpen(false)} className="rounded-full bg-gray-100 p-3"><X size={20} /></button>
            </div>
            {user ? (
              <div className="mt-5 space-y-3">
                <p className="rounded-2xl bg-gray-50 p-4 font-bold">{user.name}<br /><span className="text-gray-500">{user.phone}</span></p>
                <Link onClick={() => setAuthOpen(false)} href="/profile" className="block rounded-2xl bg-gray-100 px-4 py-4 font-black text-gray-950">Profile</Link>
                <Link onClick={() => setAuthOpen(false)} href="/orders" className="block rounded-2xl bg-gray-100 px-4 py-4 font-black text-gray-950">Orders</Link>
                <button onClick={() => { logout(); setAuthOpen(false); }} className="w-full rounded-2xl bg-gray-950 px-4 py-4 font-black text-white">Logout</button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {authStep === 'details' ? (
                  <>
                    <label className="block">
                      <span className="text-sm font-black text-gray-500">Name</span>
                      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-yellow-300" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-black text-gray-500">Phone number</span>
                      <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+998 90 123 45 67" className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-yellow-300" />
                    </label>
                    {authError && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{authError}</p>}
                    <button disabled={authBusy} onClick={continueAuth} className="w-full rounded-2xl bg-yellow-300 px-4 py-4 font-black text-gray-950 disabled:opacity-60">{authBusy ? 'Checking...' : 'Continue'}</button>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-sm font-black text-gray-500">Verification code</span>
                      <input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="1111" inputMode="numeric" maxLength={4} className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 text-center text-2xl font-black tracking-[0.4em] outline-none focus:ring-2 focus:ring-yellow-300" />
                    </label>
                    {authError && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{authError}</p>}
                    <button disabled={authBusy} onClick={verifyAuth} className="w-full rounded-2xl bg-yellow-300 px-4 py-4 font-black text-gray-950 disabled:opacity-60">{authBusy ? 'Signing in...' : 'Verify and sign in'}</button>
                    <button onClick={() => { setAuthStep('details'); setAuthError(''); }} className="w-full rounded-2xl bg-gray-100 px-4 py-4 font-black text-gray-700">Change phone number</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { restaurants } = useMarketplace();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem('recent_searches') || '[]') as string[]);
    } catch {
      setRecent([]);
    }
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 180);
    return () => window.clearTimeout(id);
  }, [query]);

  const results = useMemo(() => {
    const normalized = debounced.trim().toLowerCase();
    if (!normalized) return { restaurants: [], dishes: [] };
    const restaurantResults = restaurants.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(normalized) ||
      restaurant.cuisine.join(' ').toLowerCase().includes(normalized)
    );
    const dishResults = restaurants.flatMap((restaurant) =>
      restaurant.menu
        .filter((dish) => dish.name.toLowerCase().includes(normalized) || dish.description.toLowerCase().includes(normalized))
        .map((dish) => ({ dish, restaurant }))
    );
    return { restaurants: restaurantResults, dishes: dishResults };
  }, [debounced]);

  const commitSearch = (value: string) => {
    if (!value.trim()) return;
    const next = [value.trim(), ...recent.filter((item) => item !== value.trim())].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem('recent_searches', JSON.stringify(next));
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-white">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-3 rounded-3xl bg-gray-100 px-5 py-4">
            <Search size={22} className="text-gray-500" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitSearch(query); }} placeholder="Pizza, Sushi, Burger, Plov..." className="w-full bg-transparent text-xl font-bold outline-none" />
            {query && <button onClick={() => setQuery('')}><X size={20} /></button>}
          </div>
          <button onClick={onClose} className="rounded-2xl bg-gray-950 px-4 py-4 font-black text-white md:px-5">Close</button>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-[260px_1fr]">
          <aside>
            <h3 className="font-black text-gray-950">Popular</h3>
            <div className="mt-3 flex flex-wrap gap-2 md:block md:space-y-2">
              {['Pizza', 'Sushi', 'Burger', 'Plov', 'Lavash', 'Coffee'].map((item) => (
                <button key={item} onClick={() => { setQuery(item); commitSearch(item); }} className="rounded-full bg-yellow-100 px-4 py-2 font-bold text-gray-900 md:block">{item}</button>
              ))}
            </div>
            {recent.length > 0 && <h3 className="mt-8 font-black text-gray-950">Recent</h3>}
            {recent.map((item) => <button key={item} onClick={() => setQuery(item)} className="mt-2 block rounded-full bg-gray-100 px-4 py-2 font-bold">{item}</button>)}
          </aside>
          <main>
            {!debounced && <div className="rounded-[32px] bg-gray-50 p-10 text-center text-xl font-black text-gray-400">Search restaurants and dishes</div>}
            {debounced && results.restaurants.length === 0 && results.dishes.length === 0 && <div className="rounded-[32px] bg-gray-50 p-10 text-center text-xl font-black text-gray-400">Nothing found</div>}
            {results.restaurants.length > 0 && <h3 className="mb-3 text-2xl font-black">Restaurants</h3>}
            <div className="grid gap-4 md:grid-cols-2">
              {results.restaurants.map((restaurant) => (
                <Link key={restaurant.id} href={`/restaurant/${restaurant.slug}`} onClick={() => commitSearch(query)} className="rounded-[28px] border border-gray-100 p-4 hover:bg-yellow-50">
                  <p className="text-xl font-black">{restaurant.name}</p>
                  <p className="mt-1 font-bold text-gray-500">{restaurant.cuisine.join(' · ')}</p>
                  <p className="mt-2 text-sm font-black text-yellow-600">Restaurant match</p>
                </Link>
              ))}
            </div>
            {results.dishes.length > 0 && <h3 className="mb-3 mt-8 text-2xl font-black">Dishes</h3>}
            <div className="grid gap-4 md:grid-cols-2">
              {results.dishes.slice(0, 12).map(({ dish, restaurant }) => (
                <Link key={dish.id} href={`/restaurant/${restaurant.slug}?dish=${dish.id}`} onClick={() => commitSearch(query)} className="rounded-[28px] border border-gray-100 p-4 hover:bg-yellow-50">
                  <p className="text-xl font-black">{dish.name}</p>
                  <p className="mt-1 font-bold text-gray-500">{restaurant.name}</p>
                  <p className="mt-2 text-sm font-black text-yellow-600">{dish.category}</p>
                </Link>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
