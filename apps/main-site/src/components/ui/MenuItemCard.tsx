import Image from "next/image";
import { Plus } from "lucide-react";

interface MenuItemCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  popular?: boolean;
  onAdd?: () => void;
}

export default function MenuItemCard({ id, name, description, price, image, popular, onAdd }: MenuItemCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex gap-4 h-full">
      <div className="flex-1 flex flex-col">
        {popular && (
          <span className="inline-block self-start bg-orange-100 text-primary text-[10px] font-bold px-2 py-0.5 rounded-sm mb-2">
            POPULAR
          </span>
        )}
        <h4 className="font-bold text-gray-900 mb-1">{name}</h4>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">{description}</p>
        <div className="font-bold text-gray-900 mt-auto">{new Intl.NumberFormat('ru-RU').format(price)} UZS</div>
      </div>
      
      <div className="relative w-28 h-28 md:w-32 md:h-32 shrink-0 rounded-xl overflow-hidden bg-gray-50">
        <Image 
          src={image} 
          alt={name} 
          fill 
          className="object-cover"
        />
        <button 
          type="button"
          aria-label={`Add ${name} to cart`}
          onClick={onAdd}
          className="absolute bottom-2 right-2 w-8 h-8 bg-white text-primary rounded-full shadow-md flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
