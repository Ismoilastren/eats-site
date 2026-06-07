import React from 'react';
import { View, Text, Image } from 'react-native';
import { formatCurrencyUZS, type MenuItem } from '@repo/shared-types';

interface MenuItemRowProps {
  item: MenuItem;
}

export default function MenuItemRow({ item }: MenuItemRowProps) {
  return (
    <View 
      className={`flex-row bg-gray-900/80 p-4 rounded-2xl mb-4 shadow-lg border items-center backdrop-blur-md ${item.isAvailable ? 'border-gray-700/50 opacity-100' : 'border-red-900/50 bg-red-900/10 opacity-60'}`}
    >
      <View className="shadow-md">
        <Image 
          source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' }} 
          className="w-16 h-16 rounded-xl bg-gray-800"
        />
      </View>
      <View className="flex-1 ml-4 justify-center">
        <View className="flex-row items-center mb-1.5">
          <Text className="font-extrabold text-white flex-1 text-base tracking-wide" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="font-black text-orange-400 text-lg ml-2">
            {formatCurrencyUZS(item.price)}
          </Text>
        </View>
        <View className="flex-row justify-between items-center mt-1">
          <View className="bg-gray-800/80 px-2 py-1 rounded-md border border-gray-700">
             <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
               {item.category || item.categoryId || 'GENERAL'}
             </Text>
          </View>
          {!item.isAvailable && (
            <View className="bg-red-500/20 px-2 py-1 rounded-md border border-red-500/30">
               <Text className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                 SOLD OUT
               </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
