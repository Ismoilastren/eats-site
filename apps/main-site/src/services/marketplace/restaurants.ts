import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from '@repo/firebase-config';
import { Dish, Restaurant, restaurants as mockRestaurants } from '@/data/marketplace';
import { isFirestoreDataSource } from './config';
import { isValidCoordinates } from '@repo/shared-types';

const RESTAURANTS_COLLECTION = 'restaurants';
const DISHES_COLLECTION = 'dishes';
const FALLBACK_RESTAURANT_IMAGE = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop';
const FALLBACK_DISH_IMAGES = [
  'https://images.unsplash.com/photo-1565299507177-b0ac66763828?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=900&auto=format&fit=crop',
];

function cleanImageUrl(value: unknown, fallback = FALLBACK_RESTAURANT_IMAGE): string {
  const image = typeof value === 'string' ? value.trim() : '';
  if (image.startsWith('https://') || image.startsWith('http://') || image.startsWith('data:image/')) return image;
  return fallback;
}

function mapFirestoreDish(data: DocumentData, id: string, restaurantId: string): Dish {
  return {
    id: String(data.id || id),
    restaurantId: String(data.restaurantId || restaurantId),
    name: String(data.name || 'Dish'),
    description: String(data.description || ''),
    imageUrl: cleanImageUrl(data.imageUrl, FALLBACK_DISH_IMAGES[Math.abs(id.length) % FALLBACK_DISH_IMAGES.length]),
    category: String(data.category || 'Mains'),
    price: Number(data.price || 0),
    popular: Array.isArray(data.tags) ? data.tags.includes('popular') : Boolean(data.popular),
    available: data.isAvailable ?? data.available ?? true,
  };
}

function mapFirestoreRestaurant(data: DocumentData, id: string, menu: Dish[] = []): Restaurant {
  const cuisines = Array.isArray(data.cuisines)
    ? data.cuisines.map(String)
    : Array.isArray(data.cuisine)
      ? data.cuisine.map(String)
      : [];
  const categories = Array.isArray(data.categories)
    ? data.categories.map(String)
    : data.category
      ? [String(data.category)]
      : cuisines;

  const rawPriceLevel = data.priceLevel;
  const priceLevel = rawPriceLevel === 1 || rawPriceLevel === '$'
    ? '$'
    : rawPriceLevel === 3 || rawPriceLevel === '$$$'
      ? '$$$'
      : '$$';
  const imageUrl = cleanImageUrl(data.coverImageUrl || data.imageUrl);
  const rawLat = Number(data.location?.lat ?? data.location?.latitude);
  const rawLng = Number(data.location?.lng ?? data.location?.longitude);
  const hasStoredLocation = isValidCoordinates(rawLat, rawLng);

  return {
    id: String(data.id || id),
    slug: String(data.slug || id),
    name: String(data.name || 'Restaurant'),
    imageUrl,
    cuisine: cuisines.length > 0 ? cuisines : categories,
    category: String(categories[0] || cuisines[0] || 'Restaurants'),
    rating: Number(data.rating || 0),
    reviews: Number(data.reviewsCount ?? data.reviewCount ?? data.reviews ?? 0),
    etaMin: Number(data.etaMin || data.avgDeliveryTime || 25),
    etaMax: Number(data.etaMax || data.avgDeliveryTime || 40),
    deliveryFee: Number(data.deliveryFee || 0),
    minOrder: Number(data.minOrder ?? data.minOrderAmount ?? 0),
    promo: Array.isArray(data.promoIds) ? data.promoIds[0] : data.promo,
    isOpen: data.status === 'inactive' ? false : data.isOpen ?? data.isActive ?? true,
    isFreeDelivery: Number(data.deliveryFee || 0) === 0,
    hasDiscount: Array.isArray(data.promoIds) ? data.promoIds.length > 0 : Boolean(data.hasDiscount),
    supportsPickup: data.supportsPickup ?? true,
    workingHours: String(data.workingHours || '09:00-23:00'),
    availableZones: Array.isArray(data.zones) ? data.zones.map(String) : Array.isArray(data.availableZones) ? data.availableZones.map(String) : ['tashkent'],
    priceLevel,
    address: String(data.address || data.location?.address || ''),
    location: {
      lat: hasStoredLocation ? rawLat : 41.311081,
      lng: hasStoredLocation ? rawLng : 69.240562,
      address: String(data.address || data.location?.address || ''),
    },
    locationIsVerified: hasStoredLocation,
    menu,
  };
}

export async function getDishesByRestaurant(restaurantId: string): Promise<Dish[]> {
  if (!isFirestoreDataSource()) {
    return mockRestaurants.find((restaurant) => restaurant.id === restaurantId)?.menu || [];
  }

  const snapshot = await getDocs(collection(db, RESTAURANTS_COLLECTION, restaurantId, DISHES_COLLECTION));
  const subcollectionDishes = snapshot.docs.map((dishDoc) => mapFirestoreDish(dishDoc.data(), dishDoc.id, restaurantId));
  if (subcollectionDishes.length > 0) return subcollectionDishes;

  const legacyMenuQuery = query(collection(db, 'menuItems'), where('restaurantId', '==', restaurantId));
  const legacySnapshot = await getDocs(legacyMenuQuery);
  return legacySnapshot.docs.map((dishDoc) => mapFirestoreDish(dishDoc.data(), dishDoc.id, restaurantId));
}

