'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, MapPin, Minus, Plus, ShoppingBasket, Store, Ticket, Trash2, Truck, Wallet } from 'lucide-react';
import { formatCurrencyUZS, isReadableAddress } from '@repo/shared-types';
import { auth, onAuthStateChanged } from '@repo/firebase-config';
import { AddressMapPicker } from '@/components/marketplace/AddressMapPicker';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { YandexMapPreview } from '@/components/marketplace/YandexMapPreview';
import { useMarketplace } from '@/context/MarketplaceContext';
import { TASHKENT_CENTER } from '@/lib/yandexMaps';
import {
  isStoredPaymentMethodValid,
  loadPaymentMethods,
  readStoredPaymentMethods,
  subscribeCustomerProfileStorage,
  type PaymentMethod,
} from '@/services/customerProfile';
import { isFirestoreDataSource } from '@/services/marketplace/config';

export default function CartPage() {
  const router = useRouter();
  const {
    cart,
    address,
    user,
    subtotal,
    deliveryFee,
    serviceFee,
    discount,
    total,
    promo,
    updateQuantity,
    removeDish,
    clearCart,
    applyPromo,
    removePromo,
    placeOrder,
    setAddress,
    deliveryMode,
    storageHydrated,
  } = useMarketplace();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '+998');
  const [comment, setComment] = useState('');
  const [payment, setPayment] = useState<'cash' | 'card'>('cash');
  const [promoInput, setPromoInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [savedCards, setSavedCards] = useState<PaymentMethod[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [firebaseUid, setFirebaseUid] = useState(auth.currentUser?.uid || '');

  const minOrder = cart[0]?.restaurantMinOrder || 0;
  const belowMinimum = cart.length > 0 && subtotal < minOrder;
  const phoneValid = /^\+?998\d{9}$/.test(phone.replace(/\s/g, ''));
  const isDelivery = deliveryMode === 'delivery';
  const hasConfirmedAddress = Boolean(
    address.confirmed
    && address.inZone
    && isReadableAddress(address.text)
  );
  const validSavedCards = savedCards.filter(isStoredPaymentMethodValid);
  const selectedCard = validSavedCards[0];
  const requiresFirebaseAuth = isFirestoreDataSource();
  const signedInForCheckout = !requiresFirebaseAuth || Boolean(firebaseUid);
  const displayAddress = address.text === 'Current location'
    ? 'Detected location, Tashkent'
    : address.text.replace(/^Tashkent,\s*/i, '') || 'No address selected';
  const placeOrderDisabled = cart.length === 0
    || belowMinimum
    || isSubmitting
    || !signedInForCheckout
    || (isDelivery && !hasConfirmedAddress)
    || (payment === 'card' && !selectedCard);
  const placeOrderHelper = cart.length === 0
    ? 'Add items to place an order.'
    : !signedInForCheckout
      ? 'Sign in before placing your order.'
    : isDelivery && !hasConfirmedAddress
      ? 'Select delivery address.'
      : payment === 'card' && !selectedCard
        ? 'Add a valid card in your profile or choose cash.'
      : '';

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setPhone(user.phone || '+998');
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const refreshCards = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        if (!cancelled) {
          setSavedCards([]);
          setCardsLoading(false);
        }
        return;
      }
      if (!cancelled) setSavedCards(readStoredPaymentMethods(uid));
      const loadedCards = await loadPaymentMethods(uid);
      if (!cancelled) {
        setSavedCards(loadedCards);
        setCardsLoading(false);
      }
    };
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseUid(firebaseUser?.uid || '');
      setCardsLoading(true);
      refreshCards();
    });
    const unsubscribeStorage = subscribeCustomerProfileStorage(refreshCards);
    return () => {
      cancelled = true;
      unsubscribeAuth();
      unsubscribeStorage();
    };
  }, []);

  const submit = async () => {
    if (cart.length === 0) return;
    if (isSubmitting) return;
    if (requiresFirebaseAuth && !auth.currentUser?.uid) {
      setError('Sign in before placing your order.');
      window.dispatchEvent(new Event('marketplace:open-auth'));
      return;
    }
    if (!user) {
      setError('Enter your customer details before checkout.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    if (isDelivery && !hasConfirmedAddress) {
      setError('Select and confirm a delivery address before checkout.');
      return;
    }
    if (payment === 'card' && !selectedCard) {
      setError('Add a valid payment card in your profile or choose cash.');
      return;
    }
    if (!phoneValid) {
      setError('Enter a valid Uzbekistan phone number, for example +998901234567.');
      return;
    }
    if (belowMinimum) {
      setError(`Minimum order is ${formatCurrencyUZS(minOrder)}.`);
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const order = await placeOrder({
        name: name.trim(),
        phone: phone.trim(),
        address: address.text,
        paymentMethod: payment,
        comment: comment.trim(),
      });
      router.push(`/orders/${order.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#21201f] text-white">
      <MarketplaceHeader />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 lg:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#2b2a29] px-4 py-3 font-black shadow-sm"><ArrowLeft size={18} /> Continue shopping</Link>
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <section className="min-w-0 rounded-[24px] bg-[#2b2a29] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.3)] ring-1 ring-white/10 md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-[#fce000]">Checkout</p>
                <h1 className="text-4xl font-black md:text-6xl">Your cart</h1>
              </div>
              {cart.length > 0 && (
                <button
                  aria-label="Clear cart"
                  onClick={() => {
                    if (window.confirm('Clear all items from the cart?')) clearCart();
                  }}
                  className="rounded-full bg-[#3b3a38] p-3 text-[#ff6969]"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>

            {!storageHydrated ? (
              <div className="mt-8 min-h-[430px] animate-pulse rounded-[22px] bg-[#343331] p-6">
                <div className="mx-auto mt-20 h-24 w-24 rounded-[24px] bg-[#454440]" />
                <div className="mx-auto mt-7 h-8 w-56 rounded-xl bg-[#454440]" />
                <div className="mx-auto mt-4 h-5 w-80 max-w-full rounded-lg bg-[#3b3a38]" />
              </div>
            ) : cart.length === 0 ? (
              <div className="mt-8 flex min-h-[430px] flex-col items-center justify-center rounded-[22px] bg-[#343331] px-6 py-12 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[24px] bg-[#454440] text-[#fce000] shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
                  <ShoppingBasket size={42} />
                </div>
                <p className="mt-6 text-3xl font-black">Your cart is empty</p>
                <p className="mt-3 max-w-md text-base font-bold text-[#9b9a94]">Add dishes from restaurants to start your order.</p>
                <Link href="/" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-[#fce000] px-7 py-4 font-black text-[#111] shadow-sm transition hover:bg-[#ffe530]">
                  Browse restaurants
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[18px] bg-[#343331] p-4 sm:flex-nowrap sm:gap-4">
                    <div className="min-w-0 flex-1 basis-[180px]">
                      <p className="text-xl font-black">{item.name}</p>
                      <p className="mt-1 font-bold text-[#9b9a94]">{formatCurrencyUZS(item.price)} · {item.restaurantName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-full bg-[#454440] p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="rounded-full bg-[#45443f] p-3"><Minus size={16} /></button>
                      <span className="min-w-7 text-center font-black">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="rounded-full bg-[#fce000] p-3 text-[#111]"><Plus size={16} /></button>
                    </div>
                    <button onClick={() => removeDish(item.id)} className="rounded-full bg-[#454440] p-3 text-[#77756e] hover:text-[#ff6969]"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="font-black text-[#c8c7c1]">Name</span>
                  <input name="customer-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-[14px] bg-[#343331] px-4 py-4 font-bold outline-none placeholder:text-[#77756e]" />
                </label>
                <label className="block">
                  <span className="font-black text-[#c8c7c1]">Phone</span>
                  <input name="customer-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+998 90 123 45 67" className="mt-2 w-full rounded-[14px] bg-[#343331] px-4 py-4 font-bold outline-none placeholder:text-[#77756e]" />
                </label>
                <label className="block md:col-span-2">
                  <span className="font-black text-[#c8c7c1]">Delivery comments</span>
                  <input name="delivery-comment" autoComplete="off" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave at door, call before arrival…" className="mt-2 w-full rounded-[14px] bg-[#343331] px-4 py-4 font-bold outline-none placeholder:text-[#77756e]" />
                </label>
              </div>
            )}
          </section>

          <aside className="h-fit min-w-0 rounded-[24px] bg-[#2b2a29] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.3)] ring-1 ring-white/10 lg:sticky lg:top-24">
            <h2 className="text-3xl font-black">Order summary</h2>
            <div className="mt-5 rounded-[18px] bg-[#343331] p-4">
              {isDelivery ? (
                <>
                  <p className="flex items-center gap-2 font-black"><Truck size={18} /> Delivery address</p>
                  <p className="mt-2 font-bold text-[#9b9a94]">{hasConfirmedAddress ? displayAddress : 'Select and confirm your address'}</p>
                  {!hasConfirmedAddress && <p className="mt-2 text-sm font-black text-[#fce000]">Choose the exact delivery point before placing the order.</p>}
                  <div className="mt-4">
                    <YandexMapPreview
                      center={{ lat: address.lat || TASHKENT_CENTER.lat, lng: address.lng || TASHKENT_CENTER.lng }}
                      label={hasConfirmedAddress ? displayAddress : 'Delivery address'}
                      className="h-48"
                    />
                  </div>
                  <button onClick={() => setAddressPickerOpen(true)} className="mt-4 w-full rounded-[14px] bg-[#fce000] px-4 py-3 font-black text-[#111] hover:bg-[#ffe530]">
                    {hasConfirmedAddress ? 'Change address' : 'Select address'}
                  </button>
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#fce000] text-[#111]">
                    <Store size={20} />
                  </div>
                  <div>
                    <p className="font-black">Pickup order</p>
                    <p className="mt-1 text-sm font-bold text-[#9b9a94]">Collect your order directly from the restaurant. Delivery address is not required.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setPayment('cash')} className={`rounded-[14px] px-4 py-4 font-black ${payment === 'cash' ? 'bg-[#fce000] text-[#111]' : 'bg-[#343331]'}`}><Wallet className="mx-auto mb-1" /> Cash</button>
              <button onClick={() => setPayment('card')} className={`rounded-[14px] px-4 py-4 font-black ${payment === 'card' ? 'bg-[#fce000] text-[#111]' : 'bg-[#343331]'}`}><CreditCard className="mx-auto mb-1" /> Card</button>
            </div>
            {payment === 'card' && (
              <div className={`mt-3 rounded-[14px] px-4 py-3 ${selectedCard ? 'bg-[#193327]' : 'bg-[#3d3512]'}`}>
                {cardsLoading ? (
                  <p className="text-sm font-black text-[#9b9a94]">Loading saved cards…</p>
                ) : selectedCard ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black">{selectedCard.brand} {selectedCard.maskedNumber}</p>
                      <p className="mt-1 text-xs font-bold text-[#9b9a94]">{selectedCard.cardholderName} · {selectedCard.expiry}</p>
                    </div>
                    <CreditCard className="shrink-0 text-emerald-600" size={22} />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">No valid card saved</p>
                      <p className="mt-1 text-xs font-bold text-[#9b9a94]">Add a card before using card payment.</p>
                    </div>
                    <Link href="/profile" className="shrink-0 rounded-xl bg-[#fce000] px-3 py-2 text-sm font-black text-[#111]">
                      Add card
                    </Link>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <input name="promo-code" autoComplete="off" spellCheck={false} value={promoInput} onChange={(event) => setPromoInput(event.target.value)} placeholder="Promo code" className="min-w-0 flex-1 rounded-[14px] bg-[#343331] px-4 py-4 font-bold outline-none placeholder:text-[#77756e]" />
              <button onClick={() => { if (!applyPromo(promoInput)) setError('Promo code not found. Try FIRST21.'); else setError(''); }} className="flex items-center gap-2 rounded-[14px] bg-[#fce000] px-4 font-black text-[#111]"><Ticket size={18} /> Apply</button>
            </div>
            {promo && (
              <div className="mt-2 flex items-center justify-between rounded-[14px] bg-[#193327] px-4 py-3 text-sm font-black text-[#5fe483]">
                <span>Applied: {promo.code}</span>
                <button onClick={() => { removePromo(); setPromoInput(''); }} className="text-green-900 underline">Remove</button>
              </div>
            )}
            {error && <p className="mt-3 rounded-[14px] bg-[#3a1f1f] px-4 py-3 text-sm font-black text-[#ff9c9c]">{error}</p>}
            <div className="mt-6 space-y-3 border-t border-white/10 pt-5 font-bold text-[#bdbbb4]">
              <Row label="Subtotal" value={formatCurrencyUZS(subtotal)} />
              <Row label="Delivery" value={formatCurrencyUZS(deliveryFee)} />
              <Row label="Service fee" value={formatCurrencyUZS(serviceFee)} />
              {discount > 0 && <Row label="Discount" value={`-${formatCurrencyUZS(discount)}`} />}
              <Row label="Total" value={formatCurrencyUZS(total)} strong />
            </div>
            {belowMinimum && <p className="mt-4 rounded-[14px] bg-[#3d3512] px-4 py-3 text-sm font-black text-[#fce000]">Minimum order: {formatCurrencyUZS(minOrder)}</p>}
            <button onClick={submit} disabled={placeOrderDisabled} className="mt-6 w-full rounded-[14px] bg-[#fce000] px-4 py-5 text-lg font-black text-[#111] disabled:bg-[#454440] disabled:text-[#77756e]">{isSubmitting ? 'Placing order…' : 'Place order'}</button>
            {placeOrderHelper && <p className="mt-3 text-center text-sm font-bold text-[#9b9a94]">{placeOrderHelper}</p>}
          </aside>
        </div>
      </main>
      {addressPickerOpen && (
        <AddressMapPicker
          initialAddress={address}
          onCancel={() => setAddressPickerOpen(false)}
          onConfirm={(nextAddress) => {
            setAddress(nextAddress);
            setAddressPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? 'pt-3 text-2xl font-black text-white' : ''}`}><span>{label}</span><span>{value}</span></div>;
}
