'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { DataTable, type ColumnDef } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { db, collection, onSnapshot } from '@repo/firebase-config';
import { COLLECTIONS, Restaurant } from '@repo/shared-types';
import toast from 'react-hot-toast';

import { useRouter } from 'next/navigation';

type BranchRestaurant = Restaurant & {
  brandId?: string;
  brandName?: string;
  branchId?: string;
  branchName?: string;
  branchDisplayName?: string;
  branchAddress?: string;
  cuisines?: string[];
  categories?: string[];
  status?: string;
  likedBy?: string[];
  reviewsCount?: number;
};

type BrandGroup = {
  key: string;
  name: string;
  branches: BranchRestaurant[];
  activeCount: number;
  imageUrl?: string;
};

const getRestaurantInitials = (name?: string) => {
  const parts = String(name || 'Restaurant')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] || 'R').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
};

function getBrandName(row: BranchRestaurant) {
  return String(row.brandName || row.name || 'Restaurant brand').trim();
}

function getBranchName(row: BranchRestaurant) {
  return String(row.branchName || row.branchDisplayName || 'Main branch').trim();
}

function getBranchAddress(row: BranchRestaurant) {
  return String(row.branchAddress || row.address || (row as any).location?.address || '').trim();
}

function RestaurantAvatar({ name, imageUrl }: { name?: string; imageUrl?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeImageUrl = typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : '';

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-orange-500 to-emerald-500 text-sm font-black text-white shadow-sm dark:border-gray-700">
      {safeImageUrl && !imageFailed ? (
        <img
          src={safeImageUrl}
          alt={name || 'Restaurant'}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{getRestaurantInitials(name)}</span>
      )}
    </div>
  );
}

