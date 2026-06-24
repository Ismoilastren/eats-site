'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { CategoryBar, PromoBanners, RestaurantGridSection, ShopsSection } from '@/components/marketplace/HomeSections';
import { categories as marketplaceCategories, promos as fallbackPromos, type Promo, type Restaurant } from '@/data/marketplace';
import { useMarketplace } from '@/context/MarketplaceContext';

const ALL_CATEGORY = 'All';

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/s$/, '');
}

function matchesCategory(restaurant: Restaurant, category: string) {
  if (category === ALL_CATEGORY) return true;
  const target = normalize(category);
  return [
    restaurant.category,
    ...restaurant.cuisine,
    ...restaurant.menu.map((dish) => dish.category),
  ].some((value) => normalize(value) === target);
}

function matchesSearch(restaurant: Restaurant, query: string) {
  const target = query.trim().toLowerCase();
  if (!target) return true;
  return [
    restaurant.name,
    restaurant.category,
    restaurant.cuisine.join(' '),
    restaurant.branchDisplayName || '',
    restaurant.address || '',
    ...restaurant.menu.flatMap((dish) => [dish.name, dish.description, dish.category]),
  ].join(' ').toLowerCase().includes(target);
}

function matchesPromo(restaurant: Restaurant, promo: Promo | null) {
  if (!promo) return true;
  if (promo.type === 'freeDelivery') return restaurant.deliveryFee === 0 || restaurant.isFreeDelivery;
  if (promo.type === 'percent') return Boolean(restaurant.hasDiscount || restaurant.promo === promo.code);
  return restaurant.category === 'Desserts' || restaurant.cuisine.includes('Desserts') || restaurant.menu.some((dish) => dish.category === 'Desserts');
}

