'use client';
import { useEffect, useState, Suspense } from "react";
import RestaurantCard from "@/components/ui/RestaurantCard";
import { Search } from "lucide-react";
import { db, collection, getDocs, query, where } from "@repo/firebase-config";
import { COLLECTIONS, Restaurant } from "@repo/shared-types";
import { useSearchParams, useRouter } from "next/navigation";

function RestaurantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryQuery = searchParams.get("category");
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(categoryQuery);

  const categories = ["Burger", "Pizza", "Sushi", "Healthy", "Asian", "Dessert", "Mexican", "Coffee"];

  useEffect(() => {
    if (categoryQuery) {
      setActiveCategory(categoryQuery);
    }
  }, [categoryQuery]);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        let q;
        if (activeCategory) {
          // Instructed by user to use a direct where query
          q = query(
            collection(db, COLLECTIONS.RESTAURANTS),
            where("cuisine", "==", activeCategory)
          );
        } else {
          q = query(collection(db, COLLECTIONS.RESTAURANTS));
        }
        
        const snapshot = await getDocs(q);
        let data: Restaurant[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Restaurant);
        });

        // Additional client-side search text filtering
        if (searchTerm) {
          data = data.filter(r => 
            (r.name && r.name.toLowerCase().includes(searchTerm.toLowerCase()))
          );
        }

        setRestaurants(data);
      } catch (error) {
        console.error("Failed to fetch restaurants:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRestaurants();
  }, [activeCategory, searchTerm]);

  const handleCategoryClick = (cat: string) => {
    const newCat = activeCategory === cat ? null : cat;
    setActiveCategory(newCat);
    if (newCat) {
      router.push(`/restaurants?category=${newCat}`);
    } else {
      router.push(`/restaurants`);
    }
  };

  const clearFilters = () => {
    setActiveCategory(null);
    setSearchTerm("");
    router.push(`/restaurants`);
  };

  return (
    <div className="pt-8 pb-20 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 lg:px-8">
        
        {/* Header & Search */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {activeCategory ? `${activeCategory} Restaurants` : "All Restaurants"}
          </h1>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by restaurant name..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-gray-700"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>
        </div>
        
        <div className="sticky top-20 z-30 -mx-4 mb-8 bg-gray-50/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={clearFilters}
              className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold transition-all ${
                !activeCategory ? "bg-gray-950 text-white shadow-lg" : "bg-white text-gray-800 border border-gray-200 hover:border-gray-300"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-gray-950 text-white shadow-lg"
                    : "bg-white text-gray-800 border border-gray-200 hover:border-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          {/* Grid */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600 font-medium">
                {isLoading ? "Loading restaurants..." : `${restaurants.length} restaurants found`}
              </p>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-64 bg-gray-200 rounded-2xl animate-pulse w-full"></div>
                ))}
              </div>
            ) : restaurants.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                <p className="text-gray-500 text-lg">No restaurants match your filters.</p>
                <button 
                  onClick={clearFilters}
                  className="mt-4 px-6 py-2.5 bg-primary/10 text-primary font-medium rounded-xl hover:bg-primary/20 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {restaurants.map(restaurant => (
                  <RestaurantCard 
                    key={restaurant.id} 
                    id={restaurant.id}
                    name={restaurant.name}
                    image={restaurant.imageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop"}
                    cuisine={restaurant.cuisine}
                    rating={restaurant.rating || 0}
                    reviewCount={restaurant.reviewCount || 0}
                    deliveryTime={`${restaurant.avgDeliveryTime || 30} min`}
                    deliveryFee={restaurant.deliveryFee || 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={
      <div className="pt-28 pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <RestaurantsContent />
    </Suspense>
  );
}
