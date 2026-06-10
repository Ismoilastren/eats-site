import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  addDoc,
  collection,
  db,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from '@repo/firebase-config';
import NativeOrderMap from '../../components/NativeOrderMap';

const TASHKENT = { latitude: 41.311081, longitude: 69.240562 };
const TIP_PRESETS = [5_000, 10_000, 15_000, 20_000];

// ─── STATUS ICON ─────────────────────────────────────────────────────────────
const statusIcon = (status: string): any => {
  switch (normalizeOrderStatus(status)) {
    case 'pending': return 'receipt-outline';
    case 'preparing': return 'restaurant-outline';
    case 'picked_up':
    case 'on_the_way':
      return 'bicycle-outline';
    case 'delivered': return 'checkmark-circle-outline';
    default: return 'ellipse-outline';
  }
};

// ─── STAR RATING COMPONENT ────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  size = 36,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={sr.row}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7} style={sr.star}>
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? '#f97316' : '#d1d5db'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 8 },
  star: { padding: 2 },
});

// ─── ORDER CANCELLED VIEW ────────────────────────────────────────────────────
function OrderCancelledView({ order }: { order: Order }) {
  const router = useRouter();
  const paymentType = (order as any).paymentMethod?.type;
  const isCard = paymentType === 'CARD' || paymentType === 'SAVED_CARD' || paymentType === 'Card' || paymentType === 'Saved Card';
  const cancelReason = (order as any).cancelReason || 'No reason provided';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fef2f2', padding: 24, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Ionicons name="close-circle-outline" size={80} color="#ef4444" />
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#7f1d1d', marginTop: 16, textAlign: 'center' }}>Order Cancelled</Text>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#991b1b', marginTop: 8, textAlign: 'center' }}>
          Reason: {cancelReason}
        </Text>
      </View>

      {isCard && (
        <View style={{ backgroundColor: '#ecfdf5', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#10b981', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="checkmark-circle" size={24} color="#059669" />
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#065f46', marginLeft: 8 }}>Compensation Applied</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#047857', lineHeight: 20 }}>
            We've refunded your payment and added a 10,000 UZS compensation bonus to your wallet for the inconvenience.
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={() => router.push('/(tabs)')}
        style={{ backgroundColor: '#ef4444', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Back to Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── POST-DELIVERY REVIEW COMPONENT ──────────────────────────────────────────
function PostDeliveryReview({ order, onDone }: { order: Order; onDone: () => void }) {
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [courierRating, setCourierRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [useCustomTip, setUseCustomTip] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resolvedTip = useCustomTip
    ? Math.max(0, parseInt(customTip.replace(/\D/g, ''), 10) || 0)
    : tip;

  const courierId = (order as any).assignedCourier?.id || (order as any).courierId;
  const courierName = (order as any).assignedCourier?.name || (order as any).courierName || 'Courier';

  const handleSubmit = async () => {
    if (restaurantRating === 0 && courierRating === 0) {
      Alert.alert('Rate your experience', 'Please give at least one rating before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const batch: Promise<any>[] = [];

      // 1. Write review document
      batch.push(
        addDoc(collection(db, 'reviews'), {
          orderId: order.id,
          restaurantId: order.restaurantId,
          courierId: courierId || null,
          restaurantRating,
          courierRating,
          comment: comment.trim(),
          tipAmount: resolvedTip,
          createdAt: serverTimestamp(),
        })
      );

      // 2. Atomic tip increment on courier wallet
      if (resolvedTip > 0 && courierId) {
        batch.push(
          updateDoc(doc(db, 'couriers', courierId), {
            totalEarnings: increment(resolvedTip),
            tips: increment(resolvedTip),
          })
        );
      }

      // 3. Mark order as reviewed
      batch.push(
        updateDoc(doc(db, COLLECTIONS.ORDERS, order.id), {
          reviewed: true,
          updatedAt: serverTimestamp(),
        })
      );

      await Promise.all(batch);
      setSubmitted(true);
    } catch (error: any) {
      console.error('Review submit error:', error);
      Alert.alert('Submit failed', error?.message || 'Could not submit review. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Thank you screen ──
  if (submitted) {
    return (
      <View style={pdr.thankYou}>
        <View style={pdr.thankYouCircle}>
          <Ionicons name="heart" size={48} color="#f97316" />
        </View>
        <Text style={pdr.thankYouTitle}>Thank you! 🎉</Text>
        <Text style={pdr.thankYouSub}>
          Your review has been submitted.
          {resolvedTip > 0 ? `\n+${formatCurrencyUZS(resolvedTip)} tip sent to ${courierName}!` : ''}
        </Text>
        <TouchableOpacity onPress={onDone} style={pdr.doneBtn} activeOpacity={0.85}>
          <Text style={pdr.doneBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} showsVerticalScrollIndicator={false}>
      {/* ── Delivered Banner ── */}
      <View style={pdr.banner}>
        <View style={pdr.bannerIcon}>
          <Ionicons name="checkmark-circle" size={36} color="#16a34a" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pdr.bannerTitle}>Order Delivered!</Text>
          <Text style={pdr.bannerSub}>#{order.id.slice(0, 6).toUpperCase()} • {order.restaurantName}</Text>
        </View>
      </View>

      {/* ── Restaurant Rating ── */}
      <View style={pdr.card}>
        <Text style={pdr.cardLabel}>Rate the Restaurant</Text>
        <Text style={pdr.cardSub}>{order.restaurantName}</Text>
        <StarRating value={restaurantRating} onChange={setRestaurantRating} />
        <Text style={pdr.ratingHint}>
          {restaurantRating === 0 ? 'Tap a star' : ['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent 🤩'][restaurantRating]}
        </Text>
      </View>

      {/* ── Courier Rating & Tip ── */}
      {!!courierId && (
        <View style={pdr.card}>
          <Text style={pdr.cardLabel}>Rate your Courier</Text>
          <Text style={pdr.cardSub}>{courierName}</Text>
          <StarRating value={courierRating} onChange={setCourierRating} />
          <Text style={pdr.ratingHint}>
            {courierRating === 0 ? 'Tap a star' : ['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Lightning fast! ⚡'][courierRating]}
          </Text>

          {/* Tip section */}
          <View style={pdr.tipSection}>
            <Text style={pdr.tipTitle}>Leave a Tip</Text>
            <Text style={pdr.tipSub}>100% goes directly to {courierName}</Text>

            <View style={pdr.tipGrid}>
              {TIP_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => { setTip(preset); setUseCustomTip(false); }}
                  style={[pdr.tipChip, !useCustomTip && tip === preset && pdr.tipChipSelected]}
                  activeOpacity={0.8}
                >
                  <Text style={[pdr.tipChipText, !useCustomTip && tip === preset && pdr.tipChipTextSelected]}>
                    {new Intl.NumberFormat('ru-RU').format(preset)}
                  </Text>
                  <Text style={[pdr.tipChipCurrency, !useCustomTip && tip === preset && pdr.tipChipTextSelected]}>
                    UZS
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => { setUseCustomTip(true); setTip(0); }}
                style={[pdr.tipChip, useCustomTip && pdr.tipChipSelected]}
                activeOpacity={0.8}
              >
                <Text style={[pdr.tipChipText, useCustomTip && pdr.tipChipTextSelected]}>Custom</Text>
              </TouchableOpacity>
            </View>

            {useCustomTip && (
              <View style={pdr.customTipRow}>
                <TextInput
                  value={customTip}
                  onChangeText={setCustomTip}
                  placeholder="e.g. 25000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  style={pdr.customTipInput}
                  autoFocus
                />
                <Text style={pdr.customTipCurrency}>UZS</Text>
              </View>
            )}

            {resolvedTip > 0 && (
              <View style={pdr.tipPreview}>
                <Ionicons name="heart" size={14} color="#f97316" />
                <Text style={pdr.tipPreviewText}>
                  Sending {formatCurrencyUZS(resolvedTip)} tip to {courierName}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Optional Comment ── */}
      <View style={pdr.card}>
        <Text style={pdr.cardLabel}>Leave a Comment</Text>
        <Text style={pdr.cardSub}>Optional — helps improve the service</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          multiline
          style={pdr.commentInput}
          placeholder="Great food, fast delivery..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* ── Submit ── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={[pdr.submitBtn, submitting && pdr.submitBtnDisabled]}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={pdr.submitBtnText}>Submit Review</Text>
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={onDone} style={pdr.skipBtn} activeOpacity={0.7}>
          <Text style={pdr.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const pdr = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#f0fdf4', margin: 16, borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: '#bbf7d0',
  },
  bannerIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
  },
  bannerTitle: { fontSize: 18, fontWeight: '900', color: '#14532d' },
  bannerSub: { fontSize: 13, fontWeight: '600', color: '#16a34a', marginTop: 2 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardLabel: { fontSize: 17, fontWeight: '900', color: '#030712', textAlign: 'center' },
  cardSub: { fontSize: 13, fontWeight: '600', color: '#6b7280', textAlign: 'center', marginTop: 2, marginBottom: 4 },
  ratingHint: { fontSize: 14, fontWeight: '700', color: '#9ca3af', textAlign: 'center', minHeight: 20 },

  tipSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  tipTitle: { fontSize: 15, fontWeight: '900', color: '#030712' },
  tipSub: { fontSize: 12, fontWeight: '500', color: '#9ca3af', marginTop: 2, marginBottom: 12 },
  tipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb', alignItems: 'center',
  },
  tipChipSelected: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  tipChipText: { fontSize: 14, fontWeight: '800', color: '#374151' },
  tipChipCurrency: { fontSize: 10, fontWeight: '700', color: '#6b7280' },
  tipChipTextSelected: { color: '#f97316' },
  customTipRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 14,
    marginTop: 10,
  },
  customTipInput: {
    flex: 1, paddingVertical: 12, fontSize: 16, fontWeight: '700', color: '#030712',
  },
  customTipCurrency: { fontSize: 13, fontWeight: '800', color: '#6b7280' },
  tipPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff7ed', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, marginTop: 10,
  },
  tipPreviewText: { fontSize: 13, fontWeight: '700', color: '#f97316' },

  commentInput: {
    backgroundColor: '#f3f4f6', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontWeight: '600', color: '#111827',
    minHeight: 90, marginTop: 10, textAlignVertical: 'top',
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f97316', borderRadius: 16, paddingVertical: 18,
    gap: 10, shadowColor: '#f97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  submitBtnDisabled: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  submitBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  skipBtn: { alignItems: 'center', paddingVertical: 16 },
  skipBtnText: { fontSize: 14, fontWeight: '700', color: '#9ca3af' },

  thankYou: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, backgroundColor: '#f9fafb',
  },
  thankYouCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fed7aa', marginBottom: 20,
  },
  thankYouTitle: { fontSize: 28, fontWeight: '900', color: '#030712', textAlign: 'center' },
  thankYouSub: { fontSize: 15, fontWeight: '600', color: '#6b7280', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  doneBtn: {
    backgroundColor: '#f97316', borderRadius: 16, paddingVertical: 16,
    paddingHorizontal: 48, marginTop: 32,
  },
  doneBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },
});

// ─── MAIN ORDER TRACKING SCREEN ───────────────────────────────────────────────
export default function NativeOrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  // NOTE: No showReview state needed — derived purely from order.status

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

  // (no useEffect for showReview — derived state handles it below)

  const points = useMemo(() => {
    if (!order) return { restaurant: TASHKENT, customer: TASHKENT, courier: null as null | typeof TASHKENT };
    const restaurant = normalizeCoordinate(order.restaurantLocation) || TASHKENT;
    const customer = normalizeCoordinate((order as any).deliveryLocation) || normalizeCoordinate((order as any).customerLocation) || TASHKENT;
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

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={ts.center}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  // ── Not found ──
  if (!order) {
    return (
      <SafeAreaView style={ts.center}>
        <Ionicons name="receipt-outline" size={56} color="#d1d5db" />
        <Text style={ts.notFoundText}>Order not found</Text>
      </SafeAreaView>
    );
  }

  const normalizedStatus = normalizeOrderStatus(order.status);
  const activeIndex = Math.max(ORDER_STATUS_FLOW.indexOf(normalizedStatus), 0);
  const vehicleType = getCourierVehicleType(null, order.assignedCourier);
  const vehicleIcon: any = vehicleType === 'car' ? 'car-outline' : vehicleType === 'foot' ? 'walk-outline' : vehicleType === 'motorcycle' ? 'speedometer-outline' : 'bicycle-outline';
  const courierPhone = order.assignedCourier?.phone || (order as any).courierPhone || (order as any).courier?.phone;
  const assignedCourierDetails = order.assignedCourier as unknown as {
    vehicle?: { model?: string; color?: string; plate?: string } | string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehiclePlate?: string;
    carModel?: string;
    carColor?: string;
    carNumber?: string;
  } | null;
  const structuredVehicle =
    assignedCourierDetails?.vehicle && typeof assignedCourierDetails.vehicle === 'object'
      ? assignedCourierDetails.vehicle
      : null;

  // Vehicle detail strings (with graceful fallback)
  const vehicleName = structuredVehicle?.model || assignedCourierDetails?.vehicleModel || assignedCourierDetails?.carModel || 'Car';
  const vehicleColor = structuredVehicle?.color || assignedCourierDetails?.vehicleColor || assignedCourierDetails?.carColor || '';
  const vehiclePlate = structuredVehicle?.plate || assignedCourierDetails?.vehiclePlate || assignedCourierDetails?.carNumber || '';
  const vehicleDetails = [vehicleName, vehicleColor, vehiclePlate].filter(Boolean).join(' • ');

  // ── DERIVED STATE: if cancelled → show OrderCancelledView ──
  if (normalizedStatus === 'cancelled') {
    return <OrderCancelledView order={order} />;
  }

  // ── DERIVED STATE: if delivered → immediately show PostDeliveryReview (no setTimeout) ──
  if (normalizedStatus === 'delivered') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <PostDeliveryReview
          order={order}
          onDone={() => router.push('/(tabs)')}
        />
      </SafeAreaView>
    );
  }

  // ── LIVE ORDER TRACKING ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={ts.header}>
          <Text style={ts.headerLabel}>LIVE TRACKING</Text>
          <Text style={ts.headerTitle}>Order #{order.id.slice(0, 6).toUpperCase()}</Text>
          <Text style={ts.headerSub}>{order.restaurantName}</Text>
        </View>

        {/* Status timeline */}
        <View style={ts.section}>
          <View style={ts.timeline}>
            {ORDER_STATUS_FLOW.map((status, index) => {
              const isActive = index <= activeIndex;
              return (
                <View key={status} style={ts.timelineStep}>
                  <View style={[ts.timelineCircle, isActive && ts.timelineCircleActive]}>
                    <Ionicons name={statusIcon(status)} size={18} color={isActive ? '#fff' : '#9ca3af'} />
                  </View>
                  <Text style={[ts.timelineLabel, isActive && ts.timelineLabelActive]}>
                    {ORDER_STATUS_LABELS[status]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Live Map — always rendered for active orders (derived state already returns early for 'delivered') */}
        <View style={ts.section}>
          <View style={ts.mapWrap}>
            <NativeOrderMap
              restaurant={points.restaurant}
              customer={points.customer}
              courier={points.courier}
              restaurantName={order.restaurantName}
              customerAddress={(order as any).customerAddress || order.deliveryAddress}
              courierName={order.assignedCourier?.name || (order as any).courierName || 'Courier'}
              vehicleIcon={vehicleIcon}
            />
          </View>
        </View>


        {/* Courier card — only for active orders */}
        {!!order.assignedCourier?.id && (
          <View style={ts.card}>
            <Text style={ts.cardLabel}>YOUR COURIER</Text>
            <View style={ts.courierRow}>
              <View style={ts.courierAvatar}>
                <Ionicons name={vehicleIcon} size={24} color="#f97316" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={ts.courierName}>{order.assignedCourier.name || (order as any).courierName || 'Courier'}</Text>
                <Text style={ts.courierVehicle}>{getVehicleLabel(vehicleType)}</Text>
                {!!vehicleDetails && (
                  <Text style={ts.courierVehicleDetails}>{vehicleDetails}</Text>
                )}
              </View>
              {!!courierPhone && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${courierPhone}`)}
                  style={ts.callBtn}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Order details */}
        <View style={ts.card}>
          <Text style={ts.cardTitleBig}>Order details</Text>
          {order.items.map(item => (
            <View key={item.id} style={ts.orderRow}>
              <Text style={ts.orderItemName}>{item.quantity}× {item.name}</Text>
              <Text style={ts.orderItemPrice}>{formatCurrencyUZS(item.price * item.quantity)}</Text>
            </View>
          ))}
          <View style={ts.divider} />
          <View style={ts.orderRow}>
            <Text style={ts.orderLabel}>Delivery</Text>
            <Text style={ts.orderValue}>{formatCurrencyUZS(order.deliveryFee)}</Text>
          </View>
          <View style={ts.orderRow}>
            <Text style={ts.orderTotal}>Total</Text>
            <Text style={ts.orderTotal}>{formatCurrencyUZS((order as any).totalAmount ?? (order as any).total)}</Text>
          </View>
        </View>

        {/* Cancel button */}
        {canClientCancelOrder(order.status) && (
          <TouchableOpacity
            onPress={cancelOrder}
            disabled={cancelling}
            style={ts.cancelBtn}
            activeOpacity={0.8}
          >
            <Text style={ts.cancelBtnText}>{cancelling ? 'Cancelling...' : 'Cancel Order'}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── TRACKING STYLES ─────────────────────────────────────────────────────────
const ts = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  notFoundText: { marginTop: 12, fontSize: 20, fontWeight: '900', color: '#030712' },

  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  headerLabel: { fontSize: 11, fontWeight: '900', color: '#f97316', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#030712', marginTop: 2 },
  headerSub: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginTop: 2 },

  section: { backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 16, paddingVertical: 16 },

  timeline: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineStep: { flex: 1, alignItems: 'center' },
  timelineCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  timelineCircleActive: { backgroundColor: '#f97316' },
  timelineLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textAlign: 'center', marginTop: 6, lineHeight: 13 },
  timelineLabelActive: { color: '#030712' },

  mapWrap: { height: 280, borderRadius: 20, overflow: 'hidden', backgroundColor: '#e5e7eb' },

  reviewCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 8, backgroundColor: '#fff7ed',
    borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: '#fed7aa',
  },
  reviewCTAText: { flex: 1, fontSize: 15, fontWeight: '800', color: '#f97316', marginLeft: 10 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8,
    borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardLabel: { fontSize: 11, fontWeight: '900', color: '#9ca3af', letterSpacing: 1.5, marginBottom: 12 },
  cardTitleBig: { fontSize: 17, fontWeight: '900', color: '#030712', marginBottom: 12 },

  courierRow: { flexDirection: 'row', alignItems: 'center' },
  courierAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center',
  },
  courierName: { fontSize: 16, fontWeight: '900', color: '#030712' },
  courierVehicle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 2 },
  courierVehicleDetails: { fontSize: 12, fontWeight: '700', color: '#f97316', marginTop: 3, letterSpacing: 0.2 },
  callBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
  },

  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderItemName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  orderItemPrice: { fontSize: 13, fontWeight: '800', color: '#030712' },
  orderLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  orderValue: { fontSize: 14, fontWeight: '800', color: '#030712' },
  orderTotal: { fontSize: 17, fontWeight: '900', color: '#030712' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },

  cancelBtn: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2', paddingVertical: 14,
  },
  cancelBtnText: { textAlign: 'center', fontWeight: '800', fontSize: 15, color: '#dc2626' },
});
