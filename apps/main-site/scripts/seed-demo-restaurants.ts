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

type DemoDish = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  price: number;
  popular?: boolean;
};

type DemoRestaurant = {
  id: string;
  slug: string;
  name: string;
  cuisine: string[];
  category: string;
  imageUrl: string;
  rating: number;
  reviews: number;
  etaMin: number;
  etaMax: number;
  deliveryFee: number;
  minOrder: number;
  supportsPickup: boolean;
  workingHours: string;
  priceLevel: '$' | '$$' | '$$$';
  address: string;
  location: { lat: number; lng: number; address: string };
  dishes: DemoDish[];
};

const restaurantImages = {
  fastFood: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
  pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1200&auto=format&fit=crop',
  bakery: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1200&auto=format&fit=crop',
  cafe: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
  chicken: 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?q=80&w=1200&auto=format&fit=crop',
  sushi: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=1200&auto=format&fit=crop',
};

const dishImages = {
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=900&auto=format&fit=crop',
  lavash: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?q=80&w=900&auto=format&fit=crop',
  fries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=900&auto=format&fit=crop',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=900&auto=format&fit=crop',
  dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=900&auto=format&fit=crop',
  coffee: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=900&auto=format&fit=crop',
  chicken: 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?q=80&w=900&auto=format&fit=crop',
  sushi: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=900&auto=format&fit=crop',
  pasta: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?q=80&w=900&auto=format&fit=crop',
  bowl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=900&auto=format&fit=crop',
};

function dishes(prefix: string, list: Array<Omit<DemoDish, 'id'>>): DemoDish[] {
  return list.map((dish, index) => ({ ...dish, id: `${prefix}-dish-${index + 1}` }));
}

