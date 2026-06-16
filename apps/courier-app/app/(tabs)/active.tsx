import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  db,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from '@repo/firebase-config';
import {
  ACTIVE_COURIER_STATUSES,
  formatCurrencyUZS,
  getVehicleLabel,
  isTerminalOrderStatus,
  normalizeCoordinate,
  normalizeOrderStatus,
  normalizeVehicleType,
  type NormalizedCoordinate,
} from '@repo/shared-types';
import { useAuthStore } from '../../stores/authStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface OrderItemDoc {
  id?: string;
  name?: string;
  quantity?: number | string;
  price?: number;
}

interface OrderDoc {
  id: string;
  status?: string;
  restaurantName?: string;
  deliveryAddress?: string;
  deliveryFee?: number | string | null;
  customerName?: string;
  customerPhone?: string;
  deliveryLocation?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  } | null;
  customerLocation?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  } | null;
  restaurantLocation?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  } | null;
  courierLocation?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  } | null;
  assignedCourier?: {
    id: string;
    name?: string;
    phone?: string;
    vehicle?: string;
    vehicleType?: string;
  } | null;
  items?: OrderItemDoc[];
  [key: string]: unknown;
}

const TASHKENT_CENTER: NormalizedCoordinate = {
  latitude: 41.311081,
  longitude: 69.240562,
};

const TASHKENT_CUSTOMER_FALLBACK: NormalizedCoordinate = {
  latitude: 41.318081,
  longitude: 69.252562,
};

const getVehicleIcon = (vehicle?: string | null): IoniconName => {
  switch (normalizeVehicleType(vehicle)) {
    case 'car':
      return 'car';
    case 'foot':
      return 'walk';
    case 'motorcycle':
      return 'bicycle';
    case 'bicycle':
    default:
      return 'bicycle';
  }
};

const getStatusColor = (status?: string) => {
  switch (normalizeOrderStatus(status)) {
    case 'pending':
      return '#f59e0b';
    case 'accepted':
      return '#8b5cf6';
    case 'preparing':
      return '#3b82f6';
    case 'ready_for_pickup':
      return '#a855f7';
    case 'picked_up':
      return '#0ea5e9';
    case 'on_the_way':
      return '#10b981';
    default:
      return '#64748b';
  }
};

const getStatusLabel = (status?: string) => {
  switch (normalizeOrderStatus(status)) {
    case 'pending':
      return 'WAITING FOR RESTAURANT';
    case 'accepted':
      return 'ORDER ACCEPTED';
    case 'preparing':
      return 'RESTAURANT IS COOKING';
    case 'ready_for_pickup':
      return 'READY FOR PICKUP';
    case 'picked_up':
      return 'ORDER PICKED UP';
    case 'on_the_way':
      return 'ON THE WAY';
    default:
      return (status || 'unknown').toUpperCase();
  }
};

const getMapRegion = (
  restaurant: NormalizedCoordinate,
  customer: NormalizedCoordinate
): Region => {
  const minLat = Math.min(restaurant.latitude, customer.latitude);
  const maxLat = Math.max(restaurant.latitude, customer.latitude);
  const minLng = Math.min(restaurant.longitude, customer.longitude);
  const maxLng = Math.max(restaurant.longitude, customer.longitude);

  return {
    latitude: (restaurant.latitude + customer.latitude) / 2,
    longitude: (restaurant.longitude + customer.longitude) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.4, 0.025),
    longitudeDelta: Math.max((maxLng - minLng) * 2.4, 0.025),
  };
};

const getItemQuantity = (item: OrderItemDoc) => {
  const quantity = Number(item.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const getOrderTimestamp = (value: unknown) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }
  if (typeof value === 'object') {
    const record = value as { toDate?: () => Date; seconds?: number };
    if (typeof record.toDate === 'function') return record.toDate().getTime();
    if (typeof record.seconds === 'number') return record.seconds * 1000;
  }
  return 0;
};

