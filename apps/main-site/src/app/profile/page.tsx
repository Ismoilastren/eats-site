'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type FirebaseUser,
} from "@repo/firebase-config";
import { LogOut, User as UserIcon, Mail, Phone, Package, Clock, ChevronRight, Edit2, Check, X, Loader2, CreditCard, Plus, Trash2, MapPin, CheckCircle2, Home } from "lucide-react";
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useMarketplace, type LocalOrder } from '@/context/MarketplaceContext';
import { getOrdersForCustomer } from '@/services/marketplace';
import {
  formatOrderDate,
  formatOrderTotalSafe,
  getCustomerOrderStatus,
  isValidRecentOrderTotal,
} from '@/lib/orderDisplay';
import { geocodeAddress, reverseGeocode } from '@/lib/yandexGeocoder';
import {
  createCustomerRecordId,
  getCardBrand,
  loadCustomerProfile,
  loadPaymentMethods,
  loadSavedLocations,
  maskCardNumber,
  normalizeCardNumber,
  normalizeUzbekPhone,
  readStoredCustomerProfile,
  readStoredLocations,
  readStoredPaymentMethods,
  removePaymentMethod,
  removeSavedLocation,
  saveCustomerProfile,
  savePaymentMethod,
  saveSavedLocation,
  subscribeCustomerProfileStorage,
  validateCardNumber,
  validateExpiry,
  type CustomerProfile,
  type PaymentMethod,
  type SavedLocation,
  type SavedLocationSource,
} from '@/services/customerProfile';

