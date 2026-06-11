'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, MapPin, PackageCheck, Search, ShoppingCart, Store, Truck, UserRound, X } from 'lucide-react';
import { useMarketplace } from '@/context/MarketplaceContext';
import { AddressMapPicker } from './AddressMapPicker';

export function MarketplaceHeader() {
  const router = useRouter();
  const { address, setAddress, cartCount, user, deliveryMode, setDeliveryMode, orders } = useMarketplace();
  const [addressOpen, setAddressOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const openAuth = () => router.push('/auth/login');
    window.addEventListener('marketplace:open-auth', openAuth);
    return () => window.removeEventListener('marketplace:open-auth', openAuth);
  }, [router]);

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

          <div className="order-4 flex shrink-0 rounded-2xl bg-gray-100 p-1 text-sm font-black text-gray-950 sm:order-none">
            <button
              onClick={() => setDeliveryMode('delivery')}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 transition ${deliveryMode === 'delivery' ? 'bg-yellow-300 text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Truck size={15} /> Delivery
            </button>
            <button
              onClick={() => setDeliveryMode('pickup')}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 transition ${deliveryMode === 'pickup' ? 'bg-yellow-300 text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Store size={15} /> Pickup
            </button>
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

          <Link href={user ? '/profile' : '/auth/login'} className="hidden h-12 items-center gap-2 rounded-2xl bg-gray-100 px-4 font-black text-gray-800 hover:bg-gray-200 sm:flex">
            <UserRound size={18} />
            {user ? user.name.split(' ')[0] : 'Login'}
          </Link>
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
