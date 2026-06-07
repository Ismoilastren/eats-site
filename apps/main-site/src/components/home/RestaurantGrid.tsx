"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import RestaurantCard from "../ui/RestaurantCard";
import { db, collection, query, limit, onSnapshot, getDocs } from "@repo/firebase-config";
import { COLLECTIONS, Restaurant, MenuItem } from "@repo/shared-types";

interface RestaurantWithMenu extends Restaurant {
  menuItems?: MenuItem[];
}

interface RestaurantGridProps {
  selectedCategory: string | null;
}

export default function RestaurantGrid({ selectedCategory }: RestaurantGridProps) {
  const [restaurants, setRestaurants] = useState<RestaurantWithMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search')?.toLowerCase() || "";

  useEffect(() => {
    // Set up real-time listener
    const q = query(
      collection(db, COLLECTIONS.RESTAURANTS),
      limit(21)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setRestaurants([]);
        setIsLoading(false);
        return;
      }

      const data: RestaurantWithMenu[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as RestaurantWithMenu);
      });
      
      // Deep filter logic preparation: fetch menu items to attach to restaurants
      try {
        if (data.length > 0) {
          const menuItemsSnapshot = await getDocs(collection(db, COLLECTIONS.MENU_ITEMS));
          const allMenuItems: MenuItem[] = [];
          menuItemsSnapshot.forEach(doc => allMenuItems.push({ id: doc.id, ...doc.data() } as MenuItem));
          
          data.forEach(restaurant => {
            restaurant.menuItems = allMenuItems.filter(item => item.restaurantId === restaurant.id);
          });
        }
      } catch (err) {
        console.error("Failed to fetch menu items for deep filtering", err);
      }

      setRestaurants(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Real-time listener failed:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Deep Filter Logic: Search by Restaurant Name, Category, OR Menu Items
  const filteredData = useMemo(() => {
    // 0. Base Category filter first
    const categoryFiltered = restaurants.filter(restaurant => {
      const categoryMatch = !selectedCategory || (
        (restaurant as any).category === selectedCategory || 
        (restaurant.cuisine && restaurant.cuisine.includes(selectedCategory)) ||
        (restaurant.menuItems && restaurant.menuItems.some(item => item.category === selectedCategory))
      );
      return categoryMatch;
    });

    if (!searchQuery) return categoryFiltered;
    
    const query = searchQuery.toLowerCase().trim();
    
    return categoryFiltered.filter(restaurant => {
        // 1. Check Restaurant Name
        const matchName = restaurant.name?.toLowerCase().includes(query);
        
        // 2. Check Categories/Tags (if they exist)
        const matchCategory = 
            (restaurant as any).category?.toLowerCase().includes(query) || 
            (Array.isArray((restaurant as any).categories) && (restaurant as any).categories.some((c: string) => c.toLowerCase().includes(query)));
        
        // 3. DEEP CHECK: Iterate through the menu items
        // Fallback for different possible schema names (menu, items, dishes, foods)
        const menuArray = (restaurant as any).menuItems || (restaurant as any).menu || (restaurant as any).items || (restaurant as any).dishes || (restaurant as any).foods || [];
        
        const matchFood = Array.isArray(menuArray) && menuArray.some(food => 
            food.name?.toLowerCase().includes(query) ||
            food.description?.toLowerCase().includes(query)
        );

        // Return true if ANY of the conditions match
        return matchName || matchCategory || matchFood;
    });
  }, [restaurants, selectedCategory, searchQuery]);

  return (
    <section className="py-10 bg-gray-50 flex-1">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {searchQuery 
                ? `Search results for "${searchParams.get('search')}"` 
                : selectedCategory 
                    ? `${selectedCategory} Restaurants` 
                    : "All Restaurants"
            }
          </h2>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse bg-gray-200 h-64 rounded-2xl w-full"></div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center">
            <h3 className="text-xl text-gray-500 font-medium">No restaurants found.</h3>
            <p className="text-gray-400 mt-2">Try selecting a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            {filteredData.map((restaurant) => {
              // 1. EXTRACT MATCHING DISHES ON THE FLY
              const query = searchQuery?.toLowerCase().trim();
              const menuArray = (restaurant as any).menuItems || (restaurant as any).menu || (restaurant as any).items || (restaurant as any).dishes || (restaurant as any).foods || [];
              
              const matchingDishes = query 
                  ? menuArray.filter((food: any) => food.name?.toLowerCase().includes(query))
                  : [];

              return (
                <div key={restaurant.id} className="flex flex-col relative group">
                    <div className="z-10 bg-white rounded-2xl relative">
                      <RestaurantCard 
                        id={restaurant.id}
                        name={restaurant.name}
                        image={restaurant.imageUrl || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"}
                        cuisine={restaurant.cuisine}
                        rating={restaurant.rating || 0}
                        reviewCount={restaurant.reviewCount || 0}
                        deliveryTime={`${restaurant.avgDeliveryTime || 20}-${(restaurant.avgDeliveryTime || 20) + 15} min`}
                        deliveryFee={restaurant.deliveryFee || 0}
                        featured={false}
                      />
                    </div>
                    
                    {matchingDishes.length > 0 && (
                        <div className="bg-orange-50/80 border border-orange-200/60 rounded-b-2xl p-3 mx-3 -mt-3 pt-6 z-0 flex flex-col gap-2 shadow-inner transition-all">
                            <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-wider pl-1 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path></svg>
                                Matched Dishes
                            </span>
                            
                            <div className="flex flex-col gap-1.5">
                                {matchingDishes.slice(0, 3).map((food: any, idx: number) => (
                                    <Link 
                                        key={idx} 
                                        href={`/restaurants/${restaurant.id}?highlight=${encodeURIComponent(food.name)}`}
                                        className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-orange-100 shadow-sm hover:shadow-md hover:border-orange-400 transition-all cursor-pointer group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-orange-600 transition-colors">{food.name}</span>
                                            {food.price && (
                                                <span className="text-xs font-semibold text-orange-500">
                                                    {Number(food.price).toLocaleString('ru-RU')} UZS
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-6 h-6 shrink-0 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 text-xs font-bold group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                                            ➔
                                        </div>
                                    </Link>
                                ))}
                                
                                {matchingDishes.length > 3 && (
                                    <span className="text-xs text-orange-500 font-bold text-center mt-1">
                                        + {matchingDishes.length - 3} more matches
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
