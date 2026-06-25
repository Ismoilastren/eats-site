'use client';

import { MapPin, Navigation, Store } from 'lucide-react';
import {
  isReadableAddress,
  buildFallbackRoute,
  normalizeCoordinate,
  type CoordinateLike,
  type OrderStatus,
} from '@repo/shared-types';
import type { LocalOrder } from '@/context/MarketplaceContext';
import type { Restaurant } from '@/data/marketplace';
import { YandexMap, type MapPoint } from './YandexMap';

type CourierSnapshot = {
  currentLocation?: CoordinateLike | null;
  lastUpdated?: string;
} | null;

function statusCopy(status: OrderStatus, hasCourierLocation: boolean, isPickup: boolean) {
  if (isPickup) {
    switch (status) {
      case 'pending':
      case 'accepted':
      case 'preparing':
        return 'Restaurant is preparing your pickup.';
      case 'ready_for_pickup':
        return 'Ready for pickup at the restaurant.';
      case 'picked_up':
      case 'delivered':
        return 'Pickup completed.';
      case 'on_the_way':
        return 'Pickup is in progress.';
      case 'cancelled':
      case 'rejected':
        return 'This pickup order was cancelled.';
    }
  }
  switch (status) {
    case 'pending':
      return 'Restaurant → Customer';
    case 'accepted':
    case 'preparing':
      return 'The restaurant is preparing your order.';
    case 'ready_for_pickup':
      return hasCourierLocation ? 'Courier is heading to the restaurant.' : 'Waiting for courier pickup.';
    case 'picked_up':
    case 'on_the_way':
      return hasCourierLocation ? 'Courier → Customer' : 'Your order is on the way.';
    case 'delivered':
      return 'Delivery route completed.';
    case 'cancelled':
    case 'rejected':
      return 'This delivery was cancelled.';
  }
}

export function OrderTrackingMap({
  order,
  restaurant,
  courierSnapshot,
}: {
  order: LocalOrder;
  restaurant?: Restaurant;
  courierSnapshot?: CourierSnapshot;
}) {
  const restaurantCoordinate = normalizeCoordinate(
    order.restaurantLocation || (restaurant?.locationIsVerified ? restaurant.location : null),
  );
  const isPickup = order.fulfillmentType === 'pickup';
  const customerCoordinate = normalizeCoordinate(order.deliveryLocation || order.customerLocation);
  const hasAssignedCourier = Boolean(order.assignedCourier?.id);
  const courierCoordinate = hasAssignedCourier
    ? normalizeCoordinate(
      order.courierLocation
      || courierSnapshot?.currentLocation
      || order.courier?.currentLocation
      || order.courier?.location,
    )
    : null;

  const restaurantAddress = order.restaurantAddress || restaurant?.address || restaurant?.location.address || '';
  const customerAddress = order.customerAddress || order.address;

  if (!restaurantCoordinate || (!isPickup && !customerCoordinate)) {
    return (
      <div className="rounded-[32px] bg-gray-950 p-6 text-white ring-1 ring-white/10">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
            <MapPin size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black">Map route unavailable because coordinates are missing</h2>
            <p className="mt-1 text-sm font-bold text-gray-400">
              The saved address remains available below. No route or courier position is being estimated.
            </p>
          </div>
        </div>
        <div className={`mt-5 grid gap-3 ${isPickup ? '' : 'sm:grid-cols-2'}`}>
          <AddressCard icon={<Store size={18} />} label="Restaurant" value={restaurantAddress} dark />
          {!isPickup ? <AddressCard icon={<Navigation size={18} />} label="Customer" value={customerAddress} dark /> : null}
        </div>
      </div>
    );
  }

  const restaurantPoint = {
    lat: restaurantCoordinate.latitude,
    lng: restaurantCoordinate.longitude,
  };
  const customerPoint = customerCoordinate
    ? {
      lat: customerCoordinate.latitude,
      lng: customerCoordinate.longitude,
    }
    : null;
  const courierPoint = courierCoordinate
    ? { lat: courierCoordinate.latitude, lng: courierCoordinate.longitude }
    : null;
  const isCourierLeg = order.status === 'picked_up' || order.status === 'on_the_way';
  const isDelivered = order.status === 'delivered';
  const routePreview = customerPoint
    ? buildFallbackRoute({
      restaurant: restaurantPoint,
      customer: customerPoint,
      courier: courierPoint,
    })
    : { distanceMeters: 0 };

  const points: MapPoint[] = [
    {
      id: 'restaurant',
      label: `Restaurant · ${order.restaurantName}`,
      ...restaurantPoint,
      color: isDelivered ? '#16a34a' : isCourierLeg ? '#64748b' : '#f97316',
    },
    ...(!isPickup && customerPoint ? [{
      id: 'customer',
      label: 'Customer',
      ...customerPoint,
      color: isDelivered ? '#16a34a' : isCourierLeg ? '#22c55e' : '#2563eb',
    }] : []),
    ...(courierPoint ? [{
      id: 'courier',
      label: `Courier · ${order.assignedCourier?.name || 'Assigned courier'}`,
      ...courierPoint,
      color: '#7c3aed',
    }] : []),
  ];

  const lastUpdated = courierSnapshot?.lastUpdated || order.courier?.lastUpdated;

  return (
    <div className="overflow-hidden rounded-[38px] bg-gray-950 p-3 text-white shadow-[0_24px_80px_rgba(15,23,42,.18)] md:p-5">
      <div className="mb-4 flex flex-col gap-3 px-2 pt-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">{isPickup ? 'Pickup map' : 'Delivery map'}</p>
          <p className="mt-1 text-2xl font-black md:text-3xl">{statusCopy(order.status, Boolean(courierPoint), isPickup)}</p>
        </div>
        <div className="rounded-2xl bg-white/10 px-4 py-3 text-xs font-bold text-gray-200">
          <span className="block text-sm font-black text-white">{isPickup ? 'Restaurant pickup point' : 'Tracking points'}</span>
          <span>{isPickup ? 'No delivery route is shown for pickup orders.' : 'Route preview — exact road route unavailable'}</span>
          {routePreview.distanceMeters ? (
            <span className="mt-1 block text-gray-400">Approx. {(routePreview.distanceMeters / 1000).toFixed(1)} km point-to-point</span>
          ) : null}
        </div>
      </div>
      <YandexMap
        center={restaurantPoint}
        points={points}
        interactive
        dark
        showLocateControl={false}
        heightClassName="h-[460px] md:h-[540px] lg:h-[600px]"
        fallbackLabel="Delivery map could not load."
      />
      <div className={`grid gap-3 px-2 pb-1 pt-4 ${isPickup ? '' : 'sm:grid-cols-2'}`}>
        <AddressCard icon={<Store size={18} />} label="Restaurant" value={restaurantAddress} dark />
        {!isPickup ? <AddressCard icon={<Navigation size={18} />} label="Customer" value={customerAddress} dark /> : null}
      </div>
      {courierPoint && lastUpdated ? (
        <p className="px-2 pt-3 text-xs font-bold text-gray-400">
          Courier location updated {new Date(lastUpdated).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function AddressCard({
  icon,
  label,
  value,
  dark = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div className={dark ? 'rounded-2xl bg-white/10 p-4' : 'rounded-2xl bg-white p-4'}>
      <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${dark ? 'text-orange-300' : 'text-amber-700'}`}>
        {icon} {label}
      </p>
      <p className={`mt-2 text-sm font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>
        {isReadableAddress(value) ? value : 'Readable address is not available'}
      </p>
    </div>
  );
}
