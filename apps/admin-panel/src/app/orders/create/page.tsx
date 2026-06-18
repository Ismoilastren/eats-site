'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from '@repo/firebase-config';
import { db } from '@repo/firebase-config';
import { COLLECTIONS, formatCurrencyUZS } from '@repo/shared-types';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { writeAdminAuditLog } from '@/lib/auditLog';

type BranchOption = {
  id: string;
  name: string;
  brandName: string;
  branchName: string;
  address: string;
  deliveryFee: number;
  location?: { latitude: number; longitude: number };
};

const TASHKENT_CENTER = { latitude: 41.311081, longitude: 69.240562 };

export default function CreateOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '+998',
    branchId: '',
    deliveryAddress: '',
    deliveryType: 'delivery',
    source: 'operator',
    paymentMethod: 'cash',
    itemName: '',
    itemQty: 1,
    itemPrice: 0,
    deliveryFee: 10000,
    comments: '',
  });

  useEffect(() => {
    async function loadBranches() {
      const snapshot = await getDocs(collection(db, COLLECTIONS.RESTAURANTS));
      const rows = snapshot.docs.map((item) => {
        const data = item.data() as Record<string, any>;
        return {
          id: item.id,
          name: data.name || item.id,
          brandName: data.brandName || data.name || item.id,
          branchName: data.branchName || 'Main branch',
          address: data.address || '',
          deliveryFee: Number(data.deliveryFee || 10000),
          location: data.location || data.coordinates || data.restaurantLocation,
        } as BranchOption;
      }).filter((branch) => branch.brandName);
      setBranches(rows);
      if (rows[0]) {
        setForm((current) => ({
          ...current,
          branchId: current.branchId || rows[0].id,
          deliveryFee: rows[0].deliveryFee,
        }));
      }
    }
    void loadBranches();
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === form.branchId) || null,
    [branches, form.branchId],
  );

  const subtotal = Math.max(0, Number(form.itemQty || 0) * Number(form.itemPrice || 0));
  const total = subtotal + Number(form.deliveryFee || 0);

  const patchForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.customerName.trim()) return toast.error('Customer name is required.');
    if (!form.customerPhone.trim() || form.customerPhone.length < 9) return toast.error('Valid customer phone is required.');
    if (!selectedBranch) return toast.error('Select a branch.');
    if (!form.deliveryAddress.trim() && form.deliveryType === 'delivery') return toast.error('Delivery address is required.');
    if (!form.itemName.trim()) return toast.error('Order item name is required.');
    if (subtotal <= 0) return toast.error('Item quantity and price must be greater than zero.');

    setIsSubmitting(true);
    try {
      const payload = {
        userId: 'admin-created',
        restaurantId: selectedBranch.id,
        branchId: selectedBranch.id,
        brandName: selectedBranch.brandName,
        branchName: selectedBranch.branchName,
        restaurantName: selectedBranch.brandName,
        restaurantAddress: selectedBranch.address,
        restaurantImage: '',
        restaurantLocation: selectedBranch.location || TASHKENT_CENTER,
        courierId: null,
        assignedCourier: null,
        status: 'pending',
        items: [{
          id: `manual_${Date.now()}`,
          name: form.itemName.trim(),
          price: Number(form.itemPrice),
          quantity: Number(form.itemQty),
          imageUrl: '',
        }],
        subtotal,
        deliveryFee: Number(form.deliveryFee || 0),
        totalAmount: total,
        deliveryAddress: form.deliveryAddress.trim(),
        deliveryLocation: TASHKENT_CENTER,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentMethod === 'cash' ? 'pending' : 'unknown',
        deliveryType: form.deliveryType,
        source: form.source,
        operatorName: user?.displayName || user?.email || 'Admin operator',
        adminComment: form.comments.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        estimatedDelivery: null,
        deliveredAt: null,
        cancelledAt: null,
      };

      const created = await addDoc(collection(db, COLLECTIONS.ORDERS), payload);
      await writeAdminAuditLog({
        action: 'order.created',
        entityType: 'order',
        entityId: created.id,
        actorEmail: user?.email,
        actorName: user?.displayName,
        after: {
          status: 'pending',
          totalAmount: total,
          branchId: selectedBranch.id,
          source: form.source,
        },
        metadata: { source: 'admin_manual_order' },
      });
      toast.success('Manual order created.');
      router.push(`/orders/${created.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Operator desk</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Create order</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manual admin order creation with branch, customer, delivery and payment data.</p>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-black text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Creating...' : 'Save order'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Client</h2>
            <div className="mt-4 space-y-4">
              <Input label="Phone" value={form.customerPhone} onChange={(value) => patchForm({ customerPhone: value })} />
              <Input label="Name" value={form.customerName} onChange={(value) => patchForm({ customerName: value })} />
              <Textarea label="Comment to client" value={form.comments} onChange={(value) => patchForm({ comments: value })} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Delivery address</h2>
            <div className="mt-4 space-y-4">
              <Textarea label="Address" value={form.deliveryAddress} onChange={(value) => patchForm({ deliveryAddress: value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="House" value="" onChange={() => undefined} placeholder="Optional" disabled />
                <Input label="Apartment" value="" onChange={() => undefined} placeholder="Optional" disabled />
              </div>
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                Exact map pin picker is the next phase. This form writes a valid order with Tashkent fallback coordinates.
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Branch</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Restaurant branch</span>
                <select
                  value={form.branchId}
                  onChange={(event) => {
                    const branch = branches.find((item) => item.id === event.target.value);
                    patchForm({ branchId: event.target.value, deliveryFee: branch?.deliveryFee || form.deliveryFee });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.brandName} · {branch.branchName}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-900">
                <p className="font-black text-gray-900 dark:text-white">{selectedBranch?.brandName || 'No branch selected'}</p>
                <p className="mt-1 text-gray-500">{selectedBranch?.address || 'Address missing'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Order</h2>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Input label="Item" value={form.itemName} onChange={(value) => patchForm({ itemName: value })} className="col-span-3" />
                <NumberInput label="Qty" value={form.itemQty} onChange={(value) => patchForm({ itemQty: value })} />
                <NumberInput label="Price" value={form.itemPrice} onChange={(value) => patchForm({ itemPrice: value })} className="col-span-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Type" value={form.deliveryType} onChange={(value) => patchForm({ deliveryType: value })} options={[['delivery', 'Delivery'], ['pickup', 'Pickup'], ['hall', 'Hall'], ['aggregator', 'Aggregator']]} />
                <Select label="Source" value={form.source} onChange={(value) => patchForm({ source: value })} options={[['operator', 'Operator'], ['website', 'Website'], ['phone', 'Phone'], ['telegram', 'Telegram'], ['aggregator', 'Aggregator']]} />
                <Select label="Payment" value={form.paymentMethod} onChange={(value) => patchForm({ paymentMethod: value })} options={[['cash', 'Cash'], ['card', 'Card']]} />
                <NumberInput label="Delivery fee" value={form.deliveryFee} onChange={(value) => patchForm({ deliveryFee: value })} />
              </div>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Order summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <SummaryLine label="Subtotal" value={formatCurrencyUZS(subtotal)} />
            <SummaryLine label="Delivery fee" value={formatCurrencyUZS(Number(form.deliveryFee || 0))} />
            <SummaryLine label="Total" value={formatCurrencyUZS(total)} strong />
          </div>
          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-xs font-semibold text-gray-500 dark:bg-gray-900">
            Orders created here are real Firestore orders and will appear in customer/admin tracking and restaurant/courier workflows.
          </div>
        </aside>
      </div>
    </form>
  );
}

function Input({ label, value, onChange, placeholder, disabled, className = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-semibold outline-none focus:border-brand-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}

function NumberInput({ label, value, onChange, className = '' }: { label: string; value: number; onChange: (value: number) => void; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'border-t border-gray-200 pt-3 text-lg font-black dark:border-gray-700' : 'font-semibold'}`}>
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
