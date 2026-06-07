// =============================================
// COURIER TYPES
// =============================================

export type VehicleType = 'foot' | 'bicycle' | 'motorcycle' | 'car';

export interface CourierLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

export interface Courier {
  id: string; // Same as users.uid
  displayName: string;
  phone: string;
  photoURL: string;
  vehicleType: VehicleType;
  isOnline: boolean;
  isAvailable: boolean;
  currentLocation: CourierLocation;
  currentOrderId: string | null;
  totalDeliveries: number;
  rating: number;
  todayEarnings: number;
  totalEarnings: number;
  lastLocationUpdate: Date;
  licensePlate?: string; // e.g. 01A123AA
  vehicleBrand?: string; // e.g. Chevrolet, KIA
  vehicleModel?: string; // e.g. Cobalt
  vehicleColor?: string; // e.g. White
  mostActiveArea?: string; // e.g. Yunusobod, Chilonzor
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryEarning {
  id: string;
  courierId: string;
  orderId: string;
  amount: number;
  tip: number;
  totalAmount: number;
  date: Date;
  restaurantName: string;
  deliveryAddress: string;
}
