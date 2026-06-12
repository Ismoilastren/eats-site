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
  const displayAddress = address.text === 'Current location'
    ? 'Detected location, Tashkent'
    : address.text.replace(/^Tashkent,\s*/i, '') || 'No address selected';
  const placeOrderDisabled = cart.length === 0
    || belowMinimum
    || isSubmitting
    || (isDelivery && !hasConfirmedAddress)
    || (payment === 'card' && !selectedCard);
  const placeOrderHelper = cart.length === 0
    ? 'Add items to place an order.'
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
    const unsubscribeAuth = onAuthStateChanged(auth, () => {
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
    if (!user) {
      setError('Sign in before placing your order.');
      window.dispatchEvent(new Event('marketplace:open-auth'));
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
      const order = await placeOrder({ name: name.trim(), phone: phone.trim(), address: address.text, paymentMethod: payment });
      router.push(`/orders/${order.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <MarketplaceHeader />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 lg:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 font-black shadow-sm"><ArrowLeft size={18} /> Continue shopping</Link>
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <section className="min-w-0 rounded-[40px] bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-yellow-500">Checkout</p>
                <h1 className="text-4xl font-black md:text-6xl">Your cart</h1>
              </div>
              {cart.length > 0 && <button onClick={clearCart} className="rounded-full bg-red-50 p-3 text-red-500"><Trash2 size={20} /></button>}
            </div>

            {!storageHydrated ? (
              <div className="mt-8 min-h-[430px] animate-pulse rounded-[32px] bg-gray-50 p-6">
                <div className="mx-auto mt-20 h-24 w-24 rounded-[30px] bg-gray-200" />
                <div className="mx-auto mt-7 h-8 w-56 rounded-xl bg-gray-200" />
                <div className="mx-auto mt-4 h-5 w-80 max-w-full rounded-lg bg-gray-100" />
              </div>
            ) : cart.length === 0 ? (
              <div className="mt-8 flex min-h-[430px] flex-col items-center justify-center rounded-[32px] bg-[linear-gradient(145deg,#faf9f6,#fff7df)] px-6 py-12 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-white text-orange-500 shadow-[0_18px_45px_rgba(17,24,39,0.10)]">
                  <ShoppingBasket size={42} />
                </div>
                <p className="mt-6 text-3xl font-black">Your cart is empty</p>
                <p className="mt-3 max-w-md text-base font-bold text-gray-500">Add dishes from restaurants to start your order.</p>
                <Link href="/" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-yellow-300 px-7 py-4 font-black text-gray-950 shadow-sm transition hover:bg-yellow-200">
                  Browse restaurants
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-[28px] bg-gray-50 p-4 sm:flex-nowrap sm:gap-4">
                    <div className="min-w-0 flex-1 basis-[180px]">
                      <p className="text-xl font-black">{item.name}</p>
                      <p className="mt-1 font-bold text-gray-500">{formatCurrencyUZS(item.price)} · {item.restaurantName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-full bg-white p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="rounded-full bg-gray-100 p-3"><Minus size={16} /></button>
                      <span className="min-w-7 text-center font-black">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="rounded-full bg-yellow-300 p-3"><Plus size={16} /></button>
                    </div>
                    <button onClick={() => removeDish(item.id)} className="rounded-full bg-white p-3 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="font-black text-gray-600">Name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none" />
                </label>
                <label className="block">
                  <span className="font-black text-gray-600">Phone</span>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+998 90 123 45 67" className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none" />
                </label>
                <label className="block md:col-span-2">
                  <span className="font-black text-gray-600">Delivery comments</span>
                  <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave at door, call before arrival..." className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none" />
                </label>
              </div>
            )}
          </section>

          <aside className="h-fit min-w-0 rounded-[40px] bg-white p-6 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-24">
            <h2 className="text-3xl font-black">Order summary</h2>
            <div className="mt-5 rounded-3xl bg-gray-50 p-4">
              {isDelivery ? (
                <>
                  <p className="flex items-center gap-2 font-black"><Truck size={18} /> Delivery address</p>
                  <p className="mt-2 font-bold text-gray-500">{hasConfirmedAddress ? displayAddress : 'Select and confirm your address'}</p>
                  {!hasConfirmedAddress && <p className="mt-2 text-sm font-black text-orange-600">Choose the exact delivery point before placing the order.</p>}
                  <div className="mt-4">
                    <YandexMapPreview
                      center={{ lat: address.lat || TASHKENT_CENTER.lat, lng: address.lng || TASHKENT_CENTER.lng }}
                      label={hasConfirmedAddress ? displayAddress : 'Delivery address'}
                      className="h-48"
                    />
                  </div>
                  <button onClick={() => setAddressPickerOpen(true)} className="mt-4 w-full rounded-2xl bg-gray-950 px-4 py-3 font-black text-white hover:bg-gray-800">
                    {hasConfirmedAddress ? 'Change address' : 'Select address'}
                  </button>
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-300 text-gray-950">
                    <Store size={20} />
                  </div>
                  <div>
                    <p className="font-black">Pickup order</p>
                    <p className="mt-1 text-sm font-bold text-gray-500">Collect your order directly from the restaurant. Delivery address is not required.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setPayment('cash')} className={`rounded-2xl px-4 py-4 font-black ${payment === 'cash' ? 'bg-yellow-300' : 'bg-gray-100'}`}><Wallet className="mx-auto mb-1" /> Cash</button>
              <button onClick={() => setPayment('card')} className={`rounded-2xl px-4 py-4 font-black ${payment === 'card' ? 'bg-yellow-300' : 'bg-gray-100'}`}><CreditCard className="mx-auto mb-1" /> Card</button>
            </div>
            {payment === 'card' && (
              <div className={`mt-3 rounded-2xl px-4 py-3 ${selectedCard ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                {cardsLoading ? (
                  <p className="text-sm font-black text-gray-500">Loading saved cards...</p>
                ) : selectedCard ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-gray-950">{selectedCard.brand} {selectedCard.maskedNumber}</p>
                      <p className="mt-1 text-xs font-bold text-gray-500">{selectedCard.cardholderName} · {selectedCard.expiry}</p>
                    </div>
                    <CreditCard className="shrink-0 text-emerald-600" size={22} />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-gray-950">No valid card saved</p>
                      <p className="mt-1 text-xs font-bold text-gray-500">Add a card before using card payment.</p>
                    </div>
                    <Link href="/profile" className="shrink-0 rounded-xl bg-gray-950 px-3 py-2 text-sm font-black text-white">
                      Add card
                    </Link>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <input value={promoInput} onChange={(event) => setPromoInput(event.target.value)} placeholder="Promo code" className="min-w-0 flex-1 rounded-2xl bg-gray-100 px-4 py-4 font-bold outline-none" />
              <button onClick={() => { if (!applyPromo(promoInput)) setError('Promo code not found. Try FIRST21.'); else setError(''); }} className="flex items-center gap-2 rounded-2xl bg-gray-950 px-4 font-black text-white"><Ticket size={18} /> Apply</button>
            </div>
            {promo && (
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-green-50 px-4 py-3 text-sm font-black text-green-700">
                <span>Applied: {promo.code}</span>
                <button onClick={() => { removePromo(); setPromoInput(''); }} className="text-green-900 underline">Remove</button>
              </div>
            )}
            {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600">{error}</p>}
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-5 font-bold text-gray-600">
              <Row label="Subtotal" value={formatCurrencyUZS(subtotal)} />
              <Row label="Delivery" value={formatCurrencyUZS(deliveryFee)} />
              <Row label="Service fee" value={formatCurrencyUZS(serviceFee)} />
              {discount > 0 && <Row label="Discount" value={`-${formatCurrencyUZS(discount)}`} />}
              <Row label="Total" value={formatCurrencyUZS(total)} strong />
            </div>
            {belowMinimum && <p className="mt-4 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-black text-yellow-700">Minimum order: {formatCurrencyUZS(minOrder)}</p>}
            <button onClick={submit} disabled={placeOrderDisabled} className="mt-6 w-full rounded-2xl bg-yellow-300 px-4 py-5 text-lg font-black text-gray-950 disabled:bg-gray-200 disabled:text-gray-400">{isSubmitting ? 'Placing order...' : 'Place order'}</button>
            {placeOrderHelper && <p className="mt-3 text-center text-sm font-bold text-gray-500">{placeOrderHelper}</p>}
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
  return <div className={`flex justify-between ${strong ? 'pt-3 text-2xl font-black text-gray-950' : ''}`}><span>{label}</span><span>{value}</span></div>;
}
