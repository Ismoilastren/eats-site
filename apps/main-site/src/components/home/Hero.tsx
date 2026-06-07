import Image from "next/image";
import { MapPin, Search } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background with abstract shapes */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-white -z-10" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 rounded-l-full blur-3xl -z-10 translate-x-1/3" />
      
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="w-full md:w-1/2 max-w-2xl">
            <div className="inline-block px-4 py-1.5 bg-orange-100 text-primary font-semibold rounded-full mb-6 text-sm">
              🚴 ⚡ Lightning fast delivery
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-secondary leading-tight mb-6">
              Delicious food,<br />
              <span className="text-primary">delivered</span> to your door.
            </h1>
            <p className="text-gray-600 text-lg mb-8 max-w-lg leading-relaxed">
              Order from hundreds of local restaurants and get your favorite meals delivered fresh and hot in minutes.
            </p>
            
            <div className="bg-white p-2 rounded-full shadow-xl border border-gray-100 flex items-center flex-col sm:flex-row gap-2 max-w-lg">
              <div className="flex-1 flex items-center px-4 w-full h-12">
                <MapPin className="text-primary mr-2 shrink-0" size={20} />
                <input 
                  type="text" 
                  placeholder="Enter your delivery address..." 
                  className="w-full bg-transparent border-none focus:outline-none text-gray-700"
                />
              </div>
              <button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold h-12 px-8 rounded-full transition-all shadow-md flex items-center justify-center gap-2">
                <Search size={18} />
                Find Food
              </button>
            </div>
            
            <div className="mt-10 flex items-center gap-4 text-sm text-gray-500 font-medium">
              <span>Popular:</span>
              <div className="flex gap-2">
                <span className="bg-gray-100 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-200 transition-colors">Pizza</span>
                <span className="bg-gray-100 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-200 transition-colors">Sushi</span>
                <span className="bg-gray-100 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-200 transition-colors">Burgers</span>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/2 relative">
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary to-orange-300 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <Image 
                src="https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=800&fit=crop" 
                alt="Delicious food plate" 
                fill
                className="object-cover rounded-full border-8 border-white shadow-2xl relative z-10"
                priority
              />
              {/* Floating badges */}
              <div className="absolute top-10 -left-6 bg-white py-2 px-4 rounded-xl shadow-xl z-20 flex items-center gap-3 border border-gray-50">
                <div className="bg-green-100 p-2 rounded-full">
                  <span className="text-xl">🛵</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Delivery</p>
                  <p className="text-sm font-bold text-gray-800">15-20 Min</p>
                </div>
              </div>
              
              <div className="absolute bottom-10 -right-4 bg-white py-2 px-4 rounded-xl shadow-xl z-20 flex items-center gap-3 border border-gray-50">
                <div className="bg-yellow-100 p-2 rounded-full">
                  <span className="text-xl">⭐</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Top Rated</p>
                  <p className="text-sm font-bold text-gray-800">4.9/5 (10k+)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
