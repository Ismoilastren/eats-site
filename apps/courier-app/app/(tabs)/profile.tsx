import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  db,
  onSnapshot,
  collection,
  query,
  where,
} from '@repo/firebase-config';
import { formatCurrencyUZS, getVehicleLabel, normalizeOrderStatus, normalizeVehicleType } from '@repo/shared-types';
import { useAuthStore } from '../../stores/authStore';

// ─── Types ───
interface DeliveredOrderDoc {
  id: string;
  status?: string;
  deliveryFee?: number | string | null;
  createdAt?: unknown;
  deliveredAt?: unknown;
  updatedAt?: unknown;
}

// ─── Helpers ───
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const getVehicleIcon = (vehicleType?: string): IoniconName => {
  const v = normalizeVehicleType(vehicleType);
  if (v === 'car') return 'car';
  if (v === 'bicycle') return 'bicycle';
  if (v === 'foot') return 'walk';
  if (v === 'motorcycle') return 'bicycle'; // closest icon
  return 'rocket';
};

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

const toMoneyNumber = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

// ─── Bottom Sheet Modal Wrapper ───
interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const SheetModal = ({ visible, onClose, title, children }: SheetModalProps) => (
  <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: '#1e293b', paddingBottom: 40 }}>
        {/* Handle bar */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155' }} />
        </View>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: 'white', letterSpacing: 0.5 }}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>
        {/* Content */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          {children}
        </View>
      </View>
    </View>
  </Modal>
);

// ─── Row component ───
const Row = ({ icon, label, value, iconBg = 'rgba(255,255,255,0.06)', iconColor = '#94a3b8' }: {
  icon: IoniconName; label: string; value: string; iconBg?: string; iconColor?: string;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={{ flex: 1, color: '#cbd5e1', fontWeight: '600', fontSize: 15 }}>{label}</Text>
    <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 13 }}>{value}</Text>
  </View>
);

