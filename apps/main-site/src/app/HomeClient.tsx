'use client';

import { useMemo, useState } from 'react';
import { Filter, Gift, Search, SlidersHorizontal, Timer, Utensils } from 'lucide-react';
import { categories, deliveryTimeFilters, priceLevels, promos, restaurants, type PriceLevel } from '@/data/marketplace';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { RestaurantCard } from '@/components/marketplace/RestaurantCard';
import { useMarketplace } from '@/context/MarketplaceContext';

type SortMode = 'recommended' | 'fastest' | 'rating' | 'delivery';

export default function HomeClient() {
  const { favorites, address, deliveryMode } = useMarketplace();
  const [selectedCategory, setSelectedCategory] = useState('Restaurants');
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [discounts, setDiscounts] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState('any');
  const [priceLevel, setPriceLevel] = useState<PriceLevel | 'any'>('any');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let list = restaurants.filter((restaurant) => {
      const categoryMatch = selectedCategory === 'Restaurants' || restaurant.category === selectedCategory || restaurant.cuisine.includes(selectedCategory);
      const queryMatch = !normalized ||
        restaurant.name.toLowerCase().includes(normalized) ||
        restaurant.cuisine.join(' ').toLowerCase().includes(normalized) ||
        restaurant.menu.some((dish) => dish.name.toLowerCase().includes(normalized) || dish.category.toLowerCase().includes(normalized));
      const modeMatch = deliveryMode === 'delivery' || restaurant.supportsPickup;
      const zoneMatch = address.inZone || deliveryMode === 'pickup';
      return categoryMatch && queryMatch && modeMatch && zoneMatch;
    });

    if (freeDelivery) list = list.filter((item) => item.deliveryFee === 0);
    if (discounts) list = list.filter((item) => item.hasDiscount);
    if (openNow) list = list.filter((item) => item.isOpen);
    if (ratingOnly) list = list.filter((item) => item.rating >= 4.6);
    if (deliveryTime !== 'any') list = list.filter((item) => item.etaMax <= Number(deliveryTime));
    if (priceLevel !== 'any') list = list.filter((item) => item.priceLevel === priceLevel);

    return [...list].sort((a, b) => {
      if (sortMode === 'fastest') return a.etaMin - b.etaMin;
      if (sortMode === 'rating') return b.rating - a.rating;
      if (sortMode === 'delivery') return a.deliveryFee - b.deliveryFee;
      return Number(b.hasDiscount) - Number(a.hasDiscount) || b.rating - a.rating;
    });
  }, [address.inZone, deliveryMode, deliveryTime, discounts, freeDelivery, openNow, priceLevel, query, ratingOnly, selectedCategory, sortMode]);

  const recommended = filtered.filter((restaurant) => restaurant.rating >= 4.6).slice(0, 4);
  const fast = filtered.filter((restaurant) => restaurant.etaMin <= 26).slice(0, 4);
  const favoriteRestaurants = restaurants.filter((restaurant) => favorites.includes(restaurant.id));

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <MarketplaceHeader />

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-[40px] bg-gray-950 p-6 text-white md:p-10">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-gray-950">Tashkent marketplace</p>
              <h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">Food, groceries and coffee delivered fast.</h1>
              <p className="mt-4 text-lg font-semibold text-gray-300">Premium local marketplace for Tashkent. Address: {address.text}</p>
              {!address.inZone && <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 font-black text-red-200">This address is outside delivery zone.</p>}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {promos.map((promo) => (
                <div key={promo.code} className="rounded-3xl bg-white/10 px-5 py-4">
                  <p className="font-black text-yellow-200">{promo.title}</p>
                  <p className="text-sm font-semibold text-gray-300">{promo.code}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <Metric icon={<Timer size={22} />} label="Average ETA" value="24 min" />
            <Metric icon={<Utensils size={22} />} label="Restaurants" value="25+" />
            <Metric icon={<Gift size={22} />} label="Promo code" value="FIRST21" />
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
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 ring-1 ring-black/5">
              <Search size={21} className="text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search restaurants and dishes" className="w-full bg-transparent font-bold outline-none" />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              <FilterButton active={freeDelivery} onClick={() => setFreeDelivery((value) => !value)}>Free delivery</FilterButton>
              <FilterButton active={discounts} onClick={() => setDiscounts((value) => !value)}>Discounts</FilterButton>
              <FilterButton active={openNow} onClick={() => setOpenNow((value) => !value)}>Open now</FilterButton>
              <FilterButton active={ratingOnly} onClick={() => setRatingOnly((value) => !value)}>4.6+</FilterButton>
              <select value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} className="rounded-2xl border-0 bg-white px-4 py-3 font-black outline-none ring-1 ring-black/5">
                {deliveryTimeFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={priceLevel} onChange={(event) => setPriceLevel(event.target.value as PriceLevel | 'any')} className="rounded-2xl border-0 bg-white px-4 py-3 font-black outline-none ring-1 ring-black/5">
                {priceLevels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="rounded-2xl border-0 bg-white px-4 py-3 font-black outline-none ring-1 ring-black/5">
                <option value="recommended">Recommended</option>
                <option value="fastest">Fastest delivery</option>
                <option value="rating">Highest rating</option>
                <option value="delivery">Cheapest delivery</option>
              </select>
            </div>
          </div>
        </section>

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
      </main>
    </div>
  );
}

function RestaurantSection({ title, restaurants: sectionRestaurants }: { title: string; restaurants: typeof restaurants }) {
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
