import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  arrayUnion,
  db,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuth } from '../context/AuthContext';

type PaymentCard = {
  id: string;
  brand: string;
  holderName: string;
  last4: string;
  expiry: string;
  createdAt: string;
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const digitsOnly = (value: string) => value.replace(/\D/g, '');

const cardBrand = (cardNumber: string) => {
  const digits = digitsOnly(cardNumber);
  if (digits.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'Mastercard';
  if (/^8600/.test(digits)) return 'Uzcard';
  if (/^9860/.test(digits)) return 'Humo';
  return 'Card';
};

const formatCardNumber = (value: string) =>
  digitsOnly(value)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();

const formatExpiry = (value: string) => {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export default function PaymentCardsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const uid = user?.uid || profile?.uid || '';
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState(profile?.displayName || user?.displayName || '');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const previewBrand = useMemo(() => cardBrand(cardNumber), [cardNumber]);

  useEffect(() => {
    if (!uid) {
      setCards([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.USERS, uid),
      (snapshot) => {
        const data = snapshot.data();
        setCards(Array.isArray(data?.paymentCards) ? data.paymentCards : []);
        setLoading(false);
      },
      (error) => {
        console.error('Payment cards listener failed:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const saveCard = async () => {
    if (!uid) {
      router.replace('/login');
      return;
    }

    const digits = digitsOnly(cardNumber);
    const cleanExpiry = expiry.trim();
    const cleanHolder = holderName.trim();
    const cleanCvv = digitsOnly(cvv);

    if (digits.length < 12) {
      Alert.alert('Invalid card', 'Enter a valid card number.');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cleanExpiry)) {
      Alert.alert('Invalid expiry', 'Use MM/YY format.');
      return;
    }
    if (!cleanHolder) {
      Alert.alert('Card holder required', 'Enter card holder name.');
      return;
    }
    if (cleanCvv.length < 3) {
      Alert.alert('Invalid CVV', 'Enter CVV to validate the card. CVV will not be saved.');
      return;
    }

    setSaving(true);
    try {
      const nextCard: PaymentCard = {
        id: makeId(),
        brand: cardBrand(cardNumber),
        holderName: cleanHolder,
        last4: digits.slice(-4),
        expiry: cleanExpiry,
        createdAt: new Date().toISOString(),
      };

      await setDoc(
        doc(db, COLLECTIONS.USERS, uid),
        {
          paymentCards: arrayUnion(nextCard),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setCardNumber('');
      setExpiry('');
      setCvv('');
      Alert.alert('Card added', 'Payment card saved successfully.');
    } catch (error: any) {
      console.error('Failed to save payment card:', error);
      Alert.alert('Save failed', error?.message || 'Could not save card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pb-4 pt-3">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Ionicons name="arrow-back" size={21} color="#111827" />
          </TouchableOpacity>
          <Text className="text-3xl font-black text-gray-950">Payment Cards</Text>
        </View>
      </View>

      <View className="m-4 rounded-3xl bg-gray-950 p-5 shadow-sm shadow-black/10">
        <View className="mb-5 flex-row items-center justify-between">
          <Text className="text-lg font-black text-white">{previewBrand}</Text>
          <Ionicons name="card" size={28} color="#f97316" />
        </View>
        <TextInput
          value={cardNumber}
          onChangeText={(value) => setCardNumber(formatCardNumber(value))}
          keyboardType="number-pad"
          placeholder="0000 0000 0000 0000"
          placeholderTextColor="#64748b"
          className="mb-3 rounded-2xl bg-white/10 px-4 py-3 text-base font-black text-white"
        />
        <TextInput
          value={holderName}
          onChangeText={setHolderName}
          placeholder="Card holder"
          placeholderTextColor="#64748b"
          autoCapitalize="words"
          className="mb-3 rounded-2xl bg-white/10 px-4 py-3 text-base font-bold text-white"
        />
        <View className="flex-row gap-3">
          <TextInput
            value={expiry}
            onChangeText={(value) => setExpiry(formatExpiry(value))}
            keyboardType="number-pad"
            placeholder="MM/YY"
            placeholderTextColor="#64748b"
            className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-base font-bold text-white"
          />
          <TextInput
            value={cvv}
            onChangeText={(value) => setCvv(digitsOnly(value).slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="CVV"
            placeholderTextColor="#64748b"
            className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-base font-bold text-white"
          />
        </View>
        <TouchableOpacity
          onPress={saveCard}
          disabled={saving}
          className="mt-4 items-center justify-center rounded-2xl bg-orange-500 py-4"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-black text-white">Add Card</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      ) : cards.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="card-outline" size={64} color="#d1d5db" />
          <Text className="mt-4 text-xl font-black text-gray-950">No saved cards</Text>
          <Text className="mt-2 text-center font-semibold text-gray-500">Add a card for faster checkout.</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View className="mb-3 flex-row items-center rounded-3xl bg-white p-4 shadow-sm shadow-black/5">
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-orange-50">
                <Ionicons name="card" size={21} color="#f97316" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-black text-gray-950">
                  {item.brand} •••• {item.last4}
                </Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">
                  {item.holderName} • {item.expiry}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
