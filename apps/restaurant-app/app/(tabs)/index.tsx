import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { db, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from '@repo/firebase-config';
import { COLLECTIONS, hasAssignedCourier, Order, OrderStatus, ORDER_STATUS_LABELS } from '@repo/shared-types';
import { useAuthStore } from '../../stores/authStore';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

export default function KitchenDisplayDashboard() {
  const router = useRouter();
  const restaurant = useAuthStore(state => state.restaurant);
  const [orders, setOrders] = useState<Order[]>([]);
  const [previousOrderCount, setPreviousOrderCount] = useState<number>(0);

  useEffect(() => {
    if (!restaurant?.id) return;

    const q = query(
      collection(db, COLLECTIONS.ORDERS),
      where('restaurantId', '==', restaurant.id),
      where('status', 'in', ['pending', 'preparing', 'courier_picked_up'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Order[] = [];
      let pendingCount = 0;
      snapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data() } as Order;
        data.push(orderData);
        if (orderData.status === 'pending') pendingCount++;
      });
      
      const statusWeight: Record<string, number> = { pending: 1, preparing: 2, courier_picked_up: 3 };
      data.sort((a, b) => (statusWeight[a.status] || 99) - (statusWeight[b.status] || 99));
      
      setOrders(data);

      setPreviousOrderCount((prev) => {
        if (pendingCount > prev) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return pendingCount;
      });
      
    });

    return () => unsubscribe();
  }, [restaurant?.id]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus, orderObj?: Order) => {
    if (newStatus === 'courier_picked_up' && orderObj && !hasAssignedCourier(orderObj)) {
      Alert.alert('Action Denied', 'You cannot hand over the food. No courier has accepted this delivery yet.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending': return { border: 'border-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-400' };
      case 'preparing': return { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' };
      case 'courier_picked_up': return { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' };
      default: return { border: 'border-gray-500', bg: 'bg-gray-800', text: 'text-gray-300' };
    }
  };

  const getNextStatusAction = (order: Order) => {
    if (order.status === 'pending') return { label: 'ACCEPT & PREPARE', next: 'preparing', color: 'bg-gradient-to-r from-amber-500 to-orange-500', solid: 'bg-amber-500' };
    if (order.status === 'preparing') return { label: 'HAND TO COURIER', next: 'courier_picked_up', color: 'bg-gradient-to-r from-emerald-400 to-emerald-600', solid: 'bg-emerald-500' };
    return null;
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      {/* Header */}
      <View className="px-5 py-4 bg-gray-900 flex-row justify-between items-center border-b border-gray-800 shadow-sm z-10">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 bg-orange-500/20 rounded-xl items-center justify-center border border-orange-500/30">
            <Ionicons name="restaurant" size={20} color="#FF6B35" />
          </View>
          <Text className={`font-extrabold text-white ml-3 tracking-wide ${isSmallScreen ? 'text-lg' : 'text-2xl'}`} numberOfLines={1}>
            KITCHEN DISPLAY
          </Text>
        </View>
        
        <View className="flex-row items-center bg-black/50 px-3 py-2 rounded-xl border border-gray-700 ml-2">
          {!isSmallScreen && <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest mr-2">Active</Text>}
          <View className="bg-orange-500 w-7 h-7 rounded-full items-center justify-center">
             <Text className="text-white font-black text-sm">{orders.length}</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-5" showsVerticalScrollIndicator={false}>
        {orders.length === 0 ? (
          <View className="flex-1 items-center justify-center mt-20 mb-10">
            <View className="w-32 h-32 bg-gray-800 rounded-full items-center justify-center mb-6 border border-gray-700">
              <Ionicons name="checkmark-done" size={64} color="#10B981" />
            </View>
            <Text className="text-2xl font-black text-white tracking-widest text-center">KITCHEN IS CLEAR</Text>
            <Text className="text-gray-400 mt-2 text-base font-medium text-center px-6">
              All caught up! Waiting for new incoming orders...
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-between pb-10">
            {orders.map(order => {
              const action = getNextStatusAction(order);
              const statusCfg = getStatusConfig(order.status);
              
              return (
                <View 
                  key={order.id} 
                  className={`w-full mb-5 bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-lg`}
                >
                  {/* Top Color Bar Indicator */}
                  <View className={`h-1.5 w-full ${statusCfg.border.replace('border-', 'bg-')}`} />
                  
                  {/* Card Header */}
                  <View className="p-4 bg-gray-800 border-b border-gray-700 flex-row justify-between items-center">
                    <View>
                      <Text className="text-2xl font-black text-white tracking-wider">#{order.id.slice(0, 6).toUpperCase()}</Text>
                      <Text className="text-gray-400 font-semibold text-xs mt-1 uppercase tracking-wider">{order.items?.length || 0} ITEMS</Text>
                    </View>
                    <View className={`px-3 py-1.5 rounded-lg border ${statusCfg.bg} ${statusCfg.border}`}>
                      <Text className={`font-black text-[10px] uppercase tracking-widest ${statusCfg.text}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Text>
                    </View>
                  </View>

                  {/* Order Items */}
                  <View className="p-5 min-h-[120px]">
                    {order.items?.slice(0, 4).map((item, i) => (
                      <View key={i} className="flex-row items-center mb-3">
                        <View className="w-8 h-8 rounded-lg bg-black/50 items-center justify-center mr-3 border border-gray-700">
                          <Text className="font-black text-sm text-white">{item.quantity}x</Text>
                        </View>
                        <Text className="font-bold text-gray-200 text-lg flex-1" numberOfLines={2}>{item.name}</Text>
                      </View>
                    ))}
                    {order.items && order.items.length > 4 && (
                      <Text className="text-orange-400 font-bold mt-2 text-sm">+{order.items.length - 4} more items...</Text>
                    )}
                  </View>

                  {/* Actions / Courier Tracking */}
                  <View className="p-4 bg-gray-800 flex-row justify-between items-center border-t border-gray-700">
                    <TouchableOpacity 
                      onPress={() => router.push(`/order/${order.id}`)}
                      className="w-14 h-14 bg-gray-700 rounded-xl items-center justify-center border border-gray-600"
                    >
                      <Ionicons name="list" size={24} color="#9CA3AF" />
                    </TouchableOpacity>

                    {order.status === 'courier_picked_up' ? (
                      <View className="h-14 rounded-xl flex-1 ml-3 px-3 justify-center bg-blue-500/10 border border-blue-500/30">
                        <View className="flex-row items-center mb-1">
                          <View className="w-2 h-2 rounded-full bg-blue-500 mr-2" style={{ opacity: 0.8 }} />
                          <Text className="font-black text-blue-400 text-xs tracking-widest uppercase">Courier En Route to Customer</Text>
                        </View>
                        {order.courierLocation || order.courier?.location ? (
                          <Text className="font-bold text-gray-300 text-xs font-mono">
                            GPS: {((order.courierLocation as any)?.latitude ?? (order.courier as any)?.location?.lat)?.toFixed(5)}, {((order.courierLocation as any)?.longitude ?? (order.courier as any)?.location?.lng)?.toFixed(5)}
                          </Text>
                        ) : (
                          <Text className="font-bold text-gray-500 text-xs">Waiting for GPS signal...</Text>
                        )}
                      </View>
                    ) : order.status === 'pending' ? (
                      <TouchableOpacity 
                        onPress={() => updateStatus(order.id, 'preparing', order)}
                        className="bg-orange-500 h-14 rounded-xl flex-1 ml-3 items-center justify-center shadow-md"
                      >
                        <Text className="text-white font-black uppercase tracking-widest text-base">Accept & Prepare</Text>
                      </TouchableOpacity>
                    ) : order.status === 'preparing' ? (
                      <TouchableOpacity 
                        onPress={() => updateStatus(order.id, 'courier_picked_up', order)}
                        disabled={!hasAssignedCourier(order)}
                        className={`h-14 rounded-xl flex-1 ml-3 items-center flex-row justify-center shadow-md ${!hasAssignedCourier(order) ? 'bg-slate-700' : 'bg-emerald-500'}`}
                      >
                        <Ionicons 
                            name={!hasAssignedCourier(order) ? "time-outline" : "checkmark-circle"} 
                            size={20} 
                            color="white" 
                            style={{ marginRight: 8 }} 
                        />
                        <Text className="text-white font-black uppercase tracking-widest text-sm" numberOfLines={1}>
                            {!hasAssignedCourier(order) 
                                ? 'Wait for Courier...' 
                                : `Hand to ${order.assignedCourier?.name || order.courierName || 'Courier'}`}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="h-14 rounded-xl flex-1 ml-3 items-center justify-center bg-gray-700 border border-gray-600">
                        <Text className="font-black text-gray-500 text-sm tracking-widest">WAITING</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
