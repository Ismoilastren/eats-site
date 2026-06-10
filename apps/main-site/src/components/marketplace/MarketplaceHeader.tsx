'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, LogOut, Mail, MapPin, PackageCheck, Phone, Search, ShoppingCart, UserRound, X } from 'lucide-react';
import { useMarketplace } from '@/context/MarketplaceContext';
import { AddressMapPicker } from './AddressMapPicker';

export function MarketplaceHeader() {
  const { address, setAddress, cartCount, user, login, logout, deliveryMode, setDeliveryMode, orders } = useMarketplace();
  const [addressOpen, setAddressOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '+998');
  const [email, setEmail] = useState(user?.email || '');
  const [otp, setOtp] = useState('');
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('phone');
  const [authStep, setAuthStep] = useState<'details' | 'otp'>('details');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (!authOpen) return;
    setName(user?.name || '');
    setPhone(user?.phone || '+998');
    setEmail(user?.email || '');
    setOtp('');
    setAuthMode('phone');
    setAuthStep('details');
    setAuthError('');
  }, [authOpen, user?.email, user?.name, user?.phone]);

  useEffect(() => {
    const openAuth = () => setAuthOpen(true);
    window.addEventListener('marketplace:open-auth', openAuth);
    return () => window.removeEventListener('marketplace:open-auth', openAuth);
  }, []);

  const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');
  const formatUzPhone = (value: string) => {
    const digits = normalizePhone(value).replace(/^\+?998/, '').replace(/\D/g, '').slice(0, 9);
    const a = digits.slice(0, 2);
    const b = digits.slice(2, 5);
    const c = digits.slice(5, 7);
    const d = digits.slice(7, 9);
    return `+998${a ? ` (${a}` : ' ('}${a.length === 2 ? ')' : ''}${b ? ` ${b}` : ''}${c ? `-${c}` : ''}${d ? `-${d}` : ''}`;
  };
  const phoneLooksValid = (value: string) => /^\+?998\d{9}$/.test(normalizePhone(value));
  const emailLooksValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
  const continueEmailAuth = () => {
    setAuthError('');
    if (!name.trim()) {
      setAuthError('Name is required.');
      return;
    }
    if (!emailLooksValid(email)) {
      setAuthError('Enter a valid email address.');
      return;
    }
    setAuthBusy(true);
    window.setTimeout(() => {
      login(name.trim(), '+998901111111', email.trim());
      setAuthBusy(false);
      setAuthOpen(false);
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
  const googleDemoLogin = () => {
    // Demo fallback for presentations when Firebase Google provider is not configured on the customer site.
    login('Google User', '+998901111111', 'demo.google@example.com');
    setAuthOpen(false);
  };

  const activeNotifications = useMemo(() => orders
    .filter((order) => order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'rejected')
    .slice(0, 5), [orders]);
  const notificationCount = activeNotifications.length;
  const displayAddress = address.text === 'Current location'
    ? 'Detected location, Tashkent'
    : address.text.replace(/^Tashkent,\s*/i, '') || 'Select address';

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/95 shadow-sm shadow-black/[0.02] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap lg:px-8">
          <Link href="/" className="shrink-0 text-xl font-black tracking-tight text-[#111827] md:text-2xl">
            <span className="text-[#facc15]">2(13)</span> Delivery
          </Link>

          <button onClick={() => setAddressOpen(true)} className="order-3 flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-left text-sm font-bold text-gray-800 hover:bg-gray-200 md:order-none md:max-w-[280px]">
            <MapPin size={18} className="shrink-0 text-gray-500" />
            <span className="truncate">{displayAddress}</span>
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

          <button aria-label="Open notifications" onClick={() => setNotificationsOpen((value) => !value)} className="relative hidden h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 sm:flex">
            <Bell size={20} />
            {notificationCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-300 px-1 text-xs font-black text-gray-950">{notificationCount}</span>}
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
        {notificationsOpen && (
          <div className="absolute right-4 top-[74px] z-[65] w-[min(360px,calc(100vw-32px))] rounded-[28px] bg-white p-4 shadow-2xl ring-1 ring-black/5 lg:right-8">
            <div className="flex items-center justify-between">
              <p className="text-lg font-black text-gray-950">Notifications</p>
              <button aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} className="rounded-full bg-gray-100 p-2"><X size={16} /></button>
            </div>
            {activeNotifications.length === 0 ? (
              <div className="mt-4 rounded-3xl bg-gray-50 p-6 text-center">
                <Bell className="mx-auto text-gray-300" size={34} />
                <p className="mt-3 font-black text-gray-950">No notifications yet</p>
                <p className="mt-1 text-sm font-bold text-gray-500">Your order updates will appear here.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {activeNotifications.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`} onClick={() => setNotificationsOpen(false)} className="flex gap-3 rounded-3xl bg-gray-50 p-4 hover:bg-yellow-50">
                    <PackageCheck className="mt-1 shrink-0 text-orange-500" size={20} />
                    <span>
                      <span className="block font-black text-gray-950">{order.status === 'accepted' ? 'Order accepted' : order.status === 'preparing' ? 'Preparing' : order.status === 'on_the_way' ? 'Courier on the way' : order.status === 'delivered' ? 'Delivered' : 'Order update'}</span>
                      <span className="mt-1 block text-sm font-bold text-gray-500">{order.restaurantName} · {order.id.slice(0, 8)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
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

      {authOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-[34px] bg-white shadow-2xl md:mt-16">
            <div className="bg-gray-950 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                  <p className="text-sm font-black uppercase tracking-widest text-yellow-300">2(13) Delivery</p>
                  <h2 className="mt-1 text-3xl font-black">{user ? 'Account' : authStep === 'otp' ? 'Enter verification code' : 'Sign in to 2(13) Delivery'}</h2>
                  {!user && <p className="mt-2 font-bold text-gray-300">{authStep === 'otp' ? 'Use demo code 1111 to finish sign in.' : 'Use your phone number or Google account to continue.'}</p>}
              </div>
                <button aria-label="Close login" onClick={() => setAuthOpen(false)} className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><X size={20} /></button>
              </div>
            </div>
            <div className="p-6">
            {user ? (
              <div className="mt-5 space-y-3">
                <p className="rounded-3xl bg-gray-50 p-4 font-bold">{user.name}<br /><span className="text-gray-500">{user.email || user.phone}</span></p>
                <Link onClick={() => setAuthOpen(false)} href="/profile" className="block rounded-2xl bg-gray-100 px-4 py-4 font-black text-gray-950">Profile</Link>
                <Link onClick={() => setAuthOpen(false)} href="/orders" className="block rounded-2xl bg-gray-100 px-4 py-4 font-black text-gray-950">Orders</Link>
                <button onClick={() => { logout(); setAuthOpen(false); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-4 font-black text-white"><LogOut size={18} /> Logout</button>
              </div>
            ) : (
              <div className="space-y-3">
                {authStep === 'details' ? (
                  <>
                    <button disabled={authBusy} onClick={googleDemoLogin} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 font-black text-gray-950 shadow-sm hover:bg-gray-50 disabled:opacity-60">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-950 text-sm font-black text-white">G</span>
                      Continue with Google
                    </button>
                    <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1 font-black text-gray-600">
                      <button onClick={() => { setAuthMode('phone'); setAuthError(''); }} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 ${authMode === 'phone' ? 'bg-white text-gray-950 shadow-sm' : ''}`}><Phone size={16} /> Phone</button>
                      <button onClick={() => { setAuthMode('email'); setAuthError(''); }} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 ${authMode === 'email' ? 'bg-white text-gray-950 shadow-sm' : ''}`}><Mail size={16} /> Email</button>
                    </div>
                    <label className="block">
                      <span className="text-sm font-black text-gray-500">Name</span>
                      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-yellow-300" />
                    </label>
                    {authMode === 'phone' ? (
                      <label className="block">
                        <span className="text-sm font-black text-gray-500">Phone number</span>
                        <input value={phone} onChange={(event) => setPhone(formatUzPhone(event.target.value))} placeholder="+998 (__) ___-__-__" inputMode="tel" className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-yellow-300" />
                      </label>
                    ) : (
                      <label className="block">
                        <span className="text-sm font-black text-gray-500">Email</span>
                        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" inputMode="email" className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none focus:ring-2 focus:ring-yellow-300" />
                      </label>
                    )}
                    {authError && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{authError}</p>}
                    <button disabled={authBusy} onClick={authMode === 'phone' ? continueAuth : continueEmailAuth} className="w-full rounded-2xl bg-yellow-300 px-4 py-4 font-black text-gray-950 disabled:opacity-60">{authBusy ? 'Please wait...' : authMode === 'phone' ? 'Continue' : 'Continue as demo user'}</button>
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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
              {['Pizza', 'Sushi', 'Burger', 'Lavash', 'Coffee'].map((item) => (
                <button key={item} onClick={() => { setQuery(item); commitSearch(item); }} className="rounded-full bg-yellow-100 px-4 py-2 font-bold text-gray-900 md:block">{item}</button>
              ))}
            </div>
            {recent.length > 0 && <h3 className="mt-8 font-black text-gray-950">Recent</h3>}
            {recent.map((item) => <button key={item} onClick={() => setQuery(item)} className="mt-2 block rounded-full bg-gray-100 px-4 py-2 font-bold">{item}</button>)}
          </aside>
          <main>
            {!debounced && <div className="rounded-[32px] bg-gray-50 p-10 text-center text-xl font-black text-gray-400">Search restaurants and dishes</div>}
            {debounced && results.restaurants.length === 0 && results.dishes.length === 0 && (
              <div className="rounded-[32px] bg-gray-50 p-10 text-center">
                <p className="text-xl font-black text-gray-950">No results found</p>
                <p className="mt-2 font-bold text-gray-500">Try pizza, sushi, burger, lavash, coffee</p>
              </div>
            )}
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
