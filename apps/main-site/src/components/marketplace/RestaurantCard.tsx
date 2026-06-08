'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Bike, Heart, Star } from 'lucide-react';
import { Restaurant } from '@/data/marketplace';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useMarketplace } from '@/context/MarketplaceContext';

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const { favorites, toggleFavorite, address } = useMarketplace();
  const favorite = favorites.includes(restaurant.id);

  return (
    <article className="group overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/restaurant/${restaurant.slug}`} className="block">
        <div className="relative h-52 overflow-hidden bg-gray-100">
          <Image src={restaurant.imageUrl} alt={restaurant.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
          {restaurant.promo && <span className="absolute left-4 top-4 rounded-full bg-yellow-300 px-3 py-1 text-sm font-black text-gray-950">{restaurant.promo}</span>}
          {!restaurant.isOpen && <span className="absolute bottom-4 left-4 rounded-full bg-gray-950 px-3 py-1 text-sm font-black text-white">Closed</span>}
        </div>
      </Link>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/restaurant/${restaurant.slug}`} className="text-2xl font-black text-gray-950 hover:text-yellow-600">{restaurant.name}</Link>
            <p className="mt-1 font-bold text-gray-500">{restaurant.cuisine.join(' · ')}</p>
          </div>
          <button aria-label="Favorite restaurant" onClick={() => toggleFavorite(restaurant.id)} className={`rounded-full p-3 ${favorite ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
            <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-2 font-black text-green-700"><Star size={16} fill="currentColor" /> {restaurant.rating} <span className="text-green-500">({restaurant.reviews})</span></span>
          <span className="rounded-full bg-gray-100 px-3 py-2 font-black text-gray-700">{restaurant.etaMin}-{restaurant.etaMax} min</span>
          <span className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-2 font-black text-orange-600"><Bike size={16} /> {restaurant.deliveryFee === 0 ? 'Free' : formatCurrencyUZS(restaurant.deliveryFee)}</span>
        </div>
        <p className="mt-3 text-sm font-bold text-gray-500">Min. order {formatCurrencyUZS(restaurant.minOrder)} · {restaurant.priceLevel} · {address.inZone ? 'Available' : 'Outside zone'}</p>
      </div>
    </article>
  );
}

