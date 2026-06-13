import { serverTimestamp } from '@repo/firebase-config';

const TASHKENT_CENTER = { lat: 41.311081, lng: 69.240562 };

export function slugifyRestaurantName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `restaurant-${Date.now()}`;
}

export function splitList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildRestaurantPayload(input: {
  id?: string;
  name: string;
  cuisine: string;
  address: string;
  description?: string;
  imageUrl?: string;
  phone?: string;
  workingHours?: string;
  deliveryTime?: number;
  deliveryFee?: number;
  minOrder?: number;
  isActive?: boolean;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    source?: string;
  };
}) {
  const cuisines = splitList(input.cuisine);
  const imageUrl = input.imageUrl || '';
  const locationLat = Number(input.location?.lat ?? input.location?.latitude ?? TASHKENT_CENTER.lat);
  const locationLng = Number(input.location?.lng ?? input.location?.longitude ?? TASHKENT_CENTER.lng);
  const safeLat = Number.isFinite(locationLat) ? locationLat : TASHKENT_CENTER.lat;
  const safeLng = Number.isFinite(locationLng) ? locationLng : TASHKENT_CENTER.lng;
  const address = input.location?.address || input.address;
  const isActive = input.isActive ?? true;

  return {
    ...(input.id ? { id: input.id } : {}),
    slug: slugifyRestaurantName(input.name),
    name: input.name,
    description: input.description || '',
    imageUrl,
    coverImageUrl: imageUrl,
    cuisine: input.cuisine,
    cuisines: cuisines.length ? cuisines : ['Fast Food'],
    category: cuisines[0] || 'Fast Food',
    categories: cuisines.length ? cuisines : ['Fast Food'],
    rating: 4.8,
    reviews: 0,
    reviewCount: 0,
    reviewsCount: 0,
    likedBy: [],
    address,
    phone: input.phone || '',
    location: {
      address,
      latitude: safeLat,
      longitude: safeLng,
      lat: safeLat,
      lng: safeLng,
      source: input.location?.source || 'admin',
    },
    deliveryFee: Number(input.deliveryFee || 0),
    minOrder: Number(input.minOrder || 0),
    minOrderAmount: Number(input.minOrder || 0),
    etaMin: Math.max(5, Number(input.deliveryTime || 30) - 5),
    etaMax: Number(input.deliveryTime || 30) + 5,
    avgDeliveryTime: Number(input.deliveryTime || 30),
    priceLevel: 2,
    zones: ['tashkent', 'center'],
    availableZones: ['tashkent', 'center'],
    isOpen: isActive,
    isActive,
    status: isActive ? 'active' : 'inactive',
    supportsDelivery: true,
    supportsPickup: true,
    workingHours: input.workingHours || '09:00-23:00',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
}

export function buildDishPayload(input: {
  id?: string;
  restaurantId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category: string;
  price: number;
  sortOrder?: number;
}) {
  return {
    ...(input.id ? { id: input.id } : {}),
    restaurantId: input.restaurantId,
    name: input.name,
    description: input.description || '',
    imageUrl: input.imageUrl || '',
    category: input.category,
    price: Number(input.price || 0),
    oldPrice: null,
    isAvailable: true,
    available: true,
    tags: [],
    sortOrder: input.sortOrder || 0,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
}
