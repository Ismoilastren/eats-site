'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { DataTable, type ColumnDef } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { db, collection, query, onSnapshot, doc, updateDoc, getDocs, serverTimestamp } from '@repo/firebase-config';
import { orderBy } from 'firebase/firestore';
import {
  COLLECTIONS,
  Order,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatus,
  User,
  formatCurrencyUZS,
  hasAssignedCourier,
  normalizeOrderStatus,
} from '@repo/shared-types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  getCourierId,
  getCourierName,
  getCourierPhone,
  getCourierVehicle,
  isAssignableCourier,
  sortCouriers,
  type AdminCourierRecord,
} from '@/lib/courierFilters';

const STATUS_FILTERS: Array<OrderStatus | 'all'> = [
  'all',
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
  'delivered',
  'cancelled',
  'rejected',
];

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function getOrderSource(order: Order): string {
  return String((order as any).source || (order as any).orderSource || (order as any).platform || 'Website');
}

function getDeliveryType(order: Order): string {
  return String((order as any).deliveryType || ((order as any).isPickup ? 'Pickup' : 'Delivery'));
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<AdminCourierRecord[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assignModalData, setAssignModalData] = useState<{ orderId: string, currentCourierId: string | null } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    // Fetch all users to guarantee real-time names
    const fetchAllUsers = async () => {
      try {
        const [snap, courierSnap] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.USERS)),
          getDocs(collection(db, COLLECTIONS.COURIERS)),
        ]);
        const usersObj: Record<string, User> = {};
        snap.forEach(d => {
            const u = { uid: d.id, ...d.data() } as User;
            usersObj[d.id] = u;
        });
        setAllUsers(usersObj);
        setCouriers(courierSnap.docs
          .map((d) => ({ ...d.data(), uid: d.id, id: d.id } as AdminCourierRecord))
          .sort(sortCouriers));
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
    };
    fetchAllUsers();

    // Fetch Orders real-time
    const q = query(
      collection(db, COLLECTIONS.ORDERS),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const realtimeOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
      })) as Order[];
      setOrders(realtimeOrders); // Table now updates instantly!
      setIsLoading(false);
    }, (error) => {
      console.error("Real-time orders fetch error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const restaurantOptions = useMemo(() => {
    return Array.from(new Set(orders.map((order) => order.restaurantName).filter(Boolean))).sort();
  }, [orders]);

  const courierOptions = useMemo(() => {
    const names = orders
      .map((order) => order.assignedCourier?.name || order.courierName)
      .filter(Boolean) as string[];
    return Array.from(new Set(names)).sort();
  }, [orders]);

  const statusSummary = useMemo(() => {
    return orders.reduce<Record<string, number>>((acc, order) => {
      const status = normalizeOrderStatus(order.status);
      acc[status] = (acc[status] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    }, { all: 0 });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return orders.filter((order) => {
      const status = normalizeOrderStatus(order.status);
      const createdAt = toDate(order.createdAt);
      const courierName = order.assignedCourier?.name || order.courierName || '';
      const payment = order.paymentMethod || 'unknown';

      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (restaurantFilter !== 'all' && order.restaurantName !== restaurantFilter) return false;
      if (courierFilter === 'unassigned' && hasAssignedCourier(order)) return false;
      if (courierFilter !== 'all' && courierFilter !== 'unassigned' && courierName !== courierFilter) return false;
      if (paymentFilter !== 'all' && payment !== paymentFilter) return false;
      if (deliveryTypeFilter !== 'all' && getDeliveryType(order).toLowerCase() !== deliveryTypeFilter) return false;
      if (from && createdAt && createdAt < from) return false;
      if (to && createdAt && createdAt > to) return false;
      return true;
    });
  }, [orders, statusFilter, restaurantFilter, courierFilter, paymentFilter, deliveryTypeFilter, dateFrom, dateTo]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, currentCourierId: string | null | undefined) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    const currentStatus = normalizeOrderStatus(order.status);
    const nextStatus = normalizeOrderStatus(newStatus);
    const courierRequiredStatuses: OrderStatus[] = ['picked_up', 'on_the_way', 'delivered'];

    if (courierRequiredStatuses.includes(nextStatus) && !hasAssignedCourier(order)) {
        toast.error(`Stop! You must assign a courier before changing status to "${ORDER_STATUS_LABELS[newStatus] || newStatus}".`);
        return; 
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.ORDERS, orderId), {
        status: nextStatus,
        ...(nextStatus === 'delivered' ? { deliveredAt: serverTimestamp() } : {}),
        ...(nextStatus === 'cancelled' ? { cancelledAt: serverTimestamp(), cancelReason: 'Cancelled by admin' } : {}),
        updatedAt: serverTimestamp()
      });
      if (
        currentCourierId &&
        ['delivered', 'cancelled'].includes(nextStatus)
      ) {
        await updateDoc(doc(db, COLLECTIONS.COURIERS, currentCourierId), {
          currentOrderId: null,
          status: 'online',
          isOnline: true,
          isAvailable: true,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
      toast.success(`Order status updated to ${ORDER_STATUS_LABELS[nextStatus] || nextStatus}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update status');
    }
  };

  const handleAssignCourier = async (courierId: string) => {
    if (!assignModalData) return;
    setIsAssigning(true);
    try {
      const courier = couriers.find(c => (c.uid || c.id) === courierId);
      if (!isAssignableCourier(courier)) {
        toast.error('This courier is not assignable. Choose an online available courier.');
        return;
      }
      const courierName = getCourierName(courier);
      const courierPhone = getCourierPhone(courier);
      const { vehicle, vehicleType } = getCourierVehicle(courier);

      await updateDoc(doc(db, COLLECTIONS.ORDERS, assignModalData.orderId), {
        courierId: courierId,
        courierName,
        courierPhone,
        assignedCourier: {
          id: courierId,
          name: courierName,
          phone: courierPhone,
          vehicle,
          vehicleType,
        },
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, COLLECTIONS.COURIERS, courierId), {
        currentOrderId: assignModalData.orderId,
        status: 'busy',
        isOnline: true,
        isAvailable: false,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      toast.success('Courier assigned successfully');
      setAssignModalData(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to assign courier');
    } finally {
      setIsAssigning(false);
    }
  };

  const columns: ColumnDef<Order>[] = [
    {
      header: 'Customer',
      accessor: 'customerName',
      cell: (row) => {
        // Ultimate Truth: Look up the real user document by ID
        const realUser = allUsers[row.userId];
        let displayName = (realUser as any)?.fullName || realUser?.displayName || row.customerName;
        
        // Final fallback if it's still Customer or missing
        if (!displayName || displayName === 'Customer') {
             displayName = 'Unknown User';
        }

        return (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{displayName}</p>
            <p className="text-xs text-gray-500 font-mono font-bold tracking-wider">#{row.id.slice(0, 6).toUpperCase()}</p>
          </div>
        );
      },
    },
    {
      header: 'Total Price',
      accessor: 'totalAmount',
      cell: (row) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {formatCurrencyUZS(row.totalAmount || 0)}
        </span>
      ),
    },
    {
      header: 'Assigned Courier',
      accessor: 'courierName',
      cell: (row) => {
        const assignedCourier = row.assignedCourier;
        const assignedCourierId = assignedCourier?.id || row.courierId;
        return (
          <div className="flex items-center gap-2">
          {assignedCourierId ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-100 text-brand-800 text-sm font-bold shadow-sm border border-brand-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              {assignedCourier?.name || row.courierName || 'Courier'}
            </span>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setAssignModalData({ orderId: row.id, currentCourierId: null });
              }}
              className="text-sm font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1 rounded-full border border-brand-200"
            >
              Assign courier
            </button>
          )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => {
        const status = normalizeOrderStatus(row.status);
        return (
        <span
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold shadow-sm border"
          style={{ 
            backgroundColor: `${ORDER_STATUS_COLORS[status] || '#ccc'}20`,
            color: ORDER_STATUS_COLORS[status] || '#333',
            borderColor: `${ORDER_STATUS_COLORS[status] || '#ccc'}50`
          }}
        >
          {status === 'delivered' && <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
          {['picked_up', 'on_the_way'].includes(status) && <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
          {status === 'preparing' && <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"></path></svg>}
          {ORDER_STATUS_LABELS[status] || status}
        </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track and manage all orders. Assign couriers and update statuses.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                statusFilter === status
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {status === 'all' ? 'All' : ORDER_STATUS_LABELS[status]} <span className="opacity-75">({statusSummary[status] || 0})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select
            value={restaurantFilter}
            onChange={(event) => setRestaurantFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All restaurants</option>
            {restaurantOptions.map((restaurant) => (
              <option key={restaurant} value={restaurant}>{restaurant}</option>
            ))}
          </select>
          <select
            value={courierFilter}
            onChange={(event) => setCourierFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All couriers</option>
            <option value="unassigned">Unassigned</option>
            {courierOptions.map((courier) => (
              <option key={courier} value={courier}>{courier}</option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="unknown">Unknown</option>
          </select>
          <select
            value={deliveryTypeFilter}
            onChange={(event) => setDeliveryTypeFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">Delivery + pickup</option>
            <option value="delivery">Delivery</option>
            <option value="pickup">Pickup</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            aria-label="Orders from date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            aria-label="Orders to date"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span>Showing {filteredOrders.length} of {orders.length} orders</span>
          <span>Sources: {Array.from(new Set(filteredOrders.map(getOrderSource))).join(', ') || 'None'}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1">
        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <svg className="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No orders found.</div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredOrders}
            searchPlaceholder="Search by order, customer, phone, restaurant, courier, status..."
            searchAccessor={(item, q) => {
              const searchable = [
                item.id,
                item.customerName,
                item.customerPhone,
                item.restaurantName,
                item.courierName,
                item.assignedCourier?.name,
                item.assignedCourier?.phone,
                item.status,
                item.paymentMethod,
                item.deliveryAddress,
              ];
              return searchable.some((value) => String(value || '').toLowerCase().includes(q));
            }}
            onView={(row) => router.push(`/orders/${row.id}`)}
          />
        )}
      </div>

      {assignModalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Assign Courier</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Select an online, available courier from the live courier collection.
            </p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
              {couriers.filter(isAssignableCourier).length === 0 ? (
                <p className="text-sm italic text-gray-500 text-center py-4">No assignable online couriers found.</p>
              ) : (
                couriers.filter(isAssignableCourier).map(c => (
                  <div 
                    key={getCourierId(c)}
                    onClick={() => !isAssigning && handleAssignCourier(getCourierId(c))}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${assignModalData.currentCourierId === getCourierId(c) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold overflow-hidden">
                        {c.photoURL ? <img src={c.photoURL} alt="" className="w-full h-full object-cover" /> : (getCourierName(c) || 'C')[0]}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{getCourierName(c)}</p>
                        <p className="text-xs text-gray-500">{getCourierPhone(c)}</p>
                      </div>
                    </div>
                    {assignModalData.currentCourierId === getCourierId(c) && (
                      <Badge variant="success">Current</Badge>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setAssignModalData(null)}
                disabled={isAssigning}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
