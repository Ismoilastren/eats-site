import { serverTimestamp } from '@repo/firebase-config';
import { isReadableAddress, isValidCoordinates } from '@repo/shared-types';

const TASHKENT_CENTER = { lat: 41.311081, lng: 69.240562 };

export function slugifyRestaurantName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `restaurant-${Date.now()}`;
}

export function normalizeBranchName(name?: string) {
  const value = String(name || '').trim();
  return value || 'Main branch';
}

export function deriveRestaurantBrandBranch(data: {
  id?: string;
  name?: string;
  brandId?: string;
  brandName?: string;
  branchId?: string;
  branchName?: string;
}) {
  const rawName = String(data.name || '').trim();
  const brandName = String(data.brandName || '').trim() || rawName || 'Restaurant brand';
  const branchName = normalizeBranchName(data.branchName || (rawName && rawName !== brandName ? rawName.replace(brandName, '').trim() : ''));
  return {
    brandId: String(data.brandId || slugifyRestaurantName(brandName)).trim(),
    brandName,
    branchId: String(data.branchId || data.id || '').trim(),
    branchName,
    branchDisplayName: branchName.toLowerCase() === 'main branch'
      ? brandName
      : `${brandName} · ${branchName}`,
  };
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
  brandName?: string;
  branchName?: string;
  cuisine: string;
  address: string;
  description?: string;
  imageUrl?: string;
  phone?: string;
  workingHours?: string;
  deliveryTime?: number;
  deliveryFee?: number;
  serviceFee?: number;
  minOrder?: number;
  isActive?: boolean;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    source?: string;
    coordinatesConfirmed?: boolean;
  };
}) {
  const cuisines = splitList(input.cuisine);
  const imageUrl = input.imageUrl || '';
  const locationLat = Number(input.location?.lat ?? input.location?.latitude ?? TASHKENT_CENTER.lat);
  const locationLng = Number(input.location?.lng ?? input.location?.longitude ?? TASHKENT_CENTER.lng);
  const hasCoordinates = Boolean(
    input.location?.coordinatesConfirmed
    && isValidCoordinates(locationLat, locationLng),
  );
  const address = input.location?.address || input.address;
  if (!isReadableAddress(address)) {
    throw new Error('A readable restaurant address is required.');
  }
  if (input.location?.coordinatesConfirmed && !hasCoordinates) {
    throw new Error('Valid restaurant coordinates are required.');
  }
  const isActive = input.isActive ?? true;
  const branch = deriveRestaurantBrandBranch({
    id: input.id,
    name: input.name,
    brandName: input.brandName,
    branchName: input.branchName,
  });

  return {
    ...(input.id ? { id: input.id } : {}),
    entityType: 'branch',
    brandId: branch.brandId,
    brandName: branch.brandName,
    branchId: branch.branchId || input.id || '',
    branchName: branch.branchName,
    branchDisplayName: branch.branchDisplayName,
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
    branchAddress: address,
    phone: input.phone || '',
    location: {
      address,
      source: input.location?.source || 'admin',
      ...(hasCoordinates ? {
        latitude: locationLat,
        longitude: locationLng,
        lat: locationLat,
        lng: locationLng,
      } : {}),
    },
    deliveryFee: Number(input.deliveryFee || 0),
    serviceFee: Number(input.serviceFee || 0),
    platformFee: Number(input.serviceFee || 0),
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
  brandId?: string;
  brandName?: string;
  branchId?: string;
  branchName?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category: string;
  price: number;
  isAvailable?: boolean;
  sortOrder?: number;
}) {
  const isAvailable = input.isAvailable ?? true;
  return {
    ...(input.id ? { id: input.id } : {}),
    restaurantId: input.restaurantId,
    branchId: input.branchId || input.restaurantId,
    branchName: input.branchName || '',
    brandId: input.brandId || '',
    brandName: input.brandName || '',
    name: input.name,
    description: input.description || '',
    imageUrl: input.imageUrl || '',
    category: input.category,
    price: Number(input.price || 0),
    oldPrice: null,
    isAvailable,
    available: isAvailable,
    tags: [],
    sortOrder: input.sortOrder || 0,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
}
