'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bike, CheckCircle2, Circle, Clock, MapPin, Phone } from 'lucide-react';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { useMarketplace, type LocalOrder } from '@/context/MarketplaceContext';
import { CUSTOMER_TRACKING_STATUSES, ORDER_STATUS_LABELS, subscribeToOrder } from '@/services/marketplace';
import { formatCurrencyUZS } from '@repo/shared-types';

export default function OrderTrackingPage() {
  const params = useParams<{ id: string }>();
  const { orders } = useMarketplace();
  const contextOrder = orders.find((item) => item.id === params.id);
  const [serviceOrder, setServiceOrder] = useState<LocalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const order = serviceOrder || contextOrder;
  const [step, setStep] = useState(order?.statusIndex || 0);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    const unsubscribe = subscribeToOrder(params.id, (record) => {
      setServiceOrder(record);
      setLoading(false);
      if (!record) setError('Order was not found.');
    });
    return unsubscribe;
  }, [params.id]);

  useEffect(() => {
    if (order) setStep(order.statusIndex);
  }, [order]);

  const eta = useMemo(() => Math.max(4, Number(order?.etaMinutes || 24) - step * 4), [order?.etaMinutes, step]);
  const courier = order?.assignedCourier || order?.courier || null;
  const hasCourier = Boolean(courier && (order?.assignedCourier?.id || courier.name || courier.phone || courier.vehicle));

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <MarketplaceHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-6 lg:px-8">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 font-black shadow-sm"><ArrowLeft size={18} /> Home</Link>
        {loading ? (
          <div className="rounded-[40px] bg-white p-12">
            <div className="h-8 w-56 animate-pulse rounded-full bg-gray-100" />
            <div className="mt-6 h-80 animate-pulse rounded-[32px] bg-gray-100" />
          </div>
        ) : !order ? (
          <div className="rounded-[40px] bg-white p-12 text-center">
            <p className="text-3xl font-black">Order not found</p>
            <p className="mt-2 font-bold text-gray-500">{error || 'Local demo orders are stored in this browser.'}</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="rounded-[44px] bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-10">
              <p className="text-sm font-black uppercase tracking-widest text-yellow-500">Order #{order.id}</p>
              <h1 className="mt-2 text-4xl font-black md:text-5xl">{order.status === 'delivered' ? 'Delivered' : `Arrives in ${eta} min`}</h1>
              <p className="mt-2 inline-flex rounded-full bg-yellow-100 px-4 py-2 font-black text-yellow-800">{ORDER_STATUS_LABELS[order.status]}</p>
              <p className="mt-3 font-bold text-gray-500">To {order.address}</p>
              <div className="mt-8 rounded-[36px] bg-gray-950 p-6 text-white">
                <div className="flex h-72 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_top,#facc15_0,#111827_34%,#030712_100%)]">
                  <div className="text-center">
                    <MapPin className="mx-auto text-yellow-300" size={54} />
                    <p className="mt-4 text-2xl font-black">Tashkent delivery route</p>
                    <p className="mt-2 font-bold text-gray-300">{hasCourier ? 'Restaurant → Courier → Customer' : 'Restaurant → Customer'}</p>
                    <p className="mt-2 text-sm font-black text-yellow-200">Live status: {ORDER_STATUS_LABELS[order.status]}</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 space-y-4">
                {CUSTOMER_TRACKING_STATUSES.map((status, index) => (
                  <div key={status} className={`flex items-center gap-4 rounded-3xl p-3 ${index === step ? 'bg-yellow-50' : ''}`}>
                    {index <= step ? <CheckCircle2 className="text-green-500" size={28} /> : <Circle className="text-gray-300" size={28} />}
                    <div>
                      <p className="text-lg font-black">{ORDER_STATUS_LABELS[status]}</p>
                      <p className="font-bold text-gray-500">{index === step ? 'Current step' : index < step ? 'Completed' : 'Waiting'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <aside className="h-fit rounded-[40px] bg-white p-6 shadow-sm ring-1 ring-black/5">
              <Clock className="text-yellow-500" size={28} />
              <h2 className="mt-3 text-3xl font-black">{order.restaurantName}</h2>
              <p className="mt-2 font-bold text-gray-500">{order.address}</p>
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
                  <div key={item.id} className="flex justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 font-bold">
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
