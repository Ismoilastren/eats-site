'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from '@repo/firebase-config';
import { COLLECTIONS, formatCurrencyUZS } from '@repo/shared-types';
import { buildDishPayload } from '@/lib/marketplaceSchema';
import { writeAdminAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/context/AuthContext';

type Branch = {
  id: string;
  brandId: string;
  brandName: string;
  branchName: string;
  displayName: string;
  address: string;
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
  description: string;
  imageUrl: string;
  category: string;
  price: number;
  sortOrder: number;
  isAvailable: boolean;
};

type ProductRow = {
  key: string;
  brandId: string;
  brandName: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  price: number;
  sortOrder: number;
  template: MatrixItem;
  linkedByBranchId: Map<string, MatrixItem>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getBrandGroupKey(value: Pick<Branch | MatrixItem, 'brandId' | 'brandName'>) {
  return value.brandId || slugify(value.brandName);
}

function getProductKey(item: Pick<MatrixItem, 'brandId' | 'brandName' | 'name' | 'category'>) {
  return [
    getBrandGroupKey(item),
    normalizeText(item.category || 'Uncategorized'),
    normalizeText(item.name),
  ].join('::');
}

function branchDisplayName(data: Record<string, unknown>, id: string) {
  const brandName = String(data.brandName || data.name || 'Restaurant brand').trim();
  const branchName = String(data.branchName || 'Main branch').trim();
  return {
    brandId: String(data.brandId || slugify(brandName)).trim(),
    brandName,
    branchName,
    displayName: branchName.toLowerCase() === 'main branch' ? brandName : `${brandName} · ${branchName}`,
    address: String(data.branchAddress || data.address || (data.location as { address?: string } | undefined)?.address || '').trim(),
    id,
  };
}

function itemDocumentRefs(item: MatrixItem) {
  const refs = [];
  if (item.restaurantId) {
    refs.push(doc(db, COLLECTIONS.RESTAURANTS, item.restaurantId, 'dishes', item.id));
  }
  refs.push(doc(db, COLLECTIONS.MENU_ITEMS, item.id));
  return refs;
}

export default function CatalogMatrixPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<MatrixItem[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [editingKey, setEditingKey] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadMatrix = async () => {
    setIsLoading(true);
    try {
      setLoadError('');
      const restaurantsSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS));
      const nextBranches = restaurantsSnap.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        const branch = branchDisplayName(data, documentSnapshot.id);
        return {
          ...branch,
          isActive: data.isActive !== false && data.status !== 'inactive',
        };
      });

      const branchById = new Map(nextBranches.map((branch) => [branch.id, branch]));
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
            description: String(data.description || ''),
            imageUrl: String(data.imageUrl || ''),
            category: String(data.category || 'Uncategorized'),
            price: Number(data.price || 0),
            sortOrder: Number(data.sortOrder || 0),
            isAvailable: data.isAvailable !== false && data.available !== false,
          };
        });
      }));

      const topLevelSnap = await getDocs(collection(db, COLLECTIONS.MENU_ITEMS));
      const topLevelItems = topLevelSnap.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        const restaurantId = String(data.restaurantId || data.branchId || '');
        const branch = branchById.get(restaurantId) || branchById.get(String(data.branchId || ''));
        return {
          id: documentSnapshot.id,
          source: 'menuItems' as const,
          restaurantId,
          brandId: String(data.brandId || branch?.brandId || ''),
          brandName: String(data.brandName || branch?.brandName || 'Unknown brand'),
          branchId: String(data.branchId || restaurantId || branch?.id || ''),
          branchName: String(data.branchName || branch?.branchName || 'Main branch'),
          name: String(data.name || documentSnapshot.id),
          description: String(data.description || ''),
          imageUrl: String(data.imageUrl || ''),
          category: String(data.category || 'Uncategorized'),
          price: Number(data.price || 0),
          sortOrder: Number(data.sortOrder || 0),
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

      setBranches(nextBranches.sort((a, b) => a.brandName.localeCompare(b.brandName) || a.branchName.localeCompare(b.branchName)));
      setItems(nextItems.sort((a, b) => a.brandName.localeCompare(b.brandName) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
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

  const brands = useMemo(() => {
    const unique = new Map<string, string>();
    branches.forEach((branch) => unique.set(getBrandGroupKey(branch), branch.brandName));
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [branches]);

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category || 'Uncategorized'))).sort(), [items]);

  const rows = useMemo(() => {
    const map = new Map<string, ProductRow>();
    items.forEach((item) => {
      const key = getProductKey(item);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          brandId: getBrandGroupKey(item),
          brandName: item.brandName,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          category: item.category || 'Uncategorized',
          price: item.price,
          sortOrder: item.sortOrder,
          template: item,
          linkedByBranchId: new Map([[item.restaurantId || item.branchId, item]]),
        });
        return;
      }

      existing.linkedByBranchId.set(item.restaurantId || item.branchId, item);
      if (item.isAvailable && !existing.template.isAvailable) {
        existing.template = item;
        existing.price = item.price;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.brandName.localeCompare(b.brandName) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [items]);

  const branchesByBrand = useMemo(() => {
    const map = new Map<string, Branch[]>();
    branches.forEach((branch) => {
      const key = getBrandGroupKey(branch);
      const current = map.get(key) || [];
      current.push(branch);
      map.set(key, current);
    });
    map.forEach((value) => value.sort((a, b) => a.branchName.localeCompare(b.branchName)));
    return map;
  }, [branches]);

  const visibleSections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredRows = rows.filter((row) => {
      if (brandFilter !== 'all' && row.brandId !== brandFilter) return false;
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      const brandBranches = branchesByBrand.get(row.brandId) || [];
      const linkedItems = brandBranches.map((branch) => row.linkedByBranchId.get(branch.id)).filter(Boolean) as MatrixItem[];
      const hasMissing = brandBranches.some((branch) => !row.linkedByBranchId.has(branch.id));
      const hasAvailable = linkedItems.some((item) => item.isAvailable);
      const hasOff = linkedItems.some((item) => !item.isAvailable);
      if (statusFilter === 'available' && !hasAvailable) return false;
      if (statusFilter === 'unavailable' && !hasOff) return false;
      if (statusFilter === 'missing' && !hasMissing) return false;
      if (normalizedSearch) {
        const haystack = [row.brandName, row.name, row.category, row.description].join(' ').toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });

    return brands
      .filter(([brandId]) => brandFilter === 'all' || brandId === brandFilter)
      .map(([brandId, brandName]) => ({
        brandId,
        brandName,
        branches: branchesByBrand.get(brandId) || [],
        rows: filteredRows.filter((row) => row.brandId === brandId),
      }))
      .filter((section) => section.rows.length > 0 || brandFilter !== 'all');
  }, [branchesByBrand, brandFilter, brands, categoryFilter, rows, search, statusFilter]);

  const totals = useMemo(() => {
    let linked = 0;
    let missing = 0;
    rows.forEach((row) => {
      const brandBranches = branchesByBrand.get(row.brandId) || [];
      brandBranches.forEach((branch) => {
        if (row.linkedByBranchId.has(branch.id)) linked += 1;
        else missing += 1;
      });
    });
    return { products: rows.length, branches: branches.length, linked, missing };
  }, [branches.length, branchesByBrand, rows]);

  const updateItemEverywhere = async (item: MatrixItem, updates: Record<string, unknown>) => {
    await Promise.all(itemDocumentRefs(item).map((ref) => setDoc(ref, updates, { merge: true })));
  };

  const toggleAvailability = async (item: MatrixItem) => {
    const nextValue = !item.isAvailable;
    const key = `${item.restaurantId}:${item.id}:availability`;
    setBusyKey(key);
    try {
      await updateItemEverywhere(item, { isAvailable: nextValue, available: nextValue });
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
      toast.success(nextValue ? 'Product enabled for this branch' : 'Product disabled for this branch');
    } catch (error) {
      toast.error('Failed to update product availability');
    } finally {
      setBusyKey('');
    }
  };

  const savePrice = async (item: MatrixItem) => {
    const nextPrice = Number(draftPrice);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    const key = `${item.restaurantId}:${item.id}:price`;
    setBusyKey(key);
    try {
      await updateItemEverywhere(item, { price: nextPrice });
      await writeAdminAuditLog({
        action: 'catalog.changed',
        entityType: 'catalog',
        entityId: item.id,
        entityName: item.name,
        actorEmail: user?.email,
        before: { price: item.price, restaurantId: item.restaurantId },
        after: { price: nextPrice, restaurantId: item.restaurantId },
      });
      setItems((current) => current.map((currentItem) => currentItem.id === item.id && currentItem.restaurantId === item.restaurantId
        ? { ...currentItem, price: nextPrice }
        : currentItem));
      setEditingKey('');
      setDraftPrice('');
      toast.success('Branch price updated');
    } catch (error) {
      toast.error('Failed to update branch price');
    } finally {
      setBusyKey('');
    }
  };

  const linkProductToBranch = async (row: ProductRow, branch: Branch) => {
    const key = `${row.key}:${branch.id}:link`;
    setBusyKey(key);
    try {
      const itemRef = doc(collection(db, COLLECTIONS.MENU_ITEMS));
      const payload = buildDishPayload({
        id: itemRef.id,
        restaurantId: branch.id,
        branchId: branch.id,
        branchName: branch.branchName,
        brandId: branch.brandId,
        brandName: branch.brandName,
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        category: row.category,
        price: row.price,
        isAvailable: true,
        sortOrder: row.sortOrder,
      });
      await Promise.all([
        setDoc(itemRef, payload),
        setDoc(doc(db, COLLECTIONS.RESTAURANTS, branch.id, 'dishes', itemRef.id), payload),
      ]);
      await writeAdminAuditLog({
        action: 'catalog.changed',
        entityType: 'catalog',
        entityId: itemRef.id,
        entityName: row.name,
        actorEmail: user?.email,
        after: { restaurantId: branch.id, branchName: branch.branchName, brandName: branch.brandName, linked: true },
      });
      setItems((current) => [...current, {
        id: itemRef.id,
        source: 'restaurant_dishes',
        restaurantId: branch.id,
        brandId: branch.brandId,
        brandName: branch.brandName,
        branchId: branch.id,
        branchName: branch.branchName,
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        category: row.category,
        price: row.price,
        sortOrder: row.sortOrder,
        isAvailable: true,
      }]);
      toast.success(`${row.name} linked to ${branch.branchName}`);
    } catch (error) {
      toast.error('Failed to link product to branch');
    } finally {
      setBusyKey('');
    }
  };

  const unlinkProductFromBranch = async (item: MatrixItem) => {
    const confirmed = window.confirm(`Unlink "${item.name}" from ${item.branchName}? This removes it from that branch menu.`);
    if (!confirmed) return;
    const key = `${item.restaurantId}:${item.id}:unlink`;
    setBusyKey(key);
    try {
      await Promise.all([
        deleteDoc(doc(db, COLLECTIONS.RESTAURANTS, item.restaurantId, 'dishes', item.id)),
        deleteDoc(doc(db, COLLECTIONS.MENU_ITEMS, item.id)),
      ]);
      await writeAdminAuditLog({
        action: 'catalog.changed',
        entityType: 'catalog',
        entityId: item.id,
        entityName: item.name,
        actorEmail: user?.email,
        before: { restaurantId: item.restaurantId, branchName: item.branchName, linked: true },
        after: { restaurantId: item.restaurantId, branchName: item.branchName, linked: false },
      });
      setItems((current) => current.filter((currentItem) => !(currentItem.id === item.id && currentItem.restaurantId === item.restaurantId)));
      toast.success('Product unlinked from branch');
    } catch (error) {
      toast.error('Failed to unlink product');
    } finally {
      setBusyKey('');
    }
  };

  const startEditingPrice = (item: MatrixItem) => {
    setEditingKey(`${item.restaurantId}:${item.id}`);
    setDraftPrice(String(item.price || ''));
  };

  const renderCell = (row: ProductRow, branch: Branch) => {
    const item = row.linkedByBranchId.get(branch.id);
    if (!item) {
      const key = `${row.key}:${branch.id}:link`;
      return (
        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-400 dark:bg-gray-800">Not linked</span>
          <button
            type="button"
            disabled={busyKey === key}
            onClick={() => linkProductToBranch(row, branch)}
            className="rounded-lg border border-brand-200 px-3 py-1 text-xs font-black text-brand-600 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-900 dark:text-brand-300 dark:hover:bg-brand-950/40"
          >
            Link
          </button>
        </div>
      );
    }

    const cellKey = `${item.restaurantId}:${item.id}`;
    const isEditing = editingKey === cellKey;
    return (
      <div className="min-w-[170px] space-y-2">
        <button
          type="button"
          disabled={busyKey === `${item.restaurantId}:${item.id}:availability`}
          onClick={() => toggleAvailability(item)}
          className={`rounded-full px-3 py-1 text-xs font-black uppercase disabled:opacity-60 ${
            item.isAvailable
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {item.isAvailable ? 'Available' : 'Off'}
        </button>
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="number"
              min="1"
              value={draftPrice}
              onChange={(event) => setDraftPrice(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-center text-sm font-bold outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950"
            />
            <div className="flex justify-center gap-2">
              <button type="button" disabled={busyKey === `${item.restaurantId}:${item.id}:price`} onClick={() => savePrice(item)} className="rounded-lg bg-brand-500 px-2 py-1 text-xs font-black text-white disabled:opacity-60">
                Save
              </button>
              <button type="button" onClick={() => setEditingKey('')} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-black text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{formatCurrencyUZS(item.price)}</p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => startEditingPrice(item)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-black text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">
                Price
              </button>
              <button type="button" disabled={busyKey === `${item.restaurantId}:${item.id}:unlink`} onClick={() => unlinkProductFromBranch(item)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300">
                Unlink
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Catalog ops</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branch / Catalog Matrix</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            This page controls which brand products are available in each physical branch. Link creates a real branch menu item, Off hides it from ordering, Price changes only that branch, and Unlink removes it from that branch.
          </p>
        </div>
        <Link href="/catalog" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-black text-white dark:bg-gray-700">Back to catalog</Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Products</p>
          <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{totals.products}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Branches</p>
          <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{totals.branches}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Linked cells</p>
          <p className="mt-2 text-3xl font-black text-green-600">{totals.linked}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Missing links</p>
          <p className="mt-2 text-3xl font-black text-orange-500">{totals.missing}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, category, brand..."
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 xl:col-span-2"
          />
          <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All brands</option>
            {brands.map(([brandId, brand]) => <option key={brandId} value={brandId}>{brand}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900">
            <option value="all">All statuses</option>
            <option value="available">Has available items</option>
            <option value="unavailable">Has off items</option>
            <option value="missing">Missing branch links</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">
            Showing {visibleSections.reduce((count, section) => count + section.rows.length, 0)} product rows
          </p>
          <button type="button" onClick={loadMatrix} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-black text-white">Reload</button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900">Loading matrix...</div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <p className="font-black text-red-700 dark:text-red-200">Branch/catalog matrix is not readable yet.</p>
          <p className="mt-2 text-sm text-red-600 dark:text-red-300">{loadError}</p>
        </div>
      ) : visibleSections.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900">No product rows match these filters.</div>
      ) : (
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <section key={section.brandId} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-2 border-b border-gray-200 p-5 dark:border-gray-700 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">{section.brandName}</h2>
                  <p className="text-sm font-semibold text-gray-500">
                    {section.rows.length} products · {section.branches.length} branches. Only this brand’s branches are shown.
                  </p>
                </div>
                <Link href={`/restaurants?brand=${encodeURIComponent(section.brandName)}`} className="text-sm font-black text-brand-500 hover:text-brand-600">
                  Manage branches
                </Link>
              </div>

              {section.branches.length === 0 ? (
                <div className="p-8 text-center text-gray-500">This brand has no branches yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-xs font-black uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                        <th className="sticky left-0 z-10 w-72 bg-gray-50 px-5 py-3 text-left dark:bg-gray-800">Product</th>
                        {section.branches.map((branch) => (
                          <th key={branch.id} className="px-5 py-3 text-center">
                            <Link href={`/restaurants/edit/${branch.id}`} className="hover:text-brand-500">
                              {branch.branchName}
                            </Link>
                            <span className={`mx-auto mt-1 block w-fit rounded-full px-2 py-0.5 text-[10px] ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {branch.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {section.rows.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <td className="sticky left-0 z-10 bg-white px-5 py-4 dark:bg-gray-900">
                            <p className="font-black text-gray-900 dark:text-white">{row.name}</p>
                            <p className="text-xs font-semibold text-gray-500">{row.category} · base {formatCurrencyUZS(row.price)}</p>
                            {row.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-400">{row.description}</p> : null}
                          </td>
                          {section.branches.map((branch) => (
                            <td key={`${row.key}:${branch.id}`} className="px-5 py-4 text-center align-top">
                              {renderCell(row, branch)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
