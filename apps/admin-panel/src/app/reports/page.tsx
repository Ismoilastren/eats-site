'use client';

import React, { useMemo, useState } from 'react';
import { db, collection, getDocs } from '@repo/firebase-config';
import { COLLECTIONS, Order, formatCurrencyUZS, normalizeOrderStatus } from '@repo/shared-types';
import toast from 'react-hot-toast';

type ReportType = 'orders' | 'financial' | 'couriers' | 'restaurants' | 'users';

type ReportDefinition = {
  id: ReportType;
  title: string;
  description: string;
};

const REPORTS: ReportDefinition[] = [
  { id: 'orders', title: 'Orders Report', description: 'Order status, customer, restaurant, payment, courier and date data.' },
  { id: 'financial', title: 'Financial Report', description: 'Delivered revenue, delivery fees, subtotal and cancellation rows.' },
  { id: 'couriers', title: 'Courier Performance', description: 'Courier profile data plus assigned and delivered order counts.' },
  { id: 'restaurants', title: 'Restaurant Performance', description: 'Restaurant catalog status with order count and delivered revenue.' },
  { id: 'users', title: 'Client Growth Report', description: 'Customer/admin user records with registration fields where available.' },
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

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (value instanceof Date) return `"${value.toISOString()}"`;
  if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csvContent = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function orderInDateRange(order: Order, from: string, to: string) {
  const createdAt = toDate(order.createdAt);
  if (!createdAt) return true;
  if (from && createdAt < new Date(`${from}T00:00:00`)) return false;
  if (to && createdAt > new Date(`${to}T23:59:59`)) return false;
  return true;
}

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState<ReportType | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const generateReport = async (type: ReportType) => {
    setIsGenerating(type);
    toast.loading('Reading live Firestore data...', { id: 'report' });

    try {
      const [ordersSnap, usersSnap, restaurantsSnap, couriersSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.ORDERS)),
        getDocs(collection(db, COLLECTIONS.USERS)),
        getDocs(collection(db, COLLECTIONS.RESTAURANTS)),
        getDocs(collection(db, COLLECTIONS.COURIERS)),
      ]);

      const orders = ordersSnap.docs
        .map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }) as Order)
        .filter((order) => orderInDateRange(order, dateFrom, dateTo))
        .filter((order) => statusFilter === 'all' || normalizeOrderStatus(order.status) === statusFilter);

      if (type === 'orders') {
        downloadCsv(
          `orders_report_${today}.csv`,
          ['order_id', 'created_at', 'status', 'customer', 'phone', 'restaurant', 'courier', 'payment', 'subtotal', 'delivery_fee', 'total', 'address'],
          orders.map((order) => [
            order.id,
            toDate(order.createdAt),
            normalizeOrderStatus(order.status),
            order.customerName,
            order.customerPhone,
            order.restaurantName,
            order.assignedCourier?.name || order.courierName || '',
            order.paymentMethod || '',
            order.subtotal || 0,
            order.deliveryFee || 0,
            order.totalAmount || 0,
            order.deliveryAddress,
          ])
        );
      }

      if (type === 'financial') {
        downloadCsv(
          `financial_report_${today}.csv`,
          ['order_id', 'created_at', 'status', 'restaurant', 'subtotal', 'delivery_fee', 'total', 'recognized_revenue'],
          orders.map((order) => {
            const status = normalizeOrderStatus(order.status);
            return [
              order.id,
              toDate(order.createdAt),
              status,
              order.restaurantName,
              order.subtotal || 0,
              order.deliveryFee || 0,
              order.totalAmount || 0,
              status === 'delivered' ? order.totalAmount || 0 : 0,
            ];
          })
        );
      }

      if (type === 'couriers') {
        const rows = couriersSnap.docs.map((documentSnapshot) => {
          const courier = { id: documentSnapshot.id, ...documentSnapshot.data() } as any;
          const courierOrders = orders.filter((order) => order.courierId === courier.id || order.assignedCourier?.id === courier.id);
          const deliveredOrders = courierOrders.filter((order) => normalizeOrderStatus(order.status) === 'delivered');
          return [
            courier.id,
            courier.fullName || courier.name || courier.displayName || '',
            courier.phone || '',
            courier.vehicleType || '',
            courier.vehicleBrand || '',
            courier.licensePlate || '',
            courier.status || '',
            courier.isOnline ?? '',
            courierOrders.length,
            deliveredOrders.length,
          ];
        });
        downloadCsv(
          `courier_performance_${today}.csv`,
          ['courier_id', 'name', 'phone', 'vehicle_type', 'vehicle_brand', 'license_plate', 'status', 'is_online', 'assigned_orders', 'delivered_orders'],
          rows
        );
      }

      if (type === 'restaurants') {
        const rows = restaurantsSnap.docs.map((documentSnapshot) => {
          const restaurant = { id: documentSnapshot.id, ...documentSnapshot.data() } as any;
          const restaurantOrders = orders.filter((order) => order.restaurantId === restaurant.id);
          const deliveredOrders = restaurantOrders.filter((order) => normalizeOrderStatus(order.status) === 'delivered');
          const deliveredRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
          return [
            restaurant.id,
            restaurant.name || '',
            restaurant.cuisine || (Array.isArray(restaurant.cuisines) ? restaurant.cuisines.join(', ') : ''),
            restaurant.address || '',
            restaurant.isActive ?? restaurant.status ?? '',
            restaurant.rating || 0,
            restaurantOrders.length,
            deliveredOrders.length,
            deliveredRevenue,
          ];
        });
        downloadCsv(
          `restaurant_performance_${today}.csv`,
          ['restaurant_id', 'name', 'cuisine', 'address', 'status', 'rating', 'orders', 'delivered_orders', 'delivered_revenue'],
          rows
        );
      }

      if (type === 'users') {
        downloadCsv(
          `client_growth_${today}.csv`,
          ['user_id', 'name', 'email', 'phone', 'role', 'created_at', 'last_login'],
          usersSnap.docs.map((documentSnapshot) => {
            const user = { id: documentSnapshot.id, ...documentSnapshot.data() } as any;
            return [
              user.id,
              user.fullName || user.displayName || user.name || '',
              user.email || '',
              user.phone || user.phoneNumber || '',
              user.role || '',
              toDate(user.createdAt),
              toDate(user.lastLoginAt || user.lastSeenAt),
            ];
          })
        );
      }

      const summary = type === 'financial'
        ? `Delivered revenue in export: ${formatCurrencyUZS(orders.filter((order) => normalizeOrderStatus(order.status) === 'delivered').reduce((sum, order) => sum + Number(order.totalAmount || 0), 0))}`
        : `${orders.length} filtered orders included where applicable.`;
      toast.success(summary, { id: 'report', duration: 5000 });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate report', { id: 'report' });
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Generate filtered CSV exports from live Firestore data.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Report Filters</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            aria-label="Report from date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            aria-label="Report to date"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="preparing">Preparing</option>
            <option value="ready_for_pickup">Ready for Pickup</option>
            <option value="picked_up">Picked Up</option>
            <option value="on_the_way">On the Way</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <div key={report.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{report.title}</h3>
            <p className="mt-2 min-h-12 text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
            <button
              onClick={() => generateReport(report.id)}
              disabled={isGenerating !== null}
              className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating === report.id ? 'Generating...' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
