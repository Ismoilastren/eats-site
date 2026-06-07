// =============================================
// ONLINE TOGGLE — Big online/offline switch
// =============================================
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function OnlineToggle({ isOnline, onToggle, disabled }: OnlineToggleProps) {
  return (
    <View className="mx-4 mt-4 mb-2">
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        className={`flex-row items-center justify-between rounded-2xl px-6 py-5 ${
          isOnline ? 'bg-primary-500' : 'bg-gray-800'
        } ${disabled ? 'opacity-60' : ''}`}
        style={{
          shadowColor: isOnline ? '#10b981' : '#1f2937',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View className="flex-row items-center gap-3">
          <View
            className={`h-12 w-12 items-center justify-center rounded-full ${
              isOnline ? 'bg-white/20' : 'bg-white/10'
            }`}
          >
            <Ionicons
              name={isOnline ? 'radio' : 'radio-outline'}
              size={24}
              color="white"
            />
          </View>
          <View>
            <Text className="text-lg font-bold text-white">
              {isOnline ? 'You\'re Online' : 'You\'re Offline'}
            </Text>
            <Text className="text-sm text-white/70">
              {isOnline
                ? 'Receiving delivery requests'
                : 'Go online to start earning'}
            </Text>
          </View>
        </View>

        {/* Toggle Switch */}
        <View
          className={`h-8 w-14 rounded-full p-1 ${
            isOnline ? 'bg-white/30' : 'bg-white/20'
          }`}
        >
          <View
            className={`h-6 w-6 rounded-full bg-white ${
              isOnline ? 'ml-auto' : 'ml-0'
            }`}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}
