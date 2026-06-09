import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [rawKey, ...rawValue] = trimmed.split('=');
    const key = rawKey.trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), 'apps/main-site/.env'));

const [{ db, doc, getDoc, serverTimestamp, writeBatch }, { promos, restaurants }] = await Promise.all([
  import('@repo/firebase-config'),
  import('../src/data/marketplace'),
]);

type SeedStats = {
  restaurantsCreated: number;
  restaurantsUpdated: number;
  dishesCreated: number;
  dishesUpdated: number;
  promosCreated: number;
  promosUpdated: number;
};

const stats: SeedStats = {
  restaurantsCreated: 0,
  restaurantsUpdated: 0,
  dishesCreated: 0,
  dishesUpdated: 0,
  promosCreated: 0,
  promosUpdated: 0,
};

const batch = writeBatch(db);

for (const restaurant of restaurants) {
  const restaurantRef = doc(db, 'restaurants', restaurant.id);
  const restaurantExists = (await getDoc(restaurantRef)).exists();
  if (restaurantExists) stats.restaurantsUpdated += 1;
  else stats.restaurantsCreated += 1;

  batch.set(restaurantRef, {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    imageUrl: restaurant.imageUrl,
    coverImageUrl: restaurant.imageUrl,
    cuisine: restaurant.cuisine,
    cuisines: restaurant.cuisine,
    category: restaurant.category,
    categories: Array.from(new Set([restaurant.category, ...restaurant.cuisine])),
    rating: restaurant.rating,
    reviews: restaurant.reviews,
    reviewsCount: restaurant.reviews,
    etaMin: restaurant.etaMin,
    etaMax: restaurant.etaMax,
    deliveryFee: restaurant.deliveryFee,
    minOrder: restaurant.minOrder,
    promo: restaurant.promo || null,
    promoIds: restaurant.promo ? [restaurant.promo] : [],
    isOpen: restaurant.isOpen,
    hasDiscount: restaurant.hasDiscount,
    supportsPickup: restaurant.supportsPickup,
    workingHours: restaurant.workingHours,
    zones: restaurant.availableZones,
    priceLevel: restaurant.priceLevel,
    location: restaurant.location,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  for (const dish of restaurant.menu) {
    const dishRef = doc(db, 'restaurants', restaurant.id, 'dishes', dish.id);
    const dishExists = (await getDoc(dishRef)).exists();
    if (dishExists) stats.dishesUpdated += 1;
    else stats.dishesCreated += 1;

    batch.set(dishRef, {
      id: dish.id,
      restaurantId: restaurant.id,
      name: dish.name,
      description: dish.description,
      imageUrl: dish.imageUrl,
      category: dish.category,
      price: dish.price,
      popular: dish.popular,
      isAvailable: dish.available,
      available: dish.available,
      tags: dish.popular ? ['popular'] : [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
  }
}

for (const promo of promos) {
  const promoRef = doc(db, 'promos', promo.code);
  const promoExists = (await getDoc(promoRef)).exists();
  if (promoExists) stats.promosUpdated += 1;
  else stats.promosCreated += 1;

  batch.set(promoRef, {
    id: promo.code,
    code: promo.code,
    title: promo.title,
    description: promo.description,
    type: promo.type,
    value: promo.value,
    isActive: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

await batch.commit();

console.log('Marketplace seed completed.');
console.table(stats);
