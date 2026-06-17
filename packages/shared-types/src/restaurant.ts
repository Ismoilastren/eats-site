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
  entityType?: 'branch';
  brandId?: string;
  brandName?: string;
  branchId?: string;
  branchName?: string;
  branchDisplayName?: string;
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
  brandId?: string;
  brandName?: string;
  branchId?: string;
  branchName?: string;
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

export interface RestaurantBrand {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  categories?: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RestaurantBranch {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  displayName: string;
  address: string;
  phone?: string;
  workingHours?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    address?: string;
  };
  isActive: boolean;
  supportsDelivery?: boolean;
  supportsPickup?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
