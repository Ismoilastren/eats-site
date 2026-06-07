// =============================================
// RESTAURANT & MENU TYPES
// =============================================

export interface OperatingHours {
  open: string; // "09:00"
  close: string; // "22:00"
}

export interface Restaurant {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  imageUrl: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  operatingHours: Record<string, OperatingHours>; // { mon: {open, close}, ... }
  isActive: boolean;
  deliveryFee: number;
  minOrderAmount: number;
  avgDeliveryTime: number; // minutes
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  category: string;
  categoryId?: string;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
}