export async function getRestaurants(): Promise<Restaurant[]> {
  if (!isFirestoreDataSource()) return mockRestaurants;

  const snapshot = await getDocs(collection(db, RESTAURANTS_COLLECTION));
  const records = await Promise.all(
    snapshot.docs.map(async (restaurantDoc) => {
      const menu = await getDishesByRestaurant(restaurantDoc.id);
      return mapFirestoreRestaurant(restaurantDoc.data(), restaurantDoc.id, menu);
    })
  );
  return records.filter((restaurant) => restaurant.isOpen);
}

export async function getRestaurantById(restaurantId: string): Promise<Restaurant | null> {
  if (!isFirestoreDataSource()) {
    return mockRestaurants.find((restaurant) => restaurant.id === restaurantId) || null;
  }

  const restaurantDoc = await getDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId));
  if (!restaurantDoc.exists()) return null;
  const menu = await getDishesByRestaurant(restaurantDoc.id);
  const restaurant = mapFirestoreRestaurant(restaurantDoc.data(), restaurantDoc.id, menu);
  return restaurant.isOpen ? restaurant : null;
}

export async function getRestaurantForTracking(restaurantId: string): Promise<Restaurant | null> {
  if (!isFirestoreDataSource()) {
    return mockRestaurants.find((restaurant) => restaurant.id === restaurantId) || null;
  }

  const restaurantDoc = await getDoc(doc(db, RESTAURANTS_COLLECTION, restaurantId));
  if (!restaurantDoc.exists()) return null;
  return mapFirestoreRestaurant(restaurantDoc.data(), restaurantDoc.id);
}

export function subscribeRestaurants(
  onChange: (restaurants: Restaurant[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!isFirestoreDataSource()) {
    onChange(mockRestaurants);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, RESTAURANTS_COLLECTION),
    async (snapshot) => {
      try {
        const records = await Promise.all(
          snapshot.docs.map(async (restaurantDoc) => {
            const menu = await getDishesByRestaurant(restaurantDoc.id);
            return mapFirestoreRestaurant(restaurantDoc.data(), restaurantDoc.id, menu);
          })
        );
        onChange(records.filter((restaurant) => restaurant.isOpen));
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to map restaurants'));
      }
    },
    (error) => onError?.(error)
  );
}

export function subscribeDishesByRestaurant(
  restaurantId: string,
  onChange: (dishes: Dish[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!isFirestoreDataSource()) {
    onChange(mockRestaurants.find((restaurant) => restaurant.id === restaurantId)?.menu || []);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, RESTAURANTS_COLLECTION, restaurantId, DISHES_COLLECTION),
    async (snapshot) => {
      try {
        const subcollectionDishes = snapshot.docs.map((dishDoc) => mapFirestoreDish(dishDoc.data(), dishDoc.id, restaurantId));
        if (subcollectionDishes.length > 0) {
          onChange(subcollectionDishes);
          return;
        }
        onChange(await getDishesByRestaurant(restaurantId));
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to map dishes'));
      }
    },
    (error) => onError?.(error)
  );
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  if (!isFirestoreDataSource()) {
    return mockRestaurants.find((restaurant) => restaurant.slug === slug) || null;
  }

  const slugQuery = query(collection(db, RESTAURANTS_COLLECTION), where('slug', '==', slug));
  const snapshot = await getDocs(slugQuery);
  const restaurantDoc = snapshot.docs[0];
  if (!restaurantDoc) {
    const byId = await getDoc(doc(db, RESTAURANTS_COLLECTION, slug));
    if (!byId.exists()) return null;
    const menu = await getDishesByRestaurant(byId.id);
    const restaurant = mapFirestoreRestaurant(byId.data(), byId.id, menu);
    return restaurant.isOpen ? restaurant : null;
  }
  const menu = await getDishesByRestaurant(restaurantDoc.id);
  const restaurant = mapFirestoreRestaurant(restaurantDoc.data(), restaurantDoc.id, menu);
  return restaurant.isOpen ? restaurant : null;
}

export async function searchMarketplace(searchQuery: string): Promise<{ restaurants: Restaurant[]; dishes: Array<{ dish: Dish; restaurant: Restaurant }> }> {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return { restaurants: [], dishes: [] };

  const restaurants = await getRestaurants();
  return {
    restaurants: restaurants.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(normalized) ||
      restaurant.cuisine.join(' ').toLowerCase().includes(normalized)
    ),
    dishes: restaurants.flatMap((restaurant) =>
      restaurant.menu
        .filter((dish) => dish.name.toLowerCase().includes(normalized) || dish.description.toLowerCase().includes(normalized))
        .map((dish) => ({ dish, restaurant }))
    ),
  };
}
