import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, signInWithEmailAndPassword } from '@repo/firebase-config';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (error: any) {
      const message =
        error?.code === 'auth/invalid-credential'
          ? 'Email or password is incorrect.'
          : error?.code === 'auth/invalid-email'
            ? 'Email address is invalid.'
            : 'Login failed. Please try again.';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f7f7f5]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8">
            <View className="mb-5 h-16 w-16 items-center justify-center rounded-3xl bg-orange-500 shadow-lg shadow-orange-500/30">
              <Ionicons name="fast-food" size={30} color="#fff" />
            </View>
            <Text className="text-4xl font-black tracking-tight text-gray-950">2(13)</Text>
            <Text className="mt-2 text-base font-semibold text-gray-500">
              Sign in to order from your favorite restaurants.
            </Text>
          </View>

          <View className="rounded-[32px] bg-white p-5 shadow-sm shadow-black/5">
            <Text className="mb-5 text-2xl font-black text-gray-950">Welcome back</Text>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-black uppercase tracking-wide text-gray-400">Email</Text>
              <View className="flex-row items-center rounded-2xl bg-gray-100 px-4">
                <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                <TextInput
                  className="ml-3 flex-1 py-4 text-base font-semibold text-gray-950"
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
            </View>

            <View className="mb-5">
              <Text className="mb-2 text-sm font-black uppercase tracking-wide text-gray-400">Password</Text>
              <View className="flex-row items-center rounded-2xl bg-gray-100 px-4">
                <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                <TextInput
                  className="ml-3 flex-1 py-4 text-base font-semibold text-gray-950"
                  placeholder="password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              className="h-14 flex-row items-center justify-center rounded-2xl bg-gray-950"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-black text-white">Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="mt-6 flex-row items-center justify-center">
            <Text className="font-semibold text-gray-500">No account yet? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text className="font-black text-orange-500">Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
