import React, { useEffect } from 'react';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NormalizedCoordinate } from '@repo/shared-types';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useCartStore } from '../stores/cartStore';

interface MenuItemCardProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage?: string;
  restaurantLocation?: NormalizedCoordinate | { lat: number; lng: number } | null;
  restaurantDeliveryFee?: number;
  isAvailable: boolean;
}

export default function MenuItemCard({
  id,
  name,
  description,
  price,
  imageUrl,
  restaurantId,
  restaurantName,
  restaurantImage,
  restaurantLocation,
  restaurantDeliveryFee,
  isAvailable,
}: MenuItemCardProps) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const warning = useCartStore((state) => state.lastSwitchWarning);
  const clearSwitchWarning = useCartStore((state) => state.clearSwitchWarning);
  const cartItem = items.find((item) => item.id === id);
  const quantity = cartItem?.quantity ?? 0;

  useEffect(() => {
    if (!warning) return;
    Alert.alert('Cart updated', warning);
    clearSwitchWarning();
  }, [warning, clearSwitchWarning]);

  const handleAdd = () => {
    addItem(
      {
        id,
        name,
        price: Number(price) || 0,
        quantity: 1,
        imageUrl: imageUrl || '',
        restaurantId,
        restaurantName,
      },
      {
        id: restaurantId,
        name: restaurantName,
        imageUrl: restaurantImage,
        location: restaurantLocation,
        deliveryFee: restaurantDeliveryFee,
      }
    );
  };

  return (
    <View className={`mb-3 flex-row rounded-3xl bg-white p-3 shadow-sm shadow-black/5 ${!isAvailable ? 'opacity-50' : ''}`}>
      <View className="flex-1 justify-between pr-3">
        <View>
          <Text className="text-base font-extrabold text-gray-950" numberOfLines={1}>
            {name}
          </Text>
          {!!description && (
            <Text className="mt-1 text-sm leading-5 text-gray-500" numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-lg font-black text-gray-950">{formatCurrencyUZS(price)}</Text>
          {!isAvailable ? (
            <Text className="text-sm font-bold text-red-500">Unavailable</Text>
          ) : quantity > 0 ? (
            <View className="flex-row items-center rounded-full bg-gray-100 p-1">
              <TouchableOpacity
                onPress={() => updateQuantity(id, quantity - 1)}
                className="h-8 w-8 items-center justify-center rounded-full bg-white"
              >
                <Ionicons name="remove" size={18} color="#111827" />
              </TouchableOpacity>
              <Text className="min-w-8 text-center text-base font-black text-gray-950">{quantity}</Text>
              <TouchableOpacity
                onPress={() => updateQuantity(id, quantity + 1)}
                className="h-8 w-8 items-center justify-center rounded-full bg-orange-500"
              >
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={handleAdd} className="rounded-full bg-orange-500 px-5 py-2.5">
              <Text className="text-sm font-black text-white">+ Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Image
        source={{
          uri: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop',
        }}
        className="h-28 w-28 rounded-2xl bg-gray-100"
        resizeMode="cover"
      />
    </View>
  );
}
