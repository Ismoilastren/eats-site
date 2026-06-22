import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  COLLECTIONS,
  MenuItem,
  Restaurant,
  formatCurrencyUZS,
  normalizeCoordinate,
} from '@repo/shared-types';
import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@repo/firebase-config';
import { useCartStore, type CartItem } from '../../stores/cartStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RestaurantMeta = Partial<Restaurant> & {
  id?: string;
  image?: string;
  coverImage?: string;
  coverImageUrl?: string;
  minOrder?: number;
  freeDeliveryThreshold?: number;
  etaMin?: number;
  etaMax?: number;
};

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const positiveNumber = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const animateCartChange = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

const restaurantImage = (restaurant: RestaurantMeta | null | undefined, fallback?: string) =>
  String(restaurant?.imageUrl || restaurant?.image || restaurant?.coverImageUrl || restaurant?.coverImage || fallback || '').trim();

function EmptyCartUI() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.emptySafeArea}>
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cart-outline" size={46} color="#ffdd00" />
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Choose a restaurant and add dishes to start an order.</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)' as any)}
          activeOpacity={0.86}
          style={styles.emptyButton}
        >
          <Ionicons name="storefront-outline" size={18} color="#111827" />
          <Text style={styles.emptyButtonText}>Browse restaurants</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function QuantityControl({
  quantity,
  onMinus,
  onPlus,
  dark = false,
}: {
  quantity: number;
  onMinus: () => void;
  onPlus: () => void;
  dark?: boolean;
}) {
  return (
    <View style={[styles.qtyControl, dark && styles.qtyControlDark]}>
      <TouchableOpacity onPress={onMinus} activeOpacity={0.78} style={styles.qtyButton}>
        <Ionicons name={quantity <= 1 ? 'trash-outline' : 'remove'} size={17} color="#f8fafc" />
      </TouchableOpacity>
      <Text style={styles.qtyText}>{quantity}</Text>
      <TouchableOpacity onPress={onPlus} activeOpacity={0.78} style={styles.qtyButton}>
        <Ionicons name="add" size={18} color="#f8fafc" />
      </TouchableOpacity>
    </View>
  );
}

function CartItemRow({
  item,
  onAdd,
  onRemove,
}: {
  item: CartItem;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.cartItem}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
      ) : (
        <View style={[styles.itemImage, styles.imageFallback]}>
          <Ionicons name="fast-food-outline" size={28} color="#a3a3a3" />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name || 'Item'}</Text>
        <Text style={styles.itemPrice}>{formatCurrencyUZS(money(item.price))}</Text>
      </View>
      <QuantityControl quantity={item.quantity} onMinus={onRemove} onPlus={onAdd} dark />
    </View>
  );
}

