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
import { formatCurrencyUZS } from '@repo/shared-types';

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
  const routeDistanceKm = restaurant ? haversineDistanceKm(restaurant.location, customerLocation) : 0;
  const routeEtaMinutes = restaurant ? Math.max(restaurant.etaMin, Math.round(routeDistanceKm * 4 + 12)) : 0;

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
      const categoryMatch = selectedCategory === 'All' || dish.category === selectedCategory;
      const searchMatch = !normalized || dish.name.toLowerCase().includes(normalized) || dish.description.toLowerCase().includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [menu, menuSearch, selectedCategory]);
  const grouped = useMemo(() => {
    return dishes.reduce<Record<string, Dish[]>>((acc, dish) => {
      acc[dish.category] = [...(acc[dish.category] || []), dish];
      return acc;
    }, {});
  }, [dishes]);

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#f6f6f3]">
        <MarketplaceHeader />
        <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="h-[340px] animate-pulse rounded-[44px] bg-white" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[32px] bg-white" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#f6f6f3]">
        <MarketplaceHeader />
        <main className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-[40px] bg-white p-12 text-center">
            <h1 className="text-4xl font-black">Restaurant not found</h1>
            {dataError && <p className="mt-3 font-bold text-red-500">{dataError}</p>}
            <Link href="/" className="mt-6 inline-block rounded-2xl bg-yellow-300 px-6 py-4 font-black">Back to home</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <MarketplaceHeader />
      <main className="mx-auto max-w-7xl px-4 pb-32 pt-6 lg:px-8">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 font-black shadow-sm"><ArrowLeft size={18} /> Back</Link>
        <section className="relative overflow-hidden rounded-[44px] bg-gray-950 text-white">
          <div className="relative h-[340px]">
            <Image src={restaurant.imageUrl} alt={restaurant.name} fill priority sizes="100vw" className="object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/30 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <h1 className="text-5xl font-black md:text-7xl">{restaurant.name}</h1>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="rounded-full bg-white px-4 py-2 font-black text-gray-950"><Star className="inline" size={18} fill="currentColor" /> {restaurant.rating} · {restaurant.reviews} reviews</span>
              <span className="rounded-full bg-white/15 px-4 py-2 font-black">{restaurant.etaMin}-{restaurant.etaMax} min</span>
              <span className="rounded-full bg-white/15 px-4 py-2 font-black">{formatCurrencyUZS(restaurant.deliveryFee)} delivery</span>
              <span className="rounded-full bg-white/15 px-4 py-2 font-black"><Clock className="inline" size={18} /> {restaurant.workingHours}</span>
              <button onClick={() => setInfoOpen(true)} className="rounded-full bg-yellow-300 px-4 py-2 font-black text-gray-950"><Info className="inline" size={18} /> Info</button>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="min-w-0">
            <div className="sticky top-[97px] z-20 border-y border-black/5 bg-[#f6f6f3]/95 py-4 backdrop-blur md:top-[73px]">
              <div className="flex gap-2 overflow-x-auto">
                {menuCategories.map((category) => (
                  <button key={category} onClick={() => setSelectedCategory(category)} className={`shrink-0 rounded-full px-5 py-3 font-black ${selectedCategory === category ? 'bg-gray-950 text-white' : 'bg-white text-gray-700'}`}>{category}</button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-3xl bg-white px-5 py-4 ring-1 ring-black/5">
                <Search size={20} className="text-gray-400" />
                <input value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Search inside menu" className="w-full bg-transparent font-bold outline-none" />
                {menuSearch && <button onClick={() => setMenuSearch('')}><X size={18} /></button>}
              </div>
            </div>
            {dishes.length === 0 ? (
              <div className="mt-5 rounded-[36px] bg-white p-12 text-center">
                <p className="text-2xl font-black">No dishes found</p>
                <p className="mt-2 font-bold text-gray-500">Try another menu search.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-10">
                {Object.entries(grouped).map(([category, items]) => (
                  <section key={category}>
                    <h2 className="mb-4 text-3xl font-black">{category}</h2>
                    <div className="grid gap-4 md:grid-cols-2">
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
          <div className="hidden lg:block"><div className="sticky top-28"><CartDrawer /></div></div>
        </div>
      </main>
      {cart.length > 0 && <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden"><CartDrawer compact /></div>}
      {infoOpen && (
        <div className="fixed inset-0 z-[80] bg-black/40 p-4">
          <div className="mx-auto mt-24 max-w-lg rounded-[32px] bg-white p-6">
            <h2 className="text-3xl font-black">{restaurant.name}</h2>
            <p className="mt-3 font-bold text-gray-500">{restaurant.cuisine.join(' · ')}</p>
            <div className="mt-4 space-y-2 rounded-2xl bg-gray-50 p-4 font-semibold">
              <p>Schedule: {restaurant.workingHours}</p>
              <p>Min order: {formatCurrencyUZS(restaurant.minOrder)}</p>
              <p>Delivery: {restaurant.deliveryFee === 0 ? 'Free' : formatCurrencyUZS(restaurant.deliveryFee)}</p>
              <p>ETA: {restaurant.etaMin}-{restaurant.etaMax} minutes</p>
              <p>Rating: {restaurant.rating} from {restaurant.reviews} reviews</p>
              <p>Restaurant address: {restaurant.address || 'Tashkent'}</p>
              <p>Delivery address: {address.text}</p>
              <p>Distance: {routeDistanceKm.toFixed(1)} km</p>
              <p>Estimated delivery time: {routeEtaMinutes} minutes</p>
            </div>
            <div className="mt-4">
              <YandexMapPreview center={restaurant.location} label={restaurant.address || restaurant.name} customer={{ ...customerLocation, label: 'Delivery address' }} />
            </div>
            <button onClick={() => setInfoOpen(false)} className="mt-5 w-full rounded-2xl bg-gray-950 px-4 py-4 font-black text-white">Close</button>
          </div>
        </div>
      )}
      {selectedDish && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-[36px] bg-white shadow-2xl">
            <div className="relative h-72">
              <Image src={selectedDish.imageUrl} alt={selectedDish.name} fill sizes="100vw" className="object-cover" />
              <button onClick={() => setSelectedDish(null)} className="absolute right-4 top-4 rounded-full bg-white p-3 shadow"><X size={20} /></button>
            </div>
            <div className="p-6">
              <p className="text-sm font-black uppercase tracking-widest text-yellow-500">{selectedDish.category}</p>
              <h2 className="mt-1 text-4xl font-black">{selectedDish.name}</h2>
              <p className="mt-3 font-semibold text-gray-500">{selectedDish.description}</p>
              {!selectedDish.available && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600">This dish is temporarily unavailable.</p>}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-2xl font-black">{formatCurrencyUZS(selectedDish.price)}</p>
                <button disabled={!selectedDish.available} onClick={() => { addDish(restaurant, selectedDish); setSelectedDish(null); }} className="rounded-2xl bg-yellow-300 px-6 py-4 font-black text-gray-950 disabled:bg-gray-200 disabled:text-gray-400">Add to cart</button>
              </div>
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
    <article className={`overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-black/5 ${dish.available ? '' : 'opacity-70'}`}>
      <button onClick={onOpen} className="relative block h-48 w-full text-left">
        <Image src={dish.imageUrl} alt={dish.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
        {dish.popular && <span className="absolute left-4 top-4 rounded-full bg-yellow-300 px-3 py-1 text-sm font-black">Popular</span>}
        {!dish.available && <span className="absolute bottom-4 left-4 rounded-full bg-gray-950 px-3 py-1 text-sm font-black text-white">Unavailable</span>}
      </button>
      <div className="p-5">
        <button onClick={onOpen} className="text-left text-2xl font-black hover:text-yellow-600">{dish.name}</button>
        <p className="mt-2 min-h-12 font-semibold text-gray-500">{dish.description}</p>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xl font-black">{formatCurrencyUZS(dish.price)}</p>
          {inCartQuantity > 0 ? (
            <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1">
              <button onClick={() => onUpdate(-1)} className="rounded-full bg-white p-3"><Minus size={16} /></button>
              <span className="min-w-7 text-center font-black">{inCartQuantity}</span>
              <button onClick={() => onUpdate(1)} className="rounded-full bg-yellow-300 p-3"><Plus size={16} /></button>
            </div>
          ) : (
            <button disabled={!dish.available} onClick={onAdd} className="rounded-full bg-yellow-300 px-5 py-3 font-black text-gray-950 disabled:bg-gray-200 disabled:text-gray-400">+ Add</button>
          )}
        </div>
      </div>
    </article>
  );
}
