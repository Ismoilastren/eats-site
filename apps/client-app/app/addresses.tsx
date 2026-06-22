import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  db,
  onSnapshot,
  setDoc,
} from '@repo/firebase-config';
import { COLLECTIONS } from '@repo/shared-types';
import { useAuth } from '../context/AuthContext';
import { clientUserDocumentPatch } from '../services/clientUserProfile';

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  isDefault?: boolean;
  source?: 'manual' | 'current_location' | 'map' | 'geocode';
};

function isReadableAddress(value: string) {
  const address = value.trim();
  if (address.length < 6) return false;
  return !/^(selected point|address could not be resolved|map is unavailable|enter readable address|current gps location|order delivery)/i.test(address);
}

export default function AddressesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openMap?: string }>();
  const { user, profile } = useAuth();
  const uid = user?.uid || profile?.uid || '';
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [label, setLabel] = useState('Home');
  const [addressText, setAddressText] = useState('');
  const [addressSource, setAddressSource] = useState<'manual' | 'current_location' | 'map' | 'geocode'>('manual');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Map Picker State
  const [showMap, setShowMap] = useState(params.openMap === 'true');
  const [mapRegion, setMapRegion] = useState({ latitude: 41.2995, longitude: 69.2401 });
  const [mapLoading, setMapLoading] = useState(false);
  const [mapResolvedAddress, setMapResolvedAddress] = useState('Move map to location');
  const webViewRef = useRef<WebView>(null);
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yandexMapHTML = (initialLat: number, initialLng: number) => {
    const apiKey = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY || '';
    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #1a1a1c; }
        #map { width: 100%; height: 100%; }
    </style>
    <script src="https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=en_RU" type="text/javascript"></script>
</head>
<body>
    <div id="map"></div>
    <script>
        ymaps.ready(init);
        var myMap;
        function init() {
            myMap = new ymaps.Map("map", {
                center: [${initialLat}, ${initialLng}],
                zoom: 16,
                controls: []
            });

            myMap.events.add('boundschange', function (e) {
                var center = e.get('newCenter');
                window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'move', lat: center[0], lng: center[1] }));
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'ready', lat: ${initialLat}, lng: ${initialLng} }));
        }

        window.updateCenter = function(lat, lng) {
            if (myMap) {
                myMap.setCenter([lat, lng], 16, { duration: 300 });
            }
        };
    </script>
