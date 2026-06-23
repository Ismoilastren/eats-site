'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from '@repo/firebase-config';
import { COLLECTIONS, normalizeCanonicalVehicleType, normalizeOrderStatus } from '@repo/shared-types';
import type { Courier, VehicleType } from '@repo/shared-types';
import toast from 'react-hot-toast';
import {
  getCourierId,
  getCourierInvalidReason,
  getCourierName,
  getCourierPhone,
  getCourierStatus,
  isAssignableCourier,
  isRealCourier,
  sortCouriers,
  type AdminCourierRecord,
} from '@/lib/courierFilters';

const StatusBadge = ({ online, status }: { online?: boolean; status?: string }) => {
  const normalizedStatus = status === 'busy' ? 'busy' : status === 'archived' ? 'archived' : status === 'inactive' ? 'inactive' : online ? 'online' : 'offline';
  const active = normalizedStatus === 'online' || normalizedStatus === 'busy';
  return (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
    normalizedStatus === 'busy'
      ? 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30'
      : normalizedStatus === 'archived'
      ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30'
      : normalizedStatus === 'inactive'
      ? 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-500/30'
      : active
      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
      : 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
  }`}>
    <span className={`h-1.5 w-1.5 rounded-full ${normalizedStatus === 'busy' ? 'bg-orange-500' : active ? 'bg-emerald-500 dark:bg-emerald-400' : normalizedStatus === 'inactive' || normalizedStatus === 'archived' ? 'bg-gray-400' : 'bg-red-500 dark:bg-red-400'}`} />
    {normalizedStatus}
  </span>
  );
};

const vehicleEmoji: Record<string, string> = {
  bicycle: '🚲',
  motorbike: '🏍️',
  scooter: '🛵',
  motorcycle: '🏍️',
  car: '🚗',
  foot: '🚶',
};

const isArchivedCourier = (courier: AdminCourierRecord) => {
  const status = String(courier.status || '').trim().toLowerCase();
  return courier.archived === true || courier.deleted === true || courier.isDeleted === true || status === 'archived';
};

const vehicleFormHints: Record<string, { brandLabel: string; brandPlaceholder: string; plateLabel: string; platePlaceholder: string }> = {
  car: {
    brandLabel: 'Car Brand (Optional)',
    brandPlaceholder: 'Chevrolet, KIA, BYD…',
    plateLabel: 'License Plate',
    platePlaceholder: '01 A 123 AA',
  },
  motorbike: {
    brandLabel: 'Motorbike Brand (Optional)',
    brandPlaceholder: 'Yamaha, Lifan, Bajaj…',
    plateLabel: 'Motorbike Plate (Optional)',
    platePlaceholder: '01 123 AB',
  },
};

const MOTORBIKE_PLATE_PATTERN = /^\d{2}\s\d{3}\s[A-Z]{2}$/;

const formatMotorbikePlateInput = (value: string) => {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  const region = raw.slice(0, 2).replace(/\D/g, '');
  const digits = raw.slice(2, 5).replace(/\D/g, '');
  const letters = raw.slice(5, 7).replace(/[^A-Z]/g, '');
  const parts = [region, digits, letters].filter(Boolean);
  return parts.join(' ');
};

const formatPlateInput = (value: string, vehicleType: VehicleType) => {
  const normalizedVehicleType = normalizeCanonicalVehicleType(vehicleType);
  if (normalizedVehicleType === 'motorbike') return formatMotorbikePlateInput(value);
  return value.toUpperCase();
};

const normalizePlateValue = (value: string, vehicleType: VehicleType) => {
  const normalizedVehicleType = normalizeCanonicalVehicleType(vehicleType);
  if (normalizedVehicleType === 'motorbike') return formatMotorbikePlateInput(value).trim();
  return value.toUpperCase().trim();
};

const validateVehiclePlate = (vehicleType: VehicleType, plate: string) => {
  const normalizedVehicleType = normalizeCanonicalVehicleType(vehicleType);
  const normalizedPlate = normalizePlateValue(plate, vehicleType);
  if (normalizedVehicleType === 'motorbike' && normalizedPlate && !MOTORBIKE_PLATE_PATTERN.test(normalizedPlate)) {
    return 'Motorbike plate must be region code + 3 digits + 2 letters, for example 01 123 AB';
  }
  return '';
};

// ─── SHARED COMPONENTS (EXTRACTED TO PREVENT REMOUNTING/FOCUS LOSS) ───
const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-white transition-colors text-xl leading-none"
        >
          ×
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const FormFields = ({
  form,
  setForm,
  isSubmitting,
  onSubmit,
  submitLabel,
  onClose,
}: {
  form: any;
  setForm: (val: any) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onClose: () => void;
}) => {
  const vehicleType = normalizeCanonicalVehicleType(form.vehicleType);
  const showPlateFields = vehicleType === 'car' || vehicleType === 'motorbike';
  const hints = vehicleFormHints[vehicleType] || vehicleFormHints.car;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Full Name</label>
      <input
        required
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        placeholder="Sardor Toirov"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
      />
    </div>
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Phone</label>
      <input
        required
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        placeholder="+998901234567"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
      />
    </div>
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Vehicle Type</label>
      <select
        value={form.vehicleType}
        onChange={(e) => {
          const nextVehicleType = e.target.value as VehicleType;
          const normalizedNextVehicleType = normalizeCanonicalVehicleType(nextVehicleType);
          const keepsVehicleDetails = normalizedNextVehicleType === 'car' || normalizedNextVehicleType === 'motorbike';
          setForm({
            ...form,
            vehicleType: nextVehicleType,
            vehicleBrand: keepsVehicleDetails ? form.vehicleBrand : '',
            licensePlate: keepsVehicleDetails ? form.licensePlate : '',
          });
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
      >
        <option value="bicycle">🚲 Bicycle</option>
        <option value="scooter">🛵 Scooter</option>
        <option value="motorbike">🏍️ Motorbike</option>
        <option value="car">🚗 Car</option>
      </select>
    </div>
    {showPlateFields && (
      <>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">{hints.brandLabel}</label>
          <input
            value={form.vehicleBrand}
            onChange={(e) => setForm({ ...form, vehicleBrand: e.target.value })}
            placeholder={hints.brandPlaceholder}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">{hints.plateLabel}</label>
          <input
            value={form.licensePlate}
            onChange={(e) => setForm({ ...form, licensePlate: formatPlateInput(e.target.value, form.vehicleType) })}
            placeholder={hints.platePlaceholder}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm uppercase text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
          />
          {vehicleType === 'motorbike' && (
            <p className="mt-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400">
              Format: region code, 3 digits, 2 letters. Example: 01 123 AB.
            </p>
          )}
        </div>
      </>
    )}
    <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-slate-700 pt-4 mt-6">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-sm"
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </div>
    </form>
  );
};

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<AdminCourierRecord[]>([]);
  const [courierOrders, setCourierOrders] = useState<Array<Record<string, unknown>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [deleteCourierId, setDeleteCourierId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    vehicleType: 'bicycle' as VehicleType,
    licensePlate: '',
    vehicleBrand: '',
  });

  // ─── REAL-TIME SYNC ───
  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.COURIERS));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Courier[] = [];
      snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Courier));
      setCouriers((data as AdminCourierRecord[]).sort(sortCouriers));
      setIsLoading(false);
    }, (err) => {
      console.error('Couriers fetch error:', err);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.ORDERS)),
      (snapshot) => {
        setCourierOrders(snapshot.docs.map((order) => ({
          id: order.id,
          ...order.data(),
        })));
      },
      (error) => {
        console.error('Courier order metrics fetch error:', error);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setViewMode(params.get('view') === 'archived' ? 'archived' : 'active');
  }, []);

  const courierMetrics = useMemo(() => {
    const metrics = new Map<string, { completedOrders: number; deliveryEarnings: number }>();
    courierOrders.forEach((order) => {
      if (normalizeOrderStatus(String(order.status || '')) !== 'delivered') return;
      const assigned = order.assignedCourier as { id?: unknown } | null | undefined;
      const courierId = String(assigned?.id || order.courierId || '');
      if (!courierId) return;
      const current = metrics.get(courierId) || { completedOrders: 0, deliveryEarnings: 0 };
      const fee = Number(order.deliveryFee || 0);
      current.completedOrders += 1;
      current.deliveryEarnings += Number.isFinite(fee) ? fee : 0;
      metrics.set(courierId, current);
    });
    return metrics;
  }, [courierOrders]);

  // ─── COPY ID ───
  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      toast.success('Courier ID copied to clipboard!', { icon: '📋' });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ─── ADD COURIER ───
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || form.fullName.trim().split(' ').length < 2) {
      toast.error('Enter full name (First and Last)');
      return;
    }
    if (!/^\+998\d{9}$/.test(form.phone.replace(/\s/g, ''))) {
      toast.error('Phone must be +998XXXXXXXXX format');
      return;
    }
    const plateError = validateVehiclePlate(form.vehicleType, form.licensePlate);
    if (plateError) {
      toast.error(plateError);
      return;
    }
    setIsSubmitting(true);
    try {
      const newId = 'courier_' + Date.now().toString();
      const vehicleType = normalizeCanonicalVehicleType(form.vehicleType);
      const keepsVehicleDetails = vehicleType === 'car' || vehicleType === 'motorbike';
      const licensePlate = keepsVehicleDetails ? normalizePlateValue(form.licensePlate, form.vehicleType) : '';
      const vehicleBrand = keepsVehicleDetails ? form.vehicleBrand.trim() : '';
      const data: any = {
        id: newId,
        uid: newId,
        name: form.fullName.trim(),
        fullName: form.fullName.trim(),
        displayName: form.fullName.trim(),
        phone: form.phone.trim(),
        vehicleType,
        vehicleName: vehicleBrand || null,
        plateNumber: licensePlate || null,
        active: true,
        isActive: true,
        archived: false,
        deleted: false,
        isDeleted: false,
        isTest: false,
        isDemo: false,
        status: 'offline',
        isOnline: false,
        isAvailable: false,
        currentOrderId: null,
        currentLocation: null,
        completedOrders: 0,
        deliveries: 0,
        totalDeliveries: 0,
        totalEarnings: 0,
        todayEarnings: 0,
        weeklyEarnings: 0,
        todayDeliveries: 0,
        rating: 5.0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      };
      if (keepsVehicleDetails) {
        if (licensePlate) data.licensePlate = licensePlate;
        if (vehicleBrand) data.vehicleBrand = vehicleBrand;
      }
      await setDoc(doc(db, COLLECTIONS.COURIERS, newId), data);
      setSearch('');
      setCopiedId(newId);
      toast.success('Courier created and visible in fleet. It becomes assignable after courier app login/online status.', { duration: 7000 });
      setShowAddModal(false);
      resetForm();
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create courier');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── EDIT COURIER ───
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourier) return;
    const plateError = validateVehiclePlate(form.vehicleType, form.licensePlate);
    if (plateError) {
      toast.error(plateError);
      return;
    }
    setIsSubmitting(true);
    try {
      const vehicleType = normalizeCanonicalVehicleType(form.vehicleType);
      const keepsVehicleDetails = vehicleType === 'car' || vehicleType === 'motorbike';
      const licensePlate = keepsVehicleDetails ? normalizePlateValue(form.licensePlate, form.vehicleType) : '';
      const vehicleBrand = keepsVehicleDetails ? form.vehicleBrand.trim() : '';
      const updates: any = {
        name: form.fullName.trim(),
        fullName: form.fullName.trim(),
        displayName: form.fullName.trim(),
        phone: form.phone.trim(),
        vehicleType,
        vehicleName: vehicleBrand || null,
        plateNumber: licensePlate || null,
        updatedAt: serverTimestamp(),
      };
      updates.licensePlate = licensePlate || null;
      updates.vehicleBrand = vehicleBrand || null;
      await updateDoc(doc(db, COLLECTIONS.COURIERS, selectedCourier.id), updates);
      toast.success('Courier updated!');
      setShowEditModal(false);
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── DELETE COURIER ───
  const handleDelete = async () => {
    if (!deleteCourierId) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.COURIERS, deleteCourierId), {
        archived: true,
        isActive: false,
        isAvailable: false,
        isOnline: false,
        status: 'inactive',
        currentOrderId: null,
        updatedAt: serverTimestamp(),
      });
      toast.success('Courier archived');
    } catch (err) {
      toast.error('Delete failed');
    } finally {
      setDeleteCourierId(null);
    }
  };

  const handleRestore = async (courierId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.COURIERS, courierId), {
        archived: false,
        deleted: false,
        isDeleted: false,
        active: true,
        isActive: true,
        isAvailable: false,
        isOnline: false,
        status: 'offline',
        currentOrderId: null,
        updatedAt: serverTimestamp(),
      });
      toast.success('Courier restored to fleet');
    } catch (err) {
      toast.error('Restore failed');
    }
  };

  const switchViewMode = (nextMode: 'active' | 'archived') => {
    setViewMode(nextMode);
    const url = new URL(window.location.href);
    if (nextMode === 'archived') {
      url.searchParams.set('view', 'archived');
    } else {
      url.searchParams.delete('view');
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  };

  const resetForm = () =>
    setForm({ fullName: '', phone: '', vehicleType: 'bicycle', licensePlate: '', vehicleBrand: '' });

  const openEdit = (courier: AdminCourierRecord) => {
    setSelectedCourier(courier as Courier);
    setForm({
      fullName: (courier as any).fullName || courier.displayName || '',
      phone: courier.phone || '',
      vehicleType: normalizeCanonicalVehicleType(courier.vehicleType),
      licensePlate: courier.plateNumber || courier.licensePlate || '',
      vehicleBrand: courier.vehicleName || courier.vehicleBrand || '',
    });
    setShowEditModal(true);
  };

  const archivedCouriers = couriers.filter(isArchivedCourier);
  const productionCouriers = couriers.filter((courier) => isRealCourier(courier) && !isArchivedCourier(courier));
  const hiddenRecordsCount = couriers.length - productionCouriers.length;
  const nonArchivedHiddenCount = Math.max(hiddenRecordsCount - archivedCouriers.length, 0);
  const visibleCouriers = viewMode === 'archived' ? archivedCouriers : productionCouriers;
  const selectedCourierIsArchived = selectedCourier ? isArchivedCourier(selectedCourier as AdminCourierRecord) : false;
  const filtered = visibleCouriers.filter((c) => {
    const name = getCourierName(c).toLowerCase();
    const phone = getCourierPhone(c).toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || phone.includes(q) || c.id.toLowerCase().includes(q);
  });



  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Courier Fleet</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Dispatch Center — Create couriers and copy their ID to send via messaging apps.
          </p>
          <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
            New couriers appear immediately as offline. Assignment only shows online, available, non-busy couriers.
          </p>
          {hiddenRecordsCount > 0 && (
            <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              {archivedCouriers.length} archived and {nonArchivedHiddenCount} invalid/test courier record{hiddenRecordsCount === 1 ? '' : 's'} hidden from production fleet.
            </p>
          )}
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 transition-colors"
        >
          <span className="text-base leading-none">+</span> Add New Courier
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => switchViewMode('active')}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
            viewMode === 'active'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
          }`}
        >
          Active fleet ({productionCouriers.length})
        </button>
        <button
          type="button"
          onClick={() => switchViewMode('archived')}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
            viewMode === 'archived'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
          }`}
        >
          Archive ({archivedCouriers.length})
        </button>
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">
          {viewMode === 'archived'
            ? 'Archived couriers stay out of assignment until restored.'
            : 'Only active production couriers appear in dispatcher assignment.'}
        </p>
      </div>

      {/* ─── Stats Bar ─── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: viewMode === 'archived' ? 'Archived Couriers' : 'Total Couriers', value: visibleCouriers.length, color: 'text-gray-900 dark:text-white' },
          { label: 'Online Now', value: visibleCouriers.filter((c) => ['online', 'busy'].includes(getCourierStatus(c))).length, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Offline', value: visibleCouriers.filter((c) => getCourierStatus(c) === 'offline').length, color: 'text-red-600 dark:text-red-400' },
          { label: viewMode === 'archived' ? 'Restorable' : 'Available', value: viewMode === 'archived' ? archivedCouriers.length : visibleCouriers.filter(isAssignableCourier).length, color: 'text-orange-600 dark:text-orange-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">{stat.label}</p>
            <p className={`mt-1.5 text-3xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Search ─── */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 pointer-events-none">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or ID..."
          className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
        />
      </div>

      {/* ─── Table ─── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-500 dark:text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mr-3" />
            Loading fleet…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-5xl mb-4">🚴</p>
            <p className="text-gray-700 dark:text-slate-300 font-semibold">
              {viewMode === 'archived' ? 'No archived couriers found' : 'No couriers found'}
            </p>
            <p className="text-gray-500 dark:text-slate-500 text-sm mt-1">
              {viewMode === 'archived' ? 'Archived couriers will appear here after you archive them.' : 'Create your first courier using the button above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/60">
                <tr>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-slate-400">Courier</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-slate-400">
                    Courier ID
                    <span className="ml-2 text-orange-500 dark:text-orange-400 normal-case tracking-normal font-semibold">(Send this to courier)</span>
                  </th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-slate-400">Vehicle</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-slate-400">Earnings</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-slate-400">Status</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700/60">
                {filtered.map((courier) => {
                  const name = getCourierName(courier);
                  const phone = getCourierPhone(courier);
                  const status = getCourierStatus(courier);
                  const invalidReason = getCourierInvalidReason(courier);
                  const isArchived = isArchivedCourier(courier);
                  const isCopied = copiedId === getCourierId(courier);
                  const isConnected = typeof (courier as any).sessionUid === 'string' && Boolean((courier as any).sessionUid);
                  const metrics = courierMetrics.get(courier.id) || { completedOrders: 0, deliveryEarnings: 0 };
                  return (
                    <tr key={getCourierId(courier)} className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/40">

                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-bold text-base border border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{phone}</p>
                            {invalidReason ? (
                              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{invalidReason}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* ─── COPY ID COLUMN ─── */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <code className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs text-orange-600 font-mono border border-gray-200 max-w-[170px] truncate dark:bg-slate-900 dark:text-orange-300 dark:border-slate-700" title={getCourierId(courier)}>
                            {getCourierId(courier)}
                          </code>
                          <button
                            onClick={() => copyId(getCourierId(courier))}
                            title="Copy Courier ID"
                            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                              isCopied
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40'
                                : 'bg-orange-100 text-orange-600 border border-orange-200 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30 dark:hover:bg-orange-500/25'
                            }`}
                          >
                            {isCopied ? '✅ Copied!' : '📋 Copy ID'}
                          </button>
                        </div>
                        <p className={`mt-1.5 text-xs font-semibold ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-400'}`}>
                          {isConnected ? 'Connected to courier app' : 'Not connected yet'}
                        </p>
                      </td>

                      {/* Vehicle */}
                      <td className="px-5 py-4">
                        <span className="text-gray-800 dark:text-slate-300 capitalize">
                          {vehicleEmoji[courier.vehicleType || 'bicycle']} {courier.vehicleName || courier.vehicleBrand || courier.vehicleType || 'N/A'}
                        </span>
                        {(courier.plateNumber || courier.licensePlate) && (
                          <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{courier.plateNumber || courier.licensePlate}</p>
                        )}
                      </td>

                      {/* Earnings */}
                      <td className="px-5 py-4">
                        <p className="text-emerald-600 dark:text-emerald-400 font-bold">
                          Earned: {metrics.deliveryEarnings.toLocaleString('ru-RU')} UZS
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500">
                          {metrics.completedOrders} delivered · Admin balance: {Number(courier.totalEarnings || 0).toLocaleString('ru-RU')} UZS
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge online={status === 'online' || status === 'busy'} status={isArchived ? 'archived' : status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedCourier(courier as Courier); setShowViewModal(true); }}
                            className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openEdit(courier)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-colors dark:border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25"
                          >
                            Edit
                          </button>
                          {isArchived ? (
                            <button
                              onClick={() => handleRestore(getCourierId(courier))}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/25"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => setDeleteCourierId(getCourierId(courier))}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors dark:border-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── ADD MODAL ─── */}
      {showAddModal && (
        <Modal title="Add New Courier" onClose={() => { setShowAddModal(false); resetForm(); }}>
          <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">📋 After creating, copy the Courier ID</p>
            <p className="text-xs text-orange-600/80 dark:text-orange-300/70 mt-1">
              The generated ID appears in the table immediately. The courier app uses Firebase Anonymous Auth to pair this ID, then the courier must go online before assignment.
            </p>
          </div>
          <FormFields form={form} setForm={setForm} isSubmitting={isSubmitting} onSubmit={handleAdd} submitLabel="Create Courier" onClose={() => { setShowAddModal(false); resetForm(); }} />
        </Modal>
      )}

      {/* ─── EDIT MODAL ─── */}
      {showEditModal && (
        <Modal title="Edit Courier" onClose={() => { setShowEditModal(false); resetForm(); }}>
          <FormFields form={form} setForm={setForm} isSubmitting={isSubmitting} onSubmit={handleEdit} submitLabel="Save Changes" onClose={() => { setShowEditModal(false); resetForm(); }} />
        </Modal>
      )}

      {/* ─── VIEW MODAL ─── */}
      {showViewModal && selectedCourier && (
        <Modal title="Courier Profile" onClose={() => setShowViewModal(false)}>
          {/* Avatar + Name */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-2xl font-black border-2 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30">
              {((selectedCourier as any).fullName || selectedCourier.displayName || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedCourier.name || selectedCourier.fullName || selectedCourier.displayName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{selectedCourier.phone}</p>
              <div className="mt-1.5">
                <StatusBadge online={selectedCourier.isOnline} status={selectedCourierIsArchived ? 'archived' : selectedCourier.status} />
              </div>
            </div>
          </div>

          {/* Courier ID with Copy */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">Courier ID (Login Key)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-orange-600 dark:text-orange-300 font-mono break-all">{selectedCourier.id}</code>
              <button
                onClick={() => copyId(selectedCourier.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all border ${
                  copiedId === selectedCourier.id
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40'
                    : 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30 dark:hover:bg-orange-500/25'
                }`}
              >
                {copiedId === selectedCourier.id ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: 'Admin Balance', value: `${Number(selectedCourier.totalEarnings || 0).toLocaleString('ru-RU')} UZS`, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: "Today's Earnings", value: `${Number(selectedCourier.todayEarnings || 0).toLocaleString('ru-RU')} UZS`, color: 'text-orange-600 dark:text-orange-400' },
              { label: 'Delivered Orders', value: String(courierMetrics.get(selectedCourier.id)?.completedOrders || 0), color: 'text-gray-900 dark:text-white' },
              { label: 'Rating', value: `★ ${selectedCourier.rating?.toFixed(1) || '5.0'}`, color: 'text-yellow-600 dark:text-yellow-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-700/60">
                <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
                <p className={`text-base font-black mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowViewModal(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              Close
            </button>
            {selectedCourierIsArchived && (
              <button
                onClick={() => { handleRestore(selectedCourier.id); setShowViewModal(false); }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Restore
              </button>
            )}
            <button
              onClick={() => { setShowViewModal(false); openEdit(selectedCourier); }}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
            >
              Edit
            </button>
          </div>
        </Modal>
      )}

      {/* ─── DELETE CONFIRM ─── */}
      {deleteCourierId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Archive Courier?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              This hides the courier from production assignment and fleet views without deleting Firestore data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteCourierId(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
