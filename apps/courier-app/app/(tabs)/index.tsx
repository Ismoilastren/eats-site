import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  db,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from '@repo/firebase-config';
import {
  COURIER_RADAR_STATUSES,
  formatCurrencyUZS,
  normalizeOrderStatus,
} from '@repo/shared-types';
import { useAuthStore } from '../../stores/authStore';

interface OrderDoc {
  id: string;
  status?: string;
  restaurantName?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  items?: any[];
  [key: string]: any;
}

export default function RadarScreen() {
  const courier = useAuthStore((state) => state.courier);
  const isOnline = useAuthStore((state) => state.isOnline);
  const isBooting = useAuthStore((state) => state.isLoading);
  const isToggling = useAuthStore((state) => state.isUpdatingStatus);
  const toggleCourierOnline = useAuthStore((state) => state.toggleOnline);
  const courierId = courier?.id || null;
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState('');

  // ─── ORDER SYNC: only when courier is online ───
  useEffect(() => {
    if (!isOnline) {
      setOrders([]);
      setSyncError('');
      return;
    }

    setIsLoadingOrders(true);
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', COURIER_RADAR_STATUSES),
      where('assignedCourier', '==', null)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const result: OrderDoc[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const status = normalizeOrderStatus(data.status);
        const hasCourier = data.courierId || data.assignedCourier;
        if (COURIER_RADAR_STATUSES.includes(status) && !hasCourier) {
          result.push({ id: d.id, ...data } as OrderDoc);
        }
      });
      setOrders(result);
      setIsLoadingOrders(false);
      setSyncError('');
    }, (error) => {
      if (__DEV__) console.warn('radar-orders-query', error.code);
      setSyncError('Unable to load delivery requests. Check Firestore rules.');
      setIsLoadingOrders(false);
    });

    return () => unsub();
  }, [isOnline]);

  // ─── TOGGLE ONLINE ───
  const toggleOnline = async () => {
    try {
      await toggleCourierOnline();
    } catch (error) {
      Alert.alert(
        'Unable to update status',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  // ─── ACCEPT ORDER ───
  const acceptOrder = async (orderId: string) => {
    if (!courier || claimingId) return;
    setClaimingId(orderId);
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const courierRef = doc(db, 'couriers', courier.id);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order no longer exists.');

        const orderData = orderSnap.data();
        const status = normalizeOrderStatus(orderData.status);
        if (!COURIER_RADAR_STATUSES.includes(status) || orderData.assignedCourier || orderData.courierId) {
          throw new Error('This order was already accepted or cancelled.');
        }

        transaction.update(orderRef, {
          courierId: courier.id,
          courierName: courier.name,
          courierPhone: courier.phone,
          assignedCourier: {
            id: courier.id,
            name: courier.name,
            phone: courier.phone,
            vehicleType: courier.vehicleType,
          },
          updatedAt: serverTimestamp(),
        });

        transaction.update(courierRef, {
          currentOrderId: orderId,
          status: 'busy',
          isOnline: true,
          isAvailable: false,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      Alert.alert('Success', 'Order accepted! Check the Active tab.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to accept order.');
    } finally {
      setClaimingId(null);
    }
  };

  // ─── BOOT SPINNER ───
  if (isBooting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  // ─── NOT LOGGED IN ───
  if (!courierId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Ionicons name="alert-circle-outline" size={64} color="#475569" />
        <Text style={{ color: '#94a3b8', fontSize: 20, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>NOT LOGGED IN</Text>
        <Text style={{ color: '#64748b', fontSize: 15, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>Go to the Profile tab and enter your Courier ID.</Text>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  //  MAIN RADAR UI
  // ═══════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: 'white', letterSpacing: 1 }}>RADAR</Text>
          <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 13, marginTop: 2 }}>Live Delivery Requests</Text>
        </View>
        <TouchableOpacity
          onPress={toggleOnline}
          disabled={isToggling}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            backgroundColor: isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
            borderColor: isOnline ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ fontWeight: '900', letterSpacing: 1, color: isOnline ? '#10b981' : '#64748b' }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 16 }} showsVerticalScrollIndicator={false}>

        {/* ── OFFLINE STATE ── */}
        {!isOnline ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
            <Ionicons name="moon" size={80} color="#334155" />
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#475569', marginTop: 20, letterSpacing: 2 }}>YOU ARE OFFLINE</Text>
            <Text style={{ color: '#64748b', fontWeight: '600', marginTop: 10, fontSize: 15, textAlign: 'center' }}>Tap OFFLINE above to start receiving orders.</Text>
          </View>

        /* ── LOADING ORDERS ── */
        ) : syncError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 24 }}>
            <Ionicons name="cloud-offline-outline" size={64} color="#ef4444" />
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#fca5a5', marginTop: 18, textAlign: 'center' }}>RADAR CONNECTION FAILED</Text>
            <Text style={{ color: '#94a3b8', fontWeight: '600', marginTop: 10, textAlign: 'center' }}>{syncError}</Text>
          </View>
        ) : isLoadingOrders ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={{ color: '#94a3b8', fontWeight: '700', marginTop: 16 }}>Scanning for orders...</Text>
          </View>

        /* ── NO ORDERS ── */
        ) : orders.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
            <Ionicons name="search" size={72} color="#334155" />
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#475569', marginTop: 20, letterSpacing: 1 }}>NO ORDERS NEARBY</Text>
            <Text style={{ color: '#64748b', fontWeight: '600', marginTop: 10, textAlign: 'center' }}>Waiting for new delivery requests...</Text>
          </View>

        /* ── ORDER CARDS ── */
        ) : (
          orders.map((item) => (
            <View key={item.id} style={{ backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(71,85,105,0.5)', padding: 20, borderRadius: 24, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#f97316', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    {/* STRICT ID BINDING */}
                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 24, letterSpacing: 2 }}>
                        #{item.id.slice(0, 6).toUpperCase()}
                    </Text>
                    <View style={{ backgroundColor: 'rgba(249,115,22,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)' }}>
                        <Text style={{ color: '#f97316', fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
                            {item.status}
                        </Text>
                    </View>
                </View>
                
                <View style={{ backgroundColor: 'rgba(15,23,42,0.3)', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(71,85,105,0.3)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons name="restaurant" size={16} color="#94a3b8" />
                        <Text style={{ color: '#cbd5e1', fontWeight: '700', marginLeft: 8 }}>{item.restaurantName || 'Restaurant / Kitchen'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="location" size={16} color="#ef4444" />
                        <Text style={{ color: '#94a3b8', marginLeft: 8, fontSize: 14, flex: 1 }} numberOfLines={2}>
                            {item.deliveryAddress || item.customerAddress || 'Address not provided'}
                        </Text>
                    </View>

                    {/* ORDER CONTENT SUMMARY */}
                    <View style={{ backgroundColor: 'rgba(15,23,42,0.5)', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="fast-food" size={16} color="#f97316" />
                        <Text style={{ color: '#cbd5e1', marginLeft: 8, fontWeight: '600' }} numberOfLines={1}>
                            {item.items && item.items.length > 0 
                                ? `${item.items[0].quantity || 1}x ${item.items[0].name} ${item.items.length > 1 ? `+ ${item.items.length - 1} more` : ''}`
                                : 'Food Items'}
                        </Text>
                    </View>
                </View>

                {/* FINANCIALS */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                    <View>
                        <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total to Collect</Text>
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 20 }}>
                            {formatCurrencyUZS(item.totalAmount || item.total || 0)}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: 'rgba(16,185,129,0.7)', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Your Earning</Text>
                        <Text style={{ color: '#34d399', fontWeight: '900', fontSize: 20 }}>
                            {formatCurrencyUZS(item.deliveryFee || 0)}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={() => acceptOrder(item.id)} 
                    disabled={claimingId === item.id}
                    style={{ backgroundColor: '#f97316', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#f97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }}
                >
                    {claimingId === item.id ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 18, letterSpacing: 1, marginRight: 8, textTransform: 'uppercase' }}>Accept Delivery</Text>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                      </>
                    )}
                </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
