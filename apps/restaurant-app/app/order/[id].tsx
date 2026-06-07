import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { db, doc, onSnapshot, updateDoc, serverTimestamp } from '@repo/firebase-config';
import { COLLECTIONS, formatCurrencyUZS, hasAssignedCourier, Order, OrderStatus, ORDER_STATUS_LABELS } from '@repo/shared-types';

export default function OrderDetailsModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!id) return;
    const orderRef = doc(db, COLLECTIONS.ORDERS, id);
    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
      }
    });
    return () => unsubscribe();
  }, [id]);

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    if (newStatus === 'courier_picked_up' && !hasAssignedCourier(order)) {
      Alert.alert('Action Denied', 'You cannot hand over the food until a courier accepts this delivery.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      if (newStatus === 'courier_picked_up') {
        router.back();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!order) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-red-500 bg-red-100 border-red-500';
      case 'preparing': return 'text-orange-500 bg-orange-100 border-orange-500';
      case 'courier_picked_up': return 'text-green-600 bg-green-100 border-green-500';
      case 'cancelled': return 'text-red-600 bg-red-100 border-red-500';
      default: return 'text-gray-500 bg-gray-100 border-gray-500';
    }
  };

  const getNextStatusAction = () => {
    if (order.status === 'pending') return { label: 'ACCEPT & PREPARE', next: 'preparing', color: 'bg-amber-500' };
    if (order.status === 'preparing') return { label: 'HAND TO COURIER', next: 'courier_picked_up', color: 'bg-emerald-500' };
    return null;
  };

  const action = getNextStatusAction();
  const statusColors = getStatusColor(order.status).split(' ');

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]">
      <View className="px-8 py-5 bg-[#0f172a] border-b border-gray-800 flex-row justify-between items-center shadow-sm">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-6 p-3 bg-gray-800 rounded-full border border-gray-700">
            <Ionicons name="close" size={28} color="#9CA3AF" />
          </TouchableOpacity>
          <Text className="text-3xl font-black text-white tracking-wide">ORDER #{order.id.slice(0, 6).toUpperCase()}</Text>
        </View>
        <View className={`px-6 py-3 rounded-xl border-2 ${statusColors[1]} ${statusColors[2]}`}>
          <Text className={`font-black uppercase tracking-widest text-lg ${statusColors[0]}`}>
            {ORDER_STATUS_LABELS[order.status] || order.status}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 bg-[#0f172a] p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-gray-400 mb-4 uppercase tracking-wider font-bold text-xs">Order Items</Text>

        {/* Failsafe Mapping */}
        {(!order?.items && !(order as any)?.cartItems) ? (
            <Text className="text-gray-500 italic">No items found in this order.</Text>
        ) : (
            (order.items || (order as any).cartItems || []).map((item, index) => (
                <View key={index} className="flex-row justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl mb-3">
                    <View className="flex-row items-center flex-1">
                        <View className="bg-orange-500/20 w-8 h-8 rounded-full items-center justify-center mr-3 border border-orange-500/30">
                            <Text className="text-orange-500 font-bold">{item.quantity || 1}x</Text>
                        </View>
                        <Text className="text-white font-bold text-lg flex-1" numberOfLines={1}>
                            {item.name || 'Unknown Item'}
                        </Text>
                    </View>
                    <Text className="text-orange-500 font-extrabold ml-2">
                        {formatCurrencyUZS((item.price || 0) * (item.quantity || 1))}
                    </Text>
                </View>
            ))
        )}

        {/* Order Summary & Total */}
        <View className="mt-6 border-t border-white/10 pt-4 flex-row justify-between items-center">
            <Text className="text-gray-400 font-bold">Total Amount</Text>
            <Text className="text-white text-2xl font-black">
                {formatCurrencyUZS(order?.totalAmount || 0)}
            </Text>
        </View>

        {/* Action Button & Details Block */}
        <View className="mt-8 space-y-4">
            <View className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-4">
               <Text className="text-gray-500 font-bold mb-1 uppercase tracking-widest text-xs">Customer</Text>
               <Text className="text-xl font-bold text-white">{order.customerName || 'Guest'}</Text>
               {order.customerPhone && (
                 <View className="flex-row items-center mt-2">
                   <Ionicons name="call" size={16} color="#9CA3AF" />
                   <Text className="text-gray-300 ml-2 font-bold">{order.customerPhone}</Text>
                 </View>
               )}
            </View>

            {action ? (
              <TouchableOpacity 
                onPress={() => updateStatus(action.next as OrderStatus)}
                disabled={action.next === 'courier_picked_up' && !hasAssignedCourier(order)}
                className={`p-5 rounded-2xl items-center justify-center shadow-xl flex-row ${action.next === 'courier_picked_up' && !hasAssignedCourier(order) ? 'bg-gray-600' : action.color}`}
              >
                <Ionicons name="checkmark-done-circle" size={24} color="#fff" />
                <Text className="text-white font-black text-xl uppercase tracking-widest ml-2 text-center">
                  {action.label}
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="p-5 bg-white/5 rounded-2xl items-center justify-center border border-white/10 flex-row">
                 <Ionicons name="bicycle" size={24} color="#9CA3AF" />
                 <Text className="text-gray-400 font-black text-lg ml-2 uppercase tracking-widest">
                   HANDED OVER
                 </Text>
              </View>
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
