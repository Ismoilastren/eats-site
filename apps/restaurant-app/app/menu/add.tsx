import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMenuStore } from '../../stores/menuStore';
import { useAuthStore } from '../../stores/authStore';

export default function AddMenuItemScreen() {
  const router = useRouter();
  const { addMenuItem } = useMenuStore();
  const restaurant = useAuthStore(state => state.restaurant);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Main Course');
  const [isAvailable, setIsAvailable] = useState(true);

  const handleSave = async () => {
    if (!name || !price) {
      Alert.alert('Error', 'Please fill out required fields');
      return;
    }

    if (!restaurant?.id) {
      Alert.alert('Error', 'Not bound to a restaurant.');
      return;
    }

    await addMenuItem({
      id: `m-${Date.now()}`,
      restaurantId: restaurant.id,
      name,
      description,
      price: parseFloat(price),
      categoryId: category,
      category: category,
      isAvailable,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' // Placeholder
    } as any);
    
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <View className="px-4 py-4 border-b border-gray-800 flex-row items-center justify-between bg-gray-900">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color="#9CA3AF" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white tracking-widest">ADD ITEM</Text>
        <TouchableOpacity onPress={handleSave} className="p-2">
          <Text className="text-orange-500 font-bold tracking-widest">SAVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity className="bg-gray-800 h-40 rounded-xl items-center justify-center mb-6 border border-dashed border-gray-700">
          <Ionicons name="camera" size={32} color="#6B7280" />
          <Text className="text-gray-400 mt-2 font-bold tracking-widest uppercase text-xs">Add Photo</Text>
        </TouchableOpacity>

        <View className="space-y-4">
          <View>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Item Name *</Text>
            <TextInput
              className="border border-gray-700 rounded-xl px-4 py-3 bg-black/30 text-white font-bold text-base"
              placeholder="e.g. Classic Cheeseburger"
              placeholderTextColor="#6B7280"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Description</Text>
            <TextInput
              className="border border-gray-700 rounded-xl px-4 py-3 bg-black/30 text-white font-medium text-sm h-24"
              placeholder="Brief description of the item"
              placeholderTextColor="#6B7280"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Price (UZS) *</Text>
            <TextInput
              className="border border-gray-700 rounded-xl px-4 py-3 bg-black/30 text-white font-bold text-base"
              placeholder="0"
              placeholderTextColor="#6B7280"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Category</Text>
            <View className="flex-row flex-wrap">
              {['Appetizers', 'Main Course', 'Drinks', 'Desserts'].map((cat) => (
                <TouchableOpacity 
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-xl mr-2 mb-2 border ${category === cat ? 'bg-orange-500/20 border-orange-500' : 'bg-gray-800 border-gray-700'}`}
                >
                  <Text className={`font-bold tracking-widest text-xs uppercase ${category === cat ? 'text-orange-400' : 'text-gray-400'}`}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mt-4 flex-row justify-between items-center bg-gray-900 p-5 rounded-2xl shadow-lg border border-gray-800">
            <View>
              <Text className="text-lg font-black text-white tracking-wide">Available</Text>
              <Text className="text-xs text-gray-400 mt-1">Item is currently in stock</Text>
            </View>
            <Switch 
              value={isAvailable} 
              onValueChange={setIsAvailable}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor={isAvailable ? '#ffffff' : '#9ca3af'}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
