// =============================================
// EARNINGS STORE — Courier earnings state
// =============================================
import { create } from 'zustand';
import type { DeliveryEarning } from '@repo/shared-types';
import { COLLECTIONS, PAGE_SIZE } from '@repo/shared-types';
import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from '@repo/firebase-config';
import type { QueryDocumentSnapshot } from '@repo/firebase-config';

interface EarningsState {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  totalDeliveries: number;
  averagePerDelivery: number;
  totalTips: number;
  deliveryHistory: DeliveryEarning[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchEarnings: (courierId: string) => Promise<void>;
  fetchDeliveryHistory: (courierId: string, loadMore?: boolean) => Promise<void>;
  reset: () => void;
}

function getStartOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function getStartOfWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getStartOfMonth(): Date {
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now;
}

export const useEarningsStore = create<EarningsState>()((set, get) => ({
  todayEarnings: 0,
  weekEarnings: 0,
  monthEarnings: 0,
  totalDeliveries: 0,
  averagePerDelivery: 0,
  totalTips: 0,
  deliveryHistory: [],
  lastDoc: null,
  hasMore: true,
  isLoading: false,
  error: null,

  fetchEarnings: async (courierId: string) => {
    set({ isLoading: true, error: null });

    try {
      const earningsRef = collection(db, COLLECTIONS.COURIERS, courierId, 'earnings');

      // Today
      const todayQ = query(
        earningsRef,
        where('date', '>=', getStartOfDay()),
        orderBy('date', 'desc')
      );
      const todaySnap = await getDocs(todayQ);
      let todayTotal = 0;
      let todayTips = 0;
      todaySnap.forEach((docSnap) => {
        const data = docSnap.data() as DeliveryEarning;
        todayTotal += data.totalAmount;
        todayTips += data.tip;
      });

      // This week
      const weekQ = query(
        earningsRef,
        where('date', '>=', getStartOfWeek()),
        orderBy('date', 'desc')
      );
      const weekSnap = await getDocs(weekQ);
      let weekTotal = 0;
      weekSnap.forEach((docSnap) => {
        const data = docSnap.data() as DeliveryEarning;
        weekTotal += data.totalAmount;
      });

      // This month
      const monthQ = query(
        earningsRef,
        where('date', '>=', getStartOfMonth()),
        orderBy('date', 'desc')
      );
      const monthSnap = await getDocs(monthQ);
      let monthTotal = 0;
      let monthDeliveryCount = 0;
      let monthTips = 0;
      monthSnap.forEach((docSnap) => {
        const data = docSnap.data() as DeliveryEarning;
        monthTotal += data.totalAmount;
        monthTips += data.tip;
        monthDeliveryCount++;
      });

      set({
        todayEarnings: Math.round(todayTotal * 100) / 100,
        weekEarnings: Math.round(weekTotal * 100) / 100,
        monthEarnings: Math.round(monthTotal * 100) / 100,
        totalDeliveries: monthDeliveryCount,
        averagePerDelivery:
          monthDeliveryCount > 0
            ? Math.round((monthTotal / monthDeliveryCount) * 100) / 100
            : 0,
        totalTips: Math.round((todayTips + monthTips - todayTips) * 100) / 100, // monthTips
        isLoading: false,
      });
    } catch (error) {
      console.warn('Failed to fetch earnings:', error);
      set({ isLoading: false, error: 'Failed to load earnings' });
    }
  },

  fetchDeliveryHistory: async (courierId: string, loadMore = false) => {
    const { lastDoc, deliveryHistory } = get();
    set({ isLoading: true, error: null });

    try {
      const earningsRef = collection(db, COLLECTIONS.COURIERS, courierId, 'earnings');
      let q;

      if (loadMore && lastDoc) {
        q = query(
          earningsRef,
          orderBy('date', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(earningsRef, orderBy('date', 'desc'), limit(PAGE_SIZE));
      }

      const snapshot = await getDocs(q);
      const newEarnings: DeliveryEarning[] = [];
      snapshot.forEach((docSnap) => {
        newEarnings.push({ id: docSnap.id, ...docSnap.data() } as DeliveryEarning);
      });

      const newLastDoc =
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null;

      set({
        deliveryHistory: loadMore
          ? [...deliveryHistory, ...newEarnings]
          : newEarnings,
        lastDoc: newLastDoc,
        hasMore: snapshot.docs.length === PAGE_SIZE,
        isLoading: false,
      });
    } catch (error) {
      console.warn('Failed to fetch delivery history:', error);
      set({ isLoading: false, error: 'Failed to load delivery history' });
    }
  },

  reset: () =>
    set({
      todayEarnings: 0,
      weekEarnings: 0,
      monthEarnings: 0,
      totalDeliveries: 0,
      averagePerDelivery: 0,
      totalTips: 0,
      deliveryHistory: [],
      lastDoc: null,
      hasMore: true,
      isLoading: false,
      error: null,
    }),
}));
