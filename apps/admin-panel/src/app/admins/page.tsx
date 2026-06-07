'use client';

import React, { useState, useEffect } from 'react';
import { DataTable, type ColumnDef } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { db, collection, query, limit, getDocs, doc, updateDoc, where, onSnapshot } from '@repo/firebase-config';
import { COLLECTIONS, PAGE_SIZE, User } from '@repo/shared-types';
import toast from 'react-hot-toast';

import { useAuth } from '@/context/AuthContext';

export default function AdminsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user: currentUser } = useAuth();
  
  // Get the current user's role from the fetched users list
  const currentUserData = users.find(u => u.uid === currentUser?.uid);
  const isSuperadmin = currentUserData?.role === 'superadmin';

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('role', 'in', ['admin', 'superadmin']),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const data: User[] = [];
      snapshot.forEach((doc) => {
        data.push({ uid: doc.id, ...doc.data() } as User);
      });
      
      // Safety net: Always show the actual owner in the list, even if DB sync is slow or failed
      if (currentUser && currentUser.email === 'admin@2321eats.com') {
        const exists = data.find(u => u.uid === currentUser.uid);
        if (!exists) {
          data.unshift({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || '2321',
            phone: '',
            photoURL: currentUser.photoURL || '',
            role: 'superadmin',
            savedAddresses: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          // If they exist but don't have superadmin, force it in the UI so they don't get stuck
          exists.role = 'superadmin';
        }
      }

      data.sort((a, b) => {
        if (a.email === 'admin@2321eats.com') return -1;
        if (b.email === 'admin@2321eats.com') return 1;
        return 0;
      });

      setUsers(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching admins:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [confirmDemoteUserId, setConfirmDemoteUserId] = useState<string | null>(null);

  const handleDemoteAdmin = (userId: string) => {
    if (!isSuperadmin) {
      toast.error('Only the Main Admin can remove other admins.');
      return;
    }
    setConfirmDemoteUserId(userId);
  };

  const executeDemoteAdmin = () => {
    if (!confirmDemoteUserId) return;
    const userRef = doc(db, COLLECTIONS.USERS, confirmDemoteUserId);
    updateDoc(userRef, { role: 'customer' }).catch(err => console.warn(err));
    
    setUsers(prev => prev.filter(u => u.uid !== confirmDemoteUserId));
    toast.success('Admin demoted to customer.');
    setConfirmDemoteUserId(null);
  };

  const columns: ColumnDef<User>[] = [
    {
      header: 'Admin',
      accessor: 'displayName',
      cell: (row) => {
        const name = row.displayName || (row as any).name || 'Unknown Admin';
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
              <p className="font-medium text-gray-900 dark:text-white">
                {name}
              </p>
              <p className="text-xs text-gray-500">{row.email || 'No email provided'}</p>
            </div>
          </div>
        );
      },
    },
    { header: 'Phone', accessor: 'phone', cell: (row) => row.phone || 'N/A' },
    {
      header: 'Role',
      accessor: 'role',
      cell: (row) => (
        <Badge variant={row.role === 'superadmin' ? 'warning' : 'info'}>
          {row.role === 'superadmin' ? 'Main Admin' : 'Admin'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: 'uid',
      cell: (row: User) => (
        <div className="flex items-center justify-end gap-2">
          {isSuperadmin && row.uid !== currentUser?.uid && row.role !== 'superadmin' && (
            <button 
              onClick={() => handleDemoteAdmin(row.uid)}
              className="text-xs px-3 py-1.5 rounded font-medium bg-red-100 text-red-700 hover:bg-red-200"
            >
              Remove Admin
            </button>
          )}
          {isSuperadmin && row.uid !== currentUser?.uid && (
            <button
              onClick={() => { 
                setSelectedUser(row);
                setEditName(row.displayName || (row as any).name || '');
                setEditEmail(row.email || '');
                setEditPhone(row.phone || '');
                setModalMode('edit'); 
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-warning-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-warning-500"
              title="Edit Admin"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => { setSelectedUser(row); setModalMode('view'); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400"
            title="View Details"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedUser) return;
    try {
      const userRef = doc(db, COLLECTIONS.USERS, selectedUser.uid);
      updateDoc(userRef, { role: newRole }).catch(err => console.warn(err));
      
      if (newRole !== 'admin' && newRole !== 'superadmin') {
        setUsers(prev => prev.filter(u => u.uid !== selectedUser.uid));
      } else {
        setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, role: newRole } : u));
      }
      toast.success(`Role updated to ${newRole}`);
      setModalMode(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update role');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    try {
      const userRef = doc(db, COLLECTIONS.USERS, selectedUser.uid);
      await updateDoc(userRef, { 
        displayName: editName,
        email: editEmail,
        phone: editPhone
      });
      
      setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, displayName: editName, email: editEmail, phone: editPhone } : u));
      
      toast.success('Admin details updated successfully');
      setModalMode(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update admin details');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admins Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage platform administrators. Secured with Firestore real-time sync.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading admins database...</div>
        ) : (
          <DataTable
            columns={columns}
            data={users}
            searchPlaceholder="Search admins by name or email..."
            searchAccessor={(item, q) => (item.displayName || '').toLowerCase().includes(q) || (item.email || '').toLowerCase().includes(q)}
          />
        )}
      </div>

      {/* View/Edit Modal */}
      {modalMode && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {modalMode === 'view' ? 'Admin Details' : 'Edit Admin'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedUser.displayName || (selectedUser as any).name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedUser.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedUser.phone || 'N/A'}</p>
              </div>
              
              {modalMode === 'view' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
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
                      <Badge variant={selectedUser.role === 'superadmin' ? 'warning' : 'info'}>
                        {selectedUser.role === 'superadmin' ? 'Main Admin' : 'Admin'}
                      </Badge>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input 
                      type="email" 
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input 
                      type="tel" 
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  <div className="flex gap-2 justify-end pt-2">
                    <button 
                      onClick={() => setModalMode(null)} 
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveEdit} 
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                    >
                      Save Changes
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
      {/* Confirm Demote Modal */}
      {confirmDemoteUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
              <svg className="h-6 w-6 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Remove Admin</h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to demote this admin to a customer? They will lose access to the admin panel.
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setConfirmDemoteUserId(null)} 
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={executeDemoteAdmin} 
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
