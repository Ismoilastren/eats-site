import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc,
  auth,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
} from '@repo/firebase-config';
import {
  COLLECTIONS,
  formatCurrencyUZS,
  normalizeCoordinate,
} from '@repo/shared-types';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';

const TASHKENT = { latitude: 41.311081, longitude: 69.240562 };

const feeFromSettings = (data: any): number | null => {
  const value = data?.baseDeliveryFee ?? data?.deliveryFee ?? data?.defaultDeliveryFee;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

type SavedAddress = {
  id: string;
  label?: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

type PaymentCard = {
  id: string;
  brand: string;
  last4: string;
  holderName?: string;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const items = useCartStore((state) => state.items);
  const restaurant = useCartStore((state) => state.restaurant);
  const clearCart = useCartStore((state) => state.clearCart);
  const setStoreDeliveryFee = useCartStore((state) => state.setDeliveryFee);
  const subtotal = useCartStore((state) => state.getSubtotal());

  const [deliveryFee, setDeliveryFee] = useState(0);
  const [addressText, setAddressText] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [savedCards, setSavedCards] = useState<PaymentCard[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'card'>('cash');
  const [selectedCardId, setSelectedCardId] = useState('');

  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [placing, setPlacing] = useState(false);

  const total = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee]);

  // ── Format GPS reverse geocode — deduplicated (Robust) ──
  const formatAddress = (addr: any) => {
    if (!addr) return 'Unknown location';
    const parts = [addr.street, addr.district, addr.city, addr.subregion]
      .map(p => p?.trim())
      .filter(Boolean);
    return [...new Set(parts)].join(', ');
  };

  // ── Load GPS location ──
  const loadLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Please enable location access for delivery.');
        setLoadingLocation(false);
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(current);

      const [reverse] = await Location.reverseGeocodeAsync(current.coords);
      if (reverse) {
        const formatted = formatAddress(reverse);
        if (formatted && !selectedAddressId) setAddressText(formatted);
      }
    } catch (e) {
      console.warn('GPS error:', e);
    } finally {
      setLoadingLocation(false);
    }
  };

  // ── Fetch delivery fee ──
  const fetchDeliveryFee = async (): Promise<number> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      const fee = snap.exists() ? feeFromSettings(snap.data()) : null;
      if (fee !== null) return fee;
      const snap2 = await getDoc(doc(db, 'system_settings', 'global'));
      const fee2 = snap2.exists() ? feeFromSettings(snap2.data()) : null;
      if (fee2 !== null) return fee2;
    } catch (_) {}
    return Number(restaurant?.deliveryFee || 0);
  };

  // ── Load user data + delivery fee ──
  useEffect(() => {
    loadLocation();
  }, []);

  useEffect(() => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [addrSnap, cardSnap, fee] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.USERS, firebaseUser.uid, 'addresses'))),
          getDocs(query(collection(db, COLLECTIONS.USERS, firebaseUser.uid, 'paymentMethods'))),
          fetchDeliveryFee(),
        ]);
        if (cancelled) return;

        // Addresses
        const addrs: SavedAddress[] = addrSnap.docs.map(d => ({ id: d.id, ...d.data() } as SavedAddress));
        setSavedAddresses(addrs);
        if (addrs[0]) {
          setSelectedAddressId(addrs[0].id);
          setAddressText(addrs[0].address);
          if (addrs[0].latitude && addrs[0].longitude) {
            setLocation({
              coords: {
                latitude: addrs[0].latitude, longitude: addrs[0].longitude,
                altitude: null, accuracy: null, altitudeAccuracy: null, heading: null, speed: null,
              },
              timestamp: Date.now(),
            });
          }
        }

        // Cards
        const cards: PaymentCard[] = cardSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentCard));
        setSavedCards(cards);
        if (cards[0]) {
          setPaymentType('card');
          setSelectedCardId(cards[0].id);
        }

        // Fee
        setDeliveryFee(fee);
        setStoreDeliveryFee(fee);
      } catch (e) {
        console.error('Checkout load error:', e);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Place Order ──
  const handlePlaceOrder = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      Alert.alert('Login required', 'Please log in to place an order.');
      return;
    }
    if (!restaurant || items.length === 0) {
      Alert.alert('Empty cart', 'Add items before checking out.');
      return;
    }
    if (!addressText.trim()) {
      Alert.alert('Address required', 'Please enter a delivery address.');
      return;
    }
    if (paymentType === 'card' && !selectedCardId) {
      Alert.alert('No card selected', 'Please select a saved card or pay with cash.');
      return;
    }

    setPlacing(true);
    try {
      const latestFee = await fetchDeliveryFee();
      const selectedCard = savedCards.find(c => c.id === selectedCardId);
      const customerName = user?.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Customer';
      const customerPhone = user?.phone || firebaseUser.phoneNumber || '';
      const restaurantLocation = normalizeCoordinate(restaurant.location) || TASHKENT;
      const deliveryPoint = location?.coords
        ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
        : TASHKENT;
      const calculatedTotal = subtotal + latestFee;

      const orderRef = await addDoc(collection(db, COLLECTIONS.ORDERS), {
        userId: firebaseUser.uid,
        customerName,
        customerEmail: firebaseUser.email || user?.email || '',
        customerPhone,
        customerAddress: addressText.trim(),
        customerLocation: { lat: deliveryPoint.latitude, lng: deliveryPoint.longitude },
        deliveryAddress: addressText.trim(),
        deliveryLocation: deliveryPoint,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantImage: restaurant.imageUrl || '',
        restaurantLocation,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: Number(item.price) || 0,
          quantity: item.quantity,
          imageUrl: item.imageUrl || '',
        })),
        subtotal,
        deliveryFee: latestFee,
        total: calculatedTotal,
        totalAmount: calculatedTotal,
        status: 'pending',
        courierId: null,
        assignedCourier: null,
        courierLocation: null,
        customer: { name: customerName, phone: customerPhone, email: firebaseUser.email || '' },
        paymentMethod: paymentType === 'card'
          ? { type: 'CARD', brand: selectedCard?.brand || 'Card', last4: selectedCard?.last4 || '0000' }
          : { type: 'CASH' },
        deliveryInstructions,
        source: 'app',
        platform: 'expo',
        estimatedDelivery: null,
        deliveredAt: null,
        cancelledAt: null,
        cancelReason: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      clearCart();
      router.replace(`/order/${orderRef.id}`);
    } catch (error: any) {
      console.error('Place order error:', error);
      Alert.alert('Order failed', error?.message || 'Could not place order. Try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Text style={s.pageTitle}>Checkout</Text>
        <Text style={s.pageSubtitle}>{restaurant?.name || 'Restaurant'}</Text>

        {/* ══════════════════════════════════════
            SECTION: DELIVERY ADDRESS
        ══════════════════════════════════════ */}
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <View style={s.sectionIcon}>
              <Ionicons name="location" size={20} color="#f97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>Delivery address</Text>
              {loadingLocation
                ? <Text style={s.sectionSub}>Reading GPS location...</Text>
                : <Text style={s.sectionSub} numberOfLines={2}>{addressText || 'Enter your address below'}</Text>
              }
            </View>
            {loadingLocation && <ActivityIndicator color="#f97316" size="small" />}
          </View>

          {/* Editable address input */}
          <TextInput
            value={addressText}
            onChangeText={(t) => { setAddressText(t); setSelectedAddressId(null); }}
            multiline
            style={s.textInput}
            placeholder="Apartment, entrance, floor..."
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity onPress={loadLocation} style={s.refreshBtn} activeOpacity={0.8}>
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={s.refreshBtnText}>Refresh GPS</Text>
          </TouchableOpacity>

          {/* Saved addresses */}
          {savedAddresses.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.subLabel}>SAVED ADDRESSES</Text>
              {savedAddresses.map(addr => (
                <TouchableOpacity
                  key={addr.id}
                  onPress={() => {
                    setSelectedAddressId(addr.id);
                    setAddressText(addr.address);
                    if (addr.latitude && addr.longitude) {
                      setLocation({
                        coords: {
                          latitude: addr.latitude, longitude: addr.longitude,
                          altitude: null, accuracy: null, altitudeAccuracy: null, heading: null, speed: null,
                        },
                        timestamp: Date.now(),
                      });
                    }
                  }}
                  style={[s.addrChip, selectedAddressId === addr.id && s.addrChipSelected]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={selectedAddressId === addr.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color="#f97316"
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.addrLabel}>{addr.label || 'Saved Location'}</Text>
                    <Text style={s.addrText} numberOfLines={1}>{addr.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════
            SECTION: PAYMENT METHOD
        ══════════════════════════════════════ */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Payment method</Text>

          {/* Cash option */}
          <TouchableOpacity
            onPress={() => setPaymentType('cash')}
            style={[s.payOption, paymentType === 'cash' && s.payOptionSelected]}
            activeOpacity={0.8}
          >
            <Ionicons name={paymentType === 'cash' ? 'radio-button-on' : 'radio-button-off'} size={20} color="#f97316" />
            <Ionicons name="cash-outline" size={20} color="#374151" style={{ marginLeft: 12 }} />
            <Text style={s.payOptionText}>Cash on Delivery</Text>
          </TouchableOpacity>

          {/* Card option — disabled if no cards */}
          <TouchableOpacity
            onPress={() => savedCards.length > 0 ? setPaymentType('card') : null}
            style={[s.payOption, paymentType === 'card' && s.payOptionSelected, savedCards.length === 0 && s.payOptionDisabled]}
            activeOpacity={savedCards.length > 0 ? 0.8 : 1}
          >
            <Ionicons
              name={paymentType === 'card' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={savedCards.length === 0 ? '#d1d5db' : '#f97316'}
            />
            <Ionicons name="card-outline" size={20} color={savedCards.length === 0 ? '#d1d5db' : '#374151'} style={{ marginLeft: 12 }} />
            <Text style={[s.payOptionText, savedCards.length === 0 && { color: '#9ca3af' }]}>
              {savedCards.length === 0 ? 'Saved Card (none added)' : 'Saved Card'}
            </Text>
          </TouchableOpacity>

          {/* Card selector grid */}
          {paymentType === 'card' && savedCards.length > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {savedCards.map(card => (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => setSelectedCardId(card.id)}
                  style={[s.cardChip, selectedCardId === card.id && s.cardChipSelected]}
                  activeOpacity={0.8}
                >
                  <View style={s.cardBrandBadge}>
                    <Text style={s.cardBrandText}>{card.brand.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.cardNumber}>•••• •••• •••• {card.last4}</Text>
                    {card.holderName && <Text style={s.cardHolder}>{card.holderName}</Text>}
                  </View>
                  {selectedCardId === card.id && (
                    <Ionicons name="checkmark-circle" size={22} color="#f97316" />
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => router.push('/payment-cards' as any)}
                style={s.addCardBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color="#6b7280" />
                <Text style={s.addCardBtnText}>Add new card</Text>
              </TouchableOpacity>
            </View>
          )}

          {paymentType === 'card' && savedCards.length === 0 && (
            <TouchableOpacity
              onPress={() => router.push('/payment-cards' as any)}
              style={s.addCardBtnPrimary}
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={s.addCardBtnPrimaryText}>Add a Card in Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ══════════════════════════════════════
            SECTION: DELIVERY INSTRUCTIONS
        ══════════════════════════════════════ */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Delivery instructions</Text>
          <TextInput
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            multiline
            style={[s.textInput, { minHeight: 80 }]}
            placeholder="Ring doorbell, leave at door, gate code..."
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* ══════════════════════════════════════
            SECTION: ORDER SUMMARY
        ══════════════════════════════════════ */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Order summary</Text>
          {items.map(item => (
            <View key={item.id} style={s.summaryRow}>
              <Text style={s.summaryItemName}>{item.quantity}× {item.name}</Text>
              <Text style={s.summaryItemPrice}>{formatCurrencyUZS(item.price * item.quantity)}</Text>
            </View>
          ))}
          <View style={s.divider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Subtotal</Text>
            <Text style={s.summaryValue}>{formatCurrencyUZS(subtotal)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Delivery fee</Text>
            <Text style={s.summaryValue}>{formatCurrencyUZS(deliveryFee)}</Text>
          </View>
          <View style={[s.summaryRow, { marginTop: 8 }]}>
            <Text style={s.summaryTotal}>Total</Text>
            <Text style={s.summaryTotal}>{formatCurrencyUZS(total)}</Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky Place Order Bar ── */}
      <View style={s.footer}>
        <View style={s.footerMeta}>
          <Text style={s.footerLabel}>{items.reduce((n, i) => n + i.quantity, 0)} items</Text>
          <Text style={s.footerTotal}>{formatCurrencyUZS(total)}</Text>
        </View>
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={placing || loadingLocation}
          style={[s.placeBtn, (placing || loadingLocation) && s.placeBtnDisabled]}
          activeOpacity={0.85}
        >
          {placing
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={s.placeBtnText}>Place Order</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 16, paddingBottom: 20 },

  pageTitle: { fontSize: 28, fontWeight: '900', color: '#030712' },
  pageSubtitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginTop: 2, marginBottom: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '900', color: '#030712', marginBottom: 14 },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sectionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#030712' },
  sectionSub: { fontSize: 13, fontWeight: '500', color: '#6b7280', marginTop: 2 },

  textInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111827', borderRadius: 12, paddingVertical: 12,
    gap: 8, marginTop: 10,
  },
  refreshBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  subLabel: { fontSize: 11, fontWeight: '900', color: '#9ca3af', letterSpacing: 1.5, marginBottom: 8 },

  addrChip: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#e5e7eb', backgroundColor: '#f9fafb', marginBottom: 6,
  },
  addrChipSelected: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  addrLabel: { fontSize: 14, fontWeight: '800', color: '#030712' },
  addrText: { fontSize: 12, fontWeight: '500', color: '#6b7280', marginTop: 2 },

  payOption: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#e5e7eb', backgroundColor: '#f9fafb', marginBottom: 8,
  },
  payOptionSelected: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  payOptionDisabled: { opacity: 0.5 },
  payOptionText: { fontSize: 15, fontWeight: '700', color: '#111827', marginLeft: 10 },

  cardChip: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  cardChipSelected: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  cardBrandBadge: {
    width: 44, height: 28, borderRadius: 6,
    backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center',
  },
  cardBrandText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  cardNumber: { fontSize: 14, fontWeight: '700', color: '#030712' },
  cardHolder: { fontSize: 12, fontWeight: '500', color: '#6b7280', marginTop: 2 },

  addCardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    borderStyle: 'dashed', gap: 6,
  },
  addCardBtnText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  addCardBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14,
    gap: 8, marginTop: 10,
  },
  addCardBtnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryItemName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  summaryItemPrice: { fontSize: 13, fontWeight: '800', color: '#030712' },
  summaryLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: '#030712' },
  summaryTotal: { fontSize: 17, fontWeight: '900', color: '#030712' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14,
    paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#f3f4f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 10, gap: 10,
  },
  footerMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  footerTotal: { fontSize: 16, fontWeight: '900', color: '#030712' },
  placeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f97316', borderRadius: 16, paddingVertical: 18,
    gap: 8, shadowColor: '#f97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  placeBtnDisabled: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  placeBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },
});
