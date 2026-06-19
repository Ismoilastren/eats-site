'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, onSnapshot, query, serverTimestamp, where } from '@repo/firebase-config';
import { db } from '@repo/firebase-config';
import { COLLECTIONS, MenuItem, formatCurrencyUZS, isValidCoordinates } from '@repo/shared-types';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { writeAdminAuditLog } from '@/lib/auditLog';
import { RestaurantLocationPicker } from '@/components/restaurants/RestaurantLocationPicker';
import type { RestaurantLocationValue } from '@/lib/restaurantAdmin';

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
const TASHKENT_CENTER_LOCATION: RestaurantLocationValue = {
  address: '',
  lat: TASHKENT_CENTER.latitude,
  lng: TASHKENT_CENTER.longitude,
  source: 'manual',
  coordinatesConfirmed: false,
};

type OrderMenuItem = MenuItem & {
  id: string;
  restaurantId: string;
  branchId?: string;
  source: 'restaurant_dishes' | 'menuItems';
};

const DELIVERY_PRESETS = [
  { label: 'Amir Temur Avenue 14', address: 'Tashkent, Amir Temur Avenue 14', lat: 41.3266, lng: 69.2817 },
  { label: 'Chorsu Bazaar entrance', address: 'Tashkent, Chorsu Bazaar entrance', lat: 41.3261, lng: 69.2358 },
  { label: 'Samarqand Darvoza Street', address: 'Uzbekistan, Tashkent, Samarqand Darvoza Street', lat: 41.3168, lng: 69.2488 },
  { label: 'Mirabad Street 27', address: 'Tashkent, Mirabad Street 27', lat: 41.2958, lng: 69.2831 },
  { label: 'Yunusabad 4', address: 'Tashkent, Yunusabad 4', lat: 41.3672, lng: 69.2892 },
];

function normalizeBranchLocation(input: any): BranchOption['location'] {
  const lat = Number(input?.latitude ?? input?.lat);
  const lng = Number(input?.longitude ?? input?.lng);
  return isValidCoordinates(lat, lng) ? { latitude: lat, longitude: lng } : undefined;
}

