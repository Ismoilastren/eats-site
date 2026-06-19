'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { db, collection, doc, getDocs, updateDoc } from '@repo/firebase-config';
import { COLLECTIONS, formatCurrencyUZS } from '@repo/shared-types';
import { writeAdminAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/context/AuthContext';

type Branch = {
  id: string;
  brandId: string;
  brandName: string;
  branchName: string;
  displayName: string;
  isActive: boolean;
};

type MatrixItem = {
  id: string;
  source: 'restaurant_dishes' | 'menuItems';
  restaurantId: string;
  brandId: string;
  brandName: string;
  branchId: string;
  branchName: string;
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
};

function branchKey(branch: Pick<Branch, 'brandId' | 'id'>) {
  return `${branch.brandId}:${branch.id}`;
}

export default function CatalogMatrixPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<MatrixItem[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingKey, setUpdatingKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadMatrix = async () => {
    setIsLoading(true);
    try {
      setLoadError('');
      const restaurantsSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS));
      const nextBranches = restaurantsSnap.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        const brandName = String(data.brandName || data.name || 'Restaurant brand');
        const branchName = String(data.branchName || 'Main branch');
        return {
          id: documentSnapshot.id,
          brandId: String(data.brandId || brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
          brandName,
          branchName,
          displayName: `${brandName} · ${branchName}`,
          isActive: data.isActive !== false && data.status !== 'inactive',
        };
      });

      const nestedItems = await Promise.all(nextBranches.map(async (branch) => {
        const dishesSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS, branch.id, 'dishes'));
        return dishesSnap.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data();
          return {
            id: documentSnapshot.id,
            source: 'restaurant_dishes' as const,
            restaurantId: branch.id,
            brandId: String(data.brandId || branch.brandId),
            brandName: String(data.brandName || branch.brandName),
            branchId: String(data.branchId || branch.id),
            branchName: String(data.branchName || branch.branchName),
            name: String(data.name || documentSnapshot.id),
            category: String(data.category || 'Uncategorized'),
            price: Number(data.price || 0),
            isAvailable: data.isAvailable !== false && data.available !== false,
          };
        });
      }));

      const topLevelSnap = await getDocs(collection(db, COLLECTIONS.MENU_ITEMS));
      const topLevelItems = topLevelSnap.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        const branch = nextBranches.find((item) => item.id === data.restaurantId) || nextBranches.find((item) => item.id === data.branchId);
        return {
          id: documentSnapshot.id,
          source: 'menuItems' as const,
          restaurantId: String(data.restaurantId || data.branchId || ''),
          brandId: String(data.brandId || branch?.brandId || ''),
          brandName: String(data.brandName || branch?.brandName || 'Unknown brand'),
          branchId: String(data.branchId || data.restaurantId || branch?.id || ''),
          branchName: String(data.branchName || branch?.branchName || 'Main branch'),
          name: String(data.name || documentSnapshot.id),
          category: String(data.category || 'Uncategorized'),
          price: Number(data.price || 0),
          isAvailable: data.isAvailable !== false && data.available !== false,
        };
      });

      const seen = new Set<string>();
      const nextItems = [...nestedItems.flat(), ...topLevelItems].filter((item) => {
        const key = `${item.restaurantId}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return Boolean(item.name && item.restaurantId);
      });

      setBranches(nextBranches.sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setItems(nextItems.sort((a, b) => a.brandName.localeCompare(b.brandName) || a.name.localeCompare(b.name)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load branch/catalog matrix.');
      toast.error('Failed to load branch/catalog matrix');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMatrix();
  }, []);

  const brands = useMemo(() => Array.from(new Set(branches.map((branch) => branch.brandName))).sort(), [branches]);
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort(), [items]);

  const filteredBranches = useMemo(() => branches.filter((branch) => brandFilter === 'all' || branch.brandName === brandFilter), [branches, brandFilter]);
  const filteredItems = useMemo(() => items.filter((item) => {
    if (brandFilter !== 'all' && item.brandName !== brandFilter) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter === 'available' && !item.isAvailable) return false;
    if (statusFilter === 'unavailable' && item.isAvailable) return false;
    return true;
  }), [brandFilter, categoryFilter, items, statusFilter]);

  const toggleAvailability = async (item: MatrixItem) => {
    const nextValue = !item.isAvailable;
    const key = `${item.restaurantId}:${item.id}`;
    setUpdatingKey(key);
    try {
      const ref = item.source === 'restaurant_dishes'
        ? doc(db, COLLECTIONS.RESTAURANTS, item.restaurantId, 'dishes', item.id)
        : doc(db, COLLECTIONS.MENU_ITEMS, item.id);
      await updateDoc(ref, { isAvailable: nextValue, available: nextValue });
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
      toast.success(nextValue ? 'Product enabled for branch' : 'Product disabled for branch');
    } catch (error) {
      toast.error('Failed to update product availability');
    } finally {
      setUpdatingKey('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Catalog ops</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branch / Catalog Matrix</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real availability matrix from restaurant branch dish documents. No fake branch availability is generated.
          </p>
        </div>
        <Link href="/catalog" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-black text-white dark:bg-gray-700">Back to catalog</Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All brands</option>
            {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <button type="button" onClick={loadMatrix} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-black text-white">Reload</button>
        </div>
        <p className="mt-3 text-xs font-black uppercase tracking-wide text-gray-500">{filteredItems.length} products · {filteredBranches.length} branches</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-10 text-center text-gray-500">Loading matrix...</div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <p className="font-black text-gray-900 dark:text-white">Branch/catalog matrix is not readable yet.</p>
            <p className="mt-2 text-sm text-gray-500">Deploy the latest Firestore rules and make sure this admin account can read restaurants and menu items.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No product rows match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-black uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                  <th className="sticky left-0 z-10 bg-gray-50 px-5 py-3 text-left dark:bg-gray-800">Product</th>
                  {filteredBranches.map((branch) => (
                    <th key={branchKey(branch)} className="px-5 py-3 text-center">
                      <Link href={`/restaurants/edit/${branch.id}`} className="hover:text-brand-500">{branch.displayName}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredItems.map((item) => (
                  <tr key={`${item.restaurantId}:${item.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="sticky left-0 z-10 bg-white px-5 py-4 dark:bg-gray-900">
                      <p className="font-black text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-xs font-semibold text-gray-500">{item.category} · {formatCurrencyUZS(item.price)}</p>
                    </td>
                    {filteredBranches.map((branch) => {
                      const belongsToBranch = item.restaurantId === branch.id || item.branchId === branch.id;
                      const key = `${item.restaurantId}:${item.id}`;
                      return (
                        <td key={`${item.id}:${branch.id}`} className="px-5 py-4 text-center">
                          {belongsToBranch ? (
                            <button
                              type="button"
                              disabled={updatingKey === key}
                              onClick={() => toggleAvailability(item)}
                              className={`rounded-full px-3 py-1 text-xs font-black uppercase disabled:opacity-60 ${
                                item.isAvailable
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                              }`}
                            >
                              {item.isAvailable ? 'Available' : 'Off'}
                            </button>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-400 dark:bg-gray-800">Not linked</span>
                          )}
                        </td>
                      );
                    })}
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
