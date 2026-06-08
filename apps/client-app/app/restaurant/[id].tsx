import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  COLLECTIONS,
  MenuItem,
  Restaurant,
  formatCurrencyUZS,
  normalizeCoordinate,
} from '@repo/shared-types';
import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@repo/firebase-config';
import MenuItemCard from '../../components/MenuItemCard';
import { useCartStore } from '../../stores/cartStore';

type ClientRestaurant = Restaurant & {
  image?: string;
  coverImage?: string;
  coverImageUrl?: string;
  category?: string;
};

const text = (value: unknown) => String(value || '').trim();

const getRestaurantImage = (restaurant: ClientRestaurant) =>
  text(restaurant.imageUrl) ||
  text(restaurant.image) ||
  text(restaurant.coverImageUrl) ||
  text(restaurant.coverImage);

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const itemCount = useCartStore((state) => state.getItemCount());
  const subtotal = useCartStore((state) => state.getSubtotal());

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const restaurantSnap = await getDoc(doc(db, COLLECTIONS.RESTAURANTS, id));
        if (!restaurantSnap.exists()) {
          setRestaurant(null);
          setMenuItems([]);
          return;
        }

        const restaurantData = { id: restaurantSnap.id, ...restaurantSnap.data() } as Restaurant;
        const menuSnap = await getDocs(
          query(
            collection(db, COLLECTIONS.MENU_ITEMS),
            where('restaurantId', '==', id),
            where('isAvailable', '==', true)
          )
        );
        const items: MenuItem[] = [];
        menuSnap.forEach((itemDoc) => items.push({ id: itemDoc.id, ...itemDoc.data() } as MenuItem));

        setRestaurant(restaurantData);
        setMenuItems(items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      } catch (error) {
        console.error('Failed to load restaurant:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const sections = useMemo(() => {
    const grouped = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
      const category = item.category?.trim() || 'Menu';
      acc[category] = acc[category] || [];
      acc[category].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [menuItems]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Ionicons name="restaurant-outline" size={56} color="#d1d5db" />
        <Text className="mt-4 text-xl font-black text-gray-950">Restaurant not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-6 rounded-full bg-orange-500 px-6 py-3">
          <Text className="font-black text-white">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const restaurantLocation = normalizeCoordinate(restaurant.location);
  const restaurantImage = getRestaurantImage(restaurant as ClientRestaurant);

  return (
    <View className="flex-1 bg-gray-50">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: itemCount > 0 ? 118 : 24 }}
        ListHeaderComponent={
          <View>
            <View className="relative">
              {restaurantImage ? (
                <Image
                  source={{ uri: restaurantImage }}
                  className="h-72 w-full bg-gray-100"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-72 w-full items-center justify-center bg-gray-100">
                  <Ionicons name="image-outline" size={44} color="#9ca3af" />
                  <Text className="mt-2 text-sm font-bold text-gray-400">No restaurant image</Text>
                </View>
              )}
              <View className="absolute inset-0 bg-black/20" />
              <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0 px-4">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="h-11 w-11 items-center justify-center rounded-full bg-white/95"
                >
                  <Ionicons name="arrow-back" size={22} color="#111827" />
                </TouchableOpacity>
              </SafeAreaView>
            </View>

            <View className="-mt-7 mx-4 rounded-3xl bg-white p-5 shadow-sm shadow-black/10">
              <Text className="text-3xl font-black text-gray-950">{restaurant.name}</Text>
              <Text className="mt-1 text-base font-semibold text-gray-500">{restaurant.cuisine}</Text>
              {!!restaurant.description && (
                <Text className="mt-3 text-sm leading-5 text-gray-500">{restaurant.description}</Text>
              )}

              <View className="mt-5 flex-row items-center">
                <View className="flex-row items-center rounded-full bg-green-50 px-3 py-2">
                  <Ionicons name="star" size={15} color="#16a34a" />
                  <Text className="ml-1 text-sm font-black text-green-700">
                    {(restaurant.rating || 0).toFixed(1)}
                  </Text>
                </View>
                <View className="mx-3 h-5 w-px bg-gray-200" />
                <Ionicons name="time-outline" size={17} color="#6b7280" />
                <Text className="ml-1 text-sm font-bold text-gray-700">
                  {restaurant.avgDeliveryTime || 30} min
                </Text>
                <View className="mx-3 h-5 w-px bg-gray-200" />
                <Ionicons name="bicycle-outline" size={17} color="#6b7280" />
                <Text className="ml-1 text-sm font-bold text-gray-700">
                  {formatCurrencyUZS(restaurant.deliveryFee || 0)}
                </Text>
              </View>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="bg-gray-50 px-4 pb-2 pt-6">
            <Text className="text-xl font-black text-gray-950">{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View className="px-4">
            <MenuItemCard
              id={item.id}
              name={item.name}
              description={item.description}
              price={Number(item.price) || 0}
              imageUrl={item.imageUrl}
              restaurantId={restaurant.id}
              restaurantName={restaurant.name}
              restaurantImage={restaurantImage}
              restaurantLocation={restaurantLocation}
              restaurantDeliveryFee={restaurant.deliveryFee || 0}
              isAvailable={item.isAvailable}
            />
          </View>
        )}
        ListEmptyComponent={
          <View className="mx-4 mt-6 rounded-3xl bg-white p-10 items-center">
            <Ionicons name="fast-food-outline" size={44} color="#d1d5db" />
            <Text className="mt-3 font-bold text-gray-500">No menu items yet</Text>
          </View>
        }
      />

      {itemCount > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-white/95 px-4 pb-8 pt-3 shadow-lg shadow-black/10">
          <TouchableOpacity
            onPress={() => router.push('/checkout' as any)}
            className="flex-row items-center justify-between rounded-2xl bg-gray-950 px-5 py-4"
          >
            <Text className="text-base font-black text-white">{itemCount} items</Text>
            <Text className="text-base font-black text-white">{formatCurrencyUZS(subtotal)}</Text>
            <Text className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-black text-white">Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
