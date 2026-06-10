'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Bike, CheckCircle2, MapPin, Phone } from 'lucide-react';
import type { LocalOrder } from '@/context/MarketplaceContext';
import { assignOrderToCourier, getAvailableCourierOrders, subscribeToOrders, updateOrderStatus, type OrderStatus } from '@/services/marketplace';
import { ModeBadge, money, RefreshButton, StatCard, StatusBadge } from '@/components/ops/OpsUi';
import { useEffect } from 'react';

const DEMO_COURIER = {
  id: 'courier-demo-1',
  name: 'Demo Courier',
  phone: '+998 90 555 21 13',
  vehicle: 'Bicycle',
};

const nextCourierStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  ready_for_pickup: 'picked_up',
  picked_up: 'on_the_way',
  on_the_way: 'delivered',
};

export default function CourierPage() {
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [available, setAvailable] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const refreshAvailable = async () => {
    setLoading(true);
    try {
      setAvailable(await getAvailableCourierOrders());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load courier orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAvailable();
    const unsubscribe = subscribeToOrders(
      (records) => {
        setOrders(records);
        setAvailable(records.filter((order) => order.status === 'ready_for_pickup' && !order.assignedCourier));
        setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const assigned = useMemo(() => orders.filter((order) => order.assignedCourier?.id === DEMO_COURIER.id && !['delivered', 'cancelled', 'rejected'].includes(order.status)), [orders]);
  const deliveredToday = orders.filter((order) => order.assignedCourier?.id === DEMO_COURIER.id && order.status === 'delivered' && new Date(order.createdAt).toDateString() === new Date().toDateString());
  const earningsToday = deliveredToday.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);

  const acceptOrder = async (orderId: string) => {
    setBusyId(orderId);
    setError('');
    try {
      await assignOrderToCourier(orderId, DEMO_COURIER);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to assign order');
    } finally {
      setBusyId('');
    }
  };

  const moveStatus = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    setError('');
    try {
      await updateOrderStatus(orderId, status, 'courier');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to update order');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 font-black shadow-sm"><ArrowLeft size={18} /> Customer site</Link>
            <h1 className="text-5xl font-black">Courier Dashboard</h1>
            <p className="mt-2 font-bold text-gray-500">Courier: {DEMO_COURIER.name} · {DEMO_COURIER.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <ModeBadge />
            <RefreshButton onClick={refreshAvailable} loading={loading} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Available" value={available.length} tone="yellow" />
          <StatCard label="Assigned active" value={assigned.length} tone="dark" />
          <StatCard label="Delivered today" value={deliveredToday.length} />
          <StatCard label="Delivery earnings" value={money(earningsToday)} />
        </div>

        {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600">{error}</p>}

        <section className="mt-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-3xl font-black">Available ready-for-pickup orders</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {loading ? (
              <div className="h-48 animate-pulse rounded-[24px] bg-gray-100 lg:col-span-2" />
            ) : available.length === 0 ? (
              <EmptyCourierState text="No available orders. Move a restaurant order to ready for pickup." />
            ) : available.map((order) => (
              <CourierOrderCard key={order.id} order={order} busy={busyId === order.id} actionLabel="Accept order" onAction={() => acceptOrder(order.id)} />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-3xl font-black">Assigned orders</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {assigned.length === 0 ? (
              <EmptyCourierState text="No assigned active orders." />
            ) : assigned.map((order) => {
              const next = nextCourierStatus[order.status];
              return (
                <CourierOrderCard
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  actionLabel={next ? `Move to ${next.replaceAll('_', ' ')}` : 'Done'}
                  onAction={next ? () => moveStatus(order.id, next) : undefined}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function CourierOrderCard({ order, busy, actionLabel, onAction }: { order: LocalOrder; busy: boolean; actionLabel: string; onAction?: () => void }) {
  return (
    <article className="rounded-[28px] bg-gray-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-black">#{order.id}</p>
          <p className="mt-1 font-bold text-gray-500">{order.restaurantName}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-4 grid gap-3 text-sm font-bold text-gray-600">
        <p className="flex gap-2"><MapPin size={18} className="text-orange-500" /> Restaurant: {order.restaurantName}</p>
        <p className="flex gap-2"><MapPin size={18} className="text-green-500" /> Customer: {order.customerAddress || order.address}</p>
        <p className="flex gap-2"><Phone size={18} /> {order.phone}</p>
        <p className="flex gap-2"><Bike size={18} /> ETA {order.etaMinutes || 24} min · total {money(order.total)}</p>
      </div>
      <div className="mt-4 rounded-2xl bg-white p-3">
        {order.items.map((item) => <p key={item.id} className="font-bold">{item.quantity}x {item.name}</p>)}
      </div>
      {onAction && <button disabled={busy} onClick={onAction} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-4 font-black text-white disabled:opacity-50"><CheckCircle2 size={18} /> {busy ? 'Updating...' : actionLabel}</button>}
    </article>
  );
}

function EmptyCourierState({ text }: { text: string }) {
  return <div className="rounded-[24px] bg-gray-50 p-8 text-center font-black text-gray-400 lg:col-span-2">{text}</div>;
}
