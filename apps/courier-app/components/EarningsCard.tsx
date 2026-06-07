// =============================================
// EARNINGS CARD — Earnings summary display
// =============================================
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrencyUZS } from '@repo/shared-types';

interface EarningsCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  large?: boolean;
}

export default function EarningsCard({
  title,
  amount,
  subtitle,
  icon = 'cash-outline',
  iconColor = '#10b981',
  iconBgColor = 'bg-primary-50',
  large = false,
}: EarningsCardProps) {
  return (
    <View
      className={`rounded-2xl bg-white p-4 ${large ? 'items-center py-6' : ''}`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {large ? (
        <>
          <View
            className={`mb-3 h-14 w-14 items-center justify-center rounded-full ${iconBgColor}`}
          >
            <Ionicons name={icon} size={28} color={iconColor} />
          </View>
          <Text className="text-sm font-medium text-gray-500">{title}</Text>
          <Text className="mt-1 text-4xl font-extrabold text-gray-900">
            {formatCurrencyUZS(amount)}
          </Text>
          {subtitle && (
            <Text className="mt-1 text-sm text-gray-400">{subtitle}</Text>
          )}
        </>
      ) : (
        <View className="flex-row items-center">
          <View
            className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${iconBgColor}`}
          >
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-medium text-gray-400">{title}</Text>
            <Text className="text-xl font-bold text-gray-900">
              {formatCurrencyUZS(amount)}
            </Text>
          </View>
          {subtitle && (
            <Text className="text-xs text-gray-400">{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
}
