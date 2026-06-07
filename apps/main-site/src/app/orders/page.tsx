'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Clock, Package } from "lucide-react";
import {
  auth,
  collection,
  db,
  onAuthStateChanged,
  onSnapshot,
  query,
  where,
} from "@repo/firebase-config";
import {
  COLLECTIONS,
  formatCurrencyUZS,
  formatFirestoreDate,
  normalizeOrderStatus,
  Order,
  ORDER_STATUS_LABELS,
} from "@repo/shared-types";

const getStatusColor = (status: string) => {
  switch (normalizeOrderStatus(status)) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'preparing':
      return 'bg-indigo-100 text-indigo-800';
    case 'courier_picked_up':
      return 'bg-blue-100 text-blue-800';
    case 'delivered':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribeOrders: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeOrders) {
        unsubscribeOrders();
        unsubscribeOrders = null;
      }

      if (!user) {
        setOrders([]);
        setIsLoading(false);
        router.push('/auth/login');
        return;
      }

      setIsLoading(true);
      const ordersQuery = query(
        collection(db, COLLECTIONS.ORDERS),
        where('userId', '==', user.uid)
      );

      unsubscribeOrders = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const nextOrders = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Order[];

          nextOrders.sort((a, b) => {
            const dateA = (a.createdAt as any)?.toDate?.() || new Date((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0);
            const dateB = (b.createdAt as any)?.toDate?.() || new Date((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0);
            return dateB.getTime() - dateA.getTime();
          });

          setOrders(nextOrders);
          setIsLoading(false);
        },
        (error) => {
          console.error('Orders subscription failed:', error);
          setIsLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [router]);

  return (
    <div className="pt-28 pb-20 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <h1 className="text-3xl font-bold text-secondary mb-8">Your Orders</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 rounded-2xl bg-white border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
            <Package size={44} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-900">No orders yet</h2>
            <p className="text-gray-500 mt-2">Your live order history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const normalizedStatus = normalizeOrderStatus(order.status);
              return (
                <Link key={order.id} href={`/orders/${order.id}`} className="block">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Order #{order.id.substring(0, 8).toUpperCase()}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} /> {formatFirestoreDate(order.createdAt)}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="font-medium text-gray-900">{formatCurrencyUZS(order.totalAmount)}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{order.items?.length || 0} items</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-gray-100">
                        <div className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                          {normalizedStatus === 'courier_picked_up' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                          {ORDER_STATUS_LABELS[normalizedStatus]}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </div>

                    {normalizedStatus === 'courier_picked_up' && (
                      <div className="mt-4 bg-blue-50/50 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-500">
                          <Clock size={20} />
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Live tracking</div>
                          <div className="font-bold text-gray-900">Courier is on the way</div>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
