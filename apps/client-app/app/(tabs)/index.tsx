import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, db, doc, limit, onSnapshot, query, setDoc, where } from '@repo/firebase-config';
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
import { clientUserDocumentPatch } from '../../services/clientUserProfile';

const CATEGORIES = [
  { label: 'All', icon: 'apps-outline' as const },
  { label: 'Burger', icon: 'fast-food-outline' as const },
  { label: 'Pizza', icon: 'pizza-outline' as const },
  { label: 'Sushi', icon: 'fish-outline' as const },
  { label: 'Healthy', icon: 'leaf-outline' as const },
  { label: 'Asian', icon: 'restaurant-outline' as const },
  { label: 'Dessert', icon: 'ice-cream-outline' as const },
  { label: 'Coffee', icon: 'cafe-outline' as const },
];

const QUICK_FILTERS = ['Fastest', 'Free delivery', '4.7+', 'Reset'];

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

type SavedAddress = {
  id: string;
  label?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  source?: string;
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

const getDeliveryFeeLabel = (restaurant: Restaurant) => {
  const fee = restaurant.deliveryFee ?? 10000;
  return fee === 0 ? 'Free' : formatCurrencyUZS(fee);
};

const getDeliveryEta = (restaurant: Restaurant) => restaurant.avgDeliveryTime || 30;

const isFreeDelivery = (restaurant: Restaurant) =>
  Number(restaurant.deliveryFee ?? 0) === 0 || Boolean((restaurant as any).freeDelivery);

const formatReverseAddress = (first: Location.LocationGeocodedAddress | undefined) => {
  const parts = [first?.street, first?.district, first?.city, first?.subregion]
    .map((part) => part?.trim())
    .filter(Boolean);
  return [...new Set(parts)].join(', ');
};

const isReadableAddress = (value: string) => {
  const address = value.trim();
  if (address.length < 6) return false;
  return !/^(selected point|address could not be resolved|map is unavailable|enter readable address|current gps location|order delivery)/i.test(address);
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<ClientMenuItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const customerEmail = user?.email || profile?.email || '';
  const uid = user?.uid || profile?.uid || '';

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
    if (!uid) {
      setSavedAddresses([]);
      setSelectedAddress(null);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.USERS, uid, 'addresses'),
      (snapshot) => {
        const data = snapshot.docs
          .map((addressDoc) => ({ id: addressDoc.id, ...addressDoc.data() }) as SavedAddress)
          .filter((address) => isReadableAddress(address.address || ''));
        setSavedAddresses(data);
        setSelectedAddress((current) => {
          if (current && data.some((address) => address.id === current.id)) return current;
          return data.find((address) => address.isDefault) || data[0] || null;
        });
      },
      (error) => {
        console.error('Client saved addresses listener failed:', error);
        setSavedAddresses([]);
      }
    );

    return () => unsubscribe();
  }, [uid]);

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
    if (!uid && !customerEmail) {
      setActiveOrders([]);
      return;
    }

    const orderBuckets = new Map<number, Map<string, Order>>();
    const orderQueries = [
      ...(uid ? [query(collection(db, COLLECTIONS.ORDERS), where('userId', '==', uid))] : []),
      ...(customerEmail ? [query(collection(db, COLLECTIONS.ORDERS), where('customerEmail', '==', customerEmail))] : []),
    ];

    const publish = () => {
      const merged = new Map<string, Order>();
      orderBuckets.forEach((bucket) => bucket.forEach((order, id) => merged.set(id, order)));
      const nextOrders = Array.from(merged.values())
        .filter((order) => !isTerminalOrderStatus(order.status))
        .sort((a, b) => {
          const aTime = (a.createdAt as any)?.toMillis?.() ?? 0;
          const bTime = (b.createdAt as any)?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
      setActiveOrders(nextOrders);
    };

    const unsubscribes = orderQueries.map((ordersQuery, index) =>
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const bucket = new Map<string, Order>();
          snapshot.docs.forEach((orderDoc) => bucket.set(orderDoc.id, { id: orderDoc.id, ...orderDoc.data() } as Order));
          orderBuckets.set(index, bucket);
          publish();
        },
        (error) => {
          console.error('Client notification orders listener failed:', error);
        }
      )
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [customerEmail, uid]);

  const toggleFilter = (filter: string) => {
    if (filter === 'Reset') {
      setActiveFilters([]);
      setSelectedCategory('All');
      setSearchQuery('');
      return;
    }
    setActiveFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    );
  };

  const saveCurrentLocation = async () => {
    if (!uid) {
      router.replace('/login');
      return;
    }

    setSavingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Allow location access or add your address manually.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [reverse] = await Location.reverseGeocodeAsync(current.coords);
      const addressText = formatReverseAddress(reverse);
      if (!isReadableAddress(addressText)) {
        Alert.alert('Address unavailable', 'GPS was found, but no readable street address was returned.');
        return;
      }

      const isDefault = savedAddresses.length === 0;
      const payload = {
        userId: uid,
        customerId: uid,
        label: isDefault ? 'Home' : 'Current location',
        address: addressText,
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        source: 'current_location',
        isDefault,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const addressRef = await addDoc(collection(db, COLLECTIONS.USERS, uid, 'addresses'), payload);
      const nextAddress = { id: addressRef.id, ...payload };
      await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        ...clientUserDocumentPatch(user, profile),
        savedAddresses: [...savedAddresses.map(({ id, ...address }) => ({ id, ...address })), nextAddress],
        ...(isDefault ? { defaultAddress: addressText, address: addressText } : {}),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setSelectedAddress(nextAddress);
      setShowAddressModal(false);
    } catch (error: any) {
      console.error('Failed to save current location:', error);
      Alert.alert('Location error', error?.message || 'Could not save current location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const chooseAddress = async (address: SavedAddress) => {
    setSelectedAddress(address);
    setShowAddressModal(false);
    if (!uid) return;

    try {
      await Promise.all(
        savedAddresses.map((savedAddress) =>
          setDoc(
            doc(db, COLLECTIONS.USERS, uid, 'addresses', savedAddress.id),
            { isDefault: savedAddress.id === address.id, updatedAt: new Date().toISOString() },
            { merge: true }
          )
        )
      );
      await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        ...clientUserDocumentPatch(user, profile),
        savedAddresses: savedAddresses.map((savedAddress) => ({
          ...savedAddress,
          isDefault: savedAddress.id === address.id,
        })),
        defaultAddress: address.address,
        address: address.address,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Failed to update default address:', error);
    }
  };

  const filteredRestaurants = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedCategory = selectedCategory.trim().toLowerCase();

    const filtered = restaurants.filter((restaurant) => {
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
      const matchesFreeDelivery = !activeFilters.includes('Free delivery') || isFreeDelivery(restaurant);
      const matchesRating = !activeFilters.includes('4.7+') || Number(restaurant.rating || 0) >= 4.7;

      return matchesSearch && matchesCategory && matchesFreeDelivery && matchesRating;
    });

    if (activeFilters.includes('Fastest')) {
      return [...filtered].sort((a, b) => getDeliveryEta(a) - getDeliveryEta(b));
    }

    return filtered;
  }, [activeFilters, menuItems, restaurants, searchQuery, selectedCategory]);

  return (
    <SafeAreaView className="flex-1 bg-[#f7f6f2]">
      <View className="bg-[#f9d923] px-4 pb-4 pt-3">
        <View className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowAddressModal(true)}
            className="flex-1 flex-row items-center pr-3"
          >
            <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-black">
              <Ionicons name="location" size={20} color="#f9d923" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black uppercase text-black/55">Deliver to</Text>
              <Text className="text-xl font-black text-black" numberOfLines={1}>
                {selectedAddress?.address || profile?.address || 'Choose address'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (activeOrders.length === 0) {
                Alert.alert('Notifications', 'No active order notifications yet.');
                return;
              }
              setShowNotifications((value) => !value);
            }}
            className="relative h-11 w-11 items-center justify-center rounded-full bg-black"
          >
            <Ionicons name="notifications-outline" size={21} color="#fff" />
            {activeOrders.length > 0 && (
              <View className="absolute right-0 top-0 h-5 min-w-5 items-center justify-center rounded-full bg-white px-1">
                <Text className="text-[10px] font-black text-black">{activeOrders.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center rounded-2xl bg-white px-4 py-3.5 shadow-sm shadow-black/10">
          <Ionicons name="search" size={20} color="#111827" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Restaurant, dish or cuisine"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="ml-2 flex-1 text-base font-bold text-gray-950"
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
        {activeOrders.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/order/${activeOrders[0].id}`)}
            className="mx-4 mt-4 flex-row items-center rounded-3xl bg-gray-950 p-4"
          >
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-[#f9d923]">
              <Ionicons name="bicycle" size={22} color="#111827" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black uppercase text-white/50">Active delivery</Text>
              <Text className="mt-0.5 text-base font-black text-white" numberOfLines={1}>
                {activeOrders[0].restaurantName || 'Restaurant'} order
              </Text>
              <Text className="mt-0.5 text-sm font-bold text-white/65">{activeOrders[0].status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        )}

        <View className="mx-4 mt-4 rounded-3xl bg-white p-4 shadow-sm shadow-black/5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-black uppercase text-gray-400">Lunch picks</Text>
              <Text className="mt-1 text-2xl font-black text-gray-950">Fast food around you</Text>
              <Text className="mt-2 text-sm font-bold text-gray-500">Top restaurants, live status, quick checkout.</Text>
            </View>
            <View className="h-24 w-24 items-center justify-center rounded-3xl bg-[#f9d923]">
              <Ionicons name="fast-food" size={42} color="#111827" />
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 10 }}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.label}
              onPress={() => setSelectedCategory(category.label)}
              className={`h-20 w-[84px] items-center justify-center rounded-2xl ${
                selectedCategory === category.label ? 'bg-gray-950' : 'border border-gray-100 bg-white'
              }`}
            >
              <Ionicons
                name={category.icon}
                size={22}
                color={selectedCategory === category.label ? '#f9d923' : '#111827'}
              />
              <Text
                className={`mt-2 text-xs font-black ${
                  selectedCategory === category.label ? 'text-white' : 'text-gray-800'
                }`}
                numberOfLines={1}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18, gap: 8 }}
        >
          {QUICK_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => toggleFilter(filter)}
              activeOpacity={0.85}
              className={`flex-row items-center rounded-full border px-4 py-2.5 ${
                filter === 'Reset'
                  ? 'border-gray-300 bg-gray-950'
                  : activeFilters.includes(filter)
                    ? 'border-gray-950 bg-gray-950'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <Ionicons
                name={filter === 'Reset' ? 'refresh-outline' : 'options-outline'}
                size={15}
                color={filter === 'Reset' || activeFilters.includes(filter) ? '#fff' : '#374151'}
              />
              <Text
                className={`ml-1.5 text-sm font-black ${
                  filter === 'Reset' || activeFilters.includes(filter) ? 'text-white' : 'text-gray-800'
                }`}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="px-4 pb-28">
          <View className="mb-4 flex-row items-end justify-between">
            <View>
              <Text className="text-xs font-black uppercase text-gray-400">Open now</Text>
              <Text className="text-2xl font-black text-gray-950">
                {selectedCategory === 'All' ? 'Restaurants near you' : selectedCategory}
              </Text>
            </View>
            <Text className="text-sm font-black text-gray-400">{filteredRestaurants.length} places</Text>
          </View>

          {isLoading ? (
            <View className="items-center py-20">
              <ActivityIndicator size="large" color="#111827" />
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
                  <View className="absolute left-3 top-3 z-10 rounded-full bg-[#f9d923] px-3 py-1.5">
                    <Text className="text-xs font-black text-gray-950">{getDeliveryEta(restaurant)} min</Text>
                  </View>
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      className="h-44 w-full bg-gray-100"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-44 w-full items-center justify-center bg-gray-100">
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
                      <View className="flex-row items-center rounded-full bg-gray-100 px-3 py-1.5">
                        <Ionicons name="star" size={14} color="#111827" />
                        <Text className="ml-1 text-sm font-black text-gray-950">
                          {(restaurant.rating || 0).toFixed(1)}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-4 flex-row items-center">
                      <View className="mr-2 flex-row items-center rounded-full bg-gray-100 px-3 py-2">
                        <Ionicons name="time-outline" size={16} color="#4b5563" />
                        <Text className="ml-1 text-sm font-black text-gray-700">
                          {getDeliveryEta(restaurant)} min
                        </Text>
                      </View>
                      <View className="flex-row items-center rounded-full bg-[#fff5bf] px-3 py-2">
                        <Ionicons name="bicycle-outline" size={16} color="#111827" />
                        <Text className="ml-1 text-sm font-black text-gray-950">
                          {getDeliveryFeeLabel(restaurant)}
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
      <Modal
        visible={showAddressModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[32px] bg-white p-5 pb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-black uppercase text-gray-400">Delivery address</Text>
                <Text className="mt-1 text-2xl font-black text-gray-950">Choose location</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddressModal(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {savedAddresses.length === 0 ? (
              <View className="rounded-3xl bg-gray-50 p-5">
                <Text className="font-black text-gray-950">No saved addresses</Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">
                  Add a delivery address or use your current location.
                </Text>
              </View>
            ) : (
              <View className="max-h-72">
                {savedAddresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    onPress={() => chooseAddress(address)}
                    activeOpacity={0.85}
                    className={`mb-3 flex-row items-start rounded-3xl border p-4 ${
                      selectedAddress?.id === address.id ? 'border-gray-950 bg-gray-950' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <Ionicons
                      name={selectedAddress?.id === address.id ? 'radio-button-on' : 'location-outline'}
                      size={22}
                      color={selectedAddress?.id === address.id ? '#f9d923' : '#374151'}
                    />
                    <View className="ml-3 flex-1">
                      <Text
                        className={`font-black ${selectedAddress?.id === address.id ? 'text-white' : 'text-gray-950'}`}
                        numberOfLines={1}
                      >
                        {address.label || 'Saved address'}{address.isDefault ? ' • Default' : ''}
                      </Text>
                      <Text
                        className={`mt-1 text-sm font-semibold ${
                          selectedAddress?.id === address.id ? 'text-white/65' : 'text-gray-500'
                        }`}
                        numberOfLines={2}
                      >
                        {address.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={saveCurrentLocation}
                disabled={savingLocation}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center rounded-2xl bg-[#f9d923] py-4"
              >
                {savingLocation ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <>
                    <Ionicons name="navigate" size={18} color="#111827" />
                    <Text className="ml-2 font-black text-gray-950">Use GPS</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowAddressModal(false);
                  router.push('/addresses' as any);
                }}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center rounded-2xl bg-gray-950 py-4"
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="ml-2 font-black text-white">Add address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
