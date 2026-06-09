# Main Site Marketplace Backend

## Data Source

The marketplace supports two modes:

- `NEXT_PUBLIC_MARKETPLACE_DATA_SOURCE=mock`
  - Reads restaurants, dishes, promos, cart and demo orders from local in-app data/localStorage.
  - Default mode.
- `NEXT_PUBLIC_MARKETPLACE_DATA_SOURCE=firestore`
  - Reads restaurants, dishes, promos and orders from Firebase Firestore.
  - Checkout writes real `orders` documents.

## Required Firebase Env Vars

Use the same values locally and in Vercel:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_MARKETPLACE_DATA_SOURCE=firestore
```

## Seed Firestore

```bash
pnpm --filter main-site seed:marketplace
```

The seed is idempotent. It writes with `setDoc(..., { merge: true })`, so running it again updates existing restaurants, dishes and promos without duplicating records.

## Collections

### `restaurants/{restaurantId}`

```ts
{
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  coverImageUrl: string;
  cuisine: string[];
  cuisines: string[];
  category: string;
  categories: string[];
  rating: number;
  reviews: number;
  reviewsCount: number;
  etaMin: number;
  etaMax: number;
  deliveryFee: number;
  minOrder: number;
  promo: string | null;
  promoIds: string[];
  isOpen: boolean;
  hasDiscount: boolean;
  supportsPickup: boolean;
  workingHours: string;
  zones: string[];
  priceLevel: '$' | '$$' | '$$$';
  location: { lat: number; lng: number };
}
```

### `restaurants/{restaurantId}/dishes/{dishId}`

```ts
{
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  price: number;
  popular: boolean;
  isAvailable: boolean;
  available: boolean;
  tags: string[];
}
```

### `promos/{promoCode}`

```ts
{
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'percent' | 'freeDelivery';
  value: number;
  isActive: boolean;
}
```

### `orders/{orderId}`

Checkout writes:

```ts
{
  userId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantLocation: { lat: number; lng: number };
  items: Array<{ id: string; name: string; price: number; quantity: number; restaurantId: string }>;
  address: string;
  customerAddress: string;
  customerLocation: { lat: number; lng: number };
  customerName: string;
  customerPhone: string;
  paymentMethod: 'cash' | 'card';
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  promoCode: string | null;
  status: 'pending';
  statusHistory: Array<{ status: string; at: string }>;
  assignedCourier: null;
  etaMinutes: number;
}
```

`status: 'pending'` and `assignedCourier: null` are intentional. They keep the order visible to Admin/Restaurant first, then Courier only after Kitchen moves it to `preparing`.

## Current Limitations

- Main-site still uses a mock customer id until full web auth is enabled.
- `customerLocation` defaults to Tashkent center on web checkout unless a real address GPS picker is added.
- Firestore mode uses direct reads. Add composite indexes if Firebase asks for them after production data grows.