const getBrandColor = (brand: string) => {
  switch (brand) {
    case 'Visa': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Mastercard': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Amex': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Uzcard': return 'bg-green-50 text-green-700 border-green-200';
    case 'Humo': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

export default function ProfilePage() {
  const router = useRouter();
  const {
    user: marketplaceUser,
    login: updateMarketplaceUser,
    address: currentDeliveryAddress,
  } = useMarketplace();
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profileData, setProfileData] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: ""
  });

  // Payment Method States
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '', holder: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  // Address States
  const [addresses, setAddresses] = useState<SavedLocation[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState<{
    label: string;
    address: string;
    lat?: number;
    lng?: number;
    source: SavedLocationSource;
  }>({ label: '', address: '', source: 'manual' });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthLoading(false);
      } else {
        router.push("/auth/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 2. Fetch profile data without making the page depend on Firestore availability.
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!user) return;

      const localProfile = readStoredCustomerProfile(user.uid);
      const initialProfile: CustomerProfile = {
        fullName: localProfile?.fullName || user.displayName || marketplaceUser?.name || '',
        phone: localProfile?.phone || user.phoneNumber || marketplaceUser?.phone || '',
        email: localProfile?.email || user.email || marketplaceUser?.email || '',
        role: localProfile?.role || 'client',
      };
      setProfileData(initialProfile);
      setEditForm({ fullName: initialProfile.fullName, phone: initialProfile.phone });
      setPaymentMethods(readStoredPaymentMethods(user.uid));
      setAddresses(readStoredLocations(user.uid));

      const [loadedProfile, loadedCards, loadedLocations, loadedOrders] = await Promise.all([
        loadCustomerProfile(user.uid),
        loadPaymentMethods(user.uid),
        loadSavedLocations(user.uid),
        getOrdersForCustomer({
          userId: user.uid,
          emails: [user.email, marketplaceUser?.email],
          phones: [
            initialProfile.phone,
            marketplaceUser?.phone,
          ],
        }).catch(() => []),
      ]);

      if (cancelled) return;
      const nextProfile = loadedProfile || initialProfile;
      setProfileData(nextProfile);
      setEditForm({ fullName: nextProfile.fullName, phone: nextProfile.phone });
      setPaymentMethods(loadedCards);
      setAddresses(loadedLocations);
      setOrders(loadedOrders);
      setIsDataLoading(false);
    };

    if (!isAuthLoading && user) {
      fetchData();
    }
    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading, marketplaceUser?.email, marketplaceUser?.name, marketplaceUser?.phone]);

  useEffect(() => {
    if (!user) return;
    return subscribeCustomerProfileStorage(() => {
      setPaymentMethods(readStoredPaymentMethods(user.uid));
      setAddresses(readStoredLocations(user.uid));
      const storedProfile = readStoredCustomerProfile(user.uid);
      if (storedProfile) setProfileData(storedProfile);
    });
  }, [user]);

  const recentOrders = useMemo(
    () => orders.filter((order) => isValidRecentOrderTotal(order.total)).slice(0, 3),
    [orders],
  );

  const orderStats = useMemo(() => {
    const normalizedStatuses = orders.map((order) => getCustomerOrderStatus(order.status).status);
    const activeStatuses = new Set([
      'pending',
      'accepted',
      'preparing',
      'ready_for_pickup',
      'picked_up',
      'on_the_way',
    ]);

    return {
      total: orders.length,
      delivered: normalizedStatuses.filter((status) => status === 'delivered').length,
      active: normalizedStatuses.filter((status) => activeStatuses.has(status)).length,
    };
  }, [orders]);

  const canUseCurrentDeliveryAddress = Boolean(
    currentDeliveryAddress.confirmed
    && currentDeliveryAddress.text.trim()
    && !/^selected point/i.test(currentDeliveryAddress.text)
  );

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch {
      toast.error("Failed to sign out.");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!user) return;

    try {
      await removeSavedLocation(user.uid, id);
      setAddresses((current) => current.filter((item) => item.id !== id));
      toast.success("Address deleted");
    } catch {
      toast.error('Could not remove this address from browser storage.');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const nextErrors: Record<string, string> = {};
    if (!newAddress.label.trim()) nextErrors.label = 'Label is required.';
    if (!newAddress.address.trim()) nextErrors.address = 'Address is required.';
    setAddressErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsAddingAddress(true);
    try {
      let resolvedAddress = newAddress.address.trim();
      let lat = newAddress.lat;
      let lng = newAddress.lng;

      if (newAddress.source === 'manual' && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
        try {
          const geocoded = await geocodeAddress(resolvedAddress);
          if (geocoded[0]) {
            resolvedAddress = geocoded[0].fullAddress;
            lat = geocoded[0].lat;
            lng = geocoded[0].lng;
          }
        } catch {
          // A typed address remains valid even when optional coordinate lookup is unavailable.
        }
      }

      const safeAddress: SavedLocation = {
        id: createCustomerRecordId('location'),
        label: newAddress.label.trim(),
        address: resolvedAddress,
        lat,
        lng,
        source: newAddress.source,
        createdAt: new Date().toISOString(),
      };

      const result = await saveSavedLocation(user.uid, safeAddress);
      setAddresses((current) => [...current.filter((item) => item.id !== result.value.id), result.value]);

      toast.success("Address saved");
      setIsAddressModalOpen(false);
      setNewAddress({ label: '', address: '', source: 'manual' });
      setAddressErrors({});
    } catch {
      toast.error('Could not save this address on this device.');
    } finally {
      setIsAddingAddress(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setNewAddress((previous) => ({
          ...previous,
          lat: latitude,
          lng: longitude,
          source: 'current_location',
        }));
        try {
          const result = await reverseGeocode(latitude, longitude);
          if (!result) {
            setNewAddress((previous) => ({
              ...previous,
              address: '',
              lat: latitude,
              lng: longitude,
              source: 'current_location',
            }));
            setAddressErrors((current) => ({
              ...current,
              address: 'Address could not be resolved. Enter the exact address manually.',
            }));
            toast.error("Address could not be resolved");
            return;
          }
          setNewAddress((previous) => ({
            ...previous,
            address: result.fullAddress,
            lat: latitude,
            lng: longitude,
            source: 'current_location',
          }));
          setAddressErrors((current) => ({ ...current, address: '' }));
          toast.success("Location found");
        } catch {
          setNewAddress((previous) => ({
            ...previous,
            address: '',
            lat: latitude,
            lng: longitude,
            source: 'current_location',
          }));
          setAddressErrors((current) => ({
            ...current,
            address: 'Address could not be resolved. Enter the exact address manually.',
          }));
          toast.error("Address could not be resolved");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        toast.error("Location access denied.");
      }
    );
  };

  const handleSaveProfile = async () => {
    const fullName = editForm.fullName.trim();
    if (!fullName) {
      toast.error("Name cannot be empty");
      return;
    }
    const phone = normalizeUzbekPhone(editForm.phone);
    if (!phone) {
      toast.error("Enter a valid Uzbekistan phone number, for example +998901234567.");
      return;
    }
    if (!user) {
      toast.error('Authentication error. Please sign in again.');
      return;
    }
    setIsSaving(true);
    try {
      const nextProfile: CustomerProfile = {
        fullName,
        phone,
        email: profileData?.email || user.email || marketplaceUser?.email || '',
        role: profileData?.role || 'client',
      };
      const saved = await saveCustomerProfile(user.uid, nextProfile);
      setProfileData(saved.value);
      setEditForm({ fullName: saved.value.fullName, phone: saved.value.phone });
      updateMarketplaceUser(saved.value.fullName, saved.value.phone, saved.value.email);
      setIsEditing(false);
      toast.success("Profile updated");
      if (auth.currentUser) {
        updateProfile(auth.currentUser, { displayName: saved.value.fullName }).catch(() => undefined);
      }
    } catch {
      toast.error("Could not save profile changes on this device.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.uid) return toast.error('Authentication error.');

    const cleanNumber = normalizeCardNumber(cardForm.number);
    const nextErrors: Record<string, string> = {};
    if (!validateCardNumber(cleanNumber)) {
      nextErrors.number = 'Enter a valid card number.';
    }
    if (!validateExpiry(cardForm.expiry)) {
      nextErrors.expiry = 'Enter a future date in MM/YY format.';
    }
    if (!/^\d{3,4}$/.test(cardForm.cvv)) {
      nextErrors.cvv = 'CVV must contain 3 or 4 digits.';
    }
    if (!cardForm.holder.trim()) {
      nextErrors.holder = 'Cardholder name is required.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsAddingCard(true);
    const safeCard: PaymentMethod = {
      id: createCustomerRecordId('card'),
      brand: getCardBrand(cleanNumber),
      last4: cleanNumber.slice(-4),
      maskedNumber: maskCardNumber(cleanNumber),
      expiry: cardForm.expiry,
      cardholderName: cardForm.holder.trim().toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    try {
      const result = await savePaymentMethod(user.uid, safeCard);
      setPaymentMethods((current) => [
        ...current.filter((item) => item.id !== result.value.id),
        result.value,
      ]);

      setCardForm({ number: '', expiry: '', cvv: '', holder: '' });
      setErrors({});
      setIsCardModalOpen(false);
      toast.success('Card added');
    } catch {
      toast.error('Could not save this card on this device.');
    } finally {
      setIsAddingCard(false);
    }
  };

  const handleDeleteCard = (id: string) => {
    setCardToDelete(id);
  };

  const confirmDeleteCard = async () => {
    if (!user || !user.uid || !cardToDelete) return;

    try {
      await removePaymentMethod(user.uid, cardToDelete);
      setPaymentMethods((current) => current.filter((card) => card.id !== cardToDelete));
      toast.success('Card removed');
      setCardToDelete(null);
    } catch {
      toast.error('Could not remove this card from browser storage.');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4ee] pt-28 pb-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f4ee] pb-20 pt-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_12%_18%,rgba(255,190,92,0.28),transparent_38%),radial-gradient(circle_at_88%_8%,rgba(255,107,53,0.18),transparent_34%)]" />

      <main className="relative mx-auto max-w-6xl px-4 lg:px-8">
        <div className="mb-6">
          <Link href="/" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/80 px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-black/5 transition hover:bg-white hover:text-primary">
            <Home size={17} />
            Back to home
          </Link>
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-primary">Customer account</p>
          <h1 className="mt-2 text-4xl font-black text-[#111827] md:text-5xl">My profile</h1>
          <p className="mt-3 max-w-2xl text-base font-medium text-gray-600 md:text-lg">
            Manage your delivery details and track your recent orders.
          </p>
        </div>

        <section className="overflow-hidden rounded-[36px] bg-[#111827] text-white shadow-[0_24px_70px_rgba(17,24,39,0.22)]">
          <div className="grid lg:grid-cols-[1.35fr_1fr]">
            <div className="relative p-6 md:p-9">
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-primary text-white shadow-[0_16px_36px_rgba(255,107,53,0.34)]">
                  <UserIcon size={44} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="break-words text-3xl font-black md:text-4xl">
                      {profileData?.fullName || user?.displayName || "Customer"}
                    </h2>
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-orange-200 ring-1 ring-white/15">
                      Customer
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 text-sm font-semibold text-gray-300 sm:flex-row sm:flex-wrap sm:gap-x-6">
                    <span className="flex min-w-0 items-center gap-2">
                      <Mail size={17} className="shrink-0 text-orange-300" />
                      <span className="truncate">{profileData?.email || user?.email || "No email provided"}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Phone size={17} className="text-orange-300" />
                      {profileData?.phone || "Phone not provided"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-white/10 bg-white/[0.04] lg:border-l lg:border-t-0">
              <div className="flex min-h-28 flex-col justify-center px-4 py-6 text-center">
                <Package className="mx-auto text-orange-300" size={22} />
                <span className="mt-3 text-3xl font-black">{orderStats.total}</span>
                <span className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-400">Total orders</span>
              </div>
              <div className="flex min-h-28 flex-col justify-center border-x border-white/10 px-4 py-6 text-center">
                <CheckCircle2 className="mx-auto text-emerald-300" size={22} />
                <span className="mt-3 text-3xl font-black">{orderStats.delivered}</span>
                <span className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-400">Delivered</span>
              </div>
              <div className="flex min-h-28 flex-col justify-center px-4 py-6 text-center">
                <Clock className="mx-auto text-amber-300" size={22} />
                <span className="mt-3 text-3xl font-black">{orderStats.active}</span>
                <span className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-400">Active</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-7 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-6 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Personal information</p>
                  <h3 className="mt-1 text-2xl font-black text-gray-950">Profile details</h3>
                </div>
                {!isEditing ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex min-h-11 items-center gap-2 rounded-xl bg-orange-50 px-4 py-2 text-sm font-bold text-primary transition hover:bg-orange-100"
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          fullName: profileData?.fullName || user?.displayName || "",
                          phone: profileData?.phone || ""
                        });
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                      aria-label="Cancel editing"
                    >
                      <X size={18} />
                    </button>
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-[#eb5c28] disabled:opacity-70"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {isEditing && (
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Full name</span>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                      className="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-3.5 font-bold text-gray-900 outline-none ring-primary/30 transition focus:ring-2"
                      placeholder="Your Full Name"
                    />
                  </label>
                )}

                <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                    <Mail size={19} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Email address</span>
                    <span className="mt-1 block truncate font-bold text-gray-800" title={profileData?.email || user?.email || undefined}>
                      {profileData?.email || user?.email || "No email provided"}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                    <Phone size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Phone number</span>
                    {!isEditing ? (
                      <span className="mt-1 block font-bold text-gray-800">{profileData?.phone || "Not provided"}</span>
                    ) : (
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9+]/g, '');
                          setEditForm(prev => ({ ...prev, phone: val }));
                        }}
                        className="mt-2 w-full rounded-xl bg-white px-3 py-2.5 font-bold text-gray-900 outline-none ring-primary/30 transition focus:ring-2"
                        placeholder="+998901234567"
                      />
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleSignOut}
                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-600 transition hover:bg-red-100"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-[0_14px_45px_rgba(17,24,39,0.07)]">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-primary">
                    <CreditCard size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-950">Payment methods</h3>
                    <p className="text-sm font-medium text-gray-500">Secure checkout options</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCardModalOpen(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-white transition hover:bg-primary"
                  aria-label="Add payment method"
                >
                  <Plus size={20} />
                </button>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-5 py-6 text-center">
                  <CreditCard className="mx-auto text-gray-300" size={30} />
                  <p className="mt-3 font-black text-gray-800">No cards added yet</p>
                  <p className="mt-1 text-sm font-medium text-gray-500">Add a card for faster checkout.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map(card => (
                    <div key={card.id} className="group flex items-center justify-between rounded-2xl bg-gray-50 p-4 transition hover:bg-orange-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-8 rounded-md flex items-center justify-center text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${getBrandColor(card.brand)}`}>
                          {card.brand}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{card.maskedNumber}</span>
                          <span className="text-xs text-gray-400">{card.cardholderName}{card.expiry ? ` · ${card.expiry}` : ''}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteCard(card.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 opacity-100 transition hover:bg-white hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Delete Card"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-[0_14px_45px_rgba(17,24,39,0.07)]">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <MapPin size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-950">Saved locations</h3>
                    <p className="text-sm font-medium text-gray-500">Your delivery favorites</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddressModalOpen(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-white transition hover:bg-primary"
                  aria-label="Add saved location"
                >
                  <Plus size={20} />
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-5 py-6 text-center">
                  <MapPin className="mx-auto text-gray-300" size={30} />
                  <p className="mt-3 font-black text-gray-800">No saved locations yet</p>
                  <p className="mt-1 text-sm font-medium text-gray-500">Add your favorite delivery addresses.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map(addr => (
                    <div key={addr.id} className="group flex items-start justify-between rounded-2xl bg-gray-50 p-4 transition hover:bg-amber-50">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                          <MapPin size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-gray-900">{addr.label || 'Home'}</span>
                          <span className="mt-1 line-clamp-2 block text-xs font-medium text-gray-500">{addr.address}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 opacity-100 transition hover:bg-white hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Delete Address"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          
          <section className="h-fit rounded-[32px] bg-white p-5 shadow-[0_18px_55px_rgba(17,24,39,0.09)] md:p-7">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Order activity</p>
                <h2 className="mt-1 text-3xl font-black text-gray-950">Recent orders</h2>
                <p className="mt-2 font-medium text-gray-500">Your latest deliveries, all in one place.</p>
              </div>
              <Link href="/orders" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary">
                View all orders <ChevronRight size={17} />
              </Link>
            </div>
              
            {isDataLoading ? (
              <div className="mt-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 w-full animate-pulse rounded-[24px] bg-gray-100"></div>
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-[26px] bg-[#faf9f6] px-6 py-12 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white text-gray-300 shadow-sm">
                  <Package size={34} />
                </div>
                <h3 className="mt-5 text-2xl font-black text-gray-900">No orders yet</h3>
                <p className="mt-2 max-w-sm font-medium text-gray-500">Your recent orders will appear here after your first checkout.</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-6 min-h-12 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-[0_12px_26px_rgba(255,107,53,0.24)] transition hover:bg-[#eb5c28]"
                >
                  Explore restaurants
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {recentOrders.map((order) => {
                  const orderStatus = getCustomerOrderStatus(order.status);
                  return (
                    <article key={order.id} className="group rounded-[24px] bg-[#faf9f6] p-5 transition hover:-translate-y-0.5 hover:bg-orange-50/70 hover:shadow-[0_14px_30px_rgba(17,24,39,0.08)] md:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-gray-950">Order #{order.id.substring(0, 8).toUpperCase()}</h3>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${orderStatus.className}`}>
                              {orderStatus.label}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-base font-bold text-gray-700">
                            {order.restaurantName || 'Restaurant'}
                          </p>
                          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-gray-500">
                            <Clock size={15} />
                            {formatOrderDate(order.createdAt)}
                          </p>
                        </div>
                        <p className="shrink-0 text-lg font-black text-gray-950">{formatOrderTotalSafe(order.total)}</p>
                      </div>
                      
                      <div className="mt-5 flex justify-end border-t border-black/5 pt-4">
                        <Link href={`/orders/${order.id}`} className="flex min-h-11 items-center gap-1 rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm transition group-hover:bg-primary group-hover:text-white">
                          View details <ChevronRight size={16} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Card Modal */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setIsCardModalOpen(false);
                setErrors({});
                setCardForm({ number: '', expiry: '', cvv: '', holder: '' });
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <CreditCard className="text-primary" /> Add New Card
            </h3>
            
            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Card Number</label>
                <input 
                  type="text" 
                  maxLength={23}
                  value={cardForm.number}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const formatted = val.replace(/(.{4})/g, '$1 ').trim();
                    setCardForm({...cardForm, number: formatted});
                    if (errors.number) setErrors({...errors, number: ''});
                  }}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none ${errors.number ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                  placeholder="0000 0000 0000 0000"
                />
                {errors.number && <p className="mt-1.5 text-xs font-bold text-red-600">{errors.number}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expiry</label>
                  <input 
                    type="text" 
                    maxLength={5}
                    value={cardForm.expiry}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 2) val = `${val.slice(0,2)}/${val.slice(2,4)}`;
                      setCardForm({...cardForm, expiry: val});
                      if (errors.expiry) setErrors({...errors, expiry: ''});
                    }}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-center ${errors.expiry ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                    placeholder="MM/YY"
                  />
                  {errors.expiry && <p className="mt-1.5 text-xs font-bold text-red-600">{errors.expiry}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">CVV</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={cardForm.cvv}
                    onChange={(e) => {
                      setCardForm({...cardForm, cvv: e.target.value.replace(/\D/g, '')});
                      if (errors.cvv) setErrors({...errors, cvv: ''});
                    }}
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-center ${errors.cvv ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                    placeholder="123"
                  />
                  {errors.cvv && <p className="mt-1.5 text-xs font-bold text-red-600">{errors.cvv}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cardholder Name</label>
                <input 
                  type="text" 
                  value={cardForm.holder}
                  onChange={(e) => {
                    setCardForm({...cardForm, holder: e.target.value});
                    if (errors.holder) setErrors({...errors, holder: ''});
                  }}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none uppercase ${errors.holder ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                  placeholder="JOHN DOE"
                />
                {errors.holder && <p className="mt-1.5 text-xs font-bold text-red-600">{errors.holder}</p>}
              </div>
              <button 
                type="submit"
                disabled={isAddingCard}
                className="w-full mt-6 bg-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors shadow-md disabled:opacity-70 flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                {isAddingCard ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Save Card
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Card Confirmation Modal */}
      {cardToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Card?</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to remove this payment method? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setCardToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border-none cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteCard}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors border-none cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setIsAddressModalOpen(false);
                setAddressErrors({});
                setNewAddress({ label: '', address: '', source: 'manual' });
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <MapPin className="text-primary" /> Add Location
            </h3>
            
            <form onSubmit={handleAddAddress} className="space-y-4">
              {canUseCurrentDeliveryAddress && (
                <button
                  type="button"
                  onClick={() => {
                    setNewAddress((current) => ({
                      ...current,
                      address: currentDeliveryAddress.text,
                      lat: currentDeliveryAddress.lat,
                      lng: currentDeliveryAddress.lng,
                      source: 'suggestion',
                    }));
                    setAddressErrors((current) => ({ ...current, address: '' }));
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-left transition hover:bg-orange-100"
                >
                  <MapPin size={19} className="shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-gray-900">Use selected delivery address</span>
                    <span className="block truncate text-xs font-bold text-gray-500">
                      {currentDeliveryAddress.text.replace(/^Tashkent,\s*/i, '')}
                    </span>
                  </span>
                </button>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Label (e.g. Home, Work)</label>
                <input 
                  type="text" 
                  value={newAddress.label}
                  onChange={(e) => {
                    setNewAddress({...newAddress, label: e.target.value});
                    if (addressErrors.label) setAddressErrors((current) => ({ ...current, label: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none ${addressErrors.label ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-primary'}`}
                  placeholder="Home"
                />
                {addressErrors.label && <p className="mt-1.5 text-xs font-bold text-red-600">{addressErrors.label}</p>}
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Address Details</label>
                  <button 
                    type="button" 
                    onClick={handleDetectLocation} 
                    disabled={isLocating}
                    className="text-xs font-bold text-blue-500 hover:text-blue-600 bg-transparent border-none cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    📍 {isLocating ? 'Detecting...' : 'Detect My Location'}
                  </button>
                </div>
                <textarea 
                  value={newAddress.address}
                  onChange={(e) => {
                    setNewAddress({
                      ...newAddress,
                      address: e.target.value,
                      lat: undefined,
                      lng: undefined,
                      source: 'manual',
                    });
                    if (addressErrors.address) setAddressErrors((current) => ({ ...current, address: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none h-24 ${addressErrors.address ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-primary'}`}
                  placeholder="Street, Building, Apartment..."
                />
                {addressErrors.address && <p className="mt-1.5 text-xs font-bold text-red-600">{addressErrors.address}</p>}
              </div>
              <button 
                type="submit"
                disabled={isAddingAddress}
                className="w-full mt-6 bg-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors shadow-md disabled:opacity-70 flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                {isAddingAddress ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Save Address
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