const demoRestaurants: DemoRestaurant[] = [
  {
    id: 'evos',
    slug: 'evos',
    name: 'Evos',
    cuisine: ['Fast food', 'Burgers', 'Lavash'],
    category: 'Fast food',
    imageUrl: restaurantImages.fastFood,
    rating: 4.8,
    reviews: 1840,
    etaMin: 20,
    etaMax: 35,
    deliveryFee: 7000,
    minOrder: 30000,
    supportsPickup: true,
    workingHours: '09:00-23:30',
    priceLevel: '$$',
    address: 'Tashkent, Amir Temur Avenue 60',
    location: { lat: 41.311081, lng: 69.240562, address: 'Tashkent, Amir Temur Avenue 60' },
    dishes: dishes('evos', [
      { name: 'Classic Burger', description: 'Beef patty, cheese, pickles, and signature sauce.', category: 'Burgers', imageUrl: dishImages.burger, price: 28000, popular: true },
      { name: 'Chicken Lavash', description: 'Warm lavash with chicken, vegetables, and garlic sauce.', category: 'Lavash', imageUrl: dishImages.lavash, price: 26000, popular: true },
      { name: 'Double Cheeseburger', description: 'Double beef, double cheese, soft bun.', category: 'Burgers', imageUrl: dishImages.burger, price: 39000 },
      { name: 'Crispy Fries', description: 'Golden fries with ketchup.', category: 'Sides', imageUrl: dishImages.fries, price: 16000 },
      { name: 'Combo Box', description: 'Burger, fries, and drink.', category: 'Combos', imageUrl: dishImages.burger, price: 49000 },
      { name: 'Chocolate Milkshake', description: 'Cold chocolate shake.', category: 'Drinks', imageUrl: dishImages.coffee, price: 18000 },
    ]),
  },
  {
    id: 'maxway',
    slug: 'maxway',
    name: 'MaxWay',
    cuisine: ['Fast food', 'Burgers', 'Lavash'],
    category: 'Fast food',
    imageUrl: restaurantImages.fastFood,
    rating: 4.8,
    reviews: 1500,
    etaMin: 20,
    etaMax: 30,
    deliveryFee: 0,
    minOrder: 35000,
    supportsPickup: true,
    workingHours: '09:00-23:30',
    priceLevel: '$$',
    address: 'Tashkent, Nukus Street 86',
    location: { lat: 41.2995, lng: 69.2722, address: 'Tashkent, Nukus Street 86' },
    dishes: dishes('maxway', [
      { name: 'Max Burger', description: 'Signature beef burger with MaxWay sauce.', category: 'Burgers', imageUrl: dishImages.burger, price: 30000, popular: true },
      { name: 'Cheese Lavash', description: 'Lavash with chicken and melted cheese.', category: 'Lavash', imageUrl: dishImages.lavash, price: 29000, popular: true },
      { name: 'Chicken Burger', description: 'Crispy chicken with salad and sauce.', category: 'Burgers', imageUrl: dishImages.chicken, price: 27000 },
      { name: 'Potato Wedges', description: 'Seasoned potato wedges.', category: 'Sides', imageUrl: dishImages.fries, price: 17000 },
      { name: 'Family Combo', description: 'Two burgers, fries, nuggets, and drinks.', category: 'Combos', imageUrl: dishImages.burger, price: 85000 },
      { name: 'Iced Tea', description: 'Cold lemon iced tea.', category: 'Drinks', imageUrl: dishImages.coffee, price: 12000 },
    ]),
  },
  {
    id: 'oqtepa-lavash',
    slug: 'oqtepa-lavash',
    name: 'Oqtepa Lavash',
    cuisine: ['Fast food', 'Lavash', 'Burgers'],
    category: 'Fast food',
    imageUrl: restaurantImages.fastFood,
    rating: 4.7,
    reviews: 1260,
    etaMin: 25,
    etaMax: 40,
    deliveryFee: 9000,
    minOrder: 30000,
    supportsPickup: true,
    workingHours: '09:00-23:00',
    priceLevel: '$',
    address: 'Tashkent, Chilanzar C-5',
    location: { lat: 41.2852, lng: 69.2033, address: 'Tashkent, Chilanzar C-5' },
    dishes: dishes('oqtepa-lavash', [
      { name: 'Big Lavash', description: 'Large chicken lavash with fresh vegetables.', category: 'Lavash', imageUrl: dishImages.lavash, price: 28000, popular: true },
      { name: 'Mini Lavash', description: 'Compact lavash for a quick meal.', category: 'Lavash', imageUrl: dishImages.lavash, price: 21000 },
      { name: 'Oqtepa Burger', description: 'Juicy burger with house sauce.', category: 'Burgers', imageUrl: dishImages.burger, price: 26000, popular: true },
      { name: 'Chicken Nuggets', description: 'Crispy nuggets with dip.', category: 'Sides', imageUrl: dishImages.chicken, price: 20000 },
      { name: 'Donar Box', description: 'Chicken, fries, sauce, and salad.', category: 'Combos', imageUrl: dishImages.lavash, price: 39000 },
      { name: 'Ayran', description: 'Classic cold ayran.', category: 'Drinks', imageUrl: dishImages.coffee, price: 9000 },
    ]),
  },
  {
    id: 'feed-up',
    slug: 'feed-up',
    name: 'Feed Up',
    cuisine: ['Fast food', 'Burgers', 'Healthy'],
    category: 'Burgers',
    imageUrl: restaurantImages.fastFood,
    rating: 4.6,
    reviews: 820,
    etaMin: 22,
    etaMax: 36,
    deliveryFee: 8000,
    minOrder: 35000,
    supportsPickup: true,
    workingHours: '10:00-23:00',
    priceLevel: '$$',
    address: 'Tashkent, Shota Rustaveli Street 23',
    location: { lat: 41.2879, lng: 69.2608, address: 'Tashkent, Shota Rustaveli Street 23' },
    dishes: dishes('feed-up', [
      { name: 'Feed Burger', description: 'Beef burger with caramelized onions.', category: 'Burgers', imageUrl: dishImages.burger, price: 36000, popular: true },
      { name: 'Chicken Wrap', description: 'Grilled chicken wrap with greens.', category: 'Wraps', imageUrl: dishImages.lavash, price: 31000 },
      { name: 'Healthy Bowl', description: 'Chicken, rice, vegetables, and sauce.', category: 'Healthy', imageUrl: dishImages.bowl, price: 38000, popular: true },
      { name: 'Cheese Fries', description: 'Fries with cheese sauce.', category: 'Sides', imageUrl: dishImages.fries, price: 19000 },
      { name: 'Burger Combo', description: 'Burger, fries, and drink.', category: 'Combos', imageUrl: dishImages.burger, price: 56000 },
      { name: 'Lemonade', description: 'Fresh house lemonade.', category: 'Drinks', imageUrl: dishImages.coffee, price: 15000 },
    ]),
  },
  {
    id: 'safia',
    slug: 'safia',
    name: 'Safia',
    cuisine: ['Desserts', 'Bakery', 'Coffee'],
    category: 'Desserts',
    imageUrl: restaurantImages.bakery,
    rating: 4.9,
    reviews: 2100,
    etaMin: 25,
    etaMax: 45,
    deliveryFee: 10000,
    minOrder: 40000,
    supportsPickup: true,
    workingHours: '08:00-22:00',
    priceLevel: '$$',
    address: 'Tashkent, Buyuk Ipak Yuli Street 12',
    location: { lat: 41.3266, lng: 69.3284, address: 'Tashkent, Buyuk Ipak Yuli Street 12' },
    dishes: dishes('safia', [
      { name: 'Napoleon Cake', description: 'Layered pastry cake with cream.', category: 'Desserts', imageUrl: dishImages.dessert, price: 32000, popular: true },
      { name: 'Honey Cake', description: 'Soft honey cake slice.', category: 'Desserts', imageUrl: dishImages.dessert, price: 30000 },
      { name: 'Croissant', description: 'Buttery French croissant.', category: 'Bakery', imageUrl: restaurantImages.bakery, price: 18000, popular: true },
      { name: 'Cheesecake', description: 'Classic creamy cheesecake.', category: 'Desserts', imageUrl: dishImages.dessert, price: 34000 },
      { name: 'Cappuccino', description: 'Fresh espresso and steamed milk.', category: 'Coffee', imageUrl: dishImages.coffee, price: 19000 },
      { name: 'Berry Tart', description: 'Tart with seasonal berries.', category: 'Desserts', imageUrl: dishImages.dessert, price: 29000 },
    ]),
  },
  {
    id: 'bon',
    slug: 'bon',
    name: 'Bon',
    cuisine: ['Bakery', 'Coffee', 'Breakfast'],
    category: 'Breakfast',
    imageUrl: restaurantImages.cafe,
    rating: 4.7,
    reviews: 930,
    etaMin: 20,
    etaMax: 35,
    deliveryFee: 9000,
    minOrder: 35000,
    supportsPickup: true,
    workingHours: '08:00-23:00',
    priceLevel: '$$',
    address: 'Tashkent, Mirabad Street 7',
    location: { lat: 41.2963, lng: 69.2741, address: 'Tashkent, Mirabad Street 7' },
    dishes: dishes('bon', [
      { name: 'Turkey Sandwich', description: 'Turkey, cheese, tomato, and greens.', category: 'Breakfast', imageUrl: dishImages.bowl, price: 33000, popular: true },
      { name: 'Almond Croissant', description: 'Croissant with almond cream.', category: 'Bakery', imageUrl: restaurantImages.bakery, price: 24000 },
      { name: 'Pancakes', description: 'Pancakes with berries and syrup.', category: 'Breakfast', imageUrl: dishImages.dessert, price: 34000, popular: true },
      { name: 'Latte', description: 'Espresso with milk.', category: 'Coffee', imageUrl: dishImages.coffee, price: 19000 },
      { name: 'Greek Salad', description: 'Fresh salad with feta.', category: 'Healthy', imageUrl: dishImages.bowl, price: 31000 },
      { name: 'Chocolate Muffin', description: 'Soft chocolate muffin.', category: 'Desserts', imageUrl: dishImages.dessert, price: 17000 },
    ]),
  },
  {
    id: 'kfc',
    slug: 'kfc',
    name: 'KFC',
    cuisine: ['Chicken', 'Fast food', 'Burgers'],
    category: 'Fast food',
    imageUrl: restaurantImages.chicken,
    rating: 4.6,
    reviews: 3400,
    etaMin: 20,
    etaMax: 35,
    deliveryFee: 9000,
    minOrder: 35000,
    supportsPickup: true,
    workingHours: '10:00-23:30',
    priceLevel: '$$',
    address: 'Tashkent, Magic City',
    location: { lat: 41.3049, lng: 69.2468, address: 'Tashkent, Magic City' },
    dishes: dishes('kfc', [
      { name: 'Chicken Bucket', description: 'Crispy chicken pieces for sharing.', category: 'Chicken', imageUrl: dishImages.chicken, price: 89000, popular: true },
      { name: 'Zinger Burger', description: 'Spicy crispy chicken burger.', category: 'Burgers', imageUrl: dishImages.burger, price: 34000, popular: true },
      { name: 'Twister', description: 'Chicken wrap with sauce.', category: 'Wraps', imageUrl: dishImages.lavash, price: 30000 },
      { name: 'Strips', description: 'Crispy chicken strips.', category: 'Chicken', imageUrl: dishImages.chicken, price: 36000 },
      { name: 'Fries', description: 'Golden potato fries.', category: 'Sides', imageUrl: dishImages.fries, price: 16000 },
      { name: 'Pepsi', description: 'Cold soft drink.', category: 'Drinks', imageUrl: dishImages.coffee, price: 12000 },
    ]),
  },
  {
    id: 'dodo-pizza',
    slug: 'dodo-pizza',
    name: 'Dodo Pizza',
    cuisine: ['Pizza', 'Italian', 'Fast food'],
    category: 'Pizza',
    imageUrl: restaurantImages.pizza,
    rating: 4.8,
    reviews: 2200,
    etaMin: 30,
    etaMax: 45,
    deliveryFee: 10000,
    minOrder: 45000,
    supportsPickup: true,
    workingHours: '10:00-00:00',
    priceLevel: '$$',
    address: 'Tashkent, Oybek Street 18',
    location: { lat: 41.3004, lng: 69.2816, address: 'Tashkent, Oybek Street 18' },
    dishes: dishes('dodo-pizza', [
      { name: 'Pepperoni Pizza', description: 'Pepperoni and mozzarella.', category: 'Pizza', imageUrl: dishImages.pizza, price: 68000, popular: true },
      { name: 'Four Cheese Pizza', description: 'Four cheeses on thin dough.', category: 'Pizza', imageUrl: dishImages.pizza, price: 72000 },
      { name: 'Chicken BBQ Pizza', description: 'Chicken, BBQ sauce, and onions.', category: 'Pizza', imageUrl: dishImages.pizza, price: 70000, popular: true },
      { name: 'Dodster', description: 'Hot chicken roll.', category: 'Wraps', imageUrl: dishImages.lavash, price: 32000 },
      { name: 'Cheese Sticks', description: 'Baked cheese sticks.', category: 'Sides', imageUrl: dishImages.pizza, price: 26000 },
      { name: 'Cinnamon Rolls', description: 'Sweet cinnamon rolls.', category: 'Desserts', imageUrl: dishImages.dessert, price: 28000 },
    ]),
  },
  {
    id: 'perferetto',
    slug: 'perferetto',
    name: 'Perferetto',
    cuisine: ['Italian', 'Pizza', 'Pasta'],
    category: 'Pizza',
    imageUrl: restaurantImages.pizza,
    rating: 4.7,
    reviews: 760,
    etaMin: 35,
    etaMax: 50,
    deliveryFee: 12000,
    minOrder: 50000,
    supportsPickup: true,
    workingHours: '11:00-23:00',
    priceLevel: '$$$',
    address: 'Tashkent, Taras Shevchenko Street 21',
    location: { lat: 41.3086, lng: 69.2774, address: 'Tashkent, Taras Shevchenko Street 21' },
    dishes: dishes('perferetto', [
      { name: 'Margherita Pizza', description: 'Tomato, mozzarella, and basil.', category: 'Pizza', imageUrl: dishImages.pizza, price: 62000, popular: true },
      { name: 'Carbonara Pasta', description: 'Creamy pasta with parmesan.', category: 'Pasta', imageUrl: dishImages.pasta, price: 58000, popular: true },
      { name: 'Bolognese Pasta', description: 'Classic beef bolognese.', category: 'Pasta', imageUrl: dishImages.pasta, price: 56000 },
      { name: 'Caesar Salad', description: 'Chicken Caesar salad.', category: 'Salads', imageUrl: dishImages.bowl, price: 42000 },
      { name: 'Tiramisu', description: 'Italian coffee dessert.', category: 'Desserts', imageUrl: dishImages.dessert, price: 39000 },
      { name: 'Garlic Bread', description: 'Toasted garlic bread.', category: 'Sides', imageUrl: dishImages.pizza, price: 22000 },
    ]),
  },
  {
    id: 'bellissimo-pizza',
    slug: 'bellissimo-pizza',
    name: 'Bellissimo Pizza',
    cuisine: ['Pizza', 'Italian', 'Fast food'],
    category: 'Pizza',
    imageUrl: restaurantImages.pizza,
    rating: 4.8,
    reviews: 3100,
    etaMin: 25,
    etaMax: 40,
    deliveryFee: 8000,
    minOrder: 40000,
    supportsPickup: true,
    workingHours: '10:00-00:00',
    priceLevel: '$$',
    address: 'Tashkent, Yunusabad 4',
    location: { lat: 41.3672, lng: 69.2892, address: 'Tashkent, Yunusabad 4' },
    dishes: dishes('bellissimo-pizza', [
      { name: 'Bellissimo Pizza', description: 'Signature pizza with beef and vegetables.', category: 'Pizza', imageUrl: dishImages.pizza, price: 69000, popular: true },
      { name: 'Margarita Pizza', description: 'Classic cheese pizza.', category: 'Pizza', imageUrl: dishImages.pizza, price: 59000 },
      { name: 'Chicken Ranch Pizza', description: 'Chicken, ranch sauce, and mozzarella.', category: 'Pizza', imageUrl: dishImages.pizza, price: 71000, popular: true },
      { name: 'Combo Pizza Set', description: 'Pizza with fries and drink.', category: 'Combos', imageUrl: dishImages.pizza, price: 89000 },
      { name: 'Cheese Bites', description: 'Small cheese snacks.', category: 'Sides', imageUrl: dishImages.pizza, price: 25000 },
      { name: 'Brownie', description: 'Chocolate brownie dessert.', category: 'Desserts', imageUrl: dishImages.dessert, price: 24000 },
    ]),
  },
  {
    id: 'yaponamama',
    slug: 'yaponamama',
    name: 'Yaponamama',
    cuisine: ['Sushi', 'Japanese', 'Healthy'],
    category: 'Sushi',
    imageUrl: restaurantImages.sushi,
    rating: 4.9,
    reviews: 1240,
    etaMin: 35,
    etaMax: 55,
    deliveryFee: 12000,
    minOrder: 60000,
    supportsPickup: true,
    workingHours: '11:00-23:00',
    priceLevel: '$$$',
    address: 'Tashkent, Afrosiyob Street 6',
    location: { lat: 41.3097, lng: 69.2842, address: 'Tashkent, Afrosiyob Street 6' },
    dishes: dishes('yaponamama', [
      { name: 'Philadelphia Roll', description: 'Salmon, cream cheese, and cucumber.', category: 'Sushi', imageUrl: dishImages.sushi, price: 56000, popular: true },
      { name: 'California Roll', description: 'Crab, avocado, and tobiko.', category: 'Sushi', imageUrl: dishImages.sushi, price: 52000 },
      { name: 'Salmon Set', description: 'Assorted salmon sushi set.', category: 'Sushi', imageUrl: dishImages.sushi, price: 118000, popular: true },
      { name: 'Miso Soup', description: 'Classic Japanese soup.', category: 'Soups', imageUrl: dishImages.bowl, price: 24000 },
      { name: 'Tempura Shrimp', description: 'Crispy shrimp tempura.', category: 'Sides', imageUrl: dishImages.sushi, price: 49000 },
      { name: 'Poke Bowl', description: 'Rice bowl with salmon and vegetables.', category: 'Healthy', imageUrl: dishImages.bowl, price: 68000 },
    ]),
  },
];

