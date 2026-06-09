import { serverTimestamp } from '@repo/firebase-config';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop';

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
}) {
  const cuisines = splitList(input.cuisine);
  const imageUrl = input.imageUrl || FALLBACK_IMAGE;

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
    address: input.address,
    location: { latitude: 41.311081, longitude: 69.240562, lat: 41.311081, lng: 69.240562 },
    deliveryFee: 0,
    minOrder: 0,
    minOrderAmount: 0,
    etaMin: 25,
    etaMax: 35,
    avgDeliveryTime: 30,
    priceLevel: 2,
    zones: ['tashkent', 'center'],
    availableZones: ['tashkent', 'center'],
    isOpen: true,
    isActive: true,
    status: 'active',
    supportsDelivery: true,
    supportsPickup: true,
    workingHours: '09:00-23:00',
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
