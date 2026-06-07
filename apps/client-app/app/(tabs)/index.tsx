import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, db, limit, onSnapshot, query, where } from '@repo/firebase-config';
import { COLLECTIONS, PAGE_SIZE, Restaurant, formatCurrencyUZS } from '@repo/shared-types';

const CATEGORIES = ['All', 'Burger', 'Pizza', 'Sushi', 'Healthy', 'Asian', 'Dessert', 'Coffee'];

export default function HomeScreen() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.RESTAURANTS),
      where('isActive', '==', true),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Restaurant[] = [];
        snapshot.forEach((restaurantDoc) => {
          data.push({ id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant);
        });
        setRestaurants(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('Client restaurants listener failed:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredRestaurants = useMemo(() => {
    if (selectedCategory === 'All') return restaurants;
    const category = selectedCategory.toLowerCase();
    return restaurants.filter((restaurant) =>
      [restaurant.cuisine, (restaurant as any).category, ...(Array.isArray((restaurant as any).categories) ? (restaurant as any).categories : [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(category))
    );
  }, [restaurants, selectedCategory]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pb-4 pt-3">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-black uppercase tracking-widest text-orange-500">2(13)</Text>
            <Text className="text-2xl font-black text-gray-950">Order food</Text>
          </View>
          <TouchableOpacity className="h-11 w-11 items-center justify-center rounded-full bg-gray-100">
            <Ionicons name="notifications-outline" size={21} color="#111827" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="flex-row items-center rounded-2xl bg-gray-100 px-4 py-3.5">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <Text className="ml-2 flex-1 text-base font-semibold text-gray-400">Search restaurants or dishes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-gray-50"
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 8 }}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              className={`rounded-full px-5 py-3 ${
                selectedCategory === category ? 'bg-gray-950' : 'bg-white border border-gray-200'
              }`}
            >
              <Text className={`text-sm font-black ${selectedCategory === category ? 'text-white' : 'text-gray-800'}`}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="px-4 pb-28">
          <Text className="mb-4 text-2xl font-black text-gray-950">
            {selectedCategory === 'All' ? 'Restaurants near you' : selectedCategory}
          </Text>

          {isLoading ? (
            <View className="items-center py-20">
              <ActivityIndicator size="large" color="#f97316" />
              <Text className="mt-4 font-bold text-gray-400">Loading restaurants...</Text>
            </View>
          ) : filteredRestaurants.length === 0 ? (
            <View className="items-center rounded-3xl bg-white p-10">
              <Ionicons name="restaurant-outline" size={48} color="#d1d5db" />
              <Text className="mt-4 text-center font-bold text-gray-500">No restaurants found</Text>
            </View>
          ) : (
            filteredRestaurants.map((restaurant) => (
              <TouchableOpacity
                key={restaurant.id}
                onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                activeOpacity={0.9}
                className="mb-5 overflow-hidden rounded-3xl bg-white shadow-sm shadow-black/5"
              >
                <Image
                  source={{
                    uri:
                      restaurant.imageUrl ||
                      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop',
                  }}
                  className="h-48 w-full bg-gray-100"
                  resizeMode="cover"
                />
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-xl font-black text-gray-950" numberOfLines={1}>
                        {restaurant.name}
                      </Text>
                      <Text className="mt-1 text-sm font-semibold text-gray-500" numberOfLines={1}>
                        {restaurant.cuisine}
                      </Text>
                    </View>
                    <View className="flex-row items-center rounded-full bg-green-50 px-3 py-1.5">
                      <Ionicons name="star" size={14} color="#16a34a" />
                      <Text className="ml-1 text-sm font-black text-green-700">
                        {(restaurant.rating || 0).toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-4 flex-row items-center">
                    <View className="mr-2 flex-row items-center rounded-full bg-gray-100 px-3 py-2">
                      <Ionicons name="time-outline" size={16} color="#4b5563" />
                      <Text className="ml-1 text-sm font-black text-gray-700">
                        {restaurant.avgDeliveryTime || 30} min
                      </Text>
                    </View>
                    <View className="flex-row items-center rounded-full bg-orange-50 px-3 py-2">
                      <Ionicons name="bicycle-outline" size={16} color="#f97316" />
                      <Text className="ml-1 text-sm font-black text-orange-600">
                        {formatCurrencyUZS(restaurant.deliveryFee || 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
