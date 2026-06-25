'use client';
import { use, useEffect, useState } from "react";
import Image from "next/image";
import { Star, Clock, MapPin, Info, Search, Heart, Plus, Minus, Trash2 } from "lucide-react";
import MenuItemCard from "@/components/ui/MenuItemCard";
import { db, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, auth, onAuthStateChanged } from "@repo/firebase-config";
import { COLLECTIONS, Restaurant, MenuItem } from "@repo/shared-types";
import { useMarketplace } from "@/context/MarketplaceContext";
import type { Dish as MarketplaceDish, Restaurant as MarketplaceRestaurant } from "@/data/marketplace";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const sectionId = (category: string) => `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

function toMarketplaceRestaurant(restaurant: Restaurant): MarketplaceRestaurant {
  const lat = Number(restaurant.location?.latitude);
  const lng = Number(restaurant.location?.longitude);
  const cuisine = String(restaurant.cuisine || 'Restaurant')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: restaurant.id,
    slug: restaurant.id,
    brandId: restaurant.brandId,
    brandName: restaurant.brandName || restaurant.name,
    branchId: restaurant.branchId || restaurant.id,
    branchName: restaurant.branchName,
    branchDisplayName: restaurant.branchDisplayName,
    name: restaurant.name,
    imageUrl: restaurant.imageUrl,
    cuisine: cuisine.length > 0 ? cuisine : ['Restaurant'],
    category: cuisine[0] || 'Restaurant',
    rating: Number(restaurant.rating || 0),
    reviews: Number(restaurant.reviewCount || 0),
    etaMin: Number(restaurant.avgDeliveryTime || 30),
    etaMax: Number(restaurant.avgDeliveryTime || 45),
    deliveryFee: Number(restaurant.deliveryFee || 0),
    serviceFee: Number((restaurant as Restaurant & { serviceFee?: number }).serviceFee || 3000),
    minOrder: Number(restaurant.minOrderAmount || 0),
    isOpen: restaurant.isActive !== false,
    supportsPickup: true,
    workingHours: '09:00-23:00',
    availableZones: ['tashkent'],
    priceLevel: '$$',
    address: restaurant.address,
    location: {
      lat: Number.isFinite(lat) ? lat : 41.311081,
      lng: Number.isFinite(lng) ? lng : 69.240562,
      address: restaurant.address,
    },
    locationIsVerified: Number.isFinite(lat) && Number.isFinite(lng),
    menu: [],
  };
}

function toMarketplaceDish(item: MenuItem): MarketplaceDish {
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    brandId: item.brandId,
    brandName: item.brandName,
    branchId: item.branchId || item.restaurantId,
    branchName: item.branchName,
    name: item.name,
    description: item.description || '',
    category: item.category || 'Mains',
    imageUrl: item.imageUrl || '',
    price: Number(item.price || 0),
    available: item.isAvailable !== false,
  };
}

export default function RestaurantDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const restaurantId = resolvedParams.id;
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const { cart, addDish, updateQuantity, removeDish, subtotal } = useMarketplace();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch Restaurant Details
        const docRef = doc(db, COLLECTIONS.RESTAURANTS, restaurantId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setRestaurant({ id: docSnap.id, ...docSnap.data() } as Restaurant);
        } else {
          console.warn("Restaurant not found in DB!");
          setRestaurant(null);
          return; // Skip fetching menu items if restaurant doesn't exist
        }

        // Admin writes the canonical menu to restaurants/{id}/dishes. Keep
        // top-level menuItems as a legacy fallback for older seeded records.
        const dishesSnap = await getDocs(collection(db, COLLECTIONS.RESTAURANTS, restaurantId, 'dishes'));
        const items: MenuItem[] = [];
        dishesSnap.forEach((d) => {
          const item = { id: d.id, ...d.data(), restaurantId } as MenuItem;
          if (item.isAvailable !== false) items.push(item);
        });

        if (items.length === 0) {
          const q = query(
            collection(db, COLLECTIONS.MENU_ITEMS),
            where("restaurantId", "==", restaurantId),
            where("isAvailable", "==", true)
          );

          const menuSnap = await getDocs(q);
          menuSnap.forEach((d) => {
            items.push({ id: d.id, ...d.data() } as MenuItem);
          });
        }
        
        setMenuItems(items.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)));
      } catch (error) {
        console.error("Failed to fetch restaurant details:", error);
        setRestaurant(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [restaurantId]);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
    );
  }

  if (!restaurant) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h1 className="text-2xl font-bold text-gray-800">Restaurant not found</h1>
            <button onClick={() => router.push('/')} className="mt-4 text-orange-500 hover:underline">Go back home</button>
        </div>
    );
  }

  // Dynamic Category Generator with Strict Deduplication
  const uniqueCategories = Array.from(new Set(menuItems.map(item => (item.category || 'Uncategorized').trim())));

  // Group menu items by category
  const groupedMenu = menuItems.reduce((acc, item) => {
    const cat = (item.category || 'Uncategorized').trim();
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const displayMenu = groupedMenu;

  const isLiked = user && (restaurant as any)?.likedBy?.includes(user.uid);

  const toggleLike = async () => {
    if (!user) {
      toast.error('You must be logged in to like a restaurant');
      return;
    }
    if (!restaurant) return;

    const ref = doc(db, COLLECTIONS.RESTAURANTS, restaurant.id);
    const newLikedBy = isLiked 
      ? ((restaurant as any).likedBy || []).filter((id: string) => id !== user.uid)
      : [...((restaurant as any).likedBy || []), user.uid];

    // Optimistic update
    setRestaurant({ ...restaurant, likedBy: newLikedBy } as any);

    try {
      if (isLiked) {
        await updateDoc(ref, { likedBy: arrayRemove(user.uid) });
      } else {
        await updateDoc(ref, { likedBy: arrayUnion(user.uid) });
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update like status');
      // Revert optimistic update by restoring the previous cart snapshot.
      setRestaurant(restaurant);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* Hero Banner */}
      <div className="relative h-[300px] md:h-[400px] w-full mt-16 md:mt-20">
        <Image 
          src={restaurant?.imageUrl || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1600&h=600&fit=crop"} 
          alt={restaurant?.name || "Restaurant"} 
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
        
        <div className="absolute top-6 right-4 md:right-8 flex gap-3 z-10">
          <button 
            onClick={toggleLike}
            className={`w-10 h-10 backdrop-blur-md rounded-full flex items-center justify-center transition-colors border-none cursor-pointer ${isLiked ? 'bg-white text-red-500 shadow-md' : 'bg-white/20 text-white hover:bg-white hover:text-red-500'}`}
          >
            <Heart size={20} className={isLiked ? "fill-red-500" : ""} />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 w-full">
          <div className="container mx-auto px-4 md:px-6 pb-8">
            <div className="flex flex-col md:flex-row md:items-end gap-6 relative z-10">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-2xl p-2 shadow-xl shrink-0">
                <div className="relative w-full h-full rounded-xl overflow-hidden">
                  <Image src={restaurant.imageUrl || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop"} alt="Logo" fill className="object-cover" />
                </div>
              </div>
              <div className="flex-1 text-white">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{restaurant?.name}</h1>
                  {restaurant?.rating && restaurant.rating >= 4.5 && (
                    <div className="bg-primary px-2 py-1 rounded text-xs font-bold">Top Rated</div>
                  )}
                </div>
                <p className="text-gray-200 text-lg mb-4">{restaurant?.cuisine}</p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  {/* Rating Badge */}
                  <div className="flex items-center gap-1.5 bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-700/50 shadow-sm">
                      <span className="text-yellow-400 text-sm">★</span>
                      <span className="text-white text-sm font-medium tracking-wide">
                          {restaurant?.rating ? restaurant.rating.toFixed(1) : '0.0'} 
                          <span className="text-gray-400 font-normal ml-1">
                              ({restaurant?.reviewCount || 0} reviews)
                          </span>
                      </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-gray-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-700/50">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-white text-sm font-medium">
                        {`${restaurant?.avgDeliveryTime || 20}-${(restaurant?.avgDeliveryTime || 20) + 15} min`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 mt-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Content (Menu) */}
          <div className="flex-1">
            {/* Category Nav */}
            <div className="bg-white rounded-xl shadow-sm p-2 mb-8 sticky top-24 z-30 flex items-center gap-2 overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
              <div className="relative mr-4 p-2 shrink-0">
                <Search size={20} className="text-gray-400" />
              </div>
              {uniqueCategories.length > 0 ? (
                uniqueCategories.map((catName, i) => (
                  <button 
                    key={i} 
                    onClick={() => {
                      setSelectedCategory(catName);
                      document.getElementById(sectionId(catName))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`px-5 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors border-none cursor-pointer ${selectedCategory === catName ? 'bg-primary text-white shadow-md' : 'text-gray-600 bg-white hover:bg-gray-100 border border-gray-100'}`}
                  >
                    {catName}
                  </button>
                ))
              ) : (
                <span className="text-gray-400 px-4">Menu categories</span>
              )}
            </div>

            {/* Menu Sections */}
            <div className="space-y-12">
              {Object.keys(displayMenu).length === 0 ? (
                 <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                   <div className="text-4xl mb-3">📋</div>
                   <h3 className="text-xl font-bold text-gray-900 mb-2">No menu items</h3>
                   <p className="text-gray-500">There are no menu items in this category.</p>
                 </div>
              ) : (
                Object.entries(displayMenu).map(([categoryName, items]) => (
                  <div key={categoryName} id={sectionId(categoryName)} className="scroll-mt-36">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 sticky top-[154px] z-20 bg-gray-50/95 backdrop-blur py-3">{categoryName}</h2>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {items.map(item => (
                        <MenuItemCard 
                          key={item.id} 
                          id={item.id}
                          name={item.name}
                          description={item.description}
                          price={item.price}
                          image={item.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                          popular={false}
                          onAdd={() => {
                            const isSwitchingRestaurant = cart.length > 0 && cart[0].restaurantId !== item.restaurantId;
                            addDish(toMarketplaceRestaurant(restaurant), toMarketplaceDish(item));
                            toast.success(`${item.name} added to cart`);
                            if (isSwitchingRestaurant) {
                              toast('Cart switched to this restaurant');
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart Sidebar (Desktop only) */}
          <div className="hidden lg:block w-80 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-28">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-between">
                Your Order
                {cart.length > 0 && (
                  <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-bold">{cart.reduce((a, b) => a + b.quantity, 0)} items</span>
                )}
              </h3>
              
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
                    🛒
                  </div>
                  <p className="text-gray-500 font-medium mb-1">Your cart is empty</p>
                  <p className="text-sm text-gray-400">Add items to get started</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-gray-900 line-clamp-1">{item.name}</p>
                        <p className="text-sm text-gray-500">{new Intl.NumberFormat('ru-RU').format(item.price * item.quantity)} UZS</p>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                        {item.quantity > 1 ? (
                          <button aria-label={`Decrease ${item.name} quantity`} onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white rounded text-gray-500 border-none cursor-pointer"><Minus size={14}/></button>
                        ) : (
                          <button aria-label={`Remove ${item.name} from cart`} onClick={() => removeDish(item.id)} className="p-1 hover:bg-white rounded text-red-500 border-none cursor-pointer"><Trash2 size={14}/></button>
                        )}
                        <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                        <button aria-label={`Increase ${item.name} quantity`} onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white rounded text-gray-500 border-none cursor-pointer"><Plus size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="border-t border-gray-100 pt-4 mt-6">
                <div className="flex justify-between font-bold text-gray-900 mb-4">
                  <span>Total</span>
                  <span>{new Intl.NumberFormat('ru-RU').format(subtotal)} UZS</span>
                </div>
                <button 
                  disabled={cart.length === 0}
                  onClick={() => router.push('/cart')}
                  className={`w-full font-bold py-4 rounded-xl border-none ${cart.length === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/20 transition-all'}`}
                >
                  Checkout
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed left-0 right-0 bottom-0 z-50 lg:hidden px-4 pb-4 pointer-events-none">
          <button
            onClick={() => router.push('/cart')}
            className="pointer-events-auto w-full max-w-xl mx-auto flex items-center justify-between rounded-2xl bg-gray-950 text-white px-5 py-4 shadow-2xl border border-white/10"
          >
            <span className="font-bold">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span>
            <span className="font-black">{new Intl.NumberFormat('ru-RU').format(subtotal)} UZS</span>
            <span className="bg-primary text-white px-3 py-2 rounded-xl text-sm font-bold">Checkout</span>
          </button>
        </div>
      )}
    </div>
  );
}
