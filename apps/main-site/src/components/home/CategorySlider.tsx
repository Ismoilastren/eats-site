"use client";

const categories = [
  { name: "Burger", icon: "🍔", color: "bg-orange-100" },
  { name: "Pizza", icon: "🍕", color: "bg-red-100" },
  { name: "Sushi", icon: "🍣", color: "bg-blue-100" },
  { name: "Healthy", icon: "🥗", color: "bg-green-100" },
  { name: "Asian", icon: "🍜", color: "bg-yellow-100" },
  { name: "Dessert", icon: "🍰", color: "bg-pink-100" },
  { name: "Mexican", icon: "🌮", color: "bg-purple-100" },
  { name: "Coffee", icon: "☕", color: "bg-amber-100" },
];

interface CategorySliderProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export default function CategorySlider({ selectedCategory, onSelectCategory }: CategorySliderProps) {
  const handleCategoryClick = (categoryName: string) => {
    // If clicked category is already selected, set to null (show all), otherwise select it
    onSelectCategory(selectedCategory === categoryName ? null : categoryName);
  };

  return (
    <section className="pt-6 pb-2 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex gap-2 overflow-x-auto py-3 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => onSelectCategory(null)}
            className={`flex items-center gap-2 shrink-0 snap-start rounded-full px-5 py-3 text-sm font-bold transition-all ${
              selectedCategory === null
                ? 'bg-gray-950 text-white shadow-lg'
                : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300'
            }`}
          >
            All
          </button>
          {categories.map((category, index) => (
            <button 
              key={index} 
              onClick={() => handleCategoryClick(category.name)}
              className={`flex items-center gap-2 shrink-0 snap-start rounded-full px-5 py-3 text-sm font-bold transition-all ${
                selectedCategory === category.name
                  ? 'bg-gray-950 text-white shadow-lg'
                  : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${category.color}`}>
                {category.icon}
              </span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
