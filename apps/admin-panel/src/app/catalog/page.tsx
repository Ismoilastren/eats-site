'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { db, collection, doc, getDocs, updateDoc } from '@repo/firebase-config';
import { COLLECTIONS, MenuItem, Restaurant, formatCurrencyUZS } from '@repo/shared-types';
import toast from 'react-hot-toast';
import { writeAdminAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/context/AuthContext';

type CatalogItem = MenuItem & {
  restaurantName: string;
  brandName: string;
  branchName: string;
  branchAddress: string;
  source: 'restaurant_dishes' | 'menuItems';
};

type CatalogRestaurant = Restaurant & {
  brandName?: string;
  branchName?: string;
  branchAddress?: string;
  cuisines?: string[];
};

function getBrandName(restaurant?: Partial<CatalogRestaurant> | null) {
  return String(restaurant?.brandName || restaurant?.name || 'Restaurant brand').trim();
}

function getBranchName(restaurant?: Partial<CatalogRestaurant> | null) {
  return String(restaurant?.branchName || 'Main branch').trim();
}

function getBranchAddress(restaurant?: Partial<CatalogRestaurant> | null) {
  return String(restaurant?.branchAddress || restaurant?.address || (restaurant as any)?.location?.address || '').trim();
}

export default function CatalogPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const loadCatalog = async () => {
      setIsLoading(true);
      try {
        const restaurantsSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS));
        const restaurants = restaurantsSnap.docs.map((documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })) as CatalogRestaurant[];
        const restaurantMeta = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));

        const nestedItems = await Promise.all(restaurants.map(async (restaurant) => {
          try {
            const dishesSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS, restaurant.id, 'dishes'));
            return dishesSnap.docs.map((documentSnapshot) => ({
              id: documentSnapshot.id,
              restaurantId: restaurant.id,
              restaurantName: restaurant.name,
              brandName: getBrandName(restaurant),
              branchName: getBranchName(restaurant),
              branchAddress: getBranchAddress(restaurant),
              source: 'restaurant_dishes' as const,
              ...documentSnapshot.data(),
            })) as CatalogItem[];
          } catch {
            return [];
          }
        }));

        const topLevelSnap = await getDocs(collection(db, COLLECTIONS.MENU_ITEMS));
        const topLevelItems = topLevelSnap.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data() as Partial<MenuItem>;
          const restaurant = restaurantMeta.get(data.restaurantId || '');
          return {
            id: documentSnapshot.id,
            restaurantId: data.restaurantId || '',
            restaurantName: restaurant?.name || 'Unknown restaurant',
            brandName: data.brandName || getBrandName(restaurant),
            branchName: data.branchName || getBranchName(restaurant),
            branchAddress: getBranchAddress(restaurant),
            source: 'menuItems' as const,
            ...data,
          } as CatalogItem;
        });

        const seen = new Set<string>();
        const merged = [...nestedItems.flat(), ...topLevelItems].filter((item) => {
          const key = `${item.restaurantId}:${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return Boolean(item.name);
        });

        setItems(merged.sort((a, b) => a.brandName.localeCompare(b.brandName) || a.branchName.localeCompare(b.branchName) || a.name.localeCompare(b.name)));
      } catch (error) {
        console.error(error);
        toast.error('Failed to load catalog');
      } finally {
        setIsLoading(false);
      }
    };

    loadCatalog();
  }, []);

  const restaurants = useMemo(() => Array.from(new Set(items.map((item) => `${item.brandName} · ${item.branchName}`.trim()).filter(Boolean))).sort(), [items]);
  const categories = useMemo(() => Array.from(new Set(items.map((item) => (item.category || 'Uncategorized').trim() || 'Uncategorized'))).sort(), [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const available = item.isAvailable !== false;
      const restaurantName = `${item.brandName} · ${item.branchName}`.trim();
      const category = (item.category || 'Uncategorized').trim() || 'Uncategorized';
      if (restaurantFilter !== 'all' && restaurantName !== restaurantFilter) return false;
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (availabilityFilter === 'available' && !available) return false;
      if (availabilityFilter === 'unavailable' && available) return false;
      if (normalizedSearch) {
        const haystack = [item.name, item.description, item.category, item.restaurantName, item.brandName, item.branchName, item.branchAddress].join(' ').toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [items, search, restaurantFilter, categoryFilter, availabilityFilter]);

  const toggleAvailability = async (item: CatalogItem) => {
    const nextValue = item.isAvailable === false;
    setUpdatingId(item.id);
    try {
      if (item.source === 'restaurant_dishes') {
        await updateDoc(doc(db, COLLECTIONS.RESTAURANTS, item.restaurantId, 'dishes', item.id), {
          isAvailable: nextValue,
        });
      } else {
        await updateDoc(doc(db, COLLECTIONS.MENU_ITEMS, item.id), {
          isAvailable: nextValue,
        });
      }
      await writeAdminAuditLog({
        action: 'catalog.availability_changed',
        entityType: 'catalog',
        entityId: item.id,
        entityName: item.name,
        actorEmail: user?.email,
        before: { isAvailable: item.isAvailable, restaurantId: item.restaurantId },
        after: { isAvailable: nextValue, restaurantId: item.restaurantId },
      });
      setItems((current) => current.map((currentItem) => currentItem.id === item.id && currentItem.restaurantId === item.restaurantId
        ? { ...currentItem, isAvailable: nextValue }
        : currentItem));
      toast.success(nextValue ? 'Item marked available' : 'Item marked unavailable');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update item availability');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Catalog</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage all products across restaurant menus from one Firestore-backed view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalog/matrix" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 dark:bg-gray-700">
            Branch Matrix
          </Link>
          <Link href="/restaurants/categories" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600">
            Manage Categories
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 md:col-span-2"
          />
          <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <option value="all">All restaurants</option>
            {restaurants.map((restaurant) => <option key={restaurant} value={restaurant}>{restaurant}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Showing {filteredItems.length} of {items.length} products
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading catalog...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No products match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                  <th className="px-6 py-3 text-left">Product</th>
                  <th className="px-6 py-3 text-left">Brand / Branch</th>
                  <th className="px-6 py-3 text-left">Category</th>
                  <th className="px-6 py-3 text-left">Price</th>
                  <th className="px-6 py-3 text-left">Source</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => (
                  <tr key={`${item.restaurantId}:${item.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                          <p className="max-w-xs truncate text-xs text-gray-500">{item.description || item.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
                      <Link className="font-bold hover:text-brand-500" href={`/restaurants/edit/${item.restaurantId}`}>{item.brandName}</Link>
                      <p className="text-xs font-semibold text-gray-500">{item.branchName}</p>
                      {item.branchAddress && <p className="max-w-xs truncate text-xs text-gray-400">{item.branchAddress}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{item.category || 'Uncategorized'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{formatCurrencyUZS(item.price || 0)}</td>
                    <td className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{item.source}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() => toggleAvailability(item)}
                        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide disabled:opacity-50 ${
                          item.isAvailable === false
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                        }`}
                      >
                        {item.isAvailable === false ? 'Unavailable' : 'Available'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
