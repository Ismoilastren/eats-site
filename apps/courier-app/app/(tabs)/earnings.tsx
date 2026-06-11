import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
} from '@repo/firebase-config';
import {
  formatCurrencyUZS,
  formatFirestoreDate,
  isTerminalOrderStatus,
  normalizeOrderStatus,
} from '@repo/shared-types';
import { useAuthStore } from '../../stores/authStore';

interface DeliveredOrder {
  id: string;
  restaurantName?: string;
  deliveryAddress?: string;
  deliveryFee?: number | string | null;
  createdAt?: unknown;
  deliveredAt?: unknown;
  updatedAt?: unknown;
  status?: string;
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { seconds?: unknown }).seconds === 'number'
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const getStartOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const getStartOfWeek = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toMoneyNumber = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

export default function EarningsScreen() {
  const courier = useAuthStore((state) => state.courier);
  const isBooting = useAuthStore((state) => state.isLoading);
  const courierId = courier?.id || null;
  const [history, setHistory] = useState<DeliveredOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!courierId) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    const assignedQuery = query(
      collection(db, 'orders'),
      where('assignedCourier.id', '==', courierId)
    );
    const legacyQuery = query(
      collection(db, 'orders'),
      where('courierId', '==', courierId)
    );
    let assignedOrders: DeliveredOrder[] = [];
    let legacyOrders: DeliveredOrder[] = [];

    const mergeHistory = () => {
      const deliveredById = new Map<string, DeliveredOrder>();
      [...assignedOrders, ...legacyOrders].forEach((order) => {
        if (normalizeOrderStatus(order.status) === 'delivered') {
          deliveredById.set(order.id, order);
        }
      });
      const delivered = Array.from(deliveredById.values());

      delivered.sort((a, b) => {
        const aDate = toDate(a.deliveredAt) || toDate(a.updatedAt) || toDate(a.createdAt) || new Date(0);
        const bDate = toDate(b.deliveredAt) || toDate(b.updatedAt) || toDate(b.createdAt) || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });

      setHistory(delivered);
      setIsLoading(false);
    };

    const unsubscribeAssigned = onSnapshot(
      assignedQuery,
      (snapshot) => {
        assignedOrders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        } as DeliveredOrder));
        mergeHistory();
      },
      (error) => {
        if (__DEV__) console.warn('earnings-assigned-orders', error.code);
        setIsLoading(false);
      }
    );

    const unsubscribeLegacy = onSnapshot(
      legacyQuery,
      (snapshot) => {
        legacyOrders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        } as DeliveredOrder));
        mergeHistory();
      },
      (error) => {
        if (__DEV__) console.warn('earnings-legacy-orders', error.code);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeAssigned();
      unsubscribeLegacy();
    };
  }, [courierId]);

  const stats = useMemo(() => {
    const todayStart = getStartOfToday().getTime();
    const weekStart = getStartOfWeek().getTime();
    let today = 0;
    let week = 0;
    let totalEarnings = 0;

    history.forEach((order) => {
      const fee = toMoneyNumber(order.deliveryFee);
      totalEarnings += fee;
      const deliveredDate = toDate(order.deliveredAt) || toDate(order.updatedAt) || toDate(order.createdAt);
      if (!deliveredDate) return;
      const timestamp = deliveredDate.getTime();
      if (timestamp >= todayStart) today += fee;
      if (timestamp >= weekStart) week += fee;
    });

    return {
      today,
      week,
      deliveriesCount: history.length,
      totalEarnings,
      courierName: courier?.name || '',
    };
  }, [courier, history]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
  }, []);

  if (isBooting) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator color="#f97316" size="large" />
      </SafeAreaView>
    );
  }

  if (!courierId) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Ionicons name="wallet-outline" size={64} color="#334155" />
        <Text style={styles.emptyTitle}>NO COURIER PROFILE</Text>
        <Text style={styles.emptyText}>
          Go to Profile and enter your Courier ID to view earnings.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#f97316"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>EARNINGS</Text>
            <Text style={styles.headerTitle}>Courier Wallet</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="trending-up" size={22} color="#10b981" />
          </View>
        </View>

        <View style={styles.glowCard}>
          <View style={styles.glowTopRow}>
            <View>
              <Text style={styles.cardLabel}>TOTAL EARNED</Text>
              <Text style={styles.totalAmount}>
                {formatCurrencyUZS(stats.totalEarnings)}
              </Text>
            </View>
            <View style={styles.moneyIcon}>
              <Ionicons name="cash" size={26} color="#0f172a" />
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.totalMetaRow}>
            <Ionicons name="person-circle-outline" size={16} color="#94a3b8" />
            <Text style={styles.totalMetaText}>
              {stats.courierName || 'Name not set'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="sunny-outline" size={20} color="#f97316" />
            <Text style={styles.statValue}>{formatCurrencyUZS(stats.today)}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={20} color="#10b981" />
            <Text style={styles.statValue}>{formatCurrencyUZS(stats.week)}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cube-outline" size={20} color="#f97316" />
            <Text style={styles.statValue}>{stats.deliveriesCount}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Delivery History</Text>
          <Text style={styles.historyCount}>{history.length} completed</Text>
        </View>

        {isLoading ? (
          <View style={styles.historyLoading}>
            <ActivityIndicator color="#f97316" />
            <Text style={styles.historyLoadingText}>Loading history...</Text>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <View style={styles.emptyHistoryIcon}>
              <Ionicons name="receipt-outline" size={34} color="#f97316" />
            </View>
            <Text style={styles.emptyHistoryTitle}>No deliveries yet</Text>
            <Text style={styles.emptyHistoryText}>
              Completed deliveries will appear here with live Firestore data.
            </Text>
          </View>
        ) : (
          history.map((order) => (
            <View key={order.id} style={styles.historyItem}>
              <View style={styles.historyIcon}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
              <View style={styles.historyBody}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {order.restaurantName || 'Restaurant'}
                </Text>
                <Text style={styles.addressText} numberOfLines={1}>
                  {order.deliveryAddress || 'No address'}
                </Text>
                <Text style={styles.dateText}>
                  {formatFirestoreDate(order.deliveredAt || order.updatedAt)}
                </Text>
              </View>
              <Text style={styles.historyAmount}>
                {formatCurrencyUZS(order.deliveryFee)}
              </Text>
            </View>
          ))
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerEyebrow: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  glowCard: {
    borderRadius: 26,
    padding: 22,
    backgroundColor: '#111c31',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.34)',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  glowTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  totalAmount: {
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 8,
  },
  moneyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 18,
  },
  totalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalMetaText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    padding: 13,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  historyHeader: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitle: {
    color: 'white',
    fontSize: 19,
    fontWeight: '900',
  },
  historyCount: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  historyLoading: {
    minHeight: 170,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  historyLoadingText: {
    color: '#94a3b8',
    fontWeight: '800',
    marginTop: 10,
  },
  emptyHistory: {
    minHeight: 220,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyHistoryIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.28)',
  },
  emptyHistoryTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
  },
  emptyHistoryText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
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
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.12)',
    marginRight: 12,
  },
  historyBody: {
    flex: 1,
    minWidth: 0,
  },
  restaurantName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
  },
  addressText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  dateText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  historyAmount: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 10,
  },
});
