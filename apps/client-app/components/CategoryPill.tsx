import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface CategoryPillProps {
  emoji: string;
  label: string;
  isActive?: boolean;
  onPress: () => void;
}

export default function CategoryPill({
  emoji,
  label,
  isActive = false,
  onPress,
}: CategoryPillProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View
        className={`mr-3 flex-row items-center rounded-full px-4 py-3 ${
          isActive
            ? 'bg-brand-500 shadow-md shadow-brand-500/30'
            : 'bg-gray-100'
        }`}
      >
        <Text className="mr-1.5 text-lg">{emoji}</Text>
        <Text
          className={`text-sm font-semibold ${
            isActive ? 'text-white' : 'text-gray-700'
          }`}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