async function main() {
  const [{ auth, collection, db, doc, getDocs, serverTimestamp, signInWithEmailAndPassword, writeBatch }, { promos }] = await Promise.all([
    import('@repo/firebase-config'),
    import('../src/data/marketplace'),
  ]);

  const email = process.env.SEED_ADMIN_EMAIL || process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || 'mainadmin@demo.com';
  const password = process.env.SEED_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || 'password123';
  await signInWithEmailAndPassword(auth, email, password);

  const approvedIds = new Set(demoRestaurants.map((restaurant) => restaurant.id));
  const batch = writeBatch(db);
  const existingRestaurants = await getDocs(collection(db, 'restaurants'));
  let deactivatedRestaurants = 0;

  existingRestaurants.docs.forEach((restaurantDoc) => {
    if (!approvedIds.has(restaurantDoc.id)) {
      deactivatedRestaurants += 1;
      batch.set(doc(db, 'restaurants', restaurantDoc.id), {
        isOpen: false,
        isActive: false,
        status: 'inactive',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });

  for (const restaurant of demoRestaurants) {
    batch.set(doc(db, 'restaurants', restaurant.id), {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      imageUrl: restaurant.imageUrl,
      coverImageUrl: restaurant.imageUrl,
      cuisine: restaurant.cuisine,
      cuisines: restaurant.cuisine,
      category: restaurant.category,
      categories: Array.from(new Set([restaurant.category, ...restaurant.cuisine, ...restaurant.dishes.map((dish) => dish.category)])),
      rating: restaurant.rating,
      reviews: restaurant.reviews,
      reviewsCount: restaurant.reviews,
      etaMin: restaurant.etaMin,
      etaMax: restaurant.etaMax,
      avgDeliveryTime: restaurant.etaMax,
      deliveryFee: restaurant.deliveryFee,
      minOrder: restaurant.minOrder,
      minOrderAmount: restaurant.minOrder,
      promo: null,
      promoIds: [],
      isOpen: true,
      isActive: true,
      status: 'active',
      hasDiscount: false,
      supportsPickup: restaurant.supportsPickup,
      workingHours: restaurant.workingHours,
      zones: ['tashkent', 'center'],
      availableZones: ['tashkent', 'center'],
      priceLevel: restaurant.priceLevel,
      address: restaurant.address,
      location: restaurant.location,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    for (const dish of restaurant.dishes) {
      batch.set(doc(db, 'restaurants', restaurant.id, 'dishes', dish.id), {
        id: dish.id,
        restaurantId: restaurant.id,
        name: dish.name,
        description: dish.description,
        imageUrl: dish.imageUrl,
        category: dish.category,
        price: dish.price,
        popular: Boolean(dish.popular),
        isAvailable: true,
        available: true,
        tags: dish.popular ? ['popular'] : [],
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }
  }

  for (const promo of promos) {
    batch.set(doc(db, 'promos', promo.code), {
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

  console.log('Demo restaurants seeded.');
  console.log(`Active demo restaurants: ${demoRestaurants.length}`);
  console.log(`Seeded dishes: ${demoRestaurants.reduce((sum, restaurant) => sum + restaurant.dishes.length, 0)}`);
  console.log(`Deactivated old restaurants: ${deactivatedRestaurants}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
