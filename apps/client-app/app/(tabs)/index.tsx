import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, db, limit, onSnapshot, query, where } from '@repo/firebase-config';
import {
  COLLECTIONS,
  MenuItem,
  Order,
  PAGE_SIZE,
  Restaurant,
  formatCurrencyUZS,
  isTerminalOrderStatus,
} from '@repo/shared-types';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = ['All', 'Burger', 'Pizza', 'Sushi', 'Healthy', 'Asian', 'Dessert', 'Coffee'];

type ClientRestaurant = Restaurant & {
  image?: string;
  coverImage?: string;
  coverImageUrl?: string;
  category?: string;
  categories?: string[];
};

type ClientMenuItem = MenuItem & {
  restaurantName?: string;
};

const text = (value: unknown) => String(value || '').trim();

const getRestaurantImage = (restaurant: ClientRestaurant) =>
  text(restaurant.imageUrl) ||
  text(restaurant.image) ||
  text(restaurant.coverImageUrl) ||
  text(restaurant.coverImage);

const getRestaurantCategories = (restaurant: ClientRestaurant) => {
  const values = [
    restaurant.category,
    restaurant.cuisine,
    ...(Array.isArray(restaurant.categories) ? restaurant.categories : []),
  ];

  return values.map((value) => text(value).toLowerCase()).filter(Boolean);
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<ClientMenuItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const customerEmail = user?.email || profile?.email || '';

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.RESTAURANTS),
      where('isActive', '==', true),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: ClientRestaurant[] = [];
        snapshot.forEach((restaurantDoc) => {
          data.push({ id: restaurantDoc.id, ...restaurantDoc.data() } as ClientRestaurant);
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

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.MENU_ITEMS), where('isAvailable', '==', true), limit(PAGE_SIZE * 20)),
      (snapshot) => {
        const data: ClientMenuItem[] = [];
        snapshot.forEach((itemDoc) => {
          data.push({ id: itemDoc.id, ...itemDoc.data() } as ClientMenuItem);
        });
        setMenuItems(data);
      },
      (error) => {
        console.error('Client menu items listener failed:', error);
        setMenuItems([]);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!customerEmail) {
      setActiveOrders([]);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.ORDERS), where('customerEmail', '==', customerEmail)),
      (snapshot) => {
        const nextOrders = snapshot.docs
          .map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }) as Order)
          .filter((order) => !isTerminalOrderStatus(order.status));
        setActiveOrders(nextOrders);
      },
      (error) => {
        console.error('Client notification orders listener failed:', error);
        setActiveOrders([]);
      }
    );

    return () => unsubscribe();
  }, [customerEmail]);

  const filteredRestaurants = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedCategory = selectedCategory.trim().toLowerCase();

    return restaurants.filter((restaurant) => {
      const clientRestaurant = restaurant as ClientRestaurant;
      const restaurantMenuItems = menuItems.filter((item) => item.restaurantId === restaurant.id);
      const menuSearchText = restaurantMenuItems
        .map((item) =>
          [item.name, item.description, item.category, item.restaurantName]
            .map((value) => text(value).toLowerCase())
            .join(' ')
        )
        .join(' ');
      const searchableText = [
        clientRestaurant.name,
        clientRestaurant.description,
        clientRestaurant.cuisine,
        clientRestaurant.category,
        ...(Array.isArray(clientRestaurant.categories) ? clientRestaurant.categories : []),
      ]
        .map((value) => text(value).toLowerCase())
        .join(' ')
        .concat(' ', menuSearchText);

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const matchesCategory =
        normalizedCategory === 'all' ||
        getRestaurantCategories(clientRestaurant).some((category) => category.includes(normalizedCategory)) ||
        restaurantMenuItems.some((item) => text(item.category).toLowerCase().includes(normalizedCategory));

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, restaurants, searchQuery, selectedCategory]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pb-4 pt-3">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-black uppercase tracking-widest text-orange-500">2(13)</Text>
            <Text className="text-2xl font-black text-gray-950">Order food</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (activeOrders.length === 0) {
                Alert.alert('Notifications', 'No active order notifications yet.');
                return;
              }
              setShowNotifications((value) => !value);
            }}
            className="relative h-11 w-11 items-center justify-center rounded-full bg-gray-100"
          >
            <Ionicons name="notifications-outline" size={21} color="#111827" />
            {activeOrders.length > 0 && (
              <View className="absolute right-1 top-1 h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1">
                <Text className="text-[10px] font-black text-white">{activeOrders.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center rounded-2xl bg-gray-100 px-4 py-3.5">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search restaurants or dishes"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="ml-2 flex-1 text-base font-semibold text-gray-950"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="h-8 w-8 items-center justify-center">
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {showNotifications && (
          <View className="mt-3 rounded-3xl bg-gray-950 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-black text-white">Active orders</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {activeOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                onPress={() => {
                  setShowNotifications(false);
                  router.push(`/order/${order.id}`);
                }}
                className="mb-2 rounded-2xl bg-white/10 p-3 last:mb-0"
              >
                <Text className="font-black text-white" numberOfLines={1}>
                  {order.restaurantName || 'Restaurant'} order
                </Text>
                <Text className="mt-1 text-sm font-semibold text-gray-300">
                  {order.status} • {formatCurrencyUZS((order as any).totalAmount ?? (order as any).total ?? 0)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
            filteredRestaurants.map((restaurant) => {
              const clientRestaurant = restaurant as ClientRestaurant;
              const imageUri = getRestaurantImage(clientRestaurant);

              return (
                <TouchableOpacity
                  key={restaurant.id}
                  onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                  activeOpacity={0.9}
                  className="mb-5 overflow-hidden rounded-3xl bg-white shadow-sm shadow-black/5"
                >
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      className="h-48 w-full bg-gray-100"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-48 w-full items-center justify-center bg-gray-100">
                      <Ionicons name="image-outline" size={40} color="#9ca3af" />
                      <Text className="mt-2 text-sm font-bold text-gray-400">No restaurant image</Text>
                    </View>
                  )}
                  <View className="p-4">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-xl font-black text-gray-950" numberOfLines={1}>
                          {restaurant.name}
                        </Text>
                        <Text className="mt-1 text-sm font-semibold text-gray-500" numberOfLines={1}>
                          {text(clientRestaurant.category) || restaurant.cuisine || 'Restaurant'}
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
                          {restaurant.deliveryFee ? formatCurrencyUZS(restaurant.deliveryFee) : '10 000 UZS'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
