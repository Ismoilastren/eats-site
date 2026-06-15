export type DeliveryMode = 'delivery' | 'pickup';
export type PriceLevel = '$' | '$$' | '$$$';

export type Dish = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  price: number;
  popular?: boolean;
  available: boolean;
};

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  cuisine: string[];
  category: string;
  rating: number;
  reviews: number;
  etaMin: number;
  etaMax: number;
  deliveryFee: number;
  minOrder: number;
  promo?: string;
  isOpen: boolean;
  isFreeDelivery?: boolean;
  hasDiscount?: boolean;
  supportsPickup: boolean;
  workingHours: string;
  availableZones: string[];
  priceLevel: PriceLevel;
  address?: string;
  location: { lat: number; lng: number; address?: string };
  locationIsVerified?: boolean;
  menu: Dish[];
};

export type Promo = {
  code: string;
  title: string;
  description: string;
  type: 'freeDelivery' | 'percent' | 'gift';
  value: number;
};

const images = [
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1561758033-d89a9ad46330?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1529042410759-befb1204b468?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1200&auto=format&fit=crop',
];

const dishImages = [
  'https://images.unsplash.com/photo-1565299507177-b0ac66763828?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1543353071-10c8ba85a904?q=80&w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=900&auto=format&fit=crop',
];

const baseDishNames = [
  ['Classic Burger', 'Double Cheeseburger', 'Chicken Lavash', 'Crispy Fries', 'Combo Box', 'Chocolate Milkshake'],
  ['Margherita Pizza', 'Pepperoni Pizza', 'Four Cheese Pizza', 'Caesar Salad', 'Tiramisu', 'Garlic Bread'],
  ['Philadelphia Roll', 'California Roll', 'Salmon Set', 'Miso Soup', 'Tempura Shrimp', 'Tuna Nigiri'],
  ['Wedding Plov', 'Manti', 'Samsa', 'Shashlik Mix', 'Achichuk Salad', 'Naryn Bowl'],
  ['Flat White', 'Iced Latte', 'Cheesecake', 'Croissant', 'Breakfast Bowl', 'Granola Cup'],
  ['Beef Lagman', 'Chicken Noodles', 'Dumpling Soup', 'Spicy Salad', 'Honey Cake', 'Berry Tea'],
];

function menuFor(restaurantId: string, cuisineIndex: number): Dish[] {
  const group = baseDishNames[cuisineIndex % baseDishNames.length];
  return group.map((name, index) => ({
    id: `${restaurantId}-dish-${index + 1}`,
    restaurantId,
    name,
    category: index < 3 ? 'Mains' : index === 3 ? 'Sides' : 'Desserts',
    description: `Fresh ${name.toLowerCase()} prepared for delivery in Tashkent.`,
    imageUrl: dishImages[(cuisineIndex + index) % dishImages.length],
    price: 18000 + (cuisineIndex * 2500) + (index * 7000),
    popular: index < 2,
    available: (cuisineIndex + index) % 9 !== 0,
  }));
}

const specs = [
  ['maxway-demo-1', 'maxway', 'MaxWay', ['Fast food', 'Burgers'], 'Fast food'],
  ['evos-center', 'evos', 'Evos Center', ['Fast food', 'Burgers'], 'Fast food'],
  ['bellissimo-magic', 'bellissimo', 'Bellissimo Pizza', ['Pizza', 'Italian'], 'Pizza'],
  ['sushi-city', 'sushi-city', 'Sushi City', ['Sushi', 'Japanese'], 'Sushi'],
  ['osh-markazi', 'osh-markazi', 'Osh Markazi', ['Uzbek food', 'Plov'], 'Uzbek food'],
  ['coffee-lab', 'coffee-lab', 'Coffee Lab', ['Coffee', 'Breakfast'], 'Coffee'],
  ['bon-dessert', 'bon-dessert', 'Bon Dessert', ['Desserts', 'Coffee'], 'Desserts'],
  ['green-bowl', 'green-bowl', 'Green Bowl', ['Healthy', 'Breakfast'], 'Healthy'],
  ['lavash-house', 'lavash-house', 'Lavash House', ['Fast food', 'Uzbek food'], 'Fast food'],
  ['pizza-uno', 'pizza-uno', 'Pizza Uno', ['Pizza', 'Fast food'], 'Pizza'],
  ['tokyo-roll', 'tokyo-roll', 'Tokyo Roll', ['Sushi', 'Healthy'], 'Sushi'],
  ['samarqand-darvoza', 'samarqand-darvoza', 'Samarqand Darvoza', ['Uzbek food', '24/7'], 'Uzbek food'],
  ['burger-point', 'burger-point', 'Burger Point', ['Burgers', 'Fast food'], 'Burgers'],
  ['morning-cafe', 'morning-cafe', 'Morning Cafe', ['Breakfast', 'Coffee'], 'Breakfast'],
  ['sweet-room', 'sweet-room', 'Sweet Room', ['Desserts', 'Coffee'], 'Desserts'],
  ['diet-kitchen', 'diet-kitchen', 'Diet Kitchen', ['Healthy', 'Breakfast'], 'Healthy'],
  ['street-kebab', 'street-kebab', 'Street Kebab', ['Uzbek food', 'Fast food'], 'Uzbek food'],
  ['night-food', 'night-food', 'Night Food 24/7', ['24/7', 'Fast food'], '24/7'],
  ['market-fresh', 'market-fresh', 'Market Fresh', ['Grocery', 'Healthy'], 'Grocery'],
  ['burger-avenue', 'burger-avenue', 'Burger Avenue', ['Burgers', 'Fast food'], 'Burgers'],
  ['plov-station', 'plov-station', 'Plov Station', ['Uzbek food', 'Plov'], 'Uzbek food'],
  ['sushi-avenue', 'sushi-avenue', 'Sushi Avenue', ['Sushi', 'Japanese'], 'Sushi'],
  ['pasta-corner', 'pasta-corner', 'Pasta Corner', ['Italian', 'Pizza'], 'Pizza'],
  ['tashkent-bakery', 'tashkent-bakery', 'Tashkent Bakery', ['Desserts', 'Breakfast'], 'Desserts'],
  ['metro-coffee', 'metro-coffee', 'Metro Coffee', ['Coffee', 'Breakfast'], 'Coffee'],
] as const;