function getMenuItemPrice(item: Partial<OrderMenuItem> | Record<string, any>): number {
  const data = item as Record<string, any>;
  const raw = data.price ?? data.priceUzs ?? data.amount ?? data.cost ?? 0;
  const price = Number(raw);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function menuItemKey(item: Pick<OrderMenuItem, 'id' | 'source'>): string {
  return `${item.source}:${item.id}`;
}

function menuBelongsToBranch(item: OrderMenuItem, branch: BranchOption): boolean {
  const itemBrandName = String((item as any).brandName || (item as any).restaurantName || '').trim().toLowerCase();
  const itemBranchName = String((item as any).branchName || '').trim().toLowerCase();
  const branchBrandName = branch.brandName.trim().toLowerCase();
  const branchName = branch.branchName.trim().toLowerCase();
  const exactRestaurant = item.restaurantId === branch.id || item.branchId === branch.id;
  const exactBrand = itemBrandName && itemBrandName === branchBrandName;
  const sameBranchName = !itemBranchName || itemBranchName === branchName || itemBranchName === 'main branch';
  return exactRestaurant || Boolean(exactBrand && sameBranchName);
}

export default function CreateOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [menuItems, setMenuItems] = useState<OrderMenuItem[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<RestaurantLocationValue>(TASHKENT_CENTER_LOCATION);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '+998',
    branchId: '',
    deliveryAddress: '',
    deliveryType: 'delivery',
    source: 'operator',
    paymentMethod: 'cash',
    house: '',
    apartment: '',
    itemKey: '',
    itemId: '',
    itemName: '',
    itemQty: 1,
    itemPrice: 0,
    itemImageUrl: '',
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
          address: data.branchAddress || data.address || data.location?.address || '',
          deliveryFee: Number(data.deliveryFee || 10000),
          location: normalizeBranchLocation(data.location || data.coordinates || data.restaurantLocation),
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

  useEffect(() => {
    if (!selectedBranch) {
      setMenuItems([]);
      return;
    }

    const branch = selectedBranch;
    setIsMenuLoading(true);

    const buckets: Record<string, OrderMenuItem[]> = {
      nested: [],
      restaurant: [],
      branch: [],
      brand: [],
    };

    const publish = () => {
      const seen = new Set<string>();
      const merged = Object.values(buckets).flat().filter((item) => {
        if (!menuBelongsToBranch(item, branch)) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return Boolean(item.name) && item.isAvailable !== false && (item as any).available !== false;
      }).sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || a.name.localeCompare(b.name));

      setMenuItems(merged);
      setForm((current) => {
        const selected = merged.find((item) => menuItemKey(item) === current.itemKey)
          || merged.find((item) => item.id === current.itemId);
        if (selected) {
          return {
            ...current,
            itemKey: menuItemKey(selected),
            itemId: selected.id,
            itemName: selected.name,
            itemPrice: getMenuItemPrice(selected),
            itemImageUrl: selected.imageUrl || '',
            itemQty: Math.max(1, Number(current.itemQty || 1)),
          };
        }
        const first = merged[0];
        if (!first) return { ...current, itemKey: '', itemId: '', itemName: '', itemPrice: 0, itemImageUrl: '', itemQty: Math.max(1, Number(current.itemQty || 1)) };
        return {
          ...current,
          itemKey: menuItemKey(first),
          itemId: first.id,
          itemName: first.name,
          itemPrice: getMenuItemPrice(first),
          itemImageUrl: first.imageUrl || '',
          itemQty: Math.max(1, Number(current.itemQty || 1)),
        };
      });
      setIsMenuLoading(false);
    };

    const handleSnapshotError = (error: unknown) => {
      console.error(error);
      setIsMenuLoading(false);
      toast.error('Failed to load branch menu items.');
    };

    const unsubscribers = [
      onSnapshot(collection(db, COLLECTIONS.RESTAURANTS, branch.id, 'dishes'), (snapshot) => {
        buckets.nested = snapshot.docs.map((documentSnapshot) => ({
          ...documentSnapshot.data(),
          id: documentSnapshot.id,
          restaurantId: branch.id,
          branchId: branch.id,
          source: 'restaurant_dishes' as const,
        })) as OrderMenuItem[];
        publish();
      }, handleSnapshotError),
      onSnapshot(query(collection(db, COLLECTIONS.MENU_ITEMS), where('restaurantId', '==', branch.id)), (snapshot) => {
        buckets.restaurant = snapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data() as Partial<OrderMenuItem>;
          return {
            ...data,
            id: documentSnapshot.id,
            restaurantId: data.restaurantId || branch.id,
            branchId: data.branchId || branch.id,
            source: 'menuItems' as const,
          } as OrderMenuItem;
        });
        publish();
      }, handleSnapshotError),
      onSnapshot(query(collection(db, COLLECTIONS.MENU_ITEMS), where('branchId', '==', branch.id)), (snapshot) => {
        buckets.branch = snapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data() as Partial<OrderMenuItem>;
          return {
            ...data,
            id: documentSnapshot.id,
            restaurantId: data.restaurantId || branch.id,
            branchId: data.branchId || branch.id,
            source: 'menuItems' as const,
          } as OrderMenuItem;
        });
        publish();
      }, handleSnapshotError),
    ];

    if (branch.brandName) {
      unsubscribers.push(onSnapshot(query(collection(db, COLLECTIONS.MENU_ITEMS), where('brandName', '==', branch.brandName)), (snapshot) => {
        buckets.brand = snapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data() as Partial<OrderMenuItem>;
          return {
            ...data,
            id: documentSnapshot.id,
            restaurantId: data.restaurantId || branch.id,
            branchId: data.branchId || branch.id,
            source: 'menuItems' as const,
          } as OrderMenuItem;
        });
        publish();
      }, handleSnapshotError));
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [selectedBranch]);

  useEffect(() => {
    if (form.itemKey || !menuItems[0]) return;
    const first = menuItems[0];
    patchForm({
      itemKey: menuItemKey(first),
      itemId: first.id,
      itemName: first.name,
      itemPrice: getMenuItemPrice(first),
      itemImageUrl: first.imageUrl || '',
      itemQty: Math.max(1, Number(form.itemQty || 1)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.itemKey, menuItems]);

  useEffect(() => {
    if (form.itemQty >= 1) return;
    patchForm({ itemQty: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.itemQty]);

  const subtotal = Math.max(0, Math.max(1, Number(form.itemQty || 1)) * Number(form.itemPrice || 0));
  const total = subtotal + Number(form.deliveryFee || 0);

  const patchForm = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.customerName.trim()) return toast.error('Customer name is required.');
    if (!form.customerPhone.trim() || form.customerPhone.length < 9) return toast.error('Valid customer phone is required.');
    if (!selectedBranch) return toast.error('Select a branch.');
    if (!form.deliveryAddress.trim() && form.deliveryType === 'delivery') return toast.error('Delivery address is required.');
    if (!form.itemKey || !form.itemId || !form.itemName.trim()) return toast.error('Select a menu item from the selected branch.');
    if (subtotal <= 0) return toast.error('Item quantity and price must be greater than zero.');

    const deliveryAddress = [
      form.deliveryAddress.trim(),
      form.house.trim() ? `House ${form.house.trim()}` : '',
      form.apartment.trim() ? `Apt ${form.apartment.trim()}` : '',
    ].filter(Boolean).join(', ');

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
          id: form.itemId,
          name: form.itemName.trim(),
          price: Number(form.itemPrice),
          quantity: Number(form.itemQty),
          imageUrl: form.itemImageUrl,
        }],
        subtotal,
        deliveryFee: Number(form.deliveryFee || 0),
        totalAmount: total,
        deliveryAddress,
        deliveryAddressLine: form.deliveryAddress.trim(),
        deliveryHouse: form.house.trim(),
        deliveryApartment: form.apartment.trim(),
        deliveryLocation: deliveryLocation.coordinatesConfirmed
          ? { latitude: deliveryLocation.lat, longitude: deliveryLocation.lng }
          : TASHKENT_CENTER,
        customerLocation: deliveryLocation.coordinatesConfirmed
          ? { latitude: deliveryLocation.lat, longitude: deliveryLocation.lng }
          : TASHKENT_CENTER,
        deliveryLocationSource: deliveryLocation.source,
        deliveryCoordinatesConfirmed: deliveryLocation.coordinatesConfirmed,
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Client</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label="Phone" value={form.customerPhone} onChange={(value) => patchForm({ customerPhone: value })} />
            <Input label="Name" value={form.customerName} onChange={(value) => patchForm({ customerName: value })} />
            <Textarea className="md:col-span-2" label="Comment to client" value={form.comments} onChange={(value) => patchForm({ comments: value })} />
          </div>
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
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

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Delivery address</h2>
            <p className="mt-1 text-sm font-semibold text-gray-500">Select the customer pin on the map or use a preset, then confirm the readable address.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-gray-500 dark:bg-gray-900">
            Customer map
          </span>
        </div>
        <div className="mt-4 space-y-4">
          <RestaurantLocationPicker
            value={deliveryLocation}
            onChange={(value) => {
              setDeliveryLocation(value);
              patchForm({ deliveryAddress: value.address });
            }}
            addressLabel="Customer delivery address"
            addressPlaceholder="Enter exact customer address or select a point on the map"
            currentLocationLabel="Use operator device location"
            presetTitle="Popular delivery addresses"
            presetSearchPlaceholder="Search customer address preset"
            selectedPointTitle="Customer pin"
            presets={DELIVERY_PRESETS}
            layout="split"
            mapHeight={420}
            hideGeocoderWarnings
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="House" value={form.house} onChange={(value) => patchForm({ house: value })} placeholder="Optional" />
            <Input label="Apartment" value={form.apartment} onChange={(value) => patchForm({ apartment: value })} placeholder="Optional" />
          </div>
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Address and map pin are saved to the real order. If the operator enters only text and does not select a pin, the order keeps Tashkent fallback coordinates.
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Branch</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Restaurant branch</span>
              <select
                value={form.branchId}
                onChange={(event) => {
                  const branch = branches.find((item) => item.id === event.target.value);
                  patchForm({
                    branchId: event.target.value,
                    deliveryFee: branch?.deliveryFee || form.deliveryFee,
                    itemKey: '',
                    itemId: '',
                    itemName: '',
                    itemPrice: 0,
                    itemImageUrl: '',
                  });
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
              <label className="col-span-3 block">
                <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Item</span>
                <select
                  value={form.itemKey}
                  disabled={!selectedBranch || isMenuLoading || menuItems.length === 0}
                  onChange={(event) => {
                    const item = menuItems.find((menuItem) => menuItemKey(menuItem) === event.target.value);
                    patchForm({
                      itemKey: item ? menuItemKey(item) : '',
                      itemId: item?.id || '',
                      itemName: item?.name || '',
                      itemPrice: item ? getMenuItemPrice(item) : 0,
                      itemImageUrl: item?.imageUrl || '',
                      itemQty: Math.max(1, Number(form.itemQty || 1)),
                    });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-semibold outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">
                    {isMenuLoading
                      ? 'Loading branch menu...'
                      : menuItems.length
                        ? 'Select item from selected branch'
                        : 'No menu items for selected branch'}
                  </option>
                  {menuItems.map((item) => (
                    <option key={menuItemKey(item)} value={menuItemKey(item)}>
                      {item.name} · {formatCurrencyUZS(getMenuItemPrice(item))}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs font-semibold text-gray-500">
                  {selectedBranch
                    ? `${menuItems.length} available items loaded for ${selectedBranch.brandName} · ${selectedBranch.branchName}.`
                    : 'Select a branch first.'}
                </span>
              </label>
              <NumberInput label="Quantity" value={form.itemQty} onChange={(value) => patchForm({ itemQty: value })} min={1} />
              <NumberInput label="Unit price" value={form.itemPrice} onChange={(value) => patchForm({ itemPrice: value })} className="col-span-2" disabled />
              <div className="col-span-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-900">
                <SummaryLine label="Line total" value={formatCurrencyUZS(subtotal)} strong />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Type" value={form.deliveryType} onChange={(value) => patchForm({ deliveryType: value })} options={[['delivery', 'Delivery'], ['pickup', 'Pickup'], ['hall', 'Hall'], ['aggregator', 'Aggregator']]} />
              <Select label="Source" value={form.source} onChange={(value) => patchForm({ source: value })} options={[['operator', 'Operator'], ['website', 'Website'], ['phone', 'Phone'], ['telegram', 'Telegram'], ['aggregator', 'Aggregator']]} />
              <Select label="Payment" value={form.paymentMethod} onChange={(value) => patchForm({ paymentMethod: value })} options={[['cash', 'Cash'], ['card', 'Card']]} />
              <NumberInput label="Delivery fee" value={form.deliveryFee} onChange={(value) => patchForm({ deliveryFee: value })} min={0} />
            </div>
          </div>
        </section>
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

function NumberInput({ label, value, onChange, className = '', disabled = false, min = 0 }: { label: string; value: number; onChange: (value: number) => void; className?: string; disabled?: boolean; min?: number }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? Math.max(min, next) : min);
        }}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-semibold outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`block ${className}`}>
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