// ─── Menu Item ───
const MenuItem = ({ icon, label, subtitle, iconBg, iconColor, onPress, isLast = false, rightNode }: {
  icon: IoniconName; label: string; subtitle?: string; iconBg?: string; iconColor?: string;
  onPress: () => void; isLast?: boolean; rightNode?: React.ReactNode;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}
  >
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: iconBg || 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
      <Ionicons name={icon} size={20} color={iconColor || '#94a3b8'} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: label === 'Sign Out' ? '#ef4444' : 'white', fontWeight: '700', fontSize: 15 }}>{label}</Text>
      {subtitle && <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 2 }}>{subtitle}</Text>}
    </View>
    {rightNode || (label !== 'Sign Out' && <Ionicons name="chevron-forward" size={16} color="#475569" />)}
  </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function ProfileScreen() {
  const courier = useAuthStore((state) => state.courier);
  const isOnline = useAuthStore((state) => state.isOnline);
  const isBooting = useAuthStore((state) => state.isLoading);
  const isToggling = useAuthStore((state) => state.isUpdatingStatus);
  const toggleCourierOnline = useAuthStore((state) => state.toggleOnline);
  const signOut = useAuthStore((state) => state.signOut);
  const courierId = courier?.id || null;
  const [deliveredOrders, setDeliveredOrders] = useState<DeliveredOrderDoc[]>([]);
  const [activeModal, setActiveModal] = useState<'documents' | 'settings' | 'help' | null>(null);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

  // Settings state (UI only)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (!courierId) {
      setDeliveredOrders([]);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('assignedCourier.id', '==', courierId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const delivered: DeliveredOrderDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (normalizeOrderStatus(data.status) === 'delivered') {
          delivered.push({ id: docSnap.id, ...data } as DeliveredOrderDoc);
        }
      });
      setDeliveredOrders(delivered);
    }, (error) => {
      console.warn('Delivered orders sync error:', error);
    });

    return () => unsub();
  }, [courierId]);

  const handleLogout = () => {
    setSignOutModalVisible(true);
  };

  const handleConfirmSignOut = async () => {
    setSignOutModalVisible(false);
    await signOut();
  };

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

  // ─── BOOT SPINNER ───
  if (isBooting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════
  //  PROFILE VIEW
  // ═══════════════════════════════════════════
  const name = courier?.name || '';
  const earnings = deliveredOrders.reduce(
    (sum, order) => sum + toMoneyNumber(order.deliveryFee),
    0
  );
  const todayStart = getStartOfToday().getTime();
  const todayEarnings = deliveredOrders.reduce((sum, order) => {
    const date = toDate(order.deliveredAt) || toDate(order.updatedAt) || toDate(order.createdAt);
    if (!date || date.getTime() < todayStart) return sum;
    return sum + toMoneyNumber(order.deliveryFee);
  }, 0);
  const deliveries = deliveredOrders.length;
  const vehicleType = normalizeVehicleType(courier?.vehicleType);
  const vehicleDetails = [courier?.vehicleName, courier?.plateNumber]
    .filter(Boolean)
    .join(' · ');
  const statusLabel = courier?.status === 'busy'
    ? 'BUSY'
    : isOnline
      ? 'ONLINE'
      : 'OFFLINE';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: 'white', letterSpacing: 1 }}>MY PROFILE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: isOnline ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)' }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOnline ? '#10b981' : '#475569' }} />
          <Text style={{ color: isOnline ? '#10b981' : '#64748b', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + Name ── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 28 }}>
          <View style={{ position: 'relative', marginBottom: 16 }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 3, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 40, fontWeight: '900', color: '#f97316' }}>{(name || 'C').charAt(0).toUpperCase()}</Text>
            </View>
            {/* Online dot */}
            <View style={{ position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: isOnline ? '#10b981' : '#475569', borderWidth: 2, borderColor: '#0f172a' }} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: 'white', letterSpacing: 0.3 }}>{name || 'Name not set'}</Text>
          <Text style={{ color: '#64748b', fontWeight: '600', fontSize: 14, marginTop: 4 }}>{courier?.phone || 'No phone'}</Text>

          {/* ── DYNAMIC VEHICLE BADGE ── */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <Ionicons name={getVehicleIcon(vehicleType)} size={16} color="#f97316" />
            <Text style={{ color: '#f97316', fontWeight: '800', marginLeft: 8, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5 }}>
              {getVehicleLabel(vehicleType)}
              {vehicleDetails ? ` · ${vehicleDetails}` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Earnings Cards ── */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
            <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 }}>Balance</Text>
            <Text style={{ color: '#4ade80', fontSize: 20, fontWeight: '900', marginTop: 6 }} numberOfLines={1}>
              {formatCurrencyUZS(earnings)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
            <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 }}>Today</Text>
            <Text style={{ color: '#f97316', fontSize: 20, fontWeight: '900', marginTop: 6 }} numberOfLines={1}>
              {formatCurrencyUZS(todayEarnings)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
            <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5 }}>Orders</Text>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginTop: 6 }}>{deliveries}</Text>
            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700' }}>done</Text>
          </View>
        </View>

        {/* ── Online/Offline Toggle ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <TouchableOpacity
            onPress={toggleOnline}
            disabled={isToggling}
            activeOpacity={0.85}
            style={{ backgroundColor: isOnline ? '#10b981' : '#334155', paddingVertical: 18, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: isOnline ? '#10b981' : 'transparent', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16 }}
          >
            {isToggling ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name={isOnline ? 'radio-button-on' : 'radio-button-off'} size={22} color="white" />
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, marginLeft: 10, letterSpacing: 1.5 }}>
                  {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Account Section ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ color: '#475569', fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 8, marginLeft: 4 }}>Account</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <MenuItem
              icon="document-text"
              label="Documents"
              subtitle="ID Card, License & more"
              iconBg="rgba(99,102,241,0.15)"
              iconColor="#818cf8"
              onPress={() => setActiveModal('documents')}
            />
            <MenuItem
              icon="settings"
              label="Settings"
              subtitle="Notifications, Language"
              iconBg="rgba(14,165,233,0.15)"
              iconColor="#38bdf8"
              onPress={() => setActiveModal('settings')}
            />
            <MenuItem
              icon="help-circle"
              label="Help & Support"
              subtitle="Contact Dispatch Center"
              iconBg="rgba(16,185,129,0.15)"
              iconColor="#34d399"
              onPress={() => setActiveModal('help')}
              isLast
            />
          </View>
        </View>

        {/* ── Sign Out ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', paddingVertical: 18, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}
          >
            <Ionicons name="log-out" size={22} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 16, marginLeft: 10, letterSpacing: 1 }}>SIGN OUT</Text>
          </TouchableOpacity>
          <Text style={{ color: '#1e293b', textAlign: 'center', fontSize: 12, marginTop: 12, fontWeight: '600' }}>ID: {courierId}</Text>
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════════
           MODAL: DOCUMENTS
      ══════════════════════════════════════════ */}
      <SheetModal
        visible={activeModal === 'documents'}
        onClose={() => setActiveModal(null)}
        title="Documents"
      >
        <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600', marginBottom: 20 }}>Your verification documents submitted to the Dispatch Center.</Text>
        <Row icon="card" label="National ID Card" value="✅ Verified" iconBg="rgba(99,102,241,0.15)" iconColor="#818cf8" />
        <Row icon="car" label="Driver's License" value={vehicleType === 'car' || vehicleType === 'motorcycle' ? '✅ Verified' : 'N/A'} iconBg="rgba(99,102,241,0.15)" iconColor="#818cf8" />
        <Row icon="shield-checkmark" label="Background Check" value="✅ Cleared" iconBg="rgba(99,102,241,0.15)" iconColor="#818cf8" />
        <Row icon="camera" label="Profile Photo" value="✅ Uploaded" iconBg="rgba(99,102,241,0.15)" iconColor="#818cf8" />
        <View style={{ marginTop: 20, padding: 14, backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' }}>
          <Text style={{ color: '#818cf8', fontWeight: '700', fontSize: 13 }}>📩 Need to update a document? Contact your Admin or Dispatch Center via the Help & Support section.</Text>
        </View>
      </SheetModal>

      {/* ══════════════════════════════════════════
           MODAL: SETTINGS
      ══════════════════════════════════════════ */}
      <SheetModal
        visible={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        title="Settings"
      >
        {/* Notifications Toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Ionicons name="notifications" size={20} color="#38bdf8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Push Notifications</Text>
            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 2 }}>New order alerts</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#334155', true: '#f97316' }}
            thumbColor="white"
          />
        </View>

        {/* Sound Toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Ionicons name="volume-high" size={20} color="#38bdf8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Sound Effects</Text>
            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 2 }}>Order accepted/delivered sounds</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: '#334155', true: '#f97316' }}
            thumbColor="white"
          />
        </View>

        {/* Language */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Alert.alert('Language', 'Language selection coming soon.')}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Ionicons name="language" size={20} color="#38bdf8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>App Language</Text>
            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 2 }}>O'zbek / Русский / English</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#475569" />
        </TouchableOpacity>
      </SheetModal>

      {/* ══════════════════════════════════════════
           MODAL: HELP & SUPPORT
      ══════════════════════════════════════════ */}
      <SheetModal
        visible={activeModal === 'help'}
        onClose={() => setActiveModal(null)}
        title="Help & Support"
      >
        <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600', marginBottom: 20 }}>Reach the Dispatch Center directly for urgent issues.</Text>

        <Row icon="call" label="Dispatch Hotline" value="+998 71 000 00 00" iconBg="rgba(16,185,129,0.15)" iconColor="#34d399" />
        <Row icon="mail" label="Support Email" value="support@expresseats.uz" iconBg="rgba(16,185,129,0.15)" iconColor="#34d399" />
        <Row icon="logo-whatsapp" label="WhatsApp Group" value="Open Chat" iconBg="rgba(16,185,129,0.15)" iconColor="#34d399" />
        <Row icon="time" label="Working Hours" value="07:00 – 23:00" iconBg="rgba(16,185,129,0.15)" iconColor="#34d399" />

        <View style={{ marginTop: 20, padding: 16, backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' }}>
          <Text style={{ color: '#fb923c', fontWeight: '800', fontSize: 13, marginBottom: 6 }}>🚨 Emergency Protocol</Text>
          <Text style={{ color: '#94a3b8', fontWeight: '600', fontSize: 13, lineHeight: 20 }}>
            If you are in an accident or unsafe situation, call the Dispatch Hotline immediately. Your safety is the top priority.
          </Text>
        </View>
      </SheetModal>
      {/* ══════════════════════════════════════════
           MODAL: SIGN OUT CONFIRMATION
      ══════════════════════════════════════════ */}
      <SheetModal
        visible={signOutModalVisible}
        onClose={() => setSignOutModalVisible(false)}
        title="Sign Out"
      >
        <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600', marginBottom: 24, textAlign: 'center', lineHeight: 22 }}>
          Are you sure you want to sign out? You will stop receiving delivery requests.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => setSignOutModalVisible(false)}
            activeOpacity={0.8}
            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleConfirmSignOut}
            activeOpacity={0.8}
            style={{ flex: 1, backgroundColor: '#ef4444', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 1 }}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>
      </SheetModal>
    </SafeAreaView>
  );
}
