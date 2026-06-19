import { addDoc, collection, serverTimestamp } from '@repo/firebase-config';
import { db } from '@repo/firebase-config';

const ADMIN_AUDIT_LOG_ENABLED = process.env.NEXT_PUBLIC_ADMIN_AUDIT_LOG_ENABLED === 'true';

export type AdminAuditAction =
  | 'order.status_changed'
  | 'order.courier_assigned'
  | 'order.created'
  | 'settings.changed'
  | 'restaurant.changed'
  | 'courier.changed';

type AuditLogInput = {
  action: AdminAuditAction;
  entityType: 'order' | 'courier' | 'restaurant' | 'settings' | 'user';
  entityId: string;
  actorEmail?: string | null;
  actorName?: string | null;
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
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Do not block the production workflow if logging rules are not deployed yet.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Admin audit log write failed:', error);
    }
  }
}
