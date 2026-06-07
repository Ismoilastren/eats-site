import Image from "next/image";
import Link from "next/link";
import { Star, Clock, Bike, MapPin } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

interface RestaurantCardProps {
  id: string;
  name: string;
  image: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  featured?: boolean;
}

export default function RestaurantCard({
  id,
  name,
  image,
  cuisine,
  rating,
  reviewCount,
  deliveryTime,
  deliveryFee,
  featured
}: RestaurantCardProps) {
  const { settings } = useSettings();
  const currentDeliveryFee = Number(settings?.baseDeliveryFee ?? deliveryFee ?? 0);
  
  return (
    <Link href={`/restaurants/${id}`} className="group block h-full">
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col hover:-translate-y-1">
        <div className="relative h-48 w-full overflow-hidden bg-gray-100">
          <Image 
            src={image} 
            alt={name} 
            fill 
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {featured && (
            <div className="absolute top-3 left-3 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
              Featured
            </div>
          )}
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-bold text-gray-800">{rating}</span>
            <span className="text-xs text-gray-500">({reviewCount})</span>
          </div>
        </div>
        
        <div className="p-5 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">{name}</h3>
          </div>
          
          <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
            <MapPin size={14} />
            <span className="line-clamp-1">{cuisine}</span>
          </div>
          
          <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-gray-700 bg-gray-50 px-2 py-1 rounded-md">
              <Clock size={14} className="text-primary" />
              <span className="font-medium">{deliveryTime}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-700 bg-gray-50 px-2 py-1 rounded-md">
              <Bike size={14} className="text-primary" />
              <span className="font-medium">
                {currentDeliveryFee > 0 
                    ? `${currentDeliveryFee.toLocaleString('ru-RU')} UZS` 
                    : 'Free'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
