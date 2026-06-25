'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { db, collection, query, onSnapshot, doc, updateDoc, getDocs, serverTimestamp } from '@repo/firebase-config';
import { orderBy } from '@repo/firebase-config';
import {
  COLLECTIONS,
  Order,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatus,
  User,
  formatCurrencyUZS,
  formatOrderCode,
  hasAssignedCourier,
  normalizeOrderStatus,
} from '@repo/shared-types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  getCourierId,
  getCourierName,
  getCourierPhone,
  getCourierVehicle,
  isAssignableCourier,
  isRealCourier,
  sortCouriers,
  type AdminCourierRecord,
} from '@/lib/courierFilters';
import { writeAdminAuditLog } from '@/lib/auditLog';

type DeleverOrderTab = {
  id: string;
  label: string;
  statuses: OrderStatus[] | 'all';
};

const ORDER_TABS: DeleverOrderTab[] = [
  { id: 'handoff', label: 'Preorder / Pending', statuses: ['pending'] },
  { id: 'new', label: 'New', statuses: ['accepted'] },
  { id: 'operator_accepted', label: 'Operator accepted', statuses: ['preparing'] },
  { id: 'preparing', label: 'Preparing', statuses: ['ready_for_pickup'] },
  { id: 'courier_on_way', label: 'Courier on way', statuses: ['picked_up', 'on_the_way'] },
  { id: 'completed', label: 'Completed', statuses: ['delivered', 'cancelled', 'rejected'] },
  { id: 'all', label: 'All orders', statuses: 'all' },
];

const STATUS_OPTIONS: Array<OrderStatus | 'all'> = [
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

const STATUS_TIME_LIMIT_MINUTES: Partial<Record<OrderStatus, number>> = {
  pending: 5,
  accepted: 10,
  preparing: 20,
  ready_for_pickup: 10,
  picked_up: 20,
  on_the_way: 35,
};

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

function parseDateFilter(value: string, endOfDay = false): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isInvalidDateFilterValue(value: string): boolean {
  return Boolean(value.trim()) && !parseDateFilter(value);
}

function getOrderSource(order: Order): string {
  return String((order as any).source || (order as any).orderSource || (order as any).platform || 'Website');
}

function getOrderOperator(order: Order): string {
  return String((order as any).operatorName || (order as any).acceptedByName || (order as any).adminName || 'Unassigned operator');
}

function getOrderPaymentStatus(order: Order): string {
  return String((order as any).paymentStatus || (order as any).payment?.status || 'unknown').toLowerCase();
}

function getOrderPaymentMethod(order: Order): string {
  const raw = (order as any).paymentMethod || (order as any).payment;
  if (!raw) return 'unknown';
  if (typeof raw === 'string') return raw.toLowerCase();
  if (typeof raw === 'object') {
    return String(raw.type || raw.method || raw.name || 'unknown').toLowerCase();
  }
  return String(raw).toLowerCase();
}

function getOrderPaymentLabel(order: Order): string {
  const raw = (order as any).paymentMethod || (order as any).payment;
  if (!raw) return 'unknown';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const method = String(raw.type || raw.method || raw.name || 'unknown');
    const details = [raw.brand, raw.last4 ? `••${raw.last4}` : null].filter(Boolean).join(' ');
    return details ? `${method} ${details}` : method;
  }
  return String(raw);
}

function getDeliveryType(order: Order): string {
  return String((order as any).deliveryType || ((order as any).isPickup ? 'Pickup' : 'Delivery'));
}

function getOrderBrandName(order: Order): string {
  return String(order.brandName || order.restaurantName || 'Restaurant').trim();
}

function getOrderBranchName(order: Order): string {
  return String(order.branchName || 'Main branch').trim();
}

function getOrderBranchLabel(order: Order): string {
  const brand = getOrderBrandName(order);
  const branch = getOrderBranchName(order);
  return `${brand} · ${branch}`;
}

function getOrderAgeMinutes(order: Order): number {
  const createdAt = toDate(order.createdAt);
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
}

function getOrderTimerState(order: Order) {
  const status = normalizeOrderStatus(order.status);
  const age = getOrderAgeMinutes(order);
  const limit = STATUS_TIME_LIMIT_MINUTES[status];
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(status);

  if (isTerminal) return { label: 'Closed', tone: 'muted' as const, age, limit };
  if (!limit) return { label: `${age}m`, tone: 'normal' as const, age, limit };
  if (age >= limit) return { label: `${age}m overdue`, tone: 'danger' as const, age, limit };
  if (age >= Math.floor(limit * 0.75)) return { label: `${age}m warning`, tone: 'warning' as const, age, limit };
  return { label: `${age}m`, tone: 'normal' as const, age, limit };
}

