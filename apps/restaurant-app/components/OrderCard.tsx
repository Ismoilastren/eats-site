import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCurrencyUZS, Order } from '@repo/shared-types';
import StatusButton from './StatusButton';

interface OrderCardProps {
  order: Order;
}

export default function OrderCard({ order }: OrderCardProps) {
  const router = useRouter();
  
  const timeElapsed = () => {
    const created = (order.createdAt as any)?.toDate?.() || new Date(order.createdAt as any);
    if (!created || Number.isNaN(created.getTime())) return 'Just now';
    const diff = Math.max(0, Math.floor((new Date().getTime() - created.getTime()) / 60000));
    return `${diff} min ago`;
  };

  return (
    <TouchableOpacity 
      onPress={() => router.push(`/order/${order.id}`)}
      className="bg-white rounded-2xl p-4 mb-4 shadow-sm"
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-center mb-3">
        <Text className="font-bold text-lg text-gray-900">
          Order #{order.id.slice(-6).toUpperCase()}
        </Text>
        <Text className="text-gray-500 text-sm">{timeElapsed()}</Text>
      </View>
      
      <View className="mb-3">
        <Text className="font-semibold text-gray-800 mb-1">{order.userId || 'Guest'}</Text>
        <Text className="text-gray-600 text-sm" numberOfLines={2}>
          {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
        </Text>
      </View>

      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-gray-500 font-medium">Total</Text>
        <Text className="font-bold text-xl text-primary-dark">{formatCurrencyUZS(order.totalAmount)}</Text>
      </View>
      
      <StatusButton order={order} />
    </TouchableOpacity>
  );
}
