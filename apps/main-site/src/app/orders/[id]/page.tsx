'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bike, CheckCircle2, Circle, Clock, Phone } from 'lucide-react';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { useMarketplace, type LocalOrder } from '@/context/MarketplaceContext';
import { OrderTrackingMap } from '@/components/marketplace/OrderTrackingMap';
import {
  CUSTOMER_TRACKING_STATUSES,
  ORDER_STATUS_LABELS,
  subscribeToCourierTracking,
  subscribeToOrder,
  type CourierTrackingSnapshot,
} from '@/services/marketplace';
import { formatCurrencyUZS, formatOrderCode } from '@repo/shared-types';
import { getRestaurantForTracking } from '@/services/marketplace';
import type { Restaurant } from '@/data/marketplace';

export default function OrderTrackingPage() {
  const params = useParams<{ id: string }>();
  const { orders, restaurants } = useMarketplace();
  const contextOrder = orders.find((item) => item.id === params.id);
  const [serviceOrder, setServiceOrder] = useState<LocalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courierSnapshot, setCourierSnapshot] = useState<CourierTrackingSnapshot | null>(null);
  const [trackingRestaurant, setTrackingRestaurant] = useState<Restaurant | null>(null);
  const order = serviceOrder || contextOrder;
  const [step, setStep] = useState(order?.statusIndex || 0);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    const unsubscribe = subscribeToOrder(
      params.id,
      (record) => {
        setServiceOrder(record);
        setLoading(false);
        if (!record) setError('Order was not found.');
      },
      () => {
        setServiceOrder(null);
        setLoading(false);
        setError('This order is unavailable for the current signed-in customer.');
      },
    );
    return unsubscribe;
  }, [params.id]);

  useEffect(() => {
    if (order) setStep(order.statusIndex);
  }, [order]);

  const activeCourierId = order?.assignedCourier?.id || order?.courier?.id || order?.courierId || '';

  useEffect(() => {
    const courierId = activeCourierId;
    if (!courierId) {
      setCourierSnapshot(null);
      return;
    }
    return subscribeToCourierTracking(courierId, setCourierSnapshot, () => setCourierSnapshot(null));
  }, [activeCourierId]);

  useEffect(() => {
    if (!order?.restaurantId) {
      setTrackingRestaurant(null);
      return;
    }
    let cancelled = false;
    getRestaurantForTracking(order.restaurantId)
      .then((record) => {
        if (!cancelled) setTrackingRestaurant(record);
      })
      .catch(() => {
        if (!cancelled) setTrackingRestaurant(null);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.restaurantId]);

  const eta = useMemo(() => Math.max(4, Number(order?.etaMinutes || 24) - step * 4), [order?.etaMinutes, step]);
  const courier = useMemo(() => {
    const orderCourier = order?.assignedCourier || order?.courier || null;
    if (!orderCourier && !courierSnapshot) return null;
    return {
      ...orderCourier,
      name: courierSnapshot?.name || orderCourier?.name || 'Assigned courier',
      phone: courierSnapshot?.phone || orderCourier?.phone || '',
      vehicle: courierSnapshot?.vehicle || orderCourier?.vehicle || '',
      vehicleType: courierSnapshot?.vehicleType || orderCourier?.vehicleType || '',
    };
  }, [courierSnapshot, order?.assignedCourier, order?.courier]);
  const hasCourier = Boolean(activeCourierId);
  const restaurant = trackingRestaurant || restaurants.find((item) => item.id === order?.restaurantId);

  return (
    <div className="min-h-screen bg-[#181817] text-white">
      <MarketplaceHeader />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 lg:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#2b2a29] px-4 py-3 font-black ring-1 ring-white/10"><ArrowLeft size={18} /> Home</Link>
        {loading ? (
          <div className="rounded-[32px] bg-[#2b2a29] p-12">
            <div className="h-8 w-56 animate-pulse rounded-full bg-[#3a3937]" />
            <div className="mt-6 h-80 animate-pulse rounded-[28px] bg-[#343331]" />
          </div>
        ) : !order ? (
          <div className="rounded-[32px] bg-[#2b2a29] p-12 text-center">
            <p className="text-3xl font-black">Order not found</p>
            <p className="mt-2 font-bold text-[#aaa8a0]">{error || 'This order is not available in the current data source.'}</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-[32px] bg-[#2b2a29] p-4 shadow-[0_18px_55px_rgba(0,0,0,.32)] ring-1 ring-white/10 md:p-6 lg:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-[#fce000]">Order {formatOrderCode(order.id)}</p>
                  <h1 className="mt-2 text-4xl font-black md:text-5xl">{order.status === 'delivered' ? 'Delivered' : `Arrives in ${eta} min`}</h1>
                  <p className="mt-3 font-bold text-[#aaa8a0]">To {order.address}</p>
                </div>
                <p className="inline-flex w-fit rounded-full bg-[#fce000] px-4 py-2 font-black text-black">{ORDER_STATUS_LABELS[order.status]}</p>
              </div>
              <div className="mt-7 overflow-x-auto pb-2">
                <div className="flex min-w-[760px] items-start">
                  {CUSTOMER_TRACKING_STATUSES.map((status, index) => {
                    const completed = index <= step;
                    return (
                      <div key={status} className="relative flex flex-1 flex-col items-center text-center">
                        {index > 0 && <div className={`absolute right-1/2 top-4 h-1 w-full ${index <= step ? 'bg-[#fce000]' : 'bg-[#454440]'}`} />}
                        <div className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-[#2b2a29] ${completed ? 'bg-[#fce000] text-black' : 'bg-[#454440] text-[#aaa8a0]'}`}>
                          {completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </div>
                        <p className="mt-3 max-w-28 text-sm font-black">{ORDER_STATUS_LABELS[status]}</p>
                        <p className="mt-1 text-xs font-bold text-[#aaa8a0]">{index === step ? 'Current' : index < step ? 'Done' : 'Waiting'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6">
                <OrderTrackingMap
                  order={order}
                  restaurant={restaurant}
                  courierSnapshot={courierSnapshot}
                />
              </div>
            </section>
            <aside className="h-fit rounded-[32px] bg-[#2b2a29] p-6 shadow-[0_18px_55px_rgba(0,0,0,.32)] ring-1 ring-white/10 lg:sticky lg:top-28">
              <Clock className="text-[#fce000]" size={28} />
              <h2 className="mt-3 text-3xl font-black">{order.restaurantName}</h2>
              <p className="mt-2 font-bold text-[#aaa8a0]">{order.address}</p>
              {hasCourier && (
                <div className="mt-5 rounded-3xl bg-gray-950 p-4 text-white">
                  <p className="text-sm font-black uppercase tracking-widest text-yellow-300">Courier</p>
                  <p className="mt-2 text-xl font-black">{courier?.name || 'Assigned courier'}</p>
                  {courier?.vehicle ? (
                    <p className="mt-1 flex items-center gap-2 font-bold text-gray-300"><Bike size={18} /> {courier.vehicle}</p>
                  ) : null}
                  {courier?.phone ? (
                    <p className="mt-2 flex items-center gap-2 font-bold text-gray-300"><Phone size={18} /> {courier.phone}</p>
                  ) : null}
                </div>
              )}
              <div className="mt-5 space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 rounded-2xl bg-[#343331] px-4 py-3 font-bold">
                    <span className="min-w-0">{item.quantity}x {item.name}</span>
                    <span>{formatCurrencyUZS(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 flex justify-between text-xl font-black"><span>Total</span><span>{formatCurrencyUZS(order.total)}</span></p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