function getAvailableStatusActions(order: Order): OrderStatus[] {
  const status = normalizeOrderStatus(order.status);
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['picked_up', 'cancelled'],
    picked_up: ['on_the_way', 'cancelled'],
    on_the_way: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
    rejected: [],
  };
  return transitions[status] || [];
}

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<AdminCourierRecord[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assignModalData, setAssignModalData] = useState<{ orderId: string, currentCourierId: string | null } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
          .filter(isRealCourier)
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
    return Array.from(new Set(orders.map(getOrderBranchLabel).filter(Boolean))).sort();
  }, [orders]);

  const courierOptions = useMemo(() => {
    const names = orders
      .map((order) => order.assignedCourier?.name || order.courierName)
      .filter(Boolean) as string[];
    return Array.from(new Set(names)).sort();
  }, [orders]);

  const operatorOptions = useMemo(() => {
    return Array.from(new Set(orders.map(getOrderOperator).filter(Boolean))).sort();
  }, [orders]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(orders.map(getOrderSource).filter(Boolean))).sort();
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
    const from = parseDateFilter(dateFrom);
    const to = parseDateFilter(dateTo, true);
    const tab = ORDER_TABS.find((item) => item.id === activeTab) || ORDER_TABS[ORDER_TABS.length - 1];
    const q = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const status = normalizeOrderStatus(order.status);
      const createdAt = toDate(order.createdAt);
      const courierName = order.assignedCourier?.name || order.courierName || '';
      const payment = getOrderPaymentMethod(order);
      const paymentStatus = getOrderPaymentStatus(order);
      const operator = getOrderOperator(order);
      const source = getOrderSource(order);
      const deliveryType = getDeliveryType(order).toLowerCase();

      if (tab.statuses !== 'all' && !tab.statuses.includes(status)) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (restaurantFilter !== 'all' && getOrderBranchLabel(order) !== restaurantFilter) return false;
      if (courierFilter === 'unassigned' && hasAssignedCourier(order)) return false;
      if (courierFilter !== 'all' && courierFilter !== 'unassigned' && courierName !== courierFilter) return false;
      if (operatorFilter !== 'all' && operator !== operatorFilter) return false;
      if (sourceFilter !== 'all' && source !== sourceFilter) return false;
      if (paymentFilter !== 'all' && payment !== paymentFilter) return false;
      if (paymentStatusFilter !== 'all' && paymentStatus !== paymentStatusFilter) return false;
      if (deliveryTypeFilter !== 'all' && deliveryType !== deliveryTypeFilter) return false;
      if ((from || to) && !createdAt) return false;
      if (from && createdAt && createdAt < from) return false;
      if (to && createdAt && createdAt > to) return false;
      if (q) {
        const searchable = [
          order.id,
          order.customerName,
          order.customerPhone,
          order.restaurantName,
          order.brandName,
          order.branchName,
          courierName,
          operator,
          source,
          status,
          payment,
          paymentStatus,
          order.deliveryAddress,
          (order as any).posOrderId,
          (order as any).externalOrderId,
        ];
        if (!searchable.some((value) => String(value || '').toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [
    activeTab,
    orders,
    statusFilter,
    restaurantFilter,
    courierFilter,
    operatorFilter,
    sourceFilter,
    paymentFilter,
    paymentStatusFilter,
    deliveryTypeFilter,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  const isDateRangeInvalid = useMemo(() => {
    const from = parseDateFilter(dateFrom);
    const to = parseDateFilter(dateTo, true);
    return Boolean(from && to && from > to);
  }, [dateFrom, dateTo]);

  const hasDateFilter = Boolean(dateFrom.trim() || dateTo.trim());
  const hasInvalidDateFormat = isInvalidDateFilterValue(dateFrom) || isInvalidDateFilterValue(dateTo);
  const visibleOrders = isDateRangeInvalid || hasInvalidDateFormat ? [] : filteredOrders;

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
      await writeAdminAuditLog({
        action: 'order.status_changed',
        entityType: 'order',
        entityId: orderId,
        actorEmail: user?.email,
        actorName: user?.displayName,
        before: { status: currentStatus },
        after: { status: nextStatus },
        metadata: { source: 'admin_orders_table' },
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
      await writeAdminAuditLog({
        action: 'order.courier_assigned',
        entityType: 'order',
        entityId: assignModalData.orderId,
        actorEmail: user?.email,
        actorName: user?.displayName,
        after: {
          courierId,
          courierName,
          courierPhone,
          vehicle,
          vehicleType,
        },
        metadata: { source: 'admin_orders_table' },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Dispatch center</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Delever-style live order control: tabs, timers, branch/operator/courier filters, assignment and status actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/orders/dispatch"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            Show on map
          </Link>
          <Link
            href="/orders/create"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600"
          >
            + Create order
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {ORDER_TABS.map((tab) => {
            const count = tab.statuses === 'all'
              ? statusSummary.all || 0
              : tab.statuses.reduce((sum, status) => sum + (statusSummary[status] || 0), 0);
            return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {tab.label} <span className="opacity-75">({count})</span>
            </button>
          );})}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search ID, POS, customer..."
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          />
          <select
            value={restaurantFilter}
            onChange={(event) => setRestaurantFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All brands / branches</option>
            {restaurantOptions.map((restaurant) => (
              <option key={restaurant} value={restaurant}>{restaurant}</option>
            ))}
          </select>
          <select
            value={operatorFilter}
            onChange={(event) => setOperatorFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All operators</option>
            {operatorOptions.map((operator) => (
              <option key={operator} value={operator}>{operator}</option>
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
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All sources</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status === 'all' ? 'All statuses' : ORDER_STATUS_LABELS[status]}</option>
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
            value={paymentStatusFilter}
            onChange={(event) => setPaymentStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All payment statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Payment pending</option>
            <option value="failed">Payment failed</option>
            <option value="unknown">Unknown payment</option>
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
            max={dateTo || undefined}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none [color-scheme:light] focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:[color-scheme:dark]"
            aria-label="Orders from date"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              min={dateFrom || undefined}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none [color-scheme:light] focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:[color-scheme:dark]"
              aria-label="Orders to date"
            />
            {hasDateFilter ? (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span>
            Showing {visibleOrders.length} of {orders.length} orders
            {hasDateFilter ? ' · Date filter active' : ''}
          </span>
          <span>Sources: {Array.from(new Set(visibleOrders.map(getOrderSource))).join(', ') || 'None'}</span>
        </div>
        {hasInvalidDateFormat ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            Select dates from the calendar.
          </div>
        ) : null}
        {isDateRangeInvalid ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            From date cannot be later than To date.
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-black uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Timer</th>
                  <th className="px-4 py-3">Courier</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3">Type/source</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status action</th>
                  <th className="px-4 py-3 text-right">More</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {visibleOrders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-sm font-semibold text-gray-500">
                      No orders match these filters.
                    </td>
                  </tr>
                ) : visibleOrders.map((order, index) => {
                  const status = normalizeOrderStatus(order.status);
                  const realUser = allUsers[order.userId];
                  const displayName = order.customerName || (realUser as any)?.fullName || realUser?.displayName || 'Unknown user';
                  const assignedCourier = order.assignedCourier;
                  const assignedCourierId = assignedCourier?.id || order.courierId;
                  const timer = getOrderTimerState(order);
                  const statusActions = getAvailableStatusActions(order);
                  return (
                    <tr
                      key={order.id}
                      className={`text-sm hover:bg-gray-50 dark:hover:bg-gray-900 ${
                        timer.tone === 'danger' ? 'bg-red-50/70 dark:bg-red-950/20' : timer.tone === 'warning' ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="px-4 py-4 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-gray-900 dark:text-white">{displayName}</p>
                        <p className="text-xs font-semibold text-gray-500">{order.customerPhone || 'No phone'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => router.push(`/orders/${order.id}`)}
                          className="font-mono text-sm font-black text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {formatOrderCode(order.id)}
                        </button>
                        <p className="text-xs text-gray-500">{(order as any).posOrderId || (order as any).externalOrderId || 'No POS ID'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${
                          timer.tone === 'danger' ? 'bg-red-100 text-red-700' : timer.tone === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {timer.label}
                        </span>
                        {timer.limit ? <p className="mt-1 text-[11px] font-semibold text-gray-500">limit {timer.limit}m</p> : null}
                      </td>
                      <td className="px-4 py-4">
                        {assignedCourierId ? (
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{assignedCourier?.name || order.courierName || 'Courier'}</p>
                            <p className="text-xs text-gray-500">{assignedCourier?.phone || order.courierPhone || 'No phone'}</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAssignModalData({ orderId: order.id, currentCourierId: null })}
                            className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-black text-brand-700 hover:bg-brand-100"
                          >
                            Assign
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-gray-900 dark:text-white">{getOrderBrandName(order)}</p>
                        <p className="text-xs text-gray-500">{getOrderBranchName(order)}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-200">{getOrderOperator(order)}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-gray-900 dark:text-white">{getDeliveryType(order)}</p>
                        <p className="text-xs text-gray-500">{getOrderSource(order)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-gray-900 dark:text-white">{formatCurrencyUZS(order.totalAmount || 0)}</p>
                        <p className="text-xs text-gray-500">{getOrderPaymentLabel(order)} · {getOrderPaymentStatus(order)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <span
                            className="inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-black"
                            style={{
                              backgroundColor: `${ORDER_STATUS_COLORS[status] || '#ccc'}20`,
                              color: ORDER_STATUS_COLORS[status] || '#333',
                              borderColor: `${ORDER_STATUS_COLORS[status] || '#ccc'}50`,
                            }}
                          >
                            {ORDER_STATUS_LABELS[status] || status}
                          </span>
                          {statusActions.length ? (
                            <select
                              value=""
                              onChange={(event) => {
                                if (event.target.value) {
                                  void handleUpdateStatus(order.id, event.target.value as OrderStatus, assignedCourierId);
                                  event.target.value = '';
                                }
                              }}
                              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-bold text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                            >
                              <option value="">Change status...</option>
                              {statusActions.map((action) => (
                                <option key={action} value={action}>{ORDER_STATUS_LABELS[action]}</option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => router.push(`/orders/${order.id}`)}
                          className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
