import React, { useEffect, useState } from 'react';
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
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  db,
  onSnapshot,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuth } from '../context/AuthContext';

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
};

export default function AddressesScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const uid = user?.uid || profile?.uid || '';
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [label, setLabel] = useState('Home');
  const [addressText, setAddressText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setAddresses([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.USERS, uid, 'addresses'),
      (snapshot) => {
        const data: SavedAddress[] = [];
        snapshot.forEach((addressDoc) => {
          data.push({ id: addressDoc.id, ...addressDoc.data() } as SavedAddress);
        });
        setAddresses(data);
        setLoading(false);
      },
      (error) => {
        console.error('Saved addresses listener failed:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const useCurrentLocation = async () => {
    setSaving(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Allow location access to save your current address.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const reverse = await Location.reverseGeocodeAsync(current.coords);
      const first = reverse[0];
      if (first) {
        const parts = [first.street, first.district, first.city, first.subregion]
          .map(p => p?.trim())
          .filter(Boolean);

        const cleanAddress = [...new Set(parts)].join(', ');
        setAddressText(cleanAddress || `${current.coords.latitude.toFixed(6)}, ${current.coords.longitude.toFixed(6)}`);
      } else {
        setAddressText(`${current.coords.latitude.toFixed(6)}, ${current.coords.longitude.toFixed(6)}`);
      }
    } catch (error) {
      console.error('Failed to read current address:', error);
      Alert.alert('Location error', 'Could not read your current GPS location.');
    } finally {
      setSaving(false);
    }
  };

  const saveAddress = async () => {
    if (!uid) {
      router.replace('/login');
      return;
    }

    const cleanAddress = addressText.trim();
    if (!cleanAddress) {
      Alert.alert('Address required', 'Enter an address or use current location.');
      return;
    }

    setSaving(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = current.coords.latitude;
        longitude = current.coords.longitude;
      }

      await addDoc(collection(db, COLLECTIONS.USERS, uid, 'addresses'), {
        label: label.trim() || 'Address',
        address: cleanAddress,
        ...(latitude && longitude ? { latitude, longitude } : {}),
        createdAt: new Date().toISOString(),
      });

      setLabel('Home');
      setAddressText('');
      Alert.alert('Saved', 'Address saved successfully.');
    } catch (error: any) {
      console.error('Failed to save address:', error);
      Alert.alert('Save failed', error?.message || 'Could not save address.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = (addressId: string) => {
    if (!uid) return;
    Alert.alert('Delete address', 'Remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, COLLECTIONS.USERS, uid, 'addresses', addressId));
          } catch (error: any) {
            console.error('Failed to delete address:', error);
            Alert.alert('Delete failed', error?.message || 'Could not delete address.');
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
          <Text className="text-3xl font-black text-gray-950">Saved Addresses</Text>
        </View>
      </View>

      <View className="m-4 rounded-3xl bg-white p-4 shadow-sm shadow-black/5">
        <Text className="mb-3 text-lg font-black text-gray-950">Add address</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Label"
          placeholderTextColor="#9ca3af"
          className="mb-3 rounded-2xl bg-gray-100 px-4 py-3 text-base font-semibold text-gray-950"
        />
        <TextInput
          value={addressText}
          onChangeText={setAddressText}
          placeholder="Street, house, apartment"
          placeholderTextColor="#9ca3af"
          multiline
          className="min-h-24 rounded-2xl bg-gray-100 px-4 py-3 text-base font-semibold text-gray-950"
        />
        <View className="mt-4 flex-row gap-3">
          <TouchableOpacity
            onPress={useCurrentLocation}
            disabled={saving}
            className="flex-1 flex-row items-center justify-center rounded-2xl bg-gray-950 py-3"
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text className="ml-2 font-black text-white">Use GPS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={saveAddress}
            disabled={saving}
            className="flex-1 items-center justify-center rounded-2xl bg-orange-500 py-3"
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-black text-white">Save</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      ) : addresses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="location-outline" size={64} color="#d1d5db" />
          <Text className="mt-4 text-xl font-black text-gray-950">No saved addresses</Text>
          <Text className="mt-2 text-center font-semibold text-gray-500">Save your delivery locations here.</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-3xl bg-white p-4 shadow-sm shadow-black/5">
              <View className="flex-row items-start">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-orange-50">
                  <Ionicons name="location" size={21} color="#f97316" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-black text-gray-950">{item.label}</Text>
                  <Text className="mt-1 text-sm font-semibold text-gray-500">{item.address}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteAddress(item.id)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-red-50"
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
