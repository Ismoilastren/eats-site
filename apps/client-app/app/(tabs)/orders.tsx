import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { collection, db, onSnapshot, query, where, type Query } from '@repo/firebase-config';
import { useAuth } from '../../context/AuthContext';

type OrderTab = 'active' | 'history';

function orderTime(order: Order) {
  const createdAt = order.createdAt as any;
  return createdAt?.toMillis?.() ?? (createdAt?.seconds ? createdAt.seconds * 1000 : 0);
}

function statusBadge(status: string) {
  const normalized = normalizeOrderStatus(status);
  const color = ORDER_STATUS_COLORS[normalized] || '#6b7280';
  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${color}18` }}>
      <Text className="text-xs font-black" style={{ color }}>
        {ORDER_STATUS_LABELS[normalized] || status}
      </Text>
    </View>
  );
}

function LoadingCards() {
  return (
    <View className="px-5 pt-5">
      {[1, 2, 3].map((item) => (
        <View key={item} className="mb-4 rounded-[28px] bg-white p-5 shadow-sm shadow-black/5">
          <View className="h-5 w-36 rounded-full bg-orange-100" />
          <View className="mt-4 h-4 w-52 rounded-full bg-gray-100" />
          <View className="mt-6 h-12 rounded-2xl bg-gray-100" />
        </View>
      ))}
      <Text className="mt-2 text-center font-bold text-gray-400">Loading orders...</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user, profile, initializing } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [tab, setTab] = useState<OrderTab>('active');
  const customerEmail = user?.email || profile?.email || '';
  const uid = user?.uid || profile?.uid || '';

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 4000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (initializing) {
      setLoading(true);
      return;
    }

    if (!uid && !customerEmail) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setQueryError(null);

    const queries: Query[] = [];
    if (uid) queries.push(query(collection(db, COLLECTIONS.ORDERS), where('userId', '==', uid)));
    if (customerEmail) queries.push(query(collection(db, COLLECTIONS.ORDERS), where('customerEmail', '==', customerEmail)));

    const orderBuckets = new Map<number, Map<string, Order>>();
    let completedListeners = 0;

    const publish = () => {
      const merged = new Map<string, Order>();
      Array.from(orderBuckets.values()).forEach((bucket) => {
        bucket.forEach((order, id) => merged.set(id, order));
      });

      const nextOrders = Array.from(merged.values()).sort((a, b) => orderTime(b) - orderTime(a));
      setOrders(nextOrders);
      setLoading(false);
    };

    const unsubscribes = queries.map((ordersQuery, index) =>
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const bucket = new Map<string, Order>();
          snapshot.forEach((orderDoc) => {
            bucket.set(orderDoc.id, { id: orderDoc.id, ...orderDoc.data() } as Order);
          });
          orderBuckets.set(index, bucket);
          completedListeners += 1;
          publish();
        },
        (error) => {
          console.error('Client orders listener failed:', error);
          setQueryError(error.message || 'Could not load orders.');
          completedListeners += 1;
          if (completedListeners >= queries.length) setLoading(false);
        }
      )
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [customerEmail, initializing, uid]);

  const activeOrders = useMemo(() => orders.filter((order) => !isTerminalOrderStatus(order.status)), [orders]);
  const historyOrders = useMemo(() => orders.filter((order) => isTerminalOrderStatus(order.status)), [orders]);
  const listData = tab === 'active' ? activeOrders : historyOrders;

  const emptyTitle = tab === 'active' ? 'No active orders' : 'No order history';
  const emptyCopy =
    tab === 'active'
      ? 'When you place an order, live tracking will appear here.'
      : 'Delivered and cancelled orders will appear here.';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pb-5 pt-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-black uppercase tracking-widest text-orange-500">Live tracking</Text>
            <Text className="mt-1 text-4xl font-black text-gray-950">Orders</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            className="h-12 w-12 items-center justify-center rounded-full bg-gray-100"
          >
            <Ionicons name="add" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <View className="mt-5 flex-row rounded-2xl bg-gray-100 p-1">
          {(['active', 'history'] as OrderTab[]).map((nextTab) => (
            <TouchableOpacity
              key={nextTab}
              onPress={() => setTab(nextTab)}
              className={`flex-1 rounded-xl py-3 ${tab === nextTab ? 'bg-gray-950' : ''}`}
            >
              <Text className={`text-center font-black ${tab === nextTab ? 'text-white' : 'text-gray-500'}`}>
                {nextTab === 'active' ? `Active (${activeOrders.length})` : `History (${historyOrders.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <LoadingCards />
      ) : !user ? (
        <View className="flex-1 items-center justify-center px-6 pb-24">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-orange-50">
            <Ionicons name="person-circle-outline" size={58} color="#f97316" />
          </View>
          <Text className="mt-6 text-2xl font-black text-gray-950">Login required</Text>
          <Text className="mt-2 text-center text-base font-semibold text-gray-500">
            Sign in to see your live order history.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/login')} className="mt-7 rounded-2xl bg-orange-500 px-10 py-4">
            <Text className="font-black text-white">Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 110, flexGrow: 1 }}
          ListHeaderComponent={
            queryError ? (
              <View className="mb-4 rounded-3xl bg-red-50 p-4">
                <Text className="font-black text-red-600">Connection issue</Text>
                <Text className="mt-1 text-sm font-semibold text-red-500">{queryError}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-6 py-24">
              <View className="h-28 w-28 items-center justify-center rounded-full bg-orange-50">
                <Ionicons name={tab === 'active' ? 'receipt-outline' : 'archive-outline'} size={58} color="#f97316" />
              </View>
              <Text className="mt-6 text-2xl font-black text-gray-950">{emptyTitle}</Text>
              <Text className="mt-2 text-center text-base font-semibold text-gray-500">{emptyCopy}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)')} className="mt-7 rounded-2xl bg-gray-950 px-10 py-4">
                <Text className="font-black text-white">Order food</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const normalizedStatus = normalizeOrderStatus(item.status);
            const itemTotal = (item.items || []).reduce((sum, orderItem) => sum + Number(orderItem.quantity || 0), 0);
            const amount = (item as any).totalAmount ?? (item as any).total ?? 0;

            return (
              <TouchableOpacity
                onPress={() => router.push(`/order/${item.id}`)}
                activeOpacity={0.9}
                className="mb-4 overflow-hidden rounded-[28px] bg-white shadow-sm shadow-black/5"
              >
                <View className="bg-gray-950 p-5">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-xs font-black uppercase tracking-widest text-orange-400">
                        Order #{item.id.slice(0, 8).toUpperCase()}
                      </Text>
                      <Text className="mt-2 text-xl font-black text-white" numberOfLines={1}>
                        {item.restaurantName || 'Restaurant'}
                      </Text>
                      <Text className="mt-1 text-sm font-bold text-gray-400">
                        {formatFirestoreDate((item as any).createdAt)}
                      </Text>
                    </View>
                    {statusBadge(item.status)}
                  </View>
                </View>

                <View className="p-5">
                  <View className="mb-4 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-50">
                        <Ionicons name="bag-handle" size={21} color="#f97316" />
                      </View>
                      <View className="ml-3">
                        <Text className="font-black text-gray-950">{itemTotal} items</Text>
                        <Text className="text-sm font-semibold text-gray-500">{formatCurrencyUZS(amount)}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
                  </View>

                  {['picked_up', 'on_the_way'].includes(normalizedStatus) ? (
                    <View className="rounded-2xl bg-blue-50 p-4">
                      <Text className="font-black text-blue-700">Courier is on the way</Text>
                      <Text className="mt-1 text-sm font-semibold text-blue-500">Tap to open live tracking map.</Text>
                    </View>
                  ) : (
                    <View className="rounded-2xl bg-gray-50 p-4">
                      <Text className="font-black text-gray-800">{ORDER_STATUS_LABELS[normalizedStatus]}</Text>
                      <Text className="mt-1 text-sm font-semibold text-gray-500">Tap to view order details.</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
