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
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  onSnapshot,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuth } from '../context/AuthContext';

type PaymentCard = {
  id: string;
  brand: string;
  holderName: string;
  last4: string;
  expiry?: string;
  token?: string;
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

const validateExpiry = (value: string) => {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;
  const [monthText, yearText] = value.split('/');
  const month = Number(monthText);
  const year = Number(`20${yearText}`);
  const now = new Date();
  const expiresAt = new Date(year, month, 0, 23, 59, 59);
  return expiresAt >= now;
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
      collection(db, COLLECTIONS.USERS, uid, 'paymentMethods'),
      (snapshot) => {
        const data: PaymentCard[] = [];
        snapshot.forEach((cardDoc) => {
          data.push({ id: cardDoc.id, ...cardDoc.data() } as PaymentCard);
        });
        setCards(data);
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
    if (!validateExpiry(cleanExpiry)) {
      Alert.alert('Invalid expiry', 'Card expiry must be a future date in MM/YY format.');
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
      const nextCard = {
        brand: cardBrand(cardNumber),
        holderName: cleanHolder,
        last4: digits.slice(-4),
        expiry: cleanExpiry,
        token: `tok_${makeId()}`,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, COLLECTIONS.USERS, uid, 'paymentMethods'), nextCard);

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

  const deleteCard = (cardId: string) => {
    if (!uid) return;
    Alert.alert('Remove card', 'Remove this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, COLLECTIONS.USERS, uid, 'paymentMethods', cardId));
          } catch (error: any) {
            console.error('Failed to remove payment card:', error);
            Alert.alert('Remove failed', error?.message || 'Could not remove card.');
          }
        },
      },
    ]);
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
                  {item.holderName}{item.expiry ? ` • ${item.expiry}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteCard(item.id)}
                className="h-10 w-10 items-center justify-center rounded-full bg-red-50"
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
