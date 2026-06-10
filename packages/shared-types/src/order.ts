// =============================================
// ORDER TYPES
// =============================================

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

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
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
  'delivered',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  on_the_way: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Cancelled (Rejected)',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#f79009',
  accepted: '#7c3aed',
  preparing: '#465fff',
  ready_for_pickup: '#9333ea',
  picked_up: '#0ea5e9',
  on_the_way: '#12b76a',
  delivered: '#12b76a',
  cancelled: '#f04438',
  rejected: '#b42318',
};
