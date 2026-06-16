import type { Order, OrderItem } from '@repo/shared-types';

function firstArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function getOrderItems(order?: Partial<Order> | null): OrderItem[] {
  if (!order) return [];
  const raw = order as any;
  const source: unknown[] =
    firstArray(raw.items).length ? raw.items :
    firstArray(raw.cartItems).length ? raw.cartItems :
    firstArray(raw.orderItems).length ? raw.orderItems :
    firstArray(raw.lineItems).length ? raw.lineItems :
    firstArray(raw.itemsSnapshot).length ? raw.itemsSnapshot :
    firstArray(raw.products).length ? raw.products :
    firstArray(raw.cart?.items);

  return source
    .map((item: unknown, index: number) => {
      const rawItem = item as any;
      const nested = rawItem.menuItem || rawItem.product || rawItem.dish || {};
      const quantity = Math.max(1, asNumber(rawItem.quantity ?? rawItem.qty ?? rawItem.count, 1));
      const totalPrice = asNumber(rawItem.totalPrice ?? rawItem.total ?? rawItem.amount, 0);
      const unitPrice = asNumber(
        rawItem.price ?? rawItem.unitPrice ?? rawItem.itemPrice ?? nested.price,
        totalPrice > 0 ? totalPrice / quantity : 0,
      );

      return {
        id: asText(rawItem.id ?? rawItem.menuItemId ?? rawItem.productId ?? nested.id, `item-${index}`),
        name: asText(rawItem.name ?? rawItem.title ?? rawItem.productName ?? nested.name, 'Unknown Item'),
        price: unitPrice,
        quantity,
        imageUrl: asText(rawItem.imageUrl ?? rawItem.image ?? nested.imageUrl, ''),
        notes: asText(rawItem.notes ?? rawItem.note, ''),
      };
    })
    .filter((item: OrderItem) => item.name !== 'Unknown Item' || item.price > 0);
}

export function getOrderTotal(order?: Partial<Order> | null): number {
  if (!order) return 0;
  const raw = order as any;
  const explicitTotal = asNumber(raw.totalAmount ?? raw.total ?? raw.grandTotal, NaN);
  if (Number.isFinite(explicitTotal)) return explicitTotal;
  return getOrderItems(order).reduce((sum, item) => sum + item.price * item.quantity, 0);
}
