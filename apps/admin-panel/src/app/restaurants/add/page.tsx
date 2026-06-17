'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, collection, auth, doc, setDoc } from '@repo/firebase-config';
import { COLLECTIONS, isReadableAddress } from '@repo/shared-types';
import toast from 'react-hot-toast';
import { buildRestaurantPayload } from '@/lib/marketplaceSchema';
import {
  TASHKENT_CENTER_LOCATION,
  compressImageFile,
  loadRestaurantTypeOptions,
  validateRestaurantImage,
  type RestaurantLocationValue,
  type RestaurantTypeOption,
} from '@/lib/restaurantAdmin';
import { RestaurantImageUploader } from '@/components/restaurants/RestaurantImageUploader';
import { RestaurantLocationPicker } from '@/components/restaurants/RestaurantLocationPicker';
import { RestaurantTypeSelect } from '@/components/restaurants/RestaurantTypeSelect';

type FormErrors = Partial<Record<'brandName' | 'branchName' | 'name' | 'restaurantType' | 'address' | 'image', string>>;

export default function AddRestaurantPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [restaurantTypes, setRestaurantTypes] = useState<RestaurantTypeOption[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    brandName: '',
    branchName: '',
    name: '',
    restaurantType: '',
    description: '',
    phone: '',
    workingHours: '09:00-23:00',
    deliveryTime: '30',
    deliveryFee: '0',
    minOrder: '0',
    isActive: true,
  });

  const [location, setLocation] = useState<RestaurantLocationValue>(TASHKENT_CENTER_LOCATION);

  const isDirty = useMemo(() => (
    Boolean(formData.brandName.trim()) ||
    Boolean(formData.branchName.trim()) ||
    Boolean(formData.name.trim()) ||
    Boolean(formData.restaurantType.trim()) ||
    Boolean(location.address.trim()) ||
    Boolean(imageFile)
  ), [formData.brandName, formData.branchName, formData.name, formData.restaurantType, imageFile, location.address]);

  useEffect(() => {
    let cancelled = false;
    loadRestaurantTypeOptions()
      .then((options) => {
        if (!cancelled) setRestaurantTypes(options);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load restaurant types');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTypes(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setImage = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setErrors((current) => ({ ...current, image: '' }));
      return;
    }

    const imageError = validateRestaurantImage(file);
    if (imageError) {
      setErrors((current) => ({ ...current, image: imageError }));
      return;
    }

    setImageFile(file);
    setErrors((current) => ({ ...current, image: '' }));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!formData.brandName.trim()) nextErrors.brandName = 'Brand name is required.';
    if (!formData.branchName.trim()) nextErrors.branchName = 'Branch / filial name is required.';
    if (!formData.name.trim() && !formData.brandName.trim()) nextErrors.name = 'Marketplace display name is required.';
    if (!formData.restaurantType.trim()) nextErrors.restaurantType = 'Restaurant type is required.';
    if (!isReadableAddress(location.address)) nextErrors.address = 'Readable restaurant address is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    toast.loading('Adding restaurant...', { id: 'add-restaurant' });

    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, COLLECTIONS.USERS, user.uid), { role: 'admin' }, { merge: true });
      }

      const finalImageUrl = imageFile ? await compressImageFile(imageFile) : '';
      const restaurantRef = doc(collection(db, COLLECTIONS.RESTAURANTS));
      const displayName = formData.name.trim()
        || `${formData.brandName.trim()} ${formData.branchName.trim()}`.trim();
      const newRestaurant = buildRestaurantPayload({
        id: restaurantRef.id,
        name: displayName,
        brandName: formData.brandName.trim(),
        branchName: formData.branchName.trim(),
        cuisine: formData.restaurantType.trim(),
        address: location.address.trim(),
        description: formData.description.trim(),
        imageUrl: finalImageUrl,
        phone: formData.phone.trim(),
        workingHours: formData.workingHours.trim(),
        deliveryTime: Number(formData.deliveryTime || 30),
        deliveryFee: Number(formData.deliveryFee || 0),
        minOrder: Number(formData.minOrder || 0),
        isActive: formData.isActive,
        location: {
          address: location.address.trim(),
          lat: location.lat,
          lng: location.lng,
          source: location.source,
          coordinatesConfirmed: location.coordinatesConfirmed,
        },
      });

      await setDoc(restaurantRef, newRestaurant);

      toast.success('Restaurant added successfully!', { id: 'add-restaurant' });
      router.push('/restaurants');
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to add restaurant: ${message}`, { id: 'add-restaurant' });
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isDirty || window.confirm('Discard unsaved restaurant changes?')) {
      router.back();
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Restaurant management</p>
        <h1 className="mt-2 text-3xl font-black text-gray-900 dark:text-white">Add Restaurant</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create a restaurant that is immediately usable by the customer marketplace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <RestaurantImageUploader
            file={imageFile}
            onFileChange={setImage}
            error={errors.image}
          />

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Marketplace status</p>
                <p className="text-xs text-gray-500">Inactive restaurants stay hidden from customers.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData((current) => ({ ...current, isActive: !current.isActive }))}
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  formData.isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                }`}
              >
                {formData.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">ETA minutes</label>
                <input
                  type="number"
                  min="5"
                  value={formData.deliveryTime}
                  onChange={(event) => setFormData({ ...formData, deliveryTime: event.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Delivery fee</label>
                <input
                  type="number"
                  min="0"
                  value={formData.deliveryFee}
                  onChange={(event) => setFormData({ ...formData, deliveryFee: event.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                Brand is the restaurant chain. Branch / filial is the physical location used for address, menu, orders, and courier pickup.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(event) => {
                      const brandName = event.target.value;
                      setFormData((current) => ({
                        ...current,
                        brandName,
                        name: current.name || `${brandName} ${current.branchName}`.trim(),
                      }));
                    }}
                    placeholder="e.g. Bellissimo Pizza"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  {errors.brandName && <p className="mt-2 text-xs font-semibold text-red-600">{errors.brandName}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Branch / Filial Name</label>
                  <input
                    type="text"
                    value={formData.branchName}
                    onChange={(event) => {
                      const branchName = event.target.value;
                      setFormData((current) => ({
                        ...current,
                        branchName,
                        name: current.name || `${current.brandName} ${branchName}`.trim(),
                      }));
                    }}
                    placeholder="e.g. Yunusabad 4"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  {errors.branchName && <p className="mt-2 text-xs font-semibold text-red-600">{errors.branchName}</p>}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Marketplace Display Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="e.g. Bellissimo Pizza Yunusabad"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              {errors.name && <p className="mt-2 text-xs font-semibold text-red-600">{errors.name}</p>}
            </div>

            <RestaurantTypeSelect
              value={formData.restaurantType}
              options={restaurantTypes}
              loading={isLoadingTypes}
              onChange={(restaurantType) => setFormData({ ...formData, restaurantType })}
              error={errors.restaurantType}
            />

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                placeholder="+998 90 123 45 67"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Working Hours</label>
              <input
                type="text"
                value={formData.workingHours}
                onChange={(event) => setFormData({ ...formData, workingHours: event.target.value })}
                placeholder="09:00-23:00"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Minimum Order</label>
              <input
                type="number"
                min="0"
                value={formData.minOrder}
                onChange={(event) => setFormData({ ...formData, minOrder: event.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                placeholder="Short description shown on customer restaurant pages"
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>

          <RestaurantLocationPicker
            value={location}
            onChange={setLocation}
            error={errors.address}
          />

          <div className="flex flex-col justify-end gap-3 border-t border-gray-100 pt-4 sm:flex-row dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl bg-gray-100 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Restaurant'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
