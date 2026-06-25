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
  formatOrderCode,
  hasAssignedCourier,
  normalizeCoordinate,
  normalizeOrderStatus,
  type CoordinateLike,
  type NormalizedCoordinate,
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
  return getFirstCoordinate(
    order.courierLocation,
    order.courier?.location,
    order.courier?.currentLocation,
    (order.assignedCourier as { location?: CoordinateLike; currentLocation?: CoordinateLike } | null)?.location,
    (order.assignedCourier as { location?: CoordinateLike; currentLocation?: CoordinateLike } | null)?.currentLocation,
  );
}

function getFirstCoordinate(...values: Array<CoordinateLike | null | undefined>): NormalizedCoordinate | null {
  for (const value of values) {
    const coordinate = normalizeCoordinate(value);
    if (coordinate) return coordinate;
  }
  return null;
}

function getRestaurantPoint(order: Order) {
  const looseOrder = order as unknown as {
    restaurantLocation?: CoordinateLike | null;
    restaurantCoordinates?: CoordinateLike | null;
    branchLocation?: CoordinateLike | null;
    branchCoordinates?: CoordinateLike | null;
    pickupLocation?: CoordinateLike | null;
    pickupCoordinates?: CoordinateLike | null;
    restaurant?: { location?: CoordinateLike | null; coordinates?: CoordinateLike | null };
    branch?: { location?: CoordinateLike | null; coordinates?: CoordinateLike | null };
  };
  return getFirstCoordinate(
    looseOrder.restaurantLocation,
    looseOrder.restaurantCoordinates,
    looseOrder.branchLocation,
    looseOrder.branchCoordinates,
    looseOrder.pickupLocation,
    looseOrder.pickupCoordinates,
    looseOrder.branch?.location,
    looseOrder.branch?.coordinates,
    looseOrder.restaurant?.location,
    looseOrder.restaurant?.coordinates,
  );
}

function getCustomerPoint(order: Order) {
  const looseOrder = order as unknown as {
    deliveryLocation?: CoordinateLike | null;
    deliveryCoordinates?: CoordinateLike | null;
    customerLocation?: CoordinateLike | null;
    customerCoordinates?: CoordinateLike | null;
    destinationLocation?: CoordinateLike | null;
    destinationCoordinates?: CoordinateLike | null;
  };
  return getFirstCoordinate(
    looseOrder.deliveryLocation,
    looseOrder.deliveryCoordinates,
    looseOrder.customerLocation,
    looseOrder.customerCoordinates,
    looseOrder.destinationLocation,
    looseOrder.destinationCoordinates,
  );
}

function coordinateSignature(point: NormalizedCoordinate | null) {
  return point ? `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}` : 'none';
}

export default function DispatchMapPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<AdminCourierRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [onlyOnlineCouriers, setOnlyOnlineCouriers] = useState(true);
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
  const mapRestaurantLocation = selectedOrder ? getRestaurantPoint(selectedOrder) : null;
  const mapCustomerLocation = selectedOrder ? getCustomerPoint(selectedOrder) : null;
  const selectedHasCourier = selectedOrder ? hasAssignedCourier(selectedOrder) : false;
  const mapKey = selectedOrder ? [
    selectedOrder.id,
    coordinateSignature(mapRestaurantLocation),
    coordinateSignature(mapCustomerLocation),
    coordinateSignature(mapCourierLocation),
    selectedHasCourier ? 'assigned' : 'unassigned',
  ].join('|') : 'no-active-order';

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

      <section className="rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Map filters</p>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
              Select an order on the right. The map always redraws pickup, customer and courier points from the selected order.
            </p>
          </div>
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-black uppercase text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            Tracking points only
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_1fr]">
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
          <label className="flex min-h-[58px] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 dark:border-gray-700 dark:bg-gray-900">
            <input
              type="checkbox"
              checked={onlyOnlineCouriers}
              onChange={(event) => setOnlyOnlineCouriers(event.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm font-black text-gray-700 dark:text-gray-200">Only online/busy couriers</span>
          </label>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/30">
            <p className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-200">Dispatcher mode</p>
            <p className="mt-1 text-sm font-bold text-blue-950 dark:text-blue-100">Selected order controls the map.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 p-5 dark:border-gray-700">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Selected delivery</p>
                <h2 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">
                  {selectedOrder ? formatOrderCode(selectedOrder.id) : 'No active order selected'}
                </h2>
                {selectedOrder ? (
                  <p className="mt-1 text-sm font-bold text-gray-500">
                    {getBranchLabel(selectedOrder)} · {selectedOrder.deliveryAddress || 'Delivery address missing'}
                  </p>
                ) : null}
              </div>
              {selectedOrder ? (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-black uppercase text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    {ORDER_STATUS_LABELS[normalizeOrderStatus(selectedOrder.status)]}
                  </span>
                  <span className="rounded-full bg-brand-50 px-3 py-2 text-xs font-black uppercase text-brand-700">
                    {formatCurrencyUZS(selectedOrder.totalAmount)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          {selectedOrder ? (
            <div className="grid gap-2 border-b border-gray-200 p-4 text-xs font-black uppercase tracking-wide dark:border-gray-700 sm:grid-cols-3">
              <div className={`rounded-xl px-3 py-2 ${mapRestaurantLocation ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                Pickup: {mapRestaurantLocation ? 'shown' : 'missing coords'}
              </div>
              <div className={`rounded-xl px-3 py-2 ${mapCustomerLocation ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                Customer: {mapCustomerLocation ? 'shown' : 'missing coords'}
              </div>
              <div className={`rounded-xl px-3 py-2 ${mapCourierLocation ? 'bg-green-50 text-green-700' : selectedHasCourier ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                Courier: {mapCourierLocation ? 'shown' : selectedHasCourier ? 'location unavailable' : 'not assigned'}
              </div>
            </div>
          ) : null}
          <div className="h-[620px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-gray-500">Loading live orders...</div>
            ) : selectedOrder ? (
              <LiveTrackingMap
                key={mapKey}
                restaurantLocation={mapRestaurantLocation}
                customerLocation={mapCustomerLocation}
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
                        <p className="font-mono text-sm font-black text-gray-900 dark:text-white">{formatOrderCode(order.id)}</p>
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