export const restaurants: Restaurant[] = specs.map((spec, index) => ({
  id: spec[0],
  slug: spec[1],
  name: spec[2],
  cuisine: [...spec[3]],
  category: spec[4],
  imageUrl: images[index % images.length],
  rating: Number((4.2 + ((index % 7) * 0.1)).toFixed(1)),
  reviews: 120 + index * 37,
  etaMin: 18 + (index % 5) * 4,
  etaMax: 30 + (index % 5) * 5,
  deliveryFee: index % 4 === 0 ? 0 : 7000 + (index % 3) * 3000,
  minOrder: 35000 + (index % 4) * 10000,
  promo: index % 3 === 0 ? 'FIRST21' : index % 5 === 0 ? 'Free dessert' : undefined,
  isOpen: index % 6 !== 0,
  isFreeDelivery: index % 4 === 0,
  hasDiscount: index % 3 === 0,
  supportsPickup: index % 5 !== 2,
  workingHours: index % 8 === 0 ? '24/7' : index % 6 === 0 ? '10:00-22:00' : '09:00-23:30',
  availableZones: index % 7 === 0 ? ['center'] : ['tashkent', 'center'],
  priceLevel: (index % 3 === 0 ? '$' : index % 3 === 1 ? '$$' : '$$$') as PriceLevel,
  address: 'Tashkent, Amir Temur Avenue 14',
  location: { lat: 41.311081 + index * 0.004, lng: 69.240562 + index * 0.003 },
  locationIsVerified: true,
  menu: menuFor(spec[0], index),
}));

export const categories = [
  'Restaurants',
  'Grocery',
  'Fast food',
  'Pizza',
  'Sushi',
  'Burgers',
  'Uzbek food',
  'Coffee',
  'Desserts',
  'Healthy',
  'Breakfast',
  '24/7',
];

export const deliveryTimeFilters = [
  { label: 'Any time', value: 'any' },
  { label: 'Under 25 min', value: '25' },
  { label: 'Under 35 min', value: '35' },
  { label: 'Under 45 min', value: '45' },
];

export const priceLevels: Array<{ label: string; value: PriceLevel | 'any' }> = [
  { label: 'Any price', value: 'any' },
  { label: '$', value: '$' },
  { label: '$$', value: '$$' },
  { label: '$$$', value: '$$$' },
];

export const promos: Promo[] = [
  { code: 'FIRST21', title: '21% off first order', description: 'Use FIRST21 at checkout.', type: 'percent', value: 21 },
  { code: 'FREEDEL', title: 'Free delivery', description: 'Delivery fee removed from cart.', type: 'freeDelivery', value: 0 },
  { code: 'GIFT', title: 'Gift dessert', description: 'Adds a dessert benefit note.', type: 'gift', value: 0 },
];

export const addressSuggestions = [
  'Tashkent, Amir Temur Avenue 14',
  'Tashkent, Chorsu Bazaar entrance',
  'Tashkent, Mirabad Street 27',
  'Tashkent, Chilanzar C-5, house 12',
  'Tashkent, Yunusabad-4, building 8',
  'Tashkent, Magic City main gate',
  'Tashkent, Parkent Street 131',
  'Tashkent, Almazar metro station',
];
