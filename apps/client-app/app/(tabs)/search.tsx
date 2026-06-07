import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const RECENT_SEARCHES = [
  'Pizza',
  'Sushi near me',
  'Burger deals',
  'Healthy bowls',
  'Thai food',
];

const SEARCH_RESULTS = [
  {
    id: 'r1',
    name: 'Bella Napoli Pizzeria',
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop',
    cuisine: 'Italian • Pizza',
    rating: 4.8,
    deliveryTime: 25,
  },
  {
    id: 'r2',
    name: 'Burger Palace',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop',
    cuisine: 'American • Burgers',
    rating: 4.6,
    deliveryTime: 20,
  },
  {
    id: 'r3',
    name: 'Sakura Sushi Bar',
    imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop',
    cuisine: 'Japanese • Sushi',
    rating: 4.9,
    deliveryTime: 35,
  },
  {
    id: 'r5',
    name: 'Taj Mahal Kitchen',
    imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop',
    cuisine: 'Indian • Curry',
    rating: 4.7,
    deliveryTime: 35,
  },
  {
    id: 'r6',
    name: 'Sweet Temptations',
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=400&fit=crop',
    cuisine: 'Bakery • Desserts',
    rating: 4.8,
    deliveryTime: 20,
  },
  {
    id: 'r8',
    name: 'El Sombrero',
    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=400&fit=crop',
    cuisine: 'Mexican • Tacos',
    rating: 4.6,
    deliveryTime: 25,
  },
];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const filteredResults = SEARCH_RESULTS.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    r.cuisine.toLowerCase().includes(query.toLowerCase())
  );

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (text.length > 0) {
      setHasSearched(true);
    }
  }, []);

  const handleRecentSearch = useCallback((term: string) => {
    setQuery(term);
    setHasSearched(true);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Search Input */}
      <View className="border-b border-gray-100 px-4 pb-3 pt-2">
        <View className="flex-row items-center rounded-2xl bg-gray-100 px-4 py-3">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            className="ml-3 flex-1 text-base text-gray-900"
            placeholder="Search restaurants, cuisines..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={handleSearch}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {!hasSearched || query.length === 0 ? (
        // Recent Searches
        <View className="px-4 pt-4">
          <Text className="mb-3 text-lg font-bold text-gray-900">
            Recent Searches
          </Text>
          {RECENT_SEARCHES.map((term, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleRecentSearch(term)}
              className="flex-row items-center border-b border-gray-50 py-3"
            >
              <Ionicons name="time-outline" size={20} color="#9ca3af" />
              <Text className="ml-3 flex-1 text-base text-gray-700">
                {term}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          ))}

          <View className="mt-6">
            <Text className="mb-3 text-lg font-bold text-gray-900">
              Popular Categories
            </Text>
            <View className="flex-row flex-wrap">
              {['🍕 Pizza', '🍔 Burgers', '🍣 Sushi', '🥗 Healthy', '🌮 Mexican', '🍰 Desserts'].map(
                (cat, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleRecentSearch(cat.split(' ')[1])}
                    className="mb-2 mr-2 rounded-full bg-gray-100 px-4 py-2.5"
                  >
                    <Text className="text-sm font-medium text-gray-700">
                      {cat}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
        </View>
      ) : (
        // Search Results Grid
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerClassName="p-4"
          columnWrapperClassName="gap-3"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/restaurant/${item.id}`)}
              className="mb-3 flex-1"
              activeOpacity={0.9}
            >
              <View className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/10">
                <Image
                  source={{ uri: item.imageUrl }}
                  className="h-32 w-full"
                  resizeMode="cover"
                />
                <View className="p-2.5">
                  <Text
                    className="text-sm font-bold text-gray-900"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-500">
                    {item.cuisine}
                  </Text>
                  <View className="mt-1.5 flex-row items-center">
                    <Ionicons name="star" size={12} color="#16a34a" />
                    <Text className="ml-0.5 text-xs font-semibold text-green-700">
                      {item.rating}
                    </Text>
                    <Text className="ml-2 text-xs text-gray-500">
                      {item.deliveryTime} min
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="search-outline" size={48} color="#d1d5db" />
              <Text className="mt-3 text-base font-medium text-gray-400">
                No results for "{query}"
              </Text>
              <Text className="mt-1 text-sm text-gray-300">
                Try a different search term
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
