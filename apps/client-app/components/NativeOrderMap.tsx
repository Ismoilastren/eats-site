import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NativeOrderMap(_props: any) {
  return (
    <View className="flex-1 items-center justify-center bg-gray-100">
      <Ionicons name="map-outline" size={48} color="#9ca3af" />
      <Text className="mt-3 text-center font-bold text-gray-500">
        Native map is available in Expo Go.
      </Text>
    </View>
  );
}
