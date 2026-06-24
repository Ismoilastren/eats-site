'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock, Info, Minus, Plus, Search, Star, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Dish } from '@/data/marketplace';
import { CartDrawer } from '@/components/marketplace/CartDrawer';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { YandexMapPreview } from '@/components/marketplace/YandexMapPreview';
import { useMarketplace } from '@/context/MarketplaceContext';
import { haversineDistanceKm, TASHKENT_CENTER } from '@/lib/yandexMaps';
import { formatCurrencyUZS, isValidCoordinates } from '@repo/shared-types';

export default function RestaurantPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { addDish, cart, updateQuantity, restaurants, dataLoading, dataError, address } = useMarketplace();
  const restaurant = useMemo(() => restaurants.find((item) => item.slug === params.slug || item.id === params.slug), [params.slug, restaurants]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const menu = restaurant?.menu || [];
  const customerLocation = { lat: address.lat || TASHKENT_CENTER.lat, lng: address.lng || TASHKENT_CENTER.lng };
  const routeAvailable = Boolean(
    restaurant?.locationIsVerified
    && isValidCoordinates(customerLocation.lat, customerLocation.lng),
  );
  const routeDistanceKm = restaurant && routeAvailable
    ? haversineDistanceKm(restaurant.location, customerLocation)
    : null;
  const routeEtaMinutes = restaurant && routeDistanceKm !== null
    ? Math.max(restaurant.etaMin, Math.round(routeDistanceKm * 4 + 12))
    : null;
  const displayAddress = address.text === 'Current location'
    ? 'Detected location, Tashkent'
    : address.text.replace(/^Tashkent,\s*/i, '') || 'Delivery address';

  useEffect(() => {
    if (!restaurant) return;
    const dishId = searchParams.get('dish');
    const found = restaurant.menu.find((item) => item.id === dishId);
    if (found) setSelectedDish(found);
  }, [restaurant, searchParams]);

  const menuCategories = useMemo(() => ['All', ...Array.from(new Set(menu.map((item) => item.category)))], [menu]);
  const dishes = useMemo(() => {
    const normalized = menuSearch.trim().toLowerCase();
    return menu.filter((dish) => {
      const searchMatch = !normalized || dish.name.toLowerCase().includes(normalized) || dish.description.toLowerCase().includes(normalized);
      return searchMatch;
    });
  }, [menu, menuSearch]);
  const grouped = useMemo(() => {
    return dishes.reduce<Record<string, Dish[]>>((acc, dish) => {
      acc[dish.category] = [...(acc[dish.category] || []), dish];
      return acc;
    }, {});
  }, [dishes]);

  const scrollToCategory = (category: string) => {
    setSelectedCategory(category);
    const targetId = category === 'All' ? 'menu-start' : `menu-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[var(--page)]">
        <MarketplaceHeader />
        <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="h-[340px] animate-pulse rounded-[32px] bg-[var(--surface-muted)]" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[24px] bg-[var(--surface-muted)]" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[var(--page)] text-[var(--text)]">
        <MarketplaceHeader />
        <main className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-[24px] bg-[var(--surface)] p-12 text-center shadow-[var(--shadow)]">
            <h1 className="text-4xl font-black">Restaurant not found</h1>
            {dataError && <p className="mt-3 font-bold text-red-500">{dataError}</p>}
            <Link href="/" className="mt-6 inline-block rounded-[14px] bg-[var(--accent)] px-6 py-4 font-black text-[var(--accent-text)]">Back to home</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--text)]">
      <MarketplaceHeader />
      <main id="main-content" className="mx-auto max-w-[1480px] px-4 pb-36 pt-6 lg:px-8">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-3 font-black text-[var(--text)] shadow-sm hover:bg-[var(--surface-muted)]"><ArrowLeft size={18} /> Back</Link>
        <section className="relative overflow-hidden rounded-[30px] bg-[#111] text-white shadow-[var(--shadow)]">
          <div className="relative h-[380px] md:h-[460px]">
            <Image src={restaurant.imageUrl} alt={restaurant.name} fill priority sizes="100vw" className="object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <h1 className="max-w-4xl text-pretty text-5xl font-black md:text-7xl">{restaurant.name}</h1>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="rounded-full bg-white px-4 py-2 font-black text-[#111]"><Star className="inline" size={18} fill="currentColor" /> {restaurant.rating} · {restaurant.reviews} reviews</span>
              <span className="rounded-full bg-white/15 px-4 py-2 font-black">{restaurant.etaMin}-{restaurant.etaMax} min</span>
              <span className="rounded-full bg-white/15 px-4 py-2 font-black">{formatCurrencyUZS(restaurant.deliveryFee)} delivery</span>
              <span className="rounded-full bg-white/15 px-4 py-2 font-black"><Clock className="inline" size={18} /> {restaurant.workingHours}</span>
              <button onClick={() => setInfoOpen(true)} className="rounded-full bg-[var(--accent)] px-4 py-2 font-black text-[var(--accent-text)]"><Info className="inline" size={18} /> Info</button>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section id="menu-start" className="min-w-0 scroll-mt-44">
            <div className="sticky top-[144px] z-20 -mx-2 border-y border-[var(--line)] bg-[color:var(--page)]/95 px-2 py-4 backdrop-blur-xl md:top-[73px]">
              <div className="flex gap-2 overflow-x-auto">
                {menuCategories.map((category) => (
                  <button key={category} onClick={() => scrollToCategory(category)} className={`shrink-0 rounded-full px-5 py-3 font-black ${selectedCategory === category ? 'bg-[var(--text)] text-[var(--page)]' : 'bg-[var(--surface-strong)] text-[var(--text)] hover:bg-[var(--surface-muted)]'}`}>{category}</button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-full bg-[var(--surface-muted)] px-5 py-4 ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
                <Search size={20} className="text-[var(--muted)]" />
                <input aria-label="Search restaurant menu" name="menu-search" autoComplete="off" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Search inside menu…" className="w-full bg-transparent font-bold outline-none placeholder:text-[var(--muted)]" />
                {menuSearch && <button aria-label="Clear menu search" onClick={() => setMenuSearch('')}><X size={18} /></button>}
              </div>
            </div>
            {dishes.length === 0 ? (
              <div className="mt-5 rounded-[24px] bg-[var(--surface)] p-12 text-center shadow-[var(--shadow)]">
                <p className="text-2xl font-black">No dishes found</p>
                <p className="mt-2 font-bold text-[var(--muted)]">Try another menu search.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-10">
                {Object.entries(grouped).map(([category, items]) => (
                  <section id={`menu-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} key={category} className="scroll-mt-48">
                    <h2 className="mb-4 text-3xl font-black">{category}</h2>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {items.map((dish) => (
                        <DishCard
                          key={dish.id}
                          dish={dish}
                          inCartQuantity={cart.find((item) => item.id === dish.id)?.quantity || 0}
                          onOpen={() => setSelectedDish(dish)}
                          onAdd={() => addDish(restaurant, dish)}
                          onUpdate={(delta) => updateQuantity(dish.id, delta)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
          <div className="hidden lg:block"><div className="sticky top-24"><CartDrawer /></div></div>
        </div>
      </main>
      {cart.length > 0 && <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden"><CartDrawer compact /></div>}
      {infoOpen && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`${restaurant.name} information`}>
          <div className="mx-auto mt-24 max-w-lg rounded-[24px] bg-[var(--surface)] p-6 text-[var(--text)] shadow-2xl">
            <h2 className="text-3xl font-black">{restaurant.name}</h2>
            <p className="mt-3 font-bold text-[var(--muted)]">{restaurant.cuisine.join(' · ')}</p>
            <div className="mt-4 space-y-2 rounded-2xl bg-[var(--surface-muted)] p-4 font-semibold">
              <p>Schedule: {restaurant.workingHours}</p>
              <p>Min order: {formatCurrencyUZS(restaurant.minOrder)}</p>
              <p>Delivery: {restaurant.deliveryFee === 0 ? 'Free' : formatCurrencyUZS(restaurant.deliveryFee)}</p>
              <p>Delivery time: {restaurant.etaMin}-{restaurant.etaMax} minutes</p>
              <p>Rating: {restaurant.rating} from {restaurant.reviews} reviews</p>
              <p>Restaurant address: {restaurant.address || 'Tashkent'}</p>
              <p>Delivery address: {displayAddress}</p>
              <p>Distance: {routeDistanceKm === null ? 'Not calculated' : `${routeDistanceKm.toFixed(1)} km`}</p>
              <p>Estimated delivery time: {routeEtaMinutes === null ? 'Use the restaurant ETA shown above' : `${routeEtaMinutes} minutes`}</p>
            </div>
            <div className="mt-4">
              <YandexMapPreview center={restaurant.location} label={restaurant.address || restaurant.name} customer={{ ...customerLocation, label: 'Delivery address' }} />
            </div>
            <button onClick={() => setInfoOpen(false)} className="mt-5 w-full rounded-[14px] bg-[var(--accent)] px-4 py-4 font-black text-[var(--accent-text)]">Close</button>
          </div>
        </div>
      )}
      {selectedDish && (
        <div className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-black/55 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={selectedDish.name}>
          <div className="mx-auto min-h-dvh max-w-2xl overflow-hidden bg-[var(--surface)] text-[var(--text)] shadow-2xl sm:mt-8 sm:min-h-0 sm:rounded-[28px]">
            <div className="relative h-[42vh] min-h-72 max-h-[460px]">
              <Image src={selectedDish.imageUrl} alt={selectedDish.name} fill sizes="(max-width: 640px) 100vw, 672px" className="object-cover" />
              <button aria-label="Close product details" onClick={() => setSelectedDish(null)} className="absolute right-4 top-4 rounded-full bg-white p-3 text-[#111] shadow"><X size={20} /></button>
            </div>
            <div className="p-6 pb-28">
              <p className="text-sm font-black uppercase tracking-widest text-[var(--muted)]">{selectedDish.category}</p>
              <h2 className="mt-1 text-pretty text-4xl font-black">{selectedDish.name}</h2>
              <p className="mt-3 font-semibold text-[var(--muted)]">{selectedDish.description}</p>
              {!selectedDish.available && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600 dark:bg-red-950 dark:text-red-300">This dish is temporarily unavailable.</p>}
            </div>
            <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-[var(--line)] bg-[color:var(--surface)]/95 p-5 pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur-xl">
              <p className="text-2xl font-black tabular-nums">{formatCurrencyUZS(selectedDish.price)}</p>
              <button disabled={!selectedDish.available} onClick={() => { addDish(restaurant, selectedDish); setSelectedDish(null); }} className="rounded-[16px] bg-[var(--accent)] px-7 py-4 font-black text-[var(--accent-text)] disabled:bg-[var(--surface-strong)] disabled:text-[var(--muted)]">Add to cart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DishCard({
  dish,
  inCartQuantity,
  onOpen,
  onAdd,
  onUpdate,
}: {
  dish: Dish;
  inCartQuantity: number;
  onOpen: () => void;
  onAdd: () => void;
  onUpdate: (delta: number) => void;
}) {
  return (
    <article className={`group relative grid min-h-[190px] grid-cols-[minmax(0,1fr)_150px] overflow-hidden rounded-[24px] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow)] ring-1 ring-[var(--line)] transition-transform duration-200 hover:-translate-y-0.5 sm:grid-cols-[minmax(0,1fr)_180px] ${dish.available ? '' : 'opacity-65'}`}>
      <div className="flex min-w-0 flex-col p-5">
        <button onClick={onOpen} className="text-left text-xl font-black hover:opacity-65">{dish.name}</button>
        <p className="mt-2 line-clamp-3 text-sm font-semibold text-[var(--muted)]">{dish.description}</p>
        {dish.popular && <span className="mt-3 w-fit rounded-full bg-[#fff6a8] px-3 py-1 text-xs font-black text-[#5f5200] dark:bg-[#3d3512] dark:text-[var(--accent)]">Popular</span>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="text-lg font-black tabular-nums">{formatCurrencyUZS(dish.price)}</p>
          {inCartQuantity > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-[var(--surface-muted)] p-1">
              <button aria-label={`Decrease ${dish.name}`} onClick={() => onUpdate(-1)} className="rounded-full bg-[var(--surface)] p-2"><Minus size={15} /></button>
              <span className="min-w-7 text-center font-black tabular-nums">{inCartQuantity}</span>
              <button aria-label={`Increase ${dish.name}`} onClick={() => onUpdate(1)} className="rounded-full bg-[var(--accent)] p-2 text-[var(--accent-text)]"><Plus size={15} /></button>
            </div>
          ) : (
            <button aria-label={`Add ${dish.name} to cart`} disabled={!dish.available} onClick={onAdd} className="rounded-full bg-[var(--surface-muted)] p-3 text-[var(--text)] hover:bg-[var(--accent)] hover:text-[var(--accent-text)] disabled:text-[var(--muted)]"><Plus size={19} /></button>
          )}
        </div>
      </div>
      <button onClick={onOpen} className="relative block h-full min-h-[190px] w-full overflow-hidden text-left" aria-label={`Open ${dish.name} details`}>
        <Image src={dish.imageUrl} alt={dish.name} fill sizes="180px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
        {!dish.available && <span className="absolute bottom-3 left-3 rounded-full bg-[#111] px-3 py-1 text-xs font-black text-white">Unavailable</span>}
      </button>
    </article>
  );
}
