'use client';
import React, { useState, useEffect } from 'react';
import { DataTable, type ColumnDef } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { db, collection, query, onSnapshot, doc, updateDoc, where, getDocs, serverTimestamp } from '@repo/firebase-config';
import { orderBy } from 'firebase/firestore';
import {
  COLLECTIONS,
  Order,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatus,
  User,
  formatCurrencyUZS,
  getVehicleLabel,
  hasAssignedCourier,
  normalizeOrderStatus,
  normalizeVehicleType,
} from '@repo/shared-types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assignModalData, setAssignModalData] = useState<{ orderId: string, currentCourierId: string | null } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    // Fetch all users to guarantee real-time names
    const fetchAllUsers = async () => {
      try {
        const [snap, courierSnap] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.USERS)),
          getDocs(collection(db, COLLECTIONS.COURIERS)),
        ]);
        const usersObj: Record<string, User> = {};
        const couriersById = new Map<string, any>();
        courierSnap.forEach((d) => {
          couriersById.set(d.id, { ...d.data(), uid: d.id, id: d.id });
        });
        snap.forEach(d => {
            const u = { uid: d.id, ...d.data() } as User;
            usersObj[d.id] = u;
            if (u.role === 'courier' && !couriersById.has(d.id)) {
              couriersById.set(d.id, { ...u, uid: d.id, id: d.id });
            }
        });
        setAllUsers(usersObj);
        setCouriers(Array.from(couriersById.values()));
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
      const courierName = courier?.displayName || courier?.fullName || courier?.name || 'Assigned Courier';
      const courierPhone = courier?.phone || courier?.phoneNumber || '';
      const vehicleType = normalizeVehicleType(courier?.vehicleType || courier?.vehicle || courier?.vehicleBrand);
      const vehicle = [courier?.vehicleBrand, courier?.vehicleModel, courier?.licensePlate].filter(Boolean).join(' ') ||
        courier?.vehicle ||
        getVehicleLabel(vehicleType);

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
        isAvailable: false,
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
            data={orders}
            searchPlaceholder="Search by customer name..."
            searchAccessor={(item, q) => (item.customerName || '').toLowerCase().includes(q) || item.id.toLowerCase().includes(q)}
            onView={(row) => router.push(`/orders/${row.id}`)}
          />
        )}
      </div>

      {assignModalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Assign Courier</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Select a courier to assign to this order.
            </p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
              {couriers.length === 0 ? (
                <p className="text-sm italic text-gray-500 text-center py-4">No couriers found in the system.</p>
              ) : (
                couriers.map(c => (
                  <div 
                    key={c.uid}
                    onClick={() => !isAssigning && handleAssignCourier(c.uid || c.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${assignModalData.currentCourierId === c.uid ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold overflow-hidden">
                        {c.photoURL ? <img src={c.photoURL} alt="" className="w-full h-full object-cover" /> : (c.displayName || c.fullName || 'C')[0]}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{c.displayName || c.fullName || c.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{c.phone || 'No phone'}</p>
                      </div>
                    </div>
                    {assignModalData.currentCourierId === c.uid && (
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
