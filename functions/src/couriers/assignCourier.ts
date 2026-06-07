// =============================================
// assignNearestCourier — Callable Function
// =============================================
// Finds the nearest available courier to a restaurant
// using GeoPoint distance calculation and assigns them.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface AssignCourierRequest {
  orderId: string;
}

interface AssignCourierResponse {
  success: boolean;
  courierId?: string;
  courierName?: string;
  message: string;
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const assignNearestCourier = onCall<AssignCourierRequest>(
  async (request): Promise<AssignCourierResponse> => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { orderId } = request.data;

    if (!orderId) {
      throw new HttpsError('invalid-argument', 'orderId is required');
    }

    try {
      const callerDoc = await db.collection('users').doc(request.auth.uid).get();
      if (!['admin', 'superadmin'].includes(callerDoc.data()?.role)) {
        throw new HttpsError(
          'permission-denied',
          'Courier auto-assignment is restricted to admins.'
        );
      }

      // 1. Get the order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'Order not found');
      }

      const orderData = orderDoc.data()!;

      if (!['pending', 'preparing'].includes(orderData.status)) {
        throw new HttpsError(
          'failed-precondition',
          'Only pending or preparing orders can receive a courier.'
        );
      }

      // Check if courier already assigned
      if (orderData.courierId || orderData.assignedCourier?.id) {
        return {
          success: true,
          courierId: orderData.assignedCourier?.id || orderData.courierId,
          courierName: orderData.assignedCourier?.name || orderData.courierName,
          message: 'Courier already assigned',
        };
      }

      // 2. Get restaurant location
      const restaurantDoc = await db
        .collection('restaurants')
        .doc(orderData.restaurantId)
        .get();

      if (!restaurantDoc.exists) {
        throw new HttpsError('not-found', 'Restaurant not found');
      }

      const restaurantData = restaurantDoc.data()!;
      const restaurantLat = restaurantData.location?.latitude || 0;
      const restaurantLon = restaurantData.location?.longitude || 0;

      // 3. Find all available couriers
      const couriersSnapshot = await db
        .collection('couriers')
        .where('isOnline', '==', true)
        .where('isAvailable', '==', true)
        .get();

      if (couriersSnapshot.empty) {
        return {
          success: false,
          message: 'No available couriers at this time',
        };
      }

      // 4. Calculate distances and find nearest
      let nearestCourier: {
        id: string;
        distance: number;
        data: admin.firestore.DocumentData;
      } | null = null;

      couriersSnapshot.docs.forEach((doc) => {
        const courierData = doc.data();
        const courierLat = courierData.currentLocation?.latitude || 0;
        const courierLon = courierData.currentLocation?.longitude || 0;

        const distance = calculateDistance(
          restaurantLat,
          restaurantLon,
          courierLat,
          courierLon
        );

        if (!nearestCourier || distance < nearestCourier.distance) {
          nearestCourier = { id: doc.id, distance, data: courierData };
        }
      });

      if (!nearestCourier) {
        return {
          success: false,
          message: 'Could not find a suitable courier',
        };
      }

      const chosen = nearestCourier as {
        id: string;
        distance: number;
        data: admin.firestore.DocumentData;
      };

      // 5. Assign courier using batch write
      const batch = db.batch();

      // Update order with courier info
      batch.update(orderDoc.ref, {
        courierId: chosen.id,
        courierName: chosen.data.displayName || 'Courier',
        courierPhone: chosen.data.phone || '',
        assignedCourier: {
          id: chosen.id,
          name: chosen.data.displayName || chosen.data.fullName || 'Courier',
          phone: chosen.data.phone || '',
          vehicleType: chosen.data.vehicleType || 'bicycle',
          vehicle: [chosen.data.vehicleBrand, chosen.data.vehicleModel, chosen.data.licensePlate]
            .filter(Boolean)
            .join(' '),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark courier as unavailable
      batch.update(db.collection('couriers').doc(chosen.id), {
        isAvailable: false,
        currentOrderId: orderId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      console.log(
        `[assignNearestCourier] Assigned courier ${chosen.id} (${chosen.distance.toFixed(1)}km away) to order ${orderId}`
      );

      return {
        success: true,
        courierId: chosen.id,
        courierName: chosen.data.displayName || 'Courier',
        message: `Courier assigned (${chosen.distance.toFixed(1)}km from restaurant)`,
      };
    } catch (error) {
      console.error('[assignNearestCourier] Error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to assign courier');
    }
  }
);
