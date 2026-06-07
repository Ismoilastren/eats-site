// =============================================
// onOrderStatusUpdate — Firestore Trigger
// =============================================
// When an order status changes:
// 1. Notifies the client via FCM
// 2. Prevents automatic courier assignment
// 3. When status = 'delivered', updates courier stats

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  pending: {
    title: '✅ Order Received!',
    body: 'Your order has been received by the restaurant.',
  },
  preparing: {
    title: '👨‍🍳 Preparing Your Order',
    body: 'The restaurant has started cooking your order.',
  },
  courier_picked_up: {
    title: '🚗 Courier is on the way!',
    body: 'Your order has been picked up and is heading to you.',
  },
  delivered: {
    title: '🎉 Order Delivered!',
    body: 'Enjoy your meal! Don\'t forget to rate your experience.',
  },
  cancelled: {
    title: '❌ Order Cancelled',
    body: 'Your order has been cancelled.',
  },
};

export const onOrderStatusUpdate = onDocumentUpdated(
  'orders/{orderId}',
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    const oldStatus = beforeData.status;
    const newStatus = afterData.status;
    const orderId = event.params.orderId;

    // Only process if status actually changed
    if (oldStatus === newStatus) return;

    console.log(
      `[onOrderStatusUpdate] Order ${orderId}: ${oldStatus} → ${newStatus}`
    );

    try {
      // 1. Send FCM notification to the client
      const statusMessage = STATUS_MESSAGES[newStatus];
      if (statusMessage && afterData.userId) {
        const userDoc = await db
          .collection('users')
          .doc(afterData.userId)
          .get();
        const userData = userDoc.data();

        if (userData?.fcmToken) {
          const message: admin.messaging.Message = {
            token: userData.fcmToken,
            notification: {
              title: statusMessage.title,
              body: statusMessage.body,
            },
            data: {
              orderId: orderId,
              type: 'status_update',
              status: newStatus,
            },
          };

          try {
            await admin.messaging().send(message);
            console.log(
              `[onOrderStatusUpdate] FCM sent to user ${afterData.userId}`
            );
          } catch (fcmError) {
            console.error('[onOrderStatusUpdate] FCM error:', fcmError);
          }
        }
      }

      // 2. Courier assignment is explicit only. The courier app accepts orders
      // from the radar; this trigger never injects assignedCourier/courierId.

      // 3. When order is 'delivered', update courier stats
      const assignedCourierId = afterData.assignedCourier?.id || afterData.courierId;
      if (newStatus === 'delivered' && assignedCourierId) {
        const batch = db.batch();

        // Update courier stats
        const courierRef = db
          .collection('couriers')
          .doc(assignedCourierId);
        batch.update(courierRef, {
          isAvailable: true,
          currentOrderId: null,
          totalDeliveries: admin.firestore.FieldValue.increment(1),
          todayEarnings: admin.firestore.FieldValue.increment(
            Number(afterData.deliveryFee || 0)
          ),
          totalEarnings: admin.firestore.FieldValue.increment(
            Number(afterData.deliveryFee || 0)
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Set delivery timestamp
        batch.update(event.data!.after.ref, {
          deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        console.log(
          `[onOrderStatusUpdate] Courier ${assignedCourierId} stats updated after delivery`
        );
      }
    } catch (error) {
      console.error(
        `[onOrderStatusUpdate] Error processing status change for ${orderId}:`,
        error
      );
    }
  }
);
