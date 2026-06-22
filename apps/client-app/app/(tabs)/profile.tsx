import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, db, onSnapshot, query, where } from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const clearCart = useCartStore((state) => state.clearCart);
  const [addressCount, setAddressCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);

  const displayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Customer';
  const email = profile?.email || user?.email || 'No email';
  const phone = profile?.phone || user?.phoneNumber || 'Phone not added';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const uid = user?.uid || profile?.uid || '';

  useEffect(() => {
    if (!uid) {
      setAddressCount(0);
      setCardCount(0);
      setOrderCount(0);
      return;
    }

    const unsubscribes = [
      onSnapshot(collection(db, COLLECTIONS.USERS, uid, 'addresses'), (snapshot) => setAddressCount(snapshot.size), () => setAddressCount(0)),
      onSnapshot(collection(db, COLLECTIONS.USERS, uid, 'paymentMethods'), (snapshot) => setCardCount(snapshot.size), () => setCardCount(0)),
      onSnapshot(query(collection(db, COLLECTIONS.ORDERS), where('userId', '==', uid)), (snapshot) => setOrderCount(snapshot.size), () => setOrderCount(0)),
    ];

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [uid]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Do you want to sign out of the client app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          clearCart();
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="p-6 pt-10">
        <Text className="text-3xl font-extrabold text-gray-900 mb-8">Profile</Text>
        
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-row items-center mb-8">
          <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center mr-4">
             <Text className="text-2xl font-bold text-orange-600">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>{displayName}</Text>
            <Text className="text-gray-500 mt-1" numberOfLines={1}>{email}</Text>
            <Text className="text-gray-400 mt-1" numberOfLines={1}>{phone}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/addresses' as any)}
          className="bg-white p-5 rounded-2xl flex-row items-center shadow-sm border border-gray-100 mb-3"
        >
          <Ionicons name="location-outline" size={24} color="#374151" />
          <Text className="ml-4 font-semibold text-gray-700 text-lg flex-1">Saved Addresses</Text>
          <Text className="mr-3 font-black text-gray-400">{addressCount}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/payment-cards' as any)}
          className="bg-white p-5 rounded-2xl flex-row items-center shadow-sm border border-gray-100 mb-3"
        >
          <Ionicons name="card-outline" size={24} color="#374151" />
          <Text className="ml-4 font-semibold text-gray-700 text-lg flex-1">Payment Cards</Text>
          <Text className="mr-3 font-black text-gray-400">{cardCount}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/orders')}
          className="bg-white p-5 rounded-2xl flex-row items-center shadow-sm border border-gray-100 mb-3"
        >
          <Ionicons name="receipt-outline" size={24} color="#374151" />
          <Text className="ml-4 font-semibold text-gray-700 text-lg flex-1">Order History</Text>
          <Text className="mr-3 font-black text-gray-400">{orderCount}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-white p-5 rounded-2xl flex-row items-center shadow-sm border border-gray-100 mt-8"
        >
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text className="ml-4 font-semibold text-red-500 text-lg flex-1">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
