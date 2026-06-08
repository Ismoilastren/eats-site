import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useCartStore, type CartItem } from '../../stores/cartStore';

function EmptyCartUI() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pb-5 pt-4">
        <Text className="text-xs font-black uppercase tracking-widest text-orange-500">Basket</Text>
        <Text className="mt-1 text-4xl font-black text-gray-950">Cart</Text>
      </View>
      <View className="flex-1 items-center justify-center px-6 pb-24">
        <View className="h-28 w-28 items-center justify-center rounded-full bg-orange-50">
          <Ionicons name="cart-outline" size={62} color="#f97316" />
        </View>
        <Text className="mt-6 text-2xl font-black text-gray-950">Your cart is empty</Text>
        <Text className="mt-2 text-center text-base font-semibold text-gray-500">
          Add food from a restaurant and it will appear here.
        </Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} className="mt-7 rounded-2xl bg-orange-500 px-10 py-4">
          <Text className="font-black text-white">Browse restaurants</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function CartItemRow({
  item,
  onAdd,
  onRemove,
}: {
  item: CartItem;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="mb-3 flex-row items-center rounded-3xl bg-white p-3 shadow-sm shadow-black/5">
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} className="h-20 w-20 rounded-2xl bg-gray-100" resizeMode="cover" />
      ) : (
        <View className="h-20 w-20 items-center justify-center rounded-2xl bg-orange-50">
          <Ionicons name="fast-food-outline" size={28} color="#f97316" />
        </View>
      )}

      <View className="ml-4 flex-1">
        <Text className="text-base font-black text-gray-950" numberOfLines={2}>
          {item.name || 'Item'}
        </Text>
        <Text className="mt-1 text-sm font-bold text-gray-500">
          {formatCurrencyUZS(Number(item.price || 0))}
        </Text>
      </View>

      <View className="flex-row items-center rounded-full bg-gray-100 p-1">
        <TouchableOpacity onPress={onRemove} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <Ionicons name="remove" size={18} color="#111827" />
        </TouchableOpacity>
        <Text className="min-w-9 text-center text-base font-black text-gray-950">{item.quantity}</Text>
        <TouchableOpacity onPress={onAdd} className="h-9 w-9 items-center justify-center rounded-full bg-orange-500">
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const cartItems = useCartStore((state) => state.items);
  const restaurant = useCartStore((state) => state.restaurant);
  const deliveryFee = useCartStore((state) => state.deliveryFee);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());
  const [hydrated, setHydrated] = useState(() => useCartStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() => setHydrated(true));
    const fallback = setTimeout(() => setHydrated(true), 800);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const total = useMemo(() => subtotal + Number(deliveryFee || 0), [deliveryFee, subtotal]);

  if (!hydrated) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="bg-white px-5 pb-5 pt-4">
          <Text className="text-xs font-black uppercase tracking-widest text-orange-500">Basket</Text>
          <Text className="mt-1 text-4xl font-black text-gray-950">Cart</Text>
        </View>
        <View className="flex-1 px-5 pt-5">
          <View className="h-24 rounded-3xl bg-white shadow-sm shadow-black/5" />
          <View className="mt-3 h-24 rounded-3xl bg-white shadow-sm shadow-black/5" />
        </View>
      </SafeAreaView>
    );
  }

  if (!cartItems || cartItems.length === 0) return <EmptyCartUI />;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 190 }}
        ListHeaderComponent={
          <View>
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-black uppercase tracking-widest text-orange-500">Basket</Text>
                <Text className="mt-1 text-4xl font-black text-gray-950">Cart</Text>
              </View>
              <TouchableOpacity onPress={clearCart} className="h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Ionicons name="trash-outline" size={21} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View className="mb-4 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
              <Text className="text-sm font-black uppercase tracking-widest text-gray-400">Order from</Text>
              <Text className="mt-2 text-2xl font-black text-gray-950" numberOfLines={1}>
                {restaurant?.name || cartItems[0]?.restaurantName || 'Restaurant'}
              </Text>
              <Text className="mt-1 text-sm font-bold text-gray-500">
                {itemCount} items
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onAdd={() => updateQuantity(item.id, item.quantity + 1)}
            onRemove={() => updateQuantity(item.id, item.quantity - 1)}
          />
        )}
        ListFooterComponent={
          <View className="mt-1 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
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
        }
      />

      <View className="absolute bottom-0 left-0 right-0 bg-white px-5 pb-8 pt-4 shadow-lg shadow-black/10">
        <TouchableOpacity onPress={() => router.push('/checkout' as any)} className="rounded-3xl bg-orange-500 py-5">
          <Text className="text-center text-lg font-black text-white">Checkout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
