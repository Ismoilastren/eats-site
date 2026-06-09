import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatCurrencyUZS } from '@repo/shared-types';
import { useCartStore, type CartItem } from '../../stores/cartStore';

// ─── EMPTY STATE ────────────────────────────────────────────────────────────
function EmptyCartUI() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Minimal Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>BASKET</Text>
        <Text style={styles.headerTitle}>Cart</Text>
      </View>

      {/* Centered Empty Content */}
      <View style={styles.emptyContainer}>
        {/* Icon circle */}
        <View style={styles.iconCircle}>
          <Ionicons name="cart-outline" size={64} color="#f97316" />
        </View>

        <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Looks like you haven't added any food yet.{'\n'}Let's find something delicious!
        </Text>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.85}
          style={styles.ctaButton}
        >
          <Ionicons name="storefront-outline" size={20} color="#fff" />
          <Text style={styles.ctaText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── CART ITEM ROW ──────────────────────────────────────────────────────────
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
    <View style={styles.itemCard}>
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.itemImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.itemImage, styles.itemImageFallback]}>
          <Ionicons name="fast-food-outline" size={28} color="#f97316" />
        </View>
      )}

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name || 'Item'}
        </Text>
        <Text style={styles.itemPrice}>
          {formatCurrencyUZS(Number(item.price || 0))}
        </Text>
      </View>

      <View style={styles.qtyControl}>
        <TouchableOpacity onPress={onRemove} style={styles.qtyBtn}>
          <Ionicons
            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
            size={16}
            color={item.quantity === 1 ? '#ef4444' : '#111827'}
          />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity onPress={onAdd} style={[styles.qtyBtn, styles.qtyBtnOrange]}>
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function CartScreen() {
  const router = useRouter();
  const cartItems = useCartStore((state) => state.items);
  const restaurant = useCartStore((state) => state.restaurant);
  const deliveryFee = useCartStore((state) => state.deliveryFee);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());
  const [hydrated, setHydrated] = useState(() => useCartStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() => setHydrated(true));
    const fallback = setTimeout(() => setHydrated(true), 800);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const total = useMemo(() => subtotal + Number(deliveryFee || 0), [deliveryFee, subtotal]);

  // ── Skeleton while store hydrates ──
  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>BASKET</Text>
          <Text style={styles.headerTitle}>Cart</Text>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={styles.skeleton} />
          <View style={[styles.skeleton, { height: 80 }]} />
          <View style={[styles.skeleton, { height: 80 }]} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ──
  if (!cartItems || cartItems.length === 0) return <EmptyCartUI />;

  // ── Populated cart ──
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.listHeader}>
              <View>
                <Text style={styles.headerLabel}>BASKET</Text>
                <Text style={styles.headerTitle}>Cart</Text>
              </View>
              <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={19} color="#ef4444" />
              </TouchableOpacity>
            </View>

            {/* Restaurant card */}
            <View style={styles.restaurantCard}>
              <View style={styles.restaurantIconWrap}>
                <Ionicons name="storefront" size={22} color="#f97316" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {restaurant?.name || cartItems[0]?.restaurantName || 'Restaurant'}
                </Text>
                <Text style={styles.restaurantSub}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onAdd={() => updateQuantity(item.id, item.quantity + 1)}
            onRemove={() => updateQuantity(item.id, item.quantity - 1)}
          />
        )}
        ListFooterComponent={
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrencyUZS(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery fee</Text>
              <Text style={styles.summaryValue}>{formatCurrencyUZS(deliveryFee || 0)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrencyUZS(total)}</Text>
            </View>
          </View>
        }
      />

      {/* Sticky Checkout Bar */}
      <View style={styles.checkoutBar}>
        <View style={styles.checkoutMeta}>
          <Text style={styles.checkoutCount}>{itemCount} items</Text>
          <Text style={styles.checkoutTotal}>{formatCurrencyUZS(total)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/checkout' as any)}
          activeOpacity={0.85}
          style={styles.checkoutBtn}
        >
          <Text style={styles.checkoutBtnText}>Checkout</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f97316',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#030712',
    marginTop: 2,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fed7aa',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#030712',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 40,
    marginTop: 36,
    gap: 10,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // List header
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 16,
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Restaurant card
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  restaurantIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#030712',
  },
  restaurantSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 2,
  },

  // Item card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  itemImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#030712',
    lineHeight: 20,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 4,
  },

  // Qty control
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnOrange: {
    backgroundColor: '#f97316',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#030712',
    minWidth: 24,
    textAlign: 'center',
  },

  // Summary card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#030712',
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 4,
    paddingTop: 16,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#030712',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#030712',
  },

  // Checkout bar
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
    gap: 12,
  },
  checkoutMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkoutCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
  },
  checkoutTotal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#030712',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    borderRadius: 18,
    paddingVertical: 18,
    gap: 8,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  checkoutBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Skeleton
  skeleton: {
    height: 96,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
});
