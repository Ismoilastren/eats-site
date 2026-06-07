"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ShoppingCart, User, MapPin, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { auth, onAuthStateChanged } from "@repo/firebase-config";
import { useCart } from "@/context/CartContext";

export default function Navbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Keep local state in sync with URL
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const { cartTotal, cartCount } = useCart();
  const [address, setAddress] = useState("Tashkent, Amir Temur 14");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Update URL instantly as the user types
  const handleSearch = (term: string) => {
      setSearchTerm(term);
      const params = new URLSearchParams(searchParams.toString());
      
      if (term.trim()) {
          params.set('search', term.trim());
      } else {
          params.delete('search');
      }
      
      // Use replace instead of push so we don't clutter the browser history
      router.replace(`/?${params.toString()}`);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Reverse geocoding using free Nominatim API
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          
          if (data && data.address) {
            // Try to extract a sensible short address
            const road = data.address.road || data.address.suburb || data.address.city;
            const houseNumber = data.address.house_number || "";
            const city = data.address.city || data.address.town || data.address.state || "Unknown";
            
            setAddress(road ? `${city}, ${road} ${houseNumber}`.trim() : data.display_name.split(',').slice(0, 2).join(', '));
          } else {
            setAddress("Location found");
          }
        } catch (error) {
          console.error("Geocoding failed", error);
          setAddress("Coordinates found");
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLoadingLocation(false);
        alert("Failed to get your location. Please check your permissions.");
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const getUserInitial = () => {
    if (currentUser?.displayName) return currentUser.displayName.charAt(0).toUpperCase();
    if (currentUser?.email) return currentUser.email.charAt(0).toUpperCase();
    return <User className="w-5 h-5" />; 
  };

  return (
    <header className="sticky top-0 w-full z-50 bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-2xl text-orange-500">2(13)</span>
        </Link>

        {/* Center: Address & Search (Yandex Eats style) */}
        <div className="flex-1 max-w-4xl flex items-center gap-2">
          <button 
            onClick={handleGetLocation}
            disabled={isLoadingLocation}
            className="hidden md:flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-70"
          >
            {isLoadingLocation ? (
              <Loader2 size={18} className="text-gray-500 animate-spin" />
            ) : (
              <MapPin size={18} className="text-gray-500" />
            )}
            <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
              {address}
            </span>
          </button>
          
          <div className="flex-1 max-w-xl relative flex items-center mx-4">
            <svg className="absolute left-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for restaurants, dishes..." 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
            />
          </div>
        </div>

        {/* Right: Cart & Profile */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/cart" className="flex items-center justify-center w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors relative text-gray-700">
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[11px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {cartCount}
              </span>
            )}
          </Link>
          
          <Link href={currentUser ? "/profile" : "/auth/login"} className="w-11 h-11 rounded-full bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm transition-colors hover:bg-orange-200 cursor-pointer">
            {currentUser?.photoURL ? (
                <img 
                    src={currentUser.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none'; // Hide if broken
                    }}
                />
            ) : (
                <span className="font-bold text-lg flex items-center justify-center">
                    {getUserInitial()}
                </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
