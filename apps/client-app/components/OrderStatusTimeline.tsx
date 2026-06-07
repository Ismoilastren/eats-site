import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OrderStatus } from '@repo/shared-types';
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from '@repo/shared-types';

interface OrderStatusTimelineProps {
  currentStatus: OrderStatus;
}

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: 'receipt-outline',
  confirmed: 'checkmark-circle-outline',
  cooking: 'flame-outline',
  ready: 'bag-check-outline',
  picked_up: 'bicycle-outline',
  delivering: 'navigate-outline',
  delivered: 'home-outline',
};

export default function OrderStatusTimeline({
  currentStatus,
}: OrderStatusTimelineProps) {
  if (currentStatus === 'cancelled') {
    return (
      <View className="items-center rounded-2xl bg-red-50 p-6">
        <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <Ionicons name="close-circle" size={32} color="#ef4444" />
        </View>
        <Text className="text-lg font-bold text-red-600">Order Cancelled</Text>
        <Text className="mt-1 text-sm text-red-400">
          This order has been cancelled
        </Text>
      </View>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus);

  return (
    <View className="px-2">
      {ORDER_STATUS_FLOW.map((status, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === ORDER_STATUS_FLOW.length - 1;

        return (
          <View key={status} className="flex-row">
            {/* Icon Column */}
            <View className="items-center">
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  isCurrent
                    ? 'bg-brand-500 shadow-md shadow-brand-500/30'
                    : isCompleted
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              >
                <Ionicons
                  name={
                    isCompleted && !isCurrent
                      ? 'checkmark'
                      : STATUS_ICONS[status] || 'ellipse'
                  }
                  size={20}
                  color={isCompleted || isCurrent ? '#fff' : '#9ca3af'}
                />
              </View>
              {!isLast && (
                <View
                  className={`h-8 w-0.5 ${
                    isCompleted && index < currentIndex
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </View>

            {/* Label */}
            <View className="ml-3 flex-1 pb-8">
              <Text
                className={`text-base font-semibold ${
                  isCurrent
                    ? 'text-brand-500'
                    : isCompleted
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                {ORDER_STATUS_LABELS[status]}
              </Text>
              {isCurrent && (
                <Text className="mt-0.5 text-sm text-gray-500">
                  In progress…
                </Text>
              )}
              {isCompleted && !isCurrent && (
                <Text className="mt-0.5 text-sm text-gray-400">Completed</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
