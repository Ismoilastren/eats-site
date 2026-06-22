'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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

const cleanText = (value: unknown) => String(value || '').trim();
const normalizeEmail = (value: unknown) => cleanText(value).toLowerCase();
const normalizePhone = (value: unknown) => cleanText(value).replace(/\D/g, '');

const isRealAddress = (value: unknown) => {
  const address = cleanText(value);
  if (!address) return false;
  if (/^(unknown location|map location|selected point|address could not be resolved|map is unavailable|enter readable address|current gps location|order delivery)$/i.test(address)) return false;
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) return false;
  return true;
};

const getAddressText = (address: any) =>
  cleanText(address.addressDetails || address.address || address.fullAddress || address.street);

const getAddressCoordinates = (address: any) => {
  const location = address.location || address.deliveryLocation || address.customerLocation || {};
  const lat = Number(address.lat ?? address.latitude ?? location.lat ?? location.latitude);
  const lng = Number(address.lng ?? address.longitude ?? location.lng ?? location.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '';
};

const normalizePaymentMethod = (method: any) => {
  if (!method || typeof method !== 'object') return null;
  const type = cleanText(method.type || method.method || method.provider || method.kind).toLowerCase();
  if (['cash', 'cod', 'cash_on_delivery'].includes(type)) return null;
  const last4 = cleanText(method.last4 || method.cardLast4).replace(/\D/g, '').slice(-4);
  if (last4.length !== 4) return null;
  const expiryCandidate = cleanText(method.expiry) || [
    cleanText(method.expiryMonth).padStart(2, '0'),
    cleanText(method.expiryYear).slice(-2),
  ].filter(Boolean).join('/');
  const expiry = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryCandidate) ? expiryCandidate : '';
  return {
    ...method,
    brand: cleanText(method.brand || method.cardBrand) || 'Card',
    holderName: cleanText(method.holderName || method.cardholderName),
    last4,
    expiry,
  };
};

const getOrderAddress = (order: any) => {
  const address = cleanText(order.deliveryAddress || order.customerAddress || order.address || order.customer?.address);
  if (!isRealAddress(address)) return null;
  return {
    id: `${order.id}-order-address`,
    userId: order.userId || order.customerId || order.customer?.uid,
    label: order.restaurantName ? `Order delivery • ${order.restaurantName}` : 'Order delivery',
    address,
    deliveryLocation: order.deliveryLocation || order.customerLocation,
    source: 'order',
    createdAt: order.createdAt,
  };
};

const getOrderPaymentMethod = (order: any) => {
  const raw = order.paymentMethod || order.payment;
  if (!raw || typeof raw !== 'object') return null;
  const normalized = normalizePaymentMethod({
    ...raw,
    id: raw.paymentMethodId || raw.id || `${order.id}-payment`,
    userId: order.userId || order.customerId || order.customer?.uid,
  });
  return normalized ? { ...normalized, source: 'order' } : null;
};

const orderMatchesIdentity = (order: any, uids: Set<string>, emails: Set<string>, phones: Set<string>) => {
  const orderUids = [
    order.userId,
    order.customerId,
    order.customerUid,
    order.customer?.uid,
    order.customer?.id,
  ].map(cleanText).filter(Boolean);
  if (orderUids.some((uid) => uids.has(uid))) return true;

  const orderEmails = [
    order.customerEmail,
    order.email,
    order.customer?.email,
  ].map(normalizeEmail).filter(Boolean);
  if (orderEmails.some((email) => emails.has(email))) return true;

  const orderPhones = [
    order.customerPhone,
    order.phone,
    order.customer?.phone,
  ].map(normalizePhone).filter(Boolean);
  return orderPhones.some((phone) => phones.has(phone));
};

