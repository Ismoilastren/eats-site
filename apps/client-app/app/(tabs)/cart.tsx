import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';

function CartImage({ uri }: { uri?: string }) {
  if (!uri) {
    return (
      <View className="h-20 w-20 items-center justify-center rounded-3xl bg-orange-50">
        <Ionicons name="fast-food-outline" size={28} color="#f97316" />
      </View>
    );
  }

  return <Image source={{ uri }} className="h-20 w-20 rounded-3xl bg-gray-100" resizeMode="cover" />;
}

export default function CartScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const items = useCartStore((state) => state.items);
  const restaurant = useCartStore((state) => state.restaurant);
  const deliveryFee = useCartStore((state) => state.deliveryFee);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useCartStore.persist;
    setHydrated(persistApi.hasHydrated());
    const unsubscribe = persistApi.onFinishHydration(() => setHydrated(true));
    const fallback = setTimeout(() => setHydrated(true), 1200);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const total = useMemo(() => subtotal + Number(deliveryFee || 0), [deliveryFee, subtotal]);
  const isReady = hydrated && !initializing;
  const isAuthenticated = !!user;
  const hasItems = items.length > 0;

  const handleClearCart = () => {
    Alert.alert('Clear cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pb-5 pt-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-black uppercase tracking-widest text-orange-500">Basket</Text>
            <Text className="mt-1 text-4xl font-black text-gray-950">Your Cart</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            className="h-12 w-12 items-center justify-center rounded-full bg-gray-100"
          >
            <Ionicons name="storefront-outline" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {!isReady ? (
        <View className="flex-1 px-5 pt-5">
          <View className="rounded-[28px] bg-white p-5 shadow-sm shadow-black/5">
            <View className="h-5 w-32 rounded-full bg-orange-100" />
            <View className="mt-5 h-20 rounded-3xl bg-gray-100" />
            <View className="mt-4 h-20 rounded-3xl bg-gray-100" />
            <Text className="mt-5 text-center font-bold text-gray-400">Loading cart...</Text>
          </View>
        </View>
      ) : !isAuthenticated ? (
        <View className="flex-1 items-center justify-center px-6 pb-24">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-orange-50">
            <Ionicons name="person-circle-outline" size={58} color="#f97316" />
          </View>
          <Text className="mt-6 text-2xl font-black text-gray-950">Login required</Text>
          <Text className="mt-2 text-center text-base font-semibold text-gray-500">
            Sign in to keep your cart and place orders.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/login')} className="mt-7 rounded-2xl bg-orange-500 px-10 py-4">
            <Text className="font-black text-white">Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : !hasItems ? (
        <View className="flex-1 items-center justify-center px-6 pb-24">
          <View className="h-28 w-28 items-center justify-center rounded-full bg-orange-50">
            <Ionicons name="cart-outline" size={62} color="#f97316" />
          </View>
          <Text className="mt-6 text-2xl font-black text-gray-950">Your cart is empty</Text>
          <Text className="mt-2 text-center text-base font-semibold text-gray-500">
            Add meals from a restaurant and they will appear here.
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} className="mt-7 rounded-2xl bg-gray-950 px-10 py-4">
            <Text className="font-black text-white">Browse restaurants</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 190 }}>
            <View className="rounded-[28px] bg-gray-950 p-5">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-black uppercase tracking-widest text-orange-400">Order from</Text>
                  <Text className="mt-2 text-2xl font-black text-white" numberOfLines={1}>
                    {restaurant?.name || items[0]?.restaurantName || 'Restaurant'}
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-gray-400">
                    {itemCount} items • {formatCurrencyUZS(total)}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClearCart} className="h-11 w-11 items-center justify-center rounded-full bg-white/10">
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="mt-4 rounded-[28px] bg-white p-2 shadow-sm shadow-black/5">
              {items.map((item) => (
                <View key={item.id} className="flex-row items-center border-b border-gray-100 p-3 last:border-b-0">
                  <CartImage uri={item.imageUrl} />
                  <View className="ml-4 flex-1">
                    <Text className="text-base font-black text-gray-950" numberOfLines={2}>
                      {item.name || 'Item'}
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-gray-500">
                      {formatCurrencyUZS(Number(item.price || 0))}
                    </Text>
                    <TouchableOpacity onPress={() => removeItem(item.id)} className="mt-2 flex-row items-center">
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                      <Text className="ml-1 text-xs font-black text-red-500">Remove</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="items-center rounded-full bg-gray-100 p-1">
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-orange-500"
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                    <Text className="py-2 text-base font-black text-gray-950">{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-white"
                    >
                      <Ionicons name="remove" size={18} color="#111827" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <View className="mt-4 rounded-[28px] bg-white p-5 shadow-sm shadow-black/5">
              <Text className="mb-4 text-lg font-black text-gray-950">Order summary</Text>
              <View className="mb-3 flex-row justify-between">
                <Text className="font-bold text-gray-500">Subtotal</Text>
                <Text className="font-black text-gray-950">{formatCurrencyUZS(subtotal)}</Text>
              </View>
              <View className="mb-3 flex-row justify-between">
                <Text className="font-bold text-gray-500">Delivery</Text>
                <Text className="font-black text-gray-950">{formatCurrencyUZS(deliveryFee || 0)}</Text>
              </View>
              <View className="mt-3 flex-row justify-between border-t border-gray-100 pt-4">
                <Text className="text-xl font-black text-gray-950">Total</Text>
                <Text className="text-xl font-black text-gray-950">{formatCurrencyUZS(total)}</Text>
              </View>
            </View>
          </ScrollView>

          <View className="absolute bottom-0 left-0 right-0 bg-white px-5 pb-8 pt-4 shadow-lg shadow-black/10">
            <TouchableOpacity onPress={() => router.push('/checkout' as any)} className="rounded-3xl bg-orange-500 py-5">
              <Text className="text-center text-lg font-black text-white">Go to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
