"use client";

import { useState, useEffect, Suspense } from "react";
import CategorySlider from "@/components/home/CategorySlider";
import RestaurantGrid from "@/components/home/RestaurantGrid";
import { auth, onAuthStateChanged } from "@repo/firebase-config";
import LoginPage from "@/app/auth/login/page";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  // STRICT GUARD: If no user, show ONLY the Login UI
  if (!user) {
    return <LoginPage />;
  }

  // IF AUTHENTICATED, show the actual homepage
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <CategorySlider selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
      <Suspense fallback={<div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" size={30} /></div>}>
        <RestaurantGrid selectedCategory={selectedCategory} />
      </Suspense>
    </div>
  );
}
