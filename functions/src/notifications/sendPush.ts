// =============================================
// sendPushNotification — Utility Function
// =============================================
// Reusable FCM notification sender

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

interface PushNotificationParams {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Send a push notification via Firebase Cloud Messaging
 */
export async function sendPushNotification(
  params: PushNotificationParams
): Promise<string | null> {
  const { token, title, body, data, imageUrl } = params;

  if (!token) {
    console.warn('[sendPushNotification] No FCM token provided');
    return null;
  }

  const message: admin.messaging.Message = {
    token,
    notification: {
      title,
      body,
      ...(imageUrl && { imageUrl }),
    },
    ...(data && { data }),
    android: {
      priority: 'high' as const,
      notification: {
        sound: 'default',
        channelId: 'orders',
        priority: 'high' as const,
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const messageId = await admin.messaging().send(message);
    console.log(`[sendPushNotification] Sent: ${messageId}`);
    return messageId;
  } catch (error: unknown) {
    const fcmError = error as { code?: string };
    // If token is invalid/expired, we should clean it up
    if (
      fcmError.code === 'messaging/invalid-registration-token' ||
      fcmError.code === 'messaging/registration-token-not-registered'
    ) {
      console.warn(
        `[sendPushNotification] Invalid/expired token, should be cleaned up`
      );
    } else {
      console.error('[sendPushNotification] Error:', error);
    }
    return null;
  }
}

/**
 * Send push notifications to multiple tokens
 */
export async function sendPushNotificationBatch(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (!tokens.length) return 0;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    ...(data && { data }),
    android: {
      priority: 'high' as const,
      notification: {
        sound: 'default',
        channelId: 'orders',
      },
    },
    apns: {
      payload: {
        aps: { sound: 'default' },
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `[sendPushNotificationBatch] ${response.successCount}/${tokens.length} sent successfully`
    );
    return response.successCount;
  } catch (error) {
    console.error('[sendPushNotificationBatch] Error:', error);
    return 0;
  }
}
