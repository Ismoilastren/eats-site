'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Clock3, Heart, Star } from 'lucide-react';
import { Restaurant } from '@/data/marketplace';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useMarketplace } from '@/context/MarketplaceContext';

export function RestaurantCard({ restaurant, priority = false }: { restaurant: Restaurant; priority?: boolean }) {
  const { favorites, toggleFavorite, address, deliveryMode } = useMarketplace();
  const favorite = favorites.includes(restaurant.id);
  const available = (address.inZone || deliveryMode === 'pickup') && restaurant.isOpen && (deliveryMode === 'delivery' || restaurant.supportsPickup);

  return (
    <article className={`group min-w-0 overflow-hidden rounded-2xl bg-[#2b2a29] text-white transition-transform duration-200 hover:-translate-y-1 hover:bg-[#343331] ${available ? '' : 'opacity-60'}`}>
      <div className="relative">
        <Link href={`/restaurant/${restaurant.slug}`} className="block">
        <div className="relative aspect-[1.55] overflow-hidden bg-[#343331]">
          <Image priority={priority} src={restaurant.imageUrl} alt={restaurant.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {restaurant.promo && <span className="absolute bottom-3 left-3 rounded-[8px] bg-[#fce000] px-2.5 py-1 text-xs font-black text-[#111]">{restaurant.promo}</span>}
          {!available && <span className="absolute bottom-3 left-3 rounded-[8px] bg-[#111] px-2.5 py-1 text-xs font-black text-white">{!restaurant.isOpen ? 'Closed' : 'Unavailable here'}</span>}
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
            <Clock3 size={12} /> {restaurant.etaMin}-{restaurant.etaMax} min
          </span>
        </div>
        </Link>
        <button
          type="button"
          aria-label={favorite ? `Remove ${restaurant.name} from favorites` : `Add ${restaurant.name} to favorites`}
          onClick={() => toggleFavorite(restaurant.id)}
          className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition-transform hover:scale-105 ${favorite ? 'bg-white text-red-500' : 'bg-black/35 text-white'}`}
        >
          <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/restaurant/${restaurant.slug}`} className="min-w-0 truncate text-[17px] font-black leading-tight hover:text-[#fce000]">{restaurant.name}</Link>
          <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[13px] font-black text-white"><Star size={13} className="fill-[#fce000] text-[#fce000]" /> {restaurant.rating}</span>
        </div>
        <p className="mt-1.5 truncate text-[13px] font-semibold text-[#aaa8a0]">{restaurant.category} · {restaurant.cuisine.slice(0, 2).join(', ')}</p>
        <p className="mt-1.5 text-[13px] font-semibold text-[#aaa8a0]">
          {restaurant.deliveryFee === 0 ? 'Free delivery' : `${formatCurrencyUZS(restaurant.deliveryFee)} delivery`} · min {formatCurrencyUZS(restaurant.minOrder)}
        </p>
      </div>
    </article>
  );
}
