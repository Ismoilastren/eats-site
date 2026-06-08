'use client';

import Link from 'next/link';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { useMarketplace } from '@/context/MarketplaceContext';
import { formatCurrencyUZS } from '@repo/shared-types';

export default function OrdersPage() {
  const { orders } = useMarketplace();
  return (
    <div className="min-h-screen bg-[#f6f6f3] text-gray-950">
      <MarketplaceHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
        <h1 className="text-5xl font-black">Orders</h1>
        {orders.length === 0 ? (
          <div className="mt-8 rounded-[40px] bg-white p-12 text-center">
            <p className="text-3xl font-black">No orders yet</p>
            <p className="mt-2 font-bold text-gray-500">Place an order to see tracking here.</p>
            <Link href="/" className="mt-6 inline-block rounded-2xl bg-yellow-300 px-6 py-4 font-black">Start order</Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5 hover:bg-yellow-50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-black">#{order.id}</p>
                    <p className="font-bold text-gray-500">{order.restaurantName} · {order.items.length} items</p>
                  </div>
                  <p className="text-xl font-black">{formatCurrencyUZS(order.total)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
