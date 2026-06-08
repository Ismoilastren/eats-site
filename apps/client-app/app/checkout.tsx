import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  addDoc,
  auth,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
} from '@repo/firebase-config';
import {
  COLLECTIONS,
  formatCurrencyUZS,
  normalizeCoordinate,
} from '@repo/shared-types';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';

const TASHKENT = { latitude: 41.311081, longitude: 69.240562 };

const feeFromSettings = (data: any): number | null => {
  const value = data?.baseDeliveryFee ?? data?.deliveryFee ?? data?.defaultDeliveryFee;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

type SavedAddress = {
  id: string;
  label?: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  holderName?: string;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const items = useCartStore((state) => state.items);
  const restaurant = useCartStore((state) => state.restaurant);
  const clearCart = useCartStore((state) => state.clearCart);
  const setStoreDeliveryFee = useCartStore((state) => state.setDeliveryFee);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [addressText, setAddressText] = useState('Current location');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'card'>('cash');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [placing, setPlacing] = useState(false);

  const total = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee]);

  const fetchCurrentDeliveryFee = async () => {
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    const settingsFee = settingsSnap.exists() ? feeFromSettings(settingsSnap.data()) : null;
    if (settingsFee !== null) return settingsFee;

    const systemSnap = await getDoc(doc(db, 'system_settings', 'global'));
    const systemFee = systemSnap.exists() ? feeFromSettings(systemSnap.data()) : null;
    if (systemFee !== null) return systemFee;

    return Number(restaurant?.deliveryFee || 0);
  };

  const loadLocation = async () => {
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Enable location access to place a delivery order.');
        setLocation(null);
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(current);

      const reverse = await Location.reverseGeocodeAsync(current.coords);
      const first = reverse[0];
      if (first) {
        const parts = [first.street, first.name, first.district, first.city].filter(Boolean);
        setAddressText(parts.length ? parts.join(', ') : `${current.coords.latitude}, ${current.coords.longitude}`);
      } else {
        setAddressText(`${current.coords.latitude}, ${current.coords.longitude}`);
      }
    } catch (error) {
      console.error('Failed to load customer location:', error);
      Alert.alert('Location error', 'Could not read GPS location.');
    } finally {
      setLoadingLocation(false);
    }
  };

  useEffect(() => {
    loadLocation();
  }, []);

  useEffect(() => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    let cancelled = false;
    const loadCheckoutData = async () => {
      try {
        const [addressSnap, paymentSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.USERS, firebaseUser.uid, 'addresses'))),
          getDocs(query(collection(db, COLLECTIONS.USERS, firebaseUser.uid, 'paymentMethods'))),
        ]);

        if (cancelled) return;

        const nextAddresses: SavedAddress[] = [];
        addressSnap.forEach((addressDoc) => {
          nextAddresses.push({ id: addressDoc.id, ...addressDoc.data() } as SavedAddress);
        });
        setSavedAddresses(nextAddresses);
        if (nextAddresses[0]?.address) {
          setAddressText(nextAddresses[0].address);
          if (nextAddresses[0].latitude && nextAddresses[0].longitude) {
            setLocation({
              coords: {
                latitude: nextAddresses[0].latitude,
                longitude: nextAddresses[0].longitude,
                altitude: null,
                accuracy: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            });
          }
        }

        const nextPaymentMethods: PaymentMethod[] = [];
        paymentSnap.forEach((paymentDoc) => {
          nextPaymentMethods.push({ id: paymentDoc.id, ...paymentDoc.data() } as PaymentMethod);
        });
        setPaymentMethods(nextPaymentMethods);
        if (nextPaymentMethods[0]) {
          setPaymentType('card');
          setSelectedCardId(nextPaymentMethods[0].id);
        }
      } catch (error) {
        console.error('Failed to load checkout saved data:', error);
      }
    };

    loadCheckoutData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFee = async () => {
      try {
        const fee = await fetchCurrentDeliveryFee();
        if (!cancelled) {
          setDeliveryFee(fee);
          setStoreDeliveryFee(fee);
        }
      } catch (error) {
        console.error('Failed to fetch delivery fee:', error);
      }
    };

    loadFee();
    return () => {
      cancelled = true;
    };
  }, [restaurant?.id]);

  const handlePlaceOrder = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      Alert.alert('Login required', 'Please log in with Firebase auth before placing an order.');
      return;
    }
    if (!restaurant || items.length === 0) {
      Alert.alert('Cart empty', 'Add items from a restaurant first.');
      return;
    }
    if (!location) {
      Alert.alert('Location required', 'GPS location is required for courier tracking.');
      return;
    }
    if (paymentType === 'card' && !selectedCardId) {
      Alert.alert('Payment required', 'Select a saved card or use cash.');
      return;
    }

    setPlacing(true);
    try {
      const selectedCard = paymentMethods.find((paymentMethod) => paymentMethod.id === selectedCardId);
      const latestFee = await fetchCurrentDeliveryFee();
      const customerLatitude = location.coords.latitude;
      const customerLongitude = location.coords.longitude;
      const restaurantLocation = normalizeCoordinate(restaurant.location) || TASHKENT;
      const customerName =
        user?.displayName ||
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Customer';
      const customerPhone = user?.phone || firebaseUser.phoneNumber || '';
      const calculatedSubtotal = subtotal;
      const calculatedTotal = calculatedSubtotal + latestFee;

      const orderRef = await addDoc(collection(db, COLLECTIONS.ORDERS), {
        userId: firebaseUser.uid,
        customerName,
        customerEmail: firebaseUser.email || user?.email || '',
        customerPhone,
        customerAddress: addressText,
        customerLocation: { lat: customerLatitude, lng: customerLongitude },
        deliveryAddress: addressText,
        deliveryLocation: { latitude: customerLatitude, longitude: customerLongitude },
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantImage: restaurant.imageUrl || '',
        restaurantLocation,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price) || 0,
          quantity: item.quantity,
          imageUrl: item.imageUrl || '',
        })),
        subtotal: calculatedSubtotal,
        deliveryFee: latestFee,
        total: calculatedTotal,
        totalAmount: calculatedTotal,
        status: 'pending',
        courierId: null,
        assignedCourier: null,
        courierLocation: null,
        customer: {
          name: customerName,
          phone: customerPhone,
          email: firebaseUser.email || user?.email || '',
        },
        paymentMethod: paymentType === 'card'
          ? {
              type: 'CARD',
              brand: selectedCard?.brand || 'Card',
              last4: selectedCard?.last4 || '0000',
            }
          : {
              type: 'CASH',
            },
        deliveryInstructions,
        estimatedDelivery: null,
        deliveredAt: null,
        cancelledAt: null,
        cancelReason: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      clearCart();
      router.replace(`/order/${orderRef.id}`);
    } catch (error: any) {
      console.error('Failed to place native client order:', error);
      Alert.alert('Order failed', error?.message || 'Could not place order.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text className="text-3xl font-black text-gray-950">Checkout</Text>
        <Text className="mt-1 text-base font-semibold text-gray-500">{restaurant?.name || 'Restaurant'}</Text>

        <View className="mt-5 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-50">
                <Ionicons name="location" size={21} color="#f97316" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-black text-gray-950">Delivery address</Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500" numberOfLines={2}>
                  {loadingLocation ? 'Reading GPS...' : addressText}
                </Text>
              </View>
            </View>
            {loadingLocation && <ActivityIndicator color="#f97316" />}
          </View>

          <TextInput
            value={addressText}
            onChangeText={setAddressText}
            multiline
            className="mt-4 rounded-2xl bg-gray-100 px-4 py-3 text-base font-semibold text-gray-900"
            placeholder="Apartment, entrance, floor"
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity onPress={loadLocation} className="mt-4 flex-row items-center justify-center rounded-2xl bg-gray-950 py-3">
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text className="ml-2 font-black text-white">Refresh GPS</Text>
          </TouchableOpacity>

          {savedAddresses.length > 0 && (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-black uppercase tracking-widest text-gray-400">Saved addresses</Text>
              {savedAddresses.map((savedAddress) => (
                <TouchableOpacity
                  key={savedAddress.id}
                  onPress={() => {
                    setAddressText(savedAddress.address);
                    if (savedAddress.latitude && savedAddress.longitude) {
                      setLocation({
                        coords: {
                          latitude: savedAddress.latitude,
                          longitude: savedAddress.longitude,
                          altitude: null,
                          accuracy: null,
                          altitudeAccuracy: null,
                          heading: null,
                          speed: null,
                        },
                        timestamp: Date.now(),
                      });
                    }
                  }}
                  className={`mb-2 rounded-2xl border p-3 ${
                    addressText === savedAddress.address ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <Text className="font-black text-gray-950">{savedAddress.label || 'Saved Location'}</Text>
                  <Text className="mt-1 text-sm font-semibold text-gray-500">{savedAddress.address}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
          <Text className="mb-4 text-lg font-black text-gray-950">Payment method</Text>
          <TouchableOpacity
            onPress={() => setPaymentType('cash')}
            className={`mb-3 flex-row items-center rounded-2xl border p-4 ${
              paymentType === 'cash' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <Ionicons name={paymentType === 'cash' ? 'radio-button-on' : 'radio-button-off'} size={21} color="#f97316" />
            <Text className="ml-3 font-black text-gray-950">Cash on Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPaymentType('card')}
            className={`flex-row items-center rounded-2xl border p-4 ${
              paymentType === 'card' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <Ionicons name={paymentType === 'card' ? 'radio-button-on' : 'radio-button-off'} size={21} color="#f97316" />
            <Text className="ml-3 font-black text-gray-950">Saved Card</Text>
          </TouchableOpacity>

          {paymentType === 'card' && (
            <View className="mt-3">
              {paymentMethods.length === 0 ? (
                <TouchableOpacity onPress={() => router.push('/payment-cards' as any)} className="rounded-2xl bg-gray-950 p-4">
                  <Text className="text-center font-black text-white">Add card in Profile</Text>
                </TouchableOpacity>
              ) : (
                paymentMethods.map((paymentMethod) => (
                  <TouchableOpacity
                    key={paymentMethod.id}
                    onPress={() => setSelectedCardId(paymentMethod.id)}
                    className={`mb-2 rounded-2xl border p-3 ${
                      selectedCardId === paymentMethod.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <Text className="font-black text-gray-950">
                      {paymentMethod.brand} •••• {paymentMethod.last4}
                    </Text>
                    {!!paymentMethod.holderName && (
                      <Text className="mt-1 text-sm font-semibold text-gray-500">{paymentMethod.holderName}</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
          <Text className="mb-3 text-lg font-black text-gray-950">Delivery instructions</Text>
          <TextInput
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            multiline
            className="min-h-24 rounded-2xl bg-gray-100 px-4 py-3 text-base font-semibold text-gray-900"
            placeholder="Ring doorbell, leave at door..."
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View className="mt-4 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
          <Text className="mb-4 text-lg font-black text-gray-950">Order summary</Text>
          {items.map((item) => (
            <View key={item.id} className="mb-3 flex-row justify-between">
              <Text className="flex-1 text-sm font-bold text-gray-600">
                {item.quantity}x {item.name}
              </Text>
              <Text className="text-sm font-black text-gray-950">{formatCurrencyUZS(item.price * item.quantity)}</Text>
            </View>
          ))}
          <View className="mt-3 border-t border-gray-100 pt-3">
            <View className="mb-2 flex-row justify-between">
              <Text className="font-semibold text-gray-500">Subtotal</Text>
              <Text className="font-black text-gray-950">{formatCurrencyUZS(subtotal)}</Text>
            </View>
            <View className="mb-2 flex-row justify-between">
              <Text className="font-semibold text-gray-500">Delivery</Text>
              <Text className="font-black text-gray-950">{formatCurrencyUZS(deliveryFee)}</Text>
            </View>
            <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-3">
              <Text className="text-lg font-black text-gray-950">Total</Text>
              <Text className="text-lg font-black text-gray-950">{formatCurrencyUZS(total)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white px-4 pb-8 pt-4 shadow-lg shadow-black/10">
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={placing || loadingLocation}
          className={`rounded-2xl py-4 ${placing || loadingLocation ? 'bg-gray-300' : 'bg-orange-500'}`}
        >
          {placing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-base font-black text-white">Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
