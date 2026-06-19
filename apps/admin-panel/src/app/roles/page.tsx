'use client';

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { db, collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from '@repo/firebase-config';
import { ADMIN_PERMISSIONS, ADMIN_ROLES, DEFAULT_ROLE_PERMISSIONS, AdminPermission, AdminRole, normalizeAdminRole } from '@/lib/permissions';
import { writeAdminAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/context/AuthContext';

type AdminUser = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
};

function permissionGroup(permission: string) {
  return permission.split(':')[0];
}

function roleLabel(role: AdminRole) {
  return role.replace(/_/g, ' ');
}

export default function RolesPage() {
  const { user } = useAuth();
  const [matrix, setMatrix] = useState<Record<AdminRole, AdminPermission[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [savingRole, setSavingRole] = useState<AdminRole | null>(null);
  const [assigningUserId, setAssigningUserId] = useState('');
  const [assigningRole, setAssigningRole] = useState<AdminRole>('viewer');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const groupedPermissions = useMemo(() => {
    return ADMIN_PERMISSIONS.reduce<Record<string, AdminPermission[]>>((acc, permission) => {
      const group = permissionGroup(permission);
      acc[group] = acc[group] || [];
      acc[group].push(permission);
      return acc;
    }, {});
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      setLoadError('');
      const [roleSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'rolePermissions')),
        getDocs(collection(db, 'users')),
      ]);
      const nextMatrix = { ...DEFAULT_ROLE_PERMISSIONS };
      roleSnap.forEach((documentSnapshot) => {
        const role = normalizeAdminRole(documentSnapshot.id);
        const data = documentSnapshot.data();
        if (Array.isArray(data.permissions)) {
          nextMatrix[role] = data.permissions.filter((permission) => ADMIN_PERMISSIONS.includes(permission)) as AdminPermission[];
        }
      });
      setMatrix(nextMatrix);
      setUsers(usersSnap.docs.map((documentSnapshot) => ({ uid: documentSnapshot.id, ...documentSnapshot.data() })) as AdminUser[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load role matrix.');
      toast.error('Failed to load role matrix');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const togglePermission = (role: AdminRole, permission: AdminPermission) => {
    if (role === 'super_admin') {
      toast.error('super_admin keeps all permissions to prevent lockout.');
      return;
    }
    setMatrix((current) => {
      const rolePermissions = current[role] || [];
      const hasPermission = rolePermissions.includes(permission);
      return {
        ...current,
        [role]: hasPermission
          ? rolePermissions.filter((item) => item !== permission)
          : [...rolePermissions, permission],
      };
    });
  };

  const saveRole = async (role: AdminRole) => {
    setSavingRole(role);
    try {
      const permissions = role === 'super_admin' ? DEFAULT_ROLE_PERMISSIONS.super_admin : matrix[role];
      await setDoc(doc(db, 'rolePermissions', role), {
        role,
        permissions,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || null,
      }, { merge: true });
      await writeAdminAuditLog({
        action: 'role.permissions_changed',
        entityType: 'role',
        entityId: role,
        entityName: role,
        actorEmail: user?.email,
        after: { permissions },
      });
      toast.success(`${roleLabel(role)} permissions saved`);
    } catch (error) {
      toast.error('Failed to save permissions');
    } finally {
      setSavingRole(null);
    }
  };

  const assignRole = async () => {
    const target = users.find((item) => item.uid === assigningUserId);
    if (!target) {
      toast.error('Select a user');
      return;
    }
    const currentSuperAdmins = users.filter((item) => normalizeAdminRole(item.role) === 'super_admin');
    if (normalizeAdminRole(target.role) === 'super_admin' && assigningRole !== 'super_admin' && currentSuperAdmins.length <= 1) {
      toast.error('At least one super_admin must remain.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', target.uid), {
        role: assigningRole,
        updatedAt: serverTimestamp(),
      });
      await writeAdminAuditLog({
        action: 'role.user_assigned',
        entityType: 'user',
        entityId: target.uid,
        entityName: target.email || target.displayName || target.uid,
        actorEmail: user?.email,
        before: { role: target.role || null },
        after: { role: assigningRole },
      });
      toast.success('User role updated');
      await loadData();
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const adminUsers = users.filter((item) => ['admin', 'superadmin', ...ADMIN_ROLES].includes(String(item.role || '')));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-500">Security</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users & Roles</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Real role matrix stored in Firestore. Client-side gating is UX only; deploy Firestore rules for hard enforcement.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        Current admin account is never auto-demoted here. The matrix saves permissions to <span className="font-mono">rolePermissions</span>; production rules must be deployed separately for server-side enforcement.
      </div>
      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          Role matrix cannot read Firestore yet. Deploy the latest rules before using server-side role enforcement.
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-black text-gray-900 dark:text-white">Assign role to admin user</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px_auto]">
          <select value={assigningUserId} onChange={(event) => setAssigningUserId(event.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-semibold dark:border-gray-700 dark:bg-gray-900">
            <option value="">Select admin user</option>
            {adminUsers.map((adminUser) => (
              <option key={adminUser.uid} value={adminUser.uid}>{adminUser.email || adminUser.displayName || adminUser.uid} · {normalizeAdminRole(adminUser.role)}</option>
            ))}
          </select>
          <select value={assigningRole} onChange={(event) => setAssigningRole(event.target.value as AdminRole)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-semibold dark:border-gray-700 dark:bg-gray-900">
            {ADMIN_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select>
          <button type="button" onClick={assignRole} className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-black text-white">Assign</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-10 text-center text-gray-500">Loading role matrix...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-black uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left dark:bg-gray-800">Permission</th>
                  {ADMIN_ROLES.map((role) => (
                    <th key={role} className="px-4 py-3 text-center">{roleLabel(role)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(groupedPermissions).map(([group, permissions]) => (
                  <React.Fragment key={group}>
                    <tr className="bg-gray-50/80 dark:bg-gray-800/70">
                      <td colSpan={ADMIN_ROLES.length + 1} className="px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-gray-500">{group}</td>
                    </tr>
                    {permissions.map((permission) => (
                      <tr key={permission}>
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 font-mono text-xs font-bold text-gray-700 dark:bg-gray-900 dark:text-gray-200">{permission}</td>
                        {ADMIN_ROLES.map((role) => (
                          <td key={`${role}:${permission}`} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={(matrix[role] || []).includes(permission)}
                              disabled={role === 'super_admin'}
                              onChange={() => togglePermission(role, permission)}
                              className="h-5 w-5 accent-brand-500 disabled:opacity-40"
                              aria-label={`${role} ${permission}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <td className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-xs font-black uppercase text-gray-500 dark:bg-gray-800">Save role</td>
                  {ADMIN_ROLES.map((role) => (
                    <td key={role} className="px-4 py-3 text-center">
                      <button type="button" disabled={savingRole === role} onClick={() => saveRole(role)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                        {savingRole === role ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