export default function ActiveScreen() {
  const courier = useAuthStore((state) => state.courier);
  const isBooting = useAuthStore((state) => state.isLoading);
  const courierId = courier?.id || null;
  const currentCourierOrderId = courier?.currentOrderId || null;
  const [activeOrders, setActiveOrders] = useState<OrderDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  const activeBroadcastIds = useMemo(
    () =>
      activeOrders
        .filter((order) => !isTerminalOrderStatus(order.status))
        .map((order) => order.id)
        .sort()
        .join('|'),
    [activeOrders]
  );

  useEffect(() => {
    if (!courierId) {
      setActiveOrders([]);
      return;
    }

    setIsLoading(true);
    const q1 = query(collection(db, 'orders'), where('assignedCourier.id', '==', courierId));
    const q2 = query(collection(db, 'orders'), where('courierId', '==', courierId));

    let list1: OrderDoc[] = [];
    let list2: OrderDoc[] = [];

    const mergeAndSet = () => {
      const mergedMap = new Map<string, OrderDoc>();
      [...list1, ...list2].forEach((data) => {
        const status = normalizeOrderStatus(data.status);
        if (ACTIVE_COURIER_STATUSES.includes(status)) {
          mergedMap.set(data.id, data);
        }
      });
      const merged = Array.from(mergedMap.values()).sort((a, b) => {
        if (a.id === currentCourierOrderId) return -1;
        if (b.id === currentCourierOrderId) return 1;
        return getOrderTimestamp(b.updatedAt || b.createdAt) - getOrderTimestamp(a.updatedAt || a.createdAt);
      });
      setActiveOrders(merged);
      setIsLoading(false);
    };

    const unsub1 = onSnapshot(
      q1,
      (snapshot) => {
        list1 = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OrderDoc));
        mergeAndSet();
      },
      (error) => {
        if (__DEV__) console.warn('active-assigned-orders', error.code);
        setIsLoading(false);
      }
    );

    const unsub2 = onSnapshot(
      q2,
      (snapshot) => {
        list2 = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OrderDoc));
        mergeAndSet();
      },
      (error) => {
        if (__DEV__) console.warn('active-legacy-orders', error.code);
        setIsLoading(false);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [courierId, currentCourierOrderId]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    const orderIds = activeBroadcastIds.split('|').filter(Boolean);

    const startLocationTracking = async () => {
      if (orderIds.length === 0) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          const courierLocation = {
            latitude,
            longitude,
            heading: location.coords.heading ?? 0,
            speed: location.coords.speed ?? 0,
          };

          if (courierId) {
            try {
              await updateDoc(doc(db, 'couriers', courierId), {
                status: 'busy',
                isOnline: true,
                isAvailable: false,
                currentLocation: {
                  lat: latitude,
                  lng: longitude,
                  heading: location.coords.heading ?? 0,
                  speed: location.coords.speed ?? 0,
                  updatedAt: serverTimestamp(),
                },
                lastSeenAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (error) {
              if (__DEV__) console.warn('courier-location-update', error);
            }
          }

          for (const orderId of orderIds) {
            try {
              await updateDoc(doc(db, 'orders', orderId), {
                courierLocation,
                updatedAt: serverTimestamp(),
              });
            } catch (error) {
              console.log('Failed to broadcast courier location', orderId, error);
            }
          }
        }
      );
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [activeBroadcastIds, courierId]);

  const callCustomer = async (phone?: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'Customer phone number is not available.');
      return;
    }
    await Linking.openURL(`tel:${phone}`);
  };

  const markDelivered = async (orderId: string) => {
    if (deliveringId) return;
    Alert.alert('Confirm Delivery', 'Mark this order as delivered?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deliver',
        onPress: async () => {
          setDeliveringId(orderId);
          try {
            if (!courierId) throw new Error('Courier ID is missing');

            const orderRef = doc(db, 'orders', orderId);
            const courierRef = doc(db, 'couriers', courierId);

            await runTransaction(db, async (transaction) => {
              const orderSnap = await transaction.get(orderRef);
              if (!orderSnap.exists()) throw new Error('Order no longer exists');

              const orderData = orderSnap.data() as OrderDoc;
              if (normalizeOrderStatus(orderData.status) === 'delivered') {
                throw new Error('Order was already delivered');
              }
              if (normalizeOrderStatus(orderData.status) !== 'on_the_way') {
                throw new Error('Order is not ready to be delivered');
              }
              const assignedCourierId =
                orderData.assignedCourier?.id ||
                String(orderData.courierId || '');
              if (assignedCourierId !== courierId) {
                throw new Error('This order is assigned to another courier');
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

            Alert.alert('Done', 'Order marked as delivered.');
          } catch (error) {
            console.error('Failed to mark order delivered:', error);
            Alert.alert(
              'Error',
              error instanceof Error ? error.message : 'Failed to update order.'
            );
          } finally {
            setDeliveringId(null);
          }
        },
      },
    ]);
  };

  const updateDeliveryProgress = async (
    order: OrderDoc,
    nextStatus: 'picked_up' | 'on_the_way'
  ) => {
    if (deliveringId || !courierId) return;
    const currentStatus = normalizeOrderStatus(order.status);
    const validTransition =
      (currentStatus === 'ready_for_pickup' && nextStatus === 'picked_up') ||
      (currentStatus === 'picked_up' && nextStatus === 'on_the_way');

    const assignedCourierId =
      order.assignedCourier?.id || String(order.courierId || '');
    if (!validTransition || assignedCourierId !== courierId) {
      Alert.alert('Unable to update', 'This delivery is no longer in the expected state.');
      return;
    }

    setDeliveringId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to update delivery progress:', error);
      Alert.alert('Error', 'Failed to update delivery status.');
    } finally {
      setDeliveringId(null);
    }
  };

  if (isBooting) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  if (!courierId) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Ionicons name="alert-circle-outline" size={64} color="#475569" />
        <Text style={styles.emptyTitle}>NOT LOGGED IN</Text>
        <Text style={styles.emptyText}>
          Go to the Profile tab and enter your Courier ID.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>COURIER OPS</Text>
          <Text style={styles.headerTitle}>ACTIVE DELIVERY</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="navigate" size={22} color="#f97316" />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Loading deliveries...</Text>
          </View>
        ) : activeOrders.length === 0 ? (
          <View style={styles.loadingBlock}>
            <Ionicons name="cube-outline" size={72} color="#334155" />
            <Text style={styles.emptyTitle}>NO ACTIVE DELIVERIES</Text>
            <Text style={styles.emptyText}>Accept an order from the Radar tab.</Text>
          </View>
        ) : (
          activeOrders.map((order) => {
            const normalizedStatus = normalizeOrderStatus(order.status);
            const nextAction =
              normalizedStatus === 'ready_for_pickup'
                ? { label: 'MARK AS PICKED UP', status: 'picked_up' as const, icon: 'cube' as const }
                : normalizedStatus === 'picked_up'
                  ? { label: 'START DELIVERY', status: 'on_the_way' as const, icon: 'navigate' as const }
                  : normalizedStatus === 'on_the_way'
                    ? { label: 'MARK AS DELIVERED', status: 'delivered' as const, icon: 'checkmark-circle' as const }
                    : null;
            const vehicleType =
              order.assignedCourier?.vehicleType ||
              order.assignedCourier?.vehicle ||
              'bicycle';
            const restaurant =
              normalizeCoordinate(order.restaurantLocation) || TASHKENT_CENTER;
            const customer =
              normalizeCoordinate(order.deliveryLocation) ||
              normalizeCoordinate(order.customerLocation) ||
              TASHKENT_CUSTOMER_FALLBACK;
            const courierLocation = normalizeCoordinate(order.courierLocation);
            const route =
              normalizedStatus === 'ready_for_pickup' || normalizedStatus === 'preparing'
                ? courierLocation
                  ? [courierLocation, restaurant]
                  : []
                : ['picked_up', 'on_the_way'].includes(normalizedStatus)
                  ? [courierLocation || restaurant, customer]
                  : [];
            const initialRegion =
              route.length >= 2
                ? getMapRegion(route[0], route[route.length - 1])
                : getMapRegion(restaurant, customer);
            const itemCount = order.items?.length ?? 0;

            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>
                      #{order.id.slice(-6).toUpperCase()}
                    </Text>
                    <View style={styles.vehicleRow}>
                      <Ionicons name={getVehicleIcon(vehicleType)} size={16} color="#f97316" />
                      <Text style={styles.vehicleText}>{getVehicleLabel(vehicleType)}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: `${getStatusColor(order.status)}20`,
                        borderColor: `${getStatusColor(order.status)}50`,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                      {getStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.mapShell}>
                  <MapView
                    style={styles.map}
                    initialRegion={initialRegion}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <Marker coordinate={restaurant} title={order.restaurantName || 'Restaurant'}>
                      <View style={styles.restaurantMarker}>
                        <Ionicons name="restaurant" size={16} color="white" />
                      </View>
                    </Marker>
                    <Marker coordinate={customer} title={order.customerName || 'Customer'}>
                      <View style={styles.customerMarker}>
                        <Ionicons name="home" size={16} color="white" />
                      </View>
                    </Marker>
                    {courierLocation ? (
                      <Marker coordinate={courierLocation} title="Courier">
                        <View style={styles.courierMarker}>
                          <Ionicons name="car" size={16} color="white" />
                        </View>
                      </Marker>
                    ) : null}
                    {route.length >= 2 ? (
                      <Polyline
                        coordinates={route}
                        strokeColor="#f97316"
                        strokeWidth={5}
                        lineDashPattern={[8, 8]}
                      />
                    ) : null}
                  </MapView>
                </View>

                <View style={styles.routeSummary}>
                  <View style={styles.routePoint}>
                    <Ionicons name="restaurant" size={18} color="#f97316" />
                    <View style={styles.routeTextWrap}>
                      <Text style={styles.routeLabel}>PICKUP</Text>
                      <Text style={styles.routeText} numberOfLines={1}>
                        {order.restaurantName || 'Restaurant'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.routeDivider} />
                  <View style={styles.routePoint}>
                    <Ionicons name="location" size={18} color="#10b981" />
                    <View style={styles.routeTextWrap}>
                      <Text style={styles.routeLabel}>DROP-OFF</Text>
                      <Text style={styles.routeText} numberOfLines={2}>
                        {order.deliveryAddress || 'Customer address not provided'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>ORDER DETAILS</Text>
                    <Text style={styles.sectionMeta}>{itemCount} ITEMS</Text>
                  </View>
                  {itemCount > 0 ? (
                    order.items?.map((item, index) => (
                      <View
                        key={item.id || `${item.name || 'item'}-${index}`}
                        style={[
                          styles.itemRow,
                          index < itemCount - 1 ? styles.itemRowBorder : null,
                        ]}
                      >
                        <Text style={styles.itemQty}>{getItemQuantity(item)}x</Text>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.name || 'Item'}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.mutedText}>No item details available.</Text>
                  )}
                </View>

                <View style={styles.customerCard}>
                  <View style={styles.customerInfo}>
                    <Text style={styles.routeLabel}>CUSTOMER</Text>
                    <Text style={styles.customerName}>
                      {order.customerName || 'Customer'}
                    </Text>
                    <Text style={styles.customerPhone}>
                      {order.customerPhone || 'No phone number'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => callCustomer(order.customerPhone)}
                    disabled={!order.customerPhone}
                    activeOpacity={0.85}
                    style={[
                      styles.callButton,
                      !order.customerPhone ? styles.callButtonDisabled : null,
                    ]}
                  >
                    <Ionicons name="call" size={20} color="white" />
                    <Text style={styles.callButtonText}>CALL CUSTOMER</Text>
                  </TouchableOpacity>
                </View>

                {nextAction ? (
                  <TouchableOpacity
                    onPress={() => {
                      if (nextAction.status === 'delivered') {
                        markDelivered(order.id);
                      } else {
                        updateDeliveryProgress(order, nextAction.status);
                      }
                    }}
                    disabled={deliveringId === order.id}
                    activeOpacity={0.85}
                    style={styles.deliverButton}
                  >
                    {deliveringId === order.id ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Ionicons name={nextAction.icon} size={24} color="white" />
                        <Text style={styles.deliverButtonText}>{nextAction.label}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.waitingBlock}>
                    <Ionicons name="time" size={20} color="#f59e0b" />
                    <Text style={styles.waitingText}>
                      Waiting for the next delivery step.
                    </Text>
                  </View>
                )}

                <View style={styles.earningRow}>
                  <Text style={styles.earningLabel}>DELIVERY FEE</Text>
                  <Text style={styles.earningValue}>
                    {formatCurrencyUZS(order.deliveryFee)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerEyebrow: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  loadingBlock: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontWeight: '800',
    marginTop: 16,
  },
  emptyTitle: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  orderId: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  vehicleText: {
    color: '#f97316',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  mapShell: {
    height: 230,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  map: {
    flex: 1,
  },
  restaurantMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  customerMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  courierMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  routeSummary: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  routeLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  routeText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
    lineHeight: 20,
  },
  routeDivider: {
    height: 16,
    width: 1,
    marginLeft: 8,
    marginVertical: 4,
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  section: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionMeta: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '900',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemQty: {
    minWidth: 44,
    color: '#f97316',
    fontSize: 15,
    fontWeight: '900',
  },
  itemName: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
  },
  mutedText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 8,
  },
  customerCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
  },
  customerInfo: {
    marginBottom: 12,
  },
  customerName: {
    color: 'white',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  customerPhone: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  callButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonDisabled: {
    opacity: 0.45,
  },
  callButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
    letterSpacing: 0.8,
  },
  deliverButton: {
    marginTop: 14,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
    letterSpacing: 1,
  },
  waitingBlock: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingText: {
    color: '#fbbf24',
    fontWeight: '800',
    marginLeft: 10,
    flex: 1,
  },
  earningRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningLabel: {
    color: '#64748b',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 2,
  },
  earningValue: {
    color: '#10b981',
    fontSize: 22,
    fontWeight: '900',
  },
});