export default function HomeClient() {
  const router = useRouter();
  const {
    address,
    deliveryMode,
    restaurants,
    marketplacePromos,
    dataLoading,
    dataError,
  } = useMarketplace();
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [activePromo, setActivePromo] = useState<Promo | null>(null);
  const [sortBy, setSortBy] = useState<'recommended' | 'rating' | 'fastest' | 'delivery'>('recommended');

  useEffect(() => {
    const onSearch = (event: Event) => setSearchQuery(((event as CustomEvent<string>).detail || '').trim());
    window.addEventListener('marketplace:search', onSearch);
    return () => window.removeEventListener('marketplace:search', onSearch);
  }, []);

  const available = useMemo(() => restaurants.filter((restaurant) => {
    const modeAvailable = deliveryMode === 'delivery' || restaurant.supportsPickup;
    const zoneAvailable = deliveryMode === 'pickup' || address.inZone;
    return modeAvailable && zoneAvailable;
  }), [address.inZone, deliveryMode, restaurants]);

  const visibleCategories = useMemo(() => {
    const source = marketplaceCategories.filter((category) => category !== 'Restaurants');
    return [ALL_CATEGORY, ...source.filter((category) => available.some((restaurant) => matchesCategory(restaurant, category)))];
  }, [available]);

  useEffect(() => {
    if (!visibleCategories.includes(selectedCategory)) setSelectedCategory(ALL_CATEGORY);
  }, [selectedCategory, visibleCategories]);

  const filtered = useMemo(() => {
    const result = available.filter((restaurant) => (
      matchesPromo(restaurant, activePromo)
      && matchesCategory(restaurant, selectedCategory)
      && matchesSearch(restaurant, searchQuery)
    ));

    return [...result].sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating || b.reviews - a.reviews;
      if (sortBy === 'fastest') return a.etaMin - b.etaMin || a.etaMax - b.etaMax;
      if (sortBy === 'delivery') return a.deliveryFee - b.deliveryFee || b.rating - a.rating;
      return Number(b.hasDiscount) - Number(a.hasDiscount) || b.rating - a.rating;
    });
  }, [activePromo, available, searchQuery, selectedCategory, sortBy]);

  const promos = marketplacePromos.length ? marketplacePromos : fallbackPromos;
  const shops = available.slice(0, 6);
  const popular = filtered.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#21201f] text-white">
      <MarketplaceHeader />
      <main id="main-content" className="mx-auto flex max-w-[1400px] flex-col gap-8 px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <PromoBanners
          promos={promos}
          restaurants={available}
          onSelect={(promo) => {
            setActivePromo(promo);
            setSelectedCategory(ALL_CATEGORY);
            requestAnimationFrame(() => document.getElementById('restaurant-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          }}
        />

        {!address.inZone && deliveryMode === 'delivery' && (
          <div className="rounded-2xl bg-red-950/70 px-5 py-4 font-bold text-red-200">
            Delivery is unavailable at this address. Select another address or use pickup.
          </div>
        )}

        {deliveryMode === 'pickup' && (
          <div className="rounded-2xl bg-[#2b2a29] px-5 py-4 ring-1 ring-white/10">
            <p className="font-black text-white">Pickup mode is on</p>
            <p className="mt-1 text-sm font-bold text-[#aaa8a0]">Showing restaurants where you can collect the order yourself. Delivery fee is removed at checkout.</p>
          </div>
        )}

        <ShopsSection
          restaurants={shops}
          onSelect={(restaurant) => router.push(`/restaurant/${restaurant.slug}`)}
          onShowAll={() => {
            setActivePromo(null);
            setSelectedCategory(ALL_CATEGORY);
            requestAnimationFrame(() => document.getElementById('restaurant-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          }}
        />

        <section>
          <h2 className="mb-4 text-xl font-black text-white sm:text-2xl">What to order</h2>
          <CategoryBar
            categories={visibleCategories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            onOpenSort={() => setSortOpen(true)}
          />
        </section>

        {dataError && (
          <div className="rounded-2xl bg-red-950/70 px-5 py-4 font-bold text-red-200">
            Live restaurant data could not be refreshed. Check the connection and reload the page.
          </div>
        )}

        {activePromo && (
          <div id="restaurant-results" className="rounded-[24px] bg-[#2b2a29] p-5 ring-1 ring-white/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#fce000]">Promotion</p>
                <h2 className="mt-1 text-2xl font-black">{activePromo.title}</h2>
                <p className="mt-1 font-bold text-[#aaa8a0]">{activePromo.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setActivePromo(null)} className="rounded-full bg-[#3a3937] px-5 py-3 font-black hover:bg-[#454440]">Show all</button>
                <Link href="/cart" className="rounded-full bg-[#fce000] px-5 py-3 font-black text-black hover:bg-[#ffe530]">Use at checkout</Link>
              </div>
            </div>
          </div>
        )}

        <RestaurantGridSection
          id={!activePromo ? 'restaurant-results' : undefined}
          title={searchQuery ? `Results for "${searchQuery}"` : selectedCategory === ALL_CATEGORY ? 'Popular near you' : selectedCategory}
          restaurants={popular}
          loading={dataLoading}
        />
      </main>

      {sortOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Sort restaurants">
          <button type="button" aria-label="Close sorting" className="absolute inset-0" onClick={() => setSortOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-[#2b2a29] p-5 text-white shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#fce000]">Sort</p>
                <h2 className="text-2xl font-black">Sort restaurants</h2>
              </div>
              <button type="button" onClick={() => setSortOpen(false)} className="rounded-full bg-[#3a3937] px-3 py-2 font-black hover:bg-[#454440]">Close</button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                ['recommended', 'Recommended', 'Best match with discounts and rating.'],
                ['rating', 'Highest rating', 'Places with the strongest customer rating first.'],
                ['fastest', 'Fastest delivery', 'Shortest estimated delivery time first.'],
                ['delivery', 'Lowest delivery fee', 'Free and lower delivery fee restaurants first.'],
              ].map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSortBy(value as typeof sortBy);
                    setSortOpen(false);
                  }}
                  className={`min-h-24 rounded-2xl px-4 py-3 text-left font-bold ${
                    sortBy === value ? 'bg-[#fce000] text-black' : 'bg-[#383735] text-white hover:bg-[#454440]'
                  }`}
                >
                  <span className="block font-black">{label}</span>
                  <span className={`mt-1 block text-sm ${sortBy === value ? 'text-black/60' : 'text-[#aaa8a0]'}`}>{description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
