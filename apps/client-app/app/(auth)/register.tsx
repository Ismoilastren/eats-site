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
  createUserWithEmailAndPassword,
  updateProfile,
  db,
  doc,
  setDoc,
  serverTimestamp,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuthStore } from '../../stores/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(credential.user, { displayName: name.trim() });

      const userData = {
        uid: credential.user.uid,
        displayName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        photoURL: '',
        role: 'client' as const,
        savedAddresses: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, COLLECTIONS.USERS, credential.user.uid),
        userData
      );

      setUser({
        uid: credential.user.uid,
        displayName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        photoURL: '',
        role: 'client',
        savedAddresses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      router.replace('/(tabs)');
    } catch (error: any) {
      const message =
        error?.code === 'auth/email-already-in-use'
          ? 'An account with this email already exists'
          : error?.code === 'auth/weak-password'
          ? 'Password is too weak'
          : error?.code === 'auth/invalid-email'
          ? 'Invalid email address'
          : 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
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
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-6 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">
              Create Account
            </Text>
            <Text className="mt-1 text-base text-gray-500">
              Sign up to start ordering delicious food
            </Text>
          </View>

          {/* Name Field */}
          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              Full Name
            </Text>
            <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-4">
              <Ionicons name="person-outline" size={20} color="#9ca3af" />
              <TextInput
                className="ml-3 flex-1 py-4 text-base text-gray-900"
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>
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

          {/* Phone Field */}
          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              Phone Number
            </Text>
            <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-4">
              <Ionicons name="call-outline" size={20} color="#9ca3af" />
              <TextInput
                className="ml-3 flex-1 py-4 text-base text-gray-900"
                placeholder="Enter your phone number"
                placeholderTextColor="#9ca3af"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>
          </View>

          {/* Password Field */}
          <View className="mb-6">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              Password
            </Text>
            <View className="flex-row items-center rounded-2xl border border-gray-200 bg-gray-50 px-4">
              <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
              <TextInput
                className="ml-3 flex-1 py-4 text-base text-gray-900"
                placeholder="Create a password (min 6 chars)"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className="mb-6 flex-row items-center justify-center rounded-2xl bg-brand-500 py-4 shadow-md shadow-brand-500/30"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-lg font-bold text-white">
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Terms */}
          <Text className="mb-6 text-center text-xs leading-5 text-gray-400">
            By creating an account, you agree to our{' '}
            <Text className="text-brand-500">Terms of Service</Text> and{' '}
            <Text className="text-brand-500">Privacy Policy</Text>
          </Text>

          {/* Login Link */}
          <View className="flex-row items-center justify-center">
            <Text className="text-base text-gray-600">
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-base font-bold text-brand-500">
                Log In
              </Text>
            </TouchableOpacity>
          </View>

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
