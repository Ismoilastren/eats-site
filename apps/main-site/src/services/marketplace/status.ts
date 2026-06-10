import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_FLOW,
  normalizeOrderStatus,
} from '@repo/shared-types';

export { normalizeOrderStatus, ORDER_STATUS_LABELS };
export type { OrderStatus };

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

export type OrderActor = 'customer' | 'restaurant' | 'courier' | 'admin' | 'system';

export const CUSTOMER_TRACKING_STATUSES: OrderStatus[] = [...ORDER_STATUS_FLOW];

export function statusIndex(status: string | undefined) {
  const normalized = normalizeOrderStatus(status);
  const index = CUSTOMER_TRACKING_STATUSES.indexOf(normalized);
  return index >= 0 ? index : 0;
}

export function isActiveOrderStatus(status: OrderStatus) {
  return !['delivered', 'cancelled', 'rejected'].includes(status);
}