function RecommendationCard({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: () => void;
}) {
  return (
    <View style={styles.recommendationCard}>
      <View>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.recommendationImage} resizeMode="cover" />
        ) : (
          <View style={[styles.recommendationImage, styles.imageFallback]}>
            <Ionicons name="fast-food-outline" size={32} color="#a3a3a3" />
          </View>
        )}
        <TouchableOpacity onPress={onAdd} activeOpacity={0.8} style={styles.recommendationAdd}>
          <Ionicons name="add" size={26} color="#111827" />
        </TouchableOpacity>
      </View>
      <Text style={styles.recommendationPrice}>{formatCurrencyUZS(money(item.price))}</Text>
      <Text style={styles.recommendationName} numberOfLines={2}>{item.name}</Text>
      {!!item.description && <Text style={styles.recommendationDescription} numberOfLines={1}>{item.description}</Text>}
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const cartItems = useCartStore((state) => state.items);
  const restaurant = useCartStore((state) => state.restaurant);
  const deliveryFee = useCartStore((state) => state.deliveryFee);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const restaurantInstructions = useCartStore((state) => state.restaurantInstructions);
  const setRestaurantInstructions = useCartStore((state) => state.setRestaurantInstructions);
  const cutleryCount = useCartStore((state) => state.cutleryCount);
  const setCutleryCount = useCartStore((state) => state.setCutleryCount);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());
  const [hydrated, setHydrated] = useState(() => useCartStore.persist.hasHydrated());
  const [restaurantMeta, setRestaurantMeta] = useState<RestaurantMeta | null>(null);
  const [recommendations, setRecommendations] = useState<MenuItem[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState(restaurantInstructions);

  useEffect(() => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() => setHydrated(true));
    const fallback = setTimeout(() => setHydrated(true), 800);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const cartIds = useMemo(() => new Set(cartItems.map((item) => item.id)), [cartItems]);
  const cartIdKey = useMemo(() => cartItems.map((item) => item.id).sort().join('|'), [cartItems]);

  useEffect(() => {
    setInstructionDraft(restaurantInstructions);
  }, [restaurantInstructions]);

  useEffect(() => {
    if (!restaurant?.id) {
      setRestaurantMeta(null);
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingRecommendations(true);
      try {
        const [restaurantSnap, dishesSnap] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.RESTAURANTS, restaurant.id)),
          getDocs(collection(db, COLLECTIONS.RESTAURANTS, restaurant.id, 'dishes')),
        ]);

        if (cancelled) return;
        const meta = restaurantSnap.exists()
          ? ({ id: restaurantSnap.id, ...restaurantSnap.data() } as RestaurantMeta)
          : null;
        setRestaurantMeta(meta);

        const items: MenuItem[] = [];
        dishesSnap.forEach((itemDoc) => {
          const item = { id: itemDoc.id, ...itemDoc.data(), restaurantId: restaurant.id } as MenuItem;
          if (item.isAvailable !== false && !cartIds.has(item.id)) items.push(item);
        });

        if (items.length === 0) {
          const menuSnap = await getDocs(
            query(
              collection(db, COLLECTIONS.MENU_ITEMS),
              where('restaurantId', '==', restaurant.id),
              where('isAvailable', '==', true)
            )
          );
          menuSnap.forEach((itemDoc) => {
            const item = { id: itemDoc.id, ...itemDoc.data() } as MenuItem;
            if (!cartIds.has(item.id)) items.push(item);
          });
        }

        if (!cancelled) {
          setRecommendations(items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).slice(0, 8));
        }
      } catch (error) {
        console.error('Cart recommendations failed:', error);
        if (!cancelled) {
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) setLoadingRecommendations(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [cartIds, cartIdKey, restaurant?.id]);

  const total = useMemo(() => subtotal + money(deliveryFee), [deliveryFee, subtotal]);
  const eta = Number(restaurantMeta?.avgDeliveryTime || restaurant?.avgDeliveryTime || 30);
  const deliverySummary = `${formatCurrencyUZS(deliveryFee || 0)} • ${Math.max(15, eta - 5)}-${eta + 5} minutes`;
  const freeDeliveryThreshold = positiveNumber(restaurantMeta?.freeDeliveryThreshold);
  const minimumOrder = positiveNumber(restaurantMeta?.minOrderAmount ?? restaurantMeta?.minOrder);
  const progressTarget = freeDeliveryThreshold ?? minimumOrder;
  const progress = progressTarget ? Math.min(1, subtotal / progressTarget) : Number(deliveryFee || 0) === 0 ? 1 : 0;
  const remaining = progressTarget ? Math.max(0, progressTarget - subtotal) : 0;
  const progressLabel = freeDeliveryThreshold
    ? remaining > 0
      ? `Add ${formatCurrencyUZS(remaining)} for free delivery`
      : 'Free delivery unlocked'
    : minimumOrder
      ? remaining > 0
        ? `Add ${formatCurrencyUZS(remaining)} to reach restaurant minimum`
        : 'Restaurant minimum reached'
      : Number(deliveryFee || 0) === 0
        ? 'Free delivery unlocked'
        : `Delivery fee ${formatCurrencyUZS(deliveryFee || 0)}`;

  const changeQuantity = (item: CartItem, quantity: number) => {
    animateCartChange();
    updateQuantity(item.id, quantity);
  };

  const handleClearCart = () => {
    animateCartChange();
    clearCart();
  };

  const handleRecommendationAdd = (item: MenuItem) => {
    if (!restaurant) return;
    animateCartChange();
    addItem(
      {
        id: item.id,
        name: item.name,
        price: money(item.price),
        quantity: 1,
        imageUrl: item.imageUrl || '',
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
      },
      {
        id: restaurant.id,
        name: restaurant.name,
        imageUrl: restaurantImage(restaurantMeta, restaurant.imageUrl),
        location: normalizeCoordinate(restaurantMeta?.location) || restaurant.location,
        deliveryFee,
        avgDeliveryTime: eta,
        minOrderAmount: minimumOrder || undefined,
        freeDeliveryThreshold: freeDeliveryThreshold || undefined,
      }
    );
  };

  const saveInstructions = () => {
    setRestaurantInstructions(instructionDraft.trim());
    setInstructionsOpen(false);
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#ffdd00" />
          <Text style={styles.loadingText}>Loading cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!cartItems || cartItems.length === 0) return <EmptyCartUI />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.78} style={styles.closeButton}>
                <Ionicons name="close" size={30} color="#f8fafc" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.restaurantTitle} numberOfLines={1}>
                  {restaurant?.name || cartItems[0]?.restaurantName || 'Restaurant'}
                </Text>
                <Text style={styles.restaurantSubtitle}>{deliverySummary}</Text>
              </View>
              <TouchableOpacity onPress={handleClearCart} activeOpacity={0.78} style={styles.closeButton}>
                <Ionicons name="trash-outline" size={27} color="#f8fafc" />
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onAdd={() => changeQuantity(item, item.quantity + 1)}
            onRemove={() => changeQuantity(item, item.quantity - 1)}
          />
        )}
        ListFooterComponent={
          <View>
            <View style={styles.actionGrid}>
              <View style={styles.actionPill}>
                <Ionicons name="restaurant" size={24} color="#f8fafc" />
                <QuantityControl
                  quantity={cutleryCount}
                  onMinus={() => setCutleryCount(cutleryCount - 1)}
                  onPlus={() => setCutleryCount(cutleryCount + 1)}
                  dark
                />
              </View>
              <TouchableOpacity onPress={() => setInstructionsOpen(true)} activeOpacity={0.82} style={styles.instructionPill}>
                <Ionicons name="chatbubble" size={24} color="#f8fafc" />
                <View style={styles.instructionTextWrap}>
                  <Text style={styles.instructionTitle}>Instructions for restaurant</Text>
                  {!!restaurantInstructions && (
                    <Text style={styles.instructionPreview} numberOfLines={1}>{restaurantInstructions}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={24} color="#f8fafc" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Anything else?</Text>
            {loadingRecommendations ? (
              <View style={styles.recommendationLoading}>
                <ActivityIndicator color="#ffdd00" />
                <Text style={styles.recommendationLoadingText}>Loading recommendations...</Text>
              </View>
            ) : recommendations.length > 0 ? (
              <View style={styles.recommendationGrid}>
                {recommendations.map((item) => (
                  <RecommendationCard
                    key={item.id}
                    item={item}
                    onAdd={() => handleRecommendationAdd(item)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyRecommendations}>
                <Ionicons name="sparkles-outline" size={22} color="#a3a3a3" />
                <Text style={styles.emptyRecommendationsText}>No more available dishes from this restaurant.</Text>
              </View>
            )}

            <View style={styles.summaryPanel}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{progressLabel}</Text>
                <Text style={styles.progressAmount}>{formatCurrencyUZS(subtotal)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatCurrencyUZS(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>
                <Text style={styles.summaryValue}>{formatCurrencyUZS(deliveryFee || 0)}</Text>
              </View>
            </View>
          </View>
        }
      />

      <View style={styles.checkoutBar}>
        <View>
          <Text style={styles.checkoutCount}>{itemCount} items</Text>
          <Text style={styles.checkoutTotal}>{formatCurrencyUZS(total)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/checkout' as any)}
          activeOpacity={0.86}
          style={styles.checkoutButton}
        >
          <Text style={styles.checkoutButtonText}>Go to payment</Text>
          <View style={styles.checkoutIcon}>
            <Ionicons name="chevron-forward" size={24} color="#ffdd00" />
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={instructionsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setInstructionsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.instructionsSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Instructions for restaurant</Text>
            <TextInput
              value={instructionDraft}
              onChangeText={setInstructionDraft}
              multiline
              maxLength={500}
              placeholder="No onion, extra napkins, call before packing..."
              placeholderTextColor="#737373"
              style={styles.instructionsInput}
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity
                onPress={() => setInstructionsOpen(false)}
                activeOpacity={0.82}
                style={styles.sheetSecondary}
              >
                <Text style={styles.sheetSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveInstructions} activeOpacity={0.86} style={styles.sheetPrimary}>
                <Text style={styles.sheetPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111111' },
  emptySafeArea: { flex: 1, backgroundColor: '#111111' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#d4d4d4', fontSize: 14, fontWeight: '800' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 24, color: '#f8fafc', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  emptySubtitle: { marginTop: 8, color: '#a3a3a3', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 21 },
  emptyButton: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
    backgroundColor: '#ffdd00',
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  emptyButtonText: { color: '#111827', fontSize: 15, fontWeight: '900' },
  listContent: { paddingHorizontal: 16, paddingBottom: 178 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingTop: 8,
  },
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f1f1f',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 14 },
  restaurantTitle: { color: '#f5f5f5', fontSize: 21, fontWeight: '900', textAlign: 'center' },
  restaurantSubtitle: { marginTop: 3, color: '#8f8f8f', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemImage: { width: 82, height: 82, borderRadius: 22, backgroundColor: '#262626' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, paddingHorizontal: 14 },
  itemName: { color: '#f5f5f5', fontSize: 17, fontWeight: '800', lineHeight: 22 },
  itemPrice: { marginTop: 4, color: '#a3a3a3', fontSize: 14, fontWeight: '800' },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 17,
    padding: 5,
    backgroundColor: '#3a3a3a',
  },
  qtyControlDark: { backgroundColor: '#353535' },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#444444',
  },
  qtyText: { minWidth: 27, color: '#f8fafc', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  actionPill: {
    flex: 0.9,
    minHeight: 68,
    borderRadius: 24,
    backgroundColor: '#2b2b2b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  instructionPill: {
    flex: 1.35,
    minHeight: 68,
    borderRadius: 24,
    backgroundColor: '#2b2b2b',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
  },
  instructionTextWrap: { flex: 1 },
  instructionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', lineHeight: 18 },
  instructionPreview: { marginTop: 2, color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 29, fontWeight: '900', marginTop: 32, marginBottom: 14 },
  recommendationLoading: {
    minHeight: 120,
    borderRadius: 24,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recommendationLoadingText: { color: '#a3a3a3', fontSize: 13, fontWeight: '800' },
  recommendationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recommendationCard: {
    width: '48%',
    marginBottom: 8,
  },
  recommendationImage: { width: '100%', aspectRatio: 1, borderRadius: 24, backgroundColor: '#262626' },
  recommendationAdd: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationPrice: { color: '#f5f5f5', fontSize: 18, fontWeight: '900', marginTop: 10 },
  recommendationName: { color: '#e5e5e5', fontSize: 15, fontWeight: '800', lineHeight: 19, marginTop: 3 },
  recommendationDescription: { color: '#8f8f8f', fontSize: 13, fontWeight: '700', marginTop: 3 },
  emptyRecommendations: {
    minHeight: 94,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyRecommendationsText: { color: '#a3a3a3', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  summaryPanel: {
    marginTop: 22,
    borderRadius: 24,
    backgroundColor: '#1d1d1d',
    padding: 16,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressLabel: { flex: 1, color: '#d4d4d4', fontSize: 13, fontWeight: '900' },
  progressAmount: { color: '#14b86a', fontSize: 14, fontWeight: '900' },
  progressTrack: {
    height: 11,
    borderRadius: 999,
    backgroundColor: '#154533',
    overflow: 'hidden',
    marginTop: 11,
    marginBottom: 14,
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#14b86a' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: { color: '#a3a3a3', fontSize: 14, fontWeight: '800' },
  summaryValue: { color: '#f5f5f5', fontSize: 14, fontWeight: '900' },
  checkoutBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 30,
    backgroundColor: 'rgba(17,17,17,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#242424',
  },
  checkoutCount: { color: '#a3a3a3', fontSize: 13, fontWeight: '900' },
  checkoutTotal: { color: '#f8fafc', fontSize: 19, fontWeight: '900', marginTop: 2 },
  checkoutButton: {
    marginTop: 10,
    minHeight: 66,
    borderRadius: 28,
    backgroundColor: '#ffdd00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  checkoutButtonText: { color: '#171717', fontSize: 19, fontWeight: '900' },
  checkoutIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  instructionsSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 30,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3f3f46',
    marginBottom: 18,
  },
  sheetTitle: { color: '#f8fafc', fontSize: 21, fontWeight: '900', marginBottom: 12 },
  instructionsInput: {
    minHeight: 130,
    borderRadius: 20,
    backgroundColor: '#2b2b2b',
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    padding: 16,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  sheetSecondary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#2b2b2b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryText: { color: '#e5e5e5', fontSize: 15, fontWeight: '900' },
  sheetPrimary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#ffdd00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryText: { color: '#171717', fontSize: 15, fontWeight: '900' },
});
