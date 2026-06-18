import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  db,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from '@repo/firebase-config';
import {
  COLLECTIONS,
  isTerminalOrderStatus,
  normalizeCoordinate,
  normalizeOrderStatus,
  type NormalizedCoordinate,
  type Order,
} from '@repo/shared-types';

const TASHKENT_CENTER: NormalizedCoordinate = {
  latitude: 41.311081,
  longitude: 69.240562,
};

const TASHKENT_CUSTOMER_FALLBACK: NormalizedCoordinate = {
  latitude: 41.318081,
  longitude: 69.252562,
};

const getMapRegion = (
  first: NormalizedCoordinate,
  second: NormalizedCoordinate
) => {
  const minLat = Math.min(first.latitude, second.latitude);
  const maxLat = Math.max(first.latitude, second.latitude);
  const minLng = Math.min(first.longitude, second.longitude);
  const maxLng = Math.max(first.longitude, second.longitude);

  return {
    latitude: (first.latitude + second.latitude) / 2,
    longitude: (first.longitude + second.longitude) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.4, 0.025),
    longitudeDelta: Math.max((maxLng - minLng) * 2.4, 0.025),
  };
};

export default function ActiveDeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const orderRef = doc(db, COLLECTIONS.ORDERS, id);
    const unsubscribe = onSnapshot(
      orderRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        }
      },
      (error) => {
        if (__DEV__) console.warn('active-delivery-order-sync', error);
        setLocationError('Unable to sync this delivery. Check courier permissions.');
      }
    );
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!order || isTerminalOrderStatus(order.status)) return;

    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        async (location) => {
          try {
            const orderRef = doc(db, COLLECTIONS.ORDERS, id);
            await updateDoc(orderRef, {
              courierLocation: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                heading: location.coords.heading ?? 0,
                speed: location.coords.speed ?? 0,
              },
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            if (__DEV__) console.warn('active-delivery-location-sync', error);
            setLocationError('Courier GPS could not be synced to the order.');
          }
        }
      );
    };

    startTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [order?.status, id]);

  const markDelivered = async () => {
    if (!order || normalizeOrderStatus(order.status) !== 'on_the_way') return;
    try {
      const orderRef = doc(db, COLLECTIONS.ORDERS, id);
      const assignedCourierId = order.assignedCourier?.id || order.courierId;
      if (!assignedCourierId) throw new Error('Courier is missing for this delivery');
      const courierRef = doc(db, COLLECTIONS.COURIERS, assignedCourierId);

      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order no longer exists');

        const orderData = orderSnap.data() as Order;
        if (normalizeOrderStatus(orderData.status) === 'delivered') {
          throw new Error('Order was already delivered');
        }
        if (normalizeOrderStatus(orderData.status) !== 'on_the_way') {
          throw new Error('Order is not ready to be delivered');
        }

        transaction.update(orderRef, {
          status: 'delivered',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(courierRef, {
          currentOrderId: null,
          status: 'online',
          isOnline: true,
          isAvailable: true,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark delivery as delivered.';
      setLocationError(message);
      Alert.alert('Delivery update failed', message);
    }
  };


  const advanceStatus = async () => {
    if (!order) return;
    const currentStatus = normalizeOrderStatus(order.status);
    if (currentStatus === 'on_the_way') {
      await markDelivered();
      return;
    }
    const nextStatus =
      currentStatus === 'ready_for_pickup'
        ? 'picked_up'
        : currentStatus === 'picked_up'
          ? 'on_the_way'
          : null;
    if (!nextStatus) return;

    try {
      await updateDoc(doc(db, COLLECTIONS.ORDERS, id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update delivery status.';
      setLocationError(message);
      Alert.alert('Delivery update failed', message);
    }
  };

  if (!order) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }
  const normalizedStatus = normalizeOrderStatus(order.status);
  const canAdvance = ['ready_for_pickup', 'picked_up', 'on_the_way'].includes(normalizedStatus);
  const actionLabel =
    normalizedStatus === 'ready_for_pickup'
        ? 'PICKED UP'
        : normalizedStatus === 'picked_up'
          ? 'START DELIVERY'
          : normalizedStatus === 'on_the_way'
            ? 'DELIVERED'
            : 'WAITING';
  const restaurantLocation =
    normalizeCoordinate(order.restaurantLocation) || TASHKENT_CENTER;
  const customerLocation =
    normalizeCoordinate(order.deliveryLocation) || TASHKENT_CUSTOMER_FALLBACK;
  const courierLocation = normalizeCoordinate(order.courierLocation);
  const mapRoute =
    normalizedStatus === 'ready_for_pickup'
      ? courierLocation
        ? [courierLocation, restaurantLocation]
        : [restaurantLocation, customerLocation]
      : ['picked_up', 'on_the_way'].includes(normalizedStatus)
        ? [courierLocation || restaurantLocation, customerLocation]
        : [restaurantLocation, customerLocation];
  const initialRegion = getMapRegion(mapRoute[0], mapRoute[mapRoute.length - 1]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 py-4 bg-white shadow-sm flex-row items-center z-10 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-3 bg-gray-100 rounded-full hover:bg-gray-200">
          <Ionicons name="arrow-back" size={28} color="#374151" />
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-black text-gray-900 tracking-wide">ACTIVE DELIVERY</Text>
          <Text className="text-gray-500 font-bold text-lg mt-1">#{order.id.substring(0, 5).toUpperCase()}</Text>
        </View>
      </View>

      <View className="flex-1 p-6">
        <View className="mb-6 overflow-hidden rounded-3xl border-2 border-blue-200 bg-blue-50 shadow-sm">
          <View className="px-5 pt-5">
            <Text className="text-blue-800 font-black text-xl uppercase tracking-wider">Live delivery map</Text>
            <Text className="mt-1 text-blue-600 font-bold">
              Tracking line uses the available restaurant, customer, and courier GPS points.
            </Text>
          </View>
          <View className="m-5 h-72 overflow-hidden rounded-2xl border border-blue-100 bg-slate-200">
            <MapView
              style={{ flex: 1 }}
              initialRegion={initialRegion}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={restaurantLocation} title={order.restaurantName || 'Restaurant'}>
                <View className="h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-orange-500">
                  <Ionicons name="restaurant" size={17} color="white" />
                </View>
              </Marker>
              <Marker coordinate={customerLocation} title={order.customerName || 'Customer'}>
                <View className="h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                  <Ionicons name="home" size={17} color="white" />
                </View>
              </Marker>
              {courierLocation ? (
                <Marker coordinate={courierLocation} title="Courier">
                  <View className="h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-600">
                    <Ionicons name="navigate" size={17} color="white" />
                  </View>
                </Marker>
              ) : null}
              {mapRoute.length >= 2 ? (
                <Polyline
                  coordinates={mapRoute}
                  strokeColor="#2563EB"
                  strokeWidth={5}
                  lineDashPattern={[8, 8]}
                />
              ) : null}
            </MapView>
          </View>
          {locationError && (
            <Text className="mx-5 mb-5 rounded-xl bg-red-50 p-3 text-red-600 font-bold">
              {locationError}
            </Text>
          )}
        </View>

        <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
           <Text className="text-gray-400 font-black uppercase tracking-widest text-sm mb-2">Pickup From</Text>
           <Text className="text-3xl font-black text-gray-900">{order.restaurantName || 'Restaurant'}</Text>
           <Text className="text-sm text-gray-500 font-bold mt-2 uppercase">{normalizedStatus.replace('_', ' ')}</Text>
           
           <View className="h-px bg-gray-200 my-6" />
           
           <Text className="text-gray-400 font-black uppercase tracking-widest text-sm mb-2">Deliver To</Text>
           <Text className="text-3xl font-black text-gray-900">{order.customerName}</Text>
           <Text className="text-xl text-gray-600 font-bold mt-2 leading-relaxed">{order.deliveryAddress}</Text>
           {order.customerPhone && (
             <TouchableOpacity className="flex-row items-center mt-5 bg-green-50 p-4 rounded-2xl border border-green-200 shadow-sm">
               <Ionicons name="call" size={24} color="#16A34A" />
               <Text className="text-green-700 font-black text-2xl ml-3 tracking-widest">{order.customerPhone}</Text>
             </TouchableOpacity>
           )}
        </View>

        <View className="flex-1 justify-end pb-8">
           <TouchableOpacity 
             onPress={advanceStatus}
             disabled={!canAdvance}
             className={`${canAdvance ? 'bg-green-500 border-green-700' : 'bg-gray-400 border-gray-600'} p-6 rounded-3xl shadow-xl items-center justify-center flex-row border-b-4`}
           >
             <Ionicons name="checkmark-done-circle" size={36} color="white" />
             <Text className="text-white font-black text-3xl uppercase tracking-widest ml-4">
               {actionLabel}
             </Text>
           </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
