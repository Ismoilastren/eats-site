// =============================================
// @repo/shared-types — Central Export
// =============================================

export type { User, UserRole, Address } from './user';
export type {
  Restaurant,
  RestaurantBrand,
  RestaurantBranch,
  MenuItem,
  MenuCategory,
  OperatingHours,
} from './restaurant';
export type {
  AssignedCourier,
  Order,
  OrderCoordinate,
  OrderItem,
  OrderStatus,
} from './order';
export {
  formatOrderCode,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from './order';
export type {
  CanonicalVehicleType,
  Courier,
  CourierLocation,
  CourierStatus,
  DeliveryEarning,
  LegacyVehicleType,
  VehicleType,
} from './courier';
export {
  ACTIVE_COURIER_STATUSES,
  COURIER_RADAR_STATUSES,
  TERMINAL_ORDER_STATUSES,
  ADMIN_VISIBLE_STATUSES,
  RESTAURANT_STATUSES,
  COURIER_MUTABLE_STATUSES,
  getAdminStatusOptions,
  getRestaurantStatusOptions,
  getCourierStatusOptions,
  getNextRestaurantStatus,
  getNextCourierStatus,
  canClientCancelOrder,
  formatCurrencyUZS,
  formatFirestoreDate,
  getCourierVehicleType,
  getVehicleLabel,
  hasAssignedCourier,
  isTerminalOrderStatus,
  normalizeCoordinate,
  normalizeCanonicalVehicleType,
  normalizeOrderStatus,
  normalizeVehicleType,
} from './runtime';
export type { CoordinateLike, NormalizedCoordinate } from './runtime';
export type { Payment, PaymentMethod, PaymentStatus } from './payment';

// =============================================
// PAGINATION CONSTANTS
// =============================================
export const PAGE_SIZE = 21;

// =============================================
// COLLECTION NAMES
// =============================================
export const COLLECTIONS = {
  USERS: 'users',
  RESTAURANTS: 'restaurants',
  RESTAURANT_BRANDS: 'restaurantBrands',
  RESTAURANT_BRANCHES: 'restaurantBranches',
  MENU_ITEMS: 'menuItems',
  ORDERS: 'orders',
  COURIERS: 'couriers',
  PAYMENTS: 'payments',
} as const;

export * from './address';
export * from './geozone';
export * from './routing';
