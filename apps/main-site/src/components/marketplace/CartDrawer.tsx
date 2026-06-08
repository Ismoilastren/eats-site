'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useMarketplace } from '@/context/MarketplaceContext';

export function CartDrawer({ compact = false }: { compact?: boolean }) {
  const { cart, subtotal, deliveryFee, serviceFee, discount, total, updateQuantity, removeDish, clearCart } = useMarketplace();

  if (cart.length === 0) {
    return (
      <aside className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h3 className="text-2xl font-black">Cart</h3>
        <p className="mt-4 rounded-3xl bg-gray-50 p-8 text-center font-bold text-gray-400">Add dishes to start an order.</p>
      </aside>
    );
  }

  const minOrder = cart[0].restaurantMinOrder;
  const belowMinimum = subtotal < minOrder;

  return (
    <aside className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black">Cart</h3>
        <button onClick={clearCart} className="rounded-full bg-red-50 p-2 text-red-500"><Trash2 size={18} /></button>
      </div>
      <p className="mt-1 font-bold text-gray-500">{cart[0].restaurantName}</p>
      <div className="mt-5 space-y-3">
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-3xl bg-gray-50 p-3">
            <div className="flex-1">
              <p className="font-black text-gray-950">{item.name}</p>
              <p className="font-bold text-gray-500">{formatCurrencyUZS(item.price)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white p-1">
              <button onClick={() => updateQuantity(item.id, -1)} className="rounded-full bg-gray-100 p-2"><Minus size={14} /></button>
              <span className="min-w-5 text-center font-black">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, 1)} className="rounded-full bg-yellow-300 p-2"><Plus size={14} /></button>
            </div>
            <button onClick={() => removeDish(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-sm font-bold text-gray-600">
        <Row label="Subtotal" value={formatCurrencyUZS(subtotal)} />
        <Row label="Delivery" value={formatCurrencyUZS(deliveryFee)} />
        <Row label="Service fee" value={formatCurrencyUZS(serviceFee)} />
        {discount > 0 && <Row label="Promo discount" value={`-${formatCurrencyUZS(discount)}`} />}
        <Row label="Total" value={formatCurrencyUZS(total)} strong />
      </div>
      {belowMinimum && <p className="mt-4 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-black text-yellow-700">Minimum order: {formatCurrencyUZS(minOrder)}</p>}
      <Link href="/cart" className={`mt-5 block rounded-2xl px-4 py-4 text-center font-black ${belowMinimum ? 'pointer-events-none bg-gray-200 text-gray-400' : 'bg-gray-950 text-white hover:bg-gray-800'}`}>
        {compact ? `Checkout · ${formatCurrencyUZS(total)}` : 'Go to checkout'}
      </Link>
    </aside>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? 'pt-3 text-xl font-black text-gray-950' : ''}`}><span>{label}</span><span>{value}</span></div>;
}

