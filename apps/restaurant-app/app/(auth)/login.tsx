import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { auth, signInWithEmailAndPassword, db, collection, query, where, getDocs } from '@repo/firebase-config';
import { COLLECTIONS, Restaurant } from '@repo/shared-types';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser, setRestaurant, logout } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      const userEmail = userCredential.user.email || '';

      // 2. Query for the restaurant bound to this user (ownerId)
      const q = query(
        collection(db, COLLECTIONS.RESTAURANTS),
        where('ownerId', '==', uid)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // No restaurant bound to this user
        logout();
        Alert.alert('Access Denied', 'No restaurant is bound to this account. Please contact the administrator.');
        setLoading(false);
        return;
      }

      // 3. Extract exact bound restaurant
      const restaurantDoc = querySnapshot.docs[0];
      const restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant;

      // 4. Save to Zustand AuthStore dynamically
      setUser({ uid, email: userEmail });
      setRestaurant(restaurantData);

      // 5. Navigate to Dashboard
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Login Failed', e.message || 'Invalid credentials or network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 px-6 justify-center"
      >
        <View className="items-center mb-10">
          <View className="w-24 h-24 bg-orange-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="restaurant" size={48} color="#FF6B35" />
          </View>
          <Text className="text-3xl font-bold text-gray-900">Restaurant Portal</Text>
          <Text className="text-gray-500 mt-2 text-center px-4">
            Secure login. Bound to the Global Ecosystem.
          </Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-gray-700 font-medium mb-1">Email</Text>
            <TextInput
              className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
              placeholder="manager@restaurant.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
          </View>

          <View>
            <Text className="text-gray-700 font-medium mb-1 mt-3">Password</Text>
            <TextInput
              className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>

          <TouchableOpacity 
            onPress={handleLogin}
            disabled={loading}
            className={`mt-8 py-4 rounded-xl items-center shadow-md ${loading ? 'bg-orange-300' : 'bg-orange-500'}`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg tracking-wide">Secure Login</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
