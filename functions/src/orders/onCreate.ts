// =============================================
// onOrderCreate — Firestore Trigger
// =============================================
// When a client creates a new order:
// 1. Validates the order data
// 2. Locks initial state to pending/unassigned
// 3. Sends FCM notification to the restaurant

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Initialize admin SDK (only once across all function files)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const onOrderCreate = onDocumentCreated(
  'orders/{orderId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const orderId = event.params.orderId;
    const orderData = snapshot.data();

    console.log(`[onOrderCreate] New order ${orderId} created`);

    try {
      // 1. Validate required fields
      if (
        !orderData.userId ||
        !orderData.restaurantId ||
        !orderData.items ||
        orderData.items.length === 0
      ) {
        console.error(`[onOrderCreate] Invalid order data for ${orderId}`);
        await snapshot.ref.update({
          status: 'cancelled',
          cancelReason: 'Invalid order data',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      // 2. Lock the order into the canonical client-created state.
      // Do not auto-confirm or auto-assign here; the restaurant and courier apps
      // are responsible for explicit state transitions.
      await snapshot.ref.update({
        status: 'pending',
        courierId: null,
        assignedCourier: null,
        courierLocation: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[onOrderCreate] Order ${orderId} locked as pending/unassigned`);

      // 3. Get restaurant data to find owner for notification
      const restaurantDoc = await db
        .collection('restaurants')
        .doc(orderData.restaurantId)
        .get();

      if (restaurantDoc.exists) {
        const restaurantData = restaurantDoc.data();
        const ownerId = restaurantData?.ownerId;

        if (ownerId) {
          // 4. Send FCM notification to restaurant owner
          const userDoc = await db.collection('users').doc(ownerId).get();
          const userData = userDoc.data();

          if (userData?.fcmToken) {
            const message: admin.messaging.Message = {
              token: userData.fcmToken,
              notification: {
                title: '🔔 New Order!',
                body: `Order #${orderId.slice(-6).toUpperCase()} — ${orderData.items.length} item(s) — ${Number(orderData.totalAmount || 0).toLocaleString('ru-RU')} UZS`,
              },
              data: {
                orderId: orderId,
                type: 'new_order',
              },
            };

            try {
              await admin.messaging().send(message);
              console.log(
                `[onOrderCreate] FCM notification sent to restaurant owner ${ownerId}`
              );
            } catch (fcmError) {
              console.error('[onOrderCreate] FCM send error:', fcmError);
            }
          }
        }
      }

      // 5. Update restaurant order count
      await db
        .collection('restaurants')
        .doc(orderData.restaurantId)
        .update({
          orderCount: admin.firestore.FieldValue.increment(1),
        });

      console.log(`[onOrderCreate] Order ${orderId} processing complete`);
    } catch (error) {
      console.error(`[onOrderCreate] Error processing order ${orderId}:`, error);
    }
  }
);