export default function RestaurantsPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<BranchRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteRestaurantId, setDeleteRestaurantId] = useState<string | null>(null);
  const [selectedBrandKey, setSelectedBrandKey] = useState('all');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.RESTAURANTS), { includeMetadataChanges: true }, (snapshot) => {
      const data: BranchRestaurant[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as BranchRestaurant);
      });
      setRestaurants(data.sort((a, b) => getBrandName(a).localeCompare(getBrandName(b)) || getBranchName(a).localeCompare(getBranchName(b))));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching restaurants:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const brandGroups = useMemo<BrandGroup[]>(() => {
    const groups = new Map<string, BrandGroup>();
    restaurants.forEach((restaurant) => {
      const brandName = getBrandName(restaurant);
      const key = String(restaurant.brandId || brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim() || brandName.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.branches.push(restaurant);
        if (restaurant.status !== 'inactive' && restaurant.isActive !== false) existing.activeCount += 1;
        if (!existing.imageUrl && restaurant.imageUrl) existing.imageUrl = restaurant.imageUrl;
      } else {
        groups.set(key, {
          key,
          name: brandName,
          branches: [restaurant],
          activeCount: restaurant.status !== 'inactive' && restaurant.isActive !== false ? 1 : 0,
          imageUrl: restaurant.imageUrl,
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [restaurants]);

  const selectedBrand = useMemo(() => brandGroups.find((brand) => brand.key === selectedBrandKey), [brandGroups, selectedBrandKey]);
  const visibleRestaurants = selectedBrandKey === 'all' ? restaurants : selectedBrand?.branches || [];
  const brandCount = brandGroups.length;
  const activeBranches = restaurants.filter((restaurant) => restaurant.status !== 'inactive' && restaurant.isActive !== false).length;

  const columns: ColumnDef<BranchRestaurant>[] = [
    {
      header: 'Brand',
      accessor: 'name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <RestaurantAvatar name={getBrandName(row)} imageUrl={row.imageUrl} />
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{getBrandName(row)}</p>
            <p className="text-xs text-gray-500">Brand ID: {row.brandId || 'legacy'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Branch / Filial',
      accessor: 'branchName',
      cell: (row) => (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{getBranchName(row)}</p>
          <p className="max-w-xs truncate text-xs text-gray-500">{getBranchAddress(row) || 'Address missing'}</p>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: 'cuisine',
      cell: (row) => <span>{Array.isArray((row as any).cuisines) ? (row as any).cuisines.join(', ') : row.cuisine || (row as any).category || '-'}</span>,
    },
    {
      header: 'Rating',
      accessor: 'rating',
      cell: (row) => (
        <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
          <span className="text-orange-400">★</span> {row.rating ? row.rating.toFixed(1) : '0.0'}
        </span>
      ),
    },
    {
      header: 'Reviews',
      accessor: 'reviewCount',
      cell: (row) => <span className="text-gray-600 dark:text-gray-400">{(row as any).reviewsCount ?? row.reviewCount ?? 0} reviews</span>,
    },
    {
      header: 'Likes',
      accessor: 'likedBy',
      cell: (row) => (
        <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          {(row as any).likedBy?.length || 0}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'isActive',
      cell: (row) => (
        <Badge variant={(row as any).status === 'inactive' || row.isActive === false ? 'error' : 'success'}>
          {(row as any).status === 'inactive' || row.isActive === false ? 'Inactive' : 'Active'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Restaurants</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage restaurant brands, physical branches, locations and branch-specific catalog.
          </p>
        </div>
        <a href="/restaurants/add" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          + Add Branch
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Brands</p>
          <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{brandCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Branches</p>
          <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{restaurants.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Active branches</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{activeBranches}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-brand-500">Brand portfolio</p>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Brands and filiallar</h2>
            <p className="text-sm font-semibold text-gray-500">
              Select a brand to manage only its branches. Menu can still be handled per branch in Edit or globally in Catalog matrix.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBrandKey('all')}
            className={`rounded-lg px-4 py-2 text-sm font-black ${selectedBrandKey === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200'}`}
          >
            Show all branches
          </button>
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />)}
          </div>
        ) : brandGroups.length === 0 ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-6 text-center text-sm font-semibold text-gray-500 dark:bg-gray-900">
            No brands yet. Add the first branch to create a brand group.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {brandGroups.map((brand) => {
              const isSelected = selectedBrandKey === brand.key;
              const firstBranch = brand.branches[0];
              return (
                <button
                  key={brand.key}
                  type="button"
                  onClick={() => setSelectedBrandKey(brand.key)}
                  className={`rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 shadow-sm dark:bg-brand-900/20'
                      : 'border-gray-200 bg-gray-50 hover:border-brand-300 hover:bg-white dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RestaurantAvatar name={brand.name} imageUrl={brand.imageUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-gray-900 dark:text-white">{brand.name}</p>
                      <p className="text-xs font-bold text-gray-500">{brand.branches.length} branches · {brand.activeCount} active</p>
                      <p className="mt-2 line-clamp-2 text-xs font-semibold text-gray-500">
                        {getBranchAddress(firstBranch) || 'Branch address missing'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1">
        <div className="flex flex-col gap-2 border-b border-gray-200 p-4 dark:border-gray-700 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              {selectedBrand ? `${selectedBrand.name} branches` : 'All restaurant branches'}
            </h2>
            <p className="text-sm font-semibold text-gray-500">
              Showing {visibleRestaurants.length} of {restaurants.length} live Firestore branch records.
            </p>
          </div>
          {selectedBrand ? (
            <a href="/restaurants/add" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-black text-white hover:bg-brand-600">
              + Add {selectedBrand.name} branch
            </a>
          ) : null}
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <svg className="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : visibleRestaurants.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No restaurants found. Add one to get started!</div>
        ) : (
          <DataTable
            columns={columns}
            data={visibleRestaurants}
            searchPlaceholder="Search brand, branch, address, type..."
            searchAccessor={(item, q) =>
              [
                item.name,
                item.brandName,
                item.branchName,
                getBranchAddress(item),
                item.cuisine,
                Array.isArray(item.cuisines) ? item.cuisines.join(' ') : '',
              ].some((value) => String(value || '').toLowerCase().includes(q)) ||
              String(item.cuisine || '').toLowerCase().includes(q) ||
              (Array.isArray((item as any).cuisines) && (item as any).cuisines.join(' ').toLowerCase().includes(q))
            }
            onEdit={(row) => router.push(`/restaurants/edit/${row.id}`)}
            onDelete={(row) => setDeleteRestaurantId(row.id)}
          />
        )}
      </div>

      {deleteRestaurantId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete branch?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to permanently delete this branch? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteRestaurantId(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const id = deleteRestaurantId;
                  setDeleteRestaurantId(null);
                  try {
                    const { doc, deleteDoc } = await import('@repo/firebase-config');
                    await deleteDoc(doc(db, COLLECTIONS.RESTAURANTS, id));
                    toast.success('Restaurant deleted successfully');
                  } catch (e) {
                    console.error(e);
                    toast.error('Failed to delete restaurant');
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
