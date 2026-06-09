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
import {
  auth,
  createUserWithEmailAndPassword,
  db,
  doc,
  serverTimestamp,
  setDoc,
  updateProfile,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';

// ─── PHONE MASK: +998 XX XXX XX XX (max 17 chars) ───────────────────────────
const UZ_PREFIX = '+998';
const PHONE_MAX_LEN = 17; // '+998 90 123 45 67'

function formatPhoneUZ(raw: string): string {
  // Strip everything except digits, keep only last 9 after +998
  const digits = raw.replace(/\D/g, '');
  // Remove leading 998 if the user types it manually
  const local = digits.startsWith('998') ? digits.slice(3) : digits;
  const d = local.slice(0, 9); // max 9 local digits

  let result = UZ_PREFIX;
  if (d.length > 0) result += ' ' + d.slice(0, 2);
  if (d.length > 2) result += ' ' + d.slice(2, 5);
  if (d.length > 5) result += ' ' + d.slice(5, 7);
  if (d.length > 7) result += ' ' + d.slice(7, 9);
  return result;
}

function handlePhoneInput(raw: string, prev: string): string {
  // If user tries to delete the prefix, reset to prefix only
  if (!raw.startsWith(UZ_PREFIX)) return UZ_PREFIX;
  return formatPhoneUZ(raw);
}

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(UZ_PREFIX);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPhoneComplete = phone.length === PHONE_MAX_LEN;

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Fill in name, phone, email, and password.');
      return;
    }
    if (!isPhoneComplete) {
      Alert.alert('Invalid phone', 'Enter a valid Uzbek number: +998 XX XXX XX XX');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      await updateProfile(credential.user, { displayName: name.trim() });
      await setDoc(doc(db, COLLECTIONS.USERS, credential.user.uid), {
        uid: credential.user.uid,
        displayName: name.trim(),
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        photoURL: '',
        role: 'client',
        source: 'app',
        savedAddresses: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.replace('/(tabs)');
    } catch (error: any) {
      const message =
        error?.code === 'auth/email-already-in-use'
          ? 'This email is already registered.'
          : error?.code === 'auth/invalid-email'
            ? 'Email address is invalid.'
            : error?.code === 'auth/weak-password'
              ? 'Password is too weak.'
              : 'Registration failed. Please try again.';
      Alert.alert('Registration failed', message);
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
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => router.replace('/login')}
            className="mb-6 h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text className="text-4xl font-black tracking-tight text-gray-950">Create account</Text>
          <Text className="mt-2 text-base font-semibold text-gray-500">
            Your food, your address, one tap away.
          </Text>

          <View className="mt-7 rounded-[32px] bg-white p-5 shadow-sm shadow-black/5">
            <View className="mb-4">
              <Text className="mb-2 text-sm font-black uppercase tracking-wide text-gray-400">Name</Text>
              <TextInput
                className="rounded-2xl bg-gray-100 px-4 py-4 text-base font-semibold text-gray-950"
                placeholder="Ismoilbek Bakhodirov"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-black uppercase tracking-wide text-gray-400">Phone</Text>
              <TextInput
                className={`rounded-2xl bg-gray-100 px-4 py-4 text-base font-semibold ${
                  phone.length > 4 && !isPhoneComplete ? 'text-red-500' : 'text-gray-950'
                }`}
                placeholder="+998 90 123 45 67"
                placeholderTextColor="#9ca3af"
                value={phone}
                onChangeText={(raw) => setPhone(handlePhoneInput(raw, phone))}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={PHONE_MAX_LEN}
              />
              {phone.length > 4 && !isPhoneComplete && (
                <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, marginLeft: 4, fontWeight: '700' }}>
                  Enter full number: +998 XX XXX XX XX
                </Text>
              )}
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-black uppercase tracking-wide text-gray-400">Email</Text>
              <TextInput
                className="rounded-2xl bg-gray-100 px-4 py-4 text-base font-semibold text-gray-950"
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

            <View className="mb-6">
              <Text className="mb-2 text-sm font-black uppercase tracking-wide text-gray-400">Password</Text>
              <View className="flex-row items-center rounded-2xl bg-gray-100 px-4">
                <TextInput
                  className="flex-1 py-4 text-base font-semibold text-gray-950"
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
              className="h-14 flex-row items-center justify-center rounded-2xl bg-orange-500"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-black text-white">Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="mt-6 flex-row items-center justify-center">
            <Text className="font-semibold text-gray-500">Already registered? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text className="font-black text-orange-500">Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
