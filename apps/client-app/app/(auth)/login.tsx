import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  auth,
  signInWithEmailAndPassword,
} from '@repo/firebase-config';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      setUser({
        uid: credential.user.uid,
        displayName: credential.user.displayName ?? 'User',
        email: credential.user.email ?? '',
        phone: '',
        photoURL: credential.user.photoURL ?? '',
        role: 'client',
        savedAddresses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      router.replace('/(tabs)');
    } catch (error: any) {
      const message =
        error?.code === 'auth/user-not-found'
          ? 'No account found with this email'
          : error?.code === 'auth/wrong-password'
          ? 'Incorrect password'
          : error?.code === 'auth/invalid-email'
          ? 'Invalid email address'
          : 'Login failed. Please try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setUser({
      uid: 'demo-user-001',
      displayName: 'Demo User',
      email: 'demo@expresseats.com',
      phone: '+1 (555) 123-4567',
      photoURL: '',
      role: 'client',
      savedAddresses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center px-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View className="mb-10 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-brand-500 shadow-lg shadow-brand-500/30">
              <Text className="text-4xl">🍽️</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900">
              ExpressEats
            </Text>
            <Text className="mt-1 text-base text-gray-500">
              Delicious food, delivered fast
            </Text>
          </View>

          {/* Email Field */}
          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              Email
            </Text>
            <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-4">
              <Ionicons name="mail-outline" size={20} color="#9ca3af" />
              <TextInput
                className="ml-3 flex-1 py-4 text-base text-gray-900"
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password Field */}
          <View className="mb-2">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              Password
            </Text>
            <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-4">
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
              <TextInput
                className="ml-3 flex-1 py-4 text-base text-gray-900"
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity className="mb-6 self-end">
            <Text className="text-sm font-semibold text-brand-500">
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="mb-4 flex-row items-center justify-center rounded-2xl bg-brand-500 py-4 shadow-md shadow-brand-500/30"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-lg font-bold text-white">Log In</Text>
            )}
          </TouchableOpacity>

          {/* Demo Login */}
          <TouchableOpacity
            onPress={handleDemoLogin}
            className="mb-6 flex-row items-center justify-center rounded-2xl border border-gray-200 py-4"
          >
            <Ionicons name="flash-outline" size={20} color="#FF6B35" />
            <Text className="ml-2 text-base font-semibold text-gray-700">
              Continue as Demo User
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="mb-6 flex-row items-center">
            <View className="h-px flex-1 bg-gray-200" />
            <Text className="mx-4 text-sm text-gray-400">or</Text>
            <View className="h-px flex-1 bg-gray-200" />
          </View>

          {/* Register Link */}
          <View className="flex-row items-center justify-center">
            <Text className="text-base text-gray-600">
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
            >
              <Text className="text-base font-bold text-brand-500">
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
