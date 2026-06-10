// =============================================
// COURIER TYPES
// =============================================

export type CanonicalVehicleType = 'bicycle' | 'car' | 'scooter' | 'motorbike';
export type LegacyVehicleType = 'foot' | 'motorcycle';
export type VehicleType = CanonicalVehicleType | LegacyVehicleType;
export type CourierStatus = 'offline' | 'online' | 'busy';

export interface CourierLocation {
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  heading?: number;
  speed?: number;
  updatedAt?: unknown;
  timestamp?: Date;
}

export interface Courier {
  id: string;
  name: string;
  phone: string;
  vehicleType: CanonicalVehicleType;
  vehicleName?: string;
  plateNumber?: string;
  status: CourierStatus;
  isOnline: boolean;
  currentLocation: CourierLocation | null;
  currentOrderId: string | null;
  totalEarnings: number;
  todayEarnings: number;
  weeklyEarnings?: number;
  completedOrders: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastSeenAt?: unknown;

  // Legacy aliases remain readable while existing documents are migrated.
  displayName?: string;
  fullName?: string;
  photoURL?: string;
  isAvailable?: boolean;
  deliveries?: number;
  totalDeliveries?: number;
  rating?: number;
  licensePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  mostActiveArea?: string;
  lastLocationUpdate?: unknown;
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