</body>
</html>
  `;
  };

  useEffect(() => {
    if (params.openMap === 'true') {
      setShowMap(true);
    }
  }, [params.openMap]);

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
          const addr = { id: addressDoc.id, ...addressDoc.data() } as SavedAddress;
          if (isReadableAddress(addr.address)) {
            data.push(addr);
          }
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

  const fetchYandexAddress = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://eats-site-main-site.vercel.app';
      const response = await fetch(`${baseUrl}/api/geocode?lat=${latitude}&lng=${longitude}`);
      const data: any = await response.json();
      if (data.ok && data.results?.response?.GeoObjectCollection?.featureMember?.length > 0) {
        const addressDetails = data.results.response.GeoObjectCollection.featureMember[0].GeoObject;
        return addressDetails.name || addressDetails.description || 'Unknown location';
      }
      return 'Unknown location';
    } catch (error) {
      console.error('Yandex proxy geocode failed:', error instanceof Error ? error.message : String(error));
      return 'Unknown location';
    }
  };

  const resolveMapRegion = async (latitude: number, longitude: number) => {
    setMapRegion({ latitude, longitude });
    setMapLoading(true);

    if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current);

    resolveTimeoutRef.current = setTimeout(async () => {
      const resolved = await fetchYandexAddress(latitude, longitude);
      setMapResolvedAddress(resolved);
      setMapLoading(false);
    }, 800);
  };

  const onWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === 'move' || data.event === 'ready') {
        resolveMapRegion(data.lat, data.lng);
      }
    } catch (e) {
      console.warn('WebView message error:', e);
    }
  };

  const jumpToCurrentLocation = async () => {
    setMapLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Allow location access to find your current spot.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setMapRegion({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      // Tell webview to move map
      webViewRef.current?.injectJavaScript(`window.updateCenter(${current.coords.latitude}, ${current.coords.longitude}); true;`);
      const resolved = await fetchYandexAddress(current.coords.latitude, current.coords.longitude);
      setMapResolvedAddress(resolved);
    } catch (error) {
      console.error('GPS Jump failed:', error instanceof Error ? error.message : String(error));
      Alert.alert('Location error', 'Could not fetch your current GPS coordinates.');
    } finally {
      setMapLoading(false);
    }
  };

  const useCurrentLocation = async () => {
    setSaving(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Allow location access to save your current address.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const resolved = await fetchYandexAddress(current.coords.latitude, current.coords.longitude);

      if (!isReadableAddress(resolved)) {
        Alert.alert('Address unavailable', 'GPS was found, but a readable street address was not returned. Enter it manually.');
        return;
      }

      setAddressText(resolved);
      setLat(current.coords.latitude);
      setLng(current.coords.longitude);
      setAddressSource('current_location');
      Alert.alert('GPS Found', `Address resolved to: ${resolved}. Please save when ready.`);
    } catch (error) {
      console.error('Failed to read current address:', error instanceof Error ? error.message : String(error));
      Alert.alert('Location error', 'Could not read your current GPS location.');
    } finally {
      setSaving(false);
    }
  };

  const confirmMapLocation = () => {
    if (!isReadableAddress(mapResolvedAddress) || mapResolvedAddress === 'Unknown location' || mapResolvedAddress === 'Move map to location') {
      Alert.alert('Invalid location', 'Please select a readable street address.');
      return;
    }
    setAddressText(mapResolvedAddress);
    setLat(mapRegion.latitude);
    setLng(mapRegion.longitude);
    setAddressSource('map');
    setShowMap(false);
  };

  const saveAddress = async () => {
    if (!uid) {
      router.replace('/login');
      return;
    }

    const cleanAddress = addressText.trim();
    if (!cleanAddress) {
      Alert.alert('Address required', 'Enter an address or pick on map.');
      return;
    }
    if (!isReadableAddress(cleanAddress)) {
      Alert.alert('Readable address required', 'Please enter a real delivery address, not a coordinate or placeholder.');
      return;
    }

    setSaving(true);
    try {
      const isDefault = addresses.length === 0;
      const payload = {
        userId: uid,
        customerId: uid,
        label: label.trim() || 'Address',
        address: cleanAddress,
        source: addressSource,
        isDefault,
        ...(lat && lng ? { latitude: lat, longitude: lng } : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const addressRef = await addDoc(collection(db, COLLECTIONS.USERS, uid, 'addresses'), payload);
      await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        ...clientUserDocumentPatch(user, profile),
        savedAddresses: [
          ...addresses.map(({ id, ...address }) => ({ id, ...address })),
          { id: addressRef.id, ...payload },
        ],
        ...(isDefault ? { defaultAddress: cleanAddress, address: cleanAddress } : {}),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setLabel('Home');
      setAddressText('');
      setLat(undefined);
      setLng(undefined);
      setAddressSource('manual');
      Alert.alert('Saved', 'Address saved successfully.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to save address:', errorMessage);
      Alert.alert('Save failed', errorMessage || 'Could not save address.');
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
            const nextAddresses = addresses
              .filter((address) => address.id !== addressId)
              .map(({ id, ...address }) => ({ id, ...address }));
            await setDoc(doc(db, COLLECTIONS.USERS, uid), {
              ...clientUserDocumentPatch(user, profile),
              savedAddresses: nextAddresses,
              defaultAddress: nextAddresses.find((address) => address.isDefault)?.address || nextAddresses[0]?.address || '',
              address: nextAddresses.find((address) => address.isDefault)?.address || nextAddresses[0]?.address || '',
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to delete address:', errorMessage);
            Alert.alert('Delete failed', errorMessage || 'Could not delete address.');
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

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={(
          <View className="mb-6 rounded-3xl bg-white p-5 shadow-sm shadow-black/5 border border-gray-100">
            <Text className="mb-4 text-xl font-black text-gray-950">Add new address</Text>
            <View className="mb-4">
              <Text className="ml-1 mb-1.5 text-xs font-black uppercase text-gray-400">Label (e.g. Home, Work)</Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="Home"
                placeholderTextColor="#9ca3af"
                className="rounded-2xl bg-gray-50 px-4 py-3.5 text-base font-semibold text-gray-950 border border-gray-100"
              />
            </View>
            <View className="mb-4">
              <Text className="ml-1 mb-1.5 text-xs font-black uppercase text-gray-400">Address text</Text>
              <TextInput
                value={addressText}
                onChangeText={setAddressText}
                placeholder="Select on map or type manually"
                placeholderTextColor="#9ca3af"
                multiline
                className="min-h-24 rounded-2xl bg-gray-50 px-4 py-3.5 text-base font-semibold text-gray-950 border border-gray-100"
              />
            </View>
            <View className="flex-row flex-wrap gap-3">
              <TouchableOpacity
                onPress={useCurrentLocation}
                disabled={saving}
                activeOpacity={0.85}
                className="flex-1 min-w-[120px] flex-row items-center justify-center rounded-2xl bg-[#f9d923] py-3.5"
              >
                <Ionicons name="navigate" size={18} color="#111827" />
                <Text className="ml-2 font-black text-gray-950">Use GPS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowMap(true)}
                disabled={saving}
                activeOpacity={0.85}
                className="flex-1 min-w-[120px] flex-row items-center justify-center rounded-2xl bg-gray-950 py-3.5"
              >
                <Ionicons name="map-outline" size={18} color="#fff" />
                <Text className="ml-2 font-black text-white">Pick on map</Text>
              </TouchableOpacity>
            </View>
            {addressText.length > 5 && (
              <TouchableOpacity
                onPress={saveAddress}
                disabled={saving}
                activeOpacity={0.85}
                className="mt-4 w-full items-center justify-center rounded-2xl bg-orange-500 py-3.5"
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-black text-white text-base">Save Address</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View className="py-10 items-center justify-center">
              <ActivityIndicator color="#f97316" size="large" />
            </View>
          ) : (
            <View className="py-10 items-center justify-center px-6">
              <Ionicons name="location-outline" size={64} color="#d1d5db" />
              <Text className="mt-4 text-xl font-black text-gray-950">No saved addresses</Text>
              <Text className="mt-2 text-center font-semibold text-gray-500">Save your delivery locations above.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View className="mb-3 rounded-3xl bg-white p-4 shadow-sm shadow-black/5 border border-gray-100">
            <View className="flex-row items-start">
              <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-orange-50">
                <Ionicons name={item.isDefault ? "home" : "location"} size={22} color="#f97316" />
              </View>
              <View className="flex-1 pr-2 pt-1">
                <Text className="text-base font-black text-gray-950">{item.label}</Text>
                <Text className="mt-1 text-sm font-semibold text-gray-500">{item.address}</Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteAddress(item.id)}
                className="h-10 w-10 items-center justify-center rounded-full bg-red-50 mt-1"
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={showMap} animationType="slide" transparent>
        <View className="flex-1 bg-[#1a1a1c]">
          <WebView
            ref={webViewRef}
            style={{ flex: 1, backgroundColor: '#1a1a1c' }}
            source={{ html: yandexMapHTML(mapRegion.latitude, mapRegion.longitude) }}
            onMessage={onWebViewMessage}
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
          {/* Transparent Gradient Overlay at Top */}
          <View className="absolute top-0 w-full h-40 bg-black/40" pointerEvents="none" />

          <SafeAreaView className="absolute top-0 w-full flex-row justify-between px-5 pt-4">
            <TouchableOpacity onPress={() => setShowMap(false)} className="h-12 w-12 items-center justify-center rounded-full bg-[#202022] shadow-xl border border-white/10">
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity className="h-12 w-12 items-center justify-center rounded-full bg-[#202022] shadow-xl border border-white/10">
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <SafeAreaView className="absolute top-24 w-full px-8 pointer-events-none items-center">
            <View className="rounded-2xl bg-black/80 px-6 py-4 shadow-xl border border-white/10 w-full">
              <Text className="text-xl font-black text-white text-center" numberOfLines={2}>
                {mapLoading ? 'Locating...' : mapResolvedAddress}
              </Text>
            </View>
          </SafeAreaView>

          {/* Custom Yandex-style Pin Overlay */}
          <View className="absolute top-1/2 left-1/2 -ml-4 -mt-10 items-center" pointerEvents="none">
            <View className="h-10 w-10 rounded-full bg-[#f97316] items-center justify-center shadow-lg border-4 border-white">
              <View className="h-2 w-2 rounded-full bg-white" />
            </View>
            <View className="h-4 w-1 bg-white/80 rounded-b-sm" />
            <View className="h-2 w-4 rounded-full bg-black/30 mt-0.5" />
          </View>

          {/* Floating Actions */}
          <View className="absolute right-5 bottom-36 gap-3">
            <TouchableOpacity onPress={jumpToCurrentLocation} className="h-14 w-14 items-center justify-center rounded-full bg-white shadow-xl border border-gray-100">
              <Ionicons name="navigate" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Sticky Done Button */}
          <SafeAreaView className="absolute bottom-0 w-full bg-[#1a1a1c] p-5 pb-8 rounded-t-3xl border-t border-white/10">
            <TouchableOpacity
              onPress={confirmMapLocation}
              disabled={mapLoading || !isReadableAddress(mapResolvedAddress)}
              activeOpacity={0.85}
              className={`w-full items-center justify-center rounded-2xl py-4 ${mapLoading || !isReadableAddress(mapResolvedAddress) ? 'bg-[#f9d923]/40' : 'bg-[#f9d923]'}`}
            >
              {saving ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text className={`font-black text-lg ${mapLoading || !isReadableAddress(mapResolvedAddress) ? 'text-gray-600' : 'text-gray-950'}`}>Done</Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
