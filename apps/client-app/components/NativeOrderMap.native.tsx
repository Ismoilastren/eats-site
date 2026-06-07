import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { NormalizedCoordinate } from '@repo/shared-types';

interface NativeOrderMapProps {
  restaurant: NormalizedCoordinate;
  customer: NormalizedCoordinate;
  courier?: NormalizedCoordinate | null;
  restaurantName: string;
  customerAddress: string;
  courierName?: string;
  vehicleIcon: string;
}

export default function NativeOrderMap({
  restaurant,
  customer,
  courier,
  restaurantName,
  customerAddress,
  courierName,
  vehicleIcon,
}: NativeOrderMapProps) {
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    const coordinates = [restaurant, customer, courier].filter(Boolean) as NormalizedCoordinate[];
    if (coordinates.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 70, right: 50, bottom: 70, left: 50 },
        animated: false,
      });
    }, 350);
  }, [
    restaurant.latitude,
    restaurant.longitude,
    customer.latitude,
    customer.longitude,
    courier?.latitude,
    courier?.longitude,
  ]);

  const region: Region = {
    latitude: customer.latitude,
    longitude: customer.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={region} showsUserLocation={false}>
      <Marker coordinate={restaurant} title="Restaurant" description={restaurantName}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-600 border-2 border-white">
          <Ionicons name="restaurant" size={20} color="#fff" />
        </View>
      </Marker>

      <Marker coordinate={customer} title="Customer" description={customerAddress}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-600 border-2 border-white">
          <Ionicons name="home" size={20} color="#fff" />
        </View>
      </Marker>

      {courier && (
        <Marker coordinate={courier} title="Courier" description={courierName || 'Courier'}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-500 border-2 border-white">
            <Ionicons name={vehicleIcon as any} size={22} color="#fff" />
          </View>
        </Marker>
      )}

      <Polyline
        coordinates={[restaurant, customer]}
        strokeColor="#f97316"
        strokeWidth={5}
        lineDashPattern={[10, 8]}
      />
    </MapView>
  );
}
