import { normalizeOrderStatus, type OrderStatus } from '@repo/shared-types';

export const MAX_DEMO_ORDER_TOTAL_UZS = 5_000_000;

function parseOrderTotal(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function isSuspiciousOrderTotal(value: unknown): boolean {
  const amount = parseOrderTotal(value);
  return amount !== null && amount > MAX_DEMO_ORDER_TOTAL_UZS;
}

export function isValidRecentOrderTotal(value: unknown): boolean {
  const amount = parseOrderTotal(value);
  return amount !== null && amount > 0 && amount <= MAX_DEMO_ORDER_TOTAL_UZS;
}

export function formatOrderTotalSafe(value: unknown): string {
  const amount = parseOrderTotal(value);
  if (amount === null || amount <= 0) return 'Total unavailable';
  if (amount > MAX_DEMO_ORDER_TOTAL_UZS) return 'Total needs review';

  return `${Math.round(amount).toLocaleString('ru-RU', {
    maximumFractionDigits: 0,
  })} UZS`;
}

export function formatOrderDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCustomerOrderStatus(status: string | undefined): {
  status: OrderStatus;
  label: string;
  className: string;
} {
  const normalized = normalizeOrderStatus(status);

  const labels: Record<OrderStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    preparing: 'Preparing',
    ready_for_pickup: 'Ready for pickup',
    picked_up: 'Picked up',
    on_the_way: 'On the way',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    rejected: 'Cancelled',
  };

  const classes: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    accepted: 'bg-violet-100 text-violet-800',
    preparing: 'bg-indigo-100 text-indigo-800',
    ready_for_pickup: 'bg-purple-100 text-purple-800',
    picked_up: 'bg-sky-100 text-sky-800',
    on_the_way: 'bg-emerald-100 text-emerald-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return {
    status: normalized,
    label: labels[normalized],
    className: classes[normalized],
  };
}
