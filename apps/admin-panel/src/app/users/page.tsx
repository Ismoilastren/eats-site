'use client';

import React, { useState, useEffect } from 'react';
import { DataTable, type ColumnDef } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { db, collection, query, limit, getDocs, doc, updateDoc, where, onSnapshot, orderBy } from '@repo/firebase-config';
import { COLLECTIONS, PAGE_SIZE, User } from '@repo/shared-types';
import toast from 'react-hot-toast';

const getBrandColor = (brand: string) => {
  switch (brand) {
    case 'Visa': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Mastercard': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Amex': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Uzcard': return 'bg-green-50 text-green-700 border-green-200';
    case 'Humo': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('role', 'in', ['client', 'user', 'customer']),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const data: User[] = [];
      snapshot.forEach((doc) => {
        data.push({ uid: doc.id, ...doc.data() } as User);
      });
      if (data.length === 0 && snapshot.metadata.fromCache) {
        // Just let it load, or use dummy data if it's completely empty
        // But we will be seeding data, so it won't be empty
      }
      setUsers(data.length > 0 ? data : []);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      // Fallback to dummy data
      setUsers([]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePromoteToAdmin = (userId: string) => {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    // Fire-and-forget
    updateDoc(userRef, { role: 'admin' }).catch(err => console.warn(err));
    
    // Optimistic UI update so buttons feel responsive
    setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: 'admin' } : u));
    toast.success('User promoted to admin!');
  };

  // handleDeleteUser was unused, using modal instead

  const columns: ColumnDef<User>[] = [
    {
      header: 'User',
      accessor: 'fullName',
      cell: (row) => {
        const name = (row as any).fullName || row.displayName || (row as any).name || 'Unknown User';
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
              {row.photoURL ? (
                <img src={row.photoURL} alt={name} className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="font-semibold">{name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{name}</p>
              <p className="text-xs text-gray-500">{(row as any).email || 'No email provided'}</p>
              <div className="mt-1">
                {(row as any).source === 'app' ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-500/10 dark:text-green-400">
                    📱 App User
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                    💻 Website User
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    { header: 'Phone', accessor: 'phone', cell: (row) => (row as any).phone || 'Not provided' },
    {
      header: 'Role',
      accessor: 'role',
      cell: (row) => {
        let displayRole = row.role || 'client';
        if (['customer', 'user', 'client'].includes(displayRole)) {
          displayRole = 'client';
        }
        return (
          <Badge variant={row.role === 'admin' ? 'info' : row.role === 'courier' ? 'warning' : 'success'}>
            {displayRole}
          </Badge>
        );
      },
    }
  ];

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [userPaymentMethods, setUserPaymentMethods] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  useEffect(() => {
    if (modalMode === 'view' && selectedUser) {
      const fetchUserData = async () => {
        setIsLoadingPayments(true);
        try {
          // Fetch Payments
          const pmQuery = query(collection(db, COLLECTIONS.USERS, selectedUser.uid, 'paymentMethods'));
          const pmSnapshot = await getDocs(pmQuery);
          setUserPaymentMethods(pmSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          
          // Fetch Addresses
          const addrSnap = await getDocs(collection(db, COLLECTIONS.USERS, selectedUser.uid, 'addresses'));
          setAddresses(addrSnap.docs.map(doc => doc.data()));

          // Fetch Orders. Customer order payloads use flat fields, not customer.email.
          const orderQueries = [
            query(collection(db, COLLECTIONS.ORDERS), where('userId', '==', selectedUser.uid)),
            ...(selectedUser.email ? [query(collection(db, COLLECTIONS.ORDERS), where('customerEmail', '==', selectedUser.email))] : []),
            ...(selectedUser.phone ? [query(collection(db, COLLECTIONS.ORDERS), where('customerPhone', '==', selectedUser.phone))] : []),
          ];
          const orderSnapshots = await Promise.all(orderQueries.map((orderQuery) => getDocs(orderQuery)));
          const ordersById = new Map<string, any>();
          orderSnapshots.forEach((orderSnap) => {
            orderSnap.docs.forEach((orderDoc) => {
              ordersById.set(orderDoc.id, { id: orderDoc.id, ...orderDoc.data() });
            });
          });
          const ordersData: any[] = Array.from(ordersById.values());
          ordersData.sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));
          setUserOrders(ordersData);
        } catch (err) {
          console.error("Failed to fetch user subcollections", err);
        } finally {
          setIsLoadingPayments(false);
        }
      };
      fetchUserData();
    } else {
      setUserPaymentMethods([]);
      setAddresses([]);
      setUserOrders([]);
    }
  }, [modalMode, selectedUser]);

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedUser) return;
    try {
      const { doc, updateDoc } = await import('@repo/firebase-config');
      const userRef = doc(db, COLLECTIONS.USERS, selectedUser.uid);
      
      await updateDoc(userRef, { role: newRole });
      
      // Remove from current customer list instantly
      setUsers(prev => prev.filter(u => u.uid !== selectedUser.uid));
      toast.success(`Role updated to ${newRole}`);
      setModalMode(null);
      setSelectedUser(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update role');
    }
  };

  const executeDeleteUser = async () => {
    if (!deleteUserId) return;
    const id = deleteUserId;
    setDeleteUserId(null);

    try {
      const { doc, deleteDoc } = await import('@repo/firebase-config');
      await deleteDoc(doc(db, COLLECTIONS.USERS, id));
      
      setUsers(prev => prev.filter(u => u.uid !== id));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete user');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage all platform users. Secured with Firestore real-time sync.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading user database...</div>
        ) : (
          <DataTable
            columns={columns}
            data={users}
            searchPlaceholder="Search users by name or email..."
            searchAccessor={(item, q) => ((item as any).fullName || item.displayName || '').toLowerCase().includes(q) || (item.email || '').toLowerCase().includes(q)}
            onView={(row) => { setSelectedUser(row); setModalMode('view'); }}
            onEdit={(row) => { setSelectedUser(row); setModalMode('edit'); }}
            onDelete={(row) => setDeleteUserId(row.uid)}
          />
        )}
      </div>

      {/* View/Edit Modal */}
      {modalMode && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {modalMode === 'view' ? 'User Details' : 'Edit User Role'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{(selectedUser as any).fullName || selectedUser.displayName || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{(selectedUser as any).email || 'No email provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium text-gray-900 dark:text-white">{(selectedUser as any).phone || 'Not provided'}</p>
              </div>
              
              {modalMode === 'view' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="mt-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Saved Addresses</p>
                      {addresses.length === 0 ? (
                          <p className="font-medium text-gray-900 dark:text-white">0 locations</p>
                      ) : (
                          <ul className="flex flex-col gap-2 max-h-32 overflow-y-auto">
                              {addresses.map((addr, idx) => {
                                  // Brute-force extraction matching Client schema
                                  const labelName = addr.label || addr.title || addr.type || 'Saved Location';
                                  const addressText = addr.addressDetails || addr.address || addr.fullAddress || addr.street || 'Details unavailable';
                                  
                                  return (
                                      <li key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded border border-gray-100 dark:border-gray-700 flex flex-col gap-1">
                                          <span className="text-[10px] text-brand-500 dark:text-orange-500 font-bold uppercase tracking-wider">{labelName}</span>
                                          <span className="text-sm text-gray-900 dark:text-gray-200">{addressText}</span>
                                      </li>
                                  );
                              })}
                          </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Registered</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedUser.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Role</p>
                    <div className="mt-1">
                      <Badge variant={selectedUser.role === 'admin' ? 'info' : selectedUser.role === 'courier' ? 'warning' : 'success'}>
                        {selectedUser.role || 'customer'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Payment Methods</p>
                    {isLoadingPayments ? (
                      <div className="text-sm text-gray-400">Loading cards...</div>
                    ) : userPaymentMethods.length === 0 ? (
                      <div className="text-sm text-gray-400 italic">No payment methods registered.</div>
                    ) : (
                      <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {userPaymentMethods.map(pm => (
                          <div key={pm.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600">
                            <div className={`w-14 h-8 rounded-md flex items-center justify-center text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getBrandColor(pm.brand)}`}>
                              {pm.brand}
                            </div>
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">•••• {pm.last4}</span>
                              {pm.holderName && <span className="text-xs text-gray-500">{pm.holderName}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Order History</p>
                    {userOrders.length === 0 ? (
                      <div className="text-sm text-gray-400 italic">No orders found for this user.</div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {userOrders.map(order => (
                          <div key={order.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-600">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">#{order.id.slice(0, 6).toUpperCase()}</span>
                              <span className="text-[10px] text-gray-500">{formatDate(order.createdAt)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <Badge variant={order.status === 'delivered' || order.status === 'Delivered' ? 'success' : 'info'} className="text-[10px] px-1.5 py-0 mb-1">
                                {order.status}
                              </Badge>
                              <span className="text-xs font-bold text-gray-900 dark:text-white">{new Intl.NumberFormat('ru-RU').format(order.totalAmount || 0)} UZS</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-white">Change Role:</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleUpdateRole('admin')} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium text-sm">
                      Set as Admin
                    </button>
                    <button onClick={() => handleUpdateRole('courier')} className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 font-medium text-sm">
                      Set as Courier
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setModalMode(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteUserId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to permanently delete this user account? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteUserId(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={executeDeleteUser}
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
