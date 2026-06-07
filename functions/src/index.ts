// =============================================
// Cloud Functions — Entry Point
// =============================================

import { onOrderCreate } from './orders/onCreate';
import { onOrderStatusUpdate } from './orders/onStatusUpdate';
import { assignNearestCourier } from './couriers/assignCourier';

// =============================================
// Firestore Triggers
// =============================================

// Triggered when a new order document is created in the 'orders' collection
export const orderCreated = onOrderCreate;

// Triggered when an order document is updated (status changes)
export const orderStatusUpdated = onOrderStatusUpdate;

// =============================================
// Callable Functions
// =============================================

// Callable: finds and assigns the nearest available courier to an order
export const assignCourier = assignNearestCourier;
