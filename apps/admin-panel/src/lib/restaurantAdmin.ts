import { COLLECTIONS, isValidCoordinates } from '@repo/shared-types';
import { collection, db, getDocs } from '@repo/firebase-config';
import type { AppAddress } from '@repo/shared-types';

export type RestaurantLocationValue = {
  address: string;
  lat: number;
  lng: number;
  source: NonNullable<AppAddress['source']>;
  coordinatesConfirmed: boolean;
};

export type RestaurantTypeOption = {
  id: string;
  name: string;
  source: 'settings' | 'system' | 'restaurants' | 'fallback';
};

export type CatalogCategoryOption = {
  id: string;
  name: string;
  source: 'settings' | 'system' | 'menuItems' | 'restaurants' | 'fallback';
};

export const DEFAULT_RESTAURANT_TYPES = [
  'Fast Food',
  'Pizza',
  'Burger',
  'Uzbek',
  'Sushi',
  'Desserts',
  'Drinks',
];

export const DEFAULT_MENU_CATEGORIES = [
  'Pizza',
  'Burgers',
  'Lavash',
  'Sets',
  'Sides',
  'Desserts',
  'Drinks',
];

export const TASHKENT_CENTER_LOCATION: RestaurantLocationValue = {
  address: '',
  lat: 41.311081,
  lng: 69.240562,
  source: 'manual',
  coordinatesConfirmed: false,
};

export function extractRestaurantLocation(data: Record<string, unknown>): RestaurantLocationValue {
  const rawLocation = typeof data.location === 'object' && data.location !== null
    ? data.location as Record<string, unknown>
    : {};
  const lat = Number(rawLocation.lat ?? rawLocation.latitude);
  const lng = Number(rawLocation.lng ?? rawLocation.longitude);
  const coordinatesConfirmed = isValidCoordinates(lat, lng);
  const address = String(data.address || rawLocation.address || '');

  return {
    address,
    lat: coordinatesConfirmed ? lat : 41.311081,
    lng: coordinatesConfirmed ? lng : 69.240562,
    source: ['manual', 'map', 'geocode', 'current_location', 'popular', 'restaurant', 'admin', 'suggestion']
      .includes(String(rawLocation.source))
      ? String(rawLocation.source) as RestaurantLocationValue['source']
      : 'admin',
    coordinatesConfirmed,
  };
}

export async function loadRestaurantTypeOptions(): Promise<RestaurantTypeOption[]> {
  const names = new Map<string, RestaurantTypeOption>();

  const addName = (name: unknown, source: RestaurantTypeOption['source'], id?: string) => {
    const value = String(name || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (!names.has(key)) names.set(key, { id: id || key, name: value, source });
  };

  try {
    const settingsSnap = await getDocs(collection(db, 'settings/restaurant_categories/items'));
    settingsSnap.forEach((item) => addName(item.data().name, 'settings', item.id));
  } catch {
    // Optional source; Firestore rules may block it in production.
  }

  try {
    const systemSnap = await getDocs(collection(db, 'system_categories'));
    systemSnap.forEach((item) => addName(item.data().name, 'system', item.id));
  } catch {
    // Optional source; admin categories page also falls back from this collection.
  }

  try {
    const restaurantSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS));
    restaurantSnap.forEach((item) => {
      const data = item.data();
      const categories = Array.isArray(data.categories) ? data.categories : [];
      const cuisines = Array.isArray(data.cuisines) ? data.cuisines : [];
      [...categories, ...cuisines, data.category, data.cuisine].forEach((value) => {
        addName(value, 'restaurants');
      });
    });
  } catch {
    // Existing restaurant metadata is only a supplemental source.
  }

  DEFAULT_RESTAURANT_TYPES.forEach((name) => addName(name, 'fallback'));

  return Array.from(names.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadCatalogCategoryOptions(): Promise<CatalogCategoryOption[]> {
  const names = new Map<string, CatalogCategoryOption>();

  const addName = (name: unknown, source: CatalogCategoryOption['source'], id?: string) => {
    const value = String(name || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (!names.has(key)) names.set(key, { id: id || key, name: value, source });
  };

  try {
    const settingsSnap = await getDocs(collection(db, 'settings/restaurant_categories/items'));
    settingsSnap.forEach((item) => addName(item.data().name, 'settings', item.id));
  } catch {
    // Optional source; Firestore rules may block it in some deployments.
  }

  try {
    const systemSnap = await getDocs(collection(db, 'system_categories'));
    systemSnap.forEach((item) => addName(item.data().name, 'system', item.id));
  } catch {
    // Optional source; category management writes here by default.
  }

  try {
    const menuSnap = await getDocs(collection(db, COLLECTIONS.MENU_ITEMS));
    menuSnap.forEach((item) => addName(item.data().category, 'menuItems', item.id));
  } catch {
    // Existing menu data is a supplemental source.
  }

  try {
    const restaurantSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS));
    restaurantSnap.forEach((item) => {
      const data = item.data();
      const categories = Array.isArray(data.categories) ? data.categories : [];
      const cuisines = Array.isArray(data.cuisines) ? data.cuisines : [];
      [...categories, ...cuisines, data.category, data.cuisine].forEach((value) => {
        addName(value, 'restaurants');
      });
    });
  } catch {
    // Restaurant metadata is only a supplemental source.
  }

  DEFAULT_MENU_CATEGORIES.forEach((name) => addName(name, 'fallback'));

  return Array.from(names.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function validateRestaurantImage(file: File) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return 'Please upload a JPG, PNG, or WebP image.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Image is too large. Maximum size is 5 MB.';
  }
  return '';
}

export function compressImageFile(file: File, maxWidth = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const image = new Image();
      image.src = String(event.target?.result || '');
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not process image.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.75));
      };
      image.onerror = () => reject(new Error('Could not read image.'));
    };
    reader.onerror = () => reject(new Error('Could not read image.'));
  });
}
