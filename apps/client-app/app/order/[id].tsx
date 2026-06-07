import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
  canClientCancelOrder,
  COLLECTIONS,
  formatCurrencyUZS,
  getCourierVehicleType,
  getVehicleLabel,
  normalizeCoordinate,
  normalizeOrderStatus,
  Order,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
} from '@repo/shared-types';
import {
  db,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from '@repo/firebase-config';
import NativeOrderMap from '../../components/NativeOrderMap';

const TASHKENT = { latitude: 41.311081, longitude: 69.240562 };

const statusIcon = (status: string) => {
  switch (normalizeOrderStatus(status)) {
    case 'pending':
      return 'receipt-outline';
    case 'preparing':
      return 'restaurant-outline';
    case 'courier_picked_up':
      return 'bicycle-outline';
    case 'delivered':
      return 'checkmark-circle-outline';
    default:
      return 'ellipse-outline';
  }
};

export default function NativeOrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.ORDERS, id),
      (snapshot) => {
        if (snapshot.exists()) {
          setOrder({ id: snapshot.id, ...snapshot.data() } as Order);
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Native order listener failed:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const points = useMemo(() => {
    if (!order) return { restaurant: TASHKENT, customer: TASHKENT, courier: null as null | typeof TASHKENT };

    const restaurant = normalizeCoordinate(order.restaurantLocation) || TASHKENT;
    const customer =
      normalizeCoordinate((order as any).deliveryLocation) ||
      normalizeCoordinate((order as any).customerLocation) ||
      TASHKENT;
    const assigned = !!order.assignedCourier?.id;
    const courier = assigned ? normalizeCoordinate(order.courierLocation || (order as any).courier?.location) : null;

    return { restaurant, customer, courier };
  }, [order]);

  const cancelOrder = async () => {
    if (!order || !canClientCancelOrder(order.status)) return;

    setCancelling(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.ORDERS, order.id), {
        status: 'cancelled',
        cancelReason: 'Cancelled by customer',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Order cancelled', 'Your order has been cancelled.');
    } catch (error: any) {
      Alert.alert('Cancel failed', error?.message || 'Could not cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Ionicons name="receipt-outline" size={56} color="#d1d5db" />
        <Text className="mt-4 text-xl font-black text-gray-950">Order not found</Text>
      </View>
    );
  }

  const normalizedStatus = normalizeOrderStatus(order.status);
  const activeIndex = Math.max(ORDER_STATUS_FLOW.indexOf(normalizedStatus), 0);
  const vehicleType = getCourierVehicleType(null, order.assignedCourier);
  const vehicleIcon =
    vehicleType === 'car'
      ? 'car-outline'
      : vehicleType === 'foot'
        ? 'walk-outline'
        : vehicleType === 'motorcycle'
          ? 'speedometer-outline'
          : 'bicycle-outline';
  const courierPhone = order.assignedCourier?.phone || order.courierPhone || (order as any).courier?.phone;

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="bg-white px-4 pb-5 pt-4">
        <Text className="text-sm font-black uppercase tracking-widest text-orange-500">Live tracking</Text>
        <Text className="mt-1 text-3xl font-black text-gray-950">Order #{order.id.slice(0, 6).toUpperCase()}</Text>
        <Text className="mt-1 text-base font-semibold text-gray-500">{order.restaurantName}</Text>
      </View>

      <View className="mt-3 bg-white px-4 py-5">
        <View className="flex-row justify-between">
          {ORDER_STATUS_FLOW.map((status, index) => {
            const isActive = index <= activeIndex;
            return (
              <View key={status} className="flex-1 items-center">
                <View className={`h-11 w-11 items-center justify-center rounded-full ${isActive ? 'bg-orange-500' : 'bg-gray-100'}`}>
                  <Ionicons name={statusIcon(status) as any} size={20} color={isActive ? '#fff' : '#9ca3af'} />
                </View>
                <Text className={`mt-2 text-center text-[11px] font-black ${isActive ? 'text-gray-950' : 'text-gray-400'}`}>
                  {ORDER_STATUS_LABELS[status]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="mt-3 bg-white px-4 py-5">
        <View className="h-80 overflow-hidden rounded-3xl bg-gray-100">
          <NativeOrderMap
            restaurant={points.restaurant}
            customer={points.customer}
            courier={points.courier}
            restaurantName={order.restaurantName}
            customerAddress={(order as any).customerAddress || order.deliveryAddress}
            courierName={order.assignedCourier?.name || order.courierName || 'Courier'}
            vehicleIcon={vehicleIcon}
          />
        </View>
      </View>

      {!!order.assignedCourier?.id && (
        <View className="mx-4 mt-3 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
          <Text className="text-xs font-black uppercase tracking-widest text-gray-400">Your courier</Text>
          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-orange-50">
                <Ionicons name={vehicleIcon as any} size={26} color="#f97316" />
              </View>
              <View className="ml-3">
                <Text className="text-lg font-black text-gray-950">
                  {order.assignedCourier.name || order.courierName || 'Courier'}
                </Text>
                <Text className="mt-1 text-sm font-bold text-gray-500">{getVehicleLabel(vehicleType)}</Text>
              </View>
            </View>

            {!!courierPhone && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${courierPhone}`)}
                className="h-12 w-12 items-center justify-center rounded-full bg-emerald-500"
              >
                <Ionicons name="call" size={21} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View className="mx-4 mt-3 rounded-3xl bg-white p-5 shadow-sm shadow-black/5">
        <Text className="mb-4 text-lg font-black text-gray-950">Order details</Text>
        {order.items.map((item) => (
          <View key={item.id} className="mb-3 flex-row justify-between">
            <Text className="flex-1 text-sm font-bold text-gray-600">
              {item.quantity}x {item.name}
            </Text>
            <Text className="text-sm font-black text-gray-950">{formatCurrencyUZS(item.price * item.quantity)}</Text>
          </View>
        ))}
        <View className="mt-3 border-t border-gray-100 pt-3">
          <View className="flex-row justify-between">
            <Text className="font-bold text-gray-500">Delivery</Text>
            <Text className="font-black text-gray-950">{formatCurrencyUZS(order.deliveryFee)}</Text>
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-lg font-black text-gray-950">Total</Text>
            <Text className="text-lg font-black text-gray-950">{formatCurrencyUZS((order as any).totalAmount ?? (order as any).total)}</Text>
          </View>
        </View>
      </View>

      {canClientCancelOrder(order.status) && (
        <TouchableOpacity
          onPress={cancelOrder}
          disabled={cancelling}
          className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 py-4"
        >
          <Text className="text-center font-black text-red-600">{cancelling ? 'Cancelling...' : 'Cancel Order'}</Text>
        </TouchableOpacity>
      )}

      <View className="h-10" />
    </ScrollView>
  );
}
