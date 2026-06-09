export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
  'delivered',
  'cancelled',
  'rejected',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export type OrderActor = 'customer' | 'restaurant' | 'courier' | 'admin' | 'system';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  picked_up: 'Picked up',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const CUSTOMER_TRACKING_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
  'delivered',
];

export function statusIndex(status: string | undefined) {
  const normalized = normalizeOrderStatus(status);
  const index = CUSTOMER_TRACKING_STATUSES.indexOf(normalized);
  return index >= 0 ? index : 0;
}

export function normalizeOrderStatus(status: string | undefined): OrderStatus {
  if (status === 'courier_assigned') return 'ready_for_pickup';
  if (status === 'nearby') return 'on_the_way';
  if (ORDER_STATUSES.includes(status as OrderStatus)) return status as OrderStatus;
  return 'pending';
}

export function isActiveOrderStatus(status: OrderStatus) {
  return !['delivered', 'cancelled', 'rejected'].includes(status);
}
