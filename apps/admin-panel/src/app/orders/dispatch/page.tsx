'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, db, onSnapshot, orderBy, query } from '@repo/firebase-config';
import {
  COLLECTIONS,
  Order,
  ORDER_STATUS_LABELS,
  OrderStatus,
  formatCurrencyUZS,
  hasAssignedCourier,
  normalizeCoordinate,
  normalizeOrderStatus,
} from '@repo/shared-types';
import LiveTrackingMap from '@/components/LiveTrackingMap';
import {
  getCourierId,
  getCourierName,
  getCourierPhone,
  getCourierStatus,
  getCourierVehicle,
  isRealCourier,
  sortCouriers,
  type AdminCourierRecord,
} from '@/lib/courierFilters';

const DISPATCH_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
];

function getBranchLabel(order: Order) {
  return `${order.brandName || order.restaurantName || 'Restaurant'} · ${order.branchName || 'Main branch'}`;
}

function getOrderCourierLocation(order: Order) {
  return normalizeCoordinate(order.courierLocation || order.courier?.location || order.courier?.currentLocation || null);
}

export default function DispatchMapPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<AdminCourierRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [onlyOnlineCouriers, setOnlyOnlineCouriers] = useState(true);
  const [dispatcherMode, setDispatcherMode] = useState(true);
  const [routingMode, setRoutingMode] = useState<'points' | 'road'>('points');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const ordersQuery = query(collection(db, COLLECTIONS.ORDERS), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Order[];
      setOrders(rows);
      setIsLoading(false);
    }, (error) => {
      console.error('Dispatch orders subscription failed:', error);
      setIsLoading(false);
    });

    const unsubscribeCouriers = onSnapshot(collection(db, COLLECTIONS.COURIERS), (snapshot) => {
      setCouriers(snapshot.docs
        .map((item) => ({ id: item.id, uid: item.id, ...item.data() } as AdminCourierRecord))
        .filter(isRealCourier)
        .sort(sortCouriers));
    }, (error) => {
      console.error('Dispatch couriers subscription failed:', error);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCouriers();
    };
  }, []);

  const activeOrders = useMemo(() => {
    return orders.filter((order) => DISPATCH_STATUSES.includes(normalizeOrderStatus(order.status)));
  }, [orders]);

  const branchOptions = useMemo(() => {
    return Array.from(new Set(activeOrders.map(getBranchLabel))).sort();
  }, [activeOrders]);

  const filteredOrders = useMemo(() => {
    return activeOrders.filter((order) => {
      if (branchFilter !== 'all' && getBranchLabel(order) !== branchFilter) return false;
      if (statusFilter !== 'all' && normalizeOrderStatus(order.status) !== statusFilter) return false;
      return true;
    });
  }, [activeOrders, branchFilter, statusFilter]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId('');
      return;
    }
    if (!filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || null;

  const visibleCouriers = useMemo(() => {
    return couriers.filter((courier) => !onlyOnlineCouriers || getCourierStatus(courier) === 'online' || getCourierStatus(courier) === 'busy');
  }, [couriers, onlyOnlineCouriers]);

  const mapCourierLocation = selectedOrder ? getOrderCourierLocation(selectedOrder) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Dispatcher map</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Show on map</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Live Firestore dispatcher view for active orders, branches and real courier records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/orders"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            Back to orders
          </Link>
          <Link
            href="/orders/create"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600"
          >
            + Create order
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">Branch / region</span>
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="all">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">Order status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="all">All active statuses</option>
              {DISPATCH_STATUSES.map((status) => (
                <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
            <input
              type="checkbox"
              checked={onlyOnlineCouriers}
              onChange={(event) => setOnlyOnlineCouriers(event.target.checked)}
              className="mb-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Only online/busy couriers</span>
          </label>
          <label className="flex items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
            <input
              type="checkbox"
              checked={dispatcherMode}
              onChange={(event) => setDispatcherMode(event.target.checked)}
              className="mb-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Dispatcher mode</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-500">Route mode</span>
            <select
              value={routingMode}
              onChange={(event) => setRoutingMode(event.target.value as 'points' | 'road')}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="points">Tracking points</option>
              <option value="road">Road route not connected</option>
            </select>
          </label>
        </div>
        {routingMode === 'road' ? (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Road routing needs a paid Yandex routing/directions API endpoint. This page currently renders exact pickup, customer and courier points only.
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Map canvas</p>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                {selectedOrder ? `#${selectedOrder.id.slice(-6).toUpperCase()}` : 'No active order selected'}
              </h2>
            </div>
            <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black uppercase text-gray-600 dark:bg-gray-900 dark:text-gray-300">
              {dispatcherMode ? 'Dispatcher' : 'Monitor'}
            </div>
          </div>
          <div className="h-[520px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-gray-500">Loading live orders...</div>
            ) : selectedOrder ? (
              <LiveTrackingMap
                restaurantLocation={selectedOrder.restaurantLocation}
                customerLocation={selectedOrder.deliveryLocation}
                courierLocation={mapCourierLocation || undefined}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gray-50 p-8 text-center dark:bg-gray-900">
                <div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">No active orders on map</p>
                  <p className="mt-2 text-sm font-semibold text-gray-500">Create or receive an order to start dispatching.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Active orders</h2>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">{filteredOrders.length}</span>
            </div>
            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {filteredOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm font-semibold text-gray-500 dark:border-gray-700">
                  No orders match dispatcher filters.
                </div>
              ) : filteredOrders.map((order) => {
                const active = selectedOrder?.id === order.id;
                const status = normalizeOrderStatus(order.status);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                        : 'border-gray-200 bg-gray-50 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-black text-gray-900 dark:text-white">#{order.id.slice(-6).toUpperCase()}</p>
                        <p className="mt-1 text-sm font-bold text-gray-700 dark:text-gray-200">{getBranchLabel(order)}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">{order.deliveryAddress || 'Address missing'}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {ORDER_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-gray-500">
                      <span>{hasAssignedCourier(order) ? order.assignedCourier?.name : 'No courier assigned'}</span>
                      <span>{formatCurrencyUZS(order.totalAmount)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Couriers</h2>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">{visibleCouriers.length}</span>
            </div>
            <div className="mt-4 max-h-[300px] space-y-3 overflow-y-auto pr-1">
              {visibleCouriers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm font-semibold text-gray-500 dark:border-gray-700">
                  No live courier records for this filter.
                </div>
              ) : visibleCouriers.map((courier) => {
                const status = getCourierStatus(courier);
                const { vehicle } = getCourierVehicle(courier);
                return (
                  <div key={getCourierId(courier)} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-900 dark:text-white">{getCourierName(courier)}</p>
                        <p className="text-xs font-semibold text-gray-500">{getCourierPhone(courier)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${
                        status === 'online' ? 'bg-green-100 text-green-700' : status === 'busy' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {status}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-gray-500">{vehicle}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
