import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, collection, query, where, onSnapshot } from '@repo/firebase-config';
import { COLLECTIONS, formatCurrencyUZS, formatFirestoreDate, normalizeOrderStatus, Order } from '@repo/shared-types';
import { useAuthStore } from '../../stores/authStore';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;
const getDateMs = (value: unknown) => {
  if (typeof (value as { toDate?: unknown })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function HistoryScreen() {
  const restaurant = useAuthStore(state => state.restaurant);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurant?.id) return;

    const q = query(
      collection(db, COLLECTIONS.ORDERS),
      where('restaurantId', '==', restaurant.id),
      where('status', 'in', ['courier_picked_up', 'delivered', 'cancelled'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Order[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Order);
      });
      fetched.sort((a, b) => getDateMs(b.createdAt) - getDateMs(a.createdAt));
      setOrders(fetched);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurant?.id]);

  const filteredOrders = orders.filter(o => {
    const status = normalizeOrderStatus(o.status);
    if (filter === 'all') return true;
    if (filter === 'completed') return ['courier_picked_up', 'delivered'].includes(status);
    if (filter === 'cancelled') return status === 'cancelled';
    return true;
  });

  const renderFilter = (value: string, label: string) => (
    <TouchableOpacity 
      onPress={() => setFilter(value as any)}
      className={`px-4 py-2 rounded-xl mr-3 border shadow-sm ${filter === value ? 'bg-orange-500/20 border-orange-500' : 'bg-gray-800 border-gray-700'}`}
    >
      <Text className={`font-bold tracking-widest text-xs uppercase ${filter === value ? 'text-orange-400' : 'text-gray-400'}`}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <View className="px-5 py-4 bg-gray-900 border-b border-gray-800 shadow-sm z-10">
        <View className="flex-row items-center mb-4 mt-2">
          <View className="w-10 h-10 bg-orange-500/20 rounded-xl items-center justify-center border border-orange-500/30">
            <Ionicons name="time" size={20} color="#FF6B35" />
          </View>
          <Text className={`font-extrabold text-white ml-3 tracking-wide ${isSmallScreen ? 'text-lg' : 'text-2xl'}`}>
            ORDER HISTORY
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {renderFilter('all', 'All Orders')}
          {renderFilter('completed', 'Completed / Handed Over')}
          {renderFilter('cancelled', 'Cancelled')}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="bg-gray-900 p-5 rounded-2xl mb-4 shadow-lg border border-gray-700 flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="font-extrabold text-white text-lg tracking-wider mb-1">#{item.id.slice(0, 6).toUpperCase()}</Text>
                <Text className="text-gray-400 font-medium text-sm mb-2">{item.customerName || item.userId || 'Guest Customer'}</Text>
                <Text className="text-gray-500 text-xs font-bold tracking-widest">{formatFirestoreDate(item.createdAt)}</Text>
              </View>
              <View className="items-end justify-center">
                <Text className="font-black text-xl text-orange-400 mb-2">
                  {formatCurrencyUZS(item.totalAmount || 0)}
                </Text>
                <View className={`px-3 py-1.5 rounded-lg border ${normalizeOrderStatus(item.status) === 'cancelled' ? 'bg-rose-500/10 border-rose-500' : 'bg-emerald-500/10 border-emerald-500'}`}>
                  <Text className={`text-[10px] font-black uppercase tracking-widest ${normalizeOrderStatus(item.status) === 'cancelled' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {normalizeOrderStatus(item.status) === 'cancelled' ? 'CANCELLED' : normalizeOrderStatus(item.status) === 'courier_picked_up' ? 'HANDED OVER' : 'COMPLETED'}
                  </Text>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <View className="py-20 items-center justify-center">
              <View className="w-24 h-24 bg-gray-800 rounded-full items-center justify-center mb-6 border border-gray-700">
                <Ionicons name="receipt" size={40} color="#6B7280" />
              </View>
              <Text className="text-xl font-bold text-white tracking-widest text-center">NO HISTORY</Text>
              <Text className="text-gray-500 mt-2 text-sm font-medium">No orders found for this filter.</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
