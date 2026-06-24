'use client';

import Image from 'next/image';
import { ArrowLeft, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { useRef } from 'react';
import type { Promo, Restaurant } from '@/data/marketplace';
import { RestaurantCard } from './RestaurantCard';

type PromoBannersProps = {
  promos: Promo[];
  restaurants: Restaurant[];
  onSelect: (promo: Promo) => void;
};

export function PromoBanners({ promos, restaurants, onSelect }: PromoBannersProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cards = promos.slice(0, 4);

  const scroll = (direction: number) => {
    scrollRef.current?.scrollBy({ left: direction * 420, behavior: 'smooth' });
  };

  return (
    <section aria-label="Promotions" className="relative">
      <div ref={scrollRef} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {cards.map((promo, index) => (
          <button
            key={promo.code}
            type="button"
            onClick={() => onSelect(promo)}
            className="group relative h-[180px] w-[310px] shrink-0 snap-start overflow-hidden rounded-2xl text-left shadow-[0_12px_28px_rgba(0,0,0,.24)] transition-transform hover:scale-[1.015] sm:w-[390px]"
          >
            <Image
              src={restaurants[index % Math.max(restaurants.length, 1)]?.imageUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop'}
              alt=""
              fill
              loading="eager"
              fetchPriority={index === 0 ? 'high' : 'auto'}
              sizes="390px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
            <span className="absolute left-4 top-4 rounded-full bg-[#fce000] px-3 py-1 text-xs font-black text-black">
              {promo.code}
            </span>
            <span className="absolute bottom-5 left-5 right-5">
              <span className="block text-2xl font-black leading-tight text-white">{promo.title}</span>
              <span className="mt-1 block text-sm font-bold text-[#fce000]">{promo.description}</span>
            </span>
          </button>
        ))}
      </div>
      {cards.length > 1 && (
        <>
          <button type="button" aria-label="Previous promotion" onClick={() => scroll(-1)} className="absolute -left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#343331] text-white shadow-xl hover:bg-[#454440] lg:flex">
            <ArrowLeft size={19} />
          </button>
          <button type="button" aria-label="Next promotion" onClick={() => scroll(1)} className="absolute -right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#343331] text-white shadow-xl hover:bg-[#454440] lg:flex">
            <ArrowRight size={19} />
          </button>
        </>
      )}
    </section>
  );
}

export function ShopsSection({
  restaurants,
  onSelect,
  onShowAll,
}: {
  restaurants: Restaurant[];
  onSelect: (restaurant: Restaurant) => void;
  onShowAll: () => void;
}) {
  const palette = ['bg-sky-400', 'bg-amber-200', 'bg-emerald-500', 'bg-orange-400', 'bg-rose-300'];

  return (
    <section>
      <SectionHeading title="Shops" onAll={onShowAll} />
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {restaurants.slice(0, 6).map((restaurant, index) => (
          <button key={restaurant.id} type="button" onClick={() => onSelect(restaurant)} className="w-[220px] shrink-0 text-left sm:w-[250px]">
            <span className={`flex h-[155px] items-end overflow-hidden rounded-2xl p-5 transition-transform hover:scale-[1.015] ${palette[index % palette.length]}`}>
              <span className="text-2xl font-black leading-tight text-black/85">{restaurant.name}</span>
            </span>
            <span className="mt-3 block truncate text-base font-black text-white">{restaurant.name}</span>
            <span className="mt-1 block text-sm font-semibold text-[#aaa8a0]">{restaurant.etaMin}-{restaurant.etaMax} min</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function CategoryBar({
  categories,
  selected,
  onSelect,
  onOpenSort,
}: {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  onOpenSort: () => void;
}) {
  return (
    <section className="sticky top-[126px] z-30 -mx-4 border-y border-white/5 bg-[#21201f]/95 px-4 py-4 backdrop-blur-xl sm:top-[68px]">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onSelect(category)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
                selected === category ? 'bg-white text-black' : 'bg-[#2b2a29] text-white hover:bg-[#3a3937]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <button type="button" onClick={onOpenSort} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#2b2a29] px-4 text-sm font-bold text-white hover:bg-[#3a3937]">
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Sort</span>
        </button>
      </div>
    </section>
  );
}

export function RestaurantGridSection({
  title,
  restaurants,
  loading = false,
}: {
  title: string;
  restaurants: Restaurant[];
  loading?: boolean;
}) {
  return (
    <section>
      <SectionHeading title={title} />
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-[#2b2a29]" />)}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="rounded-2xl bg-[#2b2a29] px-6 py-14 text-center">
          <p className="text-xl font-black text-white">No restaurants found</p>
          <p className="mt-2 text-sm font-semibold text-[#aaa8a0]">Try another search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {restaurants.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} priority={index < 4} />)}
        </div>
      )}
    </section>
  );
}

function SectionHeading({ title, onAll }: { title: string; onAll?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-black text-white sm:text-2xl">{title}</h2>
      {onAll && <button type="button" onClick={onAll} className="rounded-full bg-[#2b2a29] px-4 py-2 text-sm font-bold text-white hover:bg-[#3a3937]">All</button>}
    </div>
  );
}
