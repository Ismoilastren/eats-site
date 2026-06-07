// =============================================
// ORDER TYPES
// =============================================

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'courier_picked_up'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  notes?: string;
}

export interface AssignedCourier {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  vehicleType?: string;
}

export interface OrderCoordinate {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

export interface Order {
  id: string;
  userId: string;
  restaurantId: string;
  courierId: string | null;
  assignedCourier: AssignedCourier | null;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryLocation: OrderCoordinate;
  restaurantLocation?: OrderCoordinate | { lat: number; lng: number };
  courierLocation?: OrderCoordinate | null;
  courier?: {
    uid?: string;
    id?: string;
    name?: string;
    phone?: string;
    vehicle?: string;
    vehicleType?: string;
    location?: OrderCoordinate | { lat: number; lng: number } | null;
    currentLocation?: OrderCoordinate | null;
    lastUpdated?: Date;
  };
  // Denormalized fields for fast reads
  restaurantName: string;
  restaurantImage: string;
  customerName: string;
  customerPhone: string;
  courierName?: string;
  courierPhone?: string;
  paymentMethod?: 'cash' | 'card';
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  estimatedDelivery: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason?: string;
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending',
  'preparing',
  'courier_picked_up',
  'delivered',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  courier_picked_up: 'Courier Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#f79009',
  preparing: '#465fff',
  courier_picked_up: '#12b76a',
  delivered: '#12b76a',
  cancelled: '#f04438',
};
