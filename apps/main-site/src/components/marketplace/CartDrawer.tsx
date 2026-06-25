'use client';

import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useMarketplace } from '@/context/MarketplaceContext';

export function CartDrawer({ compact = false }: { compact?: boolean }) {
  const marketplace = useMarketplace();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (compact) {
    if (marketplace.cart.length === 0) return null;

    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-between rounded-[18px] bg-[var(--accent)] px-5 py-4 font-black text-[var(--accent-text)] shadow-[0_14px_35px_rgba(0,0,0,.24)]"
          aria-haspopup="dialog"
        >
          <span className="flex items-center gap-2"><ShoppingBag size={19} /> Cart · {marketplace.cartCount}</span>
          <span className="tabular-nums">{formatCurrencyUZS(marketplace.total)}</span>
        </button>

        {sheetOpen && (
          <div className="fixed inset-0 z-[100] flex items-end bg-black/55" role="dialog" aria-modal="true" aria-label="Cart">
            <button className="absolute inset-0" aria-label="Close cart" onClick={() => setSheetOpen(false)} />
            <div className="relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] bg-[var(--surface)] px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--surface-strong)]" />
              <button type="button" aria-label="Close cart" onClick={() => setSheetOpen(false)} className="absolute right-4 top-4 rounded-full bg-[var(--surface-muted)] p-2 text-[var(--text)]">
                <X size={19} />
              </button>
              <CartContents />
            </div>
          </div>
        )}
      </>
    );
  }

  return <CartContents />;
}

function CartContents() {
  const { cart, subtotal, deliveryFee, serviceFee, discount, total, updateQuantity, removeDish, clearCart } = useMarketplace();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  if (cart.length === 0) {
    return (
      <aside className="rounded-[24px] bg-[var(--surface)] p-5 text-[var(--text)] shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
        <h3 className="text-2xl font-black">Cart</h3>
        <p className="mt-4 rounded-[18px] bg-[var(--surface-muted)] p-8 text-center font-bold text-[var(--muted)]">Add dishes to start an order.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-[24px] bg-[var(--surface)] p-5 text-[var(--text)] shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black">Cart</h3>
        <button
          type="button"
          aria-label="Clear cart"
          onClick={() => setConfirmClearOpen(true)}
          className="rounded-full bg-[var(--surface-muted)] p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <p className="mt-1 font-bold text-[var(--muted)]">{cart[0].restaurantName}</p>
      <div className="mt-5 space-y-3">
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-[18px] bg-[var(--surface-muted)] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{item.name}</p>
              <p className="font-bold tabular-nums text-[var(--muted)]">{formatCurrencyUZS(item.price)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[var(--surface-strong)] p-1">
              <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => updateQuantity(item.id, -1)} className="rounded-full bg-[var(--surface)] p-2"><Minus size={14} /></button>
              <span className="min-w-5 text-center font-black tabular-nums">{item.quantity}</span>
              <button type="button" aria-label={`Increase ${item.name}`} onClick={() => updateQuantity(item.id, 1)} className="rounded-full bg-[var(--accent)] p-2 text-[var(--accent-text)]"><Plus size={14} /></button>
            </div>
            <button type="button" aria-label={`Remove ${item.name}`} onClick={() => removeDish(item.id)} className="text-[var(--muted)] hover:text-red-500"><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2 border-t border-[var(--line)] pt-4 text-sm font-bold text-[var(--muted)]">
        <Row label="Subtotal" value={formatCurrencyUZS(subtotal)} />
        <Row label="Delivery" value={formatCurrencyUZS(deliveryFee)} />
        <Row label="Service fee" value={formatCurrencyUZS(serviceFee)} />
        {discount > 0 && <Row label="Promo discount" value={`-${formatCurrencyUZS(discount)}`} />}
        <Row label="Total" value={formatCurrencyUZS(total)} strong />
      </div>
      <Link href="/cart" className="mt-5 block rounded-[15px] bg-[var(--accent)] px-4 py-4 text-center font-black text-[var(--accent-text)] hover:bg-[var(--accent-hover)]">
        Go to checkout
      </Link>
      {confirmClearOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Clear cart confirmation">
          <button type="button" aria-label="Cancel clear cart" className="absolute inset-0" onClick={() => setConfirmClearOpen(false)} />
          <div className="relative w-full max-w-sm rounded-[26px] bg-[#2b2a29] p-5 text-white shadow-2xl ring-1 ring-white/10">
            <h3 className="text-2xl font-black">Clear cart?</h3>
            <p className="mt-2 font-bold text-[#aaa8a0]">All dishes from this restaurant will be removed.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmClearOpen(false)} className="rounded-[16px] bg-[#3a3937] px-4 py-4 font-black hover:bg-[#454440]">Cancel</button>
              <button type="button" onClick={() => { clearCart(); setConfirmClearOpen(false); }} className="rounded-[16px] bg-[#fce000] px-4 py-4 font-black text-black hover:bg-[#ffe530]">Clear</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between tabular-nums ${strong ? 'pt-3 text-xl font-black text-[var(--text)]' : ''}`}><span>{label}</span><span>{value}</span></div>;
}
