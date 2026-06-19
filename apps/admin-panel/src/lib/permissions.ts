export const ADMIN_ROLES = [
  'super_admin',
  'admin',
  'operator',
  'restaurant_manager',
  'courier_manager',
  'support',
  'analyst',
  'viewer',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'dashboard:view',
  'orders:view',
  'orders:update_status',
  'orders:assign_courier',
  'restaurants:view',
  'restaurants:create',
  'restaurants:update',
  'restaurants:delete_or_archive',
  'catalog:view',
  'catalog:create',
  'catalog:update',
  'catalog:delete_or_archive',
  'couriers:view',
  'couriers:create',
  'couriers:update',
  'couriers:archive',
  'users:view',
  'admins:view',
  'admins:create',
  'admins:update_roles',
  'reports:view',
  'reports:export',
  'settings:view',
  'settings:update',
  'geozones:view',
  'geozones:create',
  'geozones:update',
  'geozones:delete_or_archive',
  'audit_logs:view',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type RolePermissionDocument = {
  role: AdminRole;
  permissions: AdminPermission[];
  updatedAt?: unknown;
  updatedBy?: string | null;
};

const allPermissions = [...ADMIN_PERMISSIONS];

export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: allPermissions,
  admin: allPermissions.filter((permission) => permission !== 'admins:update_roles'),
  operator: [
    'dashboard:view',
    'orders:view',
    'orders:update_status',
    'orders:assign_courier',
    'restaurants:view',
    'catalog:view',
    'couriers:view',
    'users:view',
  ],
  restaurant_manager: [
    'dashboard:view',
    'orders:view',
    'orders:update_status',
    'restaurants:view',
    'restaurants:update',
    'catalog:view',
    'catalog:create',
    'catalog:update',
  ],
  courier_manager: [
    'dashboard:view',
    'orders:view',
    'orders:assign_courier',
    'couriers:view',
    'couriers:create',
    'couriers:update',
    'couriers:archive',
  ],
  support: [
    'dashboard:view',
    'orders:view',
    'restaurants:view',
    'catalog:view',
    'couriers:view',
    'users:view',
  ],
  analyst: [
    'dashboard:view',
    'orders:view',
    'restaurants:view',
    'catalog:view',
    'couriers:view',
    'reports:view',
    'reports:export',
    'audit_logs:view',
  ],
  viewer: [
    'dashboard:view',
    'orders:view',
    'restaurants:view',
    'catalog:view',
    'couriers:view',
    'reports:view',
  ],
};

export function normalizeAdminRole(role?: string | null): AdminRole {
  if (role === 'superadmin') return 'super_admin';
  if (ADMIN_ROLES.includes(role as AdminRole)) return role as AdminRole;
  return 'viewer';
}

export function getDefaultPermissions(role?: string | null): AdminPermission[] {
  return DEFAULT_ROLE_PERMISSIONS[normalizeAdminRole(role)];
}

export function hasPermission(role: string | null | undefined, permission: AdminPermission, overrides?: Partial<Record<AdminRole, AdminPermission[]>>) {
  const normalized = normalizeAdminRole(role);
  const permissions = overrides?.[normalized] || DEFAULT_ROLE_PERMISSIONS[normalized];
  return permissions.includes(permission);
}
