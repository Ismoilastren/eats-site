'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { db, collection, query, orderBy, limit, onSnapshot } from '@repo/firebase-config';
import { COLLECTIONS, Order } from '@repo/shared-types';

export function RecentOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.ORDERS),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    // Fetch all users to map their real names dynamically
    import('@repo/firebase-config').then(({ getDocs }) => {
        getDocs(collection(db, COLLECTIONS.USERS)).then((snap) => {
            const usersObj: Record<string, any> = {};
            snap.forEach(d => { usersObj[d.id] = d.data(); });
            setAllUsers(usersObj);
        }).catch(err => console.error("Error fetching users:", err));
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(fetchedOrders);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching recent orders:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'delivered': return 'success';
      case 'courier_picked_up': return 'info';
      case 'preparing': return 'warning';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      default: return 'info';
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 p-6 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Latest 5 orders from the platform</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Customer
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Restaurant
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Amount
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Loading recent orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {allUsers[order.userId]?.fullName || allUsers[order.userId]?.displayName || order.customerName || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-500 uppercase font-mono tracking-wider">
                              #{order.id.slice(0, 6)}
                          </span>
                      </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    Multiple Items
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {new Intl.NumberFormat('ru-RU').format(order.totalAmount || 0)} UZS
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <Badge variant={getStatusVariant(order.status)}>
                      {order.status.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {order.createdAt && typeof (order.createdAt as any).toDate === 'function' 
                      ? (order.createdAt as any).toDate().toLocaleString() 
                      : 'Date not available'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
