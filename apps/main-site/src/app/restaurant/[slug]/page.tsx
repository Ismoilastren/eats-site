'use client';

import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, Info, Minus, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { restaurants } from '@/data/marketplace';
import { CartDrawer } from '@/components/marketplace/CartDrawer';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { useMarketplace } from '@/context/MarketplaceContext';
import { formatCurrencyUZS } from '@repo/shared-types';

export default function RestaurantPage() {
  const params = useParams<{ slug: string }>();
  const restaurant = restaurants.find((item) => item.slug === params.slug);
  const { addDish, cart, updateQuantity } = useMarketplace();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [infoOpen, setInfoOpen] = useState(false);

  if (!restaurant) notFound();

  const menuCategories = useMemo(() => ['All', ...Array.from(new Set(restaurant.menu.map((item) => item.category)))], [restaurant.menu]);
  const dishes = selectedCategory === 'All' ? restaurant.menu : restaurant.menu.filter((item) => item.category === selectedCategory);

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
              <button onClick={() => setInfoOpen(true)} className="rounded-full bg-yellow-300 px-4 py-2 font-black text-gray-950"><Info className="inline" size={18} /> Info</button>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="sticky top-[73px] z-20 flex gap-2 overflow-x-auto border-y border-black/5 bg-[#f6f6f3]/95 py-4 backdrop-blur">
              {menuCategories.map((category) => (
                <button key={category} onClick={() => setSelectedCategory(category)} className={`shrink-0 rounded-full px-5 py-3 font-black ${selectedCategory === category ? 'bg-gray-950 text-white' : 'bg-white text-gray-700'}`}>{category}</button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {dishes.map((dish) => {
                const inCart = cart.find((item) => item.id === dish.id);
                return (
                  <article key={dish.id} className="overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-black/5">
                    <div className="relative h-48">
                      <Image src={dish.imageUrl} alt={dish.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                      {dish.popular && <span className="absolute left-4 top-4 rounded-full bg-yellow-300 px-3 py-1 text-sm font-black">Popular</span>}
                    </div>
                    <div className="p-5">
                      <h3 className="text-2xl font-black">{dish.name}</h3>
                      <p className="mt-2 min-h-12 font-semibold text-gray-500">{dish.description}</p>
                      <div className="mt-5 flex items-center justify-between">
                        <p className="text-xl font-black">{formatCurrencyUZS(dish.price)}</p>
                        {inCart ? (
                          <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1">
                            <button onClick={() => updateQuantity(dish.id, -1)} className="rounded-full bg-white p-3"><Minus size={16} /></button>
                            <span className="min-w-7 text-center font-black">{inCart.quantity}</span>
                            <button onClick={() => updateQuantity(dish.id, 1)} className="rounded-full bg-yellow-300 p-3"><Plus size={16} /></button>
                          </div>
                        ) : (
                          <button onClick={() => addDish(restaurant, dish)} className="rounded-full bg-yellow-300 px-5 py-3 font-black text-gray-950">+ Add</button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
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
            <p className="mt-4 rounded-2xl bg-gray-50 p-4 font-semibold">Min order {formatCurrencyUZS(restaurant.minOrder)}. Delivery ETA {restaurant.etaMin}-{restaurant.etaMax} minutes.</p>
            <button onClick={() => setInfoOpen(false)} className="mt-5 w-full rounded-2xl bg-gray-950 px-4 py-4 font-black text-white">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

