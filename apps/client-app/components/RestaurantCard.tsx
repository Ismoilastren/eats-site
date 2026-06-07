import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface RestaurantCardProps {
  id: string;
  name: string;
  imageUrl: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  deliveryTime: number;
  deliveryFee: number;
}

export default function RestaurantCard({
  id,
  name,
  imageUrl,
  cuisine,
  rating,
  reviewCount,
  deliveryTime,
  deliveryFee,
}: RestaurantCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/restaurant/${id}`)}
      activeOpacity={0.9}
      className="mb-4"
    >
      <View className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/10">
        {/* Restaurant Image */}
        <Image
          source={{ uri: imageUrl }}
          className="h-44 w-full"
          resizeMode="cover"
        />

        {/* Info */}
        <View className="p-3.5">
          {/* Name + Rating */}
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="flex-1 text-lg font-bold text-gray-900" numberOfLines={1}>
              {name}
            </Text>
            <View className="ml-2 flex-row items-center rounded-lg bg-green-50 px-2 py-1">
              <Ionicons name="star" size={14} color="#16a34a" />
              <Text className="ml-0.5 text-sm font-bold text-green-700">
                {rating.toFixed(1)}
              </Text>
              <Text className="ml-0.5 text-xs text-green-600">
                ({reviewCount})
              </Text>
            </View>
          </View>

          {/* Cuisine */}
          <Text className="mb-2 text-sm text-gray-500">{cuisine}</Text>

          {/* Delivery Info */}
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text className="ml-1 text-sm text-gray-600">
              {deliveryTime} min
            </Text>
            <View className="mx-2 h-1 w-1 rounded-full bg-gray-300" />
            <Ionicons name="bicycle-outline" size={14} color="#6b7280" />
            <Text className="ml-1 text-sm text-gray-600">
              {deliveryFee === 0 ? 'Free delivery' : `$${deliveryFee.toFixed(2)}`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
