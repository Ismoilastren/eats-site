'use client';

import { useMemo, useState } from 'react';
import { Filter, Gift, SlidersHorizontal, Timer, Utensils } from 'lucide-react';
import { categories, type Restaurant } from '@/data/marketplace';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { RestaurantCard } from '@/components/marketplace/RestaurantCard';
import { useMarketplace } from '@/context/MarketplaceContext';

export default function HomeClient() {
  const { favorites, address, deliveryMode, restaurants, marketplacePromos, dataLoading, dataError } = useMarketplace();
  const [selectedCategory, setSelectedCategory] = useState('Restaurants');
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [discounts, setDiscounts] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);

  const filtered = useMemo(() => {
    const normalizeFilter = (value: string) => value.toLowerCase().replace(/s$/, '');
    const selectedCategoryKey = normalizeFilter(selectedCategory);
    let list = restaurants.filter((restaurant) => {
      const restaurantCategories = [
        restaurant.category,
        ...restaurant.cuisine,
        ...restaurant.menu.map((dish) => dish.category),
      ].map(normalizeFilter);
      const categoryMatch = selectedCategory === 'Restaurants' || restaurantCategories.includes(selectedCategoryKey);
      const modeMatch = deliveryMode === 'delivery' || restaurant.supportsPickup;
      const zoneMatch = address.inZone || deliveryMode === 'pickup';
      return categoryMatch && modeMatch && zoneMatch;
    });

    if (freeDelivery) list = list.filter((item) => item.deliveryFee === 0);
    if (discounts) list = list.filter((item) => item.hasDiscount);
    if (openNow) list = list.filter((item) => item.isOpen);
    if (ratingOnly) list = list.filter((item) => item.rating >= 4.6);
    return [...list].sort((a, b) => Number(b.hasDiscount) - Number(a.hasDiscount) || b.rating - a.rating);
  }, [address.inZone, deliveryMode, discounts, freeDelivery, openNow, ratingOnly, restaurants, selectedCategory]);

  const recommended = filtered.filter((restaurant) => restaurant.rating >= 4.6).slice(0, 4);
  const fast = filtered.filter((restaurant) => restaurant.etaMin <= 26).slice(0, 4);
  const favoriteRestaurants = restaurants.filter((restaurant) => favorites.includes(restaurant.id));
  const averageEta = restaurants.length > 0
    ? Math.round(restaurants.reduce((sum, restaurant) => sum + restaurant.etaMax, 0) / restaurants.length)
    : 0;
  const deliveryTimeLabel = averageEta ? `From ${Math.max(20, averageEta - 10)} min` : 'Fast delivery';
  const displayAddress = address.text === 'Current location'
    ? 'Detected location, Tashkent'
    : address.text.replace(/^Tashkent,\s*/i, '');
  const fallbackPromos = [
    { code: 'FIRST21', title: '21% off first order' },
    { code: 'FREEDEL', title: 'Free delivery deals' },
    { code: 'GIFT', title: 'Gift dessert' },
  ];

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <MarketplaceHeader />

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-[40px] bg-gray-950 p-6 text-white md:p-10">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-gray-950">Tashkent food delivery</p>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">Food delivery in Tashkent</h1>
              <p className="mt-4 max-w-xl text-lg font-semibold text-gray-300">Order meals, groceries, coffee, and desserts from local restaurants. Track your order from checkout to delivery.</p>
              <p className="mt-3 text-sm font-bold text-gray-400">Delivering to: {displayAddress || 'Select address'}</p>
              {!address.inZone && <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 font-black text-red-200">This address is outside delivery zone.</p>}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {(marketplacePromos.length > 0 ? marketplacePromos : fallbackPromos).map((promo) => (
                <div key={promo.code} className="rounded-3xl bg-white/10 px-5 py-4">
                  <p className="font-black text-yellow-200">{promo.title}</p>
                  <p className="text-sm font-semibold text-gray-300">{promo.code}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <Metric icon={<Timer size={22} />} label="Delivery time" value={deliveryTimeLabel} />
            <Metric icon={<Utensils size={22} />} label="Restaurants" value={String(restaurants.length)} />
            <Metric icon={<Gift size={22} />} label="Promo code" value={marketplacePromos[0]?.code || 'FIRST21'} />
          </div>
        </section>

        <section className="sticky top-[73px] z-30 -mx-4 mt-6 border-y border-black/5 bg-[#f6f6f3]/95 px-4 py-4 backdrop-blur lg:-mx-8 lg:px-8">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button key={category} onClick={() => setSelectedCategory(category)} className={`shrink-0 rounded-full px-5 py-3 font-black transition ${selectedCategory === category ? 'bg-gray-950 text-white' : 'bg-white text-gray-700 hover:bg-yellow-100'}`}>
                {category}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <FilterButton active={freeDelivery} onClick={() => setFreeDelivery((value) => !value)}>Free delivery</FilterButton>
            <FilterButton active={discounts} onClick={() => setDiscounts((value) => !value)}>Discounts</FilterButton>
            <FilterButton active={openNow} onClick={() => setOpenNow((value) => !value)}>Open now</FilterButton>
            <FilterButton active={ratingOnly} onClick={() => setRatingOnly((value) => !value)}>4.6+</FilterButton>
          </div>
        </section>

        {dataError && <div className="mt-6 rounded-[28px] bg-red-50 px-5 py-4 font-black text-red-600">Could not load live marketplace data. Refresh the page or check Firebase settings.</div>}
        {dataLoading ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-[36px] bg-white" />)}
          </div>
        ) : (
          <>
            {favoriteRestaurants.length > 0 && <RestaurantSection title="Favorites" restaurants={favoriteRestaurants} />}
            <RestaurantSection title="Promotions" restaurants={filtered.filter((restaurant) => restaurant.hasDiscount).slice(0, 4)} />
            <RestaurantSection title="Recommended" restaurants={recommended} />
            <RestaurantSection title="Fast delivery" restaurants={fast} />

            <section className="mt-10">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-4xl font-black">Restaurants near you</h2>
                <SlidersHorizontal className="text-gray-400" />
              </div>
              {filtered.length === 0 ? (
                <div className="rounded-[40px] bg-white p-12 text-center">
                  <Filter className="mx-auto text-gray-300" size={56} />
                  <p className="mt-4 text-2xl font-black">No restaurants found</p>
                  <p className="mt-2 font-bold text-gray-500">Change search or filters.</p>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RestaurantSection({ title, restaurants: sectionRestaurants }: { title: string; restaurants: Restaurant[] }) {
  if (sectionRestaurants.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-5 text-3xl font-black">{title}</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {sectionRestaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}
      </div>
    </section>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`shrink-0 rounded-2xl px-4 py-3 font-black ${active ? 'bg-yellow-300 text-gray-950' : 'bg-white text-gray-700'}`}>{children}</button>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">{icon}</div>
      <p className="mt-5 text-sm font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}
