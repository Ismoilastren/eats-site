'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { CategoryBar, PromoBanners, RestaurantGridSection, ShopsSection } from '@/components/marketplace/HomeSections';
import { categories as marketplaceCategories, promos as fallbackPromos, type Restaurant } from '@/data/marketplace';
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

export default function HomeClient() {
  const {
    address,
    deliveryMode,
    restaurants,
    marketplacePromos,
    dataLoading,
    dataError,
    applyPromo,
  } = useMarketplace();
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
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
      matchesCategory(restaurant, selectedCategory)
      && matchesSearch(restaurant, searchQuery)
    ));

    return [...result].sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating || b.reviews - a.reviews;
      if (sortBy === 'fastest') return a.etaMin - b.etaMin || a.etaMax - b.etaMax;
      if (sortBy === 'delivery') return a.deliveryFee - b.deliveryFee || b.rating - a.rating;
      return Number(b.hasDiscount) - Number(a.hasDiscount) || b.rating - a.rating;
    });
  }, [available, searchQuery, selectedCategory, sortBy]);

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
            const applied = applyPromo(promo.code);
            toast(applied ? `${promo.code} added to your cart` : `${promo.code} will be available at checkout`);
          }}
        />

        {!address.inZone && deliveryMode === 'delivery' && (
          <div className="rounded-2xl bg-red-950/70 px-5 py-4 font-bold text-red-200">
            Delivery is unavailable at this address. Select another address or use pickup.
          </div>
        )}

        <ShopsSection
          restaurants={shops}
          onSelect={(restaurant) => setSelectedCategory(restaurant.category)}
          onShowAll={() => setSelectedCategory(ALL_CATEGORY)}
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

        <RestaurantGridSection
          title={searchQuery ? `Results for "${searchQuery}"` : selectedCategory === ALL_CATEGORY ? 'Popular near you' : selectedCategory}
          restaurants={popular}
          loading={dataLoading}
        />
      </main>

      {sortOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Sort restaurants">
          <button type="button" aria-label="Close sorting" className="absolute inset-0" onClick={() => setSortOpen(false)} />
          <div className="relative w-full max-w-sm rounded-3xl bg-[#2b2a29] p-5 text-white shadow-2xl">
            <h2 className="text-2xl font-black">Sort restaurants</h2>
            <div className="mt-4 space-y-2">
              {[
                ['recommended', 'Recommended'],
                ['rating', 'Highest rating'],
                ['fastest', 'Fastest delivery'],
                ['delivery', 'Lowest delivery fee'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSortBy(value as typeof sortBy);
                    setSortOpen(false);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left font-bold ${
                    sortBy === value ? 'bg-[#fce000] text-black' : 'bg-[#383735] text-white hover:bg-[#454440]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
