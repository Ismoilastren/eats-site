import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMenuStore } from '../../stores/menuStore';

export default function EditMenuItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { menuItems, updateMenuItem, deleteMenuItem } = useMenuStore();

  const item = menuItems.find(i => i.id === id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Main Course');
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || '');
      setPrice(item.price.toString());
      setCategory(item.categoryId || item.category || 'Main Course');
      setIsAvailable(item.isAvailable);
    }
  }, [item]);

  if (!item) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center' }}>
        <Text className="text-white font-bold text-lg mb-4">Item not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="px-6 py-3 bg-gray-800 rounded-xl border border-gray-700">
          <Text className="text-white font-bold">GO BACK</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!name || !price) {
      Alert.alert('Error', 'Please fill out required fields');
      return;
    }

    setSaving(true);
    await updateMenuItem(id, {
      name,
      description,
      price: parseFloat(price),
      categoryId: category,
      category: category,
      isAvailable
    });
    setSaving(false);
    
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this menu item?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            setSaving(true);
            await deleteMenuItem(id);
            setSaving(false);
            router.back();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <View className="px-4 py-4 border-b border-gray-800 flex-row items-center justify-between bg-gray-900">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color="#9CA3AF" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white tracking-widest">EDIT ITEM</Text>
        <TouchableOpacity onPress={handleSave} className="p-2" disabled={saving}>
          {saving ? <ActivityIndicator color="#FF6B35" /> : <Text className="text-orange-500 font-bold tracking-widest">SAVE</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity className="h-40 rounded-xl items-center justify-center mb-6 overflow-hidden bg-gray-800 border border-gray-700">
          <Image source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' }} className="w-full h-full opacity-60" />
          <View className="absolute bg-black/60 px-4 py-2 rounded-full border border-gray-600">
            <Text className="text-white text-xs font-bold tracking-widest uppercase">Change Photo</Text>
          </View>
        </TouchableOpacity>

        <View className="space-y-4">
          <View>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Item Name *</Text>
            <TextInput
              className="border border-gray-700 rounded-xl px-4 py-3 bg-black/30 text-white font-bold text-base"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#6B7280"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Description</Text>
            <TextInput
              className="border border-gray-700 rounded-xl px-4 py-3 bg-black/30 text-white font-medium text-sm h-24"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View className="mt-4">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Price (UZS) *</Text>
            <TextInput
              className="border border-gray-700 rounded-xl px-4 py-3 bg-black/30 text-white font-bold text-base"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholderTextColor="#6B7280"
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

          <TouchableOpacity 
            onPress={handleDelete}
            disabled={saving}
            className="mt-8 py-4 rounded-xl items-center border border-rose-500/30 bg-rose-500/10 mb-10"
          >
            <Text className="text-rose-500 font-black tracking-widest">DELETE ITEM</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
