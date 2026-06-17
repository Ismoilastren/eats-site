'use client';
import React, { useState, useEffect } from 'react';
import { DataTable, type ColumnDef } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { db, collection, query, limit, onSnapshot } from '@repo/firebase-config';
import { COLLECTIONS, PAGE_SIZE, Restaurant } from '@repo/shared-types';
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

  useEffect(() => {
    // Strict 21-item pagination rule applied
    const q = query(
      collection(db, COLLECTIONS.RESTAURANTS),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const data: BranchRestaurant[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as BranchRestaurant);
      });
      setRestaurants(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching restaurants:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const brandCount = new Set(restaurants.map((restaurant) => getBrandName(restaurant).toLowerCase())).size;
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
            Manage brands and physical branches. Data is synced in real-time from Firestore.
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1">
        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <svg className="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : restaurants.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No restaurants found. Add one to get started!</div>
        ) : (
          <DataTable
            columns={columns}
            data={restaurants}
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Restaurant?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to permanently delete this restaurant? This action cannot be undone.
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
