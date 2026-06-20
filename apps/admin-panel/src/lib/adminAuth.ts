export const MAIN_ADMIN_EMAILS = ['admin@2321eats.com', 'mainadmin@demo.com'] as const;

const ADMIN_PANEL_ROLES = new Set([
  'superadmin',
  'admin',
  'operator',
  'dispatcher',
  'support',
  'analyst',
  'viewer',
  'manager',
  'courier_manager',
  'restaurant_manager',
]);

export function normalizeEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase();
}

export function isMainAdminEmail(email?: string | null) {
  return (MAIN_ADMIN_EMAILS as readonly string[]).includes(normalizeEmail(email));
}

export function normalizeAdminRole(role?: unknown) {
  if (typeof role !== 'string') return '';
  const normalized = role.trim().toLowerCase();
  return normalized === 'super_admin' ? 'superadmin' : normalized;
}

export function isAdminPanelRole(role?: unknown) {
  return ADMIN_PANEL_ROLES.has(normalizeAdminRole(role));
}

export function canReadAuditLogsRole(role?: unknown) {
  const normalized = normalizeAdminRole(role);
  return normalized === 'superadmin' || normalized === 'admin' || normalized === 'analyst';
}

export function displayAdminRole(role?: unknown) {
  switch (normalizeAdminRole(role)) {
    case 'superadmin':
      return 'Main Admin';
    case 'admin':
      return 'Admin';
    case 'operator':
      return 'Operator';
    case 'dispatcher':
      return 'Dispatcher';
    case 'support':
      return 'Support';
    case 'analyst':
      return 'Analyst';
    case 'viewer':
      return 'Viewer';
    case 'manager':
      return 'Manager';
    case 'courier_manager':
      return 'Courier Manager';
    case 'restaurant_manager':
      return 'Restaurant Manager';
    default:
      return 'No admin role';
  }
}
