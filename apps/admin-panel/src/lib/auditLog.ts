import { addDoc, collection, serverTimestamp } from '@repo/firebase-config';
import { db } from '@repo/firebase-config';

const ADMIN_AUDIT_LOG_ENABLED = process.env.NEXT_PUBLIC_ADMIN_AUDIT_LOG_ENABLED !== 'false';

export type AdminAuditAction =
  | 'auth.login'
  | 'order.status_changed'
  | 'order.courier_assigned'
  | 'order.created'
  | 'settings.changed'
  | 'restaurant.changed'
  | 'restaurant.created'
  | 'restaurant.archived'
  | 'catalog.changed'
  | 'catalog.availability_changed'
  | 'courier.changed'
  | 'courier.created'
  | 'courier.archived'
  | 'role.permissions_changed'
  | 'role.user_assigned'
  | 'geozone.created'
  | 'geozone.changed'
  | 'geozone.archived'
  | 'report.exported';

type AuditLogInput = {
  action: AdminAuditAction;
  entityType: 'order' | 'courier' | 'restaurant' | 'settings' | 'user' | 'role' | 'geozone' | 'catalog' | 'report';
  entityId: string;
  entityName?: string;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export async function writeAdminAuditLog(input: AuditLogInput) {
  if (!ADMIN_AUDIT_LOG_ENABLED) {
    return;
  }

  try {
    await addDoc(collection(db, 'auditLogs'), {
      ...input,
      actorEmail: input.actorEmail || 'unknown-admin',
      actorName: input.actorName || 'Administrator',
      actorRole: input.actorRole || 'admin',
      source: 'admin-panel',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Do not block the production workflow if logging rules are not deployed yet.
    console.warn('Admin audit log write failed:', error);
  }
}
