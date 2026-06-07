import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Image, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useRouter } from 'expo-router';
import { db, doc, onSnapshot, updateDoc } from '@repo/firebase-config';
import { COLLECTIONS, Restaurant } from '@repo/shared-types';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

export default function SettingsScreen() {
  const { logout } = useAuthStore();
  const restaurantAuth = useAuthStore(state => state.restaurant);
  const router = useRouter();

  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!restaurantAuth?.id) return;

    const docRef = doc(db, COLLECTIONS.RESTAURANTS, restaurantAuth.id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Restaurant;
        setRestaurantData(data);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching restaurant settings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantAuth?.id]);

  const handleToggleStatus = async (newValue: boolean) => {
    if (!restaurantAuth?.id) return;
    
    // Optimistic UI update
    setRestaurantData(prev => prev ? { ...prev, isActive: newValue } : null);
    setIsUpdatingStatus(true);
    
    try {
      const docRef = doc(db, COLLECTIONS.RESTAURANTS, restaurantAuth.id);
      await updateDoc(docRef, {
        isActive: newValue
      });
    } catch (error: any) {
      console.error("Error updating status:", error);
      Alert.alert('Error', 'Failed to update restaurant status: ' + error.message);
      // Revert optimistic update
      setRestaurantData(prev => prev ? { ...prev, isActive: !newValue } : null);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  const isActive = restaurantData?.isActive ?? true;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <View className="px-5 py-4 bg-gray-900 flex-row items-center border-b border-gray-800 shadow-sm z-10">
        <View className="w-10 h-10 bg-orange-500/20 rounded-xl items-center justify-center border border-orange-500/30">
          <Ionicons name="settings-sharp" size={20} color="#FF6B35" />
        </View>
        <Text className={`font-extrabold text-white ml-3 tracking-wide ${isSmallScreen ? 'text-lg' : 'text-2xl'}`}>
          SETTINGS
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        <View className="items-center mb-8 mt-4">
          <View className="p-1 bg-gradient-to-tr from-orange-500 to-orange-400 rounded-full shadow-lg">
            <Image 
              source={{ uri: restaurantData?.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4' }} 
              className="w-28 h-28 rounded-full border-4 border-gray-900"
            />
          </View>
        </View>

        <View className="bg-gray-900 p-5 rounded-2xl shadow-lg border border-gray-800 mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-lg font-black text-white tracking-wide">Restaurant Status</Text>
            <Text className={`text-xs font-bold mt-1 uppercase tracking-widest ${isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isActive ? 'Accepting Orders' : 'Currently Closed'}
            </Text>
          </View>
          <Switch 
            value={isActive} 
            onValueChange={handleToggleStatus}
            disabled={isUpdatingStatus}
            trackColor={{ false: '#374151', true: '#10B981' }}
            thumbColor={isActive ? '#ffffff' : '#9ca3af'}
          />
        </View>

        <View className="bg-gray-900 p-5 rounded-2xl shadow-lg border border-gray-800 mb-8">
          <Text className="font-extrabold text-gray-400 uppercase tracking-widest text-xs mb-4">Basic Info (Admin Managed)</Text>
          
          <View className="mb-6">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Restaurant Name</Text>
            <View className="border border-gray-800/50 rounded-xl px-4 py-3 bg-black/20">
              <Text className="text-white font-bold text-base">{restaurantData?.name || 'Unnamed Restaurant'}</Text>
            </View>
          </View>

          <View>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Description</Text>
            <View className="border border-gray-800/50 rounded-xl px-4 py-3 bg-black/20 min-h-[112px]">
              <Text className="text-gray-300 font-medium text-sm leading-6">
                {restaurantData?.description || 'No description provided.'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleLogout}
          className="bg-rose-500/10 py-4 rounded-xl items-center border border-rose-500/30 mt-4"
        >
          <Text className="text-rose-500 font-black text-lg tracking-widest">LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
