// =============================================
// LOGIN SCREEN — Courier authentication
// =============================================
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
  const [courierId, setCourierId] = useState('');
  const { signIn, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!courierId.trim()) {
      Alert.alert('Error', 'Please enter your Courier ID.');
      return;
    }

    try {
      await signIn(courierId.trim());
    } catch {
      // Error is handled in the store
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-1 justify-center px-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Header */}
          <View className="mb-10 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-orange-500">
              <Ionicons name="bicycle" size={40} color="white" />
            </View>
            <Text className="text-3xl font-extrabold text-gray-900">
              ExpressEats
            </Text>
            <Text className="mt-1 text-lg font-medium text-orange-500">
              Courier
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              Paste your Courier ID from the Admin Panel
            </Text>
          </View>

          {/* Error */}
          {error && (
            <View className="mb-4 flex-row items-center rounded-xl bg-red-50 px-4 py-3">
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text className="ml-2 flex-1 text-sm text-red-600">
                {error}
              </Text>
              <Pressable onPress={clearError}>
                <Ionicons name="close" size={18} color="#ef4444" />
              </Pressable>
            </View>
          )}

          {/* Courier ID Input */}
          <View className="mb-6">
            <Text className="mb-2 text-sm font-semibold text-gray-700">
              Courier ID
            </Text>
            <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-4">
              <Ionicons name="id-card-outline" size={20} color="#9ca3af" />
              <TextInput
                value={courierId}
                onChangeText={setCourierId}
                placeholder="e.g. courier_123456789"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                className="ml-3 flex-1 py-4 text-base text-gray-900"
              />
            </View>
          </View>

          {/* Login Button */}
          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            className={`items-center rounded-2xl py-4 ${
              isLoading ? 'bg-orange-300' : 'bg-orange-500 active:bg-orange-600'
            }`}
            style={{
              shadowColor: '#f97316',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Text className="text-lg font-bold text-white">
              {isLoading ? 'Connecting...' : 'Connect Identity'}
            </Text>
          </Pressable>

          <Text className="mt-6 text-center text-sm text-gray-400">
            Ask an admin if you don't know your ID
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
