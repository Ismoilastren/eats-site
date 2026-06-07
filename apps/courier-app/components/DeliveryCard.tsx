// =============================================
// DELIVERY CARD — Available delivery with accept
// =============================================
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrencyUZS, type Order } from '@repo/shared-types';
import { formatDistance, estimateDeliveryTime } from '../services/locationService';

interface DeliveryCardProps {
  order: Order;
  courierLatitude?: number;
  courierLongitude?: number;
  onAccept: (orderId: string) => void;
  isAccepting?: boolean;
}

export default function DeliveryCard({
  order,
  courierLatitude,
  courierLongitude,
  onAccept,
  isAccepting,
}: DeliveryCardProps) {
  // Calculate distance from courier to restaurant (if location available)
  let distanceText = '—';
  const deliveryFee = Number(order.deliveryFee ?? 0);
  let timeEstimate = 0;

  if (courierLatitude && courierLongitude && order.deliveryLocation) {
    const { calculateDistance } = require('../services/locationService');
    const dist = calculateDistance(
      courierLatitude,
      courierLongitude,
      order.deliveryLocation.latitude,
      order.deliveryLocation.longitude
    );
    distanceText = formatDistance(dist);
    timeEstimate = estimateDeliveryTime(dist);
  } else {
    timeEstimate = 15;
  }

  return (
    <View
      className="mx-4 mb-3 overflow-hidden rounded-2xl bg-white"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      {/* Header with restaurant info */}
      <View className="flex-row items-center border-b border-gray-100 p-4">
        <Image
          source={{
            uri:
              order.restaurantImage ||
              'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop',
          }}
          className="h-12 w-12 rounded-xl"
        />
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
            {order.restaurantName}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
            Pickup order
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-lg font-bold text-primary-600">
            {formatCurrencyUZS(Number.isFinite(deliveryFee) ? deliveryFee : 0)}
          </Text>
          <Text className="text-xs text-gray-400">est. earnings</Text>
        </View>
      </View>

      {/* Pickup & Delivery addresses */}
      <View className="px-4 py-3">
        {/* Pickup */}
        <View className="flex-row items-start">
          <View className="mt-1 items-center">
            <View className="h-3 w-3 rounded-full bg-primary-500" />
            <View className="my-1 h-6 w-0.5 bg-gray-200" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Pickup
            </Text>
            <Text className="mt-0.5 text-sm font-medium text-gray-800" numberOfLines={1}>
              {order.restaurantName}
            </Text>
          </View>
        </View>

        {/* Delivery */}
        <View className="flex-row items-start">
          <View className="mt-1 items-center">
            <View className="h-3 w-3 rounded-full bg-danger-500" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Deliver to
            </Text>
            <Text className="mt-0.5 text-sm font-medium text-gray-800" numberOfLines={2}>
              {order.deliveryAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View className="flex-row border-t border-gray-100 px-4 py-3">
        <View className="flex-1 flex-row items-center">
          <Ionicons name="navigate-outline" size={16} color="#6b7280" />
          <Text className="ml-1.5 text-sm text-gray-600">{distanceText}</Text>
        </View>
        <View className="flex-1 flex-row items-center">
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text className="ml-1.5 text-sm text-gray-600">{timeEstimate} min</Text>
        </View>
        <View className="flex-1 flex-row items-center">
          <Ionicons name="receipt-outline" size={16} color="#6b7280" />
          <Text className="ml-1.5 text-sm text-gray-600">
            {order.items?.length ?? 0} items
          </Text>
        </View>
      </View>

      {/* Accept Button */}
      <Pressable
        onPress={() => onAccept(order.id)}
        disabled={isAccepting}
        className={`mx-4 mb-4 items-center rounded-xl py-3.5 ${
          isAccepting ? 'bg-primary-300' : 'bg-primary-500 active:bg-primary-600'
        }`}
      >
        <Text className="text-base font-bold text-white">
          {isAccepting ? 'Accepting...' : 'Accept Delivery'}
        </Text>
      </Pressable>
    </View>
  );
}
