import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="p-6 pt-10">
        <Text className="text-3xl font-extrabold text-gray-900 mb-8">Profile</Text>
        
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-row items-center mb-8">
          <View className="w-16 h-16 bg-brand-100 rounded-full items-center justify-center mr-4">
             <Text className="text-2xl font-bold text-brand-600">U</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">User Account</Text>
            <Text className="text-gray-500 mt-1">user@example.com</Text>
          </View>
        </View>

        <TouchableOpacity className="bg-white p-5 rounded-2xl flex-row items-center shadow-sm border border-gray-100 mb-3">
          <Ionicons name="location-outline" size={24} color="#374151" />
          <Text className="ml-4 font-semibold text-gray-700 text-lg flex-1">Saved Addresses</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity className="bg-white p-5 rounded-2xl flex-row items-center shadow-sm border border-gray-100 mb-3">
          <Ionicons name="receipt-outline" size={24} color="#374151" />
          <Text className="ml-4 font-semibold text-gray-700 text-lg flex-1">Order History</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity className="bg-white p-5 rounded-2xl flex-row items-center shadow-sm border border-gray-100 mt-8">
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text className="ml-4 font-semibold text-red-500 text-lg flex-1">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
