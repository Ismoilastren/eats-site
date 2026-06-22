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
import {
  AddressSource,
  CanonicalSavedAddress,
  DEFAULT_MAP_CENTER,
  GeocodeAddressResult,
  canonicalAddressForStorage,
  geocodeQueryViaProxy,
  isReadableAddress,
  missingYandexMapsKeyMessage,
  publicYandexMapsApiKey,
  reverseGeocodeViaProxy,
} from '../services/addressing';

type SavedAddress = CanonicalSavedAddress & { latitude?: number; longitude?: number };
type MapResolveState = 'idle' | 'moving' | 'resolving' | 'resolved' | 'failed';

const GPS_TIMEOUT_MS = 12000;
const MAP_RESOLVE_DEBOUNCE_MS = 850;

export default function AddressesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openMap?: string }>();
  const { user, profile } = useAuth();
  const uid = user?.uid || profile?.uid || '';
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [label, setLabel] = useState('Home');
  const [addressText, setAddressText] = useState('');
  const [addressSource, setAddressSource] = useState<AddressSource>('manual');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Map Picker State
  const [showMap, setShowMap] = useState(params.openMap === 'true');
  const [mapRegion, setMapRegion] = useState(DEFAULT_MAP_CENTER);
  const [mapResolveState, setMapResolveState] = useState<MapResolveState>('idle');
  const [mapResolvedAddress, setMapResolvedAddress] = useState('');
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [mapSearchResults, setMapSearchResults] = useState<GeocodeAddressResult[]>([]);
  const [manualMapAddress, setManualMapAddress] = useState('');
  const [usingGps, setUsingGps] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRequestRef = useRef(0);

  const selectedMapAddress = isReadableAddress(mapResolvedAddress)
    ? mapResolvedAddress
    : isReadableAddress(manualMapAddress)
      ? manualMapAddress.trim()
      : '';
  const canConfirmMap =
    Boolean(selectedMapAddress) &&
    (mapResolveState === 'resolved' || (mapResolveState === 'failed' && isReadableAddress(manualMapAddress)));
  const mapBusy = mapResolveState === 'moving' || mapResolveState === 'resolving' || usingGps;
  const mapStatusText =
    mapResolveState === 'moving'
      ? 'Move map to choose address'
      : mapResolveState === 'resolving'
        ? 'Resolving address...'
        : mapResolveState === 'resolved'
          ? mapResolvedAddress
          : mapResolveState === 'failed'
            ? 'Address lookup failed. Try again or enter manually.'
            : 'Move the map or search for your address';

  const yandexMapHTML = (initialLat: number, initialLng: number) => {
    const apiKey = encodeURIComponent(publicYandexMapsApiKey());
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
        var myMap;
        var suppressMoveUntil = 0;
        if (!window.ymaps) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'error', message: 'Yandex Maps script failed to load.' }));
        } else {
            ymaps.ready(init);
        }
        function init() {
            myMap = new ymaps.Map("map", {
                center: [${initialLat}, ${initialLng}],
                zoom: 16,
                controls: []
            });

            myMap.events.add('boundschange', function (e) {
                if (Date.now() < suppressMoveUntil) return;
                var center = e.get('newCenter');
                window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'move', lat: center[0], lng: center[1] }));
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ event: 'ready', lat: ${initialLat}, lng: ${initialLng} }));
        }

        window.updateCenter = function(lat, lng, skipMoveEvent) {
            if (myMap) {
                if (skipMoveEvent) suppressMoveUntil = Date.now() + 1200;
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
      resetMapSelection();
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

  const getCurrentPositionWithTimeout = async (accuracy: Location.Accuracy) =>
    Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('GPS timed out. Try again in an open area.')), GPS_TIMEOUT_MS);
      }),
    ]);

  const resetMapSelection = () => {
    setMapResolveState('idle');
    setMapResolvedAddress('');
    setMapError(null);
    setManualMapAddress('');
    setMapSearch('');
    setMapSearchResults([]);
  };

  const resolveMapRegion = (latitude: number, longitude: number) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMapResolveState('failed');
      setMapError('Selected coordinates are invalid.');
      setMapResolvedAddress('');
      return;
    }

    setMapRegion({ latitude, longitude });
    setMapResolveState('moving');
    setMapError(null);
    setMapResolvedAddress('');

    if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current);

    resolveTimeoutRef.current = setTimeout(async () => {
      const requestId = ++resolveRequestRef.current;
      setMapResolveState('resolving');
      try {
        const { result, error } = await reverseGeocodeViaProxy(latitude, longitude);
        if (requestId !== resolveRequestRef.current) return;

        if (result && isReadableAddress(result.address)) {
          setMapResolvedAddress(result.address);
          setManualMapAddress('');
          setMapError(null);
          setMapResolveState('resolved');
          return;
        }

        setMapResolvedAddress('');
        setMapError(error || 'Address lookup failed. Try again or enter manually.');
        setMapResolveState('failed');
      } catch {
        if (requestId !== resolveRequestRef.current) return;
        setMapResolvedAddress('');
        setMapError('Address lookup failed. Try again or enter manually.');
        setMapResolveState('failed');
      }
    }, MAP_RESOLVE_DEBOUNCE_MS);
  };

  const onWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.event === 'move' || data.event === 'ready') {
        resolveMapRegion(data.lat, data.lng);
      } else if (data.event === 'error') {
        setMapError(data.message || 'Yandex map could not be loaded.');
        setMapResolveState('failed');
      }
    } catch (e) {
      console.warn('WebView message error:', e);
    }
  };

  const jumpToCurrentLocation = async () => {
    setUsingGps(true);
    setMapError(null);
    try {
      if (!publicYandexMapsApiKey()) {
        setMapError(missingYandexMapsKeyMessage());
        setMapResolveState('failed');
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setMapError('Location permission was denied.');
        setMapResolveState('failed');
        Alert.alert('Location required', 'Allow location access to find your current spot.');
        return;
      }
      const current = await getCurrentPositionWithTimeout(Location.Accuracy.High);
      setMapRegion({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      // Tell webview to move map
      webViewRef.current?.injectJavaScript(`window.updateCenter(${current.coords.latitude}, ${current.coords.longitude}, true); true;`);
      resolveMapRegion(current.coords.latitude, current.coords.longitude);
    } catch (error) {
      console.error('GPS Jump failed:', error instanceof Error ? error.message : String(error));
      const message = error instanceof Error ? error.message : 'Could not fetch your current GPS coordinates.';
      setMapError(message);
      setMapResolveState('failed');
      Alert.alert('Location error', message);
    } finally {
      setUsingGps(false);
    }
  };

  const searchMapAddress = async () => {
    const query = mapSearch.trim();
    if (query.length < 3) {
      setMapError('Enter at least 3 characters to search.');
      return;
    }

    setMapSearching(true);
    setMapError(null);
    setMapSearchResults([]);
    try {
      const { results, error } = await geocodeQueryViaProxy(query);
      if (results.length === 0) {
        setMapError(error || 'No readable address found.');
        setMapResolveState('failed');
        return;
      }

      setMapSearchResults(results);
      const result = results[0];
      setMapRegion({ latitude: result.lat, longitude: result.lng });
      setMapResolvedAddress(result.address);
      setManualMapAddress('');
      setMapResolveState('resolved');
      webViewRef.current?.injectJavaScript(`window.updateCenter(${result.lat}, ${result.lng}, true); true;`);
    } finally {
      setMapSearching(false);
    }
  };

  const chooseSearchResult = (result: GeocodeAddressResult) => {
    setMapRegion({ latitude: result.lat, longitude: result.lng });
    setMapResolvedAddress(result.address);
    setManualMapAddress('');
    setMapError(null);
    setMapResolveState('resolved');
    setMapSearchResults([]);
    setMapSearch(result.address);
    webViewRef.current?.injectJavaScript(`window.updateCenter(${result.lat}, ${result.lng}, true); true;`);
  };

  const retryMapResolve = () => {
    resolveMapRegion(mapRegion.latitude, mapRegion.longitude);
  };

  const openMapPicker = () => {
    resetMapSelection();
    setShowMap(true);
  };

  const closeMapPicker = () => {
    if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current);
    setShowMap(false);
  };

  const useCurrentLocation = async () => {
    setSaving(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Allow location access to save your current address.');
        return;
      }

      const current = await getCurrentPositionWithTimeout(Location.Accuracy.High);
      const { result, error } = await reverseGeocodeViaProxy(current.coords.latitude, current.coords.longitude);

      if (!result || !isReadableAddress(result.address)) {
        Alert.alert('Address unavailable', error || 'GPS was found, but a readable street address was not returned. Enter it manually.');
        return;
      }

      setAddressText(result.address);
      setLat(result.lat);
      setLng(result.lng);
      setAddressSource('current_location');
      Alert.alert('GPS Found', `Address resolved to: ${result.address}. Please save when ready.`);
    } catch (error) {
      console.error('Failed to read current address:', error instanceof Error ? error.message : String(error));
      Alert.alert('Location error', 'Could not read your current GPS location.');
    } finally {
      setSaving(false);
    }
  };

  const confirmMapLocation = () => {
    if (!isReadableAddress(mapResolvedAddress)) {
      if (!isReadableAddress(manualMapAddress)) {
        Alert.alert('Invalid location', 'Please select a readable street address or enter it manually.');
        return;
      }
    }
    if (!canConfirmMap) {
      Alert.alert('Address not ready', 'Wait for address lookup to finish, retry, or enter the address manually.');
      return;
    }
    setAddressText(selectedMapAddress);
    setLat(mapRegion.latitude);
    setLng(mapRegion.longitude);
    setAddressSource(isReadableAddress(mapResolvedAddress) ? 'map' : 'manual');
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
      const isDefault = true;
      const addressLat = Number(lat);
      const addressLng = Number(lng);
      if (!Number.isFinite(addressLat) || !Number.isFinite(addressLng)) {
        Alert.alert('Location required', 'Pick this address on the map or use GPS so delivery coordinates are saved.');
        return;
      }

      const now = new Date().toISOString();
      const payload = {
        userId: uid,
        label: label.trim() || 'Address',
        address: cleanAddress,
        lat: addressLat,
        lng: addressLng,
        source: addressSource,
        isDefault,
        createdAt: now,
        updatedAt: now,
      };

      const addressRef = await addDoc(collection(db, COLLECTIONS.USERS, uid, 'addresses'), payload);
      const existingSavedAddresses = addresses
        .map((address) => canonicalAddressForStorage({ ...address, isDefault: false }, uid, now))
        .filter((address): address is NonNullable<typeof address> => Boolean(address));
      await Promise.all(
        addresses.map((address) =>
          setDoc(
            doc(db, COLLECTIONS.USERS, uid, 'addresses', address.id),
            { isDefault: false, updatedAt: now },
            { merge: true },
          )
        )
      );
      await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        ...clientUserDocumentPatch(user, profile),
        savedAddresses: [
          ...existingSavedAddresses,
          { id: addressRef.id, ...payload },
        ],
        defaultAddress: cleanAddress,
        address: cleanAddress,
        updatedAt: now,
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
            const now = new Date().toISOString();
            const nextAddresses = addresses
              .filter((address) => address.id !== addressId)
              .map((address) => canonicalAddressForStorage(address, uid, now))
              .filter((address): address is NonNullable<typeof address> => Boolean(address));
            await setDoc(doc(db, COLLECTIONS.USERS, uid), {
              ...clientUserDocumentPatch(user, profile),
              savedAddresses: nextAddresses,
              defaultAddress: nextAddresses.find((address) => address.isDefault)?.address || nextAddresses[0]?.address || '',
              address: nextAddresses.find((address) => address.isDefault)?.address || nextAddresses[0]?.address || '',
              updatedAt: now,
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
                onChangeText={(value) => {
                  setAddressText(value);
                  setLat(undefined);
                  setLng(undefined);
                  setAddressSource('manual');
                }}
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
                onPress={openMapPicker}
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
          {publicYandexMapsApiKey() ? (
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
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="map-outline" size={64} color="#f9d923" />
              <Text className="mt-5 text-center text-xl font-black text-white">Map unavailable</Text>
              <Text className="mt-2 text-center font-semibold text-gray-400">{missingYandexMapsKeyMessage()}</Text>
            </View>
          )}
          {/* Transparent Gradient Overlay at Top */}
          <View className="absolute top-0 w-full h-40 bg-black/40" pointerEvents="none" />

          <SafeAreaView className="absolute top-0 w-full flex-row justify-between px-5 pt-4">
            <TouchableOpacity onPress={closeMapPicker} className="h-12 w-12 items-center justify-center rounded-full bg-[#202022] shadow-xl border border-white/10">
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <View className="ml-3 flex-1 flex-row items-center rounded-full bg-[#202022] px-4 border border-white/10">
              <Ionicons name="search" size={18} color="#fff" />
              <TextInput
                value={mapSearch}
                onChangeText={setMapSearch}
                onSubmitEditing={searchMapAddress}
                placeholder="Search address"
                placeholderTextColor="#9ca3af"
                returnKeyType="search"
                className="ml-2 flex-1 py-3 font-bold text-white"
              />
              <TouchableOpacity onPress={searchMapAddress} disabled={mapSearching} className="h-8 w-8 items-center justify-center">
                {mapSearching ? <ActivityIndicator color="#f9d923" size="small" /> : <Ionicons name="arrow-forward" size={18} color="#f9d923" />}
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <SafeAreaView className="absolute top-28 w-full px-5 items-center">
            <View className="rounded-2xl bg-black/85 px-4 py-3 shadow-xl border border-white/10 w-full">
              <Text className="text-base font-black text-white text-center" numberOfLines={3}>
                {mapStatusText}
              </Text>
              {!!mapError && (
                <Text className="mt-2 text-center text-xs font-bold text-[#f9d923]" numberOfLines={3}>
                  {mapError}
                </Text>
              )}
              {mapResolveState === 'failed' && (
                <View className="mt-3">
                  <TextInput
                    value={manualMapAddress}
                    onChangeText={setManualMapAddress}
                    placeholder="Enter readable address manually"
                    placeholderTextColor="#9ca3af"
                    className="rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-gray-950"
                    multiline
                  />
                  <TouchableOpacity
                    onPress={retryMapResolve}
                    className="mt-2 flex-row items-center justify-center rounded-xl bg-white/10 py-2.5"
                  >
                    <Ionicons name="refresh" size={16} color="#f9d923" />
                    <Text className="ml-2 text-sm font-black text-[#f9d923]">Try again</Text>
                  </TouchableOpacity>
                </View>
              )}
              {mapSearchResults.length > 1 && (
                <View className="mt-3 overflow-hidden rounded-xl bg-white">
                  {mapSearchResults.slice(0, 4).map((result) => (
                    <TouchableOpacity
                      key={`${result.lat}-${result.lng}-${result.address}`}
                      onPress={() => chooseSearchResult(result)}
                      className="border-b border-gray-100 px-3 py-2.5 last:border-b-0"
                    >
                      <Text className="text-sm font-black text-gray-950" numberOfLines={1}>
                        {result.title || result.address}
                      </Text>
                      <Text className="mt-0.5 text-xs font-semibold text-gray-500" numberOfLines={1}>
                        {result.address}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
              disabled={mapBusy || !canConfirmMap}
              activeOpacity={0.85}
              className={`w-full items-center justify-center rounded-2xl py-4 ${mapBusy || !canConfirmMap ? 'bg-[#f9d923]/40' : 'bg-[#f9d923]'}`}
            >
              {mapBusy ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text className={`font-black text-lg ${mapBusy || !canConfirmMap ? 'text-gray-600' : 'text-gray-950'}`}>
                  {mapResolveState === 'failed' && !isReadableAddress(manualMapAddress) ? 'Enter address to continue' : 'Done'}
                </Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