const formatSource = (relatedUsers: User[]) => {
  const sources = new Set(relatedUsers.map((user) => cleanText((user as any).source)).filter(Boolean));
  const hasApp = sources.has('app') || sources.has('client-app');
  const hasWeb = sources.has('website') || sources.has('main-site') || sources.size === 0;
  if (hasApp && hasWeb) return 'Both';
  if (hasApp) return 'App User';
  return 'Website User';
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
                {['app', 'client-app'].includes((row as any).source) ? (
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
  const [relatedUsers, setRelatedUsers] = useState<User[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  useEffect(() => {
    if (modalMode === 'view' && selectedUser) {
      const fetchUserData = async () => {
        setIsLoadingPayments(true);
        try {
          const email = normalizeEmail(selectedUser.email);
          const phone = normalizePhone(selectedUser.phone);

          const usersById = new Map<string, User>();
          usersById.set(selectedUser.uid, selectedUser);

          const relatedUserQueries = [
            ...(email ? [
              query(collection(db, COLLECTIONS.USERS), where('email', '==', email)),
              query(collection(db, COLLECTIONS.USERS), where('email', '==', selectedUser.email)),
            ] : []),
            ...(phone ? [
              query(collection(db, COLLECTIONS.USERS), where('phone', '==', selectedUser.phone)),
              query(collection(db, COLLECTIONS.USERS), where('phone', '==', phone)),
            ] : []),
          ];

          const relatedUserSnapshots = await Promise.all(
            relatedUserQueries.map((userQuery) => getDocs(userQuery).catch(() => null))
          );
          relatedUserSnapshots.forEach((snapshot) => {
            snapshot?.docs.forEach((userDoc) => {
              usersById.set(userDoc.id, { uid: userDoc.id, ...userDoc.data() } as User);
            });
          });

          const related = Array.from(usersById.values());
          const relatedUids = related.map((user) => user.uid).filter(Boolean);
          const emailCandidates = new Set(
            related.flatMap((user) => [user.email, (user as any).customerEmail]).map(normalizeEmail).filter(Boolean)
          );
          const phoneCandidates = new Set(
            related.flatMap((user) => [user.phone, (user as any).phoneNumber, (user as any).customerPhone]).map(normalizePhone).filter(Boolean)
          );
          const uidCandidates = new Set(relatedUids.map(cleanText).filter(Boolean));

          const addressDocs = await Promise.all(
            relatedUids.map(async (uid) => {
              const snapshot = await getDocs(collection(db, COLLECTIONS.USERS, uid, 'addresses')).catch(() => null);
              const subcollectionAddresses = snapshot?.docs.map((addressDoc) => ({
                id: addressDoc.id,
                userId: uid,
                ...addressDoc.data(),
              })) || [];
              const parentAddresses = Array.isArray((usersById.get(uid) as any)?.savedAddresses)
                ? (usersById.get(uid) as any).savedAddresses.map((address: any, index: number) => ({
                    id: address.id || `${uid}-parent-${index}`,
                    userId: uid,
                    ...address,
                  }))
                : [];
              return [...subcollectionAddresses, ...parentAddresses];
            })
          );

          const addressesByKey = new Map<string, any>();
          addressDocs.flat().forEach((address) => {
            const addressText = getAddressText(address);
            if (!isRealAddress(addressText)) return;
            const coords = getAddressCoordinates(address);
            addressesByKey.set(`${addressText.toLowerCase()}-${coords}`, address);
          });
          
          const paymentDocs = await Promise.all(
            relatedUids.map(async (uid) => {
              const snapshot = await getDocs(collection(db, COLLECTIONS.USERS, uid, 'paymentMethods')).catch(() => null);
              const subcollectionPayments = snapshot?.docs.map((paymentDoc) => ({
                id: paymentDoc.id,
                userId: uid,
                ...paymentDoc.data(),
              })) || [];
              const parentPayments = Array.isArray((usersById.get(uid) as any)?.paymentMethods)
                ? (usersById.get(uid) as any).paymentMethods.map((method: any, index: number) => ({
                    id: method.id || `${uid}-payment-${index}`,
                    userId: uid,
                    ...method,
                  }))
                : [];
              return [...subcollectionPayments, ...parentPayments];
            })
          );
          const paymentByKey = new Map<string, any>();
          paymentDocs.flat().forEach((method) => {
            const normalized = normalizePaymentMethod(method);
            if (!normalized) return;
            paymentByKey.set(`${normalized.brand}-${normalized.last4}-${normalized.expiry}`, normalized);
          });

          // Fetch Orders. Customer order payloads vary by app generation, so normalize UID/email/phone client-side.
          const orderSnapshots = await Promise.all([
            getDocs(collection(db, COLLECTIONS.ORDERS)).catch(() => null),
          ]);
          const ordersById = new Map<string, any>();
          orderSnapshots.forEach((orderSnap) => {
            orderSnap?.docs.forEach((orderDoc) => {
              const order = { id: orderDoc.id, ...orderDoc.data() };
              if (orderMatchesIdentity(order, uidCandidates, emailCandidates, phoneCandidates)) {
                ordersById.set(orderDoc.id, order);
              }
            });
          });
          const ordersData: any[] = Array.from(ordersById.values());
          ordersData.sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));
          ordersData.forEach((order) => {
            const orderPayment = getOrderPaymentMethod(order);
            if (orderPayment) {
              paymentByKey.set(`${orderPayment.brand}-${orderPayment.last4}-${orderPayment.expiry}`, orderPayment);
            }
          });

          setRelatedUsers(related);
          setUserPaymentMethods(Array.from(paymentByKey.values()));
          setAddresses(Array.from(addressesByKey.values()));
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
      setRelatedUsers([]);
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
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-500">{modalMode === 'view' ? 'Customer profile' : 'Role management'}</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">
                {modalMode === 'view' ? 'User Details' : 'Edit User Role'}
              </h2>
            </div>
            
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="mt-1 break-words font-bold text-gray-900 dark:text-white">{(selectedUser as any).fullName || selectedUser.displayName || 'Unknown'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="mt-1 break-words font-bold text-gray-900 dark:text-white">{(selectedUser as any).email || 'No email provided'}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/50">
                <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                <p className="mt-1 break-words font-bold text-gray-900 dark:text-white">{(selectedUser as any).phone || 'Not provided'}</p>
              </div>
              </div>
              
              {modalMode === 'view' ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Source</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatSource(relatedUsers.length ? relatedUsers : [selectedUser])}</p>
                    {relatedUsers.length > 1 && (
                      <p className="mt-1 text-xs text-gray-400">Linked records: {relatedUsers.length}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="mt-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Saved Addresses</p>
                      {addresses.length === 0 ? (
                          <p className="font-medium text-gray-900 dark:text-white">0 locations</p>
                      ) : (
                          <ul className="flex flex-col gap-2">
                              {addresses.map((addr, idx) => {
                                  // Brute-force extraction matching Client schema
                                  const labelName = addr.label || addr.title || addr.type || 'Saved Location';
                                  const addressText = getAddressText(addr) || 'Details unavailable';
                                  const coords = getAddressCoordinates(addr);
                                  
                                  return (
                                      <li key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded border border-gray-100 dark:border-gray-700 flex flex-col gap-1">
                                          <span className="text-[10px] text-brand-500 dark:text-orange-500 font-bold uppercase tracking-wider">
                                            {labelName}{addr.isDefault ? ' • Default' : ''}
                                          </span>
                                          <span className="text-sm text-gray-900 dark:text-gray-200">{addressText}</span>
                                          {coords && <span className="text-[10px] text-gray-400">{coords}</span>}
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

                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">Payment Methods</p>
                    {isLoadingPayments ? (
                      <div className="text-sm text-gray-400">Loading cards...</div>
                    ) : userPaymentMethods.length === 0 ? (
                      <div className="text-sm text-gray-400 italic">No payment methods registered.</div>
                    ) : (
                      <div className="space-y-2">
                        {userPaymentMethods.map(pm => (
                          <div key={pm.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                            <div className={`w-14 h-8 rounded-md flex items-center justify-center text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getBrandColor(pm.brand)}`}>
                              {pm.brand}
                            </div>
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">•••• {pm.last4}</span>
                              {pm.holderName && <span className="text-xs text-gray-500">{pm.holderName}</span>}
                              {pm.expiry && <span className="text-xs text-gray-400">Exp {pm.expiry}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">Order History</p>
                    {userOrders.length === 0 ? (
                      <div className="text-sm text-gray-400 italic">No orders found for this user.</div>
                    ) : (
                      <div className="space-y-2">
                        {userOrders.map(order => (
                          <Link key={order.id} href={`/orders/${order.id}`} onClick={() => setModalMode(null)} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 transition hover:border-brand-200 hover:bg-brand-50/60 dark:border-gray-600 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">#{order.id.slice(0, 6).toUpperCase()}</span>
                              <span className="text-[10px] text-gray-500">{order.restaurantName || order.branchName || 'Restaurant'} • {formatDate(order.createdAt)}</span>
                              {order.source && <span className="text-[10px] text-gray-400">{order.source}</span>}
                            </div>
                            <div className="flex flex-col items-end">
                              <Badge variant={order.status === 'delivered' || order.status === 'Delivered' ? 'success' : 'info'} className="text-[10px] px-1.5 py-0 mb-1">
                                {order.status}
                              </Badge>
                              <span className="text-xs font-bold text-gray-900 dark:text-white">{new Intl.NumberFormat('ru-RU').format(order.totalAmount || order.total || 0)} UZS</span>
                            </div>
                          </Link>
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

            <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700 flex justify-end">
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
