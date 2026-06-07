import React from 'react';
import { Image, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useCartStore } from '../../stores/cartStore';

export default function CartScreen() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const restaurant = useCartStore((state) => state.restaurant);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="cart-outline" size={64} color="#d1d5db" />
          <Text className="mt-6 text-xl font-black text-gray-950">Your cart is empty</Text>
          <Text className="mt-2 text-center text-gray-500">Add meals from one restaurant to start checkout.</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} className="mt-6 rounded-full bg-orange-500 px-8 py-4">
            <Text className="font-black text-white">Browse restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 132 }}>
        <Text className="text-3xl font-black text-gray-950">Cart</Text>
        <Text className="mt-1 text-base font-semibold text-gray-500">{restaurant?.name}</Text>

        <View className="mt-5 rounded-3xl bg-white p-2 shadow-sm shadow-black/5">
          {items.map((item) => (
            <View key={item.id} className="flex-row items-center border-b border-gray-100 p-3 last:border-b-0">
              <Image
                source={{
                  uri: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop',
                }}
                className="h-16 w-16 rounded-2xl bg-gray-100"
              />
              <View className="ml-3 flex-1">
                <Text className="font-black text-gray-950" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="mt-1 text-sm font-bold text-gray-500">{formatCurrencyUZS(item.price)}</Text>
              </View>
              <View className="flex-row items-center rounded-full bg-gray-100 p-1">
                <TouchableOpacity
                  onPress={() => updateQuantity(item.id, item.quantity - 1)}
                  className="h-8 w-8 items-center justify-center rounded-full bg-white"
                >
                  <Ionicons name="remove" size={18} color="#111827" />
                </TouchableOpacity>
                <Text className="min-w-8 text-center font-black text-gray-950">{item.quantity}</Text>
                <TouchableOpacity
                  onPress={() => updateQuantity(item.id, item.quantity + 1)}
                  className="h-8 w-8 items-center justify-center rounded-full bg-orange-500"
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white px-4 pb-8 pt-4 shadow-lg shadow-black/10">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-bold text-gray-500">{itemCount} items</Text>
          <Text className="text-xl font-black text-gray-950">{formatCurrencyUZS(subtotal)}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/checkout' as any)} className="rounded-2xl bg-gray-950 py-4">
          <Text className="text-center text-base font-black text-white">Go to Checkout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
