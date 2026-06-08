import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  COLLECTIONS,
  formatCurrencyUZS,
  formatFirestoreDate,
  isTerminalOrderStatus,
  normalizeOrderStatus,
  Order,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from '@repo/shared-types';
import { collection, db, onSnapshot, query, where } from '@repo/firebase-config';
import { useAuth } from '../../context/AuthContext';

function statusBadge(status: string) {
  const normalized = normalizeOrderStatus(status);
  const color = ORDER_STATUS_COLORS[normalized];
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${color}18` }}>
      <Text className="text-xs font-black" style={{ color }}>
        {ORDER_STATUS_LABELS[normalized]}
      </Text>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) {
      setOrders([]);
      setLoading(initializing);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.ORDERS), where('userId', '==', uid)),
      (snapshot) => {
          const data: Order[] = [];
        snapshot.forEach((orderDoc) => {
          data.push({ id: orderDoc.id, ...orderDoc.data() } as Order);
        });
        data.sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
          return bTime - aTime;
        });
        setOrders(data);
        setLoading(false);
      },
      (error) => {
        console.error('Client orders listener failed:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [initializing, uid]);

  const activeOrders = useMemo(() => orders.filter((order) => !isTerminalOrderStatus(order.status)), [orders]);
  const pastOrders = useMemo(() => orders.filter((order) => isTerminalOrderStatus(order.status)), [orders]);
  const listData = [...activeOrders, ...pastOrders];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pb-4 pt-3">
        <Text className="text-3xl font-black text-gray-950">Orders</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : !user ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="person-circle-outline" size={64} color="#d1d5db" />
          <Text className="mt-4 text-xl font-black text-gray-950">Login required</Text>
          <Text className="mt-2 text-center font-semibold text-gray-500">Sign in to see your order history.</Text>
          <TouchableOpacity onPress={() => router.replace('/login')} className="mt-6 rounded-full bg-orange-500 px-8 py-4">
            <Text className="font-black text-white">Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : listData.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
          <Text className="mt-4 text-xl font-black text-gray-950">No orders yet</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} className="mt-6 rounded-full bg-orange-500 px-8 py-4">
            <Text className="font-black text-white">Browse restaurants</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/order/${item.id}`)}
              className="mb-3 rounded-3xl bg-white p-4 shadow-sm shadow-black/5"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-lg font-black text-gray-950" numberOfLines={1}>
                    {item.restaurantName}
                  </Text>
                  <Text className="mt-1 text-sm font-semibold text-gray-500">
                    {(item.items || []).reduce((sum, orderItem) => sum + Number(orderItem.quantity || 0), 0)} items •{' '}
                    {formatCurrencyUZS((item as any).totalAmount ?? (item as any).total)}
                  </Text>
                  <Text className="mt-1 text-xs font-semibold text-gray-400">
                    {formatFirestoreDate((item as any).createdAt)}
                  </Text>
                </View>
                {statusBadge(item.status)}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
